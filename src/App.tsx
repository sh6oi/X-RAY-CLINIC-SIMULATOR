import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {
  ArrowLeftRight,
  CheckCircle2,
  Coins,
  DoorClosed,
  DoorOpen,
  Film,
  Hand,
  LogOut,
  Monitor,
  Package,
  Shield,
  Sliders,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  BodyRegion,
  CassetteState,
  ClinicSaveState,
  CompletedCase,
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
  FILM_CARTON_COST,
  FILM_CARTON_SIZE,
  POSTURE_SHORT_AR,
  REGION_LABELS_AR,
  UPGRADES,
  evaluateExposure,
  generatePatient,
  getClinicRank,
  getExamById,
} from './data/radiologyData';
import {
  auth,
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
import {ExposureConsolePanel} from './components/ExposureConsolePanel';
import {VirtualJoystick} from './components/VirtualJoystick';
import {soundFx} from './utils/soundFx';

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
};

function sanitizeSaveState(
  raw: Partial<ClinicSaveState> | null
): ClinicSaveState {
  if (!raw) return {...INITIAL_SAVE};
  return {
    ...INITIAL_SAVE,
    ...raw,
    ownedUpgrades: Array.isArray(raw.ownedUpgrades) ? raw.ownedUpgrades : [],
    completedCases: Array.isArray(raw.completedCases)
      ? raw.completedCases
      : [],
  };
}

function buildStarterQueue(upgrades: UpgradeId[]): PatientCase[] {
  return [
    {...generatePatient(upgrades), examId: 'chest_pa'},
    {...generatePatient(upgrades), examId: 'lumbar_ap'},
    {...generatePatient(upgrades), examId: 'cervical_lat'},
  ];
}

const POSTURE_OPTIONS: {id: PatientPosture; label: string}[] = [
  {id: 'ERECT_PA', label: 'واقف PA'},
  {id: 'ERECT_AP', label: 'واقف AP'},
  {id: 'ERECT_LEFT_LAT', label: 'واقف يسار'},
  {id: 'ERECT_RIGHT_LAT', label: 'واقف يمين'},
  {id: 'SUPINE', label: 'على الظهر'},
  {id: 'PRONE', label: 'على البطن'},
  {id: 'TABLE_LEFT_LAT', label: 'طاولة يسار'},
  {id: 'TABLE_RIGHT_LAT', label: 'طاولة يمين'},
];

const REGION_OPTIONS: BodyRegion[] = [
  'head',
  'cervical',
  'chest',
  'lumbar',
  'pelvis',
  'hand',
  'knee',
];

