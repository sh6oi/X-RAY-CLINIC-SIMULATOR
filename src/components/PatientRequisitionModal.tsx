import React, {useEffect} from 'react';
import {FileText, X} from 'lucide-react';
import type {ExamProtocol, PatientCase} from '../types/radiology';
import {
  POSTURE_LABELS_I18N,
  SIDE_LABELS_I18N,
  isBilateralRegion,
  useLanguage,
} from '../i18n/translations';

interface PatientRequisitionModalProps {
  isOpen: boolean;
  patient: PatientCase | null;
  requestedExam: ExamProtocol;
  onClose: () => void;
}

export const PatientRequisitionModal: React.FC<PatientRequisitionModalProps> = ({
  isOpen,
  patient,
  requestedExam,
  onClose,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !patient) return null;

  const showSide =
    isBilateralRegion(requestedExam.region) &&
    patient.requestedSide &&
    patient.requestedSide !== 'NONE';

  const postureLabelEn = POSTURE_LABELS_I18N.en[requestedExam.recommendedPosture];

  return (
    <div
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-2 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'ورقة طلب الفحص الإشعاعي' : 'Radiology Exam Requisition'}
        className="w-full max-w-[440px] max-h-[calc(var(--stage-h,100vh)-1rem)] flex flex-col rounded-2xl border-2 border-slate-300 bg-[#FAF7EE] text-slate-900 shadow-[0_26px_70px_rgba(0,0,0,0.85)] overflow-hidden"
      >
        {/* Top Medical Slip Header Bar */}
        <div className="shrink-0 px-4 py-2.5 bg-[#0E3A5D] text-white flex items-center justify-between gap-2 border-b-4 border-cyan-500">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/25 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-cyan-200" />
            </div>
            <div
              dir="ltr"
              className="text-xs sm:text-sm font-extrabold tracking-wide uppercase truncate text-left"
            >
              RADIOLOGY ORDER
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق الورقة' : 'Close Requisition'}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper Body — Exam Name + Patient Posture */}
        <div className="p-4 sm:p-5 space-y-3 bg-[linear-gradient(to_bottom,rgba(14,58,93,0.03)_1px,transparent_1px)] bg-[length:100%_26px]">
          <div className="rounded-xl border-2 border-[#0E3A5D]/80 bg-[#EFF7FC] p-4 space-y-2 shadow-sm text-center">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0E3A5D]">
              {isAr ? 'اسم الفحص المطلوب' : 'Requested Examination'}
            </div>

            <div
              dir="ltr"
              className="text-lg sm:text-2xl font-black text-slate-950 tracking-tight leading-snug"
            >
              {requestedExam.titleEn}
            </div>

            {showSide && (
              <div className="pt-0.5">
                <span
                  dir="ltr"
                  className="inline-block px-3 py-0.5 rounded-md border border-cyan-700/40 bg-cyan-100 text-cyan-950 font-extrabold text-xs"
                >
                  {SIDE_LABELS_I18N.en[patient.requestedSide]}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-center space-y-1">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
              {isAr ? 'وضعية المريض' : 'Patient Posture'}
            </div>
            <div
              dir="ltr"
              className="text-sm sm:text-base font-extrabold text-[#0E3A5D]"
            >
              {postureLabelEn}
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="shrink-0 px-4 py-2.5 border-t border-slate-200 bg-[#F3EFE2] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0E3A5D] hover:bg-[#134E7D] text-white font-bold text-xs sm:text-sm cursor-pointer transition-colors shadow"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
