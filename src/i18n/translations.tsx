import React, {createContext, useContext, useEffect, useState} from 'react';
import type {
  BodyRegion,
  BodySide,
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

export const BILATERAL_REGIONS: ReadonlySet<BodyRegion> = new Set<BodyRegion>([
  'ribs',
  'shoulder',
  'clavicle',
  'humerus',
  'elbow',
  'forearm',
  'wrist',
  'hand',
  'hip',
  'femur',
  'knee',
  'tibia_fibula',
  'ankle',
  'foot',
  'toes',
]);

export function isBilateralRegion(region: BodyRegion): boolean {
  return BILATERAL_REGIONS.has(region);
}

export const SIDE_LABELS_I18N: Record<Language, Record<BodySide, string>> = {
  ar: {
    RIGHT: 'الجانب الأيمن (Right R)',
    LEFT: 'الجانب الأيسر (Left L)',
    NONE: 'محوري / ثنائي',
  },
  en: {
    RIGHT: 'Right (R)',
    LEFT: 'Left (L)',
    NONE: 'Midline / Bilateral',
  },
};

export const SIDE_SHORT_I18N: Record<Language, Record<BodySide, string>> = {
  ar: {
    RIGHT: 'أيمن (R)',
    LEFT: 'أيسر (L)',
    NONE: '',
  },
  en: {
    RIGHT: 'Right (R)',
    LEFT: 'Left (L)',
    NONE: '',
  },
};

export const REGION_LABELS_I18N: Record<Language, Record<BodyRegion, string>> = {
  ar: {
    head: 'الجمجمة (Skull)',
    facial_bones: 'عظام الوجه (Facial bones)',
    nasal_bones: 'الأنف (Nasal bones)',
    soft_tissue_neck: 'العنق (Soft tissue neck)',
    cervical: 'الفقرات العنقية (C-spine)',
    thoracic: 'الفقرات الصدرية (T-spine)',
    lumbar: 'الفقرات القطنية (L-spine)',
    chest: 'الصدر (Chest)',
    ribs: 'الأضلاع (Ribs)',
    abdomen: 'البطن (Abdomen)',
    shoulder: 'الكتف (Shoulder)',
    clavicle: 'الترقوة (Clavicle)',
    humerus: 'عظمة العضد (Humerus)',
    elbow: 'مفصل الكوع (Elbow)',
    forearm: 'عظمة الساعد (Forearm)',
    wrist: 'مفصل الرسغ (Wrist)',
    hand: 'اليد (Hand)',
    pelvis: 'الحوض (Pelvis)',
    hip: 'مفصل الورك (Hip)',
    femur: 'عظمة الفخذ (Femur)',
    knee: 'مفصل الركبة (Knee)',
    tibia_fibula: 'عظمة الساق (Tibia/Fibula)',
    ankle: 'مفصل الكاحل (Ankle)',
    foot: 'القدم (Foot)',
    toes: 'أصابع القدم (Toes)',
    sacrum_coccyx: 'العجز والعصعص (Sacrum/Coccyx)',
  },
  en: {
    head: 'Skull (AP/PA & Lateral)',
    facial_bones: 'Facial Bones',
    nasal_bones: 'Nasal Bones',
    soft_tissue_neck: 'Soft Tissue Neck',
    cervical: 'Cervical Spine (C-spine)',
    thoracic: 'Thoracic Spine (T-spine)',
    lumbar: 'Lumbar Spine (L-spine)',
    chest: 'Chest',
    ribs: 'Ribs',
    abdomen: 'Abdomen',
    shoulder: 'Shoulder',
    clavicle: 'Clavicle',
    humerus: 'Humerus',
    elbow: 'Elbow Joint',
    forearm: 'Forearm',
    wrist: 'Wrist Joint',
    hand: 'Hand',
    pelvis: 'Pelvis',
    hip: 'Hip Joint',
    femur: 'Femur',
    knee: 'Knee Joint',
    tibia_fibula: 'Tibia / Fibula',
    ankle: 'Ankle Joint',
    foot: 'Foot',
    toes: 'Toes',
    sacrum_coccyx: 'Sacrum / Coccyx',
  },
};

export const REGION_SHORT_I18N: Record<Language, Record<BodyRegion, string>> = {
  ar: {
    head: 'الجمجمة',
    facial_bones: 'عظام الوجه',
    nasal_bones: 'الأنف',
    soft_tissue_neck: 'العنق الرخوة',
    cervical: 'العنقية',
    thoracic: 'الصدرية',
    lumbar: 'القطنية',
    chest: 'الصدر',
    ribs: 'الأضلاع',
    abdomen: 'البطن',
    shoulder: 'الكتف',
    clavicle: 'الترقوة',
    humerus: 'العضد',
    elbow: 'الكوع',
    forearm: 'الساعد',
    wrist: 'الرسغ',
    hand: 'اليد',
    pelvis: 'الحوض',
    hip: 'الورك',
    femur: 'الفخذ',
    knee: 'الركبة',
    tibia_fibula: 'الساق',
    ankle: 'الكاحل',
    foot: 'القدم',
    toes: 'أصابع القدم',
    sacrum_coccyx: 'العجز والعصعص',
  },
  en: {
    head: 'Skull',
    facial_bones: 'Facial',
    nasal_bones: 'Nasal',
    soft_tissue_neck: 'Soft Neck',
    cervical: 'C-spine',
    thoracic: 'T-spine',
    lumbar: 'L-spine',
    chest: 'Chest',
    ribs: 'Ribs',
    abdomen: 'Abdomen',
    shoulder: 'Shoulder',
    clavicle: 'Clavicle',
    humerus: 'Humerus',
    elbow: 'Elbow',
    forearm: 'Forearm',
    wrist: 'Wrist',
    hand: 'Hand',
    pelvis: 'Pelvis',
    hip: 'Hip',
    femur: 'Femur',
    knee: 'Knee',
    tibia_fibula: 'Tibia/Fibula',
    ankle: 'Ankle',
    foot: 'Foot',
    toes: 'Toes',
    sacrum_coccyx: 'Sacrum/Coccyx',
  },
};

export function formatRegionWithSide(
  region: BodyRegion,
  side: BodySide | undefined,
  lang: Language,
  short = false
): string {
  const base = short ? REGION_SHORT_I18N[lang][region] : REGION_LABELS_I18N[lang][region];
  if (!isBilateralRegion(region) || !side || side === 'NONE') {
    return base;
  }
  const sideLabel = SIDE_SHORT_I18N[lang][side];
  return `${base} — ${sideLabel}`;
}

export interface RegionGroupDef {
  id: 'head_neck' | 'spine_torso' | 'upper_limb' | 'lower_limb';
  titleAr: string;
  titleEn: string;
  regions: BodyRegion[];
}

export const REGION_GROUPS: RegionGroupDef[] = [
  {
    id: 'head_neck',
    titleAr: 'الرأس والوجه والعنق',
    titleEn: 'Head, Face & Neck',
    regions: ['head', 'facial_bones', 'nasal_bones', 'soft_tissue_neck', 'cervical'],
  },
  {
    id: 'spine_torso',
    titleAr: 'الصدر والعمود والبطن والحوض',
    titleEn: 'Thorax, Spine, Abdomen & Pelvis',
    regions: ['chest', 'ribs', 'thoracic', 'lumbar', 'abdomen', 'pelvis', 'sacrum_coccyx'],
  },
  {
    id: 'upper_limb',
    titleAr: 'الطرف العلوي (يمين / يسار)',
    titleEn: 'Upper Extremity (Right / Left)',
    regions: ['clavicle', 'shoulder', 'humerus', 'elbow', 'forearm', 'wrist', 'hand'],
  },
  {
    id: 'lower_limb',
    titleAr: 'الطرف السفلي (يمين / يسار)',
    titleEn: 'Lower Extremity (Right / Left)',
    regions: ['hip', 'femur', 'knee', 'tibia_fibula', 'ankle', 'foot', 'toes'],
  },
];

export const POSTURE_SHORT_I18N: Record<
  Language,
  Record<PatientPosture, string>
> = {
  ar: {
    ERECT_PA: 'Erect PA',
    ERECT_AP: 'Erect AP',
    ERECT_LEFT_LAT: 'Erect Left Lateral',
    ERECT_RIGHT_LAT: 'Erect Right Lateral',
    ERECT_RAO: 'Erect RAO',
    ERECT_LAO: 'Erect LAO',
    SUPINE: 'Supine',
    PRONE: 'Prone',
    TABLE_LEFT_LAT: 'Table Left Lateral',
    TABLE_RIGHT_LAT: 'Table Right Lateral',
    TABLE_RPO: 'Table RPO',
    TABLE_LPO: 'Table LPO',
  },
  en: {
    ERECT_PA: 'Erect PA',
    ERECT_AP: 'Erect AP',
    ERECT_LEFT_LAT: 'Erect Left Lateral',
    ERECT_RIGHT_LAT: 'Erect Right Lateral',
    ERECT_RAO: 'Erect RAO',
    ERECT_LAO: 'Erect LAO',
    SUPINE: 'Supine',
    PRONE: 'Prone',
    TABLE_LEFT_LAT: 'Table Left Lateral',
    TABLE_RIGHT_LAT: 'Table Right Lateral',
    TABLE_RPO: 'Table RPO',
    TABLE_LPO: 'Table LPO',
  },
};

export const POSTURE_LABELS_I18N: Record<
  Language,
  Record<PatientPosture, string>
> = {
  ar: {
    SUPINE: 'Supine (On Back)',
    PRONE: 'Prone (On Stomach)',
    TABLE_LEFT_LAT: 'Table Left Lateral',
    TABLE_RIGHT_LAT: 'Table Right Lateral',
    TABLE_RPO: 'Table Right Posterior Oblique (RPO 45°)',
    TABLE_LPO: 'Table Left Posterior Oblique (LPO 45°)',
    ERECT_PA: 'Erect · PA Standing',
    ERECT_AP: 'Erect · AP Standing',
    ERECT_LEFT_LAT: 'Erect · Left Lateral',
    ERECT_RIGHT_LAT: 'Erect · Right Lateral',
    ERECT_RAO: 'Erect · Right Anterior Oblique (RAO 45°)',
    ERECT_LAO: 'Erect · Left Anterior Oblique (LAO 45°)',
  },
  en: {
    SUPINE: 'Supine (On Back)',
    PRONE: 'Prone (On Stomach)',
    TABLE_LEFT_LAT: 'Table Left Lateral',
    TABLE_RIGHT_LAT: 'Table Right Lateral',
    TABLE_RPO: 'Table Right Posterior Oblique (RPO 45°)',
    TABLE_LPO: 'Table Left Posterior Oblique (LPO 45°)',
    ERECT_PA: 'Erect · PA Standing',
    ERECT_AP: 'Erect · AP Standing',
    ERECT_LEFT_LAT: 'Erect · Left Lateral',
    ERECT_RIGHT_LAT: 'Erect · Right Lateral',
    ERECT_RAO: 'Erect · Right Anterior Oblique (RAO 45°)',
    ERECT_LAO: 'Erect · Left Anterior Oblique (LAO 45°)',
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
      'Provides protective lead shielding for patients during exposure, adding +$0.5 safety bonus per patient.',
    benefit: '+$0.5 safety bonus per patient',
  },
  area_radiation_monitor: {
    title: 'Wall Radiation Area Monitor',
    description:
      'Digital radiation detector continuously tracks room dose levels, elevating clinical safety compliance and adding +$0.5 per patient.',
    benefit: 'Continuous monitoring + $0.5 safety',
  },
  dosimeter_badge: {
    title: 'Digital Personal Dosimeter',
    description:
      'Displays live kVp & mAs protocol alignment inside the console before firing and adds +$0.5 safety bonus.',
    benefit: 'Live kVp/mAs guide + $0.5 safety',
  },
  thyroid_collar: {
    title: 'Thyroid Collar & Lead Eyewear',
    description:
      'Extra radiation protection for neck and eyes against scatter radiation, adding +$1 safety per patient.',
    benefit: '+$1 radiation safety bonus',
  },
  lead_glass_barrier: {
    title: 'Heavy Lead-Glass Control Shield',
    description:
      'Reinforced high-density leaded glass window shields the booth completely from scatter, adding +$1 safety per patient.',
    benefit: '+$1 booth shielding safety',
  },
  auto_processor: {
    title: 'Automatic Film Processor',
    description:
      'Faster film processing inside the CR reader with sharper diagnostic contrast and +$1 accuracy bonus per patient.',
    benefit: 'Faster CR readout + $1 bonus',
  },
  immobilization_kit: {
    title: 'Immobilization Wedges & Pads',
    description:
      'Reduces patient motion and widens kVp/mAs tolerance margins to prevent retakes, adding +$1 quality per patient.',
    benefit: 'Wider dose tolerance + $1 quality',
  },
  bucky_grid: {
    title: 'Anti-Scatter Carbon Bucky Grid',
    description:
      'Absorbs secondary scatter radiation for crisp bone contrast, slightly widens exposure margins, and adds +$1 quality.',
    benefit: 'Anti-scatter contrast + $1 quality',
  },
  collimator_laser: {
    title: 'Precision Laser Collimator',
    description:
      'Crisp laser crosshair field alignment lowers scatter and boosts diagnostic score by +$1 per patient.',
    benefit: 'Laser alignment + $1 quality',
  },
  protocol_assist: {
    title: 'Smart Protocol Auto-Calibrator',
    description:
      'Adds a one-tap Auto-Calibrate button on the console to set kVp, mAs, and posture accurately.',
    benefit: 'One-tap console auto-calibration',
  },
  aec_sensor: {
    title: 'Automatic Exposure Control (AEC)',
    description:
      'Three-field ionization sensor automatically compensates exposure levels, preventing under/overexposed films and adding +$1.5 quality.',
    benefit: 'Smart AEC margin + $1.5 quality',
  },
  waiting_room: {
    title: 'Waiting Room Expansion',
    description:
      'Increases clinic waiting room capacity from 3 to 6 seats and boosts daily clinic visitors from 10–15 to 20–25 patients per day.',
    benefit: '20–25 patients/day · 6 seats',
  },
  ergonomic_table_pad: {
    title: 'Radiolucent Memory-Foam Table Pad',
    description:
      'Ergonomic X-ray table mattress stabilizes spine/pelvis positioning cleanly and adds +$1.5 comfort & quality bonus.',
    benefit: 'Patient comfort + $1.5 quality',
  },
  tube_cooler: {
    title: 'High-Capacity Tube Cooling',
    description:
      'Cuts X-ray tube heat load and speeds up exposure & CR processing time by 40% (+$1.5 efficiency per patient).',
    benefit: 'Faster exposure & CR speed + $1.5',
  },
  hepa_sterilizer: {
    title: 'Medical HEPA & UV-C Air Sterilizer',
    description:
      'Hospital-grade air purification keeps the imaging suite sterile and boosts clinic care rating by +$1.5 per patient.',
    benefit: '+$1.5 clinical hygiene & rating',
  },
  dry_laser_printer: {
    title: 'Dry Laser Medical Imager',
    description:
      'High-contrast medical dry film printing for patients, increasing each exam fee by +$1.5 per patient.',
    benefit: '+$1.5 print fee per patient',
  },
  ai_pacs: {
    title: 'Dual-Monitor AI PACS Suite',
    description:
      'Advanced diagnostic workstation boosts image review precision and adds +$2 per completed patient scan.',
    benefit: '+$2 diagnostic precision bonus',
  },
  teleradiology_link: {
    title: 'Encrypted Teleradiology Hub',
    description:
      'Real-time remote consultant radiologist reporting link adds +$2 specialist consultation bonus per patient.',
    benefit: '+$2 remote specialist bonus',
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
      'Luxury patient waiting suite with calm ambiance and hospitality, adding +$2 revenue per patient.',
    benefit: '+$2 VIP hospitality bonus',
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
      'Assistant Radiographer staffing option — currently unavailable for purchase (Coming Soon).',
    benefit: 'Unavailable · Coming Soon',
  },
};
