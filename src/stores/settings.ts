import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type { CliType } from '../types/workspace';

export interface AppSettings {
  skillsPath: string;
  workspaceDirectory: string;
  // Add more settings as needed
  [key: string]: string | number | boolean;
}

interface SettingsState {
  settings: AppSettings;
  cliAvailability: Record<CliType, boolean>;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  setCliAvailability: (availability: Record<string, boolean>) => void;
}

const defaultSettings: AppSettings = {
  skillsPath: '~/.claude/skills',
  workspaceDirectory: '',
  // Agent availability settings (default to enabled if available)
  agentEnabled_claude: true,
  agentEnabled_cursor: true,
  agentEnabled_kilo: true,
  agentEnabled_gemini: true,
  agentEnabled_grok: true,
  agentEnabled_deepseek: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      cliAvailability: {} as Record<CliType, boolean>,
      setSetting: (key, value) => {
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        }));
      },
      setSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings } as AppSettings,
        }));
      },
      resetSettings: () => {
        set({ settings: defaultSettings });
      },
      setCliAvailability: (availability) => {
        set({ cliAvailability: availability as Record<CliType, boolean> });
      },
    }),
    {
      name: 'gigafactory-settings', // localStorage key
      partialize: (state) => ({ settings: state.settings }), // Only persist settings, not cliAvailability
    }
  )
);

// Constants for CLI management
const ALL_CLIS: CliType[] = ['claude', 'cursor', 'kilo', 'gemini', 'grok', 'deepseek'] as const;

/**
 * Custom hook that provides reactive access to enabled CLIs.
 * This follows single source of truth principle:
 * - Source: settings in store
 * - Derived: computed reactively with useMemo
 * - Efficient: only recomputes when relevant settings change
 */
export function useEnabledClis(): CliType[] {
  // Subscribe directly to settings for reactivity
  const settings = useSettingsStore((state) => state.settings);
  
  // Memoize the computation - only recalculates when settings change
  return useMemo(() => {
    return ALL_CLIS.filter((cli) => {
      const key = `agentEnabled_${cli}`;
      return (settings[key] as boolean) ?? true; // Default to enabled if not set
    });
  }, [settings]);
}

/**
 * Check if a specific CLI is enabled.
 * Useful for conditional rendering or validation.
 */
export function useIsCliEnabled(cli: CliType): boolean {
  const enabledClis = useEnabledClis();
  return enabledClis.includes(cli);
}

/**
 * Custom hook that provides CLIs that are both:
 * 1. Available (detected from API/system)
 * 2. Enabled (manually enabled in settings)
 * 
 * This is the authoritative list for CLI selection in UI components.
 */
export function useAvailableAndEnabledClis(): CliType[] {
  const settings = useSettingsStore((state) => state.settings);
  const cliAvailability = useSettingsStore((state) => state.cliAvailability);
  
  return useMemo(() => {
    return ALL_CLIS.filter((cli) => {
      // Must be available (detected)
      const isAvailable = cliAvailability[cli] ?? false;
      if (!isAvailable) return false;
      
      // Must be enabled (user preference)
      const key = `agentEnabled_${cli}`;
      const isEnabled = (settings[key] as boolean) ?? true; // Default to enabled if not set
      
      return isEnabled;
    });
  }, [settings, cliAvailability]);
}
