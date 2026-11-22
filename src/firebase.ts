import {initializeApp} from 'firebase/app';
import {getAnalytics, isSupported as isAnalyticsSupported} from 'firebase/analytics';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {getDatabase, get, ref, set} from 'firebase/database';
import type {ClinicSaveState} from './types/radiology';

const firebaseConfig = {
  apiKey: 'AIzaSyAalmn8YA_1pYiUGCCD19SZjwQ5OOeXzpU',
  authDomain: 'xray-game.firebaseapp.com',
  databaseURL: 'https://xray-game-default-rtdb.firebaseio.com',
  projectId: 'xray-game',
  storageBucket: 'xray-game.firebasestorage.app',
  messagingSenderId: '188510345189',
  appId: '1:188510345189:web:72ae0e90edf8d55582c10c',
  measurementId: 'G-X09JXHF2CP',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

void setPersistence(auth, browserLocalPersistence).catch(() => {
  // Fallback safely if storage is restricted
});

if (typeof window !== 'undefined') {
  void isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => {
      // Ignore analytics errors in sandboxed frames
    });
}

let activeAuthActionCount = 0;

export function isAuthFlowBusy(): boolean {
  return activeAuthActionCount > 0;
}

export interface AuthResult {
  user: User;
  saveState: ClinicSaveState | null;
  cloudReachable: boolean;
  permissionDenied: boolean;
}

export interface CloudSaveResult {
  synced: boolean;
  permissionDenied: boolean;
}

export interface CloudLoadResult {
  saveState: ClinicSaveState | null;
  synced: boolean;
  cloudReachable: boolean;
  permissionDenied: boolean;
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPermissionDeniedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as {code: unknown}).code) : '';
  const msg = 'message' in err ? String((err as {message: unknown}).message) : '';
  return (
    code.toLowerCase().includes('permission-denied') ||
    code.toLowerCase().includes('permission_denied') ||
    msg.toLowerCase().includes('permission_denied') ||
    msg.toLowerCase().includes('permission denied')
  );
}

/**
 * Legacy-compatible subset matching older database.rules.json schemas
 * (before daily shift fields were added), used as automatic fallback if
 * live RTDB rules still reject extra keys with PERMISSION_DENIED.
 */
function toLegacyRtdbSavePayload(save: ClinicSaveState): ClinicSaveState {
  const safeCases = (Array.isArray(save.completedCases) ? save.completedCases : [])
    .slice(0, 60)
    .map((c) =>
      stripUndefined({
        id: String(c.id || `case-${Date.now()}`),
        patientNameAr: String(c.patientNameAr || ''),
        ...(c.patientAvatarPath
          ? {patientAvatarPath: String(c.patientAvatarPath).slice(0, 19000)}
          : {}),
        examTitleAr: String(c.examTitleAr || ''),
        ...(c.examImagePath
          ? {examImagePath: String(c.examImagePath).slice(0, 19000)}
          : {}),
        modality: c.modality || 'XRAY',
        findingAr: String(c.findingAr || '').slice(0, 580),
        earned: Math.max(0, Number(c.earned) || 0),
        kvpUsed: Math.max(0, Number(c.kvpUsed) || 0),
        masUsed: Math.max(0, Number(c.masUsed) || 0),
        shieldUsed: Boolean(c.shieldUsed),
        ...(c.postureUsed ? {postureUsed: String(c.postureUsed)} : {}),
        timestamp: Number(c.timestamp) || Date.now(),
      })
    );

  return stripUndefined({
    cash: Math.max(0, Number(save.cash) || 0),
    totalRevenue: Math.max(0, Number(save.totalRevenue) || 0),
    films: Math.max(0, Number(save.films) || 0),
    cartonsBought: Math.max(0, Number(save.cartonsBought) || 0),
    patientsServed: Math.max(0, Number(save.patientsServed) || 0),
    retakesCount: Math.max(0, Number(save.retakesCount) || 0),
    filmDebt: Math.max(0, Number(save.filmDebt) || 0),
    ownedUpgrades: Array.isArray(save.ownedUpgrades) ? save.ownedUpgrades : [],
    completedCases: safeCases as ClinicSaveState['completedCases'],
    soundEnabled: Boolean(save.soundEnabled),
    updatedAt: Number(save.updatedAt) || Date.now(),
  });
}

