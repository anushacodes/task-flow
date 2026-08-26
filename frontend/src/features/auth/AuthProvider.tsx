import React, { createContext, useContext, useEffect, useState } from "react"
import { apiClient } from "@/api/client"
import { useAuthStore, User } from "@/stores/authStore"

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, accessToken, isAuthenticated, setAuth, clearAuth } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const refreshRes = await apiClient.post("/api/v1/auth/refresh")
        const token = refreshRes.data.access_token
        const meRes = await apiClient.get("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        setAuth(token, meRes.data)
      } catch {
        clearAuth()
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [setAuth, clearAuth])

  const login = async (email: string, password: string) => {
    const formData = new URLSearchParams()
    formData.append("username", email)
    formData.append("password", password)

    const res = await apiClient.post("/api/v1/auth/token", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })

    const token = res.data.access_token
    const meRes = await apiClient.get("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    setAuth(token, meRes.data)
  }

  const register = async (email: string, name: string, password: string) => {
    await apiClient.post("/api/v1/auth/register", {
      email,
      name,
      password,
    })
    await login(email, password)
  }

  const logout = async () => {
    try {
      await apiClient.post("/api/v1/auth/logout")
    } finally {
      clearAuth()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
