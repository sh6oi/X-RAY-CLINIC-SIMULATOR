import React, {useState} from 'react';
import {Check, Copy, ExternalLink, Instagram, X} from 'lucide-react';
import {DESIGNER_INSTAGRAM_URL, useLanguage} from '../i18n/translations';

interface DesignerCreditProps {
  variant?: 'floating' | 'footer';
}

export const DesignerCredit: React.FC<DesignerCreditProps> = ({
  variant = 'floating',
}) => {
  const {lang} = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAr = lang === 'ar';

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
      {variant === 'floating' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hud-credit-badge pointer-events-auto fixed bottom-[138px] right-2 sm:bottom-5 sm:left-5 sm:right-auto z-20 flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-[#08121E]/95 hover:bg-[#0D1D31] px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-cyan-100 shadow-lg cursor-pointer transition-colors max-w-[54vw] sm:max-w-xs"
          title={
            isAr
              ? 'اضغط لعرض حساب الإنستغرام للمصمم'
              : 'Click to view designer Instagram'
          }
        >
          <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          <span className="truncate">
            {isAr
              ? 'تم تصميم هذه اللعبة من قبل التدريسي مجتبى كريم'
              : 'Designed by Lecturer Mojtaba Kareem'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
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

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-cyan-700/70 bg-[#0B1422] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Instagram className="w-5 h-5 text-pink-400 shrink-0" />
                <span>
                  {isAr ? 'حساب المصمم على الإنستغرام' : 'Designer Instagram'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-cyan-200 leading-relaxed">
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
                  {isAr ? 'فتح حساب الإنستغرام' : 'Open Instagram Profile'}
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
          </div>
        </div>
      )}
    </>
  );
};
