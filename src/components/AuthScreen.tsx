import React, {useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Languages,
  Lock,
  LogIn,
  Mail,
  User,
  UserPlus,
} from 'lucide-react';
import {
  CLINIC_ROOM_IMAGE,
  FILM_CARTON_COST,
  FILM_CARTON_SIZE,
  PATIENT_AVATARS,
  REGION_SCAN_IMAGES,
} from '../data/radiologyData';
import {
  loginTechAccount,
  mapFirebaseAuthError,
  registerTechAccount,
  sendTechPasswordReset,
  type AuthResult,
} from '../firebase';
import type {ClinicSaveState} from '../types/radiology';
import {useLanguage} from '../i18n/translations';

interface AuthScreenProps {
  initialSave: ClinicSaveState;
  onAuthenticated: (result: AuthResult) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialSave,
  onAuthenticated,
}) => {
  const {lang, toggleLang} = useLanguage();
  const isAr = lang === 'ar';

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RESET'>('REGISTER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [heroError, setHeroError] = useState(false);

  const switchMode = (next: 'LOGIN' | 'REGISTER' | 'RESET') => {
    setMode(next);
    setErrorMsg(null);
    setResetSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccessMsg(null);

    if (mode === 'REGISTER' && name.trim().length < 2) {
      setErrorMsg(
        isAr
          ? 'يرجى إدخال الاسم الكامل لتقني الأشعة (حرفين على الأقل).'
          : 'Please enter the radiographer full name (at least 2 characters).'
      );
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(
        isAr
          ? 'يرجى إدخال بريد إلكتروني صحيح.'
          : 'Please enter a valid email address.'
      );
      return;
    }

    if (mode === 'RESET') {
      setLoading(true);
      try {
        await sendTechPasswordReset(email, lang);
        setResetSuccessMsg(
          isAr
            ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح. يرجى التحقق من صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam).'
            : 'Password reset link sent to your email. Please check your inbox or spam folder.'
        );
      } catch (err) {
        setErrorMsg(mapFirebaseAuthError(err, lang));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg(
        isAr
          ? 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.'
          : 'Password must be at least 6 characters long.'
      );
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === 'REGISTER'
          ? await registerTechAccount({
              name,
              email,
              password,
              initialSave,
            })
          : await loginTechAccount({
              email,
              password,
            });
      onAuthenticated(result);
    } catch (err) {
      setErrorMsg(mapFirebaseAuthError(err, lang));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0B111A] text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800/90 bg-[#0D1520]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-8">
          <span className="text-sm sm:text-lg font-display font-bold text-white whitespace-nowrap shrink-0">
            {isAr
              ? 'عيادة الأشعة التخصصية'
              : 'Specialized Radiology Clinic'}
          </span>
          <div className="hidden lg:flex items-center gap-6 text-sm text-slate-400">
            <span>
              {isAr ? 'حفظ سحابي تلقائي للتقدم' : 'Auto cloud progress saving'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isAr
                ? 'نظام CR ثم التطوير إلى DR'
                : 'CR Cassette & Digital DR Workflow'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isAr ? 'محاكاة ثلاثية الأبعاد' : '3D Clinic Simulation'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 font-bold text-xs whitespace-nowrap cursor-pointer transition-colors"
            >
              <Languages className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                switchMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')
              }
              className="px-3 sm:px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs whitespace-nowrap cursor-pointer transition-colors"
            >
              {mode === 'LOGIN'
                ? isAr
                  ? 'إنشاء حساب جديد'
                  : 'Create Account'
                : isAr
                  ? 'لدي حساب مسبق'
                  : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center py-3 sm:py-5 px-3 sm:px-6">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 min-[600px]:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Form Column */}
          <div className="min-[600px]:col-span-6 lg:col-span-5 rounded-2xl border border-slate-800 bg-[#111A27] p-4 sm:p-6 flex flex-col justify-between gap-4">
            <div className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5 sm:space-y-2">
                <h1 className="text-xl sm:text-3xl font-display font-bold text-white [text-wrap:balance]">
                  {mode === 'REGISTER'
                    ? isAr
                      ? 'إنشاء حساب تقني الأشعة'
                      : 'Create Radiographer Account'
                    : mode === 'RESET'
                      ? isAr
                        ? 'إعادة تعيين كلمة المرور'
                        : 'Reset Password'
                      : isAr
                        ? 'تسجيل الدخول إلى عيادتك'
                        : 'Sign In to Your Clinic'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {mode === 'REGISTER'
                    ? isAr
                      ? 'سجّل اسمك وبريدك الإلكتروني ليتم حفظ رصيدك والأفلام والأجهزة في السحابة والعودة لها في أي وقت.'
                      : 'Register with your name and email so your cash, films, and clinic equipment stay saved in the cloud.'
                    : mode === 'RESET'
                      ? isAr
                        ? 'اكتب بريدك الإلكتروني المسجّل وسنرسل لك رابطاً عبر البريد الإلكتروني لإعادة تعيين كلمة المرور.'
                        : 'Enter your registered email address and we will send a password reset link to your inbox.'
                      : isAr
                        ? 'أدخل بريدك الإلكتروني وكلمة المرور لاستعادة عيادتك وإكمال التقدم من حيث توقفت.'
                        : 'Enter your email and password to restore your clinic and continue where you left off.'}
                </p>
              </div>

              {/* Segmented Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0B111A] border border-slate-800">
                <button
                  type="button"
                  onClick={() => switchMode('REGISTER')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    mode === 'REGISTER'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? 'إنشاء حساب جديد' : 'Register'}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('LOGIN')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    mode === 'LOGIN'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? 'تسجيل الدخول' : 'Sign In'}
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-amber-600/60 bg-amber-950/35 p-3.5 flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {resetSuccessMsg && (
                <div className="rounded-lg border border-emerald-500/60 bg-emerald-950/35 p-3.5 flex items-start gap-2.5 text-xs text-emerald-200 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{resetSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
                {mode === 'REGISTER' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="tech-name"
                      className="block text-xs font-medium text-slate-300"
                    >
                      {isAr ? 'الاسم الكامل' : 'Full Name'}
                    </label>
                    <div className="relative">
                      <User
                        className={`w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                          isAr ? 'right-3.5' : 'left-3.5'
                        }`}
                      />
                      <input
                        id="tech-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={
                          isAr
                            ? 'مثال: تقني أشعة مجتبى كريم'
                            : 'e.g., Tech Mojtaba Kareem'
                        }
                        className={`w-full rounded-lg border border-slate-700 bg-[#0B111A] py-2.5 text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 ${
                          isAr ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="tech-email"
                    className="block text-xs font-medium text-slate-300"
                  >
                    {isAr ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail
                      className={`w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                        isAr ? 'right-3.5' : 'left-3.5'
                      }`}
                    />
                    <input
                      id="tech-email"
                      type="email"
                      required
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className={`w-full rounded-lg border border-slate-700 bg-[#0B111A] py-2.5 text-base sm:text-sm text-white text-left placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 ${
                        isAr ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                      }`}
                    />
                  </div>
                </div>

                {mode !== 'RESET' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="tech-password"
                        className="block text-xs font-medium text-slate-300"
                      >
                        {isAr ? 'كلمة المرور' : 'Password'}
                      </label>
                      {mode === 'LOGIN' && (
                        <button
                          type="button"
                          onClick={() => switchMode('RESET')}
                          className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline cursor-pointer transition-colors"
                        >
                          {isAr
                            ? 'نسيت كلمة المرور؟ إعادة تعيين'
                            : 'Forgot password? Reset'}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock
                        className={`w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                          isAr ? 'right-3.5' : 'left-3.5'
                        }`}
                      />
                      <input
                        id="tech-password"
                        type="password"
                        required
                        minLength={6}
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full rounded-lg border border-slate-700 bg-[#0B111A] py-2.5 text-base sm:text-sm text-white text-left placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 ${
                          isAr ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span>
                      {isAr
                        ? 'جاري الاتصال بقاعدة البيانات...'
                        : 'Connecting to database...'}
                    </span>
                  ) : mode === 'REGISTER' ? (
                    <>
                      <UserPlus className="w-4 h-4 shrink-0" />
                      <span>
                        {isAr
                          ? 'إنشاء الحساب وبدء العيادة'
                          : 'Create Account & Start Clinic'}
                      </span>
                    </>
                  ) : mode === 'RESET' ? (
                    <>
                      <KeyRound className="w-4 h-4 shrink-0" />
                      <span>
                        {isAr
                          ? 'إرسال رابط إعادة تعيين كلمة المرور'
                          : 'Send Password Reset Link'}
                      </span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 shrink-0" />
                      <span>
                        {isAr
                          ? 'تسجيل الدخول ومتابعة التقدم'
                          : 'Sign In & Continue'}
                      </span>
                    </>
                  )}
                </button>

                {mode === 'RESET' && (
                  <button
                    type="button"
                    onClick={() => switchMode('LOGIN')}
                    className="w-full py-2 px-4 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {isAr ? 'العودة إلى تسجيل الدخول' : 'Back to Sign In'}
                  </button>
                )}
              </form>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-400 leading-relaxed">
                {isAr
                  ? 'تُحفظ بيانات جلستك تلقائياً؛ عند العودة بعد أيام ستبقى مسجلاً أو يمكنك الدخول بنفس البريد لاسترجاع رصيدك والأفلام والتجهيزات.'
                  : 'Your clinic session saves automatically; sign in anytime with the same email to restore your funds, films, and upgrades.'}
              </p>
            </div>
          </div>

          {/* Visual Showcase Column */}
          <div className="min-[600px]:col-span-6 lg:col-span-7 rounded-2xl border border-slate-800 bg-[#0E1622] overflow-hidden flex flex-col justify-between">
            <div className="relative flex-1 min-h-[160px] sm:min-h-[210px] bg-slate-900 overflow-hidden">
              {!heroError ? (
                <img
                  src={CLINIC_ROOM_IMAGE}
                  alt={
                    isAr
                      ? 'غرفة الأشعة الطبية التخصصية'
                      : 'Radiology Imaging Suite'
                  }
                  referrerPolicy="no-referrer"
                  onError={() => setHeroError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-900 to-cyan-950/30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E1622] via-transparent to-transparent" />
            </div>

            {/* Preview Strip: Patients & Scans */}
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  {isAr
                    ? 'عيادة متكاملة لاستقبال المرضى وفحص الصور الإشعاعية'
                    : 'Complete 3D imaging clinic for patient positioning and CR/DR workflows'}
                </span>
                <span className="font-mono-num text-cyan-300">
                  {isAr
                    ? `$15 / فحص · $${FILM_CARTON_COST} / كرتون ${FILM_CARTON_SIZE} فيلم`
                    : `$15 / Exam · $${FILM_CARTON_COST} / ${FILM_CARTON_SIZE}-Film Carton`}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {[
                  {src: PATIENT_AVATARS.manYoung, alt: isAr ? 'مريض شاب' : 'Patient'},
                  {src: PATIENT_AVATARS.womanYoung, alt: isAr ? 'مريضة شابة' : 'Patient'},
                  {src: REGION_SCAN_IMAGES.chest, alt: isAr ? 'أشعة الصدر' : 'Chest X-Ray'},
                  {src: REGION_SCAN_IMAGES.cervical, alt: isAr ? 'أشعة الفقرات العنقية' : 'Cervical X-Ray'},
                  {src: REGION_SCAN_IMAGES.hand, alt: isAr ? 'أشعة اليد' : 'Hand X-Ray'},
                  {src: PATIENT_AVATARS.manSenior, alt: isAr ? 'مريض مسن' : 'Senior Patient'},
                ].map((thumb, idx) => (
                  <div
                    key={idx}
                    className="aspect-square rounded-lg overflow-hidden border border-slate-800 bg-black"
                  >
                    <img
                      src={thumb.src}
                      alt={thumb.alt}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
