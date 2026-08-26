import React from "react"
import { useAuth } from "@/features/auth/AuthProvider"

export const WorkspacePage: React.FC = () => {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background p-8">
      <header className="flex justify-between items-center pb-6 border-b">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.name || user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Sign out
        </button>
      </header>
      <main className="mt-8">
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Workspace list will appear here in Phase 3.
        </div>
      </main>
    </div>
  )
}
