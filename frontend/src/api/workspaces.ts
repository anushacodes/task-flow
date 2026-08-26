import { apiClient } from "@/api/client"

export interface WorkspaceListItem {
  id: string
  name: string
  description?: string | null
  role: string
  member_count: number
}

export interface WorkspaceDetail {
  id: string
  name: string
  description?: string | null
  owner_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  user_id: string
  name: string
  email: string
  avatar_url?: string | null
  role: "OWNER" | "ADMIN" | "MEMBER"
  joined_at: string
}

export interface ProjectSummary {
  id: string
  workspace_id: string
  name: string
  description?: string | null
  status: "ACTIVE" | "ARCHIVED"
  created_by_id?: string | null
  created_at: string
  updated_at: string
}

export const listWorkspaces = async (): Promise<WorkspaceListItem[]> => {
  const res = await apiClient.get<WorkspaceListItem[]>("/api/v1/workspaces")
  return res.data
}

export const createWorkspace = async (data: {
  name: string
  description?: string
}): Promise<WorkspaceDetail> => {
  const res = await apiClient.post<WorkspaceDetail>("/api/v1/workspaces", data)
  return res.data
}

export const getWorkspace = async (workspaceId: string): Promise<WorkspaceDetail> => {
  const res = await apiClient.get<WorkspaceDetail>(`/api/v1/workspaces/${workspaceId}`)
  return res.data
}

export const updateWorkspace = async (
  workspaceId: string,
  data: { name?: string; description?: string }
): Promise<WorkspaceDetail> => {
  const res = await apiClient.patch<WorkspaceDetail>(`/api/v1/workspaces/${workspaceId}`, data)
  return res.data
}

export const deleteWorkspace = async (workspaceId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/workspaces/${workspaceId}`)
}

export const listWorkspaceMembers = async (workspaceId: string): Promise<WorkspaceMember[]> => {
  const res = await apiClient.get<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`)
  return res.data
}

export const inviteWorkspaceMember = async (
  workspaceId: string,
  data: { email: string; role: "ADMIN" | "MEMBER" }
): Promise<WorkspaceMember> => {
  const res = await apiClient.post<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/invites`, data)
  return res.data
}

export const updateMemberRole = async (
  workspaceId: string,
  userId: string,
  role: "ADMIN" | "MEMBER"
): Promise<WorkspaceMember> => {
  const res = await apiClient.patch<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
    role,
  })
  return res.data
}

export const removeMember = async (workspaceId: string, userId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/workspaces/${workspaceId}/members/${userId}`)
}

export const listProjects = async (
  workspaceId: string,
  statusFilter?: "ACTIVE" | "ARCHIVED"
): Promise<ProjectSummary[]> => {
  const params = statusFilter ? { status: statusFilter } : {}
  const res = await apiClient.get<ProjectSummary[]>(`/api/v1/workspaces/${workspaceId}/projects`, { params })
  return res.data
}

export const createProject = async (
  workspaceId: string,
  data: { name: string; description?: string }
): Promise<ProjectSummary> => {
  const res = await apiClient.post<ProjectSummary>(`/api/v1/workspaces/${workspaceId}/projects`, data)
  return res.data
}

export const updateProject = async (
  workspaceId: string,
  projectId: string,
  data: { name?: string; description?: string; status?: "ACTIVE" | "ARCHIVED" }
): Promise<ProjectSummary> => {
  const res = await apiClient.patch<ProjectSummary>(
    `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
    data
  )
  return res.data
}
