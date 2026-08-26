import React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Calendar, Lock, Terminal, AlertCircle } from "lucide-react"
import { Task } from "@/api/tasks"
import { useUIStore } from "@/stores/uiStore"

interface TaskCardProps {
  task: Task
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const { setOpenTask } = useUIStore()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setOpenTask(task.id)}
      className={`group cursor-grab active:cursor-grabbing rounded-xl border p-3.5 shadow-sm transition-all select-none ${
        task.is_blocked
          ? "border-red-900/60 bg-red-950/20 hover:border-red-700/80"
          : "border-zinc-800/80 bg-zinc-900/70 hover:border-indigo-500/50 hover:bg-zinc-900/95"
      }`}
    >
      {/* Top meta row: Blocked badge & Overdue alert */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.is_blocked && (
            <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
              <Lock className="h-3 w-3" />
              <span>Blocked</span>
            </span>
          )}

          {task.is_overdue && (
            <span className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              <AlertCircle className="h-3 w-3" />
              <span>Overdue</span>
            </span>
          )}

          {task.tags?.map((tag) => (
            <span
              key={tag.id}
              className="rounded-md border border-zinc-700/80 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
              style={tag.color ? { borderColor: `${tag.color}40`, color: tag.color } : {}}
            >
              #{tag.name}
            </span>
          ))}
        </div>

        {task.commands && task.commands.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500" title="Attached commands">
            <Terminal className="h-3 w-3" />
            <span>{task.commands.length}</span>
          </span>
        )}
      </div>

      {/* Task Title */}
      <h4 className="text-xs font-semibold text-zinc-100 leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
        {task.title}
      </h4>

      {/* Description Preview */}
      {task.description && (
        <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Footer: Due Date & Assignee */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
        <div className="flex items-center gap-1.5">
          {task.due_date ? (
            <span
              className={`flex items-center gap-1 ${
                task.is_overdue ? "text-amber-400 font-medium" : "text-zinc-400"
              }`}
            >
              <Calendar className="h-3 w-3" />
              <span>{task.due_date}</span>
            </span>
          ) : (
            <span className="text-zinc-600">No due date</span>
          )}
        </div>

        {task.assignee ? (
          <div
            className="flex items-center gap-1 rounded-full bg-zinc-800 pl-1.5 pr-2 py-0.5 border border-zinc-700/60"
            title={`Assigned to ${task.assignee.name}`}
          >
            <div className="h-4 w-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-[9px]">
              {task.assignee.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-[10px] text-zinc-300 font-medium max-w-[80px] truncate">
              {task.assignee.name.split(" ")[0]}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-zinc-600 italic">Unassigned</span>
        )}
      </div>
    </div>
  )
}
