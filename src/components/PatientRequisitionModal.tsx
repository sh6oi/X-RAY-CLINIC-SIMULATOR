import React, {useEffect} from 'react';
import {
  ClipboardCheck,
  FileText,
  ShieldAlert,
  Stethoscope,
  X,
} from 'lucide-react';
import type {ExamProtocol, PatientCase} from '../types/radiology';
import {isPediatricPatientAge} from '../data/radiologyData';
import {
  POSTURE_SHORT_I18N,
  SIDE_LABELS_I18N,
  isBilateralRegion,
  useLanguage,
} from '../i18n/translations';
import {useStageScroll} from '../hooks/useStageScroll';

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
  const {scrollRef, scrollHandlers} = useStageScroll<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !patient) return null;

  const isChild = isPediatricPatientAge(patient.age);
  const showSide =
    isBilateralRegion(requestedExam.region) &&
    patient.requestedSide &&
    patient.requestedSide !== 'NONE';

  const slipCode = patient.id.replace(/^pt-/, '').slice(-6).toUpperCase();

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
        className="w-full max-w-[520px] max-h-[calc(100dvh-1rem)] flex flex-col rounded-2xl border-2 border-slate-300 bg-[#FAF7EE] text-slate-900 shadow-[0_26px_70px_rgba(0,0,0,0.85)] overflow-hidden"
      >
        {/* Top Medical Slip Header Bar */}
        <div className="shrink-0 px-4 py-3 bg-[#0E3A5D] text-white flex items-center justify-between gap-2 border-b-4 border-cyan-500">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/25 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-cyan-200" />
            </div>
            <div className="min-w-0">
              <div
                dir="ltr"
                className="text-xs sm:text-sm font-extrabold tracking-wide uppercase truncate text-left"
              >
                RADIOLOGY REQUISITION FORM
              </div>
              <div className="text-[10.5px] text-cyan-200 truncate">
                {isAr
                  ? 'ورقة طلب الفحص الطبي المحوّلة من الطبيب'
                  : 'Official Physician Diagnostic Imaging Order'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق الورقة' : 'Close Requisition'}
            className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Paper Body */}
        <div
          ref={scrollRef}
          {...scrollHandlers}
          className="stage-scroll-area flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 bg-[linear-gradient(to_bottom,rgba(14,58,93,0.03)_1px,transparent_1px)] bg-[length:100%_26px]"
        >
          {/* Slip Reference + Urgent / Pediatric Tags */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300 text-[11px]">
            <div className="font-mono-num font-bold text-slate-600" dir="ltr">
              ORDER #{slipCode} · {requestedExam.modality}
            </div>
            <div className="flex items-center gap-1.5">
              {patient.isUrgent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-500/60 bg-rose-100 text-rose-800 font-bold text-[10px]">
                  <ShieldAlert className="w-3 h-3" />
                  {isAr ? 'حالة عاجلة STAT' : 'STAT URGENT'}
                </span>
              )}
              {isChild && (
                <span className="px-2 py-0.5 rounded border border-amber-500/60 bg-amber-100 text-amber-900 font-bold text-[10px]">
                  {isAr ? 'مريض طفل (Pediatric)' : 'PEDIATRIC'}
                </span>
              )}
            </div>
          </div>

          {/* Patient Identification Block */}
          <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-300 bg-white/85 p-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {isAr ? 'اسم المريض' : 'Patient Name'}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5">
                {patient.nameAr}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {isAr ? 'العمر / الجنس' : 'Age / Sex'}
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5 font-mono-num">
                {patient.age} {isAr ? 'سنة' : 'yrs'} ·{' '}
                {patient.gender === 'F'
                  ? isAr
                    ? 'أنثى'
                    : 'Female'
                  : isAr
                    ? 'ذكر'
                    : 'Male'}
              </div>
            </div>
          </div>

          {/* Highlighted Requested Exam Name (Always in English) */}
          <div className="rounded-xl border-2 border-[#0E3A5D]/80 bg-[#EFF7FC] p-3.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0E3A5D]">
                {isAr ? 'اسم الفحص المطلوب (Requested Exam)' : 'Requested Examination'}
              </span>
              <span className="font-mono-num text-[10px] font-bold px-2 py-0.5 rounded bg-[#0E3A5D] text-white">
                {requestedExam.modality}
              </span>
            </div>

            <div
              dir="ltr"
              className="text-base sm:text-xl font-black text-slate-950 tracking-tight text-left leading-snug"
            >
              {requestedExam.titleEn}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {showSide && (
                <span
                  dir="ltr"
                  className="px-2.5 py-0.5 rounded-md border border-cyan-700/40 bg-cyan-100 text-cyan-950 font-extrabold text-[11px]"
                >
                  Side: {SIDE_LABELS_I18N.en[patient.requestedSide]}
                </span>
              )}
              <span
                dir="ltr"
                className="px-2.5 py-0.5 rounded-md border border-slate-400/50 bg-white text-slate-800 font-bold text-[11px]"
              >
                Posture: {POSTURE_SHORT_I18N.en[requestedExam.recommendedPosture]}
              </span>
            </div>
          </div>

          {/* Clinical Complaint / Indication */}
          <div className="rounded-xl border border-slate-300 bg-white/85 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-600">
              <Stethoscope className="w-3.5 h-3.5 text-[#0E3A5D]" />
              <span>{isAr ? 'الشكوى السريرية وسبب الفحص:' : 'Clinical Indication:'}</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
              {patient.complaintAr}
            </p>
          </div>

          {/* Official Medical Stamp & Signature Footer */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-300 text-[10.5px] text-slate-600">
            <div className="flex items-center gap-1.5 font-semibold">
              <ClipboardCheck className="w-4 h-4 text-emerald-700" />
              <span>
                {isAr ? 'اعتماد طبيب الإحالة المناوب' : 'Attending Physician Order Verified'}
              </span>
            </div>
            <div
              dir="ltr"
              className="px-2 py-0.5 rounded border-2 border-emerald-700/50 text-emerald-800 font-mono-num font-black text-[10px] tracking-wider uppercase -rotate-2"
            >
              CLINIC APPROVED
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
            {isAr ? 'إغلاق الورقة' : 'Close Order Slip'}
          </button>
        </div>
      </div>
    </div>
  );
};
