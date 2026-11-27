import React, {useEffect, useRef, useState} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  UserCheck,
  X,
} from 'lucide-react';
import type {BodyRegion, Language, PatientPosture} from '../types/radiology';
import {
  POSTURE_LABELS_I18N,
  POSTURE_SHORT_I18N,
  REGION_LABELS_I18N,
  useLanguage,
} from '../i18n/translations';
import {useStageScroll} from '../hooks/useStageScroll';

interface PatientPostureMenuProps {
  isOpen: boolean;
  selectedPosture: PatientPosture;
  selectedRegion: BodyRegion;
  hasLeadShield: boolean;
  shieldUsed: boolean;
  onSelectPosture: (posture: PatientPosture) => void;
  onToggleShield: () => void;
  onClose: () => void;
}

const ERECT_POSTURES: PatientPosture[] = [
  'ERECT_PA',
  'ERECT_AP',
  'ERECT_LEFT_LAT',
  'ERECT_RIGHT_LAT',
  'ERECT_RAO',
  'ERECT_LAO',
];

const TABLE_POSTURES: PatientPosture[] = [
  'SUPINE',
  'PRONE',
  'TABLE_LEFT_LAT',
  'TABLE_RIGHT_LAT',
  'TABLE_RPO',
  'TABLE_LPO',
];

const POSTURE_SUB_I18N: Record<Language, Record<PatientPosture, string>> = {
  ar: {
    ERECT_PA: 'الصدر مواجه للبكي · الأشعة من الخلف',
    ERECT_AP: 'الظهر للبكي · الأشعة من الأمام',
    ERECT_LEFT_LAT: 'الكتف الأيسر على البكي · الذراعان للأعلى',
    ERECT_RIGHT_LAT: 'الكتف الأيمن على البكي · الذراعان للأعلى',
    ERECT_RAO: 'تدوير 45° للأمام يميناً نحو الحامل',
    ERECT_LAO: 'تدوير 45° للأمام يساراً نحو الحامل',
    SUPINE: 'مستلقٍ على الظهر · الأشعة من الأعلى',
    PRONE: 'مستلقٍ على البطن · الأشعة من الخلف',
    TABLE_LEFT_LAT: 'استلقاء على الجانب الأيسر فوق الطاولة',
    TABLE_RIGHT_LAT: 'استلقاء على الجانب الأيمن فوق الطاولة',
    TABLE_RPO: 'مائل 45° على الجهة الخلفية اليمنى',
    TABLE_LPO: 'مائل 45° على الجهة الخلفية اليسرى',
  },
  en: {
    ERECT_PA: 'Chest facing Bucky · Beam Posterior → Anterior',
    ERECT_AP: 'Back against Bucky · Beam Anterior → Posterior',
    ERECT_LEFT_LAT: 'Left shoulder on Bucky · Arms raised overhead',
    ERECT_RIGHT_LAT: 'Right shoulder on Bucky · Arms raised overhead',
    ERECT_RAO: 'Rotated 45° Right Anterior toward Bucky',
    ERECT_LAO: 'Rotated 45° Left Anterior toward Bucky',
    SUPINE: 'Lying flat on back · Overhead AP beam',
    PRONE: 'Lying face-down on abdomen · PA beam',
    TABLE_LEFT_LAT: 'Lying on left side with knees flexed',
    TABLE_RIGHT_LAT: 'Lying on right side with knees flexed',
    TABLE_RPO: 'Rotated 45° onto Right Posterior hip & shoulder',
    TABLE_LPO: 'Rotated 45° onto Left Posterior hip & shoulder',
  },
};

