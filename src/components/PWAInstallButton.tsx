import React, {useState} from 'react';
import {Download, Share, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {useLanguage} from '../i18n/translations';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title={isAr ? 'تثبيت اللعبة كتطبيق' : 'Install as App'}
        className={`flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer transition-colors shadow-sm ${
          compact
            ? 'px-1.5 sm:px-2 py-1 text-[10.5px] sm:text-xs'
            : 'px-3 py-2 text-xs'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>
          {isAr ? 'تثبيت التطبيق' : 'Install App'}
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title={isAr ? 'إضافة للشاشة الرئيسية' : 'Add to Home Screen'}
          className={`flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-bold cursor-pointer transition-colors ${
            compact
              ? 'px-1.5 sm:px-2 py-1 text-[10.5px] sm:text-xs'
              : 'px-3 py-2 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className={compact ? 'hidden sm:inline' : ''}>
            {isAr ? 'تثبيت على iPhone' : 'Install on iOS'}
          </span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-[#0A1320] p-5 text-slate-100 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src="./apple-touch-icon.png"
                    alt="X-Ray Clinic Simulator"
                    className="w-10 h-10 rounded-xl border border-amber-400/50 object-cover"
                  />
                  <h3 className="text-sm sm:text-base font-display font-bold text-white">
                    {isAr
                      ? 'تثبيت اللعبة على الشاشة الرئيسية'
                      : 'Install on iPhone / iPad'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
                {isAr ? (
                  <>
                    1. اضغط على زر <strong>المشاركة</strong>{' '}
                    <Share className="inline w-3.5 h-3.5 text-cyan-300 mx-0.5" />{' '}
                    في شريط متصفح Safari.
                    <br />
                    2. مرر للأسفل واختر{' '}
                    <strong>إضافة إلى الصفحة الرئيسية</strong> (Add to Home
                    Screen).
                  </>
                ) : (
                  <>
                    1. Tap the <strong>Share</strong> button in Safari toolbar.
                    <br />
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 py-2 text-xs sm:text-sm font-bold text-slate-950 cursor-pointer transition-colors"
              >
                {isAr ? 'فهمت' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
