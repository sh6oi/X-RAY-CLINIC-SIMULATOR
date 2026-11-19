import React, {useMemo, useState} from 'react';
import type {BodyRegion, Modality} from '../types/radiology';
import {EXAMS, REGION_LABELS_AR} from '../data/radiologyData';

const MODALITY_FILTERS: {id: 'ALL' | Modality; label: string}[] = [
  {id: 'ALL', label: 'الكل'},
  {id: 'XRAY', label: 'أشعة سينية (X-Ray)'},
  {id: 'CT', label: 'مقطعية (CT)'},
  {id: 'MRI', label: 'رنين مغناطيسي (MRI)'},
];

const REGION_FILTERS: {id: 'ALL' | BodyRegion; label: string}[] = [
  {id: 'ALL', label: 'كل المناطق'},
  {id: 'chest', label: REGION_LABELS_AR.chest},
  {id: 'head', label: REGION_LABELS_AR.head},
  {id: 'cervical', label: REGION_LABELS_AR.cervical},
  {id: 'lumbar', label: REGION_LABELS_AR.lumbar},
  {id: 'pelvis', label: REGION_LABELS_AR.pelvis},
  {id: 'hand', label: REGION_LABELS_AR.hand},
  {id: 'knee', label: REGION_LABELS_AR.knee},
];

export const ProtocolsView: React.FC = () => {
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
            دليل بروتوكولات التصوير الإشعاعي
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            المرجع القياسي لقيم الطاقة (kVp) وكمية الإشعاع (mAs) والوضعيات المعتمدة لجميع فحوصات الأشعة السينية والمقطعية والرنين.
          </p>
        </div>

        <span className="font-mono-num text-xs font-bold text-cyan-300 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-700/50">
          {filteredExams.length} / {EXAMS.length} بروتوكول
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
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {REGION_FILTERS.map((r) => {
            const active = regionFilter === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegionFilter(r.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer border transition-colors ${
                  active
                    ? 'bg-slate-100 border-white text-slate-950 font-bold'
                    : 'bg-[#0F1723] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
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
              <img
                src={exam.imagePath}
                alt={exam.titleAr}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {exam.titleAr}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{exam.titleEn}</span>
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
                      {exam.modalityLabelAr}
                    </span>
                  </div>
                </div>
                <span className="font-mono-num text-sm font-bold text-emerald-400 shrink-0">
                  ${exam.baseFee}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">الوضعية</div>
                  <div className="mt-0.5 font-medium text-cyan-300 truncate">
                    {exam.postureLabelAr}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">نطاق kVp</div>
                  <div className="mt-0.5 font-mono-num font-semibold text-white">
                    {exam.kvpRange[0]} – {exam.kvpRange[1]}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">نطاق mAs</div>
                  <div className="mt-0.5 font-mono-num font-semibold text-white">
                    {exam.masRange[0]} – {exam.masRange[1]}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300/90 leading-relaxed">
                {exam.clinicalTipAr}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
