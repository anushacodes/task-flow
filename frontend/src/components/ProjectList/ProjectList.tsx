import React, { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
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
    return <div className="text-sm text-muted-foreground p-4">Loading projects...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Projects</h2>
          <div className="flex rounded-md border bg-muted p-0.5 text-xs">
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1 rounded font-medium ${
                statusFilter === "ACTIVE"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("ARCHIVED")}
              className={`px-3 py-1 rounded font-medium ${
                statusFilter === "ARCHIVED"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Archived
            </button>
            <button
              onClick={() => setStatusFilter(undefined)}
              className={`px-3 py-1 rounded font-medium ${
                statusFilter === undefined
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {canCreateProject && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            New Project
          </button>
        )}
      </div>

      {isCreateOpen && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Create Project</h3>
          {errorMessage && (
            <div className="mb-3 rounded bg-destructive/15 p-2 text-xs text-destructive font-medium">
              {errorMessage}
            </div>
          )}
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Project Name</label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Q3 Sprint, Mobile App v2"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description (Optional)</label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Brief project goals or scope..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false)
                  setErrorMessage(null)
                }}
                className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: ProjectSummary) => (
            <div
              key={project.id}
              onClick={() => navigate(`/workspaces/${workspaceId}/projects/${project.id}`)}
              className="cursor-pointer rounded-lg border bg-card p-5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      project.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                    {project.description}
                  </p>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground pt-3 border-t">
                Open Kanban Board →
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-sm">No projects found in this workspace.</p>
          {canCreateProject && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-3 text-xs font-semibold text-primary hover:underline"
            >
              + Create your first project
            </button>
          )}
        </div>
      )}
    </div>
  )
}