const PostureIllustration: React.FC<{
  posture: PatientPosture;
  active: boolean;
}> = ({posture, active}) => {
  const accent = active ? '#22D3EE' : '#38BDF8';
  const beamColor = active ? '#67E8F9' : '#38BDF8';
  const bodyFill = active ? '#1E3A5F' : '#17253B';
  const bodyStroke = active ? '#E0F2FE' : '#94A3B8';
  const skinFill = active ? '#BAE6FD' : '#CBD5E1';
  const buckyColor = active ? '#0EA5E9' : '#475569';

  const isErect = posture.startsWith('ERECT_');

  const BeamArrowHorizontal: React.FC<{x1?: number; x2?: number; y?: number}> = ({
    x1 = 8,
    x2 = 28,
    y = 30,
  }) => (
    <g>
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={beamColor}
        strokeWidth="2"
        strokeDasharray="3 2"
      />
      <polygon
        points={`${x2},${y} ${x2 - 5},${y - 3.2} ${x2 - 5},${y + 3.2}`}
        fill={beamColor}
      />
      <circle cx={x1} cy={y} r="2.2" fill={beamColor} />
    </g>
  );

  const BeamArrowVertical: React.FC<{x?: number; y1?: number; y2?: number}> = ({
    x = 44,
    y1 = 6,
    y2 = 24,
  }) => (
    <g>
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        stroke={beamColor}
        strokeWidth="2"
        strokeDasharray="3 2"
      />
      <polygon
        points={`${x},${y2} ${x - 3.2},${y2 - 5} ${x + 3.2},${y2 - 5}`}
        fill={beamColor}
      />
      <rect
        x={x - 6}
        y={y1 - 3}
        width="12"
        height="4"
        rx="1"
        fill={buckyColor}
      />
    </g>
  );

  const WallBuckyPlate = (
    <g>
      <rect x="69" y="10" width="6" height="46" rx="1.5" fill="#1E293B" stroke={buckyColor} strokeWidth="1.4" />
      <line x1="69" y1="15" x2="69" y2="50" stroke={accent} strokeWidth="2.2" />
      <line x1="65" y1="57" x2="79" y2="57" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
    </g>
  );

  const TableSurface = (
    <g>
      <rect x="12" y="47" width="64" height="5.5" rx="2" fill="#1E293B" stroke={buckyColor} strokeWidth="1.3" />
      <line x1="20" y1="47" x2="68" y2="47" stroke={accent} strokeWidth="1.8" />
      <rect x="24" y="52.5" width="7" height="6.5" rx="1" fill="#334155" />
      <rect x="57" y="52.5" width="7" height="6.5" rx="1" fill="#334155" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 88 64"
      className="hud-posture-svg w-[66px] h-[48px] sm:w-[78px] sm:h-[56px] shrink-0 rounded-xl bg-[#070E18] border border-slate-800/90"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="84" height="60" rx="9" fill="#070E18" />

      {isErect ? (
        <>
          {WallBuckyPlate}
          <BeamArrowHorizontal x1={9} x2={30} y={29} />

          {posture === 'ERECT_PA' && (
            <g>
              <circle cx="51" cy="17" r="5" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <path d="M55.5 16.5 L57.5 17.5 L55.5 18.5" fill="none" stroke={bodyStroke} strokeWidth="1.3" strokeLinecap="round" />
              <path d="M46 23.5 C46 22, 56 22, 56 24 L56 38 L46 38 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.4" />
              <path d="M55 26 L65 29 L64 33" fill="none" stroke={bodyStroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="49" y1="38" x2="49" y2="55.5" stroke={bodyStroke} strokeWidth="3.2" strokeLinecap="round" />
              <line x1="53" y1="38" x2="54" y2="55.5" stroke={bodyStroke} strokeWidth="3.2" strokeLinecap="round" />
            </g>
          )}

          {posture === 'ERECT_AP' && (
            <g>
              <circle cx="53" cy="17" r="5" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <path d="M48.5 16.5 L46.2 17.5 L48.5 18.5" fill="none" stroke={bodyStroke} strokeWidth="1.3" strokeLinecap="round" />
              <path d="M48 23.5 C48 22, 58 22, 58 24 L58 38 L48 38 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.4" />
              <line x1="50" y1="25" x2="47" y2="37" stroke={bodyStroke} strokeWidth="2.4" strokeLinecap="round" />
              <line x1="51" y1="38" x2="50" y2="55.5" stroke={bodyStroke} strokeWidth="3.2" strokeLinecap="round" />
              <line x1="55" y1="38" x2="55" y2="55.5" stroke={bodyStroke} strokeWidth="3.2" strokeLinecap="round" />
            </g>
          )}

          {(posture === 'ERECT_LEFT_LAT' || posture === 'ERECT_RIGHT_LAT') && (
            <g>
              <circle cx="53" cy="17" r="4.8" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <path
                d={
                  posture === 'ERECT_LEFT_LAT'
                    ? 'M51 22 L45 13 M55 22 L49 12'
                    : 'M51 22 L57 13 M55 22 L61 12'
                }
                fill="none"
                stroke={bodyStroke}
                strokeWidth="2.3"
                strokeLinecap="round"
              />
              <rect x="49" y="23" width="8" height="15" rx="3" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.4" />
              <line x1="53" y1="38" x2="53" y2="55.5" stroke={bodyStroke} strokeWidth="3.4" strokeLinecap="round" />
              <text
                x="15"
                y="18"
                fill={accent}
                fontSize="10"
                fontWeight="700"
                fontFamily="monospace"
              >
                {posture === 'ERECT_LEFT_LAT' ? 'L' : 'R'}
              </text>
            </g>
          )}

          {(posture === 'ERECT_RAO' || posture === 'ERECT_LAO') && (
            <g>
              <circle cx="52" cy="17" r="4.8" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <polygon
                points={
                  posture === 'ERECT_RAO'
                    ? '46,23 58,25 56,39 45,37'
                    : '47,25 59,23 58,37 46,39'
                }
                fill={bodyFill}
                stroke={bodyStroke}
                strokeWidth="1.4"
              />
              <path d="M56 26 L64 31" fill="none" stroke={bodyStroke} strokeWidth="2.2" strokeLinecap="round" />
              <line x1="49" y1="38" x2="48" y2="55.5" stroke={bodyStroke} strokeWidth="3.1" strokeLinecap="round" />
              <line x1="54" y1="38" x2="56" y2="55.5" stroke={bodyStroke} strokeWidth="3.1" strokeLinecap="round" />
              <text
                x="12"
                y="17"
                fill={accent}
                fontSize="8.5"
                fontWeight="700"
                fontFamily="monospace"
              >
                {posture === 'ERECT_RAO' ? '45° R' : '45° L'}
              </text>
            </g>
          )}
        </>
      ) : (
        <>
          {TableSurface}
          <BeamArrowVertical x={44} y1={7} y2={23} />

          {posture === 'SUPINE' && (
            <g>
              <circle cx="22" cy="40.5" r="4.5" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <path d="M22 36 L22 33.5" stroke={bodyStroke} strokeWidth="1.4" strokeLinecap="round" />
              <rect x="27" y="38.5" width="23" height="7.5" rx="3" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.4" />
              <line x1="50" y1="42" x2="67" y2="42" stroke={bodyStroke} strokeWidth="3.4" strokeLinecap="round" />
              <line x1="67" y1="42" x2="67" y2="36" stroke={bodyStroke} strokeWidth="2.6" strokeLinecap="round" />
            </g>
          )}

          {posture === 'PRONE' && (
            <g>
              <circle cx="22" cy="41.5" r="4.5" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <rect x="27" y="39" width="23" height="7" rx="3" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.4" />
              <path d="M29 40 L21 36.5" fill="none" stroke={bodyStroke} strokeWidth="2.1" strokeLinecap="round" />
              <line x1="50" y1="42.5" x2="67" y2="42.5" stroke={bodyStroke} strokeWidth="3.4" strokeLinecap="round" />
              <line x1="67" y1="42.5" x2="67" y2="46.5" stroke={bodyStroke} strokeWidth="2.4" strokeLinecap="round" />
            </g>
          )}

          {(posture === 'TABLE_LEFT_LAT' || posture === 'TABLE_RIGHT_LAT') && (
            <g>
              <circle cx="22" cy="40" r="4.5" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <rect x="27" y="37.5" width="22" height="8" rx="3.5" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.4" />
              <path
                d={
                  posture === 'TABLE_LEFT_LAT'
                    ? 'M49 41 L58 34 L67 42'
                    : 'M49 41 L57 35.5 L66 43'
                }
                fill="none"
                stroke={bodyStroke}
                strokeWidth="3.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text
                x="13"
                y="18"
                fill={accent}
                fontSize="10"
                fontWeight="700"
                fontFamily="monospace"
              >
                {posture === 'TABLE_LEFT_LAT' ? 'L↓' : 'R↓'}
              </text>
            </g>
          )}

          {(posture === 'TABLE_RPO' || posture === 'TABLE_LPO') && (
            <g>
              <polygon
                points="33,46.5 45,46.5 45,39.5"
                fill="#0EA5E9"
                fillOpacity="0.35"
                stroke={accent}
                strokeWidth="1.2"
              />
              <circle cx="22" cy="39" r="4.5" fill={skinFill} stroke={bodyStroke} strokeWidth="1.4" />
              <polygon
                points={
                  posture === 'TABLE_RPO'
                    ? '27,36 49,33.5 50,42 28,44'
                    : '27,33.5 49,36 50,44 28,42'
                }
                fill={bodyFill}
                stroke={bodyStroke}
                strokeWidth="1.4"
              />
              <path
                d="M50 39.5 L59 35.5 L67 41.5"
                fill="none"
                stroke={bodyStroke}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text
                x="12"
                y="18"
                fill={accent}
                fontSize="8.5"
                fontWeight="700"
                fontFamily="monospace"
              >
                {posture === 'TABLE_RPO' ? '45° R' : '45° L'}
              </text>
            </g>
          )}
        </>
      )}
    </svg>
  );
};

export const PatientPostureMenu: React.FC<PatientPostureMenuProps> = ({
  isOpen,
  selectedPosture,
  selectedRegion,
  hasLeadShield,
  shieldUsed,
  onSelectPosture,
  onToggleShield,
  onClose,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  const {
    scrollRef,
    metrics,
    updateMetrics,
    startHoldScroll,
    stopHoldScroll,
    handleHoldButtonClick,
    scrollHandlers,
  } = useStageScroll<HTMLDivElement>(isOpen);

  const erectSectionRef = useRef<HTMLDivElement | null>(null);
  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState<'ERECT' | 'TABLE'>(() =>
    selectedPosture.startsWith('ERECT_') ? 'ERECT' : 'TABLE'
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const isErect = selectedPosture.startsWith('ERECT_');
    setActiveSection(isErect ? 'ERECT' : 'TABLE');
    const raf = requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      if (!isErect && tableSectionRef.current) {
        container.scrollTop = Math.max(0, tableSectionRef.current.offsetTop - 8);
      } else {
        container.scrollTop = 0;
      }
      updateMetrics();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, selectedPosture, scrollRef, updateMetrics]);

  if (!isOpen) return null;

  const scrollToSection = (section: 'ERECT' | 'TABLE') => {
    const container = scrollRef.current;
    if (!container) return;
    setActiveSection(section);
    if (section === 'ERECT') {
      container.scrollTo({top: 0, behavior: 'smooth'});
      return;
    }
    const target = tableSectionRef.current;
    if (target) {
      container.scrollTo({
        top: Math.max(0, target.offsetTop - 8),
        behavior: 'smooth',
      });
    }
  };

  const handleListScroll = () => {
    const container = scrollRef.current;
    const tableEl = tableSectionRef.current;
    if (!container || !tableEl) return;
    const midpoint = container.scrollTop + container.clientHeight * 0.35;
    setActiveSection(midpoint >= tableEl.offsetTop ? 'TABLE' : 'ERECT');
  };

  const renderGroup = (
    title: string,
    postures: PatientPosture[],
    sectionRef: React.RefObject<HTMLDivElement | null>
  ) => (
    <div ref={sectionRef} className="space-y-1.5">
      <div className="text-[11px] font-bold text-cyan-300 tracking-wide px-0.5">
        {title}
      </div>
      <div className="hud-posture-grid grid grid-cols-1 min-[500px]:grid-cols-2 gap-1.5 sm:gap-2">
        {postures.map((posture) => {
          const active = selectedPosture === posture;
          return (
            <button
              key={posture}
              type="button"
              onClick={() => {
                onSelectPosture(posture);
                onClose();
              }}
              className={`hud-posture-card min-h-[60px] flex items-center gap-2 p-1.5 sm:p-2 rounded-xl border text-start cursor-pointer transition-colors ${
                active
                  ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_16px_rgba(34,211,238,0.18)]'
                  : 'border-slate-800 bg-[#0D1726] hover:border-slate-600 hover:bg-slate-800/85'
              }`}
            >
              <PostureIllustration posture={posture} active={active} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-[11.5px] sm:text-[13px] font-bold leading-snug ${
                      active ? 'text-cyan-200' : 'text-slate-100'
                    }`}
                  >
                    {POSTURE_SHORT_I18N[lang][posture]}
                  </span>
                  {active && (
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 leading-snug truncate">
                  {POSTURE_LABELS_I18N[lang][posture]}
                </div>
                <div className="text-[9.5px] text-slate-500 leading-tight line-clamp-1">
                  {POSTURE_SUB_I18N[lang][posture]}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const thumbTopPct = metrics.progress * (100 - metrics.thumbRatio * 100);

  return (
    <div
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-40 bg-slate-950/60 flex items-center justify-center p-1.5 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'قائمة وضعيات المريض' : 'Patient Posture Menu'}
        className="hud-posture-window w-full max-w-[660px] max-h-[calc(var(--stage-h,100vh)-0.75rem)] sm:max-h-[min(calc(var(--stage-h,100vh)*0.88),640px)] flex flex-col rounded-2xl border border-slate-700/85 bg-[#08101C]/98 shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-800 bg-[#0B1525] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <h2 className="font-display text-xs sm:text-base font-extrabold text-white">
                {isAr ? 'وضعيات تصوير المريض' : 'Patient Positioning'}
              </h2>
            </div>
            <p className="text-[10.5px] sm:text-xs text-slate-300 mt-0.5 leading-snug truncate">
              {isAr ? 'المنطقة المحددة: ' : 'Targeted Region: '}
              <span className="font-bold text-cyan-300">
                {REGION_LABELS_I18N[lang][selectedRegion]}
              </span>
              <span className="text-slate-400">
                {isAr
                  ? ' · لتغييرها اضغط ضغطة واحدة على جسم المريض'
                  : ' · Single-tap patient body to change'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasLeadShield && (
              <button
                type="button"
                onClick={onToggleShield}
                className={`min-h-[34px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-colors ${
                  shieldUsed
                    ? 'bg-emerald-500/20 border-emerald-500/70 text-emerald-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {shieldUsed
                    ? isAr
                      ? 'الدرع ✓'
                      : 'Shield ✓'
                    : isAr
                      ? 'درع الرصاص'
                      : 'Lead Shield'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
              className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Section Jump Tabs */}
        <div className="shrink-0 px-3 py-1.5 bg-[#091321] border-b border-slate-800/80 flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToSection('ERECT')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
              activeSection === 'ERECT'
                ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAr
              ? 'واقف (Wall Bucky · 6)'
              : 'Standing · Wall Bucky (6)'}
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('TABLE')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
              activeSection === 'TABLE'
                ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isAr
              ? 'مستلقٍ على الطاولة (Table · 6)'
              : 'Lying Down · Table (6)'}
          </button>
        </div>

        {/* Scrollable Posture List + Visible Scroll Indicator */}
        <div className="relative flex-1 min-h-0 flex">
          <div
            ref={scrollRef}
            onScroll={handleListScroll}
            {...scrollHandlers}
            className="relative stage-scroll-area flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-3.5 space-y-3 select-none"
          >
            {renderGroup(
              isAr
                ? 'واقف أمام الحامل الجداري (Wall Bucky · Erect)'
                : 'Standing · Wall Bucky (Erect)',
              ERECT_POSTURES,
              erectSectionRef
            )}
            {renderGroup(
              isAr
                ? 'مستلقٍ على طاولة الأشعة (X-Ray Table)'
                : 'Lying Down · X-Ray Table',
              TABLE_POSTURES,
              tableSectionRef
            )}
          </div>

          {/* Visual Scroll Track Indicator */}
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

        {/* Footer with Effortless Up / Down Tap-or-Hold Scroll Buttons */}
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
              className="min-h-[34px] flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-800 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/60 text-slate-100 font-bold cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default"
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
              className="min-h-[34px] flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-800 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/60 text-slate-100 font-bold cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default"
            >
              <ChevronDown className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>{isAr ? 'للأسفل' : 'Down'}</span>
            </button>
          </div>

          <span className="hidden sm:inline text-slate-400">
            {isAr
              ? 'اسحب للأعلى والأسفل أو اضغط أزرار التحريك'
              : 'Swipe up/down or use the scroll buttons'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[34px] px-3.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold cursor-pointer transition-colors shrink-0"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
