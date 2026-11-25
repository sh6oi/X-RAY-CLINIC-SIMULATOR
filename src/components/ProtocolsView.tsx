import React, {useMemo, useState} from 'react';
import type {BodyRegion, Modality} from '../types/radiology';
import {EXAMS, getRadiographImage} from '../data/radiologyData';
import {
  MODALITY_LABELS_I18N,
  POSTURE_SHORT_I18N,
  REGION_LABELS_I18N,
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
  'chest',
  'head',
  'cervical',
  'lumbar',
  'pelvis',
  'hand',
  'knee',
];

export const ProtocolsView: React.FC = () => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  const [modalityFilter, setModalityFilter] = useState<'ALL' | Modality>('ALL');
  const [regionFilter, setRegionFilter] = useState<'ALL' | BodyRegion>('ALL');

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

  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-slate-800 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {isAr
              ? 'دليل بروتوكولات التصوير الإشعاعي'
              : 'Radiology Imaging Protocols Guide'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {isAr
              ? 'المرجع القياسي لقيم الطاقة (kVp) وكمية الإشعاع (mAs) والوضعيات المعتمدة لجميع فحوصات الأشعة السينية والمقطعية والرنين.'
              : 'Standard reference for kVp, mAs ranges, and recommended patient positioning across X-Ray, CT, and MRI exams.'}
          </p>
        </div>

        <span className="font-mono-num text-xs font-bold text-cyan-300 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-700/50">
          {filteredExams.length} / {EXAMS.length}{' '}
          {isAr ? 'بروتوكول' : 'Protocols'}
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {MODALITY_FILTERS.map((f) => {
            const active = modalityFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setModalityFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
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

        <div className="flex flex-wrap items-center gap-1.5">
          {REGION_KEYS.map((rKey) => {
            const active = regionFilter === rKey;
            const label =
              rKey === 'ALL'
                ? isAr
                  ? 'كل المناطق'
                  : 'All Regions'
                : REGION_LABELS_I18N[lang][rKey];
            return (
              <button
                key={rKey}
                type="button"
                onClick={() => setRegionFilter(rKey)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer border transition-colors ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredExams.map((exam) => (
          <div
            key={exam.id}
            className="rounded-xl border border-slate-800 bg-[#131C29] p-4 sm:p-5 flex gap-4 items-start"
          >
            <div className="w-20 sm:w-24 h-24 sm:h-28 rounded-lg overflow-hidden border border-slate-800 bg-black shrink-0">
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
                    alt={isAr ? exam.titleAr : exam.titleEn}
                    referrerPolicy="no-referrer"
                    style={mirrorX ? {transform: 'scaleX(-1)'} : undefined}
                    className="w-full h-full object-cover"
                  />
                );
              })()}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {isAr ? exam.titleAr : exam.titleEn}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{isAr ? exam.titleEn : exam.titleAr}</span>
                    <span aria-hidden="true">·</span>
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
                  </div>
                </div>
                <span className="font-mono-num text-sm font-bold text-emerald-400 shrink-0">
                  ${exam.baseFee}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">
                    {isAr ? 'الوضعية' : 'Posture'}
                  </div>
                  <div className="mt-0.5 font-medium text-cyan-300 truncate">
                    {POSTURE_SHORT_I18N[lang][exam.recommendedPosture]}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">
                    {isAr ? 'نطاق kVp' : 'kVp Range'}
                  </div>
                  <div className="mt-0.5 font-mono-num font-semibold text-white">
                    {exam.kvpRange[0]} – {exam.kvpRange[1]}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">
                    {isAr ? 'نطاق mAs' : 'mAs Range'}
                  </div>
                  <div className="mt-0.5 font-mono-num font-semibold text-white">
                    {exam.masRange[0]} – {exam.masRange[1]}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300/90 leading-relaxed">
                {isAr
                  ? exam.clinicalTipAr
                  : `Recommended ${POSTURE_SHORT_I18N.en[exam.recommendedPosture]} positioning at ${exam.kvpRange[0]}–${exam.kvpRange[1]} kVp and ${exam.masRange[0]}–${exam.masRange[1]} mAs.`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
