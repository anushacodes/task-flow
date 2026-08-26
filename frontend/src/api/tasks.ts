import { apiClient } from "./client"

export interface Tag {
  id: string
  workspace_id: string
  name: string
  color: string | null
  created_at: string
}

export interface UserSummary {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

export interface TaskBlockerSummary {
  id: string
  title: string
  status: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"
  due_date: string | null
  is_overdue: boolean
  is_blocked: boolean
  assignee: UserSummary | null
  tags: Tag[]
  blockers: TaskBlockerSummary[]
  blocking: TaskBlockerSummary[]
  commands: Array<{ label: string; url?: string; cmd?: string }> | null
  series_id: string | null
  series_instance_num: number | null
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export interface BoardData {
  columns: {
    TODO: Task[]
    IN_PROGRESS: Task[]
    IN_REVIEW: Task[]
    DONE: Task[]
  }
}

export interface TaskCreatePayload {
  title: string
  description?: string
  status?: string
  due_date?: string | null
  assignee_id?: string | null
  commands?: Array<{ label: string; url?: string; cmd?: string }>
  tag_ids?: string[]
}

export interface TaskUpdatePayload {
  title?: string
  description?: string | null
  status?: string
  due_date?: string | null
  assignee_id?: string | null
  commands?: Array<{ label: string; url?: string; cmd?: string }>
  tag_ids?: string[]
}

export interface TaskFilterParams {
  status?: string[]
  assignee_id?: string[]
  tag_id?: string[]
}

export const listTasks = async (
  projectId: string,
  filters?: TaskFilterParams,
  view?: string
): Promise<Task[] | BoardData> => {
  const params = new URLSearchParams()
  if (view) params.append("view", view)
  if (filters?.status) {
    filters.status.forEach((s) => params.append("status", s))
  }
  if (filters?.assignee_id) {
    filters.assignee_id.forEach((a) => params.append("assignee_id", a))
  }
  if (filters?.tag_id) {
    filters.tag_id.forEach((t) => params.append("tag_id", t))
  }

  const res = await apiClient.get(`/api/v1/projects/${projectId}/tasks`, { params })
  return res.data
}

export const getBoard = async (
  projectId: string,
  filters?: TaskFilterParams
): Promise<BoardData> => {
  const data = await listTasks(projectId, filters, "board")
  return data as BoardData
}

export const getTask = async (taskId: string): Promise<Task> => {
  const res = await apiClient.get<Task>(`/api/v1/tasks/${taskId}`)
  return res.data
}

export const createTask = async (
  projectId: string,
  payload: TaskCreatePayload
): Promise<Task> => {
  const res = await apiClient.post<Task>(`/api/v1/projects/${projectId}/tasks`, payload)
  return res.data
}

export const updateTask = async (
  taskId: string,
  payload: TaskUpdatePayload
): Promise<Task> => {
  const res = await apiClient.patch<Task>(`/api/v1/tasks/${taskId}`, payload)
  return res.data
}

export const deleteTask = async (taskId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/tasks/${taskId}`)
}

export const addBlocker = async (
  taskId: string,
  blockerId: string
): Promise<Task> => {
  const res = await apiClient.post<Task>(`/api/v1/tasks/${taskId}/blockers`, {
    blocker_id: blockerId,
  })
  return res.data
}

export const removeBlocker = async (
  taskId: string,
  blockerId: string
): Promise<Task> => {
  const res = await apiClient.delete<Task>(`/api/v1/tasks/${taskId}/blockers/${blockerId}`)
  return res.data
}

export const listTags = async (workspaceId: string, q?: string): Promise<Tag[]> => {
  const res = await apiClient.get<Tag[]>(`/api/v1/workspaces/${workspaceId}/tags`, {
    params: q ? { q } : undefined,
  })
  return res.data
}

export const createTag = async (
  workspaceId: string,
  payload: { name: string; color?: string }
): Promise<Tag> => {
  const res = await apiClient.post<Tag>(`/api/v1/workspaces/${workspaceId}/tags`, payload)
  return res.data
}

export const deleteTag = async (workspaceId: string, tagId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/workspaces/${workspaceId}/tags/${tagId}`)
}
