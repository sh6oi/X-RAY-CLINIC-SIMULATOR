export interface StagePoint {
  x: number;
  y: number;
}

export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function isRotatedLandscapeStage(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('force-landscape-stage');
}

export function getStageDimensions(): {width: number; height: number} {
  if (typeof window === 'undefined') {
    return {width: 1280, height: 720};
  }
  if (isRotatedLandscapeStage()) {
    return {
      width: window.innerHeight || 720,
      height: window.innerWidth || 400,
    };
  }
  return {
    width: window.innerWidth || 1280,
    height: window.innerHeight || 720,
  };
}

/**
 * Converts browser viewport (clientX, clientY) coordinates into the visual
 * stage coordinate system. When `html.force-landscape-stage` rotates the app
 * 90deg clockwise around top-left shifted by 100vw, (localX, localY) maps from
 * screen coordinates as localX = clientY, localY = viewportWidth - clientX.
 */
export function toStagePoint(clientX: number, clientY: number): StagePoint {
  if (!isRotatedLandscapeStage()) {
    return {x: clientX, y: clientY};
  }
  const vw =
    typeof window !== 'undefined'
      ? document.documentElement.clientWidth || window.innerWidth
      : 0;
  return {
    x: clientY,
    y: vw - clientX,
  };
}

/**
 * Returns an element's bounding rect in the visual stage coordinate system.
 */
export function getElementStageRect(el: HTMLElement): StageRect {
  const rect = el.getBoundingClientRect();
  if (!isRotatedLandscapeStage()) {
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }
  const vw =
    typeof window !== 'undefined'
      ? document.documentElement.clientWidth || window.innerWidth
      : 0;
  return {
    left: rect.top,
    top: vw - rect.right,
    width: rect.height,
    height: rect.width,
  };
}
