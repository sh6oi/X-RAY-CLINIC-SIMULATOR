import React, {useState} from 'react';
import {Download, RefreshCw, ShieldCheck, Sparkles} from 'lucide-react';
import {useLanguage} from '../i18n/translations';

interface UpdateNotificationBannerProps {
  visible: boolean;
  remoteVersion: string | null;
  onUpdateNow: () => Promise<void>;
  onDismiss?: () => void;
}

export const UpdateNotificationBanner: React.FC<
  UpdateNotificationBannerProps
> = ({visible, remoteVersion, onUpdateNow}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';
  const [updating, setUpdating] = useState(false);

  if (!visible) return null;

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      await onUpdateNow();
    } finally {
      window.setTimeout(() => setUpdating(false), 3500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] bg-[#040912]/96 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-cyan-400/75 bg-gradient-to-b from-[#0C1A2C] to-[#08101C] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.9)] p-5 sm:p-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.25)]">
          <Sparkles className="w-7 h-7 text-cyan-300" />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="text-lg sm:text-xl font-display font-bold text-white">
              {isAr ? 'يتوفر تحديث إجباري جديد!' : 'Mandatory Update Required'}
            </h2>
            {remoteVersion && (
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-mono-num text-xs font-semibold">
                v{remoteVersion}
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {isAr
              ? 'تم إصدار نسخة جديدة من اللعبة. يجب تحديث اللعبة الآن للمتابعة — لا يمكن إكمال اللعب قبل إتمام التحديث.'
              : 'A new version of the game is available. You must update now to continue — gameplay is locked until updated.'}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/25 px-3 py-2 flex items-center justify-center gap-2 text-[11px] sm:text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            {isAr
              ? 'تقدّمك وعيادتك محفوظان بالكامل ولن يضيع أي شيء.'
              : 'Your clinic and progress are safely saved.'}
          </span>
        </div>

        <button
          type="button"
          disabled={updating}
          onClick={() => void handleUpdate()}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-75 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
        >
          {updating ? (
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Download className="w-4 h-4 shrink-0" />
          )}
          <span>
            {updating
              ? isAr
                ? 'جاري التحديث وإعادة التشغيل...'
                : 'Updating & Reloading...'
              : isAr
                ? 'تحديث اللعبة الآن'
                : 'Update Game Now'}
          </span>
        </button>
      </div>
    </div>
  );
};
