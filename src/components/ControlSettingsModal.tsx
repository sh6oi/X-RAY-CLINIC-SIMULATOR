import React from 'react';
import {
  Gamepad2,
  Hand,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react';
import {useLanguage} from '../i18n/translations';
import type {
  JoystickConfig,
  JoystickPreset,
  JoystickSize,
} from '../types/radiology';

interface ControlSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  joystickConfig: JoystickConfig;
  onChangeJoystickConfig: (next: JoystickConfig) => void;
  onResetJoystickConfig: () => void;
  onStartFreeDrag: () => void;
  brightness: number;
  onChangeBrightness: (next: number) => void;
  onResetBrightness: () => void;
}

export const ControlSettingsModal: React.FC<ControlSettingsModalProps> = ({
  isOpen,
  onClose,
  joystickConfig,
  onChangeJoystickConfig,
  onResetJoystickConfig,
  onStartFreeDrag,
  brightness,
  onChangeBrightness,
  onResetBrightness,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  if (!isOpen) return null;

  const presets: {id: Exclude<JoystickPreset, 'custom'>; ar: string; en: string}[] =
    [
      {id: 'top-left', ar: 'أعلى اليسار', en: 'Top Left'},
      {id: 'top-right', ar: 'أعلى اليمين', en: 'Top Right'},
      {id: 'bottom-left', ar: 'أسفل اليسار', en: 'Bottom Left'},
      {id: 'bottom-right', ar: 'أسفل اليمين', en: 'Bottom Right'},
    ];

  const sizes: {id: JoystickSize; ar: string; en: string}[] = [
    {id: 'sm', ar: 'صغير', en: 'Small'},
    {id: 'md', ar: 'متوسط', en: 'Medium'},
    {id: 'lg', ar: 'كبير', en: 'Large'},
  ];

  const brightnessPct = Math.round(brightness * 100);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-cyan-600/60 bg-[#0A1320] text-slate-100 shadow-2xl p-4 sm:p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-cyan-300 shrink-0" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-display font-bold text-white">
                {isAr ? 'إعدادات التحكم والسطوع' : 'Controls & Brightness'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? 'خصّص موقع وحجم زر تحريك التقني ومستوى سطوع الإضاءة'
                  : 'Customize joystick placement, size, and scene brightness'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Brightness Slider (Pure Exposure Only) */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1929] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white">
                {isAr ? 'التحكم بالسطوع' : 'Brightness Control'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 font-mono-num text-[11px] font-bold">
                {brightnessPct}%
              </span>
            </div>

            <button
              type="button"
              onClick={onResetBrightness}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>{isAr ? 'الافتراضي' : 'Reset'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5" dir="ltr">
            <button
              type="button"
              onClick={() =>
                onChangeBrightness(
                  Math.max(0.5, Number((brightness - 0.1).toFixed(2)))
                )
              }
              aria-label={isAr ? 'خفض السطوع' : 'Decrease Brightness'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={brightnessPct}
              onChange={(e) => onChangeBrightness(Number(e.target.value) / 100)}
              className="radiology-slider flex-1"
            />

            <button
              type="button"
              onClick={() =>
                onChangeBrightness(
                  Math.min(2.0, Number((brightness + 0.1).toFixed(2)))
                )
              }
              aria-label={isAr ? 'رفع السطوع' : 'Increase Brightness'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            {isAr
              ? 'يعدّل السطوع فقط دون تغيير جودة الصورة أو الهياكل داخل الغرفة.'
              : 'Adjusts display brightness only without affecting image quality or structures.'}
          </p>
        </div>

        {/* Section 2: Joystick Placement */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1929] p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Hand className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white">
                {isAr
                  ? 'موقع زر تحريك التقني'
                  : 'Technician Movement Joystick Position'}
              </span>
            </div>

            <button
              type="button"
              onClick={onResetJoystickConfig}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>{isAr ? 'الافتراضي' : 'Reset'}</span>
            </button>
          </div>

          {/* 4 Quick Corner Presets */}
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => {
              const active = joystickConfig.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    onChangeJoystickConfig({
                      ...joystickConfig,
                      preset: p.id,
                    })
                  }
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    active
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-[#08111D] border-slate-700/80 hover:border-cyan-500/60 text-slate-200'
                  }`}
                >
                  <span>{isAr ? p.ar : p.en}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Free Drag Button */}
          <button
            type="button"
            onClick={onStartFreeDrag}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg"
          >
            <Maximize className="w-4 h-4 shrink-0" />
            <span>
              {isAr
                ? 'سحب وتحريك الزر بحرية في أي مكان على الشاشة'
                : 'Drag & Place Button Freely Anywhere on Screen'}
            </span>
          </button>

          {/* Fine Tune Coordinates if custom is active */}
          {joystickConfig.preset === 'custom' && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-2.5 space-y-2 text-[11px]">
              <div className="flex items-center justify-between text-amber-200 font-semibold">
                <span>
                  {isAr ? 'تعديل دقيق للموقع المخصص' : 'Custom Position Fine-Tune'}
                </span>
                <span className="font-mono-num">
                  X: {Math.round(joystickConfig.customX * 100)}% · Y:{' '}
                  {Math.round(joystickConfig.customY * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" dir="ltr">
                <label className="flex items-center gap-2 text-slate-300">
                  <span className="w-8 font-mono-num">X%</span>
                  <input
                    type="range"
                    min={8}
                    max={92}
                    value={Math.round(joystickConfig.customX * 100)}
                    onChange={(e) =>
                      onChangeJoystickConfig({
                        ...joystickConfig,
                        preset: 'custom',
                        customX: Number(e.target.value) / 100,
                      })
                    }
                    className="radiology-slider flex-1"
                  />
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <span className="w-8 font-mono-num">Y%</span>
                  <input
                    type="range"
                    min={16}
                    max={88}
                    value={Math.round(joystickConfig.customY * 100)}
                    onChange={(e) =>
                      onChangeJoystickConfig({
                        ...joystickConfig,
                        preset: 'custom',
                        customY: Number(e.target.value) / 100,
                      })
                    }
                    className="radiology-slider flex-1"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Joystick Size */}
          <div className="pt-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300">
              {isAr ? 'حجم زر التحريك:' : 'Button Size:'}
            </span>
            <div className="flex items-center gap-1.5">
              {sizes.map((s) => {
                const active = joystickConfig.size === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      onChangeJoystickConfig({
                        ...joystickConfig,
                        size: s.id,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      active
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isAr ? s.ar : s.en}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Close */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer transition-colors"
        >
          {isAr ? 'تم وحفظ الإعدادات' : 'Done & Save Settings'}
        </button>
      </div>
    </div>
  );
};
