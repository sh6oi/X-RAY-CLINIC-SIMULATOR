import React, {useState} from 'react';
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
  ScanEvaluation,
} from '../types/radiology';
import {
  CT_SCAN_IMAGE,
  MRI_SCAN_IMAGE,
  REGION_LABELS_AR,
  REGION_SCAN_IMAGES,
} from '../data/radiologyData';

interface RadiographDisplayProps {
  patient: PatientCase;
  requestedExam: ExamProtocol;
  evaluation: ScanEvaluation;
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
  label: string;
  brightness: number;
  contrast: number;
}[] = [
  {id: 'STANDARD', label: 'قياسي (View)', brightness: 108, contrast: 112},
  {id: 'LUNG', label: 'نافذة الرئة', brightness: 122, contrast: 132},
  {id: 'BONE', label: 'نافذة العظام', brightness: 94, contrast: 158},
  {id: 'SOFT', label: 'أنسجة رخوة', brightness: 114, contrast: 96},
];

export const RadiographDisplay: React.FC<RadiographDisplayProps> = ({
  patient,
  requestedExam,
  evaluation,
  kvp,
  mas,
  filmsRemaining,
  hasDR,
  onApproveAndCollect,
  onRetake,
  onGoToShop,
}) => {
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

  const imageSrc =
    requestedExam.modality === 'CT'
      ? CT_SCAN_IMAGE
      : requestedExam.modality === 'MRI'
        ? MRI_SCAN_IMAGE
        : REGION_SCAN_IMAGES[evaluation.targetRegionScanned];

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

  // Shutter mask inset percentage from viewport borders
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
              {patient.nameAr} · {REGION_LABELS_AR[evaluation.targetRegionScanned]}
            </div>
            <div className="text-[11px] text-slate-400">
              {requestedExam.modalityLabelAr} · {kvp} kVp · {mas} mAs
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
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Organized View + Mask Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT/TOP: Illuminated Radiograph View + Collimation Mask Viewport */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#08101C] p-3 sm:p-4 flex flex-col items-center gap-3">
          <div className="relative w-full max-w-[440px] aspect-square rounded-xl bg-[#04080F] border-2 border-cyan-900/60 overflow-hidden flex items-center justify-center shadow-[0_0_45px_rgba(34,211,238,0.12)]">
            {/* Transformed Radiograph Layer */}
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-200"
              style={{
                filter: exposureFilter,
                transform: `scale(${zoomPct / 100}) rotate(${rotationDeg}deg) scaleX(${flippedX ? -1 : 1})`,
              }}
            >
              <img
                src={imageSrc}
                alt={`صورة أشعة ${REGION_LABELS_AR[evaluation.targetRegionScanned]}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Collimation Shutter Mask Layer */}
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

            {/* DICOM Overlay & Crosshair Mask Layer */}
            {overlayMaskEnabled && (
              <>
                <div className="pointer-events-none absolute top-2.5 right-3 z-10 text-[11px] font-mono-num text-cyan-200 text-right leading-relaxed bg-[#040912]/70 px-2 py-1 rounded">
                  <div>{patient.nameAr}</div>
                  <div>{REGION_LABELS_AR[evaluation.targetRegionScanned]}</div>
                </div>
                <div className="pointer-events-none absolute top-2.5 left-3 z-10 text-[11px] font-mono-num text-cyan-200 text-left leading-relaxed bg-[#040912]/70 px-2 py-1 rounded">
                  <div>{kvp} kVp</div>
                  <div>{mas} mAs</div>
                </div>
                <div className="pointer-events-none absolute bottom-2.5 left-3 z-10 text-xs font-mono-num font-bold text-cyan-100 bg-[#040912]/70 px-2 py-0.5 rounded">
                  R · {zoomPct}%
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
                aria-label="تصغير"
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
                aria-label="تكبير"
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
                <span>تدوير</span>
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
                <span>انعكاس</span>
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
                <span>عكس</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT/BOTTOM: Organized View Controls, Mask Controls, and Approval */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Card 1: View Controls */}
          <section className="rounded-xl border border-slate-800 bg-[#0D1624] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <SlidersHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>التحكم بالعرض (View)</span>
              </div>
              <button
                type="button"
                onClick={handleResetViewAndMask}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                إعادة ضبط
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="img-brightness" className="text-slate-300">
                  السطوع (Brightness)
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
                  التباين (Contrast)
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
              <span>التحكم بالقناع (Mask)</span>
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
                <span>قناع التحديد</span>
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
                <span>بيانات القناع</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="mask-aperture" className="text-slate-300">
                  فتحة قناع الحقل (Mask Aperture)
                </label>
                <span className="font-mono-num text-cyan-300 font-semibold">
                  {shutterMaskEnabled ? `${maskAperturePct}%` : 'مفتوح'}
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
                    {evaluation.titleAr}
                  </h4>
                  {evaluation.filmConsumed > 0 && (
                    <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                      -1 فيلم
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {evaluation.feedbackAr}
                </p>
                {evaluation.success && (
                  <p className="pt-1.5 text-xs text-emerald-200 border-t border-emerald-800/50">
                    <span className="font-bold text-emerald-400">
                      التشخيص:{' '}
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
                <span>اعتماد الصورة واستلام</span>
                <span className="font-mono-num">${evaluation.totalEarned}</span>
              </button>
            ) : outOfFilms ? (
              <button
                type="button"
                onClick={onGoToShop}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer transition-colors"
              >
                نفدت الأفلام — اذهب للمتجر لشراء كرتون ($100)
              </button>
            ) : (
              <button
                type="button"
                onClick={onRetake}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>تعديل الإعدادات وإعادة التصوير</span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
