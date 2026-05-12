import { create } from 'zustand';

/** Transient app-shell UI state (command palette / org switcher visibility). Not persisted. */
interface UiState {
  commandOpen: boolean;
  orgSwitcherOpen: boolean;
  openCommand: () => void;
  closeCommand: () => void;
  toggleCommand: () => void;
  openOrgSwitcher: () => void;
  closeOrgSwitcher: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  orgSwitcherOpen: false,
  openCommand: () => set({ commandOpen: true, orgSwitcherOpen: false }),
  closeCommand: () => set({ commandOpen: false }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen, orgSwitcherOpen: false })),
  openOrgSwitcher: () => set({ orgSwitcherOpen: true, commandOpen: false }),
  closeOrgSwitcher: () => set({ orgSwitcherOpen: false }),
}));
