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
import type {BodyRegion, BodySide, Modality} from '../types/radiology';
import {
  formatRegionWithSide,
  useLanguage,
} from '../i18n/translations';
import {isPediatricPatientAge} from '../data/radiologyData';
import {useStageScroll} from '../hooks/useStageScroll';

interface ExposureConsolePanelProps {
  modality?: Modality;
  kvp: number;
  mas: number;
  onChangeKvp: (val: number) => void;
  onChangeMas: (val: number) => void;
  selectedRegion: BodyRegion;
  selectedSide?: BodySide;
  patientAge?: number;
  doorClosed: boolean;
  cassetteReady: boolean;
  cassetteStepLabel: string;
  crPendingScan: boolean;
  hasDR: boolean;
  isChestExam: boolean;
  breathHeld: boolean;
  onRequestBreathHold: () => void;
  hasProtocolAssist: boolean;
  hasDosimeter: boolean;
  kvpRange: [number, number];
  masRange: [number, number];
  onAutoCalibrate: () => void;
  onExpose: () => void;
  isExposing: boolean;
  isDeveloping: boolean;
  caseApproved: boolean;
  onClose: () => void;
}

const roundHalf = (val: number): number => Math.round(val * 2) / 2;

export const ExposureConsolePanel: React.FC<ExposureConsolePanelProps> = ({
  modality = 'XRAY',
  kvp,
  mas,
  onChangeKvp,
  onChangeMas,
  selectedRegion,
  selectedSide = 'NONE',
  patientAge,
  doorClosed,
  cassetteReady,
  cassetteStepLabel,
  crPendingScan,
  hasDR,
  isChestExam,
  breathHeld,
  onRequestBreathHold,
  hasProtocolAssist,
  hasDosimeter,
  kvpRange,
  masRange,
  onAutoCalibrate,
  onExpose,
  isExposing,
  isDeveloping,
  caseApproved,
  onClose,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';
  const {scrollRef, scrollHandlers} = useStageScroll<HTMLElement>(true);
  const isChild = isPediatricPatientAge(patientAge);

  const locked = isExposing || isDeveloping || caseApproved || crPendingScan;
  const readyToFire = doorClosed && cassetteReady && !locked;

  const doseOptimal =
    kvp >= kvpRange[0] &&
    kvp <= kvpRange[1] &&
    mas >= masRange[0] &&
    mas <= masRange[1];

  return (
    <aside
      ref={scrollRef}
      {...scrollHandlers}
      className="hud-console-panel stage-scroll-area pointer-events-auto fixed top-[118px] left-2.5 right-2.5 sm:top-auto sm:bottom-24 sm:left-5 sm:right-auto z-20 sm:w-[390px] max-h-[calc(var(--stage-h,100vh)*0.44)] sm:max-h-[calc(var(--stage-h,100vh)*0.78)] overflow-y-auto rounded-2xl border-2 border-slate-700/90 bg-gradient-to-b from-[#131C2A] via-[#0C131F] to-[#080D16] shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] p-3 sm:p-4 space-y-2.5 sm:space-y-3"
    >
      {/* Brushed Hardware Console Top Bezel */}
      <div className="hud-console-header flex items-center justify-between gap-2 pb-2 border-b border-slate-700/80">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#09121F] border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white truncate">
              <span className="truncate">
                {modality === 'MRI'
                  ? isAr
                    ? 'وحدة الموجات الراديوية (MRI RF)'
                    : 'MRI Radiofrequency Console'
                  : isAr
                    ? 'وحدة التحكم بالمولّد (Console)'
                    : 'X-Ray Generator Console'}
              </span>
              {isChild && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[9px] font-bold shrink-0">
                  {isAr ? 'أطفال' : 'Peds'}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono-num text-slate-400 truncate">
              {modality === 'MRI'
                ? '1.5T · 63.9 MHz RF'
                : modality === 'CT'
                  ? '64-SLICE CT'
                  : hasDR
                    ? 'DR DIGITAL'
                    : 'CR CASSETTE'}{' '}
              · {formatRegionWithSide(selectedRegion, selectedSide, lang, true)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
          aria-label={isAr ? 'إخفاء لوحة التحكم' : 'Hide console'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Physical LED Interlock Status Strip */}
      <div className="hud-console-interlock grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px]">
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
            {doorClosed
              ? isAr
                ? 'الباب مغلق'
                : 'Door Shut'
              : isAr
                ? 'الباب مفتوح'
                : 'Door Open'}
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
          {isExposing
            ? modality === 'MRI'
              ? 'RF PULSE'
              : 'X-RAY ON'
            : crPendingScan
              ? 'CR WAIT'
              : readyToFire
                ? 'READY'
                : 'STANDBY'}
        </div>
      </div>

      {/* Dual Digital Recessed LCD Displays: RF (for MRI) OR kVp & mAs (for X-Ray/CT) */}
      {modality === 'MRI' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="hud-console-lcd rounded-xl border border-emerald-900/70 bg-[#050B14] shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{isAr ? 'الموجات الراديوية' : 'RF Frequency'}</span>
              <span className="font-mono-num text-emerald-400">Larmor RF</span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="hud-console-val font-mono-num text-xl sm:text-2xl font-bold text-emerald-300">
                63.9
              </span>
              <span className="font-mono-num text-[11px] font-semibold text-emerald-500">
                MHz RF
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              {isAr ? 'رنين مغناطيسي بدون أشعة' : 'Non-ionizing RF Waves'}
            </div>
          </div>
          <div className="hud-console-lcd rounded-xl border border-cyan-900/70 bg-[#050B14] shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{isAr ? 'المجال المغناطيسي' : 'Magnetic Field'}</span>
              <span className="font-mono-num text-cyan-400">T1 / T2</span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="hud-console-val font-mono-num text-xl sm:text-2xl font-bold text-cyan-300">
                1.5
              </span>
              <span className="font-mono-num text-[11px] font-semibold text-cyan-500">
                Tesla
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              {isAr ? 'لا يستخدم kVp أو mAs' : 'No kVp / mAs used'}
            </div>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-2">
        {/* kVp Hardware Module */}
        <div className="hud-console-lcd rounded-xl border border-cyan-900/70 bg-[#050B14] shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{isAr ? 'الجهد (kVp)' : 'Tube kVp'}</span>
            <span className="font-mono-num text-cyan-500/80">45–130</span>
          </div>

          <div className="flex items-baseline justify-between gap-1">
            <span className="hud-console-val font-mono-num text-xl sm:text-3xl font-bold tracking-tight text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
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
            aria-label={isAr ? 'طاقة الاختراق kVp' : 'Tube potential kVp'}
            className="w-full radiology-slider"
          />

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              disabled={locked || kvp <= 45}
              onClick={() => onChangeKvp(Math.max(45, kvp - 5))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              -5
            </button>
            <button
              type="button"
              disabled={locked || kvp <= 45}
              onClick={() => onChangeKvp(Math.max(45, kvp - 1))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="-1 kVp"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={locked || kvp >= 130}
              onClick={() => onChangeKvp(Math.min(130, kvp + 1))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="+1 kVp"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={locked || kvp >= 130}
              onClick={() => onChangeKvp(Math.min(130, kvp + 5))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              +5
            </button>
          </div>
        </div>

        {/* mAs Hardware Module (0.5–100 with 0.5 increments) */}
        <div className="hud-console-lcd rounded-xl border border-emerald-900/60 bg-[#050B14] shadow-[inset_0_2px_10px_rgba(0,0,0,0.85)] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{isAr ? 'الكمية (mAs)' : 'Exposure mAs'}</span>
            <span className="font-mono-num text-emerald-500/80">0.5–100</span>
          </div>

          <div className="flex items-baseline justify-between gap-1">
            <span className="hud-console-val font-mono-num text-xl sm:text-3xl font-bold tracking-tight text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
              {mas}
            </span>
            <span className="font-mono-num text-[11px] font-semibold text-emerald-500">
              mAs
            </span>
          </div>

          <input
            type="range"
            min={0.5}
            max={100}
            step={0.5}
            value={mas}
            disabled={locked}
            onChange={(e) => onChangeMas(Math.max(0.5, roundHalf(Number(e.target.value))))}
            aria-label={isAr ? 'كمية الإشعاع mAs' : 'Exposure mAs'}
            className="w-full radiology-slider"
          />

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              disabled={locked || mas <= 0.5}
              onClick={() => onChangeMas(Math.max(0.5, roundHalf(mas - 5)))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              -5
            </button>
            <button
              type="button"
              disabled={locked || mas <= 0.5}
              onClick={() => onChangeMas(Math.max(0.5, roundHalf(mas - 0.5)))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[9.5px] font-mono-num font-bold text-slate-200 cursor-pointer"
              aria-label="-0.5 mAs"
            >
              -½
            </button>
            <button
              type="button"
              disabled={locked || mas >= 100}
              onClick={() => onChangeMas(Math.min(100, roundHalf(mas + 0.5)))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[9.5px] font-mono-num font-bold text-slate-200 cursor-pointer"
              aria-label="+0.5 mAs"
            >
              +½
            </button>
            <button
              type="button"
              disabled={locked || mas >= 100}
              onClick={() => onChangeMas(Math.min(100, roundHalf(mas + 5)))}
              className="hud-console-step py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-mono-num font-bold text-slate-200 cursor-pointer"
            >
              +5
            </button>
          </div>
        </div>
      </div>
      )}

      {hasDosimeter && modality !== 'MRI' && (
        <div
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold flex items-center justify-between gap-2 ${
            doseOptimal
              ? 'border-emerald-600/60 bg-emerald-950/35 text-emerald-300'
              : 'border-amber-600/60 bg-amber-950/35 text-amber-300'
          }`}
        >
          <span>{isAr ? 'مقياس الجرعة:' : 'Dosimeter:'}</span>
          <span className="truncate">
            {doseOptimal
              ? isAr
                ? 'مثالي للبروتوكول ✓'
                : 'Optimal ✓'
              : `${kvpRange[0]}–${kvpRange[1]} kVp / ${masRange[0]}–${masRange[1]} mAs`}
          </span>
        </div>
      )}

      {/* Intercom Speaker (Chest exams only) + Protocol Assist */}
      {(isChestExam || hasProtocolAssist) && (
        <div className="flex items-center gap-2">
          {isChestExam && (
            <button
              type="button"
              onClick={onRequestBreathHold}
              disabled={breathHeld || caseApproved || crPendingScan}
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
              <span>
                {breathHeld
                  ? isAr
                    ? 'تم حبس النفس ✓'
                    : 'Breath Held ✓'
                  : isAr
                    ? 'ميكروفون: حبس النفس'
                    : 'Intercom: Hold Breath'}
              </span>
            </button>
          )}

          {hasProtocolAssist && (
            <button
              type="button"
              onClick={onAutoCalibrate}
              disabled={locked}
              className={`py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                isChestExam ? '' : 'w-full'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? 'ضبط ذكي' : 'Auto Calibrate'}</span>
            </button>
          )}
        </div>
      )}

      {/* Physical Radiation Exposure Trigger Button */}
      <button
        type="button"
        onClick={onExpose}
        disabled={locked}
        className={`hud-console-expose w-full py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border-2 cursor-pointer disabled:cursor-not-allowed transition-colors ${
          isExposing
            ? 'bg-amber-400 border-amber-200 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.65)]'
            : readyToFire
              ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 border-amber-200/80 text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.35)]'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/80'
        }`}
      >
        <Radiation className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
        <span>
          {isExposing
            ? modality === 'MRI'
              ? isAr
                ? 'جاري إرسال الموجات الراديوية (RF)...'
                : 'Transmitting RF Pulse...'
              : isAr
                ? 'جاري إطلاق الأشعة السينية...'
                : 'Firing X-Ray Exposure...'
            : isDeveloping
              ? isAr
                ? 'جاري معالجة الصورة...'
                : 'Processing Scan...'
              : crPendingScan
                ? isAr
                  ? 'أحضر الكاسيت وضعْه في قارئ CR'
                  : 'Retrieve Cassette & Insert in CR Reader'
                : modality === 'MRI'
                  ? isAr
                    ? 'بدء المسح بالموجات الراديوية (START RF)'
                    : 'START MRI RF SCAN'
                  : isAr
                    ? 'إطلاق الجرعة الإشعاعية (EXPOSE)'
                    : 'TRIGGER EXPOSURE (EXPOSE)'}
        </span>
      </button>
    </aside>
  );
};
