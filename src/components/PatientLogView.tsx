import React from 'react';
import {FileText} from 'lucide-react';
import type {CompletedCase} from '../types/radiology';
import {
  EXAMS,
  PATIENT_AVATARS,
  REGION_SCAN_IMAGES,
  isPediatricPatientAge,
} from '../data/radiologyData';
import {SIDE_SHORT_I18N, useLanguage} from '../i18n/translations';

const resolveEnglishExamTitle = (rawTitle: string): string => {
  const match = EXAMS.find(
    (e) => e.titleAr === rawTitle || e.titleEn === rawTitle
  );
  return match ? match.titleEn : rawTitle;
};

interface PatientLogViewProps {
  cases: CompletedCase[];
  totalRevenue: number;
  retakesCount: number;
}

export const PatientLogView: React.FC<PatientLogViewProps> = ({
  cases,
  totalRevenue,
  retakesCount,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="hud-view-header flex flex-wrap items-end justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div>
          <h2 className="hud-view-title text-lg sm:text-2xl font-bold text-white">
            {isAr ? 'سجل الحالات والفحوصات المنجزة' : 'Completed Exams & Patient Log'}
          </h2>
          <p className="hud-view-sub mt-0.5 text-xs sm:text-sm text-slate-400">
            {isAr
              ? 'أرشيف الفحوصات الإشعاعية وصور المرضى التي تم اعتماد تقاريرها في العيادة.'
              : 'Archive of diagnostic radiographs and patient reports completed and approved.'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-300">
          <div>
            <span className="text-slate-400">
              {isAr ? 'إجمالي الإيرادات: ' : 'Total Revenue: '}
            </span>
            <span className="font-mono-num font-bold text-emerald-400">
              ${totalRevenue.toLocaleString('en-US')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">
              {isAr ? 'إعادات التصوير: ' : 'Retakes: '}
            </span>
            <span className="font-mono-num font-bold text-amber-300">
              {retakesCount}
            </span>
          </div>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#131C29] p-8 sm:p-12 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm sm:text-base font-medium text-slate-300">
            {isAr ? 'لا توجد حالات مسجلة بعد' : 'No completed cases recorded yet'}
          </p>
          <p className="text-xs text-slate-500">
            {isAr
              ? 'ابدأ باستقبال المريض الأول في غرفة التصوير لتظهر التقارير والصور هنا.'
              : 'Start examining your first patient in the X-Ray room to build your archive.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#131C29] overflow-x-auto">
          <table
            className={`hud-log-table w-full border-collapse ${isAr ? 'text-right' : 'text-left'}`}
          >
            <thead>
              <tr className="border-b border-slate-800 text-[11px] sm:text-xs text-slate-400">
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-medium">
                  {isAr ? 'المريض' : 'Patient'}
                </th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-medium">
                  {isAr ? 'صورة الفحص' : 'Exam Image'}
                </th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-medium">
                  {isAr ? 'إعدادات التعريض' : 'Exposure'}
                </th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-medium">
                  {isAr ? 'النتيجة التشخيصية' : 'Diagnostic Finding'}
                </th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-medium">
                  {isAr ? 'الرسوم' : 'Fee'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
              {cases.map((c) => {
                const isChild = isPediatricPatientAge(c.patientAge);
                const sideText =
                  c.sideUsed && c.sideUsed !== 'NONE'
                    ? SIDE_SHORT_I18N[lang][c.sideUsed]
                    : '';
                return (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-medium text-white whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={c.patientAvatarPath || PATIENT_AVATARS.manYoung}
                          alt={c.patientNameAr}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                        />
                        <div className="flex items-center gap-1.5">
                          <span>{c.patientNameAr}</span>
                          {isChild && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[9.5px] font-bold">
                              {isAr ? 'طفل' : 'Peds'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <img
                          src={c.examImagePath || REGION_SCAN_IMAGES.chest}
                          alt={resolveEnglishExamTitle(c.examTitleAr)}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-md object-cover border border-slate-800 bg-black shrink-0"
                        />
                        <span dir="ltr">
                          {resolveEnglishExamTitle(c.examTitleAr)}
                          {sideText ? ` (${sideText})` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-mono-num text-[11px] sm:text-xs text-cyan-300 whitespace-nowrap">
                      {c.modality === 'MRI'
                        ? '1.5T · 63.9 MHz RF'
                        : `${c.kvpUsed} kVp · ${c.masUsed} mAs`}
                      {c.shieldUsed && c.modality !== 'MRI'
                        ? isAr
                          ? ' · حماية'
                          : ' · Shield'
                        : ''}
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-[11px] sm:text-xs text-slate-300 max-w-md">
                      {c.findingAr}
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-mono-num font-bold text-emerald-400 whitespace-nowrap">
                      +${c.earned}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
