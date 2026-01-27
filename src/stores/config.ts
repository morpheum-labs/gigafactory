import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { api } from '../utils/api';

export interface AppConfig {
  skills_path: string;
  workspace_directory?: string | null;
}

interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  
  loadConfig: () => Promise<void>;
  saveConfig: (config: AppConfig) => Promise<void>;
  checkConfigured: () => Promise<boolean>;
}

export const useConfigStore = create<ConfigState>()(
  immer((set, get) => ({
    config: null,
    loading: false,
    error: null,
    isConfigured: false,

    loadConfig: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const config = await api.getConfig();
        set((state) => {
          state.config = config;
          state.loading = false;
          state.isConfigured = true;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to load config';
          state.loading = false;
        });
      }
    },

    saveConfig: async (config: AppConfig) => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        const savedConfig = await api.setConfig(config);
        set((state) => {
          state.config = savedConfig;
          state.loading = false;
          state.isConfigured = true;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to save config';
          state.loading = false;
        });
        throw error;
      }
    },

    checkConfigured: async () => {
      try {
        await get().loadConfig();
        return get().isConfigured;
      } catch {
        return false;
      }
    },
  }))
);
