/**
 * Project export/import format.
 * Single source of truth: paths only in config; settings = preferences only (no path duplication).
 */

import type { Workspace } from './workspace';
import type { AppSettings } from '../stores/settings';
import type { AppConfig } from '../stores/config';
import type { ViewportState } from '../lib/canvas/ViewportController';

export const PROJECT_EXPORT_VERSION = '1.0';

/** Preferences only — paths live in config, not here */
export type ExportSettings = Omit<AppSettings, 'skillsPath' | 'workspaceDirectory'>;

export interface ProjectExport {
  version: string;
  exportedAt: number;
  /** Paths only: skills_path, workspace_directory (canonical source) */
  config: AppConfig | null;
  /** Preferences only: agent toggles, etc. No paths. */
  settings: ExportSettings;
  workspaces: Record<string, Workspace>;
  viewport: Partial<ViewportState> | null;
}
