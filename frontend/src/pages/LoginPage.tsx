import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "react-router-dom"
import { CheckSquare, ArrowRight, Loader2 } from "lucide-react"
import { useAuth } from "@/features/auth/AuthProvider"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type LoginFormData = z.infer<typeof loginSchema>

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setErrorMessage(null)
      await login(data.email, data.password)
      navigate("/workspaces")
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === "string") {
        setErrorMessage(detail)
      } else if (Array.isArray(detail)) {
        setErrorMessage(detail.map((e: any) => e.msg || e.message).join(", "))
      } else if (err.message) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Authentication failed. Please check your credentials.")
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/70 p-7 shadow-2xl backdrop-blur-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <CheckSquare className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Welcome to TaskFlow</h1>
          <p className="mt-1 text-xs text-zinc-400">Sign in to manage tasks and workspaces</p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-400">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Email
            </label>
            <input
              type="email"
              {...register("email")}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Password
            </label>
            <input
              type="password"
              {...register("password")}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="••••••••"
            />
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-800/80 pt-4 text-center">
          <p className="text-xs text-zinc-400">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
