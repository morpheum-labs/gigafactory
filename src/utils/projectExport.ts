/**
 * Project export: build payload and download as JSON.
 * Design: paths only in config; settings = preferences (no duplication).
 */

import { PROJECT_EXPORT_VERSION, type ProjectExport, type ExportSettings } from '../types/project';
import type { AppConfig } from '../stores/config';
import type { AppSettings } from '../stores/settings';
import type { Workspace } from '../types/workspace';
import type { ViewportState } from '../lib/canvas/ViewportController';

export interface ProjectExportInput {
  config: AppConfig | null;
  settings: AppSettings;
  workspaces: Record<string, Workspace>;
  viewport: Partial<ViewportState> | null;
}

const PATH_KEYS: (keyof AppSettings)[] = ['skillsPath', 'workspaceDirectory'];

/** Strip path fields from settings; paths live only in config. */
function toExportSettings(settings: AppSettings): ExportSettings {
  const out = { ...settings };
  PATH_KEYS.forEach((k) => delete out[k]);
  return out as ExportSettings;
}

/**
 * Build the project export payload. Paths come from config only; settings are preferences only.
 */
export function buildProjectExport(input: ProjectExportInput): ProjectExport {
  return {
    version: PROJECT_EXPORT_VERSION,
    exportedAt: Date.now(),
    config: input.config,
    settings: toExportSettings(input.settings),
    workspaces: input.workspaces,
    viewport: input.viewport,
  };
}

/**
 * Serialize project to JSON and trigger browser download.
 * Default filename includes timestamp so exports don't overwrite.
 */
export function downloadProjectExport(
  data: ProjectExport,
  filename?: string
): void {
  const name = filename ?? `gigafactory-project-${new Date(data.exportedAt).toISOString().slice(0, 19).replace('T', '_')}.json`;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
