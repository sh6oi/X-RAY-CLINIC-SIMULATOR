import React, {createContext, useContext, useEffect, useState} from 'react';
import type {
  BodyRegion,
  Language,
  Modality,
  PatientPosture,
  ProjectionType,
  UpgradeId,
} from '../types/radiology';

const LANG_STORAGE_KEY = 'radiology_clinic_lang_v1';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ar',
  setLang: () => {},
  toggleLang: () => {},
});

export const LanguageProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return (
    <LanguageContext.Provider value={{lang, setLang, toggleLang}}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export const DESIGNER_INSTAGRAM_URL =
  'https://www.instagram.com/mojtabakr1.sc?gwpx=bXR0YjM1MzJ0NmE0';

export const REGION_LABELS_I18N: Record<Language, Record<BodyRegion, string>> = {
  ar: {
    head: 'الرأس والجمجمة',
    cervical: 'الفقرات العنقية (الرقبة)',
    chest: 'الصدر والرئتين',
    lumbar: 'العمود الفقري القطني',
    pelvis: 'الحوض والورك',
    hand: 'اليد والرسغ',
    knee: 'الركبة',
  },
  en: {
    head: 'Head & Skull',
    cervical: 'Cervical Spine (Neck)',
    chest: 'Chest & Lungs',
    lumbar: 'Lumbar Spine',
    pelvis: 'Pelvis & Hip',
    hand: 'Hand & Wrist',
    knee: 'Knee Joint',
  },
};

export const REGION_SHORT_I18N: Record<Language, Record<BodyRegion, string>> = {
  ar: {
    head: 'الرأس',
    cervical: 'الرقبة',
    chest: 'الصدر',
    lumbar: 'القطنية',
    pelvis: 'الحوض',
    hand: 'اليد',
    knee: 'الركبة',
  },
  en: {
    head: 'Head',
    cervical: 'Neck',
    chest: 'Chest',
    lumbar: 'Lumbar',
    pelvis: 'Pelvis',
    hand: 'Hand',
    knee: 'Knee',
  },
};

export const POSTURE_SHORT_I18N: Record<
  Language,
  Record<PatientPosture, string>
> = {
  ar: {
    ERECT_PA: 'واقف PA',
    ERECT_AP: 'واقف AP',
    ERECT_LEFT_LAT: 'واقف يسار',
    ERECT_RIGHT_LAT: 'واقف يمين',
    ERECT_RAO: 'واقف مائل RAO',
    ERECT_LAO: 'واقف مائل LAO',
    SUPINE: 'على الظهر',
    PRONE: 'على البطن',
    TABLE_LEFT_LAT: 'طاولة يسار',
    TABLE_RIGHT_LAT: 'طاولة يمين',
    TABLE_RPO: 'طاولة مائل RPO',
    TABLE_LPO: 'طاولة مائل LPO',
  },
  en: {
    ERECT_PA: 'Erect PA',
    ERECT_AP: 'Erect AP',
    ERECT_LEFT_LAT: 'Erect L-Lat',
    ERECT_RIGHT_LAT: 'Erect R-Lat',
    ERECT_RAO: 'Erect RAO',
    ERECT_LAO: 'Erect LAO',
    SUPINE: 'Supine',
    PRONE: 'Prone',
    TABLE_LEFT_LAT: 'Table L-Lat',
    TABLE_RIGHT_LAT: 'Table R-Lat',
    TABLE_RPO: 'Table RPO',
    TABLE_LPO: 'Table LPO',
  },
};

export const POSTURE_LABELS_I18N: Record<
  Language,
  Record<PatientPosture, string>
> = {
  ar: {
    SUPINE: 'مستلقٍ على الظهر (Supine)',
    PRONE: 'مستلقٍ على البطن (Prone)',
    TABLE_LEFT_LAT: 'نائم جانبياً — يسار (Left Lateral)',
    TABLE_RIGHT_LAT: 'نائم جانبياً — يمين (Right Lateral)',
    TABLE_RPO: 'طاولة مائل خلفي يمين (RPO 45°)',
    TABLE_LPO: 'طاولة مائل خلفي يسار (LPO 45°)',
    ERECT_PA: 'واقف (Erect) · خلفي-أمامي PA',
    ERECT_AP: 'واقف (Erect) · أمامي-خلفي AP',
    ERECT_LEFT_LAT: 'واقف (Erect) · جانبي أيسر (Left Lat)',
    ERECT_RIGHT_LAT: 'واقف (Erect) · جانبي أيمن (Right Lat)',
    ERECT_RAO: 'واقف (Erect) · مائل أمامي أيمن (RAO 45°)',
    ERECT_LAO: 'واقف (Erect) · مائل أمامي أيسر (LAO 45°)',
  },
  en: {
    SUPINE: 'Supine (On Back)',
    PRONE: 'Prone (On Stomach)',
    TABLE_LEFT_LAT: 'Table Left Lateral',
    TABLE_RIGHT_LAT: 'Table Right Lateral',
    TABLE_RPO: 'Table Right Posterior Oblique (RPO)',
    TABLE_LPO: 'Table Left Posterior Oblique (LPO)',
    ERECT_PA: 'Erect · PA Standing',
    ERECT_AP: 'Erect · AP Standing',
    ERECT_LEFT_LAT: 'Erect · Left Lateral',
    ERECT_RIGHT_LAT: 'Erect · Right Lateral',
    ERECT_RAO: 'Erect · Right Anterior Oblique (RAO)',
    ERECT_LAO: 'Erect · Left Anterior Oblique (LAO)',
  },
};

export const PROJECTION_LABELS_I18N: Record<
  Language,
  Record<ProjectionType, string>
> = {
  ar: {
    PA: 'خلفي-أمامي (PA)',
    AP: 'أمامي-خلفي (AP)',
    LATERAL: 'جانبي (Lateral)',
    OBLIQUE: 'مائل (Oblique 45°)',
    AXIAL: 'مقطعي محوري (Axial)',
    SAGITTAL: 'رنين سهمي (Sagittal)',
  },
  en: {
    PA: 'Posteroanterior (PA)',
    AP: 'Anteroposterior (AP)',
    LATERAL: 'Lateral View',
    OBLIQUE: 'Oblique View (45°)',
    AXIAL: 'Axial CT Slice',
    SAGITTAL: 'Sagittal MRI',
  },
};

export const MODALITY_LABELS_I18N: Record<Language, Record<Modality, string>> = {
  ar: {
    XRAY: 'أشعة سينية',
    CT: 'أشعة مقطعية CT',
    MRI: 'رنين مغناطيسي MRI',
  },
  en: {
    XRAY: 'X-Ray Radiography',
    CT: 'CT Scan',
    MRI: 'MRI Scan',
  },
};

export const RANK_TITLES_I18N: Record<Language, Record<string, string>> = {
  ar: {
    starter: 'عيادة أشعة ناشئة',
    neighborhood: 'عيادة حي معتمدة',
    specialized: 'مركز الأشعة التخصصي',
    diagnostic_hub: 'مجمع التصوير الطبي المتكامل',
    medical_empire: 'صرح التصوير التشخيصي الرائد',
  },
  en: {
    starter: 'Starter Radiology Clinic',
    neighborhood: 'Certified Local Clinic',
    specialized: 'Specialized Imaging Center',
    diagnostic_hub: 'Diagnostic Imaging Complex',
    medical_empire: 'Premier Medical Imaging Hub',
  },
};

export const UPGRADE_EN: Record<
  UpgradeId,
  {title: string; description: string; benefit: string}
> = {
  lead_shield: {
    title: 'Lead Apron & Gonadal Shield',
    description:
      'Provides protective lead shielding for patients during exposure, adding +$3 safety & quality bonus per scan.',
    benefit: '+$3 safety bonus per patient',
  },
  dosimeter_badge: {
    title: 'Digital Personal Dosimeter',
    description:
      'Displays live kVp & mAs protocol alignment inside the console before firing and adds +$2 safety bonus.',
    benefit: 'Live kVp/mAs guide + $2 safety',
  },
  thyroid_collar: {
    title: 'Thyroid Collar & Lead Eyewear',
    description:
      'Extra radiation protection for neck and eyes against scatter radiation, adding +$3 safety per exam.',
    benefit: '+$3 radiation safety bonus',
  },
  auto_processor: {
    title: 'Automatic Film Processor',
    description:
      'Faster film processing inside the CR reader with sharper diagnostic contrast and +$2 accuracy bonus.',
    benefit: 'Faster CR readout + $2 bonus',
  },
  immobilization_kit: {
    title: 'Immobilization Wedges & Pads',
    description:
      'Reduces patient motion and widens kVp/mAs tolerance margins to prevent retakes, adding +$3 quality.',
    benefit: 'Wider dose tolerance + $3 quality',
  },
  collimator_laser: {
    title: 'Precision Laser Collimator',
    description:
      'Crisp laser crosshair field alignment lowers scatter and boosts diagnostic score by +$3 per scan.',
    benefit: 'Laser alignment + $3 quality',
  },
  protocol_assist: {
    title: 'Smart Protocol Auto-Calibrator',
    description:
      'Adds a one-tap Auto-Calibrate button on the console to set kVp, mAs, and posture accurately.',
    benefit: 'One-tap console auto-calibration',
  },
  waiting_room: {
    title: 'Waiting Room Expansion',
    description:
      'Increases clinic waiting room capacity from 3 to 6 seats and boosts daily clinic visitors from 10–15 to 20–25 patients per day.',
    benefit: '20–25 patients/day · 6 seats',
  },
  tube_cooler: {
    title: 'High-Capacity Tube Cooling',
    description:
      'Cuts X-ray tube heat load and speeds up exposure & CR processing time by 40% (+$2 efficiency).',
    benefit: 'Faster exposure & CR speed + $2',
  },
  dry_laser_printer: {
    title: 'Dry Laser Medical Imager',
    description:
      'High-contrast medical dry film printing for patients, increasing each exam fee by +$4.',
    benefit: '+$4 print fee per patient',
  },
  ai_pacs: {
    title: 'Dual-Monitor AI PACS Suite',
    description:
      'Advanced diagnostic workstation boosts image review precision and adds +$5 per completed scan.',
    benefit: '+$5 diagnostic precision bonus',
  },
  digital_dr: {
    title: 'Digital Radiography Flat-Panel (DR)',
    description:
      'Upgrade from CR to full Digital DR! Zero film consumption, no CR Reader step required — scans transfer straight to PC, raising X-Ray fee to $25.',
    benefit: 'Skip CR Reader + Instant PC transfer + $25 fee',
  },
  vip_lounge: {
    title: 'VIP Patient Comfort Lounge',
    description:
      'Luxury patient waiting suite with calm ambiance and hospitality, adding +$8 revenue per exam.',
    benefit: '+$8 VIP hospitality bonus',
  },
  ct_scanner: {
    title: '64-Slice CT Scanner Suite',
    description:
      'For the locked CT Scanner Room — currently unavailable for purchase (Coming Soon).',
    benefit: 'Unavailable · Coming Soon',
  },
  mri_suite: {
    title: '1.5T MRI Imaging Suite',
    description:
      'For the locked MRI Suite — currently unavailable for purchase (Coming Soon).',
    benefit: 'Unavailable · Coming Soon',
  },
  assistant_tech: {
    title: 'Hire Assistant Radiographer',
    description:
      'Master tier unlocked only after serving 500 patients! Handles extra cases automatically for passive revenue.',
    benefit: 'Unlocks at 500 patients · Passive income',
  },
};
