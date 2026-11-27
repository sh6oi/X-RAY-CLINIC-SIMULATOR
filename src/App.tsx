import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {
  ArrowLeftRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronUp,
  Coins,
  Crosshair,
  DoorClosed,
  DoorOpen,
  Film,
  Gamepad2,
  Hand,
  Languages,
  LogOut,
  Maximize2,
  Minimize2,
  Minus,
  Monitor,
  Package,
  Plus,
  RotateCcw,
  ScanLine,
  Shield,
  Sliders,
  Sun,
  UserCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  BodyRegion,
  BodySide,
  CassetteState,
  ClinicSaveState,
  CompletedCase,
  DaySummaryRecord,
  JoystickConfig,
  Modality,
  PatientCase,
  PatientPosture,
  ProjectionType,
  ScanEvaluation,
  ScreenMode,
  TechLocation,
  TechProfile,
  UpgradeId,
  WorkspaceTab,
} from './types/radiology';
import {
  BULK_CARTON_COST,
  BULK_CARTON_SIZE,
  EMERGENCY_LOAN_DEBT,
  FILM_CARTON_COST,
  FILM_CARTON_SIZE,
  MEGA_CRATE_COST,
  MEGA_CRATE_SIZE,
  MINI_PACK_COST,
  MINI_PACK_SIZE,
  UPGRADES,
  evaluateExposure,
  generatePatient,
  getClinicRank,
  getEffectiveExamRanges,
  getExamById,
  isPediatricPatientAge,
} from './data/radiologyData';
import {
  POSTURE_SHORT_I18N,
  RANK_TITLES_I18N,
  SIDE_SHORT_I18N,
  UPGRADE_EN,
  formatRegionWithSide,
  isBilateralRegion,
  useLanguage,
} from './i18n/translations';
import {
  auth,
  getProgressScore,
  isAuthFlowBusy,
  loadClinicProgressFromCloud,
  logoutTechAccount,
  saveClinicProgressLocal,
  saveClinicProgressToCloud,
  type AuthResult,
} from './firebase';
import {AuthScreen} from './components/AuthScreen';
import {
  RadiologyRoom3D,
  type SceneTargetAction,
} from './components/RadiologyRoom3D';
import {ClinicPCModal} from './components/ClinicPCModal';
import {ControlSettingsModal} from './components/ControlSettingsModal';
import {DaySummaryModal} from './components/DaySummaryModal';
import {ExposureConsolePanel} from './components/ExposureConsolePanel';
import {UpdateNotificationBanner} from './components/UpdateNotificationBanner';
import {PWAInstallButton} from './components/PWAInstallButton';
import {PatientPostureMenu} from './components/PatientPostureMenu';
import {PatientRegionMenu} from './components/PatientRegionMenu';
import {PatientRequisitionModal} from './components/PatientRequisitionModal';
import {VirtualJoystick} from './components/VirtualJoystick';
import {DesignerCredit} from './components/DesignerCredit';
import {useAppUpdate} from './hooks/useAppUpdate';
import {soundFx} from './utils/soundFx';
import {
  getStageDimensions,
  syncStageViewport,
  toStagePoint,
} from './utils/stageViewport';

function rollDailyTargetPatients(ownedUpgrades: UpgradeId[]): number {
  const hasWaitingRoom = ownedUpgrades.includes('waiting_room');
  return hasWaitingRoom
    ? 20 + Math.floor(Math.random() * 6) // 20..25
    : 10 + Math.floor(Math.random() * 6); // 10..15
}

const INITIAL_SAVE: ClinicSaveState = {
  cash: 0,
  totalRevenue: 0,
  films: 20,
  cartonsBought: 0,
  patientsServed: 0,
  retakesCount: 0,
  filmDebt: 0,
  ownedUpgrades: [],
  completedCases: [],
  soundEnabled: true,
  currentDay: 1,
  dailyTargetPatients: 12,
  dailyPatientsHandled: 0,
  dailyEarned: 0,
  dailySpentPurchases: 0,
  dailySpentExpenses: 0,
  dailyRetakes: 0,
  dailyFilmsUsed: 0,
  dayCompletedAwaitingNext: false,
  dayHistory: [],
};

function sanitizeSaveState(
  raw: Partial<ClinicSaveState> | null
): ClinicSaveState {
  if (!raw) {
    return {
      ...INITIAL_SAVE,
      dailyTargetPatients: rollDailyTargetPatients([]),
    };
  }
  const upgrades = Array.isArray(raw.ownedUpgrades) ? raw.ownedUpgrades : [];
  const hasWaiting = upgrades.includes('waiting_room');
  const rawTarget =
    typeof raw.dailyTargetPatients === 'number' && raw.dailyTargetPatients > 0
      ? raw.dailyTargetPatients
      : rollDailyTargetPatients(upgrades);
  const adjustedTarget =
    hasWaiting && rawTarget < 20
      ? rollDailyTargetPatients(upgrades)
      : rawTarget;

  return {
    ...INITIAL_SAVE,
    ...raw,
    ownedUpgrades: upgrades,
    completedCases: Array.isArray(raw.completedCases)
      ? raw.completedCases
      : [],
    currentDay:
      typeof raw.currentDay === 'number' && raw.currentDay >= 1
        ? raw.currentDay
        : 1,
    dailyTargetPatients: adjustedTarget,
    dailyPatientsHandled:
      typeof raw.dailyPatientsHandled === 'number' &&
      raw.dailyPatientsHandled >= 0
        ? raw.dailyPatientsHandled
        : 0,
    dailyEarned: typeof raw.dailyEarned === 'number' ? raw.dailyEarned : 0,
    dailySpentPurchases:
      typeof raw.dailySpentPurchases === 'number'
        ? raw.dailySpentPurchases
        : 0,
    dailySpentExpenses:
      typeof raw.dailySpentExpenses === 'number' ? raw.dailySpentExpenses : 0,
    dailyRetakes:
      typeof raw.dailyRetakes === 'number' ? raw.dailyRetakes : 0,
    dailyFilmsUsed:
      typeof raw.dailyFilmsUsed === 'number' ? raw.dailyFilmsUsed : 0,
    dayCompletedAwaitingNext: Boolean(raw.dayCompletedAwaitingNext),
    dayHistory: Array.isArray(raw.dayHistory) ? raw.dayHistory : [],
  };
}

function buildDayInitialQueue(
  upgrades: UpgradeId[],
  targetPatients: number,
  handledToday: number,
  maxQueueSize: number
): PatientCase[] {
  const remaining = Math.max(0, targetPatients - handledToday);
  const count = Math.min(maxQueueSize, remaining);
  if (count <= 0) return [];

  if (handledToday === 0) {
    const starterPool = ['chest_pa', 'knee_ap', 'cervical_lat'];
    return Array.from({length: count}, (_, i) => {
      let p = generatePatient(upgrades);
      if (i === 1) {
        let guard = 0;
        while (!p.isPediatric && guard < 20) {
          p = generatePatient(upgrades);
          guard += 1;
        }
      }
      if (i < starterPool.length) {
        const exam = getExamById(starterPool[i]);
        const needsSide = Boolean(
          exam.sideRequired || isBilateralRegion(exam.region)
        );
        return {
          ...p,
          examId: exam.id,
          requestedSide: needsSide
            ? p.requestedSide !== 'NONE'
              ? p.requestedSide
              : 'LEFT'
            : 'NONE',
        };
      }
      return p;
    });
  }
  return Array.from({length: count}, () => generatePatient(upgrades));
}

