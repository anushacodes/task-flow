import React, { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createWorkspace, listWorkspaces, WorkspaceListItem } from "@/api/workspaces"
import { MembersPanel } from "@/components/WorkspaceSettings/MembersPanel"
import { ProjectList } from "@/components/ProjectList/ProjectList"
import { useAuth } from "@/features/auth/AuthProvider"
import { useUIStore } from "@/stores/uiStore"

export const WorkspacePage: React.FC = () => {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const { activeWorkspaceId, setActiveWorkspace } = useUIStore()

  const [activeTab, setActiveTab] = useState<"projects" | "members">("projects")
  const [isNewWsOpen, setIsNewWsOpen] = useState(false)
  const [newWsName, setNewWsName] = useState("")
  const [newWsDesc, setNewWsDesc] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
  })

  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      if (!activeWorkspaceId || !workspaces.some((w: WorkspaceListItem) => w.id === activeWorkspaceId)) {
        setActiveWorkspace(workspaces[0].id)
      }
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspace])

  const createWsMutation = useMutation({
    mutationFn: () =>
      createWorkspace({
        name: newWsName,
        description: newWsDesc || undefined,
      }),
    onSuccess: (newWs) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] })
      setActiveWorkspace(newWs.id)
      setIsNewWsOpen(false)
      setNewWsName("")
      setNewWsDesc("")
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || "Failed to create workspace")
    },
  })

  const handleCreateWsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWsName.trim()) return
    createWsMutation.mutate()
  }

  const currentWorkspace = workspaces?.find((w: WorkspaceListItem) => w.id === activeWorkspaceId)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
              T
            </div>
            <span className="font-bold text-lg tracking-tight">TaskFlow</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={activeWorkspaceId || ""}
              onChange={(e) => setActiveWorkspace(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {workspaces?.map((ws: WorkspaceListItem) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.role})
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsNewWsOpen(true)}
              className="rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
            >
              + Workspace
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {isNewWsOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-bold mb-1">Create Workspace</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Workspaces organize your team projects and member permissions.
            </p>

            {errorMessage && (
              <div className="mb-4 rounded bg-destructive/15 p-2.5 text-xs text-destructive font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateWsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Acme Product Team"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Description (Optional)</label>
                <textarea
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="Brief description of this workspace..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewWsOpen(false)
                    setErrorMessage(null)
                  }}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWsMutation.isPending}
                  className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createWsMutation.isPending ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground animate-pulse p-8">Loading workspace...</div>
        ) : currentWorkspace ? (
          <>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{currentWorkspace.name}</h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    Your role: {currentWorkspace.role}
                  </span>
                </div>
                {currentWorkspace.description && (
                  <p className="text-sm text-muted-foreground mt-1">{currentWorkspace.description}</p>
                )}
              </div>

              <div className="flex rounded-lg border bg-muted p-1 text-sm font-medium">
                <button
                  onClick={() => setActiveTab("projects")}
                  className={`px-4 py-1.5 rounded-md transition-colors ${
                    activeTab === "projects"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Projects
                </button>
                <button
                  onClick={() => setActiveTab("members")}
                  className={`px-4 py-1.5 rounded-md transition-colors ${
                    activeTab === "members"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Teammates ({currentWorkspace.member_count})
                </button>
              </div>
            </div>

            {activeTab === "projects" ? (
              <ProjectList
                workspaceId={currentWorkspace.id}
                currentUserRole={currentWorkspace.role}
              />
            ) : (
              <MembersPanel
                workspaceId={currentWorkspace.id}
                currentUserRole={currentWorkspace.role}
              />
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed p-16 text-center max-w-lg mx-auto mt-12">
            <h2 className="text-lg font-bold mb-2">No workspaces found</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Create a workspace to start managing your team's projects and tasks.
            </p>
            <button
              onClick={() => setIsNewWsOpen(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create your first workspace
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
