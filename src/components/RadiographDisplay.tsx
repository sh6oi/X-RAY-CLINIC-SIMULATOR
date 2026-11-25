import React, {useMemo, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Contrast,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Maximize2,
  RotateCcw,
  RotateCw,
  Scan,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ExamProtocol,
  PatientCase,
  PatientPosture,
  ProjectionType,
  ScanEvaluation,
} from '../types/radiology';
import {FILM_CARTON_COST, getRadiographImage} from '../data/radiologyData';
import {
  MODALITY_LABELS_I18N,
  POSTURE_SHORT_I18N,
  PROJECTION_LABELS_I18N,
  REGION_LABELS_I18N,
  useLanguage,
} from '../i18n/translations';

interface RadiographDisplayProps {
  patient: PatientCase;
  requestedExam: ExamProtocol;
  evaluation: ScanEvaluation;
  actualPosture?: PatientPosture;
  actualProjection?: ProjectionType;
  kvp: number;
  mas: number;
  filmsRemaining: number;
  hasDR: boolean;
  onApproveAndCollect: () => void;
  onRetake: () => void;
  onGoToShop: () => void;
}

type ViewPresetId = 'STANDARD' | 'LUNG' | 'BONE' | 'SOFT';

const VIEW_PRESETS: {
  id: ViewPresetId;
  labelAr: string;
  labelEn: string;
  brightness: number;
  contrast: number;
}[] = [
  {
    id: 'STANDARD',
    labelAr: 'قياسي (View)',
    labelEn: 'Standard',
    brightness: 108,
    contrast: 112,
  },
  {
    id: 'LUNG',
    labelAr: 'نافذة الرئة',
    labelEn: 'Lung Window',
    brightness: 122,
    contrast: 132,
  },
  {
    id: 'BONE',
    labelAr: 'نافذة العظام',
    labelEn: 'Bone Window',
    brightness: 94,
    contrast: 158,
  },
  {
    id: 'SOFT',
    labelAr: 'أنسجة رخوة',
    labelEn: 'Soft Tissue',
    brightness: 114,
    contrast: 96,
  },
];

function getEvaluationText(
  evaluation: ScanEvaluation,
  lang: 'ar' | 'en',
  regionLabel: string
): {title: string; feedback: string} {
  if (lang === 'ar') {
    return {title: evaluation.titleAr, feedback: evaluation.feedbackAr};
  }
  switch (evaluation.reasonCode) {
    case 'OPTIMAL':
      return {
        title: 'Diagnostic Quality Image',
        feedback: `Excellent image contrast and anatomical alignment for ${regionLabel}.`,
      };
    case 'WRONG_REGION':
      return {
        title: 'Wrong Anatomical Region',
        feedback: `You imaged ${regionLabel}, but the requested region does not match the patient's exam.`,
      };
    case 'WRONG_POSTURE':
      return {
        title: 'Incorrect Patient Posture',
        feedback:
          'Patient positioning does not match the clinical protocol (Erect vs. Table). Reposition and retake.',
      };
    case 'WRONG_PROJECTION':
      return {
        title: 'Projection Mismatch',
        feedback:
          'The chosen patient posture/projection does not match the requested radiographic view.',
      };
    case 'UNDEREXPOSED':
      return {
        title: 'Underexposed Image (Low mAs/kVp)',
        feedback:
          'Insufficient beam penetration caused a faint, noisy image. Increase kVp or mAs and repeat.',
      };
    case 'OVEREXPOSED':
      return {
        title: 'Overexposed Image (Excess Dose)',
        feedback:
          'Excessive exposure darkened the radiograph. Lower kVp or mAs to protect diagnostic detail.',
      };
  }
}

