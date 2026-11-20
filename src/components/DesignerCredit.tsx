import React, {useState} from 'react';
import {Award, Check, Copy, ExternalLink, Instagram, X} from 'lucide-react';
import {DESIGNER_INSTAGRAM_URL, useLanguage} from '../i18n/translations';

interface DesignerCreditProps {
  variant?: 'footer' | 'milestone';
  open?: boolean;
  patientsMilestone?: number;
  onClose?: () => void;
}

export const DesignerCredit: React.FC<DesignerCreditProps> = ({
  variant = 'footer',
  open: controlledOpen = false,
  patientsMilestone = 10,
  onClose,
}) => {
  const {lang} = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAr = lang === 'ar';
  const isMilestone = variant === 'milestone';
  const isOpen = isMilestone ? controlledOpen : internalOpen;

  const handleClose = () => {
    if (isMilestone) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DESIGNER_INSTAGRAM_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <>
      {variant === 'footer' && (
        <button
          type="button"
          onClick={() => setInternalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-[#0E1929] hover:bg-[#13233A] px-3.5 py-2 text-xs font-semibold text-cyan-100 cursor-pointer transition-colors"
        >
          <Instagram className="w-4 h-4 text-pink-400 shrink-0" />
          <span>
            {isAr
              ? 'تم تصميم هذه اللعبة من قبل التدريسي مجتبى كريم'
              : 'Designed by Lecturer Mojtaba Kareem'}
          </span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[75] bg-black/80 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-cyan-600/70 bg-[#0B1422] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Instagram className="w-5 h-5 text-pink-400 shrink-0" />
                <span>
                  {isMilestone
                    ? isAr
                      ? `إنجاز جديد · إتمام فحص ${patientsMilestone} مرضى`
                      : `Milestone · ${patientsMilestone} Patients Completed`
                    : isAr
                      ? 'حساب المصمم على الإنستغرام'
                      : 'Designer Instagram'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isMilestone && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-semibold text-emerald-200">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isAr
                    ? `أحسنت! أكملت فحص ${patientsMilestone} مرضى بنجاح داخل العيادة.`
                    : `Great job! You have completed ${patientsMilestone} patient exams.`}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm sm:text-base font-bold text-cyan-200 leading-relaxed">
                {isAr
                  ? 'تم تصميم هذه اللعبة من قبل التدريسي مجتبى كريم'
                  : 'This game was designed by Lecturer Mojtaba Kareem'}
              </p>
              <div
                dir="ltr"
                className="rounded-xl border border-slate-800 bg-[#070E18] p-3 space-y-1 text-left"
              >
                <div className="text-sm font-mono-num font-bold text-pink-300">
                  @mojtabakr1.sc
                </div>
                <div className="text-[11px] font-mono-num text-slate-400 break-all">
                  {DESIGNER_INSTAGRAM_URL}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={DESIGNER_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>
                  {isAr ? 'الدخول لحساب الإنستغرام' : 'Open Instagram Profile'}
                </span>
              </a>

              <button
                type="button"
                onClick={() => void handleCopy()}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{isAr ? 'نسخ الرابط' : 'Copy Link'}</span>
                  </>
                )}
              </button>
            </div>

            {isMilestone && (
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm cursor-pointer transition-colors"
              >
                {isAr
                  ? 'إغلاق ومتابعة اللعب بشكل طبيعي'
                  : 'Close & Continue Playing'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