export function mapFirebaseAuthError(
  error: unknown,
  lang: 'ar' | 'en' = 'ar'
): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code: string}).code)
      : '';
  const isEn = lang === 'en';

  switch (code) {
    case 'auth/email-already-in-use':
      return isEn
        ? 'This email is already registered. Try signing in instead.'
        : 'هذا البريد الإلكتروني مسجل مسبقاً. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد.';
    case 'auth/invalid-email':
      return isEn
        ? 'Invalid email address format.'
        : 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/weak-password':
      return isEn
        ? 'Password is too weak; it must be at least 6 characters.'
        : 'كلمة المرور ضعيفة جداً؛ يجب أن تتكون من 6 أحرف على الأقل.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return isEn
        ? 'Incorrect email or password.'
        : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/too-many-requests':
      return isEn
        ? 'Too many attempts temporarily. Please wait a moment and try again.'
        : 'تم تجاوز عدد المحاولات المسموح بها مؤقتاً. انتظر قليلاً ثم أعد المحاولة.';
    case 'auth/network-request-failed':
      return isEn
        ? 'Network connection failed. Please check your internet and retry.'
        : 'تعذر الاتصال بالشبكة. تحقق من اتصالك بالإنترنت وحاول مجدداً.';
    case 'auth/operation-not-allowed':
      return isEn
        ? 'Please enable Email/Password authentication in Firebase settings.'
        : 'يرجى تفعيل تسجيل الدخول بالبريد الإلكتروني وكلمة المرور في إعدادات Firebase Authentication.';
    default:
      return isEn
        ? 'Authentication error. Check your details and try again.'
        : 'حدث خطأ أثناء المصادقة. تأكد من البيانات وحاول مرة أخرى.';
  }
}

export function getLocalBackupKey(uid: string): string {
  return `radiology_clinic_save_uid_${uid}`;
}

export function getProgressScore(
  s: Partial<ClinicSaveState> | null | undefined
): number {
  if (!s) return -1;
  return (
    (s.patientsServed || 0) * 10000 +
    (s.totalRevenue || 0) * 10 +
    (s.ownedUpgrades?.length || 0) * 500 +
    ((s.currentDay || 1) - 1) * 1000 +
    (s.dailyPatientsHandled || 0) * 100 +
    (s.cartonsBought || 0) * 50 +
    (s.cash || 0)
  );
}

export function saveClinicProgressLocal(
  uid: string,
  saveState: ClinicSaveState
): ClinicSaveState {
  const stamped: ClinicSaveState = stripUndefined({
    ...saveState,
    updatedAt: saveState.updatedAt || Date.now(),
  });
  try {
    localStorage.setItem(getLocalBackupKey(uid), JSON.stringify(stamped));
  } catch {
    // Ignore storage quota issues
  }
  return stamped;
}

async function writeRtdbSave(
  uid: string,
  stamped: ClinicSaveState
): Promise<{ok: boolean; permissionDenied: boolean}> {
  try {
    await set(ref(rtdb, `clinics/${uid}/save`), stamped);
    return {ok: true, permissionDenied: false};
  } catch (err) {
    // If live RTDB rules still reject newly added fields, retry with core legacy fields
    // so cash, films, patientsServed, upgrades, and cases NEVER get lost.
    if (isPermissionDeniedError(err)) {
      try {
        await set(
          ref(rtdb, `clinics/${uid}/save`),
          toLegacyRtdbSavePayload(stamped)
        );
        return {ok: true, permissionDenied: false};
      } catch (fallbackErr) {
        return {
          ok: false,
          permissionDenied: isPermissionDeniedError(fallbackErr),
        };
      }
    }
    return {ok: false, permissionDenied: false};
  }
}

export async function saveClinicProgressToCloud(
  uid: string,
  saveState: ClinicSaveState
): Promise<CloudSaveResult> {
  const stamped: ClinicSaveState = stripUndefined({
    ...saveState,
    updatedAt: saveState.updatedAt || Date.now(),
  });
  saveClinicProgressLocal(uid, stamped);

  const rtdbRes = await writeRtdbSave(uid, stamped);
  return {
    synced: rtdbRes.ok,
    permissionDenied: !rtdbRes.ok && rtdbRes.permissionDenied,
  };
}

