import React, { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckSquare, Plus, Users, FolderKanban, LogOut, ChevronDown, Building2, X } from "lucide-react"
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Sleek Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md px-6 py-3.5 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <CheckSquare className="h-4 w-4" />
            </div>
            <span className="font-semibold text-base tracking-tight text-zinc-100">TaskFlow</span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Workspace Selector */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <select
                value={activeWorkspaceId || ""}
                onChange={(e) => setActiveWorkspace(e.target.value)}
                className="appearance-none rounded-lg border border-zinc-800 bg-zinc-900/90 pl-3 pr-8 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                {workspaces?.map((ws: WorkspaceListItem) => (
                  <option key={ws.id} value={ws.id} className="bg-zinc-900 text-zinc-200">
                    {ws.name} ({ws.role})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-zinc-400" />
            </div>

            <button
              onClick={() => setIsNewWsOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              title="Create new workspace"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Workspace</span>
            </button>
          </div>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-zinc-200 leading-none">{user?.name}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Create Workspace Modal */}
      {isNewWsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Create Workspace</h2>
                  <p className="text-xs text-zinc-400">Organize projects, tasks, and team members</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsNewWsOpen(false)
                  setErrorMessage(null)
                }}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 p-2.5 text-xs text-red-400">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateWsSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Description (Optional)
                </label>
                <textarea
                  value={newWsDesc}
                  onChange={(e) => setNewWsDesc(e.target.value)}
                  placeholder="Brief description of this workspace..."
                  rows={2}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewWsOpen(false)
                    setErrorMessage(null)
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWsMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {createWsMutation.isPending ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center p-16 text-xs text-zinc-500 animate-pulse">
            Loading workspace...
          </div>
        ) : currentWorkspace ? (
          <>
            {/* Workspace Header & Tab Selector */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-zinc-800/80">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold tracking-tight text-zinc-100">{currentWorkspace.name}</h1>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                    {currentWorkspace.role}
                  </span>
                </div>
                {currentWorkspace.description && (
                  <p className="text-xs text-zinc-400 mt-1">{currentWorkspace.description}</p>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 text-xs font-medium">
                <button
                  onClick={() => setActiveTab("projects")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                    activeTab === "projects"
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  <span>Projects</span>
                </button>
                <button
                  onClick={() => setActiveTab("members")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                    activeTab === "members"
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Teammates ({currentWorkspace.member_count})</span>
                </button>
              </div>
            </div>

            {/* Active Tab Panel */}
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-16 text-center max-w-md mx-auto mt-12">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100 mb-1">No workspaces found</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Create a workspace to start managing projects, Kanban boards, and team tasks.
            </p>
            <button
              onClick={() => setIsNewWsOpen(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              Create your first workspace
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
