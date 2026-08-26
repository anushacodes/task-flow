import React from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus } from "lucide-react"
import { Task } from "@/api/tasks"
import { TaskCard } from "@/components/TaskCard/TaskCard"

interface KanbanColumnProps {
  id: string
  title: string
  tasks: Task[]
  onAddTask: (status: string) => void
}

const statusColorMap: Record<string, { indicator: string; badge: string }> = {
  TODO: {
    indicator: "bg-zinc-400",
    badge: "border-zinc-700 bg-zinc-800 text-zinc-300",
  },
  IN_PROGRESS: {
    indicator: "bg-indigo-500",
    badge: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
  },
  IN_REVIEW: {
    indicator: "bg-amber-500",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  DONE: {
    indicator: "bg-emerald-500",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  tasks,
  onAddTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id })
  const taskIds = tasks.map((t) => t.id)
  const colors = statusColorMap[id] || statusColorMap.TODO

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[280px] max-w-[340px] rounded-xl border p-3 transition-colors ${
        isOver
          ? "border-indigo-500/60 bg-indigo-950/10"
          : "border-zinc-800/80 bg-zinc-900/30"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${colors.indicator}`} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">{title}</h3>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${colors.badge}`}
          >
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => onAddTask(id)}
          className="p-1 rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          title={`Add task to ${title}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Task Cards List */}
      <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[350px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-zinc-800/60 text-center text-xs text-zinc-600">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}
