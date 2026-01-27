import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewportState } from '../lib/canvas/ViewportController';

interface ViewportStore {
  viewportState: Partial<ViewportState> | null;
  setViewportState: (state: Partial<ViewportState>) => void;
  clearViewportState: () => void;
}

export const useViewportStore = create<ViewportStore>()(
  persist(
    (set) => ({
      viewportState: null,
      setViewportState: (state) => {
        set({ viewportState: state });
      },
      clearViewportState: () => {
        set({ viewportState: null });
      },
    }),
    {
      name: 'gigafactory-viewport', // localStorage key
    }
  )
);