export default function App() {
  const {lang, toggleLang} = useLanguage();
  const isAr = lang === 'ar';
  const appUpdate = useAppUpdate();

  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [techProfile, setTechProfile] = useState<TechProfile | null>(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>('AUTH');

  const [save, setSave] = useState<ClinicSaveState>(() => ({
    ...INITIAL_SAVE,
    dailyTargetPatients: rollDailyTargetPatients([]),
  }));
  const [queue, setQueue] = useState<PatientCase[]>(() =>
    buildDayInitialQueue([], 12, 0, 3)
  );
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  // First-Person 3D Clinical Workflow State
  const [techLocation, setTechLocation] = useState<TechLocation>('ROOM');
  const [doorClosed, setDoorClosed] = useState<boolean>(false);
  const [ctDoorOpen, setCtDoorOpen] = useState<boolean>(false);
  const [mriDoorOpen, setMriDoorOpen] = useState<boolean>(false);
  const [cassetteState, setCassetteState] = useState<CassetteState>('RACK');
  const [crExposedPending, setCrExposedPending] = useState<boolean>(false);

  // Patient Positioning & Generator Console State
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion>('chest');
  const [selectedSide, setSelectedSide] = useState<BodySide>('NONE');
  const [selectedPosture, setSelectedPosture] =
    useState<PatientPosture>('ERECT_PA');
  const [selectedProjection, setSelectedProjection] =
    useState<ProjectionType>('PA');
  const [kvp, setKvp] = useState<number>(115);
  const [mas, setMas] = useState<number>(2.5);
  const [shieldUsed, setShieldUsed] = useState<boolean>(false);
  const [breathHeld, setBreathHeld] = useState<boolean>(false);

  // Exposure, Developing, Patient Speech & Case Approval
  const [isExposing, setIsExposing] = useState<boolean>(false);
  const [isDeveloping, setIsDeveloping] = useState<boolean>(false);
  const [currentEvaluation, setCurrentEvaluation] =
    useState<ScanEvaluation | null>(null);
  const [capturedPosture, setCapturedPosture] =
    useState<PatientPosture | null>(null);
  const [capturedProjection, setCapturedProjection] =
    useState<ProjectionType | null>(null);
  const [capturedSide, setCapturedSide] = useState<BodySide | null>(null);
  const [caseApproved, setCaseApproved] = useState<boolean>(false);
  const [patientSpeech, setPatientSpeech] = useState<string | null>(null);

  // Control Booth Console Drawer, Clinic PC Modal, Control Settings, End-of-Day Summary & 10-Patient Designer Milestone
  const [consoleOpen, setConsoleOpen] = useState<boolean>(true);
  const [pcOpen, setPcOpen] = useState<boolean>(false);
  const [pcTab, setPcTab] = useState<WorkspaceTab>('IMAGE');
  const [controlsModalOpen, setControlsModalOpen] = useState<boolean>(false);
  const [daySummaryOpen, setDaySummaryOpen] = useState<boolean>(false);
  const [activeDaySummary, setActiveDaySummary] =
    useState<DaySummaryRecord | null>(null);
  const [brightnessOpen, setBrightnessOpen] = useState<boolean>(false);
  const [patientMenuOpen, setPatientMenuOpen] = useState<boolean>(false);
  const [regionMenuOpen, setRegionMenuOpen] = useState<boolean>(false);
  const [requisitionOpen, setRequisitionOpen] = useState<boolean>(false);
  const [isRepositioningJoystick, setIsRepositioningJoystick] =
    useState<boolean>(false);
  const [draftJoystickCoords, setDraftJoystickCoords] = useState<{
    x: number;
    y: number;
  }>({x: 0.14, y: 0.72});
  const [designerPopupOpen, setDesignerPopupOpen] = useState<boolean>(false);
  const [designerMilestoneCount, setDesignerMilestoneCount] =
    useState<number>(10);

  // Toast message
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const getDefaultJoystickConfig = (): JoystickConfig => ({
    preset: 'bottom-left',
    size: 'md',
    customX: 0.12,
    customY: 0.74,
  });

  const [joystickConfig, setJoystickConfig] = useState<JoystickConfig>(() => {
    try {
      const raw = localStorage.getItem('clinic_joystick_config_v2');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<JoystickConfig>;
        if (
          parsed &&
          (parsed.preset === 'bottom-left' ||
            parsed.preset === 'bottom-right' ||
            parsed.preset === 'top-left' ||
            parsed.preset === 'top-right' ||
            parsed.preset === 'custom')
        ) {
          return {
            preset: parsed.preset,
            size:
              parsed.size === 'sm' || parsed.size === 'lg'
                ? parsed.size
                : 'md',
            customX:
              typeof parsed.customX === 'number'
                ? Math.min(0.92, Math.max(0.08, parsed.customX))
                : 0.12,
            customY:
              typeof parsed.customY === 'number'
                ? Math.min(0.88, Math.max(0.16, parsed.customY))
                : 0.74,
          };
        }
      }
    } catch {
      // Ignore storage errors
    }
    return getDefaultJoystickConfig();
  });

  const DEFAULT_BRIGHTNESS = 2.0;
  const [brightness, setBrightness] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('clinic_brightness_v3');
      if (raw) {
        const val = Number(raw);
        if (Number.isFinite(val)) {
          return Math.min(2.0, Math.max(0.5, val));
        }
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_BRIGHTNESS;
  });

  const joystickRef = useRef<{x: number; y: number}>({x: 0, y: 0});
  const exposeTimerRef = useRef<number | null>(null);
  const developTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const speechTimerRef = useRef<number | null>(null);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const hydratedUidRef = useRef<string | null>(null);
  const cloudWriteGuardRef = useRef<boolean>(false);
  const cloudPermWarnedRef = useRef<boolean>(false);
  const latestSaveRef = useRef<ClinicSaveState>(save);
  const latestUidRef = useRef<string | null>(null);
  const pendingCrEvalRef = useRef<ScanEvaluation | null>(null);
  const moveCountRef = useRef<number>(0);

  latestSaveRef.current = save;
  latestUidRef.current = techProfile?.uid ?? null;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  }, []);

  useEffect(() => {
    const tryLockLandscape = () => {
      const orientation = screen.orientation as
        | (ScreenOrientation & {lock?: (type: string) => Promise<void>})
        | undefined;
      void orientation?.lock?.('landscape')?.catch(() => {});
    };
    const checkViewport = () => {
      syncStageViewport();
      tryLockLandscape();
    };
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      checkViewport();
    };
    const onFocusShift = () => {
      window.setTimeout(checkViewport, 80);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    window.visualViewport?.addEventListener('resize', checkViewport);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('focusin', onFocusShift);
    document.addEventListener('focusout', onFocusShift);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
      window.visualViewport?.removeEventListener('resize', checkViewport);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('focusin', onFocusShift);
      document.removeEventListener('focusout', onFocusShift);
    };
  }, []);

  const handleToggleLandscapeFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        const orientation = screen.orientation as
          | (ScreenOrientation & {lock?: (type: string) => Promise<void>})
          | undefined;
        await orientation?.lock?.('landscape').catch(() => {});
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Fullscreen/orientation lock not supported on this browser; user rotates physically
    }
  };

  const updateJoystickConfig = useCallback((next: JoystickConfig) => {
    setJoystickConfig(next);
    try {
      localStorage.setItem('clinic_joystick_config_v2', JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const updateBrightness = useCallback((next: number) => {
    const clamped = Math.min(2.0, Math.max(0.5, Number(next.toFixed(2))));
    setBrightness(clamped);
    try {
      localStorage.setItem('clinic_brightness_v3', String(clamped));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const triggerPatientSpeech = useCallback(
    (msgAr: string, msgEn: string, durationMs = 6500) => {
      setPatientSpeech(isAr ? msgAr : msgEn);
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = window.setTimeout(() => {
        setPatientSpeech(null);
      }, durationMs);
    },
    [isAr]
  );

  const triggerEvaluationSpeech = useCallback(
    (ev: ScanEvaluation) => {
      if (ev.success) {
        triggerPatientSpeech(
          'ممتاز! فحص سريع ومريح، شكراً جزيلاً لك!',
          'Great job! Smooth and comfortable scan, thank you!'
        );
        return;
      }
      switch (ev.reasonCode) {
        case 'WRONG_REGION':
          triggerPatientSpeech(
            'مهلاً! لماذا صوّرت هذا المكان؟ ألمي ليس هنا!',
            'Hey! Why did you scan there? That is not where it hurts!'
          );
          break;
        case 'WRONG_SIDE':
          triggerPatientSpeech(
            'انتبه! طلبت فحص الجهة الأخرى (اليمين أم اليسار)!',
            'Wait! My pain is on the other side (Left vs Right)!'
          );
          break;
        case 'WRONG_POSTURE':
        case 'WRONG_PROJECTION':
          triggerPatientSpeech(
            'أشعر أن وضعيتي كانت خاطئة.. هل سنعيد التصوير؟',
            'That posture felt wrong... do we have to retake it?'
          );
          break;
        case 'UNDEREXPOSED':
          triggerPatientSpeech(
            'الصورة باهتة جداً! ألم تكن الجرعة ضعيفة؟',
            'The scan came out faint! Was the exposure too low?'
          );
          break;
        case 'OVEREXPOSED':
          triggerPatientSpeech(
            'يا إلهي! هذه جرعة أشعة قوية جداً، احترقت الصورة!',
            'Whoa! That radiation dose was way too high!'
          );
          break;
      }
    },
    [triggerPatientSpeech]
  );

  // Stamp updatedAt on every state mutation and persist synchronously to localStorage
  const commitSaveUpdate = useCallback(
    (updater: (prev: ClinicSaveState) => ClinicSaveState) => {
      setSave((prev) => {
        const next: ClinicSaveState = {
          ...updater(prev),
          updatedAt: Date.now(),
        };
        if (latestUidRef.current) {
          saveClinicProgressLocal(latestUidRef.current, next);
        }
        return next;
      });
    },
    []
  );

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const isArRef = useRef(isAr);
  isArRef.current = isAr;

  // Listen for persistent Firebase Auth session across refreshes/days
  useEffect(() => {
    let settled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!settled) setAuthChecking(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      settled = true;
      window.clearTimeout(fallbackTimer);

      if (!user) {
        hydratedUidRef.current = null;
        cloudWriteGuardRef.current = false;
        setTechProfile(null);
        setScreenMode('AUTH');
        setAuthChecking(false);
        return;
      }

      // If interactive Login/Register is currently running, let handleAuthenticated finish cleanly without racing
      if (isAuthFlowBusy() || hydratedUidRef.current === user.uid) {
        return;
      }

      const profile: TechProfile = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Radiographer',
        email: user.email || '',
      };
      setTechProfile(profile);

      const loaded = await loadClinicProgressFromCloud(user.uid);
      if (isAuthFlowBusy() || hydratedUidRef.current === user.uid) {
        return;
      }

      cloudWriteGuardRef.current = !loaded.cloudReachable && loaded.saveState === null;
      if (loaded.permissionDenied && !cloudPermWarnedRef.current) {
        cloudPermWarnedRef.current = true;
        showToastRef.current(
          isArRef.current
            ? 'تعذر الوصول للحفظ السحابي بسبب صلاحيات قاعدة البيانات في Firebase!'
            : 'Cloud sync blocked by Firebase database rules!'
        );
      }

      const restored = sanitizeSaveState(loaded.saveState);
      hydratedUidRef.current = user.uid;
      setSave(restored);
      const maxCap = restored.ownedUpgrades.includes('waiting_room') ? 6 : 3;
      if (restored.dayCompletedAwaitingNext && restored.dayHistory?.length) {
        setQueue([]);
        setActiveDaySummary(restored.dayHistory[0]);
        setDaySummaryOpen(true);
      } else {
        setQueue(
          buildDayInitialQueue(
            restored.ownedUpgrades,
            restored.dailyTargetPatients ?? 12,
            restored.dailyPatientsHandled ?? 0,
            maxCap
          )
        );
      }
      setScreenMode('PLAYING');
      setAuthChecking(false);
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Continuous synchronous local backup + fast debounced cloud sync
  useEffect(() => {
    soundFx.setEnabled(save.soundEnabled);
    if (!techProfile || hydratedUidRef.current !== techProfile.uid) return;

    saveClinicProgressLocal(techProfile.uid, save);

    // If initial cloud load failed while offline on a fresh install, don't overwrite cloud with blank INITIAL_SAVE
    if (cloudWriteGuardRef.current && getProgressScore(save) <= 0) {
      return;
    }
    if (getProgressScore(save) > 0) {
      cloudWriteGuardRef.current = false;
    }

    if (cloudSyncTimerRef.current) window.clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = window.setTimeout(() => {
      void saveClinicProgressToCloud(techProfile.uid, save).then((res) => {
        if (res.permissionDenied && !cloudPermWarnedRef.current) {
          cloudPermWarnedRef.current = true;
          showToast(
            isAr
              ? 'تنبيه: قواعد Firebase تمنع حفظ التقدم السحابي حاليًا — تأكد من تحديث قواعد قاعدة البيانات.'
              : 'Warning: Firebase rules are blocking cloud save — update database rules.'
          );
        }
      });
    }, 280);
  }, [save, techProfile, isAr, showToast]);

  // Flush save immediately before tab closes / app minimizes / page navigates away
  useEffect(() => {
    const flushSave = () => {
      const uid = latestUidRef.current;
      if (!uid || hydratedUidRef.current !== uid) return;
      if (
        cloudWriteGuardRef.current &&
        getProgressScore(latestSaveRef.current) <= 0
      ) {
        return;
      }
      const stamped: ClinicSaveState = {
        ...latestSaveRef.current,
        updatedAt: Date.now(),
      };
      saveClinicProgressLocal(uid, stamped);
      void saveClinicProgressToCloud(uid, stamped);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };

    window.addEventListener('beforeunload', flushSave);
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushSave);
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (exposeTimerRef.current) window.clearTimeout(exposeTimerRef.current);
      if (developTimerRef.current) window.clearTimeout(developTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
      if (cloudSyncTimerRef.current)
        window.clearTimeout(cloudSyncTimerRef.current);
    };
  }, []);

  // Assistant Radiographer passive income loop
  const hasAssistant = save.ownedUpgrades.includes('assistant_tech');
  useEffect(() => {
    if (
      screenMode !== 'PLAYING' ||
      !hasAssistant ||
      !techProfile ||
      appUpdate.updateAvailable
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      commitSaveUpdate((prev) => {
        if (prev.dayCompletedAwaitingNext) return prev;
        const fee = prev.ownedUpgrades.includes('digital_dr') ? 25 : 15;
        return {
          ...prev,
          cash: prev.cash + fee,
          totalRevenue: prev.totalRevenue + fee,
          dailyEarned: (prev.dailyEarned ?? 0) + fee,
          patientsServed: prev.patientsServed + 1,
        };
      });
    }, 7500);
    return () => window.clearInterval(interval);
  }, [
    screenMode,
    hasAssistant,
    techProfile,
    appUpdate.updateAvailable,
    commitSaveUpdate,
  ]);

  const hasWaitingRoom = save.ownedUpgrades.includes('waiting_room');
  const maxQueueSize = hasWaitingRoom ? 6 : 3;
  const currentDay = save.currentDay ?? 1;
  const dailyTargetPatients = save.dailyTargetPatients ?? (hasWaitingRoom ? 22 : 12);
  const dailyPatientsHandled = save.dailyPatientsHandled ?? 0;
  const remainingPatientsToday = Math.max(
    0,
    dailyTargetPatients - dailyPatientsHandled
  );
  const allDayPatientsDone =
    remainingPatientsToday === 0 && queue.length === 0;

  useEffect(() => {
    if (
      techLocation !== 'ROOM' ||
      pcOpen ||
      caseApproved ||
      crExposedPending ||
      allDayPatientsDone
    ) {
      setPatientMenuOpen(false);
      setRegionMenuOpen(false);
    }
  }, [
    techLocation,
    pcOpen,
    caseApproved,
    crExposedPending,
    allDayPatientsDone,
  ]);

  const hasDR = save.ownedUpgrades.includes('digital_dr');
  const hasAutoProc = save.ownedUpgrades.includes('auto_processor');
  const hasProtocolAssist = save.ownedUpgrades.includes('protocol_assist');
  const hasLeadShield = save.ownedUpgrades.includes('lead_shield');
  const hasDosimeter = save.ownedUpgrades.includes('dosimeter_badge');
  const hasTubeCooler = save.ownedUpgrades.includes('tube_cooler');
  const hasCT = save.ownedUpgrades.includes('ct_scanner');
  const hasMRI = save.ownedUpgrades.includes('mri_suite');

  // Keep queue topped up ONLY up to today's remaining daily quota
  useEffect(() => {
    if (save.dayCompletedAwaitingNext) {
      if (queue.length > 0) setQueue([]);
      return;
    }
    const desiredQueueSize = Math.min(maxQueueSize, remainingPatientsToday);
    if (queue.length < desiredQueueSize) {
      const needed = desiredQueueSize - queue.length;
      const newcomers = Array.from({length: needed}, () =>
        generatePatient(save.ownedUpgrades)
      );
      setQueue((prev) => [...prev, ...newcomers]);
    }
  }, [
    queue.length,
    maxQueueSize,
    remainingPatientsToday,
    save.ownedUpgrades,
    save.dayCompletedAwaitingNext,
  ]);

  const activePatient = useMemo(() => {
    if (queue.length === 0) return null;
    return queue.find((p) => p.id === activePatientId) || queue[0];
  }, [queue, activePatientId]);

  const requestedExam = useMemo(
    () =>
      activePatient
        ? getExamById(activePatient.examId)
        : getExamById('chest_pa'),
    [activePatient]
  );

  const effectiveRanges = useMemo(
    () => getEffectiveExamRanges(requestedExam, activePatient?.age),
    [requestedExam, activePatient?.age]
  );
  const isChildPatient = isPediatricPatientAge(activePatient?.age);

  const currentRank = getClinicRank(save.totalRevenue);
  const rankTitle =
    RANK_TITLES_I18N[lang][currentRank.id] || currentRank.titleAr;
  const isChestExam = requestedExam.region === 'chest';
  const effectiveBreathHeld = isChestExam && breathHeld;
  const isBoreScan =
    requestedExam.modality === 'CT' || requestedExam.modality === 'MRI';
  const isErect = selectedPosture.startsWith('ERECT_');
  const requiredCassetteSlot: CassetteState = isErect
    ? 'WALL_BUCKY'
    : 'TABLE_BUCKY';
  const cassetteReady =
    hasDR || isBoreScan || cassetteState === requiredCassetteSlot;

  const deriveProjectionFromState = (
    posture: PatientPosture,
    region: BodyRegion,
    modality: Modality
  ): ProjectionType => {
    if (modality === 'CT') return 'AXIAL';
    if (modality === 'MRI') return 'SAGITTAL';
    if (posture === 'ERECT_PA' || posture === 'PRONE') return 'PA';
    if (posture === 'ERECT_AP') return 'AP';
    if (
      posture === 'ERECT_LEFT_LAT' ||
      posture === 'ERECT_RIGHT_LAT' ||
      posture === 'TABLE_LEFT_LAT' ||
      posture === 'TABLE_RIGHT_LAT'
    ) {
      return 'LATERAL';
    }
    if (
      posture === 'ERECT_RAO' ||
      posture === 'ERECT_LAO' ||
      posture === 'TABLE_RPO' ||
      posture === 'TABLE_LPO'
    ) {
      return 'OBLIQUE';
    }
    return region === 'hand' ||
      region === 'wrist' ||
      region === 'facial_bones'
      ? 'PA'
      : 'AP';
  };

  const registerPatientMovement = () => {
    moveCountRef.current += 1;
    if (moveCountRef.current === 3) {
      triggerPatientSpeech(
        'هل أنت مدرك ما تفعل؟ دوّختني من كثرة التحريك!',
        'Do you know what you are doing? You are making me dizzy moving me so much!'
      );
    } else if (moveCountRef.current >= 5 && moveCountRef.current % 2 === 1) {
      triggerPatientSpeech(
        'رجاءً استقر على وضعية واحدة، تعبت من الحركة!',
        'Please pick one posture, I am getting tired of moving!'
      );
    }
  };

  const handleAuthenticated = (result: AuthResult) => {
    const profile: TechProfile = {
      uid: result.user.uid,
      name:
        result.user.displayName ||
        result.user.email?.split('@')[0] ||
        'Radiographer',
      email: result.user.email || '',
    };
    cloudWriteGuardRef.current =
      !result.cloudReachable && result.saveState === null;
    if (result.permissionDenied && !cloudPermWarnedRef.current) {
      cloudPermWarnedRef.current = true;
      showToast(
        isAr
          ? 'تنبيه: قواعد Firebase تمنع الوصول للحفظ السحابي — راجع قواعد قاعدة البيانات.'
          : 'Warning: Firebase rules blocked cloud sync — check database rules.'
      );
    }

    const restored = sanitizeSaveState(result.saveState);
    hydratedUidRef.current = profile.uid;
    setTechProfile(profile);
    setSave(restored);
    saveClinicProgressLocal(profile.uid, restored);
    const maxCap = restored.ownedUpgrades.includes('waiting_room') ? 6 : 3;
    if (restored.dayCompletedAwaitingNext && restored.dayHistory?.length) {
      setQueue([]);
      setActiveDaySummary(restored.dayHistory[0]);
      setDaySummaryOpen(true);
    } else {
      setQueue(
        buildDayInitialQueue(
          restored.ownedUpgrades,
          restored.dailyTargetPatients ?? 12,
          restored.dailyPatientsHandled ?? 0,
          maxCap
        )
      );
      setDaySummaryOpen(false);
    }
    setAuthChecking(false);
    setScreenMode('PLAYING');
  };

  const handleLogout = async () => {
    if (techProfile) {
      const stamped: ClinicSaveState = {...save, updatedAt: Date.now()};
      saveClinicProgressLocal(techProfile.uid, stamped);
      if (!cloudWriteGuardRef.current || getProgressScore(stamped) > 0) {
        await saveClinicProgressToCloud(techProfile.uid, stamped);
      }
    }
    hydratedUidRef.current = null;
    cloudWriteGuardRef.current = false;
    await logoutTechAccount();
    setTechProfile(null);
    setDesignerPopupOpen(false);
    setDaySummaryOpen(false);
    setScreenMode('AUTH');
  };

  const handleSelectRegion = (region: BodyRegion, side?: BodySide) => {
    if (isDeveloping || isExposing || caseApproved || crExposedPending) return;
    if (techLocation !== 'ROOM') {
      showToast(
        isAr
          ? 'ادخل غرفة الفحص أولاً لتحديد موضع التصوير على المريض.'
          : 'Enter the exam room first to position the patient region.'
      );
      return;
    }
    const resolvedSide: BodySide = isBilateralRegion(region)
      ? side && side !== 'NONE'
        ? side
        : selectedSide !== 'NONE'
          ? selectedSide
          : 'RIGHT'
      : 'NONE';

    if (region !== selectedRegion || resolvedSide !== selectedSide) {
      registerPatientMovement();
    }
    setSelectedRegion(region);
    setSelectedSide(resolvedSide);
    setSelectedProjection(
      deriveProjectionFromState(
        selectedPosture,
        region,
        requestedExam.modality
      )
    );
    soundFx.playPurchase();
    showToast(
      isAr
        ? `تم توجيه الأشعة نحو: ${formatRegionWithSide(region, resolvedSide, 'ar')}`
        : `Tube aligned to: ${formatRegionWithSide(region, resolvedSide, 'en')}`
    );
  };

  const handleSelectPosture = (posture: PatientPosture) => {
    if (isDeveloping || isExposing || caseApproved || crExposedPending) return;
    if (techLocation !== 'ROOM') {
      showToast(
        isAr
          ? 'ادخل غرفة الفحص أولاً لتغيير وضعية المريض.'
          : 'Enter the exam room first to reposition the patient.'
      );
      return;
    }
    if (posture !== selectedPosture) {
      registerPatientMovement();
    }
    setSelectedPosture(posture);

    if (
      !hasDR &&
      posture.startsWith('ERECT_') &&
      cassetteState === 'TABLE_BUCKY'
    ) {
      setCassetteState('IN_HAND');
      showToast(
        isAr
          ? 'تم إخراج الكاسيت بيدك — ضعه الآن في الحامل الواقف (البكي).'
          : 'Cassette returned to hand — insert it into the Wall Bucky.'
      );
    } else if (
      !hasDR &&
      !posture.startsWith('ERECT_') &&
      cassetteState === 'WALL_BUCKY'
    ) {
      setCassetteState('IN_HAND');
      showToast(
        isAr
          ? 'تم إخراج الكاسيت بيدك — ضعه الآن تحت الطاولة.'
          : 'Cassette returned to hand — insert it into the Table Bucky.'
      );
    }

    setSelectedProjection(
      deriveProjectionFromState(
        posture,
        selectedRegion,
        requestedExam.modality
      )
    );
  };

  const handleToggleDoorAndBooth = () => {
    if (isExposing || isDeveloping) return;
    if (techLocation === 'ROOM') {
      setTechLocation('BOOTH');
      setDoorClosed(true);
      setConsoleOpen(!crExposedPending && cassetteState !== 'EXPOSED_IN_HAND');
      soundFx.playPurchase();
      showToast(
        isAr
          ? cassetteState === 'EXPOSED_IN_HAND'
            ? 'عدت إلى غرفة التحكم — أدخل الكاسيت الآن في جهاز قارئ CR!'
            : 'خرجت إلى غرفة التحكم وأغلقت الباب الرصاصي خلفك.'
          : cassetteState === 'EXPOSED_IN_HAND'
            ? 'Back in Control Booth — insert cassette into the CR Reader!'
            : 'Entered Control Booth and closed the lead door.'
      );
    } else if (!doorClosed) {
      setDoorClosed(true);
      setConsoleOpen(!crExposedPending && cassetteState !== 'EXPOSED_IN_HAND');
      soundFx.playPurchase();
      showToast(
        isAr
          ? 'تم إغلاق الباب الرصاصي — يمكنك الآن إطلاق الجرعة.'
          : 'Lead door closed — ready for exposure.'
      );
    } else {
      setDoorClosed(false);
      setTechLocation('ROOM');
      soundFx.playPurchase();
      showToast(
        isAr
          ? crExposedPending
            ? 'دخلت غرفة الفحص — اسحب الكاسيت المصوّر من البكي.'
            : 'فتحت الباب ودخلت إلى غرفة الفحص.'
          : crExposedPending
            ? 'Entered Exam Room — retrieve the exposed cassette from the Bucky.'
            : 'Opened lead door and entered the Exam Room.'
      );
    }
  };

  const handleTechZoneChange = useCallback(
    (loc: TechLocation) => {
      setTechLocation(loc);
      if (loc === 'BOOTH') {
        showToast(
          isAr
            ? 'دخلت غرفة التحكم — أغلق الباب الرصاصي قبل إطلاق الأشعة.'
            : 'Entered Control Booth — close the lead door before exposing.'
        );
      } else {
        showToast(isAr ? 'دخلت إلى غرفة الفحص.' : 'Entered the Exam Room.');
      }
    },
    [showToast, isAr]
  );

  const handlePickUpCassette = () => {
    if (hasDR) {
      showToast(
        isAr
          ? 'النظام الرقمي DR مفعّل — لا حاجة للكاسيت أو قارئ CR!'
          : 'Digital DR is active — no cassette needed!'
      );
      return;
    }
    if (techLocation !== 'ROOM') {
      showToast(
        isAr
          ? 'ادخل غرفة الفحص أولاً لأخذ الكاسيت.'
          : 'Enter the exam room first to pick up the cassette.'
      );
      return;
    }
    if (cassetteState === 'IN_HAND' || cassetteState === 'EXPOSED_IN_HAND') {
      showToast(
        cassetteState === 'EXPOSED_IN_HAND'
          ? isAr
            ? 'الكاسيت المصوّر في يدك — عد لغرفة التحكم وأدخله في قارئ CR.'
            : 'Exposed cassette in hand — return to booth and insert into CR Reader.'
          : isErect
            ? isAr
              ? 'الكاسيت في يدك — انقر على الحامل الواقف (البكي) لإدخاله.'
              : 'Cassette in hand — click Wall Bucky to insert.'
            : isAr
              ? 'الكاسيت في يدك — انقر على درج الطاولة لإدخال الكاسيت.'
              : 'Cassette in hand — click Table Bucky to insert.'
      );
      return;
    }
    setCassetteState('IN_HAND');
    soundFx.playPurchase();
    showToast(
      isErect
        ? isAr
          ? 'أخذت الكاسيت بيدك — ضعه الآن داخل الحامل الواقف (البكي).'
          : 'Picked up cassette — insert it into the Wall Bucky.'
        : isAr
          ? 'أخذت الكاسيت بيدك — ضعه الآن داخل الدرج تحت الطاولة.'
          : 'Picked up cassette — insert it into the under-table Bucky.'
    );
  };

  const handleRetrieveExposedCassette = () => {
    if (techLocation !== 'ROOM') {
      showToast(
        isAr
          ? 'ادخل غرفة الفحص أولاً لسحب الكاسيت المصوّر.'
          : 'Enter the exam room first to retrieve the exposed cassette.'
      );
      return;
    }
    setCassetteState('EXPOSED_IN_HAND');
    soundFx.playPurchase();
    showToast(
      isAr
        ? 'أخذت الكاسيت المصوّر! عد إلى غرفة التحكم وأدخله في جهاز قارئ الكاسيت (CR).'
        : 'Retrieved exposed cassette! Go to the control booth and insert it into the CR Reader.'
    );
  };

  const handleInsertTableBucky = () => {
    if (crExposedPending && cassetteState === 'TABLE_BUCKY') {
      handleRetrieveExposedCassette();
      return;
    }
    if (techLocation !== 'ROOM') {
      showToast(
        isAr
          ? 'ادخل غرفة الفحص لوضع الكاسيت تحت الطاولة.'
          : 'Enter the exam room to insert the cassette under the table.'
      );
      return;
    }
    if (cassetteState === 'RACK') {
      showToast(
        isAr
          ? 'خذ الكاسيت من الحامل الجانبي أولاً.'
          : 'Pick up the cassette from the side rack first.'
      );
      return;
    }
    if (cassetteState === 'EXPOSED_IN_HAND') {
      showToast(
        isAr
          ? 'هذا الكاسيت مصوّر! اذهب لغرفة التحكم وأدخله في قارئ CR.'
          : 'This cassette is already exposed — take it to the CR Reader!'
      );
      return;
    }
    if (isErect) {
      soundFx.playError();
      showToast(
        isAr
          ? 'المريض واقف! ضع الكاسيت في الحامل الواقف (البكي) وليس تحت الطاولة.'
          : 'Patient is standing! Insert cassette into the Wall Bucky.'
      );
      return;
    }
    setCassetteState('TABLE_BUCKY');
    soundFx.playPurchase();
    showToast(
      isAr
        ? 'تم إدخال الكاسيت تحت الطاولة بنجاح.'
        : 'Cassette inserted into Table Bucky.'
    );
  };

  const handleInsertWallBucky = () => {
    if (crExposedPending && cassetteState === 'WALL_BUCKY') {
      handleRetrieveExposedCassette();
      return;
    }
    if (techLocation !== 'ROOM') {
      showToast(
        isAr
          ? 'ادخل غرفة الفحص لوضع الكاسيت في الحامل الواقف.'
          : 'Enter the exam room to place the cassette in the Wall Bucky.'
      );
      return;
    }
    if (cassetteState === 'RACK') {
      showToast(
        isAr
          ? 'خذ الكاسيت من الحامل الجانبي أولاً.'
          : 'Pick up the cassette from the side rack first.'
      );
      return;
    }
    if (cassetteState === 'EXPOSED_IN_HAND') {
      showToast(
        isAr
          ? 'هذا الكاسيت مصوّر! اذهب لغرفة التحكم وأدخله في قارئ CR.'
          : 'This cassette is already exposed — take it to the CR Reader!'
      );
      return;
    }
    if (!isErect) {
      soundFx.playError();
      showToast(
        isAr
          ? 'المريض مستلقٍ على الطاولة! أدخل الكاسيت تحت الطاولة.'
          : 'Patient is on the table! Insert cassette into the Table Bucky.'
      );
      return;
    }
    setCassetteState('WALL_BUCKY');
    soundFx.playPurchase();
    showToast(
      isAr
        ? 'تم تثبيت الكاسيت داخل الحامل الواقف (البكي) بنجاح.'
        : 'Cassette locked into Wall Bucky.'
    );
  };

  const handleInsertCrReader = () => {
    if (isDeveloping || isExposing) return;
    if (hasDR) {
      showToast(
        isAr
          ? 'لديك نظام DR رقمي — الصور تنتقل مباشرة للكمبيوتر دون قارئ CR!'
          : 'Digital DR active — radiographs transfer straight to PC!'
      );
      return;
    }
    if (!crExposedPending || !pendingCrEvalRef.current) {
      soundFx.playError();
      showToast(
        isAr
          ? 'لا يوجد كاسيت مصوّر حالياً لقراءته. صوّر المريض أولاً ثم اسحب الكاسيت.'
          : 'No exposed cassette to scan yet. Expose the patient and retrieve the cassette first.'
      );
      return;
    }
    if (cassetteState !== 'EXPOSED_IN_HAND') {
      soundFx.playError();
      showToast(
        isAr
          ? 'اذهب لغرفة الفحص واسحب الكاسيت المصوّر من البكي بيدك أولاً!'
          : 'Go to the exam room and pick up the exposed cassette from the Bucky first!'
      );
      return;
    }

    if (techLocation !== 'BOOTH') {
      setTechLocation('BOOTH');
    }

    const evalRes = pendingCrEvalRef.current;
    setCassetteState('IN_CR_READER');
    setCrExposedPending(false);
    setIsDeveloping(true);
    setConsoleOpen(false);
    soundFx.playPurchase();
    showToast(
      isAr
        ? 'جاري مسح الكاسيت داخل قارئ CR وتحويل الصورة للحاسوب...'
        : 'Scanning CR cassette & transferring image to Clinic PC...'
    );

    const baseDelay = hasAutoProc ? 720 : 1450;
    const scanDelay = hasTubeCooler ? Math.round(baseDelay * 0.65) : baseDelay;

    if (developTimerRef.current) window.clearTimeout(developTimerRef.current);
    developTimerRef.current = window.setTimeout(() => {
      pendingCrEvalRef.current = null;
      setIsDeveloping(false);
      setCassetteState('RACK');
      setCurrentEvaluation(evalRes);
      setPcTab('IMAGE');
      setPcOpen(true);
      triggerEvaluationSpeech(evalRes);
      if (!evalRes.success) {
        soundFx.playError();
      }
    }, scanDelay);
  };

  const handleSceneInteract = (action: SceneTargetAction) => {
    switch (action.type) {
      case 'REGION':
        handleSelectRegion(action.region, action.side);
        break;
      case 'PATIENT_POSTURES':
        if (techLocation !== 'ROOM') {
          showToast(
            isAr
              ? 'ادخل غرفة الفحص أولاً لتغيير وضعية المريض.'
              : 'Enter the exam room first to position the patient.'
          );
          return;
        }
        if (
          !isDeveloping &&
          !isExposing &&
          !caseApproved &&
          !crExposedPending &&
          !allDayPatientsDone
        ) {
          soundFx.playPurchase();
          setPatientMenuOpen(true);
        }
        break;
      case 'PATIENT_BODY':
        if (techLocation !== 'ROOM') {
          showToast(
            isAr
              ? 'ادخل غرفة الفحص أولاً لتحديد المنطقة ووضعية المريض.'
              : 'Enter the exam room first to position the patient.'
          );
          return;
        }
        showToast(
          isAr
            ? 'اضغط ضغطاً مطولاً على المريض لفتح قائمة الوضعيات، أو اضغط على العضو لتحديد المنطقة.'
            : 'Long-press patient to open postures, or tap an anatomical area to select the region.'
        );
        break;
      case 'PATIENT_REQUISITION':
        if (!activePatient) return;
        soundFx.playPurchase();
        setRequisitionOpen(true);
        break;
      case 'CASSETTE_RACK':
        handlePickUpCassette();
        break;
      case 'TABLE_BUCKY':
        handleInsertTableBucky();
        break;
      case 'WALL_BUCKY':
        handleInsertWallBucky();
        break;
      case 'CR_READER':
        handleInsertCrReader();
        break;
      case 'DOOR':
        setDoorClosed((prev) => {
          const next = !prev;
          soundFx.playPurchase();
          showToast(
            next
              ? isAr
                ? 'تم إغلاق الباب الرصاصي.'
                : 'Lead door closed.'
              : isAr
                ? 'تم فتح الباب الرصاصي — يمكنك المرور الآن.'
                : 'Lead door opened — you may pass.'
          );
          return next;
        });
        break;
      case 'WAITING_DOOR': {
        soundFx.playPurchase();
        const waitingList = queue.filter((p) => p.id !== activePatient?.id);
        const nextPatient = waitingList[0];
        showToast(
          nextPatient
            ? isAr
              ? `صالة الانتظار: المريض القادم ${nextPatient.nameAr} (عدد المنتظرين: ${waitingList.length})`
              : `Waiting Room: Next patient ${nextPatient.nameAr} (${waitingList.length} waiting)`
            : isAr
              ? 'صالة الانتظار فارغة حالياً.'
              : 'Waiting Room is currently empty.'
        );
        break;
      }
      case 'CT_DOOR':
        if (!hasCT) {
          soundFx.playError();
          showToast(
            isAr
              ? 'غرفة السيتي (المفراس CT) مغلقة 🔒 — جهاز السيتي غير متوفر للشراء حالياً وسيتوفر قريباً.'
              : 'CT Scanner Suite locked 🔒 — currently unavailable (Coming Soon).'
          );
          return;
        }
        setCtDoorOpen((prev) => {
          const next = !prev;
          soundFx.playPurchase();
          showToast(
            next
              ? isAr
                ? 'تم فتح باب غرفة السيتي (المفراس CT).'
                : 'CT Suite door opened.'
              : isAr
                ? 'تم إغلاق باب غرفة السيتي.'
                : 'CT Suite door closed.'
          );
          return next;
        });
        break;
      case 'MRI_DOOR':
        if (!hasMRI) {
          soundFx.playError();
          showToast(
            isAr
              ? 'غرفة الرنين المغناطيسي (MRI) مغلقة 🔒 — جهاز الرنين غير متوفر للشراء حالياً وسيتوفر قريباً.'
              : 'MRI Suite locked 🔒 — currently unavailable (Coming Soon).'
          );
          return;
        }
        setMriDoorOpen((prev) => {
          const next = !prev;
          soundFx.playPurchase();
          showToast(
            next
              ? isAr
                ? 'تم فتح باب غرفة الرنين المغناطيسي (MRI).'
                : 'MRI Suite door opened.'
              : isAr
                ? 'تم إغلاق باب غرفة الرنين المغناطيسي.'
                : 'MRI Suite door closed.'
          );
          return next;
        });
        break;
      case 'CONSOLE':
        if (techLocation !== 'BOOTH') {
          setTechLocation('BOOTH');
          setDoorClosed(true);
        }
        setConsoleOpen(true);
        soundFx.playPurchase();
        break;
      case 'PC':
        setPcTab(currentEvaluation ? 'IMAGE' : 'LOG');
        setPcOpen(true);
        soundFx.playPurchase();
        break;
    }
  };

  const handleRequestBreathHold = () => {
    if (!activePatient || breathHeld || !isChestExam) return;
    setBreathHeld(true);
    soundFx.playPurchase();
    triggerPatientSpeech(
      'تم... سأكتم نفسي الآن حتى تنتهي.',
      'Okay... holding my breath steady now.'
    );
    showToast(
      isAr
        ? 'عبر الميكروفون: "خذ نفساً عميقاً واحبسه الآن..." (+$2 جودة)'
        : 'Intercom: "Take a deep breath and hold it..." (+$2 quality)'
    );
  };

  const handleAutoCalibrate = () => {
    if (!hasProtocolAssist || !activePatient) return;
    const autoSide: BodySide = isBilateralRegion(requestedExam.region)
      ? activePatient.requestedSide && activePatient.requestedSide !== 'NONE'
        ? activePatient.requestedSide
        : 'RIGHT'
      : 'NONE';
    setSelectedRegion(requestedExam.region);
    setSelectedSide(autoSide);
    setSelectedPosture(requestedExam.recommendedPosture);
    setSelectedProjection(requestedExam.recommendedProjection);
    setKvp(
      Math.round(
        (effectiveRanges.kvpRange[0] + effectiveRanges.kvpRange[1]) / 2
      )
    );
    setMas(
      Math.round(
        ((effectiveRanges.masRange[0] + effectiveRanges.masRange[1]) / 2) * 2
      ) / 2
    );
    if (hasLeadShield) setShieldUsed(true);
    setBreathHeld(requestedExam.region === 'chest');
    if (!isBoreScan && !hasDR) {
      setCassetteState(
        requestedExam.recommendedPosture.startsWith('ERECT_')
          ? 'WALL_BUCKY'
          : 'TABLE_BUCKY'
      );
    }
    showToast(
      isAr
        ? `تم ضبط بروتوكول ${requestedExam.titleEn} تلقائياً${isChildPatient ? ' (جرعة أطفال)' : ''}`
        : `Auto-calibrated ${requestedExam.titleEn}${isChildPatient ? ' (Pediatric)' : ''}`
    );
  };

  const handleExpose = () => {
    if (
      !activePatient ||
      isDeveloping ||
      isExposing ||
      caseApproved ||
      crExposedPending
    ) {
      return;
    }

    if (techLocation !== 'BOOTH' || !doorClosed) {
      soundFx.playError();
      showToast(
        isAr
          ? 'سلامة إشعاعية: يجب الخروج لغرفة التحكم وإغلاق الباب الرصاصي قبل إطلاق الجرعة!'
          : 'Radiation Safety: Return to the Control Booth and close the lead door first!'
      );
      return;
    }

    if (!cassetteReady) {
      soundFx.playError();
      showToast(
        isErect
          ? isAr
            ? 'تأكد من وضع الكاسيت داخل الحامل الواقف (البكي) قبل التصوير!'
            : 'Insert the CR cassette into the Wall Bucky before exposing!'
          : isAr
            ? 'تأكد من إدخال الكاسيت داخل درج الطاولة قبل التصوير!'
            : 'Insert the CR cassette into the Table Bucky before exposing!'
      );
      return;
    }

    const needsPhysicalFilm = requestedExam.modality === 'XRAY' && !hasDR;
    if (needsPhysicalFilm && save.films <= 0) {
      soundFx.playError();
      showToast(
        isAr
          ? 'نفدت أفلام الأشعة! افتح الحاسوب لشراء كرتون أفلام.'
          : 'Out of X-Ray films! Open Clinic PC to buy a film carton.'
      );
      setPcTab('SHOP');
      setPcOpen(true);
      return;
    }

    const effectiveProjection = deriveProjectionFromState(
      selectedPosture,
      selectedRegion,
      requestedExam.modality
    );
    soundFx.playExpose();
    setIsExposing(true);
    setSelectedProjection(effectiveProjection);
    setCapturedPosture(selectedPosture);
    setCapturedProjection(effectiveProjection);
    setCapturedSide(selectedSide);

    const evaluation = evaluateExposure({
      exam: requestedExam,
      selectedRegion,
      selectedSide,
      requestedSide: activePatient.requestedSide ?? 'NONE',
      patientAge: activePatient.age,
      selectedProjection: effectiveProjection,
      selectedPosture,
      kvp,
      mas,
      shieldUsed: hasLeadShield && shieldUsed,
      patientPrepped: effectiveBreathHeld,
      ownedUpgrades: save.ownedUpgrades,
    });

    if (evaluation.filmConsumed > 0 || !evaluation.success) {
      commitSaveUpdate((prev) => ({
        ...prev,
        films: Math.max(0, prev.films - evaluation.filmConsumed),
        retakesCount: evaluation.success
          ? prev.retakesCount
          : prev.retakesCount + 1,
        dailyFilmsUsed:
          (prev.dailyFilmsUsed ?? 0) + evaluation.filmConsumed,
        dailyRetakes: evaluation.success
          ? (prev.dailyRetakes ?? 0)
          : (prev.dailyRetakes ?? 0) + 1,
      }));
    }

    if (exposeTimerRef.current) window.clearTimeout(exposeTimerRef.current);
    if (developTimerRef.current) window.clearTimeout(developTimerRef.current);

    const exposeMs = hasTubeCooler ? 460 : 720;
    exposeTimerRef.current = window.setTimeout(() => {
      setIsExposing(false);

      // Digital DR (or Bore scan): transfers instantaneously straight to Clinic PC!
      if (hasDR || isBoreScan) {
        const baseDelay = hasDR ? 240 : 480;
        const developDelay = hasTubeCooler
          ? Math.round(baseDelay * 0.65)
          : baseDelay;
        setIsDeveloping(true);
        setPcTab('IMAGE');
        setPcOpen(true);

        developTimerRef.current = window.setTimeout(() => {
          setIsDeveloping(false);
          setCurrentEvaluation(evaluation);
          triggerEvaluationSpeech(evaluation);
          if (!evaluation.success) {
            soundFx.playError();
          }
        }, developDelay);
      } else {
        // Initial CR Cassette Workflow: go retrieve cassette from Bucky -> CR Reader in Booth!
        pendingCrEvalRef.current = evaluation;
        setCrExposedPending(true);
        setConsoleOpen(false);
        showToast(
          isAr
            ? 'تم التصوير على كاسيت CR! افتح الباب، اذهب لأخذ الكاسيت من غرفة الفحص ثم أدخله في قارئ CR هنا.'
            : 'CR Cassette Exposed! Enter exam room to retrieve cassette, then insert it into the CR Reader here.'
        );
      }
    }, exposeMs);
  };

  const handleApproveAndCollect = () => {
    if (
      !currentEvaluation ||
      !currentEvaluation.success ||
      !activePatient ||
      caseApproved
    ) {
      return;
    }

    soundFx.playCashEarned();

    const gross = currentEvaluation.totalEarned;
    const debtRepayment = Math.min(save.filmDebt, gross);
    const netToCash = gross - debtRepayment;

    const record: CompletedCase = {
      id: `case-${Date.now()}`,
      patientNameAr: activePatient.nameAr,
      patientAvatarPath: activePatient.avatarPath,
      patientAge: activePatient.age,
      examTitleAr: requestedExam.titleEn,
      examImagePath: requestedExam.imagePath,
      modality: requestedExam.modality,
      sideUsed: capturedSide ?? selectedSide,
      findingAr: activePatient.findingAr,
      earned: gross,
      kvpUsed: kvp,
      masUsed: mas,
      shieldUsed: hasLeadShield && shieldUsed,
      postureUsed: selectedPosture,
      timestamp: Date.now(),
    };

    const nextServedCount = save.patientsServed + 1;

    commitSaveUpdate((prev) => ({
      ...prev,
      cash: prev.cash + netToCash,
      totalRevenue: prev.totalRevenue + gross,
      filmDebt: prev.filmDebt - debtRepayment,
      patientsServed: prev.patientsServed + 1,
      dailyEarned: (prev.dailyEarned ?? 0) + gross,
      dailySpentExpenses: (prev.dailySpentExpenses ?? 0) + debtRepayment,
      completedCases: [record, ...prev.completedCases].slice(0, 60),
    }));

    setCaseApproved(true);
    setPcOpen(false);
    if (nextServedCount > 0 && nextServedCount % 10 === 0) {
      setDesignerMilestoneCount(nextServedCount);
      setDesignerPopupOpen(true);
    }
    const isLastToday = dailyPatientsHandled + 1 >= dailyTargetPatients;
    showToast(
      debtRepayment > 0
        ? isAr
          ? `تم اعتماد الصورة وتحصيل $${gross} (سُدّد $${debtRepayment}). ${isLastToday ? 'اضغط "انتهاء الفحص" ثم "إنهاء اليوم".' : 'اضغط "انتهاء الفحص" لاستقبال المريض التالي.'}`
          : `Approved & earned $${gross} ($${debtRepayment} credit repaid). Press Finish Exam.`
        : isAr
          ? `تم اعتماد الصورة واستلام $${gross}. ${isLastToday ? 'اضغط "انتهاء الفحص" ثم "إنهاء اليوم".' : 'اضغط "انتهاء الفحص" لاستقبال المريض التالي.'}`
          : `Approved & collected $${gross}. Press Finish Exam.`
    );
  };

  const handleFinishExamAndNextPatient = () => {
    if (!activePatient || isExposing || isDeveloping) return;

    const departingId = activePatient.id;
    const willFinishAllToday =
      dailyPatientsHandled + 1 >= dailyTargetPatients && queue.length <= 1;

    setQueue((prev) => prev.filter((p) => p.id !== departingId));
    commitSaveUpdate((prev) => ({
      ...prev,
      dailyPatientsHandled: (prev.dailyPatientsHandled ?? 0) + 1,
    }));

    setActivePatientId(null);
    setCurrentEvaluation(null);
    setCapturedPosture(null);
    setCapturedProjection(null);
    setCapturedSide(null);
    pendingCrEvalRef.current = null;
    setCrExposedPending(false);
    setCaseApproved(false);
    setBreathHeld(false);
    setCassetteState('RACK');
    setDoorClosed(false);
    setTechLocation('ROOM');
    moveCountRef.current = 0;
    setPatientSpeech(null);
    setRequisitionOpen(false);
    soundFx.playPurchase();
    showToast(
      willFinishAllToday
        ? isAr
          ? 'تم إتمام جميع مراجعي اليوم! اضغط على زر "إنهاء اليوم" لعرض الإحصائيات.'
          : 'All daily patients completed! Press "End Day" to view the daily report.'
        : isAr
          ? 'غادر المريض غرفة الفحص ودخل المريض التالي.'
          : 'Patient departed — next patient entered the room.'
    );
  };

  const handleEndDay = () => {
    if (!allDayPatientsDone || isExposing || isDeveloping) return;

    if (save.dayCompletedAwaitingNext && save.dayHistory?.length) {
      setActiveDaySummary(save.dayHistory[0]);
      setDaySummaryOpen(true);
      return;
    }

    const earned = save.dailyEarned ?? 0;
    const spentPurchases = save.dailySpentPurchases ?? 0;
    const spentExpenses = save.dailySpentExpenses ?? 0;
    const profitBeforeDoctor = earned - spentPurchases - spentExpenses;
    const doctorDeduction =
      profitBeforeDoctor > 0 ? Math.round(profitBeforeDoctor * 0.1) : 0;
    const netProfit = profitBeforeDoctor - doctorDeduction;

    const record: DaySummaryRecord = {
      dayNumber: currentDay,
      patientsTarget: dailyTargetPatients,
      patientsCompleted: dailyPatientsHandled,
      earned,
      spentPurchases,
      spentExpenses,
      doctorDeduction,
      netProfit,
      retakes: save.dailyRetakes ?? 0,
      filmsUsed: save.dailyFilmsUsed ?? 0,
      endedAt: Date.now(),
    };

    soundFx.playCashEarned();
    commitSaveUpdate((prev) => ({
      ...prev,
      cash: Math.max(0, prev.cash - doctorDeduction),
      dayCompletedAwaitingNext: true,
      dayHistory: [record, ...(prev.dayHistory ?? [])].slice(0, 30),
    }));

    setActiveDaySummary(record);
    setDaySummaryOpen(true);
  };

  const handleStartNewDay = () => {
    const nextDay = currentDay + 1;
    const nextTarget = rollDailyTargetPatients(save.ownedUpgrades);

    commitSaveUpdate((prev) => ({
      ...prev,
      currentDay: nextDay,
      dailyTargetPatients: nextTarget,
      dailyPatientsHandled: 0,
      dailyEarned: 0,
      dailySpentPurchases: 0,
      dailySpentExpenses: 0,
      dailyRetakes: 0,
      dailyFilmsUsed: 0,
      dayCompletedAwaitingNext: false,
    }));

    setQueue(buildDayInitialQueue(save.ownedUpgrades, nextTarget, 0, maxQueueSize));
    setActivePatientId(null);
    setCurrentEvaluation(null);
    setCapturedPosture(null);
    setCapturedProjection(null);
    setCapturedSide(null);
    pendingCrEvalRef.current = null;
    setCrExposedPending(false);
    setCaseApproved(false);
    setBreathHeld(false);
    setCassetteState('RACK');
    setDoorClosed(false);
    setTechLocation('ROOM');
    moveCountRef.current = 0;
    setPatientSpeech(null);
    setRequisitionOpen(false);
    setDaySummaryOpen(false);
    setActiveDaySummary(null);
    soundFx.playPurchase();
    showToast(
      isAr
        ? `بدأ اليوم #${nextDay} — وصل اليوم ${nextTarget} مراجعاً للعيادة!`
        : `Day #${nextDay} started — ${nextTarget} patients arriving today!`
    );
  };

  const handleBuyCarton = (count: 0.5 | 1 | 5 | 10) => {
    const cost =
      count === 0.5
        ? MINI_PACK_COST
        : count === 1
          ? FILM_CARTON_COST
          : count === 5
            ? BULK_CARTON_COST
            : MEGA_CRATE_COST;
    const filmsToAdd =
      count === 0.5
        ? MINI_PACK_SIZE
        : count === 1
          ? FILM_CARTON_SIZE
          : count === 5
            ? BULK_CARTON_SIZE
            : MEGA_CRATE_SIZE;

    if (save.cash < cost) {
      soundFx.playError();
      showToast(
        isAr ? 'الرصيد الحالي لا يكفي لشراء هذا العرض.' : 'Insufficient cash.'
      );
      return;
    }

    soundFx.playPurchase();
    commitSaveUpdate((prev) => ({
      ...prev,
      cash: prev.cash - cost,
      films: prev.films + filmsToAdd,
      cartonsBought: prev.cartonsBought + (count === 0.5 ? 1 : count),
      dailySpentExpenses: (prev.dailySpentExpenses ?? 0) + cost,
    }));
    showToast(
      isAr
        ? `تمت إضافة ${filmsToAdd} فيلم أشعة إلى مخزون العيادة`
        : `Added ${filmsToAdd} X-ray films to inventory`
    );
  };

  const handleTakeEmergencyLoan = () => {
    soundFx.playPurchase();
    commitSaveUpdate((prev) => ({
      ...prev,
      films: prev.films + 10,
      filmDebt: prev.filmDebt + EMERGENCY_LOAN_DEBT,
    }));
    showToast(
      isAr
        ? `تم استلام 10 أفلام طوارئ (آجل $${EMERGENCY_LOAN_DEBT})`
        : `Received 10 emergency films ($${EMERGENCY_LOAN_DEBT} credit)`
    );
  };

  const handleBuyUpgrade = (id: UpgradeId) => {
    if (save.ownedUpgrades.includes(id)) return;
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return;
    const upTitle = isAr ? upgrade.titleAr : UPGRADE_EN[id].title;
    if (upgrade.comingSoon) {
      soundFx.playError();
      showToast(
        isAr
          ? `${upTitle} غير متوفر للشراء حالياً — سيتوفر قريباً.`
          : `${upTitle} is currently unavailable — Coming Soon.`
      );
      return;
    }
    if (
      upgrade.requiredPatientsServed &&
      save.patientsServed < upgrade.requiredPatientsServed
    ) {
      soundFx.playError();
      showToast(
        isAr
          ? `هذا الخيار مقفل حالياً — يُفتح بعد فحص ${upgrade.requiredPatientsServed} مريض (${save.patientsServed}/${upgrade.requiredPatientsServed}).`
          : `Locked — unlocks after ${upgrade.requiredPatientsServed} patients (${save.patientsServed}/${upgrade.requiredPatientsServed}).`
      );
      return;
    }
    if (save.cash < upgrade.cost) {
      soundFx.playError();
      return;
    }

    soundFx.playPurchase();
    commitSaveUpdate((prev) => {
      const nextUpgrades = [...prev.ownedUpgrades, id];
      let nextDailyTarget = prev.dailyTargetPatients ?? 12;
      if (
        id === 'waiting_room' &&
        !prev.dayCompletedAwaitingNext &&
        nextDailyTarget < 20
      ) {
        nextDailyTarget = rollDailyTargetPatients(nextUpgrades);
      }
      return {
        ...prev,
        cash: prev.cash - upgrade.cost,
        ownedUpgrades: nextUpgrades,
        dailySpentPurchases: (prev.dailySpentPurchases ?? 0) + upgrade.cost,
        dailyTargetPatients: nextDailyTarget,
      };
    });

    if (id === 'lead_shield') setShieldUsed(true);
    if (id === 'digital_dr') {
      setCrExposedPending(false);
      pendingCrEvalRef.current = null;
      setCassetteState('RACK');
    }
    if (id === 'ct_scanner') {
      setCtDoorOpen(true);
      showToast(
        isAr
          ? 'تم تركيب جهاز المفراس (CT) وفتح باب غرفة السيتي في العيادة!'
          : 'CT Scanner installed & suite unlocked!'
      );
    } else if (id === 'mri_suite') {
      setMriDoorOpen(true);
      showToast(
        isAr
          ? 'تم تركيب جهاز الرنين المغناطيسي وفتح باب غرفة الـ MRI!'
          : '1.5T MRI Suite installed & unlocked!'
      );
    } else if (id === 'waiting_room') {
      showToast(
        isAr
          ? 'تمت توسعة صالة الاستقبال — ارتفع عدد المراجعين اليومي إلى 20–25 مريضاً!'
          : 'Waiting Room expanded — daily visitors increased to 20–25 patients!'
      );
    } else {
      showToast(
        isAr
          ? `تم تركيب ${upTitle} بنجاح`
          : `Installed ${upTitle} successfully`
      );
    }
  };

  const mandatoryUpdateOverlay = (
    <UpdateNotificationBanner
      visible={appUpdate.isBannerVisible}
      remoteVersion={appUpdate.remoteVersion}
      onUpdateNow={appUpdate.applyUpdate}
    />
  );

  // =========================================================================
  // RENDER: AUTH LOADING CHECK
  // =========================================================================
  if (authChecking) {
    return (
      <div className="app-landscape-stage">
        <div className="auth-check-screen min-h-[var(--stage-h,100vh)] bg-[#09111C] text-slate-100 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <p className="text-sm text-slate-300">
            {isAr
              ? 'جاري استرجاع حساب تقني الأشعة وتجهيز الغرفة...'
              : 'Restoring radiographer account & preparing 3D suite...'}
          </p>
        </div>
        {mandatoryUpdateOverlay}
      </div>
    );
  }

  // =========================================================================
  // RENDER: AUTH SCREEN (LOGIN / REGISTER)
  // =========================================================================
  if (screenMode === 'AUTH' || !techProfile) {
    return (
      <div className="app-landscape-stage">
        <AuthScreen
          initialSave={INITIAL_SAVE}
          onAuthenticated={handleAuthenticated}
        />
        {mandatoryUpdateOverlay}
      </div>
    );
  }

  // =========================================================================
  // RENDER: FULL-VIEWPORT FIRST-PERSON 3D CLINIC SIMULATION
  // =========================================================================
  const lowFilmsWarning = !hasDR && save.films <= 5;
  const cassetteStepLabel = isBoreScan
    ? isAr
      ? 'جهاز مقطعي/رنين جاهز'
      : 'CT/MRI Gantry Ready'
    : hasDR
      ? isAr
        ? 'لوح رقمي DR جاهز'
        : 'Digital DR Panel Ready'
      : cassetteState === 'EXPOSED_IN_HAND'
        ? isAr
          ? 'كاسيت مصوّر بيدك (أدخله في CR)'
          : 'Exposed Cassette (Insert in CR)'
        : cassetteState === 'IN_CR_READER'
          ? isAr
            ? 'جاري قراءة الكاسيت في CR...'
            : 'Reading in CR Digitizer...'
          : cassetteState === 'RACK'
            ? isAr
              ? 'الكاسيت على الحامل'
              : 'Cassette on Rack'
            : cassetteState === 'IN_HAND'
              ? isAr
                ? 'الكاسيت في يدك'
                : 'Cassette in Hand'
              : cassetteState === 'TABLE_BUCKY'
                ? crExposedPending
                  ? isAr
                    ? 'اسحب الكاسيت المصوّر من الطاولة'
                    : 'Retrieve exposed cassette from Table'
                  : isAr
                    ? 'الكاسيت تحت الطاولة'
                    : 'Cassette in Table Bucky'
                : crExposedPending
                  ? isAr
                    ? 'اسحب الكاسيت المصوّر من البكي الواقف'
                    : 'Retrieve exposed cassette from Wall Bucky'
                  : isAr
                    ? 'الكاسيت في البكي الواقف'
                    : 'Cassette in Wall Bucky';

  return (
    <div className="app-landscape-stage">
      <div className="hud-play-root relative w-full h-[var(--stage-h,100vh)] overflow-hidden bg-[#09111C] text-slate-100 select-none">
        {/* FULL-SCREEN 3D RADIOLOGY CLINIC */}
        <RadiologyRoom3D
          patient={activePatient}
          waitingPatients={queue
            .filter((p) => p.id !== activePatient?.id)
            .slice(0, 4)}
          requestedExam={requestedExam}
          selectedRegion={selectedRegion}
          selectedSide={selectedSide}
          selectedPosture={selectedPosture}
          techLocation={techLocation}
          doorClosed={doorClosed}
          ctDoorOpen={ctDoorOpen}
          mriDoorOpen={mriDoorOpen}
          cassetteState={cassetteState}
          crExposedPending={crExposedPending}
          isDeveloping={isDeveloping}
          hasDR={hasDR}
          shieldUsed={hasLeadShield && shieldUsed}
          patientPrepped={effectiveBreathHeld}
          isExposing={isExposing}
          patientSpeech={patientSpeech}
          language={lang}
          brightness={brightness}
          paused={
            pcOpen ||
            designerPopupOpen ||
            controlsModalOpen ||
            daySummaryOpen ||
            appUpdate.updateAvailable
          }
        ownedUpgrades={save.ownedUpgrades}
        joystickRef={joystickRef}
        onTechZoneChange={handleTechZoneChange}
        onSceneInteract={handleSceneInteract}
      />

      {/* TOP BAR HUD */}
      <header className="hud-header-bar pointer-events-none fixed top-0 inset-x-0 z-20 p-1.5 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start justify-between gap-1.5 sm:gap-3">
        {/* Telemetry & Account Bar */}
        <div className="hud-telemetry-card pointer-events-auto flex flex-wrap items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 rounded-xl border border-slate-800 bg-[#08101C]/95 px-2.5 sm:px-3.5 py-1.5 sm:py-2 shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 text-emerald-400 font-mono-num font-bold text-xs sm:text-sm">
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>${save.cash.toLocaleString('en-US')}</span>
            </div>

            <span className="text-slate-700">|</span>

            <div
              className={`flex items-center gap-1 font-mono-num font-bold text-[11px] sm:text-xs ${
                hasDR
                  ? 'text-cyan-300'
                  : lowFilmsWarning
                    ? 'text-amber-300'
                    : 'text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                {hasDR
                  ? isAr
                    ? 'رقمي DR'
                    : 'DR Digital'
                  : isAr
                    ? `${save.films} فيلم`
                    : `${save.films} films`}
              </span>
            </div>

            <span className="text-slate-700">|</span>

            <div
              className={`flex items-center gap-1 text-[11px] sm:text-xs font-mono-num font-semibold ${
                allDayPatientsDone ? 'text-emerald-300' : 'text-cyan-200'
              }`}
              title={isAr ? 'مراجعو اليوم' : 'Daily Patients'}
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                {isAr
                  ? `اليوم ${currentDay}: ${dailyPatientsHandled}/${dailyTargetPatients}`
                  : `Day ${currentDay}: ${dailyPatientsHandled}/${dailyTargetPatients}`}
              </span>
            </div>
          </div>

          <span className="hidden md:inline text-slate-700">|</span>

          <span className="hidden md:inline text-xs text-slate-300 font-medium">
            {techProfile.name} ·{' '}
            <span className="text-cyan-300">{rankTitle}</span>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer transition-colors"
              title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                commitSaveUpdate((prev) => ({
                  ...prev,
                  soundEnabled: !prev.soundEnabled,
                }))
              }
              title={
                save.soundEnabled
                  ? isAr
                    ? 'كتم الصوت'
                    : 'Mute Sound'
                  : isAr
                    ? 'تفعيل الصوت'
                    : 'Enable Sound'
              }
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
            >
              {save.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setBrightnessOpen((v) => !v)}
              title={isAr ? 'التحكم بالسطوع' : 'Brightness Control'}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg border text-[10.5px] sm:text-xs font-semibold cursor-pointer transition-colors ${
                brightnessOpen
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 hover:border-amber-400/50 text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="hidden sm:inline">
                {isAr ? 'السطوع' : 'Brightness'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setControlsModalOpen(true)}
              title={isAr ? 'إعدادات التحكم والتحديثات' : 'Controls & Updates'}
              className="relative flex items-center gap-1 px-1.5 sm:px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-[10.5px] sm:text-xs font-semibold cursor-pointer transition-colors"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{isAr ? 'إعدادات التحكم' : 'Controls'}</span>
              {appUpdate.updateAvailable && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              )}
            </button>

            <PWAInstallButton compact />

            <button
              type="button"
              onClick={() => {
                setPcTab(currentEvaluation ? 'IMAGE' : 'LOG');
                setPcOpen(true);
              }}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-[11px] sm:text-xs font-semibold cursor-pointer transition-colors"
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? 'الحاسوب' : 'PC'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleToggleLandscapeFullscreen()}
              title={
                isFullscreen
                  ? isAr
                    ? 'إنهاء ملء الشاشة'
                    : 'Exit Fullscreen'
                  : isAr
                    ? 'ملء الشاشة بالعرض'
                    : 'Landscape Fullscreen'
              }
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 cursor-pointer transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              title={isAr ? 'تسجيل الخروج' : 'Logout'}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] sm:text-xs cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {isAr ? 'خروج' : 'Exit'}
              </span>
            </button>
          </div>
        </div>

        {/* Active Patient Request Card OR End-of-Day Ready Banner */}
        {activePatient ? (
          <div className="hud-patient-card pointer-events-auto rounded-xl border border-slate-800 bg-[#08101C]/95 p-1.5 sm:p-2.5 shadow-xl sm:max-w-md w-full sm:w-auto flex items-center gap-2 sm:gap-2.5">
            <img
              src={activePatient.avatarPath}
              alt={activePatient.nameAr}
              decoding="async"
              referrerPolicy="no-referrer"
              className="hud-patient-avatar w-9 h-9 sm:w-11 sm:h-11 rounded-lg object-cover border border-slate-700 shrink-0"
            />
            <div className="hud-patient-meta min-w-0 flex-1 space-y-0.5 text-[10px] sm:text-xs leading-snug">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="font-bold text-white break-words">
                    {activePatient.nameAr} ({activePatient.age}{' '}
                    {isAr ? 'سنة' : 'y'})
                  </span>
                  {isChildPatient && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[9px] font-bold shrink-0">
                      {isAr ? 'طفل' : 'Pediatric'}
                    </span>
                  )}
                </div>
                <span className="font-mono-num font-bold text-emerald-400 shrink-0">
                  $
                  {requestedExam.modality === 'XRAY' && hasDR
                    ? 25
                    : requestedExam.baseFee}
                </span>
              </div>
              <div className="text-cyan-300 font-semibold break-words flex items-center gap-1.5 flex-wrap">
                <span>
                  {isAr ? 'المطلوب: ' : 'Order: '}
                  <span dir="ltr">{requestedExam.titleEn}</span>
                </span>
                {isBilateralRegion(requestedExam.region) &&
                  activePatient.requestedSide &&
                  activePatient.requestedSide !== 'NONE' && (
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 text-[9.5px] font-bold shrink-0">
                      {SIDE_SHORT_I18N[lang][activePatient.requestedSide]}
                    </span>
                  )}
              </div>
              <div className="text-slate-400 break-words">
                {POSTURE_SHORT_I18N[lang][requestedExam.recommendedPosture]} ·{' '}
                <span className="font-mono-num text-slate-300">
                  {effectiveRanges.kvpRange[0]}–{effectiveRanges.kvpRange[1]} kVp /{' '}
                  {effectiveRanges.masRange[0]}–{effectiveRanges.masRange[1]} mAs
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="hud-patient-card pointer-events-auto rounded-xl border border-emerald-500/70 bg-[#081C18]/95 px-3 py-2 sm:p-3 shadow-xl sm:max-w-sm w-full sm:w-auto flex items-center justify-between gap-3">
            <div className="space-y-0.5 text-[11px] sm:text-xs">
              <div className="font-bold text-emerald-300">
                {isAr
                  ? `اكتمل جميع مرضى اليوم #${currentDay} (${dailyPatientsHandled}/${dailyTargetPatients})`
                  : `All Day #${currentDay} Patients Served (${dailyPatientsHandled}/${dailyTargetPatients})`}
              </div>
              <div className="text-slate-300">
                {isAr
                  ? 'اضغط "إنهاء اليوم" لعرض التقرير المالي وبدء يوم جديد.'
                  : 'Press "End Day" to view stats and start a new day.'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleEndDay}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              {isAr ? 'إنهاء اليوم' : 'End Day'}
            </button>
          </div>
        )}
      </header>

      {/* LOW FILMS QUICK WARNING STRIP */}
      {lowFilmsWarning && (
        <div className="hud-low-films pointer-events-auto fixed top-[116px] sm:top-20 right-2.5 sm:right-4 z-20 rounded-xl border border-amber-600/70 bg-[#1B1308]/95 px-2.5 py-1 sm:px-3.5 sm:py-2 flex items-center gap-2 text-[11px] sm:text-xs text-amber-200 shadow-lg">
          <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {save.films === 0
              ? isAr
                ? 'نفدت الأفلام!'
                : 'Out of films!'
              : isAr
                ? `تبقّى ${save.films} أفلام`
                : `${save.films} films left`}
          </span>
          <button
            type="button"
            onClick={() => {
              setPcTab('SHOP');
              setPcOpen(true);
            }}
            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
          >
            {isAr ? 'المتجر' : 'Shop'}
          </button>
        </div>
      )}

      {/* LIVE FLOATING BRIGHTNESS BAR (PURE EXPOSURE ONLY, DOES NOT PAUSE SCENE) */}
      {brightnessOpen && !pcOpen && !controlsModalOpen && (
        <div className="pointer-events-auto fixed top-[52px] sm:top-[68px] left-1/2 -translate-x-1/2 z-30 rounded-xl border border-amber-500/60 bg-[#08101C]/95 px-3 py-2 shadow-2xl flex items-center gap-2 w-[min(92vw,340px)]">
          <Sun className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="text-[11px] font-bold text-slate-200 whitespace-nowrap">
            {isAr ? 'السطوع' : 'Bright'}
          </span>
          <div className="flex items-center gap-1.5 flex-1" dir="ltr">
            <button
              type="button"
              onClick={() => updateBrightness(brightness - 0.1)}
              aria-label={isAr ? 'خفض السطوع' : 'Decrease Brightness'}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={Math.round(brightness * 100)}
              onChange={(e) =>
                updateBrightness(Number(e.target.value) / 100)
              }
              className="radiology-slider flex-1"
            />
            <button
              type="button"
              onClick={() => updateBrightness(brightness + 0.1)}
              aria-label={isAr ? 'رفع السطوع' : 'Increase Brightness'}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="font-mono-num text-[11px] font-bold text-amber-200 w-9 text-center shrink-0">
            {Math.round(brightness * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setBrightnessOpen(false)}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOAST FEEDBACK */}
      {toastMsg && (
        <div className="hud-toast pointer-events-none fixed top-[116px] sm:top-20 left-1/2 -translate-x-1/2 z-30 rounded-xl border border-cyan-600/70 bg-[#081523]/95 px-3.5 py-2 text-[11px] sm:text-sm font-semibold text-cyan-100 flex items-center gap-2 shadow-2xl max-w-[92vw]">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* CONTROL BOOTH HARDWARE X-RAY GENERATOR CONSOLE */}
      {techLocation === 'BOOTH' && consoleOpen && !pcOpen && (
        <ExposureConsolePanel
          kvp={kvp}
          mas={mas}
          onChangeKvp={setKvp}
          onChangeMas={setMas}
          selectedRegion={selectedRegion}
          selectedSide={selectedSide}
          patientAge={activePatient?.age}
          doorClosed={doorClosed}
          cassetteReady={cassetteReady}
          cassetteStepLabel={cassetteStepLabel}
          crPendingScan={crExposedPending}
          hasDR={hasDR}
          isChestExam={isChestExam}
          breathHeld={effectiveBreathHeld}
          onRequestBreathHold={handleRequestBreathHold}
          hasProtocolAssist={hasProtocolAssist}
          hasDosimeter={hasDosimeter}
          kvpRange={effectiveRanges.kvpRange}
          masRange={effectiveRanges.masRange}
          onAutoCalibrate={handleAutoCalibrate}
          onExpose={handleExpose}
          isExposing={isExposing}
          isDeveloping={isDeveloping}
          caseApproved={caseApproved}
          onClose={() => setConsoleOpen(false)}
        />
      )}

      {/* VIRTUAL JOYSTICK CIRCLE (CUSTOMIZABLE POSITION & SIZE) */}
      {!pcOpen && !isRepositioningJoystick && (
        <div
          style={
            joystickConfig.preset === 'custom'
              ? {
                  left: `${Math.round(joystickConfig.customX * 100)}%`,
                  top: `${Math.round(joystickConfig.customY * 100)}%`,
                  transform: 'translate(-50%, -50%)',
                }
              : undefined
          }
          className={`hud-joystick-wrap pointer-events-auto fixed z-20 ${
            joystickConfig.preset === 'custom'
              ? ''
              : joystickConfig.preset === 'top-left'
                ? 'left-[max(0.75rem,env(safe-area-inset-left))] top-[74px] sm:top-[90px]'
                : joystickConfig.preset === 'top-right'
                  ? 'right-[max(0.75rem,env(safe-area-inset-right))] top-[74px] sm:top-[90px]'
                  : joystickConfig.preset === 'bottom-right'
                    ? 'right-[max(0.75rem,env(safe-area-inset-right))] sm:bottom-6 bottom-2 min-[640px]:bottom-16 min-[900px]:bottom-6'
                    : 'left-[max(0.75rem,env(safe-area-inset-left))] sm:bottom-6 bottom-2 min-[640px]:bottom-16 min-[900px]:bottom-6'
          }`}
        >
          <VirtualJoystick
            joystickRef={joystickRef}
            size={joystickConfig.size}
            label={
              techLocation === 'BOOTH'
                ? isAr
                  ? 'تحريك التقني (التحكم)'
                  : 'Move (Control)'
                : isAr
                  ? 'تحريك التقني'
                  : 'Move Tech'
            }
          />
        </div>
      )}

      {/* LIVE FREE-DRAG JOYSTICK REPOSITIONING OVERLAY */}
      {isRepositioningJoystick && (
        <div
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            const pt = toStagePoint(e.clientX, e.clientY);
            const dim = getStageDimensions();
            const nx = Math.min(
              0.92,
              Math.max(0.08, pt.x / (dim.width || 1))
            );
            const ny = Math.min(
              0.88,
              Math.max(0.16, pt.y / (dim.height || 1))
            );
            setDraftJoystickCoords({x: nx, y: ny});
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0 && e.pointerType === 'mouse') return;
            if ((e.target as HTMLElement).closest('button')) return;
            const pt = toStagePoint(e.clientX, e.clientY);
            const dim = getStageDimensions();
            const nx = Math.min(
              0.92,
              Math.max(0.08, pt.x / (dim.width || 1))
            );
            const ny = Math.min(
              0.88,
              Math.max(0.16, pt.y / (dim.height || 1))
            );
            setDraftJoystickCoords({x: nx, y: ny});
          }}
          className="fixed inset-0 z-[72] bg-slate-950/65 touch-none select-none"
        >
          {/* Guide Grid & Action Toolbar */}
          <div className="pointer-events-auto fixed top-3 left-1/2 -translate-x-1/2 z-[75] rounded-2xl border border-amber-500/70 bg-[#0B1422] px-4 py-2.5 shadow-2xl flex flex-wrap items-center justify-center gap-2.5 max-w-[94vw]">
            <span className="text-xs font-bold text-amber-200 whitespace-nowrap">
              {isAr
                ? 'اضغط أو اسحب إلى الموقع المطلوب لزر تحريك التقني'
                : 'Tap or drag anywhere to place Technician Move button'}
            </span>
            <button
              type="button"
              onClick={() => {
                updateJoystickConfig({
                  ...joystickConfig,
                  preset: 'custom',
                  customX: draftJoystickCoords.x,
                  customY: draftJoystickCoords.y,
                });
                setIsRepositioningJoystick(false);
                showToast(
                  isAr
                    ? 'تم حفظ موقع زر تحريك التقني بنجاح!'
                    : 'Joystick position saved!'
                );
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
            >
              {isAr ? 'حفظ الموقع' : 'Save Position'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRepositioningJoystick(false);
                setControlsModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>

          <div
            style={{
              left: `${Math.round(draftJoystickCoords.x * 100)}%`,
              top: `${Math.round(draftJoystickCoords.y * 100)}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="pointer-events-none fixed"
          >
            <VirtualJoystick
              joystickRef={joystickRef}
              size={joystickConfig.size}
              disabled
              label={isAr ? 'اسحب لتحديد المكان' : 'Drag to Place'}
            />
          </div>
        </div>
      )}

      {/* BOTTOM FIRST-PERSON WORKFLOW DOCK */}
      <footer
        className={`hud-bottom-dock pointer-events-none fixed bottom-0 inset-x-0 z-20 px-2 pt-1 pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:p-4 flex flex-col items-center gap-1 sm:gap-2 ${
          joystickConfig.preset === 'bottom-left'
            ? 'hud-dock-avoid-left'
            : joystickConfig.preset === 'bottom-right'
              ? 'hud-dock-avoid-right'
              : ''
        }`}
      >
        {/* Primary Clinical Step Action Bar */}
        <div className="hud-action-bar pointer-events-auto max-w-full rounded-2xl border border-slate-700/80 bg-[#08101C]/95 px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-2xl flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {allDayPatientsDone ? (
            <>
              <button
                type="button"
                onClick={handleEndDay}
                className="flex items-center gap-2 px-5 sm:px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-slate-950 font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer transition-all shadow-lg"
              >
                <CalendarCheck2 className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? `إنهاء اليوم #${currentDay} وعرض الإحصائيات`
                    : `End Day #${currentDay} & View Stats`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPcTab('SHOP');
                  setPcOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span>{isAr ? 'المتجر والحاسوب' : 'Clinic PC / Shop'}</span>
              </button>
            </>
          ) : caseApproved ? (
            <button
              type="button"
              onClick={handleFinishExamAndNextPatient}
              className="flex items-center gap-2 px-5 sm:px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>
                {dailyPatientsHandled + 1 >= dailyTargetPatients &&
                queue.length <= 1
                  ? isAr
                    ? 'انتهاء الفحص — تجهيز إنهاء اليوم'
                    : 'Finish Exam — Complete Day'
                  : isAr
                    ? 'انتهاء الفحص — استقبال المريض التالي'
                    : 'Finish Exam — Next Patient'}
              </span>
            </button>
          ) : techLocation === 'ROOM' ? (
            <>
              {!crExposedPending && (
                <>
                  <button
                    type="button"
                    onClick={() => setRegionMenuOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/95 hover:bg-slate-700 border border-cyan-500/45 text-cyan-200 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {formatRegionWithSide(
                        selectedRegion,
                        selectedSide,
                        lang,
                        true
                      )}
                    </span>
                    <ChevronUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  </button>

                  {isBilateralRegion(selectedRegion) && (
                    <div className="flex items-center gap-1 rounded-xl bg-slate-900/95 border border-slate-700 p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectRegion(selectedRegion, 'RIGHT')
                        }
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                          selectedSide === 'RIGHT'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {isAr ? 'يمين R' : 'R'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectRegion(selectedRegion, 'LEFT')
                        }
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                          selectedSide === 'LEFT'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {isAr ? 'يسار L' : 'L'}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPatientMenuOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/95 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{POSTURE_SHORT_I18N[lang][selectedPosture]}</span>
                    <ChevronUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  </button>
                </>
              )}

              {!crExposedPending && hasLeadShield && (
                <button
                  type="button"
                  onClick={() => setShieldUsed((v) => !v)}
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                    shieldUsed
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {shieldUsed
                      ? isAr
                        ? 'الدرع ✓'
                        : 'Shield ✓'
                      : isAr
                        ? 'الدرع'
                        : 'Shield'}
                  </span>
                </button>
              )}

              {!hasDR &&
                !isBoreScan &&
                crExposedPending &&
                (cassetteState === 'TABLE_BUCKY' ||
                  cassetteState === 'WALL_BUCKY') && (
                  <button
                    type="button"
                    onClick={handleRetrieveExposedCassette}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <Hand className="w-4 h-4 shrink-0" />
                    <span>
                      {isAr
                        ? 'سحب الكاسيت المصوّر لقارئ CR'
                        : 'Pick Up Exposed Cassette'}
                    </span>
                  </button>
                )}

              {!hasDR && !isBoreScan && cassetteState === 'RACK' && (
                <button
                  type="button"
                  onClick={handlePickUpCassette}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Hand className="w-4 h-4 shrink-0" />
                  <span>
                    {isAr ? 'أخذ الكاسيت بيدك' : 'Pick Up Cassette'}
                  </span>
                </button>
              )}

              {!hasDR && !isBoreScan && cassetteState === 'IN_HAND' && (
                <button
                  type="button"
                  onClick={
                    isErect ? handleInsertWallBucky : handleInsertTableBucky
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Hand className="w-4 h-4 shrink-0" />
                  <span>
                    {isErect
                      ? isAr
                        ? 'وضع الكاسيت في البكي الواقف'
                        : 'Insert in Wall Bucky'
                      : isAr
                        ? 'إدخال الكاسيت تحت الطاولة'
                        : 'Insert in Table Bucky'}
                  </span>
                </button>
              )}

              {cassetteReady && !crExposedPending && (
                <span className="text-[11px] sm:text-xs font-semibold text-emerald-300 px-1.5 whitespace-nowrap shrink-0">
                  ✓ {cassetteStepLabel}
                </span>
              )}

              <button
                type="button"
                onClick={handleToggleDoorAndBooth}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  cassetteState === 'EXPOSED_IN_HAND'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : cassetteReady && !crExposedPending
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <DoorClosed className="w-4 h-4 shrink-0" />
                <span>
                  {cassetteState === 'EXPOSED_IN_HAND'
                    ? isAr
                      ? 'العودة لقارئ CR بالتحكم'
                      : 'Return to CR Reader'
                    : isAr
                      ? 'الخروج وإغلاق الباب'
                      : 'Exit & Close Door'}
                </span>
              </button>
            </>
          ) : (
            <>
              {!hasDR && cassetteState === 'EXPOSED_IN_HAND' && (
                <button
                  type="button"
                  onClick={handleInsertCrReader}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <ScanLine className="w-4 h-4 shrink-0" />
                  <span>
                    {isAr
                      ? 'إدخال الكاسيت في قارئ CR'
                      : 'Insert into CR Reader'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleDoorAndBooth}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  crExposedPending && cassetteState !== 'EXPOSED_IN_HAND'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                    : !doorClosed
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {doorClosed ? (
                  <DoorOpen className="w-4 h-4 shrink-0" />
                ) : (
                  <DoorClosed className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {crExposedPending && cassetteState !== 'EXPOSED_IN_HAND'
                    ? isAr
                      ? 'اذهب لأخذ الكاسيت من الغرفة'
                      : 'Get Exposed Cassette'
                    : doorClosed
                      ? isAr
                        ? 'العودة لغرفة الفحص'
                        : 'Return to Room'
                      : isAr
                        ? 'إغلاق الباب الرصاصي'
                        : 'Close Lead Door'}
                </span>
              </button>

              {!crExposedPending && cassetteState !== 'EXPOSED_IN_HAND' && (
                <button
                  type="button"
                  onClick={() => setConsoleOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-600/40 text-cyan-200 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span>
                    {consoleOpen
                      ? isAr
                        ? 'إخفاء اللوحة'
                        : 'Hide Console'
                      : isAr
                        ? 'لوحة التعريض'
                        : 'Show Console'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setPcTab(currentEvaluation ? 'IMAGE' : 'LOG');
                  setPcOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span>
                  {isAr ? 'الحاسوب (View & Mask)' : 'Clinic PC'}
                </span>
              </button>

              {currentEvaluation && !currentEvaluation.success && (
                <button
                  type="button"
                  onClick={handleFinishExamAndNextPatient}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                  <span>{isAr ? 'المريض التالي' : 'Next Patient'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </footer>

      {/* CLINIC COMPUTER WORKSTATION MODAL */}
      <ClinicPCModal
        isOpen={pcOpen}
        activeTab={pcTab}
        onChangeTab={setPcTab}
        onClose={() => setPcOpen(false)}
        activePatient={activePatient}
        requestedExam={requestedExam}
        evaluation={currentEvaluation}
        actualPosture={capturedPosture ?? selectedPosture}
        actualProjection={capturedProjection ?? selectedProjection}
        actualSide={capturedSide ?? selectedSide}
        isDeveloping={isDeveloping}
        hasDR={hasDR}
        hasAutoProc={hasAutoProc}
        kvp={kvp}
        mas={mas}
        filmsRemaining={save.films}
        onApproveAndCollect={handleApproveAndCollect}
        onRetake={() => {
          setCurrentEvaluation(null);
          setCapturedPosture(null);
          setCapturedProjection(null);
          setCapturedSide(null);
          pendingCrEvalRef.current = null;
          setCrExposedPending(false);
          setConsoleOpen(true);
        }}
        cash={save.cash}
        filmDebt={save.filmDebt}
        patientsServed={save.patientsServed}
        ownedUpgrades={save.ownedUpgrades}
        onBuyCarton={handleBuyCarton}
        onTakeEmergencyLoan={handleTakeEmergencyLoan}
        onBuyUpgrade={handleBuyUpgrade}
        completedCases={save.completedCases}
        totalRevenue={save.totalRevenue}
        retakesCount={save.retakesCount}
      />

      {/* PATIENT ILLUSTRATED SCROLLABLE POSTURE MENU */}
      <PatientPostureMenu
        isOpen={patientMenuOpen}
        selectedPosture={selectedPosture}
        selectedRegion={selectedRegion}
        hasLeadShield={hasLeadShield}
        shieldUsed={shieldUsed}
        onSelectPosture={handleSelectPosture}
        onToggleShield={() => setShieldUsed((v) => !v)}
        onClose={() => setPatientMenuOpen(false)}
      />

      {/* PATIENT ANATOMICAL REGION & RIGHT/LEFT SIDE MENU */}
      <PatientRegionMenu
        isOpen={regionMenuOpen}
        selectedRegion={selectedRegion}
        selectedSide={selectedSide}
        onSelectRegionAndSide={(region, side) =>
          handleSelectRegion(region, side)
        }
        onClose={() => setRegionMenuOpen(false)}
      />

      {/* CLICKABLE PATIENT HAND REQUISITION FORM MODAL */}
      <PatientRequisitionModal
        isOpen={requisitionOpen}
        patient={activePatient}
        requestedExam={requestedExam}
        onClose={() => setRequisitionOpen(false)}
      />

      {/* CONTROL SETTINGS & JOYSTICK POSITION MODAL */}
      <ControlSettingsModal
        isOpen={controlsModalOpen}
        onClose={() => setControlsModalOpen(false)}
        joystickConfig={joystickConfig}
        onChangeJoystickConfig={updateJoystickConfig}
        onResetJoystickConfig={() => {
          const def = getDefaultJoystickConfig();
          updateJoystickConfig(def);
          showToast(
            isAr
              ? 'تم إرجاع زر تحريك التقني للموقع الافتراضي.'
              : 'Joystick position reset to default.'
          );
        }}
        onStartFreeDrag={() => {
          const startCoords =
            joystickConfig.preset === 'custom'
              ? {x: joystickConfig.customX, y: joystickConfig.customY}
              : joystickConfig.preset === 'top-left'
                ? {x: 0.12, y: 0.28}
                : joystickConfig.preset === 'top-right'
                  ? {x: 0.88, y: 0.28}
                  : joystickConfig.preset === 'bottom-right'
                    ? {x: 0.88, y: 0.74}
                    : {x: 0.12, y: 0.74};
          setDraftJoystickCoords(startCoords);
          setControlsModalOpen(false);
          setIsRepositioningJoystick(true);
        }}
        brightness={brightness}
        onChangeBrightness={updateBrightness}
        onResetBrightness={() => {
          updateBrightness(DEFAULT_BRIGHTNESS);
          showToast(
            isAr
              ? 'تم إرجاع السطوع إلى الوضع الافتراضي.'
              : 'Brightness reset to default.'
          );
        }}
        appVersion={appUpdate.currentVersion}
        updateAvailable={appUpdate.updateAvailable}
        checkingUpdate={appUpdate.checking}
        updateOutcome={appUpdate.lastOutcome}
        onCheckForUpdates={() => {
          void appUpdate.checkForUpdates(true).then((outcome) => {
            if (outcome === 'update') {
              showToast(
                isAr
                  ? 'يتوفر تحديث جديد للعبة! اضغط "تحديث الآن".'
                  : 'New update found! Tap Update Now.'
              );
            } else if (outcome === 'up-to-date') {
              showToast(
                isAr
                  ? 'أنت تستخدم أحدث إصدار من اللعبة ✓'
                  : 'You are on the latest game version ✓'
              );
            } else {
              showToast(
                isAr
                  ? 'تعذر التحقق من التحديثات الآن، حاول مجدداً.'
                  : 'Could not check for updates right now.'
              );
            }
          });
        }}
        onApplyUpdate={() => {
          void appUpdate.applyUpdate();
        }}
      />

      {/* MANDATORY GAME UPDATE MODAL (NON-DISMISSIBLE) */}
      {mandatoryUpdateOverlay}

      {/* END OF DAY FINANCIAL REPORT & NEW DAY MODAL */}
      <DaySummaryModal
        isOpen={daySummaryOpen}
        summary={activeDaySummary}
        currentCash={save.cash}
        hasWaitingRoom={hasWaitingRoom}
        dayHistory={save.dayHistory ?? []}
        onStartNewDay={handleStartNewDay}
      />

      {/* DESIGNER CREDIT MILESTONE POPUP (EVERY 10 COMPLETED PATIENTS) */}
      <DesignerCredit
        variant="milestone"
        open={designerPopupOpen}
        patientsMilestone={designerMilestoneCount}
        onClose={() => setDesignerPopupOpen(false)}
      />
      </div>
    </div>
  );
}
