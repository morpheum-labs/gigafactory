/**
 * Node Renderer
 * Renders workspace nodes on the canvas
 */

import { Graphics } from 'pixi.js';
import type { Workspace } from '../../types/workspace';
import type { Agent } from '../../types/agent';
import { WORKSPACE_COLORS } from '../../utils/colors';

export interface NodeRendererOptions {
  selectedGlowWidth?: number;
  selectedGlowAlpha?: number;
  selectedBorderWidth?: number;
  selectedBorderAlpha?: number;
  selectedFillAlpha?: number;
  normalBorderWidth?: number;
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
  normalBorderWidth: 2,
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
    normalBorderWidth,
    agentCircleRadius,
    agentCircleFillAlpha,
    agentCircleStrokeWidth,
    agentCircleStrokeAlpha,
  } = opts;

  Object.values(workspaces).forEach((workspace) => {
    const colors = WORKSPACE_COLORS[workspace.state];
    const isSelected = selectedWorkspaceId === workspace.id;

    // Draw workspace fill
    graphics.setFillStyle({ color: colors.fill, alpha: 0.85 });
    graphics.rect(workspace.x, workspace.y, workspace.width, workspace.height);
    graphics.fill();

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

      // Inner border
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

      // Selection fill
      graphics.setFillStyle({ color: 0xffd700, alpha: selectedFillAlpha });
      graphics.rect(workspace.x, workspace.y, workspace.width, workspace.height);
      graphics.fill();
    }

    // Draw border
    graphics.setStrokeStyle({
      width: isSelected ? selectedBorderWidth : normalBorderWidth,
      color: isSelected ? 0xffd700 : colors.border,
      alpha: 1,
    });
    graphics.rect(workspace.x, workspace.y, workspace.width, workspace.height);
    graphics.stroke();

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
