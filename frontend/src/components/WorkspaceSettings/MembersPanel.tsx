import React, { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Users, UserPlus, Trash2, X, Loader2 } from "lucide-react"
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
    return (
      <div className="flex items-center justify-center p-12 text-xs text-zinc-500 animate-pulse">
        Loading members...
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-sm">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            <h2 className="text-base font-semibold text-zinc-100">Workspace Teammates</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Manage team access, permissions, and invitations</p>
        </div>
        {canManageMembers && (
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-sm"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Invite Member Drawer/Card */}
      {isInviteOpen && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Invite new teammate</h3>
            <button
              onClick={() => {
                setIsInviteOpen(false)
                setErrorMessage(null)
              }}
              className="text-zinc-500 hover:text-zinc-300 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {errorMessage && (
            <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/40 p-2.5 text-xs text-red-400">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleInviteSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="w-full sm:w-36">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="submit"
                disabled={inviteMutation.isPending}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Invite</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsInviteOpen(false)
                  setErrorMessage(null)
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Member List */}
      <div className="divide-y divide-zinc-800/70">
        {members?.map((member: WorkspaceMember) => (
          <div key={member.user_id} className="py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-semibold text-xs">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-100">{member.name}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{member.email}</p>
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
                  className="text-xs rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    member.role === "OWNER"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : member.role === "ADMIN"
                      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                      : "border-zinc-800 bg-zinc-800/80 text-zinc-400"
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
                  className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
