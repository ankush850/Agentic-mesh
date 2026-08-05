import { create } from "zustand";

interface LiveStore {
  selectedTestId: string | null;
  follow: boolean;
  selectTest: (testId: string | null) => void;
  setFollow: (follow: boolean) => void;
  reset: () => void;
}

/** Ephemeral view state for the live run console (not persisted). */
export const useLiveStore = create<LiveStore>((set) => ({
  selectedTestId: null,
  follow: true,
  selectTest: (selectedTestId) => set({ selectedTestId }),
  setFollow: (follow) => set({ follow }),
  reset: () => set({ selectedTestId: null, follow: true }),
}));
