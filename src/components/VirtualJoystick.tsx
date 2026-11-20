import React, {useRef, useState} from 'react';
import {Move} from 'lucide-react';
import {useLanguage} from '../i18n/translations';

interface VirtualJoystickProps {
  joystickRef: React.MutableRefObject<{x: number; y: number}>;
  label?: string;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  joystickRef,
  label,
}) => {
  const {lang} = useLanguage();
  const displayLabel = label ?? (lang === 'ar' ? 'تحريك التقني' : 'Move Tech');
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const originRef = useRef<{x: number; y: number}>({x: 0, y: 0});
  const [knobOffset, setKnobOffset] = useState<{x: number; y: number}>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  const maxRadius = 42;

  const updateFromClient = (clientX: number, clientY: number) => {
    let dx = clientX - originRef.current.x;
    let dy = clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
      // Gently pull origin along if thumb slides past edge so direction reversals stay instant
      originRef.current = {
        x: clientX - dx,
        y: clientY - dy,
      };
    }

    setKnobOffset({x: dx, y: dy});

    const rawMag = Math.min(1, dist / maxRadius);
    if (rawMag < 0.06) {
      joystickRef.current = {x: 0, y: 0};
      return;
    }

    // Progressive curve: silky slow precision near center, full stride near outer edge
    const curvedMag = Math.pow((rawMag - 0.06) / 0.94, 1.15);
    const nx = dx / (dist || 1);
    const ny = -dy / (dist || 1);

    joystickRef.current = {
      x: Number((nx * curvedMag).toFixed(3)),
      y: Number((ny * curvedMag).toFixed(3)),
    };
  };

  const resetStick = () => {
    activePointerIdRef.current = null;
    setIsDragging(false);
    setKnobOffset({x: 0, y: 0});
    joystickRef.current = {x: 0, y: 0};
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore unsupported capture
    }

    // Anchor relative to thumb down point (clamped cleanly inside ring) so initial tap never jolts
    const el = baseRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const offsetX = e.clientX - cx;
      const offsetY = e.clientY - cy;
      const clampOff = Math.hypot(offsetX, offsetY);
      if (clampOff > 18) {
        originRef.current = {
          x: cx + (offsetX / clampOff) * 18,
          y: cy + (offsetY / clampOff) * 18,
        };
      } else {
        originRef.current = {x: e.clientX, y: e.clientY};
      }
    } else {
      originRef.current = {x: e.clientX, y: e.clientY};
    }

    setIsDragging(true);
    setKnobOffset({x: 0, y: 0});
    joystickRef.current = {x: 0, y: 0};
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    resetStick();
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Extra invisible outer touch margin makes single-thumb mobile use effortless */}
      <div
        ref={baseRef}
        role="slider"
        aria-label={displayLabel}
        aria-valuetext={`${joystickRef.current.x}, ${joystickRef.current.y}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 touch-none flex items-center justify-center shadow-[0_12px_32px_rgba(0,0,0,0.68)] transition-colors cursor-grab active:cursor-grabbing ${
          isDragging
            ? 'border-cyan-400 bg-[#0A1E36]/95'
            : 'border-cyan-600/80 bg-[#08101C]/92 hover:border-cyan-400'
        }`}
      >
        <div className="pointer-events-none absolute -inset-3 rounded-full" />
        <div className="pointer-events-none absolute inset-2.5 rounded-full border border-dashed border-cyan-500/35" />
        <div className="pointer-events-none absolute inset-7 rounded-full border border-cyan-500/20" />

        <span className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-cyan-400/80">
          ▲
        </span>
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-cyan-400/80">
          ▼
        </span>
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-cyan-400/80">
          ◀
        </span>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-cyan-400/80">
          ▶
        </span>

        {/* Draggable Thumb Stick */}
        <div
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
          className={`pointer-events-none w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.55)] ${
            isDragging
              ? 'bg-cyan-300 border-white text-slate-950 scale-105'
              : 'bg-cyan-500/95 border-cyan-200 text-slate-950'
          }`}
        >
          <Move className="w-4 h-4 shrink-0" />
        </div>
      </div>

      <span className="pointer-events-none px-2 py-0.5 rounded-md bg-[#08101C]/92 border border-slate-800 text-[10px] sm:text-[11px] font-semibold text-cyan-200 whitespace-nowrap">
        {displayLabel}
      </span>
    </div>
  );
};
