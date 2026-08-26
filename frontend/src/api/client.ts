import axios, { AxiosError, InternalAxiosRequestConfig } from "axios"
import { useAuthStore } from "@/stores/authStore"

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes("/api/v1/auth/token") || originalRequest.url?.includes("/api/v1/auth/refresh")) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshResponse = await axios.post(
          `${baseURL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const newAccessToken = refreshResponse.data.access_token

        const userResponse = await axios.get(`${baseURL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${newAccessToken}` },
          withCredentials: true,
        })

        useAuthStore.getState().setAuth(newAccessToken, userResponse.data)
        processQueue(null)

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        }
        return apiClient(originalRequest)
      } catch (refreshErr) {
        processQueue(refreshErr as AxiosError)
        useAuthStore.getState().clearAuth()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
