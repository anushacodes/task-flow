import React from "react"
import { useParams } from "react-router-dom"

export const ProjectBoardPage: React.FC = () => {
  const { wsId, projectId } = useParams<{ wsId: string; projectId: string }>()

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold">Kanban Board</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Workspace: {wsId} | Project: {projectId}
      </p>
      <div className="mt-8 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Kanban columns and drag-and-drop will appear here in Phase 4.
      </div>
    </div>
  )
}
