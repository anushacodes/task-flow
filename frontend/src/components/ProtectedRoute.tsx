import React from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/features/auth/AuthProvider"

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm font-medium text-muted-foreground animate-pulse">Loading TaskFlow...</div>
      </div>
    )
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
