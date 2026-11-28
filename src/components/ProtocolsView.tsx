import React, {useMemo, useState} from 'react';
import type {BodyRegion, Modality} from '../types/radiology';
import {
  EXAMS,
  getEffectiveExamRanges,
  getRadiographImage,
} from '../data/radiologyData';
import {
  MODALITY_LABELS_I18N,
  POSTURE_SHORT_I18N,
  REGION_SHORT_I18N,
  isBilateralRegion,
  useLanguage,
} from '../i18n/translations';

const MODALITY_FILTERS: {
  id: 'ALL' | Modality;
  labelAr: string;
  labelEn: string;
}[] = [
  {id: 'ALL', labelAr: 'الكل', labelEn: 'All'},
  {id: 'XRAY', labelAr: 'أشعة سينية (X-Ray)', labelEn: 'X-Ray'},
  {id: 'CT', labelAr: 'مقطعية (CT)', labelEn: 'CT Scan'},
  {id: 'MRI', labelAr: 'رنين مغناطيسي (MRI)', labelEn: 'MRI'},
];

const REGION_KEYS: ('ALL' | BodyRegion)[] = [
  'ALL',
  'head',
  'facial_bones',
  'nasal_bones',
  'soft_tissue_neck',
  'cervical',
  'thoracic',
  'lumbar',
  'chest',
  'ribs',
  'abdomen',
  'shoulder',
  'clavicle',
  'humerus',
  'elbow',
  'forearm',
  'wrist',
  'hand',
  'pelvis',
  'sacrum_coccyx',
  'hip',
  'femur',
  'knee',
  'tibia_fibula',
  'ankle',
  'foot',
  'toes',
];