export async function loadClinicProgressFromCloud(
  uid: string
): Promise<CloudLoadResult> {
  let localData: ClinicSaveState | null = null;
  try {
    const cached = localStorage.getItem(getLocalBackupKey(uid));
    if (cached) {
      localData = JSON.parse(cached) as ClinicSaveState;
    }
  } catch {
    localData = null;
  }

  let cloudReachable = false;
  let permissionDenied = false;

  try {
    const snap = await get(ref(rtdb, `clinics/${uid}/save`));
    cloudReachable = true;
    if (snap.exists()) {
      const cloudData = snap.val() as ClinicSaveState;
      const cloudTime = cloudData.updatedAt || 0;
      const localTime = localData?.updatedAt || 0;
      const cloudScore = getProgressScore(cloudData);
      const localScore = getProgressScore(localData);

      // Keep whichever snapshot is newer or holds actual progress (never overwrite real progress with blank state)
      if (
        localData &&
        localScore > 0 &&
        (cloudScore <= 0 ||
          localTime > cloudTime ||
          (localTime === cloudTime && localScore > cloudScore))
      ) {
        void writeRtdbSave(uid, stripUndefined(localData));
        return {
          saveState: localData,
          synced: true,
          cloudReachable: true,
          permissionDenied: false,
        };
      }

      saveClinicProgressLocal(uid, cloudData);
      return {
        saveState: cloudData,
        synced: true,
        cloudReachable: true,
        permissionDenied: false,
      };
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      permissionDenied = true;
    }
  }

  if (localData) {
    if (cloudReachable && getProgressScore(localData) > 0) {
      void writeRtdbSave(uid, stripUndefined(localData));
    }
    return {
      saveState: localData,
      synced: cloudReachable,
      cloudReachable,
      permissionDenied,
    };
  }

  return {
    saveState: null,
    synced: cloudReachable,
    cloudReachable,
    permissionDenied,
  };
}

export async function registerTechAccount(params: {
  name: string;
  email: string;
  password: string;
  initialSave: ClinicSaveState;
}): Promise<AuthResult> {
  const cleanName = params.name.trim();
  const cleanEmail = params.email.trim();
  activeAuthActionCount += 1;

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      params.password
    );

    if (cleanName) {
      await updateProfile(cred.user, {displayName: cleanName});
    }

    const now = Date.now();
    const stampedInit: ClinicSaveState = stripUndefined({
      ...params.initialSave,
      updatedAt: now,
    });

    saveClinicProgressLocal(cred.user.uid, stampedInit);

    const profilePayload = {
      name: cleanName || cleanEmail.split('@')[0] || 'Radiographer',
      email: cleanEmail,
      createdAt: now,
    };

    let cloudReachable = false;
    let permissionDenied = false;

    try {
      await set(ref(rtdb, `clinics/${cred.user.uid}`), {
        profile: profilePayload,
        save: stampedInit,
      });
      cloudReachable = true;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        try {
          await set(ref(rtdb, `clinics/${cred.user.uid}`), {
            profile: profilePayload,
            save: toLegacyRtdbSavePayload(stampedInit),
          });
          cloudReachable = true;
        } catch (fallbackErr) {
          permissionDenied = isPermissionDeniedError(fallbackErr);
        }
      }
    }

    return {
      user: cred.user,
      saveState: stampedInit,
      cloudReachable,
      permissionDenied,
    };
  } finally {
    activeAuthActionCount = Math.max(0, activeAuthActionCount - 1);
  }
}

export async function loginTechAccount(params: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  activeAuthActionCount += 1;

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      params.email.trim(),
      params.password
    );

    const loaded = await loadClinicProgressFromCloud(cred.user.uid);
    return {
      user: cred.user,
      saveState: loaded.saveState,
      cloudReachable: loaded.cloudReachable,
      permissionDenied: loaded.permissionDenied,
    };
  } finally {
    activeAuthActionCount = Math.max(0, activeAuthActionCount - 1);
  }
}

export async function sendTechPasswordReset(
  email: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<void> {
  auth.languageCode = lang;
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutTechAccount(): Promise<void> {
  await signOut(auth);
}
