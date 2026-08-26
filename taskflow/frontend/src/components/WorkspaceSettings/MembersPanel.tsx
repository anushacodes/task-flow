import React, { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  inviteWorkspaceMember,
  listWorkspaceMembers,
  removeMember,
  updateMemberRole,
  WorkspaceMember,
} from "@/api/workspaces"

interface MembersPanelProps {
  workspaceId: string
  currentUserRole: string
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  workspaceId,
  currentUserRole,
}) => {
  const queryClient = useQueryClient()
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canManageMembers = currentUserRole === "OWNER" || currentUserRole === "ADMIN"

  const { data: members, isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listWorkspaceMembers(workspaceId),
  })

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteWorkspaceMember(workspaceId, {
        email: inviteEmail,
        role: inviteRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })
      setIsInviteOpen(false)
      setInviteEmail("")
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || "Failed to send invitation")
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "ADMIN" | "MEMBER" }) =>
      updateMemberRole(workspaceId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to update member role")
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(workspaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to remove member")
    },
  })

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    inviteMutation.mutate()
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Loading members...</div>
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Workspace Teammates</h2>
          <p className="text-sm text-muted-foreground">Manage members and workspace permissions</p>
        </div>
        {canManageMembers && (
          <button
            onClick={() => setIsInviteOpen(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Invite Member
          </button>
        )}
      </div>

      {isInviteOpen && (
        <div className="mb-6 rounded-lg border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold mb-3">Invite new teammate</h3>
          {errorMessage && (
            <div className="mb-3 rounded bg-destructive/15 p-2 text-xs text-destructive font-medium">
              {errorMessage}
            </div>
          )}
          <form onSubmit={handleInviteSubmit} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Email address</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsInviteOpen(false)
                setErrorMessage(null)
              }}
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="divide-y">
        {members?.map((member: WorkspaceMember) => (
          <div key={member.user_id} className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium leading-none">{member.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canManageMembers && member.role !== "OWNER" ? (
                <select
                  value={member.role}
                  onChange={(e) =>
                    updateRoleMutation.mutate({
                      userId: member.user_id,
                      role: e.target.value as "ADMIN" | "MEMBER",
                    })
                  }
                  disabled={updateRoleMutation.isPending}
                  className="text-xs rounded border border-input bg-background px-2 py-1"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    member.role === "OWNER"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : member.role === "ADMIN"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {member.role}
                </span>
              )}

              {canManageMembers && member.role !== "OWNER" && (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${member.name} from workspace?`)) {
                      removeMutation.mutate(member.user_id)
                    }
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
