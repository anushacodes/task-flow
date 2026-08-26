import { create } from "zustand"

interface FilterState {
  status: string[]
  assigneeIds: string[]
  tagIds: string[]
}

interface UIState {
  activeWorkspaceId: string | null
  activeProjectId: string | null
  openTaskId: string | null
  taskDetailOpen: boolean
  filterState: FilterState
  setActiveWorkspace: (id: string | null) => void
  setActiveProject: (id: string | null) => void
  setOpenTask: (id: string | null) => void
  setTaskDetailOpen: (open: boolean) => void
  setFilterState: (filters: Partial<FilterState>) => void
  clearFilters: () => void
}

const initialFilters: FilterState = {
  status: [],
  assigneeIds: [],
  tagIds: [],
}

export const useUIStore = create<UIState>((set) => ({
  activeWorkspaceId: null,
  activeProjectId: null,
  openTaskId: null,
  taskDetailOpen: false,
  filterState: initialFilters,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setActiveProject: (id) => set({ activeProjectId: id }),
  setOpenTask: (id) => set({ openTaskId: id, taskDetailOpen: Boolean(id) }),
  setTaskDetailOpen: (open) => set({ taskDetailOpen: open }),
  setFilterState: (filters) =>
    set((state) => ({
      filterState: { ...state.filterState, ...filters },
    })),
  clearFilters: () => set({ filterState: initialFilters }),
}))
