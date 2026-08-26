import React, { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { FolderKanban, Plus, ArrowRight, X, Loader2 } from "lucide-react"
import { createProject, listProjects, ProjectSummary } from "@/api/workspaces"

interface ProjectListProps {
  workspaceId: string
  currentUserRole: string
}

export const ProjectList: React.FC<ProjectListProps> = ({
  workspaceId,
  currentUserRole,
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ARCHIVED" | undefined>("ACTIVE")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canCreateProject = currentUserRole === "OWNER" || currentUserRole === "ADMIN"

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", workspaceId, statusFilter],
    queryFn: () => listProjects(workspaceId, statusFilter),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createProject(workspaceId, {
        name: projectName,
        description: projectDescription || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] })
      setIsCreateOpen(false)
      setProjectName("")
      setProjectDescription("")
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || "Failed to create project")
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return
    createMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-xs text-zinc-500 animate-pulse">
        Loading projects...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Bar: Header, Filter Pills, and New Project Button */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-semibold text-zinc-100">Projects</h2>
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/90 p-0.5 text-xs font-medium">
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1 rounded-md transition-all ${
                statusFilter === "ACTIVE"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("ARCHIVED")}
              className={`px-3 py-1 rounded-md transition-all ${
                statusFilter === "ARCHIVED"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Archived
            </button>
            <button
              onClick={() => setStatusFilter(undefined)}
              className={`px-3 py-1 rounded-md transition-all ${
                statusFilter === undefined
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {canCreateProject && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* Inline Create Project Form */}
      {isCreateOpen && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100">Create Project</h3>
            <button
              onClick={() => {
                setIsCreateOpen(false)
                setErrorMessage(null)
              }}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {errorMessage && (
            <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/40 p-2.5 text-xs text-red-400">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                Project Name
              </label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Core App Redesign"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                Description (Optional)
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Brief project goals or scope..."
                rows={2}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false)
                  setErrorMessage(null)
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Project</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project Cards Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: ProjectSummary) => (
            <div
              key={project.id}
              onClick={() => navigate(`/workspaces/${workspaceId}/projects/${project.id}`)}
              className="group cursor-pointer rounded-xl border border-zinc-800/90 bg-zinc-900/60 p-5 hover:border-indigo-500/50 hover:bg-zinc-900/90 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
                      <FolderKanban className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
                      {project.name}
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                      project.status === "ACTIVE"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                {project.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 mt-2 leading-relaxed">
                    {project.description}
                  </p>
                )}
              </div>

              <div className="text-[11px] text-zinc-500 group-hover:text-indigo-400 pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between transition-colors">
                <span>Kanban Board</span>
                <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center text-zinc-500">
          <p className="text-xs">No projects found matching the filter.</p>
          {canCreateProject && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-3 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline inline-flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create your first project</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
