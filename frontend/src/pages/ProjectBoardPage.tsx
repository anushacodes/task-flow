import React from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, CheckSquare, FolderKanban } from "lucide-react"
import { KanbanBoard } from "@/features/board/KanbanBoard"
import { TaskDetailModal } from "@/components/TaskDetail/TaskDetailModal"

export const ProjectBoardPage: React.FC = () => {
  const { wsId, projectId } = useParams<{ wsId: string; projectId: string }>()

  if (!wsId || !projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500 text-xs">
        Invalid project route parameters.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md px-6 py-3.5 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            to="/workspaces"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Workspaces</span>
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <CheckSquare className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-sm text-zinc-100">Project Board</span>
          </div>
        </div>
      </header>

      {/* Main Board Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-indigo-400" />
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Kanban Board</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Drag and drop tasks across columns to update workflow status
            </p>
          </div>
        </div>

        {/* Kanban Board Component */}
        <KanbanBoard projectId={projectId} workspaceId={wsId} />

        {/* Task Detail Drawer / Modal */}
        <TaskDetailModal workspaceId={wsId} projectId={projectId} />
      </main>
    </div>
  )
}
