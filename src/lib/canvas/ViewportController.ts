/**
 * Viewport Controller - Zoom and Pan for Canvas
 * Uses Pixi.js viewport pattern for efficient large graph navigation
 */

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
  minScale: number;
  maxScale: number;
}

export class ViewportController {
  private state: ViewportState;
  private onStateChange?: (state: ViewportState) => void;

  constructor(initialState?: Partial<ViewportState>) {
    this.state = {
      x: initialState?.x ?? 0,
      y: initialState?.y ?? 0,
      scale: initialState?.scale ?? 1,
      minScale: initialState?.minScale ?? 0.05, // 5% minimum zoom
      maxScale: initialState?.maxScale ?? 2.0,  // 200% maximum zoom
    };
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback: (state: ViewportState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Get current state
   */
  getState(): ViewportState {
    return { ...this.state };
  }

  /**
   * Pan viewport
   */
  pan(dx: number, dy: number): void {
    this.state.x += dx;
    this.state.y += dy;
    this.notifyChange();
  }

  /**
   * Set pan position
   */
  setPosition(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
    this.notifyChange();
  }

  /**
   * Zoom at point
   */
  zoomAt(scale: number, centerX: number, centerY: number): void {
    const newScale = Math.max(
      this.state.minScale,
      Math.min(this.state.maxScale, scale)
    );

    // Zoom towards center point
    const scaleDelta = newScale / this.state.scale;
    this.state.x = centerX - (centerX - this.state.x) * scaleDelta;
    this.state.y = centerY - (centerY - this.state.y) * scaleDelta;
    this.state.scale = newScale;

    this.notifyChange();
  }

  /**
   * Zoom in/out
   */
  zoom(delta: number, centerX?: number, centerY?: number): void {
    const zoomFactor = 1.1;
    const newScale = delta > 0
      ? this.state.scale * zoomFactor
      : this.state.scale / zoomFactor;

    if (centerX !== undefined && centerY !== undefined) {
      this.zoomAt(newScale, centerX, centerY);
    } else {
      this.zoomAt(newScale, 0, 0);
    }
  }

  /**
   * Set zoom level
   */
  setScale(scale: number): void {
    this.state.scale = Math.max(
      this.state.minScale,
      Math.min(this.state.maxScale, scale)
    );
    this.notifyChange();
  }

  /**
   * Reset viewport
   */
  reset(): void {
    this.state.x = 0;
    this.state.y = 0;
    this.state.scale = 1;
    this.notifyChange();
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.state.x) / this.state.scale,
      y: (screenY - this.state.y) / this.state.scale,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.state.scale + this.state.x,
      y: worldY * this.state.scale + this.state.y,
    };
  }

  private notifyChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }
}
