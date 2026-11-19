import React from 'react';
import {
  DoorClosed,
  DoorOpen,
  Hand,
  Mic,
  Minus,
  Plus,
  Radiation,
  Sliders,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import type {BodyRegion, ProjectionType} from '../types/radiology';
import {PROJECTION_LABELS_AR, REGION_LABELS_AR} from '../data/radiologyData';

interface ExposureConsolePanelProps {
  kvp: number;
  mas: number;
  onChangeKvp: (val: number) => void;
  onChangeMas: (val: number) => void;
  selectedProjection: ProjectionType;
  availableProjections: ProjectionType[];
  onSelectProjection: (proj: ProjectionType) => void;
  selectedRegion: BodyRegion;
  doorClosed: boolean;
  cassetteReady: boolean;
  cassetteStepLabel: string;
  breathHeld: boolean;
  onRequestBreathHold: () => void;
  hasProtocolAssist: boolean;
  onAutoCalibrate: () => void;
  onExpose: () => void;
  isExposing: boolean;
  isDeveloping: boolean;
  caseApproved: boolean;
  onClose: () => void;
}

export const ExposureConsolePanel: React.FC<ExposureConsolePanelProps> = ({
  kvp,
  mas,
  onChangeKvp,
  onChangeMas,
  selectedProjection,
  availableProjections,
  onSelectProjection,
  selectedRegion,
  doorClosed,
  cassetteReady,
  cassetteStepLabel,
  breathHeld,
  onRequestBreathHold,
  hasProtocolAssist,
  onAutoCalibrate,
  onExpose,
  isExposing,
  isDeveloping,
  caseApproved,
  onClose,
}) => {
  const locked = isExposing || isDeveloping || caseApproved;
  const readyToFire = doorClosed && cassetteReady && !locked;

  // Approximate entrance skin dose indicator (visual clinical realism)
  const approxDoseMs = Math.max(4, Math.round(mas * 3.5));
  const tubeHeatPct = Math.min(92, Math.round((kvp / 130) * 32 + (mas / 50) * 28));

  return (
    <aside className="pointer-events-auto fixed top-24 left-2.5 right-2.5 sm:top-auto sm:bottom-24 sm:left-5 sm:right-auto z-20 sm:w-[390px] max-h-[48dvh] sm:max-h-[78dvh] overflow-y-auto rounded-2xl border-2 border-slate-700/90 bg-gradient-to-b from-[#131C2A] via-[#0C131F] to-[#080D16] shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] p-3.5 sm:p-4 space-y-3">
      {/* Brushed Hardware Console Top Bezel */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-700/80">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#09121F] border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-white truncate">
              وحدة التحكم بالمولّد (X-Ray Console)
            </div>
            <div className="text-[10px] font-mono-num text-slate-400">
              HF-GENERATOR · {REGION_LABELS_AR[selectedRegion]}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
          aria-label="إخفاء لوحة التحكم"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Physical LED Interlock Status Strip */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px]">
        <div
          className={`rounded-lg border px-2 py-1.5 flex items-center gap-1.5 ${
            doorClosed
              ? 'border-emerald-600/60 bg-emerald-950/35 text-emerald-300'
              : 'border-amber-600/60 bg-amber-950/35 text-amber-300'
          }`}
        >
          {doorClosed ? (
            <DoorClosed className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <DoorOpen className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate font-semibold">
            {doorClosed ? 'الباب مغلق' : 'الباب مفتوح'}
          </span>
        </div>

        <div
          className={`rounded-lg border px-2 py-1.5 flex items-center gap-1.5 ${
            cassetteReady
              ? 'border-emerald-600/60 bg-emerald-950/35 text-emerald-300'
              : 'border-amber-600/60 bg-amber-950/35 text-amber-300'
          }`}
        >
          <Hand className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate font-semibold">{cassetteStepLabel}</span>
        </div>

        <div
          className={`rounded-lg border px-2 py-1.5 flex items-center justify-center font-mono-num font-bold ${
            isExposing
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : readyToFire
                ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-400'
          }`}
        >
          {isExposing ? 'X-RAY ON' : readyToFire ? 'READY' : 'STANDBY'}
        </div>
      </div>

      {/* Dual Digital Recessed LCD Displays: kVp & mAs */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* kVp Hardware Module */}
        <div className="rounded-xl border border-cyan-900/70 bg-[#050B14] shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>الجهد (kVp)</span>
            <span className="font-mono-num text-cyan-500/80">45–130</span>
          </div>

          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono-num text-2xl sm:text-3xl font-bold tracking-tight text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
              {kvp}
            </span>
            <span className="font-mono-num text-[11px] font-semibold text-cyan-500">
              kVp
            </span>
          </div>

          <input
            type="range"
            min={45}
            max={130}
            value={kvp}
            disabled={locked}
            onChange={(e) => onChangeKvp(Number(e.target.value))}
            aria-label="طاقة الاختراق kVp"
            className="w-full radiology-slider"
          />

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              disabled={locked || kvp <= 45}
              onClick={() => onChangeKvp(Math.max(45, kvp - 5))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              -5
            </button>
            <button
              type="button"
              disabled={locked || kvp <= 45}
              onClick={() => onChangeKvp(Math.max(45, kvp - 1))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="نقصان kVp"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={locked || kvp >= 130}
              onClick={() => onChangeKvp(Math.min(130, kvp + 1))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="زيادة kVp"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={locked || kvp >= 130}
              onClick={() => onChangeKvp(Math.min(130, kvp + 5))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              +5
            </button>
          </div>
        </div>

        {/* mAs Hardware Module */}
        <div className="rounded-xl border border-emerald-900/60 bg-[#050B14] shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>الكمية (mAs)</span>
            <span className="font-mono-num text-emerald-500/80">1–50</span>
          </div>

          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono-num text-2xl sm:text-3xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
              {mas}
            </span>
            <span className="font-mono-num text-[11px] font-semibold text-emerald-500">
              mAs
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={50}
            value={mas}
            disabled={locked}
            onChange={(e) => onChangeMas(Number(e.target.value))}
            aria-label="كمية الإشعاع mAs"
            className="w-full radiology-slider"
          />

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              disabled={locked || mas <= 1}
              onClick={() => onChangeMas(Math.max(1, mas - 5))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              -5
            </button>
            <button
              type="button"
              disabled={locked || mas <= 1}
              onClick={() => onChangeMas(Math.max(1, mas - 1))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="نقصان mAs"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={locked || mas >= 50}
              onClick={() => onChangeMas(Math.min(50, mas + 1))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="زيادة mAs"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={locked || mas >= 50}
              onClick={() => onChangeMas(Math.min(50, mas + 5))}
              className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              +5
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Mini Bar + Projection Tactile Keypad */}
      <div className="rounded-xl border border-slate-800 bg-[#070D17] p-2.5 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">
            الإسقاط:{' '}
            <strong className="text-cyan-300">
              {PROJECTION_LABELS_AR[selectedProjection]}
            </strong>
          </span>
          <span className="font-mono-num text-[10px] text-slate-400">
            {approxDoseMs} ms · HU {tubeHeatPct}%
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {availableProjections.map((proj) => (
            <button
              key={proj}
              type="button"
              onClick={() => onSelectProjection(proj)}
              disabled={locked}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono-num font-bold cursor-pointer border transition-colors ${
                selectedProjection === proj
                  ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                  : 'bg-[#101A28] border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {proj}
            </button>
          ))}
        </div>
      </div>

      {/* Intercom Speaker + Protocol Assist + Two-Stage Radiation Trigger */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRequestBreathHold}
          disabled={breathHeld || caseApproved}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
            breathHeld
              ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
              : 'bg-[#121D2D] hover:bg-[#18263A] border-slate-700 text-slate-100'
          }`}
        >
          {breathHeld ? (
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          )}
          <span>{breathHeld ? 'تم حبس النفس ✓' : 'ميكروفون: حبس النفس'}</span>
        </button>

        {hasProtocolAssist && (
          <button
            type="button"
            onClick={onAutoCalibrate}
            disabled={locked}
            className="py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>ضبط ذكي</span>
          </button>
        )}
      </div>

      {/* Physical Radiation Exposure Trigger Button */}
      <button
        type="button"
        onClick={onExpose}
        disabled={locked}
        className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 border-2 cursor-pointer disabled:cursor-not-allowed transition-colors ${
          isExposing
            ? 'bg-amber-400 border-amber-200 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.65)]'
            : readyToFire
              ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 border-amber-200/80 text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.35)]'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/80'
        }`}
      >
        <Radiation className="w-5 h-5 shrink-0" />
        <span>
          {isExposing
            ? 'جاري إطلاق الأشعة السينية...'
            : isDeveloping
              ? 'جاري معالجة الصورة...'
              : 'إطلاق الجرعة الإشعاعية (EXPOSE)'}
        </span>
      </button>
    </aside>
  );
};
