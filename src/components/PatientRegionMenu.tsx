import React, {useEffect, useState} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  X,
} from 'lucide-react';
import type {BodyRegion, BodySide} from '../types/radiology';
import {
  REGION_GROUPS,
  REGION_LABELS_I18N,
  REGION_SHORT_I18N,
  SIDE_LABELS_I18N,
  formatRegionWithSide,
  isBilateralRegion,
  useLanguage,
} from '../i18n/translations';
import {useStageScroll} from '../hooks/useStageScroll';

interface PatientRegionMenuProps {
  isOpen: boolean;
  selectedRegion: BodyRegion;
  selectedSide: BodySide;
  onSelectRegionAndSide: (region: BodyRegion, side: BodySide) => void;
  onClose: () => void;
}

export const PatientRegionMenu: React.FC<PatientRegionMenuProps> = ({
  isOpen,
  selectedRegion,
  selectedSide,
  onSelectRegionAndSide,
  onClose,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  const [activeGroup, setActiveGroup] = useState<
    'ALL' | 'head_neck' | 'spine_torso' | 'upper_limb' | 'lower_limb'
  >('ALL');

  const {
    scrollRef,
    metrics,
    startHoldScroll,
    stopHoldScroll,
    handleHoldButtonClick,
    scrollHandlers,
  } = useStageScroll<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentIsBilateral = isBilateralRegion(selectedRegion);
  const effectiveSide: BodySide = currentIsBilateral
    ? selectedSide !== 'NONE'
      ? selectedSide
      : 'RIGHT'
    : 'NONE';

  const visibleGroups =
    activeGroup === 'ALL'
      ? REGION_GROUPS
      : REGION_GROUPS.filter((g) => g.id === activeGroup);

  const thumbTopPct = metrics.progress * (100 - metrics.thumbRatio * 100);

  return (
    <div
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-40 bg-slate-950/65 flex items-center justify-center p-1.5 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'تحديد المنطقة والجهة' : 'Select Region & Side'}
        className="hud-posture-window hud-region-window w-full max-w-[720px] max-h-[calc(100dvh-0.75rem)] sm:max-h-[min(90dvh,670px)] flex flex-col rounded-2xl border border-slate-700/85 bg-[#08101C]/98 shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-800 bg-[#0B1525] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400 shrink-0" />
              <h2 className="font-display text-xs sm:text-base font-extrabold text-white truncate">
                {isAr
                  ? 'مناطق الفحص وتحديد الجهة (يمين / يسار)'
                  : 'Anatomical Regions & Side Selection (R / L)'}
              </h2>
            </div>
            <p className="text-[10.5px] sm:text-xs text-slate-300 mt-0.5 leading-snug truncate">
              {isAr ? 'المحدد حالياً: ' : 'Active Target: '}
              <span className="font-bold text-cyan-300">
                {formatRegionWithSide(selectedRegion, effectiveSide, lang)}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sticky Bilateral Left / Right Toggle + Group Filter Strip */}
        <div className="shrink-0 px-2.5 sm:px-3.5 py-1.5 bg-[#091321] border-b border-slate-800/80 space-y-1.5">
          {currentIsBilateral && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-2.5 py-1">
              <span className="text-[10.5px] sm:text-xs font-semibold text-cyan-200 truncate">
                {isAr
                  ? `جهة ${REGION_SHORT_I18N.ar[selectedRegion]}:`
                  : `${REGION_SHORT_I18N.en[selectedRegion]} Side:`}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onSelectRegionAndSide(selectedRegion, 'RIGHT')
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                    effectiveSide === 'RIGHT'
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {isAr ? 'اليمين (R)' : 'Right (R)'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSelectRegionAndSide(selectedRegion, 'LEFT')
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                    effectiveSide === 'LEFT'
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {isAr ? 'اليسار (L)' : 'Left (L)'}
                </button>
              </div>
            </div>
          )}

          {/* Group Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveGroup('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                activeGroup === 'ALL'
                  ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAr ? 'الكل (26)' : 'All (26)'}
            </button>
            {REGION_GROUPS.map((grp) => {
              const active = activeGroup === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setActiveGroup(grp.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isAr ? grp.titleAr : grp.titleEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Region Cards */}
        <div className="relative flex-1 min-h-0 flex">
          <div
            ref={scrollRef}
            {...scrollHandlers}
            className="stage-scroll-area flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-3.5 space-y-3 select-none"
          >
            {visibleGroups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <div className="text-[11px] font-bold text-cyan-300 px-0.5">
                  {isAr ? group.titleAr : group.titleEn}
                </div>
                <div className="hud-region-grid grid grid-cols-1 min-[520px]:grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {group.regions.map((region) => {
                    const bilateral = isBilateralRegion(region);
                    const isRegionActive = selectedRegion === region;

                    if (!bilateral) {
                      return (
                        <button
                          key={region}
                          type="button"
                          onClick={() => {
                            onSelectRegionAndSide(region, 'NONE');
                            onClose();
                          }}
                          className={`hud-region-card min-h-[46px] flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-start cursor-pointer transition-colors ${
                            isRegionActive
                              ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_12px_rgba(34,211,238,0.16)]'
                              : 'border-slate-800 bg-[#0D1726] hover:border-slate-600 hover:bg-slate-800/85'
                          }`}
                        >
                          <div className="min-w-0">
                            <div
                              className={`text-[11.5px] sm:text-xs font-bold leading-snug truncate ${
                                isRegionActive ? 'text-cyan-200' : 'text-slate-100'
                              }`}
                            >
                              {REGION_SHORT_I18N[lang][region]}
                            </div>
                            <div className="text-[9.5px] text-slate-400 truncate">
                              {REGION_LABELS_I18N[lang][region]}
                            </div>
                          </div>
                          {isRegionActive && (
                            <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                          )}
                        </button>
                      );
                    }

                    return (
                      <div
                        key={region}
                        className={`hud-region-card min-h-[52px] flex flex-col justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border transition-colors ${
                          isRegionActive
                            ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_12px_rgba(34,211,238,0.16)]'
                            : 'border-slate-800 bg-[#0D1726]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`text-[11.5px] sm:text-xs font-bold leading-snug truncate ${
                              isRegionActive ? 'text-cyan-200' : 'text-slate-100'
                            }`}
                          >
                            {REGION_SHORT_I18N[lang][region]}
                          </span>
                          <span className="text-[9px] font-mono-num text-slate-400 shrink-0">
                            {isRegionActive
                              ? SIDE_LABELS_I18N[lang][effectiveSide]
                              : isAr
                                ? 'طرفان'
                                : 'R / L'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectRegionAndSide(region, 'RIGHT');
                              onClose();
                            }}
                            className={`py-1 px-2 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-colors ${
                              isRegionActive && effectiveSide === 'RIGHT'
                                ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
                            }`}
                          >
                            {isAr ? 'يمين R' : 'Right R'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectRegionAndSide(region, 'LEFT');
                              onClose();
                            }}
                            className={`py-1 px-2 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-colors ${
                              isRegionActive && effectiveSide === 'LEFT'
                                ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
                            }`}
                          >
                            {isAr ? 'يسار L' : 'Left L'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {metrics.hasOverflow && (
            <div className="w-2.5 shrink-0 py-2 px-0.5 bg-[#070E18] border-s border-slate-800/70 flex flex-col">
              <div className="relative flex-1 w-full rounded-full bg-slate-800/70 overflow-hidden">
                <div
                  className="absolute inset-x-0 rounded-full bg-cyan-400/80 transition-[top] duration-75"
                  style={{
                    height: `${Math.round(metrics.thumbRatio * 100)}%`,
                    top: `${Math.round(thumbTopPct)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer with Easy Up / Down Scroll Controls */}
        <div className="shrink-0 px-2.5 sm:px-3.5 py-1.5 sm:py-2 border-t border-slate-800/90 bg-[#070E18] flex items-center justify-between gap-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!metrics.canScrollUp}
              onPointerDown={() => startHoldScroll(-1)}
              onPointerUp={stopHoldScroll}
              onPointerLeave={stopHoldScroll}
              onPointerCancel={stopHoldScroll}
              onClick={() => handleHoldButtonClick(-1, 175)}
              aria-label={isAr ? 'الصعود للأعلى' : 'Scroll up'}
              className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/60 text-slate-100 font-bold cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default"
            >
              <ChevronUp className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>{isAr ? 'للأعلى' : 'Up'}</span>
            </button>

            <button
              type="button"
              disabled={!metrics.canScrollDown}
              onPointerDown={() => startHoldScroll(1)}
              onPointerUp={stopHoldScroll}
              onPointerLeave={stopHoldScroll}
              onPointerCancel={stopHoldScroll}
              onClick={() => handleHoldButtonClick(1, 175)}
              aria-label={isAr ? 'النزول للأسفل' : 'Scroll down'}
              className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/60 text-slate-100 font-bold cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default"
            >
              <ChevronDown className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>{isAr ? 'للأسفل' : 'Down'}</span>
            </button>
          </div>

          <span className="hidden sm:inline text-slate-400">
            {isAr
              ? 'يمكنك أيضاً الضغط مباشرة على المنطقة فوق جسم المريض'
              : 'You can also tap regions directly on the 3D patient'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[32px] px-3.5 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer transition-colors shrink-0"
          >
            {isAr ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
