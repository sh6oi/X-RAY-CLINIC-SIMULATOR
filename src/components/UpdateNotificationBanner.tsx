import React, {useState} from 'react';
import {Download, RefreshCw, Sparkles, X} from 'lucide-react';
import {useLanguage} from '../i18n/translations';

interface UpdateNotificationBannerProps {
  visible: boolean;
  remoteVersion: string | null;
  onUpdateNow: () => Promise<void>;
  onDismiss: () => void;
}

export const UpdateNotificationBanner: React.FC<
  UpdateNotificationBannerProps
> = ({visible, remoteVersion, onUpdateNow, onDismiss}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';
  const [updating, setUpdating] = useState(false);

  if (!visible) return null;

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    await onUpdateNow();
  };

  return (
    <div className="pointer-events-none fixed top-3 inset-x-0 z-[95] px-3 flex justify-center">
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-cyan-400/75 bg-[#091828] text-slate-100 shadow-2xl px-3.5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs sm:text-sm font-display font-bold text-white">
                {isAr
                  ? 'يتوفر تحديث جديد للعبة!'
                  : 'New Game Update Available!'}
              </span>
              {remoteVersion && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 font-mono-num text-[10px]">
                  v{remoteVersion}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {isAr
                ? 'حدّث الآن للحصول على أحدث التحسينات والإصلاحات — تقدّمك محفوظ بالكامل.'
                : 'Update now for the latest improvements and fixes — your progress is safely saved.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={updating}
            onClick={() => void handleUpdate()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer transition-all disabled:opacity-70 shadow-lg"
          >
            {updating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Download className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {updating
                ? isAr
                  ? 'جاري التحديث...'
                  : 'Updating...'
                : isAr
                  ? 'تحديث الآن'
                  : 'Update Now'}
            </span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label={isAr ? 'لاحقاً' : 'Later'}
            title={isAr ? 'تذكير لاحقاً' : 'Remind Later'}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
