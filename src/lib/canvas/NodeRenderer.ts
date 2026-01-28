/**
 * Node Renderer
 * Renders workspace nodes on the canvas
 */

import { Graphics } from 'pixi.js';
import type { Workspace } from '../../types/workspace';
import type { Agent } from '../../types/agent';
import { WORKSPACE_COLORS } from '../../utils/colors';
import type { ViewportController } from './ViewportController';
import { calculateVisibleBounds, isWorkspaceVisible } from './CanvasUtils';

export interface NodeRendererOptions {
  selectedGlowWidth?: number;
  selectedGlowAlpha?: number;
  selectedBorderWidth?: number;
  selectedBorderAlpha?: number;
  selectedFillAlpha?: number;
  agentCircleRadius?: number;
  agentCircleFillAlpha?: number;
  agentCircleStrokeWidth?: number;
  agentCircleStrokeAlpha?: number;
}

const DEFAULT_OPTIONS: Required<NodeRendererOptions> = {
  selectedGlowWidth: 8,
  selectedGlowAlpha: 0.15,
  selectedBorderWidth: 4,
  selectedBorderAlpha: 0.3,
  selectedFillAlpha: 0.08,
  agentCircleRadius: 28,
  agentCircleFillAlpha: 0.8,
  agentCircleStrokeWidth: 2,
  agentCircleStrokeAlpha: 0.6,
};

/**
 * Render workspace nodes
 */
export function renderNodes(
  graphics: Graphics,
  workspaces: Record<string, Workspace>,
  agents: Record<string, Agent>,
  selectedWorkspaceId: string | null,
  viewport?: ViewportController | null,
  containerRect?: DOMRect | null,
  options: NodeRendererOptions = {}
): void {
  graphics.clear();

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const {
    selectedGlowWidth,
    selectedGlowAlpha,
    selectedBorderWidth,
    selectedBorderAlpha,
    selectedFillAlpha,
    agentCircleRadius,
    agentCircleFillAlpha,
    agentCircleStrokeWidth,
    agentCircleStrokeAlpha,
  } = opts;

  // Calculate visible bounds for viewport culling
  let visibleBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  if (viewport && containerRect) {
    visibleBounds = calculateVisibleBounds(viewport, containerRect);
  }

  Object.values(workspaces).forEach((workspace) => {
    // Viewport culling: only render if workspace is visible
    // This significantly improves performance when zoomed out
    if (visibleBounds && !isWorkspaceVisible(workspace, visibleBounds)) {
      return; // Skip rendering this workspace
    }
    const colors = WORKSPACE_COLORS[workspace.state];
    const isSelected = selectedWorkspaceId === workspace.id;

    // Don't render workspace rectangles (handled by HTML divs)
    // Only render visual effects:

    // Draw selection effects
    if (isSelected) {
      // Outer glow
      graphics.setStrokeStyle({
        width: selectedGlowWidth,
        color: 0xffd700,
        alpha: selectedGlowAlpha,
      });
      graphics.rect(
        workspace.x - 6,
        workspace.y - 6,
        workspace.width + 12,
        workspace.height + 12
      );
      graphics.stroke();

      // Inner border highlight
      graphics.setStrokeStyle({
        width: selectedBorderWidth,
        color: 0xffd700,
        alpha: selectedBorderAlpha,
      });
      graphics.rect(
        workspace.x - 3,
        workspace.y - 3,
        workspace.width + 6,
        workspace.height + 6
      );
      graphics.stroke();

      // Selection fill overlay
      graphics.setFillStyle({ color: 0xffd700, alpha: selectedFillAlpha });
      graphics.rect(workspace.x, workspace.y, workspace.width, workspace.height);
      graphics.fill();
    }

    // Draw agent indicator if workspace has an agent
    const agent = workspace.agentId ? agents[workspace.agentId] : null;
    if (agent) {
      const cx = workspace.x + workspace.width / 2;
      const cy = workspace.y + workspace.height / 2;

      graphics.setFillStyle({ color: 0x1a1a2e, alpha: agentCircleFillAlpha });
      graphics.circle(cx, cy, agentCircleRadius);
      graphics.fill();

      graphics.setStrokeStyle({
        width: agentCircleStrokeWidth,
        color: colors.border,
        alpha: agentCircleStrokeAlpha,
      });
      graphics.circle(cx, cy, agentCircleRadius);
      graphics.stroke();
    }
  });
}
