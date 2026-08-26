import React, { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { AlertCircle, X, Loader2 } from "lucide-react"
import { createTask, getBoard, Task, updateTask } from "@/api/tasks"
import { KanbanColumn } from "./KanbanColumn"
import { TaskCard } from "@/components/TaskCard/TaskCard"

interface KanbanBoardProps {
  projectId: string
  workspaceId?: string
}

const COLUMNS: Array<{ id: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"; title: string }> = [
  { id: "TODO", title: "To Do" },
  { id: "IN_PROGRESS", title: "In Progress" },
  { id: "IN_REVIEW", title: "In Review" },
  { id: "DONE", title: "Done" },
]

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const queryClient = useQueryClient()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [newTaskStatus, setNewTaskStatus] = useState<string>("TODO")
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDesc, setNewTaskDesc] = useState("")
  const [newTaskDue, setNewTaskDue] = useState("")
  const [bannerError, setBannerError] = useState<string | null>(null)

  const { data: boardData, isLoading } = useQuery({
    queryKey: ["board", projectId],
    queryFn: () => getBoard(projectId),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      updateTask(taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["board", projectId] })
      const previousBoard = queryClient.getQueryData(["board", projectId])

      queryClient.setQueryData(["board", projectId], (old: any) => {
        if (!old?.columns) return old
        let foundTask: Task | null = null
        const newCols: Record<string, Task[]> = {}

        for (const colKey of Object.keys(old.columns)) {
          newCols[colKey] = old.columns[colKey].filter((t: Task) => {
            if (t.id === taskId) {
              foundTask = { ...t, status: status as any }
              return false
            }
            return true
          })
        }

        if (foundTask && newCols[status]) {
          newCols[status] = [...newCols[status], foundTask]
        }

        return { columns: newCols }
      })

      return { previousBoard }
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(["board", projectId], context.previousBoard)
      }
      const msg = err.response?.data?.detail || "Could not move task"
      setBannerError(msg)
      setTimeout(() => setBannerError(null), 6000)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: () =>
      createTask(projectId, {
        title: newTaskTitle,
        description: newTaskDesc || undefined,
        status: newTaskStatus,
        due_date: newTaskDue || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] })
      setIsNewTaskOpen(false)
      setNewTaskTitle("")
      setNewTaskDesc("")
      setNewTaskDue("")
      setBannerError(null)
    },
    onError: (err: any) => {
      setBannerError(err.response?.data?.detail || "Failed to create task")
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string
    if (!boardData?.columns) return
    for (const col of Object.values(boardData.columns)) {
      const match = col.find((t) => t.id === taskId)
      if (match) {
        setActiveTask(match)
        break
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    let destinationStatus: string | null = null

    if (COLUMNS.some((col) => col.id === overId)) {
      destinationStatus = overId
    } else {
      if (boardData?.columns) {
        for (const [colKey, tasks] of Object.entries(boardData.columns)) {
          if (tasks.some((t) => t.id === overId)) {
            destinationStatus = colKey
            break
          }
        }
      }
    }

    if (!destinationStatus) return

    let currentStatus: string | null = null
    if (boardData?.columns) {
      for (const [colKey, tasks] of Object.entries(boardData.columns)) {
        if (tasks.some((t) => t.id === taskId)) {
          currentStatus = colKey
          break
        }
      }
    }

    if (currentStatus && currentStatus !== destinationStatus) {
      updateStatusMutation.mutate({ taskId, status: destinationStatus })
    }
  }

  const openCreateDialog = (status: string) => {
    setNewTaskStatus(status)
    setIsNewTaskOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16 text-xs text-zinc-500 animate-pulse">
        Loading board...
      </div>
    )
  }

  const columns = boardData?.columns || {
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    DONE: [],
  }

  return (
    <div className="space-y-4">
      {/* Top Banner Alert (e.g. Blocker constraint error) */}
      {bannerError && (
        <div className="flex items-center justify-between rounded-lg border border-red-900/60 bg-red-950/50 p-3 text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button onClick={() => setBannerError(null)} className="text-red-400 hover:text-red-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Kanban Board Columns Container */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-6">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={columns[col.id] || []}
              onAddTask={openCreateDialog}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-90">
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* New Task Modal */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-100">Create Task</h2>
              <button
                onClick={() => setIsNewTaskOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newTaskTitle.trim()) return
                createTaskMutation.mutate()
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Implement API route caching"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Description (Optional)
                </label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Additional context or requirements..."
                  rows={3}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Status
                  </label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {createTaskMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Task</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