export default function App() {
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [techProfile, setTechProfile] = useState<TechProfile | null>(null);
  const [screenMode, setScreenMode] = useState<ScreenMode>('AUTH');

  const [save, setSave] = useState<ClinicSaveState>(INITIAL_SAVE);
  const [queue, setQueue] = useState<PatientCase[]>(() => buildStarterQueue([]));
  const [activePatientId, setActivePatientId] = useState<string | null>(null);

  // First-Person 3D Clinical Workflow State
  const [techLocation, setTechLocation] = useState<TechLocation>('ROOM');
  const [doorClosed, setDoorClosed] = useState<boolean>(false);
  const [ctDoorOpen, setCtDoorOpen] = useState<boolean>(false);
  const [mriDoorOpen, setMriDoorOpen] = useState<boolean>(false);
  const [cassetteState, setCassetteState] = useState<CassetteState>('RACK');

  // Patient Positioning & Generator Console State
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion>('chest');
  const [selectedPosture, setSelectedPosture] =
    useState<PatientPosture>('ERECT_PA');
  const [selectedProjection, setSelectedProjection] =
    useState<ProjectionType>('PA');
  const [kvp, setKvp] = useState<number>(110);
  const [mas, setMas] = useState<number>(4);
  const [shieldUsed, setShieldUsed] = useState<boolean>(false);
  const [breathHeld, setBreathHeld] = useState<boolean>(false);

  // Exposure, Developing & Case Approval
  const [isExposing, setIsExposing] = useState<boolean>(false);
  const [isDeveloping, setIsDeveloping] = useState<boolean>(false);
  const [currentEvaluation, setCurrentEvaluation] =
    useState<ScanEvaluation | null>(null);
  const [caseApproved, setCaseApproved] = useState<boolean>(false);

  // Control Booth Console Drawer & Clinic PC Modal
  const [consoleOpen, setConsoleOpen] = useState<boolean>(true);
  const [pcOpen, setPcOpen] = useState<boolean>(false);
  const [pcTab, setPcTab] = useState<WorkspaceTab>('IMAGE');

  // Toast message
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const joystickRef = useRef<{x: number; y: number}>({x: 0, y: 0});
  const exposeTimerRef = useRef<number | null>(null);
  const developTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const hydratedUidRef = useRef<string | null>(null);
  const latestSaveRef = useRef<ClinicSaveState>(save);
  const latestUidRef = useRef<string | null>(null);

  latestSaveRef.current = save;
  latestUidRef.current = techProfile?.uid ?? null;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 3800);
  }, []);

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
        setTechProfile(null);
        setScreenMode('AUTH');
        setAuthChecking(false);
        return;
      }

      const profile: TechProfile = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'تقني الأشعة',
        email: user.email || '',
      };
      setTechProfile(profile);

      const loaded = await loadClinicProgressFromCloud(user.uid);
      const restored = sanitizeSaveState(loaded.saveState);
      hydratedUidRef.current = user.uid;
      setSave(restored);
      setQueue(buildStarterQueue(restored.ownedUpgrades));
      setScreenMode('PLAYING');
      setAuthChecking(false);
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Continuous synchronous local backup + fast debounced RTDB cloud sync
  useEffect(() => {
    soundFx.setEnabled(save.soundEnabled);
    if (!techProfile || hydratedUidRef.current !== techProfile.uid) return;

    saveClinicProgressLocal(techProfile.uid, save);

    if (cloudSyncTimerRef.current) window.clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = window.setTimeout(() => {
      void saveClinicProgressToCloud(techProfile.uid, save);
    }, 280);
  }, [save, techProfile]);

  // Flush save immediately before tab closes / page refreshes
  useEffect(() => {
    const flushSave = () => {
      const uid = latestUidRef.current;
      if (!uid || hydratedUidRef.current !== uid) return;
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
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushSave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (exposeTimerRef.current) window.clearTimeout(exposeTimerRef.current);
      if (developTimerRef.current) window.clearTimeout(developTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (cloudSyncTimerRef.current)
        window.clearTimeout(cloudSyncTimerRef.current);
    };
  }, []);

  // Assistant Radiographer passive income loop
  const hasAssistant = save.ownedUpgrades.includes('assistant_tech');
  useEffect(() => {
    if (screenMode !== 'PLAYING' || !hasAssistant || !techProfile) return;
    const interval = window.setInterval(() => {
      commitSaveUpdate((prev) => {
        const fee = prev.ownedUpgrades.includes('digital_dr') ? 25 : 15;
        return {
          ...prev,
          cash: prev.cash + fee,
          totalRevenue: prev.totalRevenue + fee,
          patientsServed: prev.patientsServed + 1,
        };
      });
    }, 7500);
    return () => window.clearInterval(interval);
  }, [screenMode, hasAssistant, techProfile, commitSaveUpdate]);

  const maxQueueSize = save.ownedUpgrades.includes('waiting_room') ? 6 : 3;
  const hasDR = save.ownedUpgrades.includes('digital_dr');
  const hasAutoProc = save.ownedUpgrades.includes('auto_processor');
  const hasProtocolAssist = save.ownedUpgrades.includes('protocol_assist');
  const hasLeadShield = save.ownedUpgrades.includes('lead_shield');
  const hasDosimeter = save.ownedUpgrades.includes('dosimeter_badge');
  const hasTubeCooler = save.ownedUpgrades.includes('tube_cooler');
  const hasCT = save.ownedUpgrades.includes('ct_scanner');
  const hasMRI = save.ownedUpgrades.includes('mri_suite');

  // Keep queue topped up
  useEffect(() => {
    if (queue.length < maxQueueSize) {
      const needed = maxQueueSize - queue.length;
      const newcomers = Array.from({length: needed}, () =>
        generatePatient(save.ownedUpgrades)
      );
      setQueue((prev) => [...prev, ...newcomers]);
    }
  }, [queue.length, maxQueueSize, save.ownedUpgrades]);

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

  const currentRank = getClinicRank(save.totalRevenue);
  const isChestExam = requestedExam.region === 'chest';
  const effectiveBreathHeld = isChestExam && breathHeld;
  const isBoreScan =
    requestedExam.modality === 'CT' || requestedExam.modality === 'MRI';
  const isErect = selectedPosture.startsWith('ERECT_');
  const requiredCassetteSlot: CassetteState = isErect
    ? 'WALL_BUCKY'
    : 'TABLE_BUCKY';
  const cassetteReady = isBoreScan || cassetteState === requiredCassetteSlot;

  const availableProjections: ProjectionType[] = useMemo(() => {
    const base: ProjectionType[] = ['PA', 'AP', 'LATERAL'];
    if (save.ownedUpgrades.includes('ct_scanner')) base.push('AXIAL');
    if (save.ownedUpgrades.includes('mri_suite')) base.push('SAGITTAL');
    return base;
  }, [save.ownedUpgrades]);

  const handleAuthenticated = (result: AuthResult) => {
    const profile: TechProfile = {
      uid: result.user.uid,
      name:
        result.user.displayName ||
        result.user.email?.split('@')[0] ||
        'تقني الأشعة',
      email: result.user.email || '',
    };
    const restored = sanitizeSaveState(result.saveState);
    hydratedUidRef.current = profile.uid;
    setTechProfile(profile);
    setSave(restored);
    saveClinicProgressLocal(profile.uid, restored);
    setQueue(buildStarterQueue(restored.ownedUpgrades));
    setScreenMode('PLAYING');
  };

  const handleLogout = async () => {
    if (techProfile) {
      const stamped: ClinicSaveState = {...save, updatedAt: Date.now()};
      saveClinicProgressLocal(techProfile.uid, stamped);
      await saveClinicProgressToCloud(techProfile.uid, stamped);
    }
    hydratedUidRef.current = null;
    await logoutTechAccount();
    setTechProfile(null);
    setScreenMode('AUTH');
  };

  const handleSelectPosture = (posture: PatientPosture) => {
    if (isDeveloping || isExposing || caseApproved) return;
    if (techLocation !== 'ROOM') {
      showToast('ادخل غرفة الفحص أولاً لتغيير وضعية المريض.');
      return;
    }
    setSelectedPosture(posture);

    // If cassette was in previous slot type, return to hand so tech places it in matching bucky
    if (
      posture.startsWith('ERECT_') &&
      cassetteState === 'TABLE_BUCKY'
    ) {
      setCassetteState('IN_HAND');
      showToast('تم إخراج الكاسيت بيدك — ضعه الآن في الحامل الواقف (البكي).');
    } else if (
      !posture.startsWith('ERECT_') &&
      cassetteState === 'WALL_BUCKY'
    ) {
      setCassetteState('IN_HAND');
      showToast('تم إخراج الكاسيت بيدك — ضعه الآن تحت الطاولة.');
    }

    if (isBoreScan) return;
    if (posture === 'ERECT_PA' || posture === 'PRONE') {
      setSelectedProjection('PA');
    } else if (posture === 'ERECT_AP') {
      setSelectedProjection('AP');
    } else if (
      posture === 'ERECT_LEFT_LAT' ||
      posture === 'ERECT_RIGHT_LAT' ||
      posture === 'TABLE_LEFT_LAT' ||
      posture === 'TABLE_RIGHT_LAT'
    ) {
      setSelectedProjection('LATERAL');
    } else if (posture === 'SUPINE' && selectedProjection === 'LATERAL') {
      setSelectedProjection('AP');
    }
  };

  const handleSelectProjection = (proj: ProjectionType) => {
    setSelectedProjection(proj);
    if (proj === 'AXIAL' || proj === 'SAGITTAL') {
      setSelectedPosture('SUPINE');
      return;
    }
    if (proj === 'LATERAL') {
      if (isErect) {
        if (
          selectedPosture !== 'ERECT_LEFT_LAT' &&
          selectedPosture !== 'ERECT_RIGHT_LAT'
        ) {
          setSelectedPosture('ERECT_LEFT_LAT');
        }
      } else if (
        selectedPosture !== 'TABLE_LEFT_LAT' &&
        selectedPosture !== 'TABLE_RIGHT_LAT'
      ) {
        setSelectedPosture('TABLE_LEFT_LAT');
      }
    } else if (proj === 'PA') {
      if (isErect) setSelectedPosture('ERECT_PA');
      else if (
        selectedPosture === 'TABLE_LEFT_LAT' ||
        selectedPosture === 'TABLE_RIGHT_LAT'
      ) {
        setSelectedPosture('PRONE');
      }
    } else if (proj === 'AP') {
      if (isErect) setSelectedPosture('ERECT_AP');
      else if (selectedPosture !== 'SUPINE') {
        setSelectedPosture('SUPINE');
      }
    }
  };

  const handleToggleDoorAndBooth = () => {
    if (isExposing || isDeveloping) return;
    if (techLocation === 'ROOM') {
      setTechLocation('BOOTH');
      setDoorClosed(true);
      setConsoleOpen(true);
      soundFx.playPurchase();
      showToast('خرجت إلى غرفة التحكم وأغلقت الباب الرصاصي خلفك.');
    } else if (!doorClosed) {
      setDoorClosed(true);
      setConsoleOpen(true);
      soundFx.playPurchase();
      showToast('تم إغلاق الباب الرصاصي — يمكنك الآن إطلاق الجرعة.');
    } else {
      setDoorClosed(false);
      setTechLocation('ROOM');
      soundFx.playPurchase();
      showToast('فتحت الباب ودخلت إلى غرفة الفحص.');
    }
  };

  const handleTechZoneChange = useCallback(
    (loc: TechLocation) => {
      setTechLocation(loc);
      if (loc === 'BOOTH') {
        showToast('دخلت غرفة التحكم — أغلق الباب الرصاصي قبل إطلاق الأشعة.');
      } else {
        showToast('دخلت إلى غرفة الفحص.');
      }
    },
    [showToast]
  );

  const handlePickUpCassette = () => {
    if (techLocation !== 'ROOM') {
      showToast('ادخل غرفة الفحص أولاً لأخذ الكاسيت.');
      return;
    }
    if (cassetteState === 'IN_HAND') {
      showToast(
        isErect
          ? 'الكاسيت في يدك — انقر على الحامل الواقف (البكي) لإدخاله.'
          : 'الكاسيت في يدك — انقر على درج الطاولة لإدخال الكاسيت.'
      );
      return;
    }
    setCassetteState('IN_HAND');
    soundFx.playPurchase();
    showToast(
      isErect
        ? 'أخذت الكاسيت بيدك — ضعه الآن داخل الحامل الواقف (البكي).'
        : 'أخذت الكاسيت بيدك — ضعه الآن داخل الدرج تحت الطاولة.'
    );
  };

  const handleInsertTableBucky = () => {
    if (techLocation !== 'ROOM') {
      showToast('ادخل غرفة الفحص لوضع الكاسيت تحت الطاولة.');
      return;
    }
    if (cassetteState === 'RACK') {
      showToast('خذ الكاسيت من الحامل الجانبي أولاً.');
      return;
    }
    if (isErect) {
      soundFx.playError();
      showToast('المريض واقف! ضع الكاسيت في الحامل الواقف (البكي) وليس تحت الطاولة.');
      return;
    }
    setCassetteState('TABLE_BUCKY');
    soundFx.playPurchase();
    showToast('تم إدخال الكاسيت تحت الطاولة بنجاح.');
  };

  const handleInsertWallBucky = () => {
    if (techLocation !== 'ROOM') {
      showToast('ادخل غرفة الفحص لوضع الكاسيت في الحامل الواقف.');
      return;
    }
    if (cassetteState === 'RACK') {
      showToast('خذ الكاسيت من الحامل الجانبي أولاً.');
      return;
    }
    if (!isErect) {
      soundFx.playError();
      showToast('المريض مستلقٍ على الطاولة! أدخل الكاسيت تحت الطاولة.');
      return;
    }
    setCassetteState('WALL_BUCKY');
    soundFx.playPurchase();
    showToast('تم تثبيت الكاسيت داخل الحامل الواقف (البكي) بنجاح.');
  };

  const handleSceneInteract = (action: SceneTargetAction) => {
    switch (action.type) {
      case 'REGION':
        if (techLocation !== 'ROOM') {
          showToast('ادخل غرفة الفحص لتحديد موضع التصوير على المريض.');
          return;
        }
        setSelectedRegion(action.region);
        soundFx.playPurchase();
        showToast(`تم توجيه الأشعة نحو: ${REGION_LABELS_AR[action.region]}`);
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
      case 'DOOR':
        setDoorClosed((prev) => {
          const next = !prev;
          soundFx.playPurchase();
          showToast(
            next
              ? 'تم إغلاق الباب الرصاصي.'
              : 'تم فتح الباب الرصاصي — يمكنك المرور الآن.'
          );
          return next;
        });
        break;
      case 'CT_DOOR':
        if (!hasCT) {
          soundFx.playError();
          showToast(
            'غرفة السيتي (المفراس CT) مغلقة 🔒 — جهاز السيتي غير متوفر للشراء حالياً وسيتوفر قريباً.'
          );
          return;
        }
        setCtDoorOpen((prev) => {
          const next = !prev;
          soundFx.playPurchase();
          showToast(
            next
              ? 'تم فتح باب غرفة السيتي (المفراس CT) — يمكنك الدخول الآن.'
              : 'تم إغلاق باب غرفة السيتي.'
          );
          return next;
        });
        break;
      case 'MRI_DOOR':
        if (!hasMRI) {
          soundFx.playError();
          showToast(
            'غرفة الرنين المغناطيسي (MRI) مغلقة 🔒 — جهاز الرنين غير متوفر للشراء حالياً وسيتوفر قريباً.'
          );
          return;
        }
        setMriDoorOpen((prev) => {
          const next = !prev;
          soundFx.playPurchase();
          showToast(
            next
              ? 'تم فتح باب غرفة الرنين المغناطيسي (MRI) — يمكنك الدخول الآن.'
              : 'تم إغلاق باب غرفة الرنين المغناطيسي.'
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
    showToast('عبر الميكروفون: "خذ نفساً عميقاً واحبسه الآن..." (+$2 جودة)');
  };

  const handleAutoCalibrate = () => {
    if (!hasProtocolAssist || !activePatient) return;
    setSelectedRegion(requestedExam.region);
    setSelectedPosture(requestedExam.recommendedPosture);
    setSelectedProjection(requestedExam.recommendedProjection);
    setKvp(
      Math.round((requestedExam.kvpRange[0] + requestedExam.kvpRange[1]) / 2)
    );
    setMas(
      Math.round((requestedExam.masRange[0] + requestedExam.masRange[1]) / 2)
    );
    if (hasLeadShield) setShieldUsed(true);
    setBreathHeld(requestedExam.region === 'chest');
    if (!isBoreScan) {
      setCassetteState(
        requestedExam.recommendedPosture.startsWith('ERECT_')
          ? 'WALL_BUCKY'
          : 'TABLE_BUCKY'
      );
    }
    showToast(`تم ضبط بروتوكول ${requestedExam.titleAr} تلقائياً`);
  };

  const handleExpose = () => {
    if (!activePatient || isDeveloping || isExposing || caseApproved) return;

    if (techLocation !== 'BOOTH' || !doorClosed) {
      soundFx.playError();
      showToast(
        'سلامة إشعاعية: يجب الخروج لغرفة التحكم وإغلاق الباب الرصاصي قبل إطلاق الجرعة!'
      );
      return;
    }

    if (!cassetteReady) {
      soundFx.playError();
      showToast(
        isErect
          ? 'تأكد من وضع الكاسيت داخل الحامل الواقف (البكي) قبل التصوير!'
          : 'تأكد من إدخال الكاسيت داخل درج الطاولة قبل التصوير!'
      );
      return;
    }

    const needsPhysicalFilm = requestedExam.modality === 'XRAY' && !hasDR;
    if (needsPhysicalFilm && save.films <= 0) {
      soundFx.playError();
      showToast('نفدت أفلام الأشعة! افتح الحاسوب لشراء كرتون أفلام.');
      setPcTab('SHOP');
      setPcOpen(true);
      return;
    }

    soundFx.playExpose();
    setIsExposing(true);

    const evaluation = evaluateExposure({
      exam: requestedExam,
      selectedRegion,
      selectedProjection,
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
      }));
    }

    if (exposeTimerRef.current) window.clearTimeout(exposeTimerRef.current);
    if (developTimerRef.current) window.clearTimeout(developTimerRef.current);

    const exposeMs = hasTubeCooler ? 460 : 720;
    exposeTimerRef.current = window.setTimeout(() => {
      setIsExposing(false);
      const baseDevelopDelay = hasDR ? 240 : hasAutoProc ? 440 : 880;
      const developDelay = hasTubeCooler
        ? Math.round(baseDevelopDelay * 0.65)
        : baseDevelopDelay;
      setIsDeveloping(true);
      setPcTab('IMAGE');
      setPcOpen(true);

      developTimerRef.current = window.setTimeout(() => {
        setIsDeveloping(false);
        setCurrentEvaluation(evaluation);
        if (!evaluation.success) {
          soundFx.playError();
        }
      }, developDelay);
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
      examTitleAr: requestedExam.titleAr,
      examImagePath: requestedExam.imagePath,
      modality: requestedExam.modality,
      findingAr: activePatient.findingAr,
      earned: gross,
      kvpUsed: kvp,
      masUsed: mas,
      shieldUsed: hasLeadShield && shieldUsed,
      postureUsed: selectedPosture,
      timestamp: Date.now(),
    };

    commitSaveUpdate((prev) => ({
      ...prev,
      cash: prev.cash + netToCash,
      totalRevenue: prev.totalRevenue + gross,
      filmDebt: prev.filmDebt - debtRepayment,
      patientsServed: prev.patientsServed + 1,
      completedCases: [record, ...prev.completedCases].slice(0, 60),
    }));

    setCaseApproved(true);
    setPcOpen(false);
    showToast(
      debtRepayment > 0
        ? `تم اعتماد الصورة وتحصيل $${gross} (سُدّد $${debtRepayment}). اضغط "انتهاء الفحص" لاستقبال المريض التالي.`
        : `تم اعتماد الصورة واستلام $${gross}. اضغط "انتهاء الفحص" لاستقبال المريض التالي.`
    );
  };

  const handleFinishExamAndNextPatient = () => {
    if (!activePatient || isExposing || isDeveloping) return;

    setQueue((prev) => prev.filter((p) => p.id !== activePatient.id));
    setActivePatientId(null);
    setCurrentEvaluation(null);
    setCaseApproved(false);
    setBreathHeld(false);
    setCassetteState('RACK');
    setDoorClosed(false);
    setTechLocation('ROOM');
    soundFx.playPurchase();
    showToast('غادر المريض غرفة الفحص ودخل المريض التالي.');
  };

  const handleBuyCarton = (count: 1 | 5) => {
    const cost = count === 1 ? FILM_CARTON_COST : BULK_CARTON_COST;
    const filmsToAdd = count === 1 ? FILM_CARTON_SIZE : BULK_CARTON_SIZE;

    if (save.cash < cost) {
      soundFx.playError();
      showToast('الرصيد الحالي لا يكفي لشراء هذا العرض.');
      return;
    }

    soundFx.playPurchase();
    commitSaveUpdate((prev) => ({
      ...prev,
      cash: prev.cash - cost,
      films: prev.films + filmsToAdd,
      cartonsBought: prev.cartonsBought + count,
    }));
    showToast(`تمت إضافة ${filmsToAdd} فيلم أشعة إلى مخزون العيادة`);
  };

  const handleTakeEmergencyLoan = () => {
    soundFx.playPurchase();
    commitSaveUpdate((prev) => ({
      ...prev,
      films: prev.films + 10,
      filmDebt: prev.filmDebt + 50,
    }));
    showToast('تم استلام 10 أفلام طوارئ (آجل $50)');
  };

  const handleBuyUpgrade = (id: UpgradeId) => {
    if (save.ownedUpgrades.includes(id)) return;
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return;
    if (upgrade.comingSoon) {
      soundFx.playError();
      showToast(
        `${upgrade.titleAr} غير متوفر للشراء حالياً — سيتوفر قريباً.`
      );
      return;
    }
    if (
      upgrade.requiredPatientsServed &&
      save.patientsServed < upgrade.requiredPatientsServed
    ) {
      soundFx.playError();
      showToast(
        `هذا الخيار مقفل حالياً — يُفتح بعد فحص ${upgrade.requiredPatientsServed} مريض (${save.patientsServed}/${upgrade.requiredPatientsServed}).`
      );
      return;
    }
    if (save.cash < upgrade.cost) {
      soundFx.playError();
      return;
    }

    soundFx.playPurchase();
    commitSaveUpdate((prev) => ({
      ...prev,
      cash: prev.cash - upgrade.cost,
      ownedUpgrades: [...prev.ownedUpgrades, id],
    }));

    if (id === 'lead_shield') setShieldUsed(true);
    if (id === 'ct_scanner') {
      setCtDoorOpen(true);
      showToast('تم تركيب جهاز المفراس (CT) وفتح باب غرفة السيتي في العيادة!');
    } else if (id === 'mri_suite') {
      setMriDoorOpen(true);
      showToast('تم تركيب جهاز الرنين المغناطيسي وفتح باب غرفة الـ MRI!');
    } else {
      showToast(`تم تركيب ${upgrade.titleAr} بنجاح`);
    }
  };

  // =========================================================================
  // RENDER: AUTH LOADING CHECK
  // =========================================================================
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#09111C] text-slate-100 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <p className="text-sm text-slate-300">
          جاري استرجاع حساب تقني الأشعة وتجهيز الغرفة...
        </p>
      </div>
    );
  }

  // =========================================================================
  // RENDER: AUTH SCREEN (LOGIN / REGISTER)
  // =========================================================================
  if (screenMode === 'AUTH' || !techProfile) {
    return (
      <AuthScreen
        initialSave={INITIAL_SAVE}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  // =========================================================================
  // RENDER: FULL-VIEWPORT FIRST-PERSON 3D CLINIC SIMULATION
  // =========================================================================
  const lowFilmsWarning = !hasDR && save.films <= 5;
  const cassetteStepLabel = isBoreScan
    ? 'جهاز مقطعي/رنين جاهز'
    : cassetteState === 'RACK'
      ? 'الكاسيت على الحامل'
      : cassetteState === 'IN_HAND'
        ? 'الكاسيت في يدك'
        : cassetteState === 'TABLE_BUCKY'
          ? 'الكاسيت تحت الطاولة'
          : 'الكاسيت في البكي الواقف';

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-[#09111C] text-slate-100 select-none">
      {/* FULL-SCREEN 3D RADIOLOGY CLINIC (FIRST-PERSON HANDS) */}
      <RadiologyRoom3D
        patient={activePatient}
        requestedExam={requestedExam}
        selectedRegion={selectedRegion}
        selectedPosture={selectedPosture}
        techLocation={techLocation}
        doorClosed={doorClosed}
        ctDoorOpen={ctDoorOpen}
        mriDoorOpen={mriDoorOpen}
        cassetteState={cassetteState}
        shieldUsed={hasLeadShield && shieldUsed}
        patientPrepped={effectiveBreathHeld}
        isExposing={isExposing}
        ownedUpgrades={save.ownedUpgrades}
        joystickRef={joystickRef}
        onTechZoneChange={handleTechZoneChange}
        onSceneInteract={handleSceneInteract}
      />

      {/* TOP BAR HUD (SOLID DARK PANELS — NO BACKDROP-BLUR OVER WEBGL) */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-20 p-2 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start justify-between gap-2 sm:gap-3">
        {/* Top-Right Telemetry & Account Bar */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between sm:justify-start gap-1.5 sm:gap-3 rounded-xl border border-slate-800 bg-[#08101C]/95 px-2.5 sm:px-3.5 py-1.5 sm:py-2 shadow-xl">
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
              <span>{hasDR ? 'رقمي DR' : `${save.films} فيلم`}</span>
            </div>

            <span className="text-slate-700">|</span>

            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-300 font-mono-num">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{save.patientsServed}</span>
            </div>
          </div>

          <span className="hidden md:inline text-slate-700">|</span>

          <span className="hidden md:inline text-xs text-slate-300 font-medium">
            {techProfile.name} ·{' '}
            <span className="text-cyan-300">{currentRank.titleAr}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                commitSaveUpdate((prev) => ({
                  ...prev,
                  soundEnabled: !prev.soundEnabled,
                }))
              }
              title={save.soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
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
              onClick={() => {
                setPcTab(currentEvaluation ? 'IMAGE' : 'LOG');
                setPcOpen(true);
              }}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-[11px] sm:text-xs font-semibold cursor-pointer transition-colors"
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span>الحاسوب</span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              title="تسجيل الخروج"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] sm:text-xs cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Top-Left Active Patient Request Card (Compact on phones) */}
        {activePatient && (
          <div className="pointer-events-auto rounded-xl border border-slate-800 bg-[#08101C]/95 p-2 sm:p-3 shadow-xl sm:max-w-sm w-full sm:w-auto flex items-center gap-2.5 sm:gap-3">
            <img
              src={activePatient.avatarPath}
              alt={activePatient.nameAr}
              referrerPolicy="no-referrer"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover border border-slate-700 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-0.5 text-[11px] sm:text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white truncate">
                  {activePatient.nameAr} ({activePatient.age} سنة)
                </span>
                <span className="font-mono-num font-bold text-emerald-400 shrink-0">
                  $
                  {requestedExam.modality === 'XRAY' && hasDR
                    ? 25
                    : requestedExam.baseFee}
                </span>
              </div>
              <div className="text-cyan-300 font-semibold truncate">
                المطلوب: {requestedExam.titleAr}
              </div>
              <div className="text-slate-400 truncate">
                {POSTURE_SHORT_AR[requestedExam.recommendedPosture]} ·{' '}
                <span className="font-mono-num text-slate-300">
                  {requestedExam.kvpRange[0]}–{requestedExam.kvpRange[1]} kVp /{' '}
                  {requestedExam.masRange[0]}–{requestedExam.masRange[1]} mAs
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* LOW FILMS QUICK WARNING STRIP */}
      {lowFilmsWarning && (
        <div className="pointer-events-auto fixed top-28 sm:top-20 right-2.5 sm:right-4 z-20 rounded-xl border border-amber-600/70 bg-[#1B1308]/95 px-3 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2 text-[11px] sm:text-xs text-amber-200 shadow-lg">
          <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {save.films === 0
              ? 'نفدت الأفلام!'
              : `تبقّى ${save.films} أفلام`}
          </span>
          <button
            type="button"
            onClick={() => {
              setPcTab('SHOP');
              setPcOpen(true);
            }}
            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
          >
            المتجر
          </button>
        </div>
      )}

      {/* TOAST FEEDBACK */}
      {toastMsg && (
        <div className="pointer-events-none fixed top-28 sm:top-20 left-1/2 -translate-x-1/2 z-30 rounded-xl border border-cyan-600/70 bg-[#081523]/95 px-3.5 py-2 text-[11px] sm:text-sm font-semibold text-cyan-100 flex items-center gap-2 shadow-2xl max-w-[92vw]">
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
          selectedProjection={selectedProjection}
          availableProjections={availableProjections}
          onSelectProjection={handleSelectProjection}
          selectedRegion={selectedRegion}
          doorClosed={doorClosed}
          cassetteReady={cassetteReady}
          cassetteStepLabel={cassetteStepLabel}
          isChestExam={isChestExam}
          breathHeld={effectiveBreathHeld}
          onRequestBreathHold={handleRequestBreathHold}
          hasProtocolAssist={hasProtocolAssist}
          hasDosimeter={hasDosimeter}
          hasTubeCooler={hasTubeCooler}
          kvpRange={requestedExam.kvpRange}
          masRange={requestedExam.masRange}
          onAutoCalibrate={handleAutoCalibrate}
          onExpose={handleExpose}
          isExposing={isExposing}
          isDeveloping={isDeveloping}
          caseApproved={caseApproved}
          onClose={() => setConsoleOpen(false)}
        />
      )}

      {/* VIRTUAL JOYSTICK CIRCLE (Optimized Mobile Left-Thumb Walk + Right-Thumb Look) */}
      {!pcOpen && (
        <div
          className={`pointer-events-auto fixed left-3 sm:left-auto sm:right-6 sm:bottom-6 z-20 ${
            techLocation === 'ROOM' && !caseApproved
              ? 'bottom-[156px]'
              : 'bottom-20'
          }`}
        >
          <VirtualJoystick
            joystickRef={joystickRef}
            label={
              techLocation === 'BOOTH'
                ? 'تحريك التقني (التحكم)'
                : 'تحريك التقني'
            }
          />
        </div>
      )}

      {/* BOTTOM FIRST-PERSON WORKFLOW DOCK (Mobile-friendly scrollable chips & action bar) */}
      <footer className="pointer-events-none fixed bottom-0 inset-x-0 z-20 px-2 pt-1.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] sm:p-4 flex flex-col items-center gap-1.5 sm:gap-2">
        {/* Inside Exam Room: Quick Positioning & Cassette Controls */}
        {techLocation === 'ROOM' && !caseApproved && (
          <div className="pointer-events-auto max-w-5xl w-full rounded-2xl border border-slate-800 bg-[#08101C]/95 px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-2xl flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-1 sm:gap-2.5">
            {/* Postures */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
              <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                الوضعية:
              </span>
              {POSTURE_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPosture(p.id)}
                  className={`px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    selectedPosture === p.id
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Regions + Lead Shield */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
              <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                المنطقة:
              </span>
              {REGION_OPTIONS.map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setSelectedRegion(reg)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    selectedRegion === reg
                      ? 'bg-sky-500/25 border border-sky-400 text-sky-200'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {REGION_LABELS_AR[reg].split(' ')[0]}
                </button>
              ))}

              {hasLeadShield && (
                <button
                  type="button"
                  onClick={() => setShieldUsed((v) => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer border ${
                    shieldUsed
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  <Shield className="w-3 h-3 shrink-0" />
                  <span>{shieldUsed ? 'الدرع ✓' : 'درع الحماية'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Primary Clinical Step Action Bar */}
        <div className="pointer-events-auto max-w-full rounded-2xl border border-slate-700/80 bg-[#08101C]/95 px-2.5 sm:px-4 py-2 shadow-2xl flex items-center gap-2 overflow-x-auto no-scrollbar">
          {caseApproved ? (
            <button
              type="button"
              onClick={handleFinishExamAndNextPatient}
              className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>انتهاء الفحص — استقبال المريض التالي</span>
            </button>
          ) : techLocation === 'ROOM' ? (
            <>
              {!isBoreScan && cassetteState === 'RACK' && (
                <button
                  type="button"
                  onClick={handlePickUpCassette}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Hand className="w-4 h-4 shrink-0" />
                  <span>أخذ الكاسيت بيدك</span>
                </button>
              )}

              {!isBoreScan && cassetteState === 'IN_HAND' && (
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
                      ? 'وضع الكاسيت في البكي الواقف'
                      : 'إدخال الكاسيت تحت الطاولة'}
                  </span>
                </button>
              )}

              {cassetteReady && (
                <span className="text-[11px] sm:text-xs font-semibold text-emerald-300 px-1.5 whitespace-nowrap shrink-0">
                  ✓ {cassetteStepLabel}
                </span>
              )}

              <button
                type="button"
                onClick={handleToggleDoorAndBooth}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  cassetteReady
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <DoorClosed className="w-4 h-4 shrink-0" />
                <span>الخروج وإغلاق الباب</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleToggleDoorAndBooth}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  !doorClosed
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
                  {doorClosed
                    ? 'العودة لغرفة الفحص'
                    : 'إغلاق الباب الرصاصي'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setConsoleOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-600/40 text-cyan-200 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>{consoleOpen ? 'إخفاء اللوحة' : 'لوحة التعريض'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPcTab(currentEvaluation ? 'IMAGE' : 'LOG');
                  setPcOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Monitor className="w-4 h-4 shrink-0" />
                <span>الحاسوب (View & Mask)</span>
              </button>

              {currentEvaluation && !currentEvaluation.success && (
                <button
                  type="button"
                  onClick={handleFinishExamAndNextPatient}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                  <span>المريض التالي</span>
                </button>
              )}
            </>
          )}
        </div>
      </footer>

      {/* CLINIC COMPUTER WORKSTATION MODAL (IMAGE EDITOR, PREVIOUS PATIENTS, SHOP, PROTOCOLS) */}
      <ClinicPCModal
        isOpen={pcOpen}
        activeTab={pcTab}
        onChangeTab={setPcTab}
        onClose={() => setPcOpen(false)}
        activePatient={activePatient}
        requestedExam={requestedExam}
        evaluation={currentEvaluation}
        isDeveloping={isDeveloping}
        hasDR={hasDR}
        hasAutoProc={hasAutoProc}
        kvp={kvp}
        mas={mas}
        filmsRemaining={save.films}
        onApproveAndCollect={handleApproveAndCollect}
        onRetake={() => {
          setCurrentEvaluation(null);
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
    </div>
  );
}