export const ProtocolsView: React.FC = () => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  const [modalityFilter, setModalityFilter] = useState<'ALL' | Modality>('ALL');
  const [regionFilter, setRegionFilter] = useState<'ALL' | BodyRegion>('ALL');
  const [ageGroup, setAgeGroup] = useState<'ADULT' | 'PEDIATRIC'>('ADULT');

  const filteredExams = useMemo(
    () =>
      EXAMS.filter((exam) => {
        if (modalityFilter !== 'ALL' && exam.modality !== modalityFilter) {
          return false;
        }
        if (regionFilter !== 'ALL' && exam.region !== regionFilter) {
          return false;
        }
        return true;
      }),
    [modalityFilter, regionFilter]
  );

  const sampleAge = ageGroup === 'PEDIATRIC' ? 8 : 30;

  return (
    <div className="space-y-4">
      <div className="hud-view-header pb-3 border-b border-slate-800 flex flex-wrap items-end justify-between gap-2.5">
        <div>
          <h2 className="hud-view-title text-lg sm:text-2xl font-bold text-white">
            {isAr
              ? 'دليل بروتوكولات التصوير الإشعاعي'
              : 'Radiology Imaging Protocols Guide'}
          </h2>
          <p className="hud-view-sub mt-0.5 text-xs sm:text-sm text-slate-400">
            {isAr
              ? 'المرجع القياسي لقيم الطاقة (kVp) وكمية الإشعاع (mAs) للأشعة والمفراس، والموجات الراديوية (RF) للرنين المغناطيسي.'
              : 'Clinical kVp/mAs for X-Ray & CT, and Radiofrequency (RF) parameters for MRI across all 26 regions.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Adult vs Pediatric Toggle */}
          <div className="flex items-center rounded-lg border border-slate-700 bg-[#0F1723] p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setAgeGroup('ADULT')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                ageGroup === 'ADULT'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {isAr ? 'البالغون (≥14)' : 'Adults (≥14)'}
            </button>
            <button
              type="button"
              onClick={() => setAgeGroup('PEDIATRIC')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                ageGroup === 'PEDIATRIC'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {isAr ? 'الأطفال (<14)' : 'Pediatrics (<14)'}
            </button>
          </div>

          <span className="font-mono-num text-[11px] font-bold text-cyan-300 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-700/50">
            {filteredExams.length}/{EXAMS.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {MODALITY_FILTERS.map((f) => {
            const active = modalityFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setModalityFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold cursor-pointer border transition-colors ${
                  active
                    ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                    : 'bg-[#121B29] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                {isAr ? f.labelAr : f.labelEn}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {REGION_KEYS.map((rKey) => {
            const active = regionFilter === rKey;
            const label =
              rKey === 'ALL'
                ? isAr
                  ? 'كل المناطق (26)'
                  : 'All Regions (26)'
                : REGION_SHORT_I18N[lang][rKey];
            return (
              <button
                key={rKey}
                type="button"
                onClick={() => setRegionFilter(rKey)}
                className={`px-2.5 py-1 rounded-md text-[10.5px] sm:text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                  active
                    ? 'bg-slate-100 border-white text-slate-950 font-bold'
                    : 'bg-[#0F1723] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hud-protocols-grid grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {filteredExams.map((exam) => {
          const ranges = getEffectiveExamRanges(exam, sampleAge);
          const bilateral = Boolean(
            exam.sideRequired || isBilateralRegion(exam.region)
          );
          return (
            <div
              key={exam.id}
              className="hud-protocol-card rounded-xl border border-slate-800 bg-[#131C29] p-3 sm:p-4 flex gap-3 items-start"
            >
              <div className="hud-protocol-thumb w-16 sm:w-20 h-20 sm:h-24 rounded-lg overflow-hidden border border-slate-800 bg-black shrink-0">
                {(() => {
                  const {src, mirrorX} = getRadiographImage({
                    region: exam.region,
                    modality: exam.modality,
                    projection: exam.recommendedProjection,
                    posture: exam.recommendedPosture,
                  });
                  return (
                    <img
                      src={src}
                      alt={exam.titleEn}
                      referrerPolicy="no-referrer"
                      style={mirrorX ? {transform: 'scaleX(-1)'} : undefined}
                      className="w-full h-full object-cover"
                    />
                  );
                })()}
              </div>

              <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      dir="ltr"
                      className={`text-xs sm:text-sm font-bold text-white leading-snug truncate ${isAr ? 'text-right' : 'text-left'}`}
                    >
                      {exam.titleEn}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
                      <span
                        className={
                          exam.modality === 'MRI'
                            ? 'text-emerald-400 font-semibold'
                            : exam.modality === 'CT'
                              ? 'text-amber-300 font-semibold'
                              : 'text-cyan-300 font-semibold'
                        }
                      >
                        {MODALITY_LABELS_I18N[lang][exam.modality]}
                      </span>
                      {bilateral && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 font-bold text-[9.5px]">
                          {isAr ? 'يتطلب يمين/يسار' : 'R/L Side'}
                        </span>
                      )}
                      {ageGroup === 'PEDIATRIC' && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/35 text-amber-200 font-bold text-[9.5px]">
                          {isAr ? 'أطفال' : 'Pediatric'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono-num text-xs sm:text-sm font-bold text-emerald-400 shrink-0">
                    ${exam.baseFee}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800/80 text-[10.5px] sm:text-xs">
                  <div>
                    <div className="text-slate-400 text-[9.5px] sm:text-[10.5px]">
                      {isAr ? 'الوضعية' : 'Posture'}
                    </div>
                    <div className="mt-0.5 font-medium text-cyan-300 truncate">
                      {POSTURE_SHORT_I18N[lang][exam.recommendedPosture]}
                    </div>
                  </div>
                  {exam.modality === 'MRI' ? (
                    <>
                      <div>
                        <div className="text-slate-400 text-[9.5px] sm:text-[10.5px]">
                          {isAr ? 'الموجات الراديوية' : 'RF Pulse'}
                        </div>
                        <div className="mt-0.5 font-mono-num font-semibold text-emerald-300 truncate">
                          {exam.rfFrequencyMhz ?? 63.9} MHz
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[9.5px] sm:text-[10.5px]">
                          {isAr ? 'المجال / التسلسل' : 'Field / Seq'}
                        </div>
                        <div className="mt-0.5 font-mono-num font-semibold text-white truncate">
                          {exam.magneticFieldTesla ?? 1.5}T RF
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-slate-400 text-[9.5px] sm:text-[10.5px]">
                          {isAr ? 'نطاق kVp' : 'kVp Range'}
                        </div>
                        <div className="mt-0.5 font-mono-num font-semibold text-white">
                          {ranges.kvpRange[0]}–{ranges.kvpRange[1]}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[9.5px] sm:text-[10.5px]">
                          {isAr ? 'نطاق mAs' : 'mAs Range'}
                        </div>
                        <div className="mt-0.5 font-mono-num font-semibold text-white">
                          {ranges.masRange[0]}–{ranges.masRange[1]}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-[10.5px] sm:text-xs text-slate-300/90 leading-snug line-clamp-2">
                  {exam.modality === 'MRI'
                    ? isAr
                      ? exam.clinicalTipAr
                      : `MRI operates using ${exam.rfFrequencyMhz ?? 63.9} MHz Radiofrequency (RF) waves in a ${exam.magneticFieldTesla ?? 1.5}T magnetic field (no kVp or mAs X-ray radiation) — ${exam.rfSequence ?? 'T1 / T2 RF'}.`
                    : isAr
                      ? ageGroup === 'PEDIATRIC'
                        ? `جرعة الأطفال المخفّضة: ${ranges.kvpRange[0]}–${ranges.kvpRange[1]} kVp و ${ranges.masRange[0]}–${ranges.masRange[1]} mAs. ${exam.clinicalTipAr}`
                        : exam.clinicalTipAr
                      : `Recommended ${POSTURE_SHORT_I18N.en[exam.recommendedPosture]} positioning at ${ranges.kvpRange[0]}–${ranges.kvpRange[1]} kVp and ${ranges.masRange[0]}–${ranges.masRange[1]} mAs.`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
