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

let lastPortraitVw = 0;
let lastPortraitVh = 0;
let lastForcedLandscape = false;

function detectMobileOrTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|HarmonyOS|Silk/i.test(ua)) {
    return true;
  }
  if (window.matchMedia?.('(pointer: coarse)')?.matches) {
    return true;
  }
  if ((navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window) {
    return true;
  }
  return false;
}

function readViewportSize(): {vw: number; vh: number} {
  if (typeof window === 'undefined') {
    return {vw: 1280, vh: 720};
  }
  const docEl = document.documentElement;
  const vw = Math.max(
    1,
    Math.round(docEl?.clientWidth || window.innerWidth || 1280)
  );
  const vh = Math.max(
    1,
    Math.round(window.innerHeight || docEl?.clientHeight || 720)
  );
  return {vw, vh};
}

function isTextInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (active as HTMLElement).isContentEditable
  );
}

/**
 * Synchronizes `html.force-landscape-stage` and explicit CSS pixel variables
 * (`--viewport-w`, `--viewport-h`, `--stage-w`, `--stage-h`) so forced
 * landscape rotation works identically on ALL Android devices and older WebViews
 * (including browsers that do not support `dvh` or mix RTL `100vw` offsets).
 */
export function syncStageViewport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const root = document.documentElement;
  const {vw, vh} = readViewportSize();
  const isMobileLike = detectMobileOrTouchDevice();
  const typingInInput = isTextInputFocused();

  // If the user opened the on-screen Android keyboard while already rotated in portrait,
  // window.innerHeight shrinks vertically; keep forced landscape stable and preserve full width.
  const keyboardShrankPortrait =
    lastForcedLandscape &&
    typingInInput &&
    lastPortraitVw > 0 &&
    lastPortraitVh > 0 &&
    Math.abs(vw - lastPortraitVw) <= 12 &&
    vh <= lastPortraitVh;

  const isPortraitMobile =
    keyboardShrankPortrait ||
    (vh > vw && ((isMobileLike && vw <= 1024) || vw <= 680));

  if (isPortraitMobile) {
    if (!keyboardShrankPortrait || vh > lastPortraitVh) {
      lastPortraitVw = vw;
      lastPortraitVh = vh;
    }
    const effectiveStageW = keyboardShrankPortrait ? lastPortraitVh : vh;
    lastForcedLandscape = true;

    root.classList.add('force-landscape-stage');
    root.style.setProperty('--viewport-w', `${vw}px`);
    root.style.setProperty('--viewport-h', `${effectiveStageW}px`);
    root.style.setProperty('--stage-w', `${effectiveStageW}px`);
    root.style.setProperty('--stage-h', `${vw}px`);
    return true;
  }

  lastForcedLandscape = false;
  root.classList.remove('force-landscape-stage');
  root.style.setProperty('--viewport-w', `${vw}px`);
  root.style.setProperty('--viewport-h', `${vh}px`);
  root.style.setProperty('--stage-w', `${vw}px`);
  root.style.setProperty('--stage-h', `${vh}px`);
  return false;
}

// Run immediately at module evaluation so first paint already has exact pixel dimensions
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  syncStageViewport();
}

export function isRotatedLandscapeStage(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('force-landscape-stage');
}

export function getStageDimensions(): {width: number; height: number} {
  if (typeof window === 'undefined') {
    return {width: 1280, height: 720};
  }
  const {vw, vh} = readViewportSize();
  if (isRotatedLandscapeStage()) {
    return {
      width:
        lastForcedLandscape && isTextInputFocused() && lastPortraitVh > 0
          ? lastPortraitVh
          : vh,
      height: vw,
    };
  }
  return {
    width: vw,
    height: vh,
  };
}

/**
 * Converts browser viewport (clientX, clientY) coordinates into the visual
 * stage coordinate system. When `html.force-landscape-stage` rotates the app
 * 90deg clockwise around top-left shifted by viewportWidth, (localX, localY)
 * maps from screen coordinates as localX = clientY, localY = viewportWidth - clientX.
 */
export function toStagePoint(clientX: number, clientY: number): StagePoint {
  if (!isRotatedLandscapeStage()) {
    return {x: clientX, y: clientY};
  }
  const {vw} = readViewportSize();
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
  const {vw} = readViewportSize();
  return {
    left: rect.top,
    top: vw - rect.right,
    width: rect.height,
    height: rect.width,
  };
}