export const RadiographDisplay: React.FC<RadiographDisplayProps> = ({
  patient,
  requestedExam,
  evaluation,
  actualPosture,
  actualProjection,
  kvp,
  mas,
  filmsRemaining,
  hasDR,
  onApproveAndCollect,
  onRetake,
  onGoToShop,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  // View Controls
  const [viewPreset, setViewPreset] = useState<ViewPresetId>('STANDARD');
  const [brightnessPct, setBrightnessPct] = useState(108);
  const [contrastPct, setContrastPct] = useState(112);
  const [inverted, setInverted] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [flippedX, setFlippedX] = useState(false);

  // Mask Controls (Collimation Shutter Mask + DICOM Annotation Mask)
  const [shutterMaskEnabled, setShutterMaskEnabled] = useState(true);
  const [maskAperturePct, setMaskAperturePct] = useState(88);
  const [overlayMaskEnabled, setOverlayMaskEnabled] = useState(true);

  const effectivePosture: PatientPosture =
    actualPosture ?? requestedExam.recommendedPosture;
  const effectiveProjection: ProjectionType =
    actualProjection ?? requestedExam.recommendedProjection;

  const {src: imageSrc, mirrorX: autoMirrorX} = useMemo(
    () =>
      getRadiographImage({
        region: evaluation.targetRegionScanned,
        modality: requestedExam.modality,
        projection: effectiveProjection,
        posture: effectivePosture,
      }),
    [
      evaluation.targetRegionScanned,
      requestedExam.modality,
      effectiveProjection,
      effectivePosture,
    ]
  );

  const regionLabel =
    REGION_LABELS_I18N[lang][evaluation.targetRegionScanned];
  const modalityLabel = MODALITY_LABELS_I18N[lang][requestedExam.modality];
  const postureLabel = POSTURE_SHORT_I18N[lang][effectivePosture];
  const projectionLabel = PROJECTION_LABELS_I18N[lang][effectiveProjection];
  const evalText = getEvaluationText(evaluation, lang, regionLabel);

  const handleSelectViewPreset = (preset: (typeof VIEW_PRESETS)[number]) => {
    setViewPreset(preset.id);
    setBrightnessPct(preset.brightness);
    setContrastPct(preset.contrast);
  };

  const handleResetViewAndMask = () => {
    setViewPreset('STANDARD');
    setBrightnessPct(108);
    setContrastPct(112);
    setInverted(false);
    setZoomPct(100);
    setRotationDeg(0);
    setFlippedX(false);
    setShutterMaskEnabled(true);
    setMaskAperturePct(88);
    setOverlayMaskEnabled(true);
  };

  let exposureFilter = `contrast(${contrastPct}%) brightness(${brightnessPct}%)`;
  if (evaluation.exposureDelta < 0) {
    exposureFilter = `brightness(${Math.round(brightnessPct * 1.65)}%) contrast(${Math.round(contrastPct * 0.45)}%) opacity(0.72)`;
  } else if (evaluation.exposureDelta > 0) {
    exposureFilter = `brightness(${Math.round(brightnessPct * 0.35)}%) contrast(${Math.round(contrastPct * 1.4)}%)`;
  }
  if (inverted) {
    exposureFilter = `${exposureFilter} invert(1)`;
  }

  const outOfFilms =
    !hasDR && requestedExam.modality === 'XRAY' && filmsRemaining <= 0;

  const maskInsetPct = shutterMaskEnabled
    ? Math.max(0, (100 - maskAperturePct) / 2)
    : 0;

  return (
    <div className="space-y-4">
      {/* Top Patient & View Preset Strip */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1624] px-3.5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={patient.avatarPath}
            alt={patient.nameAr}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-lg object-cover border border-cyan-500/40 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {patient.nameAr} · {regionLabel}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {modalityLabel} · <span className="text-cyan-300 font-semibold">{postureLabel}</span> ·{' '}
              {kvp} kVp · {mas} mAs
            </div>
          </div>
        </div>

        {/* View Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
          {VIEW_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectViewPreset(preset)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewPreset === preset.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isAr ? preset.labelAr : preset.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Organized View + Mask Workspace */}
      <div className="grid grid-cols-1 min-[600px]:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* LEFT/TOP: Illuminated Radiograph View + Collimation Mask Viewport */}
        <div className="min-[600px]:col-span-7 rounded-xl border border-slate-800 bg-[#08101C] p-2.5 sm:p-4 flex flex-col items-center gap-2.5 sm:gap-3">
          <div className="relative w-full max-w-[240px] sm:max-w-[275px] lg:max-w-[380px] aspect-square rounded-xl bg-[#04080F] border-2 border-cyan-900/60 overflow-hidden flex items-center justify-center shadow-[0_0_45px_rgba(34,211,238,0.12)]">
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-200"
              style={{
                filter: exposureFilter,
                transform: `scale(${zoomPct / 100}) rotate(${rotationDeg}deg) scaleX(${(flippedX !== autoMirrorX) ? -1 : 1})`,
              }}
            >
              <img
                src={imageSrc}
                alt={regionLabel}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>

            {shutterMaskEnabled && (
              <div
                className="pointer-events-none absolute inset-0 transition-all duration-150"
                style={{
                  borderStyle: 'solid',
                  borderColor: 'rgba(3, 7, 13, 0.88)',
                  borderTopWidth: `${maskInsetPct}%`,
                  borderBottomWidth: `${maskInsetPct}%`,
                  borderLeftWidth: `${maskInsetPct}%`,
                  borderRightWidth: `${maskInsetPct}%`,
                }}
              >
                <div className="w-full h-full border border-cyan-400/55 relative">
                  <span className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-cyan-300" />
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-cyan-300" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-cyan-300" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-cyan-300" />
                </div>
              </div>
            )}

            {overlayMaskEnabled && (
              <>
                <div className="pointer-events-none absolute top-2 right-2 z-10 max-w-[46%] text-[9.5px] sm:text-[10.5px] font-mono-num text-cyan-200 text-right leading-snug bg-[#040912]/75 px-1.5 py-0.5 rounded">
                  <div className="truncate">{patient.nameAr}</div>
                  <div className="truncate">{regionLabel} · {postureLabel}</div>
                </div>
                <div className="pointer-events-none absolute top-2 left-2 z-10 max-w-[46%] text-[9.5px] sm:text-[10.5px] font-mono-num text-cyan-200 text-left leading-snug bg-[#040912]/75 px-1.5 py-0.5 rounded">
                  <div className="truncate">{kvp} kVp · {mas} mAs</div>
                  <div className="text-[9px] sm:text-[10px] text-cyan-300 truncate">{projectionLabel}</div>
                </div>
                <div className="pointer-events-none absolute bottom-2.5 left-3 z-10 text-xs font-mono-num font-bold text-cyan-100 bg-[#040912]/70 px-2 py-0.5 rounded">
                  {effectiveProjection} · {zoomPct}%
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
                  <div className="w-6 h-px bg-cyan-300" />
                  <div className="h-6 w-px bg-cyan-300 absolute" />
                </div>
              </>
            )}
          </div>

          {/* Quick View Toolbar Under Image */}
          <div className="w-full max-w-[440px] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomPct((z) => Math.max(100, z - 20))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                aria-label={isAr ? 'تصغير' : 'Zoom Out'}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono-num text-cyan-300 px-1.5 min-w-[46px] text-center">
                {zoomPct}%
              </span>
              <button
                type="button"
                onClick={() => setZoomPct((z) => Math.min(220, z + 20))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                aria-label={isAr ? 'تكبير' : 'Zoom In'}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRotationDeg((d) => (d + 90) % 360)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{isAr ? 'تدوير' : 'Rotate'}</span>
              </button>
              <button
                type="button"
                onClick={() => setFlippedX((f) => !f)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  flippedX
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'انعكاس' : 'Flip'}</span>
              </button>
              <button
                type="button"
                onClick={() => setInverted((v) => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  inverted
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Contrast className="w-3.5 h-3.5" />
                <span>{isAr ? 'عكس' : 'Invert'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT/BOTTOM: Organized View Controls, Mask Controls, and Approval */}
        <div className="min-[600px]:col-span-5 space-y-3">
          {/* Card 1: View Controls */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1624] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <SlidersHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{isAr ? 'التحكم بالعرض (View)' : 'View Controls'}</span>
              </div>
              <button
                type="button"
                onClick={handleResetViewAndMask}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {isAr ? 'إعادة ضبط' : 'Reset'}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="img-brightness" className="text-slate-300">
                  {isAr ? 'السطوع (Brightness)' : 'Brightness'}
                </label>
                <span className="font-mono-num text-cyan-300 font-semibold">
                  {brightnessPct}%
                </span>
              </div>
              <input
                id="img-brightness"
                type="range"
                min={55}
                max={165}
                value={brightnessPct}
                onChange={(e) => setBrightnessPct(Number(e.target.value))}
                className="w-full radiology-slider"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="img-contrast" className="text-slate-300">
                  {isAr ? 'التباين (Contrast)' : 'Contrast'}
                </label>
                <span className="font-mono-num text-cyan-300 font-semibold">
                  {contrastPct}%
                </span>
              </div>
              <input
                id="img-contrast"
                type="range"
                min={65}
                max={185}
                value={contrastPct}
                onChange={(e) => setContrastPct(Number(e.target.value))}
                className="w-full radiology-slider"
              />
            </div>
          </section>

          {/* Card 2: Mask Controls */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1624] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white pb-2 border-b border-slate-800/80">
              <Scan className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{isAr ? 'التحكم بالقناع (Mask)' : 'Collimation Mask'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShutterMaskEnabled((v) => !v)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  shutterMaskEnabled
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isAr ? 'قناع التحديد' : 'Shutter Mask'}</span>
              </button>

              <button
                type="button"
                onClick={() => setOverlayMaskEnabled((v) => !v)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                  overlayMaskEnabled
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {overlayMaskEnabled ? (
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{isAr ? 'بيانات القناع' : 'DICOM Overlay'}</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="mask-aperture" className="text-slate-300">
                  {isAr ? 'فتحة قناع الحقل (Mask Aperture)' : 'Mask Aperture'}
                </label>
                <span className="font-mono-num text-cyan-300 font-semibold">
                  {shutterMaskEnabled
                    ? `${maskAperturePct}%`
                    : isAr
                      ? 'مفتوح'
                      : 'Open'}
                </span>
              </div>
              <input
                id="mask-aperture"
                type="range"
                min={50}
                max={100}
                disabled={!shutterMaskEnabled}
                value={maskAperturePct}
                onChange={(e) => setMaskAperturePct(Number(e.target.value))}
                className="w-full radiology-slider disabled:opacity-40"
              />
            </div>
          </section>

          {/* Card 3: Diagnostic Evaluation & Action */}
          <section
            className={`rounded-xl border p-4 space-y-3 ${
              evaluation.success
                ? 'bg-emerald-950/35 border-emerald-700/60'
                : 'bg-amber-950/35 border-amber-700/60'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {evaluation.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={`text-sm font-bold ${
                      evaluation.success ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {evalText.title}
                  </h4>
                  {evaluation.filmConsumed > 0 && (
                    <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                      {isAr ? '-1 فيلم' : '-1 Film'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {evalText.feedback}
                </p>
                {evaluation.success && (
                  <p className="pt-1.5 text-xs text-emerald-200 border-t border-emerald-800/50">
                    <span className="font-bold text-emerald-400">
                      {isAr ? 'التشخيص: ' : 'Finding: '}
                    </span>
                    {patient.findingAr}
                  </p>
                )}
              </div>
            </div>

            {evaluation.success ? (
              <button
                type="button"
                onClick={onApproveAndCollect}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>
                  {isAr ? 'اعتماد الصورة واستلام' : 'Approve & Collect'}
                </span>
                <span className="font-mono-num">${evaluation.totalEarned}</span>
              </button>
            ) : outOfFilms ? (
              <button
                type="button"
                onClick={onGoToShop}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer transition-colors"
              >
                {isAr
                  ? `نفدت الأفلام — اذهب للمتجر لشراء كرتون ($${FILM_CARTON_COST})`
                  : `Out of Films — Go to Shop ($${FILM_CARTON_COST})`}
              </button>
            ) : (
              <button
                type="button"
                onClick={onRetake}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? 'تعديل الإعدادات وإعادة التصوير'
                    : 'Adjust Settings & Retake'}
                </span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
