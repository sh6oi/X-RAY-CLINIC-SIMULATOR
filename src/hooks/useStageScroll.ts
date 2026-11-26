import {useCallback, useEffect, useRef, useState} from 'react';
import {isRotatedLandscapeStage, toStagePoint} from '../utils/stageViewport';

export interface StageScrollMetrics {
  canScrollUp: boolean;
  canScrollDown: boolean;
  hasOverflow: boolean;
  progress: number;
  thumbRatio: number;
}

const INITIAL_METRICS: StageScrollMetrics = {
  canScrollUp: false,
  canScrollDown: false,
  hasOverflow: false,
  progress: 0,
  thumbRatio: 1,
};

export function useStageScroll<T extends HTMLElement = HTMLDivElement>(
  active = true
) {
  const scrollRef = useRef<T | null>(null);
  const [metrics, setMetrics] = useState<StageScrollMetrics>(INITIAL_METRICS);

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    hasDragged: boolean;
  } | null>(null);

  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);
  const momentumRafRef = useRef<number | null>(null);
  const holdDelayTimerRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const holdDidRepeatRef = useRef(false);

  const updateMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setMetrics(INITIAL_METRICS);
      return;
    }
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const hasOverflow = maxScroll > 4;
    const canScrollUp = el.scrollTop > 3;
    const canScrollDown = el.scrollTop < maxScroll - 3;
    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, el.scrollTop / maxScroll)) : 0;
    const thumbRatio =
      el.scrollHeight > 0
        ? Math.min(1, Math.max(0.14, el.clientHeight / el.scrollHeight))
        : 1;

    setMetrics((prev) => {
      if (
        prev.canScrollUp === canScrollUp &&
        prev.canScrollDown === canScrollDown &&
        prev.hasOverflow === hasOverflow &&
        Math.abs(prev.progress - progress) < 0.01 &&
        Math.abs(prev.thumbRatio - thumbRatio) < 0.01
      ) {
        return prev;
      }
      return {canScrollUp, canScrollDown, hasOverflow, progress, thumbRatio};
    });
  }, []);

  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  }, []);

  const stopHoldScroll = useCallback(() => {
    if (holdDelayTimerRef.current !== null) {
      window.clearTimeout(holdDelayTimerRef.current);
      holdDelayTimerRef.current = null;
    }
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const el = scrollRef.current;
    if (!el) return;

    const rafId = requestAnimationFrame(updateMetrics);
    const onScroll = () => updateMetrics();
    el.addEventListener('scroll', onScroll, {passive: true});

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateMetrics());
      resizeObserver.observe(el);
    }

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
      resizeObserver?.disconnect();
    };
  }, [active, updateMetrics]);

  useEffect(() => {
    return () => {
      stopMomentum();
      stopHoldScroll();
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current);
      }
    };
  }, [stopHoldScroll, stopMomentum]);

  useEffect(() => {
    const onWindowPointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      const el = scrollRef.current;
      if (!state || !state.active || !el || e.pointerId !== state.pointerId) {
        return;
      }

      const pt = toStagePoint(e.clientX, e.clientY);
      const totalDist = Math.hypot(pt.x - state.startX, pt.y - state.startY);

      if (!state.hasDragged) {
        if (totalDist < 7) return;
        state.hasDragged = true;
        suppressClickRef.current = true;
        if (suppressTimerRef.current !== null) {
          window.clearTimeout(suppressTimerRef.current);
          suppressTimerRef.current = null;
        }
      }

      const now = performance.now();
      const dy = pt.y - state.lastY;
      const dt = Math.max(4, now - state.lastTime);

      el.scrollTop -= dy;
      const instantVelocity = dy / dt;
      state.velocityY = state.velocityY * 0.45 + instantVelocity * 0.55;
      state.lastY = pt.y;
      state.lastTime = now;
      updateMetrics();
    };

    const finishDrag = (e: PointerEvent) => {
      const state = dragStateRef.current;
      const el = scrollRef.current;
      if (!state || e.pointerId !== state.pointerId) return;

      const hadDragged = state.hasDragged;
      const velocity = state.velocityY;
      dragStateRef.current = null;

      if (hadDragged) {
        if (suppressTimerRef.current !== null) {
          window.clearTimeout(suppressTimerRef.current);
        }
        suppressTimerRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
          suppressTimerRef.current = null;
        }, 90);

        if (el && Math.abs(velocity) > 0.12) {
          let v = Math.max(-2.6, Math.min(2.6, velocity));
          let prevTime = performance.now();

          const stepMomentum = (now: number) => {
            const target = scrollRef.current;
            if (!target) {
              momentumRafRef.current = null;
              return;
            }
            const dt = Math.min(34, Math.max(4, now - prevTime));
            prevTime = now;

            const prevTop = target.scrollTop;
            target.scrollTop -= v * dt;
            v *= Math.pow(0.92, dt / 16.67);
            updateMetrics();

            const moved = Math.abs(target.scrollTop - prevTop) > 0.2;
            if (Math.abs(v) > 0.04 && moved) {
              momentumRafRef.current = requestAnimationFrame(stepMomentum);
            } else {
              momentumRafRef.current = null;
            }
          };

          momentumRafRef.current = requestAnimationFrame(stepMomentum);
        }
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove, {passive: true});
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [updateMetrics]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<T>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, option, [data-no-stage-scroll]')
      ) {
        return;
      }

      // Only intercept drag on touch/pen or when rotated stage is active
      if (!isRotatedLandscapeStage() && e.pointerType === 'mouse') {
        return;
      }

      stopMomentum();
      const pt = toStagePoint(e.clientX, e.clientY);
      dragStateRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: pt.x,
        startY: pt.y,
        lastY: pt.y,
        lastTime: performance.now(),
        velocityY: 0,
        hasDragged: false,
      };
    },
    [stopMomentum]
  );

  const onClickCapture = useCallback((e: React.MouseEvent<T>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const scrollByAmount = useCallback(
    (deltaY: number) => {
      const el = scrollRef.current;
      if (!el) return;
      stopMomentum();
      el.scrollBy({top: deltaY, behavior: 'smooth'});
    },
    [stopMomentum]
  );

  const scrollToTop = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stopMomentum();
    el.scrollTo({top: 0, behavior: 'smooth'});
  }, [stopMomentum]);

  const startHoldScroll = useCallback(
    (direction: -1 | 1) => {
      stopHoldScroll();
      stopMomentum();
      holdDidRepeatRef.current = false;

      holdDelayTimerRef.current = window.setTimeout(() => {
        holdDidRepeatRef.current = true;
        let lastTime = performance.now();
        const step = (now: number) => {
          const el = scrollRef.current;
          if (!el) {
            holdRafRef.current = null;
            return;
          }
          const dt = Math.min(34, Math.max(4, now - lastTime));
          lastTime = now;
          el.scrollTop += direction * 0.48 * dt;
          updateMetrics();
          holdRafRef.current = requestAnimationFrame(step);
        };
        holdRafRef.current = requestAnimationFrame(step);
      }, 190);
    },
    [stopHoldScroll, stopMomentum, updateMetrics]
  );

  const handleHoldButtonClick = useCallback(
    (direction: -1 | 1, stepPx = 175) => {
      if (holdDidRepeatRef.current) {
        holdDidRepeatRef.current = false;
        return;
      }
      scrollByAmount(direction * stepPx);
    },
    [scrollByAmount]
  );

  return {
    scrollRef,
    metrics,
    updateMetrics,
    scrollByAmount,
    scrollToTop,
    startHoldScroll,
    stopHoldScroll,
    handleHoldButtonClick,
    scrollHandlers: {
      onPointerDown,
      onClickCapture,
    },
  };
}
