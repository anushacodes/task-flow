import React, { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  X,
  Calendar,
  User,
  Tag as TagIcon,
  Lock,
  Trash2,
  Terminal,
  AlertCircle,
} from "lucide-react"
import {
  addBlocker,
  deleteTask,
  getTask,
  listTags,
  removeBlocker,
  updateTask,
} from "@/api/tasks"
import { listWorkspaceMembers } from "@/api/workspaces"
import { useUIStore } from "@/stores/uiStore"

interface TaskDetailModalProps {
  workspaceId: string
  projectId: string
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  workspaceId,
  projectId,
}) => {
  const queryClient = useQueryClient()
  const { openTaskId, setOpenTask } = useUIStore()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("TODO")
  const [dueDate, setDueDate] = useState("")
  const [assigneeId, setAssigneeId] = useState<string>("")
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [blockerTaskId, setBlockerTaskId] = useState("")
  const [newCmdLabel, setNewCmdLabel] = useState("")
  const [newCmdVal, setNewCmdVal] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", openTaskId],
    queryFn: () => getTask(openTaskId!),
    enabled: Boolean(openTaskId),
  })

  const { data: members } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listWorkspaceMembers(workspaceId),
    enabled: Boolean(openTaskId),
  })

  const { data: tags } = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => listTags(workspaceId),
    enabled: Boolean(openTaskId),
  })

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || "")
      setStatus(task.status)
      setDueDate(task.due_date || "")
      setAssigneeId(task.assignee?.id || "")
      setSelectedTagIds(task.tags?.map((t) => t.id) || [])
      setErrorMessage(null)
    }
  }, [task])

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateTask(openTaskId!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["task", openTaskId], updated)
      queryClient.invalidateQueries({ queryKey: ["board", projectId] })
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || "Failed to update task")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(openTaskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] })
      setOpenTask(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || "Failed to delete task")
    },
  })

  const addBlockerMutation = useMutation({
    mutationFn: (bId: string) => addBlocker(openTaskId!, bId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["task", openTaskId], updated)
      queryClient.invalidateQueries({ queryKey: ["board", projectId] })
      setBlockerTaskId("")
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || "Failed to add blocker")
    },
  })

  const removeBlockerMutation = useMutation({
    mutationFn: (bId: string) => removeBlocker(openTaskId!, bId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["task", openTaskId], updated)
      queryClient.invalidateQueries({ queryKey: ["board", projectId] })
    },
  })

  if (!openTaskId) return null

  const handleTitleBlur = () => {
    if (task && title.trim() && title !== task.title) {
      updateMutation.mutate({ title })
    }
  }

  const handleDescBlur = () => {
    if (task && description !== (task.description || "")) {
      updateMutation.mutate({ description })
    }
  }

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    updateMutation.mutate({ status: newStatus })
  }

  const handleDueDateChange = (newDate: string) => {
    setDueDate(newDate)
    updateMutation.mutate({ due_date: newDate || null })
  }

  const handleAssigneeChange = (newAssigneeId: string) => {
    setAssigneeId(newAssigneeId)
    updateMutation.mutate({ assignee_id: newAssigneeId || null })
  }

  const handleToggleTag = (tagId: string) => {
    const nextTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId]
    setSelectedTagIds(nextTagIds)
    updateMutation.mutate({ tag_ids: nextTagIds })
  }

  const handleAddCommand = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCmdLabel.trim() || !newCmdVal.trim()) return
    const currentCmds = task?.commands || []
    const updatedCmds = [...currentCmds, { label: newCmdLabel.trim(), cmd: newCmdVal.trim() }]
    updateMutation.mutate({ commands: updatedCmds })
    setNewCmdLabel("")
    setNewCmdVal("")
  }

  const handleRemoveCommand = (idx: number) => {
    const currentCmds = task?.commands || []
    const updatedCmds = currentCmds.filter((_, i) => i !== idx)
    updateMutation.mutate({ commands: updatedCmds })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-xl bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto flex flex-col p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                task?.status === "DONE"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : task?.status === "IN_PROGRESS"
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300"
              }`}
            >
              {task?.status}
            </span>

            {task?.is_blocked && (
              <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                <Lock className="h-3.5 w-3.5" />
                <span>Blocked</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this task?")) {
                  deleteMutation.mutate()
                }
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpenTask(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-xs text-zinc-500 animate-pulse">
            Loading task details...
          </div>
        ) : (
          <div className="space-y-6 flex-1">
            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="w-full text-lg font-bold bg-transparent border-0 border-b border-transparent hover:border-zinc-700 focus:border-indigo-500 px-0 py-1 text-zinc-100 focus:outline-none transition-colors"
                placeholder="Task title..."
              />
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              {/* Status */}
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Assignee</span>
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {members?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Due Date</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Created */}
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Created
                </label>
                <div className="text-xs text-zinc-500 pt-1.5">
                  {task?.created_at ? new Date(task.created_at).toLocaleDateString() : "-"}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Add a detailed description..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors leading-relaxed"
              />
            </div>

            {/* Tags Selection */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <TagIcon className="h-3.5 w-3.5 text-indigo-400" />
                <span>Tags</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags?.map((t) => {
                  const isSelected = selectedTagIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTag(t.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      #{t.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Blockers Section */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-red-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Dependencies & Blockers
                  </h4>
                </div>
              </div>

              {/* Blocked by list */}
              {task?.blockers && task.blockers.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-zinc-400 font-medium">Blocked by:</p>
                  {task.blockers.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            b.status === "DONE" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        <span className="text-zinc-200 truncate max-w-[280px]">{b.title}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">({b.status})</span>
                      </div>
                      <button
                        onClick={() => removeBlockerMutation.mutate(b.id)}
                        className="text-zinc-500 hover:text-red-400 p-0.5"
                        title="Remove blocker"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 italic">No blockers preventing this task.</p>
              )}

              {/* Add Blocker Form */}
              <div className="pt-2 flex gap-2">
                <input
                  type="text"
                  value={blockerTaskId}
                  onChange={(e) => setBlockerTaskId(e.target.value)}
                  placeholder="Paste blocker Task UUID..."
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (blockerTaskId.trim()) {
                      addBlockerMutation.mutate(blockerTaskId.trim())
                    }
                  }}
                  disabled={!blockerTaskId.trim() || addBlockerMutation.isPending}
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  Add Blocker
                </button>
              </div>
            </div>

            {/* Commands Section */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-indigo-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Executable Commands / Links
                </h4>
              </div>

              {task?.commands && task.commands.length > 0 ? (
                <div className="space-y-1.5">
                  {task.commands.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-zinc-200">{cmd.label}</p>
                        <p className="font-mono text-[11px] text-zinc-400 mt-0.5">{cmd.cmd || cmd.url}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveCommand(idx)}
                        className="text-zinc-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 italic">No commands attached.</p>
              )}

              {/* Add Command Form */}
              <form onSubmit={handleAddCommand} className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCmdLabel}
                    onChange={(e) => setNewCmdLabel(e.target.value)}
                    placeholder="Command label (e.g. Run tests)"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newCmdVal}
                    onChange={(e) => setNewCmdVal(e.target.value)}
                    placeholder="Command / URL"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
