import type {
  BodyRegion,
  BodySide,
  ClinicRank,
  ExamProtocol,
  Modality,
  PatientCase,
  PatientPosture,
  ProjectionType,
  ScanEvaluation,
  UpgradeId,
  UpgradeItem,
} from '../types/radiology';
import {
  formatRegionWithSide,
  isBilateralRegion,
  SIDE_SHORT_I18N,
} from '../i18n/translations';
import {ASSETS} from './assets';

export const CLINIC_ROOM_IMAGE = ASSETS.clinicRoomImg;
export const CLINIC_RECEPTION_IMAGE = ASSETS.clinicReceptionImg;
export const FILM_CARTON_IMAGE = ASSETS.shopFilmCartonImg;

export const PATIENT_AVATARS = {
  manYoung: ASSETS.patientManYoungImg,
  manSenior: ASSETS.patientManSeniorImg,
  womanYoung: ASSETS.patientWomanYoungImg,
  womanSenior: ASSETS.patientWomanSeniorImg,
};

export const REGION_SCAN_IMAGES: Record<BodyRegion, string> = {
  head: ASSETS.xraySkullImg,
  facial_bones: ASSETS.xrayFacialBonesImg,
  nasal_bones: ASSETS.xrayNasalBonesImg,
  soft_tissue_neck: ASSETS.xrayNeckAirwayImg,
  cervical: ASSETS.xrayCervicalApImg,
  thoracic: ASSETS.xrayThoracicApImg,
  lumbar: ASSETS.xrayLumbarImg,
  chest: ASSETS.xrayChestImg,
  ribs: ASSETS.xrayRibsApImg,
  abdomen: ASSETS.xrayAbdomenKubImg,
  shoulder: ASSETS.xrayShoulderApImg,
  clavicle: ASSETS.xrayClavicleApImg,
  humerus: ASSETS.xrayHumerusApImg,
  elbow: ASSETS.xrayElbowApImg,
  forearm: ASSETS.xrayForearmApImg,
  wrist: ASSETS.xrayWristPaImg,
  hand: ASSETS.xrayHandImg,
  pelvis: ASSETS.xrayPelvisImg,
  hip: ASSETS.xrayHipApImg,
  femur: ASSETS.xrayFemurApImg,
  knee: ASSETS.xrayKneeImg,
  tibia_fibula: ASSETS.xrayTibiaFibulaImg,
  ankle: ASSETS.xrayAnkleApImg,
  foot: ASSETS.xrayFootApImg,
  toes: ASSETS.xrayToesApImg,
  sacrum_coccyx: ASSETS.xraySacrumCoccyxImg,
};

export const CT_SCAN_IMAGE = ASSETS.ctChestImg;
export const MRI_SCAN_IMAGE = ASSETS.mriLumbarImg;

export function getRadiographImage({
  region,
  modality,
  projection,
  posture,
  side,
}: {
  region: BodyRegion;
  modality: Modality;
  projection: ProjectionType;
  posture?: PatientPosture;
  side?: BodySide;
}): {src: string; mirrorX: boolean} {
  if (modality === 'CT') {
    return {
      src:
        region === 'head' || region === 'facial_bones' || region === 'nasal_bones'
          ? ASSETS.ctHeadAxialImg
          : ASSETS.ctChestImg,
      mirrorX: false,
    };
  }

  if (modality === 'MRI') {
    if (
      region === 'head' ||
      region === 'facial_bones' ||
      region === 'nasal_bones'
    ) {
      return {src: ASSETS.mriBrainSagittalImg, mirrorX: false};
    }
    if (
      region === 'knee' ||
      region === 'hip' ||
      region === 'femur' ||
      region === 'tibia_fibula' ||
      region === 'ankle' ||
      region === 'foot' ||
      region === 'toes'
    ) {
      return {
        src: ASSETS.mriKneeSagittalImg,
        mirrorX: side === 'RIGHT',
      };
    }
    return {src: ASSETS.mriLumbarImg, mirrorX: false};
  }

  const isPostureRight =
    posture === 'ERECT_RIGHT_LAT' ||
    posture === 'TABLE_RIGHT_LAT' ||
    posture === 'ERECT_LAO' ||
    posture === 'TABLE_LPO';
  const mirrorRightToLeft =
    isBilateralRegion(region) && side !== undefined && side !== 'NONE'
      ? side === 'LEFT'
      : isPostureRight;
  const mirrorLeftToRight =
    isBilateralRegion(region) && side !== undefined && side !== 'NONE'
      ? side === 'RIGHT'
      : isPostureRight;

  switch (region) {
    case 'head':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xraySkullLatImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xraySkullObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xraySkullImg, mirrorX: false};

    case 'facial_bones':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xraySkullLatImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xraySkullObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayFacialBonesImg, mirrorX: false};

    case 'nasal_bones':
      if (projection === 'AP' || projection === 'PA') {
        return {src: ASSETS.xrayFacialBonesImg, mirrorX: false};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xraySkullObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayNasalBonesImg, mirrorX: isPostureRight};

    case 'soft_tissue_neck':
      if (projection === 'AP' || projection === 'PA') {
        return {src: ASSETS.xrayCervicalApImg, mirrorX: false};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayCervicalObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayNeckAirwayImg, mirrorX: isPostureRight};

    case 'cervical':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayCervicalImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayCervicalObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayCervicalApImg, mirrorX: false};

    case 'thoracic':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayThoracicLatImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayThoracicApImg, mirrorX: false};

    case 'lumbar':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayLumbarLatImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayLumbarObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayLumbarImg, mirrorX: false};

    case 'chest':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayChestLatImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayChestObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayChestImg, mirrorX: false};

    case 'ribs':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayChestLatImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayChestObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayRibsApImg, mirrorX: mirrorLeftToRight};

    case 'abdomen':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayLumbarLatImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayLumbarObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayAbdomenKubImg, mirrorX: false};

    case 'shoulder':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayShoulderLatImg, mirrorX: mirrorRightToLeft};
      }
      return {src: ASSETS.xrayShoulderApImg, mirrorX: mirrorRightToLeft};

    case 'clavicle':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayShoulderLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayClavicleApImg, mirrorX: mirrorLeftToRight};

    case 'humerus':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayHumerusLatImg, mirrorX: mirrorRightToLeft};
      }
      return {src: ASSETS.xrayHumerusApImg, mirrorX: mirrorRightToLeft};

    case 'elbow':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayElbowLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayElbowApImg, mirrorX: mirrorRightToLeft};

    case 'forearm':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayForearmLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayForearmApImg, mirrorX: mirrorRightToLeft};

    case 'wrist':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayHandLatImg, mirrorX: mirrorLeftToRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayHandObliqueImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayWristPaImg, mirrorX: mirrorRightToLeft};

    case 'hand':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayHandLatImg, mirrorX: mirrorLeftToRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayHandObliqueImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayHandImg, mirrorX: mirrorLeftToRight};

    case 'pelvis':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xraySacrumLatImg, mirrorX: isPostureRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayPelvisObliqueImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xrayPelvisImg, mirrorX: false};

    case 'sacrum_coccyx':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xraySacrumLatImg, mirrorX: isPostureRight};
      }
      return {src: ASSETS.xraySacrumCoccyxImg, mirrorX: false};

    case 'hip':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayPelvisObliqueImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayHipApImg, mirrorX: mirrorLeftToRight};

    case 'femur':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayFemurLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayFemurApImg, mirrorX: mirrorLeftToRight};

    case 'knee':
      if (projection === 'LATERAL') {
        return {src: ASSETS.xrayKneeLatImg, mirrorX: mirrorLeftToRight};
      }
      if (projection === 'OBLIQUE') {
        return {src: ASSETS.xrayKneeObliqueImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayKneeImg, mirrorX: mirrorLeftToRight};

    case 'tibia_fibula':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayTibiaLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayTibiaFibulaImg, mirrorX: mirrorRightToLeft};

    case 'ankle':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayAnkleLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayAnkleApImg, mirrorX: mirrorLeftToRight};

    case 'foot':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayFootLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayFootApImg, mirrorX: mirrorRightToLeft};

    case 'toes':
      if (projection === 'LATERAL' || projection === 'OBLIQUE') {
        return {src: ASSETS.xrayFootLatImg, mirrorX: mirrorLeftToRight};
      }
      return {src: ASSETS.xrayToesApImg, mirrorX: mirrorRightToLeft};
  }
}

export const MINI_PACK_SIZE = 10;
export const MINI_PACK_COST = 80;
export const FILM_CARTON_SIZE = 20;
export const FILM_CARTON_COST = 150;
export const BULK_CARTON_SIZE = 100;
export const BULK_CARTON_COST = 650;
export const MEGA_CRATE_SIZE = 200;
export const MEGA_CRATE_COST = 1200;
export const EMERGENCY_LOAN_DEBT = 75;

export const REGION_LABELS_AR: Record<BodyRegion, string> = {
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
};

export const PROJECTION_LABELS_AR: Record<ProjectionType, string> = {
  PA: 'خلفي-أمامي (PA)',
  AP: 'أمامي-خلفي (AP)',
  LATERAL: 'جانبي (Lateral)',
  OBLIQUE: 'مائل (Oblique 45°)',
  AXIAL: 'مقطعي محوري (Axial)',
  SAGITTAL: 'رنين سهمي (Sagittal)',
};

export const POSTURE_LABELS_AR: Record<PatientPosture, string> = {
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
};

export const POSTURE_SHORT_AR: Record<PatientPosture, string> = {
  SUPINE: 'Supine',
  PRONE: 'Prone',
  TABLE_LEFT_LAT: 'Table Left Lateral',
  TABLE_RIGHT_LAT: 'Table Right Lateral',
  TABLE_RPO: 'Table RPO',
  TABLE_LPO: 'Table LPO',
  ERECT_PA: 'Erect PA',
  ERECT_AP: 'Erect AP',
  ERECT_LEFT_LAT: 'Erect Left Lateral',
  ERECT_RIGHT_LAT: 'Erect Right Lateral',
  ERECT_RAO: 'Erect RAO',
  ERECT_LAO: 'Erect LAO',
};

export const EXAMS: ExamProtocol[] = [
  // ================= HEAD, FACE & NECK =================
  {
    id: 'skull_ap',
    titleAr: 'الجمجمة (Skull AP/PA)',
    titleEn: 'Skull AP/PA',
    region: 'head',
    regionLabelAr: 'الجمجمة',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'ERECT_AP',
    postureLabelAr: 'واقف (Erect) · AP',
    kvpRange: [70, 80],
    masRange: [16, 25],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.head,
    clinicalTipAr:
      'تصوير الجمجمة AP/PA يتطلب 70–80 kVp و 16–25 mAs لإظهار عظام القحف والجيوب الأنفية بدقة.',
  },
  {
    id: 'skull_supine',
    titleAr: 'الجمجمة للطوارئ (مستلقٍ AP)',
    titleEn: 'Trauma Skull (Supine AP)',
    region: 'head',
    regionLabelAr: 'الجمجمة',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [70, 80],
    masRange: [16, 25],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.head,
    clinicalTipAr:
      'لحالات الرضوض التي يتعذر وقوفها: 70–80 kVp و 16–25 mAs بوضعية الاستلقاء على الظهر.',
  },
  {
    id: 'skull_lat',
    titleAr: 'الجمجمة الجانبية (Skull Lateral)',
    titleEn: 'Skull Lateral',
    region: 'head',
    regionLabelAr: 'الجمجمة',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'ERECT_RIGHT_LAT',
    postureLabelAr: 'واقف (Erect) · جانبي أيمن',
    kvpRange: [65, 75],
    masRange: [10, 16],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.head,
    clinicalTipAr:
      'الإسقاط الجانبي للجمجمة يحتاج طاقة أقل: 65–75 kVp و 10–16 mAs لإبراز السرج التركي والقحف الجانبي.',
  },
  {
    id: 'facial_bones_pa',
    titleAr: 'عظام الوجه (Facial bones)',
    titleEn: 'Facial Bones (Waters PA)',
    region: 'facial_bones',
    regionLabelAr: 'عظام الوجه',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'PA',
    projectionLabelAr: 'خلفي-أمامي (PA)',
    recommendedPosture: 'ERECT_PA',
    postureLabelAr: 'واقف (Erect) · PA',
    kvpRange: [65, 75],
    masRange: [8, 16],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.facial_bones,
    clinicalTipAr:
      'لتقييم عظام الوجنة والحجاج والجيوب الفكية: يُستخدم 65–75 kVp و 8–16 mAs بوضعية Erect PA.',
  },
  {
    id: 'nasal_bones_lat',
    titleAr: 'الأنف (Nasal bones)',
    titleEn: 'Nasal Bones (Lateral)',
    region: 'nasal_bones',
    regionLabelAr: 'الأنف',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'ERECT_RIGHT_LAT',
    postureLabelAr: 'واقف (Erect) · جانبي أيمن',
    kvpRange: [55, 65],
    masRange: [3, 6],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.nasal_bones,
    clinicalTipAr:
      'عظام الأنف الرقيقة تتطلب جرعة منخفضة: 55–65 kVp و 3–6 mAs حتى لا تحترق التفاصيل الدقيقة.',
  },
  {
    id: 'soft_tissue_neck_lat',
    titleAr: 'العنق — الأنسجة الرخوة (Soft tissue neck)',
    titleEn: 'Soft Tissue Neck (Lateral)',
    region: 'soft_tissue_neck',
    regionLabelAr: 'العنق (الأنسجة الرخوة)',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'ERECT_RIGHT_LAT',
    postureLabelAr: 'واقف (Erect) · جانبي أيمن',
    kvpRange: [65, 75],
    masRange: [8, 16],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.soft_tissue_neck,
    clinicalTipAr:
      'لتقييم مجرى الهواء العلوي ولسان المزمار والحنجرة: 65–75 kVp و 8–16 mAs بوضع جانبي قائم.',
  },
  {
    id: 'cervical_ap',
    titleAr: 'الفقرات العنقية (C-spine AP)',
    titleEn: 'Cervical Spine AP',
    region: 'cervical',
    regionLabelAr: 'الفقرات العنقية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'ERECT_AP',
    postureLabelAr: 'واقف (Erect) · AP',
    kvpRange: [70, 80],
    masRange: [8, 16],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.cervical,
    clinicalTipAr:
      'الفقرات العنقية AP تحتاج 70–80 kVp و 8–16 mAs لإبراز أجسام الفقرات C3–C7 بوضوح.',
  },
  {
    id: 'cervical_lat',
    titleAr: 'الفقرات العنقية الجانبية (C-spine Lateral)',
    titleEn: 'Cervical Spine Lateral',
    region: 'cervical',
    regionLabelAr: 'الفقرات العنقية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'ERECT_RIGHT_LAT',
    postureLabelAr: 'واقف (Erect) · جانبي أيمن',
    kvpRange: [70, 80],
    masRange: [12, 20],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.cervical,
    clinicalTipAr:
      'الوضع الجانبي للفقرات العنقية C1–C7 يستخدم 70–80 kVp و 12–20 mAs مع خفض الكتفين.',
  },
  {
    id: 'cervical_oblique_lao',
    titleAr: 'الثقوب العصبية العنقية (C-spine Oblique)',
    titleEn: 'Cervical Spine Oblique (LAO)',
    region: 'cervical',
    regionLabelAr: 'الفقرات العنقية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'OBLIQUE',
    projectionLabelAr: 'مائل (Oblique 45°)',
    recommendedPosture: 'ERECT_LAO',
    postureLabelAr: 'واقف مائل أيسر LAO',
    kvpRange: [70, 80],
    masRange: [10, 18],
    baseFee: 18,
    imagePath: REGION_SCAN_IMAGES.cervical,
    clinicalTipAr:
      'تدوير المريض 45 درجة (LAO) يفتح الثقوب بين الفقرات العنقية عند 70–80 kVp و 10–18 mAs.',
  },

  // ================= THORAX, SPINE & ABDOMEN =================
  {
    id: 'thoracic_ap',
    titleAr: 'الفقرات الصدرية (T-spine AP)',
    titleEn: 'Thoracic Spine AP',
    region: 'thoracic',
    regionLabelAr: 'الفقرات الصدرية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [75, 85],
    masRange: [20, 40],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.thoracic,
    clinicalTipAr:
      'تصوير الفقرات الصدرية T1–T12 الأمامي يتطلب 75–85 kVp و 20–40 mAs بوضع الاستلقاء على الظهر.',
  },
  {
    id: 'thoracic_lat',
    titleAr: 'الفقرات الصدرية الجانبية (T-spine Lateral)',
    titleEn: 'Thoracic Spine Lateral',
    region: 'thoracic',
    regionLabelAr: 'الفقرات الصدرية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'TABLE_LEFT_LAT',
    postureLabelAr: 'نائم جانبياً · يسار (Left Lat)',
    kvpRange: [80, 90],
    masRange: [40, 80],
    baseFee: 18,
    imagePath: REGION_SCAN_IMAGES.thoracic,
    clinicalTipAr:
      'اختراق الكتفين والقفص الصدري جانبياً يتطلب 80–90 kVp و 40–80 mAs على طاولة الأشعة.',
  },
  {
    id: 'lumbar_ap',
    titleAr: 'الفقرات القطنية (L-spine AP)',
    titleEn: 'Lumbar Spine AP',
    region: 'lumbar',
    regionLabelAr: 'الفقرات القطنية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [75, 85],
    masRange: [20, 40],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.lumbar,
    clinicalTipAr:
      'الفقرات القطنية L1–L5 بوضع Supine AP تحتاج 75–85 kVp و 20–40 mAs لإبراز التفاصيل العظمية.',
  },
  {
    id: 'lumbar_lat_left',
    titleAr: 'الفقرات القطنية الجانبية (L-spine Lateral)',
    titleEn: 'Lumbar Spine Lateral (Left)',
    region: 'lumbar',
    regionLabelAr: 'الفقرات القطنية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'TABLE_LEFT_LAT',
    postureLabelAr: 'نائم جانبياً · يسار (Left Lat)',
    kvpRange: [85, 95],
    masRange: [40, 80],
    baseFee: 18,
    imagePath: REGION_SCAN_IMAGES.lumbar,
    clinicalTipAr:
      'السُمك الجانبي لمنطقة البطن والقطنية يتطلب طاقة عالية: 85–95 kVp و 40–80 mAs.',
  },
  {
    id: 'lumbar_lat_right',
    titleAr: 'الفقرات القطنية الجانبية يمين (L-spine Lateral R)',
    titleEn: 'Lumbar Spine Lateral (Right)',
    region: 'lumbar',
    regionLabelAr: 'الفقرات القطنية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'TABLE_RIGHT_LAT',
    postureLabelAr: 'نائم جانبياً · يمين (Right Lat)',
    kvpRange: [85, 95],
    masRange: [40, 80],
    baseFee: 18,
    imagePath: REGION_SCAN_IMAGES.lumbar,
    clinicalTipAr:
      'الإسقاط الجانبي الأيمن للفقرات القطنية L1–S1 يلتزم بـ 85–95 kVp و 40–80 mAs.',
  },
  {
    id: 'lumbar_erect_pa',
    titleAr: 'تقوس العمود الفقري (Scoliosis Erect PA)',
    titleEn: 'Upright Lumbar / Scoliosis PA',
    region: 'lumbar',
    regionLabelAr: 'الفقرات القطنية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'PA',
    projectionLabelAr: 'خلفي-أمامي (PA)',
    recommendedPosture: 'ERECT_PA',
    postureLabelAr: 'واقف (Erect) · PA',
    kvpRange: [75, 85],
    masRange: [20, 40],
    baseFee: 18,
    imagePath: REGION_SCAN_IMAGES.lumbar,
    clinicalTipAr:
      'تُجرى بوضعية الوقوف Erect PA عند 75–85 kVp و 20–40 mAs لتقييم الجنف تحت وزن الجسم.',
  },
  {
    id: 'lumbar_oblique_rpo',
    titleAr: 'الفقرات القطنية المائلة (L-spine RPO)',
    titleEn: 'Lumbar Spine Oblique (RPO)',
    region: 'lumbar',
    regionLabelAr: 'الفقرات القطنية',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'OBLIQUE',
    projectionLabelAr: 'مائل (Oblique 45°)',
    recommendedPosture: 'TABLE_RPO',
    postureLabelAr: 'طاولة مائل خلفي يمين RPO',
    kvpRange: [75, 85],
    masRange: [20, 40],
    baseFee: 18,
    imagePath: REGION_SCAN_IMAGES.lumbar,
    clinicalTipAr:
      'إمالة المريض 45 درجة RPO تظهر البرزخ الفقري عند 75–85 kVp و 20–40 mAs.',
  },
  {
    id: 'chest_pa',
    titleAr: 'الصدر (Chest PA)',
    titleEn: 'Chest PA (Erect)',
    region: 'chest',
    regionLabelAr: 'الصدر',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'PA',
    projectionLabelAr: 'خلفي-أمامي (PA)',
    recommendedPosture: 'ERECT_PA',
    postureLabelAr: 'واقف (Erect) · PA',
    kvpRange: [110, 125],
    masRange: [1.5, 4],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.chest,
    clinicalTipAr:
      'أشعة الصدر PA القياسية للبالغين: 110–125 kVp مع كمية منخفضة جداً 1.5–4 mAs وكتم النفس.',
  },
  {
    id: 'chest_ap_supine',
    titleAr: 'الصدر للطوارئ (Chest Supine AP)',
    titleEn: 'Chest AP (Supine)',
    region: 'chest',
    regionLabelAr: 'الصدر',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [110, 125],
    masRange: [1.5, 4],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.chest,
    clinicalTipAr:
      'للمرضى غير القادرين على الوقوف: 110–125 kVp و 1.5–4 mAs بوضعية الاستلقاء Supine AP.',
  },
  {
    id: 'chest_ap_erect',
    titleAr: 'الصدر الواقف (Chest Erect AP)',
    titleEn: 'Chest AP (Erect)',
    region: 'chest',
    regionLabelAr: 'الصدر',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'ERECT_AP',
    postureLabelAr: 'واقف (Erect) · AP',
    kvpRange: [110, 125],
    masRange: [1.5, 4],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.chest,
    clinicalTipAr:
      'إسقاط Erect AP للصدر بجهد 110–125 kVp و 1.5–4 mAs مع كتم الشهيق.',
  },
  {
    id: 'chest_lat_left',
    titleAr: 'الصدر الجانبي (Chest Lateral يسار)',
    titleEn: 'Chest Lateral (Left Erect)',
    region: 'chest',
    regionLabelAr: 'الصدر',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'ERECT_LEFT_LAT',
    postureLabelAr: 'واقف (Erect) · جانبي أيسر',
    kvpRange: [110, 125],
    masRange: [4, 8],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.chest,
    clinicalTipAr:
      'الصدر الجانبي يحتاج ضعف mAs الصدر الأمامي: 110–125 kVp و 4–8 mAs مع رفع الذراعين.',
  },
  {
    id: 'chest_lat_right',
    titleAr: 'الصدر الجانبي (Chest Lateral يمين)',
    titleEn: 'Chest Lateral (Right Erect)',
    region: 'chest',
    regionLabelAr: 'الصدر',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'ERECT_RIGHT_LAT',
    postureLabelAr: 'واقف (Erect) · جانبي أيمن',
    kvpRange: [110, 125],
    masRange: [4, 8],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.chest,
    clinicalTipAr:
      'الجانب الأيمن ملاصق للحامل الجداري مع كتم النفس بجهد 110–125 kVp و 4–8 mAs.',
  },
  {
    id: 'ribs_ap',
    titleAr: 'الأضلاع (Ribs)',
    titleEn: 'Ribs (AP / Oblique)',
    region: 'ribs',
    regionLabelAr: 'الأضلاع',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'ERECT_AP',
    postureLabelAr: 'واقف (Erect) · AP',
    kvpRange: [65, 75],
    masRange: [12, 25],
    baseFee: 17,
    imagePath: REGION_SCAN_IMAGES.ribs,
    clinicalTipAr:
      'عظام الأضلاع تتطلب kVp أقل من الصدر لإظهار العظم بدل الرئة: 65–75 kVp و 12–25 mAs مع تحديد الجهة (يمين أو يسار).',
  },
  {
    id: 'abdomen_ap',
    titleAr: 'البطن (Abdomen AP)',
    titleEn: 'Abdomen AP (KUB)',
    region: 'abdomen',
    regionLabelAr: 'البطن',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [75, 85],
    masRange: [15, 30],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.abdomen,
    clinicalTipAr:
      'أشعة البطن KUB بوضعية Supine AP عند 75–85 kVp و 15–30 mAs لإظهار الغازات والحصوات الكلوية.',
  },

  // ================= UPPER LIMB (BILATERAL R/L) =================
  {
    id: 'shoulder_ap',
    titleAr: 'الكتف (Shoulder AP)',
    titleEn: 'Shoulder AP',
    region: 'shoulder',
    regionLabelAr: 'الكتف',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'ERECT_AP',
    postureLabelAr: 'واقف (Erect) · AP',
    kvpRange: [65, 75],
    masRange: [8, 16],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.shoulder,
    clinicalTipAr:
      'الكتف AP يتطلب 65–75 kVp و 8–16 mAs مع تحديد الكتف المطلوب (الأيمن أو الأيسر).',
  },
  {
    id: 'clavicle_ap',
    titleAr: 'الترقوة (Clavicle)',
    titleEn: 'Clavicle AP',
    region: 'clavicle',
    regionLabelAr: 'الترقوة',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'ERECT_AP',
    postureLabelAr: 'واقف (Erect) · AP',
    kvpRange: [65, 75],
    masRange: [8, 16],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.clavicle,
    clinicalTipAr:
      'تصوير عظمة الترقوة عند 65–75 kVp و 8–16 mAs مع تحديد الطرف المصاب (يمين/يسار).',
  },
  {
    id: 'humerus_ap',
    titleAr: 'عظمة العضد (Humerus)',
    titleEn: 'Humerus AP',
    region: 'humerus',
    regionLabelAr: 'عظمة العضد',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [60, 70],
    masRange: [5, 10],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.humerus,
    clinicalTipAr:
      'عظمة العضد تشمل مفصلي الكتف والكوع عند 60–70 kVp و 5–10 mAs مع تحديد الذراع اليمين أو اليسار.',
  },
  {
    id: 'elbow_ap',
    titleAr: 'مفصل الكوع (Elbow)',
    titleEn: 'Elbow Joint AP',
    region: 'elbow',
    regionLabelAr: 'مفصل الكوع',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [55, 65],
    masRange: [3, 6],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.elbow,
    clinicalTipAr:
      'مفصل الكوع يتطلب 55–65 kVp و 3–6 mAs بسط كامل للذراع وتحديد الجهة اليمنى أو اليسرى.',
  },
  {
    id: 'forearm_ap',
    titleAr: 'عظمة الساعد (Forearm)',
    titleEn: 'Forearm AP (Radius & Ulna)',
    region: 'forearm',
    regionLabelAr: 'عظمة الساعد',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [55, 65],
    masRange: [3, 6],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.forearm,
    clinicalTipAr:
      'الكعبرة والزند تتطلب 55–65 kVp و 3–6 mAs مع شمول مفصلي الكوع والرسغ وتحديد الجهة.',
  },
  {
    id: 'wrist_pa',
    titleAr: 'مفصل الرسغ (Wrist)',
    titleEn: 'Wrist Joint PA',
    region: 'wrist',
    regionLabelAr: 'مفصل الرسغ',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'PA',
    projectionLabelAr: 'خلفي-أمامي (PA)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [50, 60],
    masRange: [2, 4],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.wrist,
    clinicalTipAr:
      'الرسغ وعظامه الدقيقة تحتاج 50–60 kVp و 2–4 mAs مع تحديد الرسغ الأيمن أو الأيسر.',
  },
  {
    id: 'hand_pa',
    titleAr: 'اليد (Hand PA)',
    titleEn: 'Hand PA',
    region: 'hand',
    regionLabelAr: 'اليد',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'PA',
    projectionLabelAr: 'خلفي-أمامي (PA)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [50, 60],
    masRange: [2, 4],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.hand,
    clinicalTipAr:
      'تصوير اليد PA يتطلب 50–60 kVp و 2–4 mAs مع تفريق الأصابع وتحديد اليد اليمين أو اليسار.',
  },
  {
    id: 'hand_oblique',
    titleAr: 'اليد المائلة (Hand Oblique)',
    titleEn: 'Hand Oblique (45°)',
    region: 'hand',
    regionLabelAr: 'اليد',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'OBLIQUE',
    projectionLabelAr: 'مائل (Oblique 45°)',
    recommendedPosture: 'TABLE_LPO',
    postureLabelAr: 'مائل 45° (LPO)',
    kvpRange: [50, 60],
    masRange: [2, 4],
    baseFee: 17,
    imagePath: REGION_SCAN_IMAGES.hand,
    clinicalTipAr:
      'الإسقاط المائل لليد يفصل عظام المشط والزورقي عند 50–60 kVp و 2–4 mAs مع تحديد الطرف.',
  },

  // ================= PELVIS, SACRUM & LOWER LIMB =================
  {
    id: 'pelvis_ap',
    titleAr: 'الحوض (Pelvis AP)',
    titleEn: 'Pelvis AP',
    region: 'pelvis',
    regionLabelAr: 'الحوض',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [75, 85],
    masRange: [15, 30],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.pelvis,
    clinicalTipAr:
      'الحوض AP بوضعية Supine يتطلب 75–85 kVp و 15–30 mAs مع تدوير القدمين 15° للداخل.',
  },
  {
    id: 'sacrum_coccyx_ap',
    titleAr: 'العجز والعصعص (Sacrum/Coccyx)',
    titleEn: 'Sacrum & Coccyx AP',
    region: 'sacrum_coccyx',
    regionLabelAr: 'العجز والعصعص',
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [75, 85],
    masRange: [15, 30],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.sacrum_coccyx,
    clinicalTipAr:
      'تصوير العجز والعصعص يتطلب 75–85 kVp و 15–30 mAs مع إفراغ المثانة قبل الفحص.',
  },
  {
    id: 'hip_ap',
    titleAr: 'مفصل الورك (Hip)',
    titleEn: 'Hip Joint AP',
    region: 'hip',
    regionLabelAr: 'مفصل الورك',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [75, 85],
    masRange: [15, 30],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.hip,
    clinicalTipAr:
      'مفصل الورك يحتاج 75–85 kVp و 15–30 mAs مع تحديد الورك المطلوب (الأيمن أو الأيسر).',
  },
  {
    id: 'femur_ap',
    titleAr: 'عظمة الفخذ (Femur)',
    titleEn: 'Femur AP',
    region: 'femur',
    regionLabelAr: 'عظمة الفخذ',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [70, 80],
    masRange: [10, 20],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.femur,
    clinicalTipAr:
      'تصوير عظمة الفخذ القوية يتطلب 70–80 kVp و 10–20 mAs مع تحديد الفخذ اليمين أو اليسار.',
  },
  {
    id: 'knee_ap',
    titleAr: 'مفصل الركبة (Knee AP)',
    titleEn: 'Knee Joint AP',
    region: 'knee',
    regionLabelAr: 'مفصل الركبة',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [60, 70],
    masRange: [5, 10],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.knee,
    clinicalTipAr:
      'مفصل الركبة يلتزم بـ 60–70 kVp و 5–10 mAs مع التأكد من تحديد الركبة اليمنى أو اليسرى.',
  },
  {
    id: 'knee_lat_left',
    titleAr: 'مفصل الركبة الجانبي (Knee Lateral)',
    titleEn: 'Knee Joint Lateral',
    region: 'knee',
    regionLabelAr: 'مفصل الركبة',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'LATERAL',
    projectionLabelAr: 'جانبي (Lateral)',
    recommendedPosture: 'TABLE_LEFT_LAT',
    postureLabelAr: 'نائم جانبياً · يسار',
    kvpRange: [60, 70],
    masRange: [5, 10],
    baseFee: 16,
    imagePath: REGION_SCAN_IMAGES.knee,
    clinicalTipAr:
      'الوضع الجانبي للركبة مع ثني خفيف عند 60–70 kVp و 5–10 mAs مع تحديد الركبة المطلوبة.',
  },
  {
    id: 'tibia_fibula_ap',
    titleAr: 'عظمة الساق (Tibia/Fibula)',
    titleEn: 'Tibia & Fibula AP',
    region: 'tibia_fibula',
    regionLabelAr: 'عظمة الساق',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [60, 70],
    masRange: [5, 10],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.tibia_fibula,
    clinicalTipAr:
      'تصوير عظمي الساق (الظنبوب والشظية) عند 60–70 kVp و 5–10 mAs مع تحديد الساق اليمين أو اليسار.',
  },
  {
    id: 'ankle_ap',
    titleAr: 'مفصل الكاحل (Ankle)',
    titleEn: 'Ankle Joint AP',
    region: 'ankle',
    regionLabelAr: 'مفصل الكاحل',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [55, 65],
    masRange: [3, 6],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.ankle,
    clinicalTipAr:
      'الكاحل يتطلب 55–65 kVp و 3–6 mAs لإبراز الكعبين ومفصل الكاحل مع تحديد الجهة.',
  },
  {
    id: 'foot_ap',
    titleAr: 'القدم (Foot)',
    titleEn: 'Foot AP / Dorsoplantar',
    region: 'foot',
    regionLabelAr: 'القدم',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [50, 60],
    masRange: [2, 4],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.foot,
    clinicalTipAr:
      'عظام مشط القدم والرصغ تحتاج جرعة لطيفة: 50–60 kVp و 2–4 mAs مع تحديد القدم المطلوبة.',
  },
  {
    id: 'toes_ap',
    titleAr: 'أصابع القدم (Toes)',
    titleEn: 'Toes AP',
    region: 'toes',
    regionLabelAr: 'أصابع القدم',
    sideRequired: true,
    modality: 'XRAY',
    modalityLabelAr: 'أشعة سينية',
    recommendedProjection: 'AP',
    projectionLabelAr: 'أمامي-خلفي (AP)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [50, 55],
    masRange: [2, 3],
    baseFee: 15,
    imagePath: REGION_SCAN_IMAGES.toes,
    clinicalTipAr:
      'سلاميات أصابع القدم رفيعة جداً وتحتاج أقل جرعة: 50–55 kVp و 2–3 mAs مع تحديد القدم (يمين/يسار).',
  },

  // ================= CT & MRI (SHOP UPGRADES) =================
  {
    id: 'ct_chest',
    titleAr: 'أشعة مقطعية للصدر (CT Chest)',
    titleEn: 'Chest CT Scan',
    region: 'chest',
    regionLabelAr: 'الصدر',
    modality: 'CT',
    modalityLabelAr: 'أشعة مقطعية CT',
    recommendedProjection: 'AXIAL',
    projectionLabelAr: 'مقطعي محوري (Axial)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [115, 130],
    masRange: [30, 48],
    baseFee: 85,
    imagePath: CT_SCAN_IMAGE,
    clinicalTipAr:
      'التصوير المقطعي المحوري يعطي شرائح دقيقة ثلاثية الأبعاد للرئة والأوعية الدموية بوضع Supine مع كتم النفس.',
  },
  {
    id: 'ct_head',
    titleAr: 'أشعة مقطعية للدماغ والجمجمة (CT Brain)',
    titleEn: 'Head / Brain CT Scan',
    region: 'head',
    regionLabelAr: 'الجمجمة',
    modality: 'CT',
    modalityLabelAr: 'أشعة مقطعية CT',
    recommendedProjection: 'AXIAL',
    projectionLabelAr: 'مقطعي محوري (Axial)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [115, 130],
    masRange: [32, 48],
    baseFee: 90,
    imagePath: CT_SCAN_IMAGE,
    clinicalTipAr:
      'فحص طارئ وسريع لاستبعاد النزيف الدماغي والجلطات والكسور القحفية الدقيقة.',
  },
  {
    id: 'ct_pelvis',
    titleAr: 'أشعة مقطعية للحوض والبطن (CT Pelvis)',
    titleEn: 'Pelvis & Abdomen CT',
    region: 'pelvis',
    regionLabelAr: 'الحوض',
    modality: 'CT',
    modalityLabelAr: 'أشعة مقطعية CT',
    recommendedProjection: 'AXIAL',
    projectionLabelAr: 'مقطعي محوري (Axial)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [118, 130],
    masRange: [34, 50],
    baseFee: 95,
    imagePath: CT_SCAN_IMAGE,
    clinicalTipAr:
      'يوفر مقاطع عرضية فائقة الدقة لعظام الحوض والأحشاء دون تداخل الأنسجة.',
  },
  {
    id: 'ct_cervical',
    titleAr: 'أشعة مقطعية للفقرات العنقية (CT Cervical)',
    titleEn: 'Cervical Spine CT',
    region: 'cervical',
    regionLabelAr: 'الفقرات العنقية',
    modality: 'CT',
    modalityLabelAr: 'أشعة مقطعية CT',
    recommendedProjection: 'AXIAL',
    projectionLabelAr: 'مقطعي محوري (Axial)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [115, 128],
    masRange: [28, 44],
    baseFee: 90,
    imagePath: CT_SCAN_IMAGE,
    clinicalTipAr:
      'يعيد بناء الفقرات العنقية بثلاثة أبعاد لرصد الكسور الشعرية في الفقرات C1–C7.',
  },
  {
    id: 'mri_lumbar',
    titleAr: 'رنين مغناطيسي للعمود الفقري (MRI Lumbar)',
    titleEn: 'Lumbar Spine MRI',
    region: 'lumbar',
    regionLabelAr: 'الفقرات القطنية',
    modality: 'MRI',
    modalityLabelAr: 'رنين مغناطيسي MRI',
    recommendedProjection: 'SAGITTAL',
    projectionLabelAr: 'رنين سهمي (Sagittal)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [80, 100],
    masRange: [20, 35],
    baseFee: 150,
    imagePath: MRI_SCAN_IMAGE,
    clinicalTipAr:
      'الرنين المغناطيسي يصور الغضاريف والأعصاب بدقة فائقة دون استخدام إشعاع مؤين.',
  },
  {
    id: 'mri_knee',
    titleAr: 'رنين مغناطيسي لمفصل الركبة (MRI Knee)',
    titleEn: 'Knee Ligaments & Meniscus MRI',
    region: 'knee',
    regionLabelAr: 'مفصل الركبة',
    sideRequired: true,
    modality: 'MRI',
    modalityLabelAr: 'رنين مغناطيسي MRI',
    recommendedProjection: 'SAGITTAL',
    projectionLabelAr: 'رنين سهمي (Sagittal)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [78, 96],
    masRange: [18, 32],
    baseFee: 155,
    imagePath: MRI_SCAN_IMAGE,
    clinicalTipAr:
      'المعيار الذهبي لتقييم الرباط الصليبي والغضاريف الهلالية وأنسجة الركبة الرخوة.',
  },
  {
    id: 'mri_head',
    titleAr: 'رنين مغناطيسي للدماغ (MRI Brain)',
    titleEn: 'Brain MRI Protocol',
    region: 'head',
    regionLabelAr: 'الجمجمة',
    modality: 'MRI',
    modalityLabelAr: 'رنين مغناطيسي MRI',
    recommendedProjection: 'SAGITTAL',
    projectionLabelAr: 'رنين سهمي (Sagittal)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [82, 102],
    masRange: [20, 34],
    baseFee: 165,
    imagePath: MRI_SCAN_IMAGE,
    clinicalTipAr:
      'يكشف تباين المادة البيضاء والرمادية والأعصاب القحفية بدقة تشخيصية متناهية.',
  },
  {
    id: 'mri_cervical',
    titleAr: 'رنين مغناطيسي للفقرات العنقية (MRI Cervical)',
    titleEn: 'Cervical Spine MRI',
    region: 'cervical',
    regionLabelAr: 'الفقرات العنقية',
    modality: 'MRI',
    modalityLabelAr: 'رنين مغناطيسي MRI',
    recommendedProjection: 'SAGITTAL',
    projectionLabelAr: 'رنين سهمي (Sagittal)',
    recommendedPosture: 'SUPINE',
    postureLabelAr: 'على الظهر (Supine)',
    kvpRange: [80, 98],
    masRange: [18, 32],
    baseFee: 155,
    imagePath: MRI_SCAN_IMAGE,
    clinicalTipAr:
      'يُقيّم الحبل الشوكي العنقي والانزلاق الغضروفي الضاغط على جذور الأعصاب.',
  },
];

export const UPGRADES: UpgradeItem[] = [
  {
    id: 'lead_shield',
    titleAr: 'درع رصاصي للحماية الإشعاعية',
    subtitleAr: 'Lead Apron & Gonadal Shield',
    descriptionAr:
      'توفير دروع الرصاص الواقية للمرضى أثناء التصوير يرفع التقييم الطبي ويضيف $0.5 مكافأة أمان لكل فحص.',
    cost: 360,
    category: 'safety',
    benefitSummaryAr: '+$0.5 مكافأة أمان لكل مريض',
    imagePath: ASSETS.shopLeadApronImg,
  },
  {
    id: 'area_radiation_monitor',
    titleAr: 'جهاز رصد وإنذار الإشعاع الجداري',
    subtitleAr: 'Wall Radiation Area Monitor',
    descriptionAr:
      'كاشف رقمي يراقب مستوى الإشعاع في الغرفة باستمرار ويرفع التزام السلامة المهنية بمكافأة $0.5 لكل فحص.',
    cost: 520,
    category: 'safety',
    benefitSummaryAr: 'مراقبة مستمرة للإشعاع + $0.5 أمان',
    imagePath: ASSETS.shopAreaMonitorImg,
  },
  {
    id: 'dosimeter_badge',
    titleAr: 'مقياس الجرعة الشخصي الذكي',
    subtitleAr: 'Digital Personal Dosimeter',
    descriptionAr:
      'يعرض لك مؤشر توافق الجرعة الفوري في لوحة التحكم قبل إطلاق الأشعة لتجنب تلف الأفلام ويضيف $0.5 أمان.',
    cost: 640,
    category: 'safety',
    benefitSummaryAr: 'مؤشر توافق kVp/mAs + $0.5 أمان',
    imagePath: ASSETS.shopDosimeterBadgeImg,
  },
  {
    id: 'thyroid_collar',
    titleAr: 'طوق الغدة الدرقية ونظارة الرصاص',
    subtitleAr: 'Thyroid Collar & Lead Eyewear',
    descriptionAr:
      'حماية تخصصية إضافية للرقبة والعينين من الإشعاع المشتت ترفع معايير السلامة وتضيف $1 لكل فحص.',
    cost: 840,
    category: 'safety',
    benefitSummaryAr: '+$1 مكافأة سلامة إشعاعية',
    imagePath: ASSETS.shopDosimeterBadgeImg,
  },
  {
    id: 'lead_glass_barrier',
    titleAr: 'زجاج رصاصي مُعزّز لغرفة التحكم',
    subtitleAr: 'Heavy Lead-Glass Control Shield',
    descriptionAr:
      'نافذة مراقبة سميكة مُطعّمة بالرصاص تعزل غرفة التحكم تماماً عن التشتت الإشعاعي وتضيف $1 أمان.',
    cost: 1040,
    category: 'safety',
    benefitSummaryAr: '+$1 مكافأة عزل وسلامة التحكم',
    imagePath: ASSETS.shopLeadGlassImg,
  },
  {
    id: 'auto_processor',
    titleAr: 'ماكينة تحميض أفلام آلية',
    subtitleAr: 'Automatic Film Processor',
    descriptionAr:
      'يسرّع قراءة الكاسيت في جهاز CR ويحسن التباين التشخيصي مع إضافة $1 مكافأة دقة لكل مريض.',
    cost: 1100,
    category: 'efficiency',
    benefitSummaryAr: 'قراءة أسرع للكاسيت + $1 مكافأة دقة',
    imagePath: ASSETS.shopAutoProcessorImg,
  },
  {
    id: 'immobilization_kit',
    titleAr: 'طقم وسائد وأحزمة تثبيت المريض',
    subtitleAr: 'Positioning Wedges & Pads',
    descriptionAr:
      'يمنع اهتزاز المريض ويوسّع هامش التسامح في قيم kVp و mAs لتقليل إعادة التصوير مع $1 جودة.',
    cost: 1360,
    category: 'efficiency',
    benefitSummaryAr: 'توسيع هامش kVp/mAs + $1 جودة',
    imagePath: ASSETS.shopImmobilizationKitImg,
  },
  {
    id: 'bucky_grid',
    titleAr: 'شبكة تقليل التشتت الإشعاعي (Bucky Grid)',
    subtitleAr: 'Anti-Scatter Carbon Bucky Grid',
    descriptionAr:
      'شبكة دقيقة من ألياف الكربون تمتص الأشعة المشتتة لإبراز تفاصيل العظام بوضوح وتوسيع هامش التعريض مع $1 جودة.',
    cost: 1480,
    category: 'efficiency',
    benefitSummaryAr: 'تباين أدق + توسيع هامش التعريض + $1 جودة',
    imagePath: ASSETS.shopBuckyGridImg,
  },
  {
    id: 'collimator_laser',
    titleAr: 'موجّه الليزر والمُحدِّد الدقيق',
    subtitleAr: 'Precision Laser Collimator',
    descriptionAr:
      'تحديد ليزري متقاطع لحقل الأشعة يقلل التشتت الإشعاعي ويرفع التقييم التشخيصي بمقدار $1 لكل مريض.',
    cost: 1640,
    category: 'efficiency',
    benefitSummaryAr: 'تحديد ليزري دقيق + $1 جودة',
    imagePath: ASSETS.shopLaserCollimatorImg,
  },
  {
    id: 'protocol_assist',
    titleAr: 'مساعد البروتوكول الذكي',
    subtitleAr: 'Protocol Auto-Calibration',
    descriptionAr:
      'يُضيف زر ضبط تلقائي لقيم kVp و mAs والوضعية الصحيحة بنقرة واحدة لتقليل هدر الأفلام.',
    cost: 1900,
    category: 'efficiency',
    benefitSummaryAr: 'زر ضبط تلقائي يمنع تلف الأفلام',
    imagePath: ASSETS.shopDrSystemImg,
  },
  {
    id: 'aec_sensor',
    titleAr: 'مستشعر التعريض التلقائي (AEC)',
    subtitleAr: 'Automatic Exposure Control (AEC)',
    descriptionAr:
      'غرفة تأين ثلاثية الحقول تضبط التعريض تلقائياً لمنع احتراق أو بهتان الأفلام وتضيف $1.5 مكافأة دقة.',
    cost: 2200,
    category: 'efficiency',
    benefitSummaryAr: 'حماية ذكية ضد حرق/بهتان الفيلم + $1.5 جودة',
    imagePath: ASSETS.shopAecSensorImg,
  },
  {
    id: 'waiting_room',
    titleAr: 'توسعة صالة استقبال المرضى',
    subtitleAr: 'Waiting Room Expansion',
    descriptionAr:
      'زيادة سعة صالة الانتظار إلى 6 مرضى مع رفع عدد المراجعين اليومي للعيادة من 10–15 إلى 20–25 مريضاً في اليوم.',
    cost: 2400,
    category: 'efficiency',
    benefitSummaryAr: '20–25 مريضاً يومياً · سعة 6 مقاعد',
    imagePath: ASSETS.clinicReceptionImg,
  },
  {
    id: 'ergonomic_table_pad',
    titleAr: 'مرتبة طبية مريحة لطاولة الأشعة',
    subtitleAr: 'Radiolucent Memory-Foam Table Pad',
    descriptionAr:
      'حشوة طبية شفافة للأشعة تثبّت العمود الفقري والحوض براحة للمريض وتضيف $1.5 مكافأة راحة وجودة.',
    cost: 2700,
    category: 'efficiency',
    benefitSummaryAr: 'ثبات وراحة المريض + $1.5 جودة',
    imagePath: ASSETS.shopTablePadImg,
  },
  {
    id: 'tube_cooler',
    titleAr: 'نظام تبريد أنبوب الأشعة الفائق',
    subtitleAr: 'High-Capacity Tube Cooling',
    descriptionAr:
      'يخفض حرارة أنبوب الأشعة ويسرّع دورة التعريض وقراءة CR بنسبة 40% مع $1.5 كفاءة لكل مريض.',
    cost: 2900,
    category: 'efficiency',
    benefitSummaryAr: 'سرعة تصوير مضاعفة + $1.5 كفاءة',
    imagePath: ASSETS.shopLaserCollimatorImg,
  },
  {
    id: 'hepa_sterilizer',
    titleAr: 'منظومة تعقيم وتنقية الهواء الطبي (HEPA)',
    subtitleAr: 'Medical HEPA & UV-C Air Sterilizer',
    descriptionAr:
      'جهاز تنقية وتعقيم متطور بالهواء النقي والأشعة فوق البنفسجية يرفع تصنيف النظافة الطبية للعيادة بمقدار $1.5 لكل مريض.',
    cost: 3300,
    category: 'staff',
    benefitSummaryAr: '+$1.5 تقييم تعقيم وجودة بيئة العيادة',
    imagePath: ASSETS.shopHepaSterilizerImg,
  },
  {
    id: 'dry_laser_printer',
    titleAr: 'طابعة أفلام ليزرية جافة (DryView)',
    subtitleAr: 'Dry Laser Medical Imager',
    descriptionAr:
      'طباعة طبية فائقة التباين للنتائج والأقراص للمرضى ترفع عائد كل فحص بمقدار $1.5 لكل مريض.',
    cost: 3700,
    category: 'efficiency',
    benefitSummaryAr: '+$1.5 رسوم طباعة وتقرير لكل مريض',
    imagePath: ASSETS.shopDryPrinterImg,
  },
  {
    id: 'ai_pacs',
    titleAr: 'منظومة PACS الذكية لتحليل الصور',
    subtitleAr: 'Dual-Monitor AI PACS Suite',
    descriptionAr:
      'محطة قراءة طبية مزدوجة تساعدك على ضبط التباين والتشخيص بدقة عالية وتضيف $2 لكل مريض.',
    cost: 4800,
    category: 'efficiency',
    benefitSummaryAr: '+$2 مكافأة دقة تشخيصية متقدمة',
    imagePath: ASSETS.shopAiPacsImg,
  },
  {
    id: 'teleradiology_link',
    titleAr: 'نظام استشارات الأشعة عن بُعد (Teleradiology)',
    subtitleAr: 'Encrypted Teleradiology Hub',
    descriptionAr:
      'ربط مباشر ومشفّر مع استشاريي الأشعة لإصدار تقارير فورية متخصصة، يضيف $2 عائد استشارة لكل مريض.',
    cost: 5700,
    category: 'modality',
    benefitSummaryAr: '+$2 مكافأة تقرير استشاري عن بُعد',
    imagePath: ASSETS.shopTeleradiologyImg,
  },
  {
    id: 'digital_dr',
    titleAr: 'جهاز الأشعة الرقمي (DR)',
    subtitleAr: 'Digital Radiography Flat-Panel',
    descriptionAr:
      'التحول من نظام CR إلى التصوير الرقمي المباشر DR! لا حاجة لقارئ الكاسيت بعد الآن ولا استهلاك للأفلام — تنتقل الصورة مباشرة للحاسوب ويرتفع سعر الفحص إلى $25.',
    cost: 6400,
    category: 'modality',
    benefitSummaryAr: 'إرسال فوري للحاسوب بدون قارئ CR + $25',
    imagePath: ASSETS.shopDrSystemImg,
  },
  {
    id: 'vip_lounge',
    titleAr: 'جناح وصالة انتظار VIP الفاخرة',
    subtitleAr: 'VIP Patient Comfort Lounge',
    descriptionAr:
      'تجهيز صالة راحة فاخرة للمراجعين بإضاءة هادئة وضيافة طبية ترفع دخل العيادة بمقدار $2 لكل مريض.',
    cost: 7600,
    category: 'modality',
    benefitSummaryAr: '+$2 عائد ضيافة وجودة VIP لكل مريض',
    imagePath: ASSETS.shopVipLoungeImg,
  },
  {
    id: 'ct_scanner',
    titleAr: 'جهاز الأشعة المقطعية (المفراس CT)',
    subtitleAr: '64-Slice CT Scanner Suite',
    descriptionAr:
      'جهاز التصوير المقطعي الحلزوني (64 شريحة) لغرفة السيتي — هذا الجهاز غير متوفر للشراء حالياً وسيتوفر قريباً.',
    cost: 17000,
    category: 'modality',
    benefitSummaryAr: 'غير متوفر حالياً — سيتوفر قريباً',
    imagePath: ASSETS.shopCtScannerImg,
    comingSoon: true,
  },
  {
    id: 'mri_suite',
    titleAr: 'وحدة الرنين المغناطيسي (MRI)',
    subtitleAr: '1.5T MRI Imaging Suite',
    descriptionAr:
      'منظومة الرنين المغناطيسي لغرفة الـ MRI — هذا الجهاز غير متوفر للشراء حالياً وسيتوفر قريباً.',
    cost: 32000,
    category: 'modality',
    benefitSummaryAr: 'غير متوفر حالياً — سيتوفر قريباً',
    imagePath: ASSETS.shopMriSuiteImg,
    comingSoon: true,
  },
  {
    id: 'assistant_tech',
    titleAr: 'توظيف تقني أشعة مساعد',
    subtitleAr: 'Assistant Radiographer (Master Unlock)',
    descriptionAr:
      'خيار متقدم يفتح فقط بعد خدمة 500 مريض! تقني مساعد يدير حالات إضافية ويدر دخلاً تلقائياً مستمراً.',
    cost: 9000,
    category: 'staff',
    benefitSummaryAr: 'يُفتح بعد فحص 500 مريض · دخل تلقائي',
    imagePath: ASSETS.shopAssistantTechImg,
    requiredPatientsServed: 500,
  },
];

export const CLINIC_RANKS: ClinicRank[] = [
  {
    id: 'starter',
    titleAr: 'عيادة أشعة ناشئة',
    minRevenue: 0,
    subtitleAr: 'جهاز تقليدي واحد وبداية المشوار المهني',
  },
  {
    id: 'neighborhood',
    titleAr: 'عيادة حي معتمدة',
    minRevenue: 300,
    subtitleAr: 'سمعة طيبة وإقبال متزايد من المرضى',
  },
  {
    id: 'specialized',
    titleAr: 'مركز الأشعة التخصصي',
    minRevenue: 1500,
    subtitleAr: 'تجهيزات متطورة وكفاءة تشخيصية عالية',
  },
  {
    id: 'diagnostic_hub',
    titleAr: 'مجمع التصوير الطبي المتكامل',
    minRevenue: 5000,
    subtitleAr: 'وجهة رئيسية لفحوصات الأشعة المقطعية والرقمية',
  },
  {
    id: 'medical_empire',
    titleAr: 'صرح التصوير التشخيصي الرائد',
    minRevenue: 12000,
    subtitleAr: 'إيرادات ضخمة وتجهيزات طبية من الطراز الأول',
  },
];

const MALE_NAMES = [
  'أحمد محمود',
  'كريم العلي',
  'يوسف حسن',
  'مصطفى كريم',
  'طارق السالم',
  'عمر خالد',
  'حسام الدين',
  'سعد الجبوري',
  'وليد المنصور',
  'ماجد الفهد',
  'باسل النجار',
  'زياد راشد',
];

const FEMALE_NAMES = [
  'سارة عبد الله',
  'نور الهدى',
  'مريم إبراهيم',
  'ليلى الشمري',
  'دينا عادل',
  'فاطمة الزهراء',
  'هدى السعيد',
  'رنا الحسن',
  'سمية طارق',
  'أمل القحطاني',
  'سلمى ناصر',
  'نجلاء فؤاد',
];

const PEDIATRIC_MALE_NAMES = [
  'الطفل آدم علي',
  'الطفل زين حسن',
  'الطفل تيم خالد',
  'الطفل حمزة طارق',
  'الطفل أنس محمود',
  'الطفل ريان سعد',
];

const PEDIATRIC_FEMALE_NAMES = [
  'الطفلة جود أحمد',
  'الطفلة لينا عمر',
  'الطفلة شام إبراهيم',
  'الطفلة تالا ناصر',
  'الطفلة ملك عادل',
  'الطفلة غزل فؤاد',
];

const EXAM_SCENARIOS: Record<
  string,
  {complaints: string[]; findings: string[]}
> = {
  skull_ap: {
    complaints: [
      'صداع جبهي متكرر واحتقان في الجيوب الأنفية',
      'ضربة خفيفة على الرأس تستدعي الاطمئنان',
    ],
    findings: [
      'عظام القحف سليمة وخالية من الشروخ',
      'تهوية طبيعية للجيوب الأنفية وعدم وجود انخساف قحفي',
    ],
  },
  skull_supine: {
    complaints: [
      'مريض مصاب بدوار بعد سقوط ويتعذر وقوفه لتصوير الرأس',
      'فحص جمجمة طارئ بوضع الاستلقاء على الظهر',
    ],
    findings: [
      'لا توجد كسور خطية أو منخسفة في عظام القحف',
      'سلامة العظام الجبهية والجدارية بالكامل',
    ],
  },
  skull_lat: {
    complaints: [
      'تقييم الجيب الوتدي والسرج التركي بسبب صداع مزمن',
      'فحص جانبي للجمجمة بعد رضّة جانبية خفيفة',
    ],
    findings: [
      'جدران القحف منتظمة والسرج التركي ضمن الحجم الطبيعي',
      'تهوية طبيعية للجيوب الوتدية وخلايا الخشاء',
    ],
  },
  facial_bones_pa: {
    complaints: [
      'تورم في الوجنة وألم تحت العين بعد ارتطام مباشر',
      'اشتباه بكسر في عظم الوجنة أو الجيب الفكي',
    ],
    findings: [
      'عظام الوجنة والحجاج سليمة ومتناظرة دون كسور مزاحة',
      'كثافة مخاطية خفيفة في الجيب الفكي دون كسر حجاجي',
    ],
  },
  nasal_bones_lat: {
    complaints: [
      'تورم ونزيف أنفي بعد اصطدام مباشر بالأنف',
      'اشتباه بشرخ في عظم الأنف مع اعوجاج ظاهري خفيف',
    ],
    findings: [
      'سلامة العظم الأنفي دون شروخ مزاحة',
      'كسر خطي غير مزاح في الطرف البعيد لعظم الأنف',
    ],
  },
  soft_tissue_neck_lat: {
    complaints: [
      'صعوبة بلع وبحة مفاجئة مع شعور بغصة في الحلق',
      'تقييم مجرى الهواء العلوي وتورم الأنسجة الرخوة للعنق',
    ],
    findings: [
      'مجرى الهواء الرغامي سالك ومنتظم مع سلامة لسان المزمار',
      'تضخم خفيف في النسيج اللمفي خلف البلعوم دون أجسام غريبة',
    ],
  },
  cervical_ap: {
    complaints: [
      'آلام في الرقبة مع محدودية الالتفات يميناً ويساراً',
      'فحص أمامي للفقرات العنقية لاستبعاد ميلان العمود',
    ],
    findings: [
      'اصطفاف سليم لأجسام الفقرات العنقية والمفاصل الوجيهية',
      'نتوءات عظمية خفيفة عند المفصل العنقي C5-C6',
    ],
  },
  cervical_lat: {
    complaints: [
      'تيبس وألم في الرقبة يمتد إلى الكتف',
      'تنميل في الأصابع بعد حادث سير بسيط',
    ],
    findings: [
      'استقامة طبيعية للفقرات العنقية C1-C7 دون كسور',
      'تشنج عضلي مع تقوّس طفيف في الانحناء العنقي',
    ],
  },
  cervical_oblique_lao: {
    complaints: [
      'تنميل وخدر في الذراع يشتبه معه بتضيق الثقوب العصبية العنقية',
      'فحص مائل 45° لتقييم مخارج الأعصاب في الرقبة',
    ],
    findings: [
      'الثقوب بين الفقرات العنقية مفتوحة ومنتظمة',
      'تضيق طفيف في الثقب العصبي C5-C6',
    ],
  },
  thoracic_ap: {
    complaints: [
      'ألم بين لوحي الكتف يزداد مع التنفس العميق والحركة',
      'فحص أمامي للفقرات الصدرية T1–T12 بعد سقوط على الظهر',
    ],
    findings: [
      'أجسام الفقرات الصدرية متناظرة وسليمة الارتفاع دون انضغاط',
      'انحناء صدري خفيف ضمن الحدود الطبيعية',
    ],
  },
  thoracic_lat: {
    complaints: [
      'تحدب وألم متزايد في منتصف الظهر يستدعي تصويراً جانبياً للفقرات الصدرية',
      'اشتباه بانضغاط أمامي في إحدى الفقرات الصدرية الوسطى',
    ],
    findings: [
      'انتظام ارتفاع أجسام الفقرات الصدرية والمسافات الغضروفية جانبياً',
      'انضغاط طفيف مستقر في الحافة الأمامية للفقرة T8',
    ],
  },
  lumbar_ap: {
    complaints: [
      'ألم شديد أسفل الظهر بعد رفع جسم ثقيل',
      'ألم قطني مزمن مع إشعاع خفيف للساق',
    ],
    findings: [
      'الفقرات القطنية L1-L5 سليمة ومنتظمة الاصطفاف',
      'بداية خشونة وتضيق خفيف بين L4-L5',
    ],
  },
  lumbar_lat_left: {
    complaints: [
      'تقييم المسافة الغضروفية للفقرات القطنية بالاستلقاء على الجانب الأيسر',
      'ألم متزايد أسفل الظهر عند الانحناء',
    ],
    findings: [
      'استقامة طبيعية للمسافات الغضروفية القطنية دون انزلاق فقاري',
      'تضيق خفيف في الحيز الغضروفي L5-S1',
    ],
  },
  lumbar_lat_right: {
    complaints: [
      'ألم أسفل الظهر يشتد في الجانب الأيسر مما يستدعي الاستلقاء يميناً',
      'تقييم تزحزح الفقرات القطنية بوضع الجانب الأيمن',
    ],
    findings: [
      'ثبات الفقرات القطنية وسلامة المسافات الغضروفية',
      'انزلاق فقاري طفيف من الدرجة الأولى في L4-L5',
    ],
  },
  lumbar_erect_pa: {
    complaints: [
      'مراجعة تقييم الجنف وانحناء العمود الفقري أثناء الوقوف',
      'عدم تساوي الكتفين وآلام ظهر مزمنة',
    ],
    findings: [
      'انحناء جانبي طفيف في العمود القطني بنسبة 8 درجات',
      'استقامة متزنة للمحور الفقري أثناء التحميل القائم',
    ],
  },
  lumbar_oblique_rpo: {
    complaints: [
      'ألم أسفل الظهر يزداد عند الميل للخلف مع اشتباه بانحلال الفقار',
      'فحص مائل RPO لتقييم البرزخ الفقري القطني',
    ],
    findings: [
      'سلامة البرزخ الفقري (علامة الكلب الأسكتلندي طبيعية)',
      'تضيق طفيف بالمفاصل الوجيهية اليمنى',
    ],
  },
  chest_pa: {
    complaints: [
      'سعال مستمر وضيق خفيف بالتنفس منذ أسبوع',
      'فحص صدر روتيني قبل العمل أو المدرسة',
    ],
    findings: [
      'الرئتان صافيتان وحجم القلب ضمن الحدود الطبيعية',
      'التهاب شعبي خفيف في الفص السفلي يستدعي المتابعة',
    ],
  },
  chest_ap_supine: {
    complaints: [
      'ألم صدري مع دوار شديد يتعذر معه الوقوف',
      'فحص صدر طارئ بوضع الاستلقاء على الظهر',
    ],
    findings: [
      'توسع وعائي خفيف مع صفاء الحقول الرئوية',
      'ظل القلب طبيعي ضمن إسقاط AP دون ارتشاح حاد',
    ],
  },
  chest_ap_erect: {
    complaints: [
      'فحص صدر واقف بمواجهة الأنبوب (Erect AP) لضيق النفس',
      'ألم صدري مع تفضيل الوقوف المستند للخلف',
    ],
    findings: [
      'الحقول الرئوية نظيفة والزاويتان الحجابيتان حادتان',
      'ظل القلب مستقر مع احتقان شعبي خفيف',
    ],
  },
  chest_lat_left: {
    complaints: [
      'متابعة التهاب رئوي في الفص السفلي يتطلب تصويراً جانبياً',
      'فحص تكميلي للصدر بالوضع الواقف الجانبي الأيسر',
    ],
    findings: [
      'الزاوية الضلعية الحجابية الخلفية صافية وخالية من الارتشاح',
      'عتامة محدودة خلف القلب تستدعي المتابعة',
    ],
  },
  chest_lat_right: {
    complaints: [
      'ألم جانبي بالجهة اليمنى من الصدر مع سعال جاف',
      'متابعة التهاب الفص الأيمن للرئة بالوضع الجانبي الأيمن',
    ],
    findings: [
      'صفاء الفصوص الرئوية اليمنى وسلامة الحجاب الحاجز الأيمن',
      'تكثف التهابي محدود في الفص الأوسط الأيمن',
    ],
  },
  ribs_ap: {
    complaints: [
      'ألم موضعي حاد في القفص الصدري يزداد عند التنفس أو السعال بعد ارتطام',
      'اشتباه بشرخ ضلعي بعد سقوط على جانب القفص الصدري',
    ],
    findings: [
      'الأقواس الضلعية سليمة دون كسور مزاحة أو استرواح صدري',
      'شرخ شعري مستقر في الضلع السابع يلتئم بالراحة',
    ],
  },
  abdomen_ap: {
    complaints: [
      'مغص بطني حاد وانتفاخ مع ألم بالخاصرة',
      'أشعة KUB للبطن لاستبعاد الحصوات البولية أو انسداد الأمعاء',
    ],
    findings: [
      'توزع طبيعي للغازات المعوية دون سويات سائلة هوائية أو حصوات ظليلة',
      'حصوة كلوية صغيرة ظليلة للأشعة في الحالب تستدعي المتابعة',
    ],
  },
  shoulder_ap: {
    complaints: [
      'ألم وتيبس في مفصل الكتف عند رفع الذراع بعد سقوط',
      'اشتباه بخلع أو كسر في رأس عظمة العضد ومفصل الكتف',
    ],
    findings: [
      'رأس العضد متموضع بشكل طبيعي داخل الجوف الحقاني للكتف',
      'التهاب وتكلس طفيف في وتر العضلة فوق الشوكية',
    ],
  },
  clavicle_ap: {
    complaints: [
      'ألم وتورم فوق عظمة الترقوة بعد سقوط على الكتف',
      'اشتباه بكسر في منتصف الترقوة مع صعوبة تحريك الذراع',
    ],
    findings: [
      'سلامة عظمة الترقوة والمفصلين الأخرمي والقصي الترقوي',
      'كسر غير مزاح في الثلث الأوسط للترقوة يتطلب حمالة ذراع',
    ],
  },
  humerus_ap: {
    complaints: [
      'ألم وتورم في منتصف العضد بعد رضّ رياضي',
      'تقييم استقامة عظمة العضد بعد السقوط على الذراع',
    ],
    findings: [
      'استقامة سليمة لعظمة العضد وخلوها من الكسور',
      'التئام عظمي سليم دون انزياح زاوي',
    ],
  },
  elbow_ap: {
    complaints: [
      'ألم وتحدد حركة مفصل الكوع بعد ارتطام مباشر',
      'تورم حول المرفق عند ثني وبسط الذراع',
    ],
    findings: [
      'انتظام رأس الكعبرة ولقمتي العضد دون كسور أو انصباب مفصلي',
      'شرخ خطي دقيق في رأس الكعبرة يعالج تحفظياً',
    ],
  },
  forearm_ap: {
    complaints: [
      'ألم حاد وتورم في الساعد بعد السقوط على اليد الممدودة',
      'فحص عظمي الكعبرة والزند لاستبعاد كسر عود الثقاب أو الشرخ',
    ],
    findings: [
      'عظمتا الكعبرة والزند سليمتان ومستقيمتان بالكامل',
      'كسر شرخي بسيط في منتصف عظمة الزند دون انزياح',
    ],
  },
  wrist_pa: {
    complaints: [
      'ألم وتورم في مفصل الرسغ بعد التواء قوي أثناء اللعب',
      'ألم في منشقة الرسغ يشتبه معه بإصابة العظم الزورقي',
    ],
    findings: [
      'صفوف العظام الرسغية منتظمة وخالية من الكسور',
      'وذمة أنسجة رخوة حول الرسغ مع سلامة الكعبرة البعيدة',
    ],
  },
  hand_pa: {
    complaints: [
      'تورم في اليد والأصابع بعد سقوط أثناء الرياضة',
      'ألم حاد في عظمة المشط عند تحريك الإبهام',
    ],
    findings: [
      'عظام اليد والسلاميات سليمة دون كسور واضحة',
      'كسر شعري دقيق في المشط الرابع يتطلب جبيرة',
    ],
  },
  hand_oblique: {
    complaints: [
      'ألم في العظم الزورقي وعظام المشط بعد التواء الرسغ',
      'تورم في ظاهر اليد يستدعي تصويراً مائلاً 45°',
    ],
    findings: [
      'سلامة العظم الزورقي وعظام المشط دون شروخ خفية',
      'شرخ دقيق في رأس المشط الخامس',
    ],
  },
  pelvis_ap: {
    complaints: [
      'ألم واسع في عظام الحوض بعد تعثر وسقوط',
      'تقييم تناسق حلقة الحوض والمفصلين الحرقفيين العجزيين',
    ],
    findings: [
      'حلقة الحوض سليمة ومتناظرة دون كسور في الشعبتين العانيتين',
      'بداية تكلس بسيط في حافة الحُق الوركي',
    ],
  },
  sacrum_coccyx_ap: {
    complaints: [
      'ألم حاد أسفل العصعص بعد الجلوس القوي أو السقوط على المؤخرة',
      'تقييم فقرات العجز والعصعص بسبب ألم مستمر عند الجلوس',
    ],
    findings: [
      'استقامة عظم العجز والعصعص دون كسور أو انخلاع أمامي',
      'انحناء طفيف في نهاية العصعص ناتج عن كدمة رضية',
    ],
  },
  hip_ap: {
    complaints: [
      'ألم عميق في مفصل الورك يشتد عند المشي أو تدوير الساق',
      'اشتباه بإصابة عنق الفخذ أو المفصل الحرقفي الفخذي',
    ],
    findings: [
      'رأس وعنق عظم الفخذ سليمان مع مسافة مفصلية طبيعية للورك',
      'خشونة متوسطة في مفصل الورك مع تضيق غضروفي طفيف',
    ],
  },
  femur_ap: {
    complaints: [
      'ألم شديد في الفخذ بعد حادث رياضي أو سقوط',
      'تقييم سلامة جسم عظمة الفخذ واستقامتها',
    ],
    findings: [
      'جسم عظمة الفخذ سليم ومتجانس الكثافة دون شروخ',
      'كدمة عظمية حول الثلث السفلي للفخذ دون كسر قشري',
    ],
  },
  knee_ap: {
    complaints: [
      'ألم وتيبس في مفصل الركبة عند صعود الدرج',
      'إصابة التواء في الركبة أثناء اللعب أو الجري',
    ],
    findings: [
      'المسافة المفصلية للركبة متناسقة وسليمة',
      'ارتشاح بسيط داخل المفصل دون كسور عظمية',
    ],
  },
  knee_lat_left: {
    complaints: [
      'تورم في صابونة الركبة بعد سقوط مباشر على الركبة',
      'ألم حاد خلف الرضفة عند ثني المفصل',
    ],
    findings: [
      'سلامة الرضفة وعدم وجود ارتشاح مفصلي ملحوظ',
      'ارتشاح بسيط فوق الرضفة دون كسور عظمية',
    ],
  },
  tibia_fibula_ap: {
    complaints: [
      'ألم وتورم في الساق بعد ارتطام مباشر أو جهد رياضي طويل',
      'فحص عظمي الساق (الظنبوب والشظية) لاستبعاد الشرخ الإجهادي',
    ],
    findings: [
      'الظنبوب والشظية سليمان بالكامل دون شروخ إجهادية',
      'التئام عظمي جيد في منتصف جسم عظمة الظنبوب',
    ],
  },
  ankle_ap: {
    complaints: [
      'التواء الكاحل مع تورم حول الكعب الوحشي وصعوبة المشي',
      'اشتباه بكسر في الكعب الإنسي أو الوحشي بعد تعثر',
    ],
    findings: [
      'نقرة الكاحل منتظمة وسلامة الكعبين الإنسي والوحشي',
      'تورم أنسجة رخوة ناتج عن التواء أربطة الكاحل دون كسور',
    ],
  },
  foot_ap: {
    complaints: [
      'ألم في منتصف القدم بعد سقوط جسم ثقيل أو التواء المشط',
      'تورم في ظهر القدم وصعوبة الوقوف على أصابع القدم',
    ],
    findings: [
      'عظام مشط القدم والرصغ سليمة ومنتظمة التمفصل',
      'شرخ غير مزاح في قاعدة عظمة المشط الخامس',
    ],
  },
  toes_ap: {
    complaints: [
      'ارتطام مباشر لأصابع القدم مع تورم وألم حاد في الإبهام أو السلاميات',
      'اشتباه بكسر في سلاميات أصابع القدم',
    ],
    findings: [
      'سلاميات أصابع القدم سليمة ومصطفة بشكل طبيعي',
      'كسر خطي مستقر في السلامية القريبة للإصبع الصغير',
    ],
  },
  ct_chest: {
    complaints: [
      'متابعة دقيقة لعقيدة رئوية بالمسح المقطعي',
      'ضيق نفس حاد يتطلب تصوير مقطعي عالي الدقة',
    ],
    findings: [
      'مقاطع الصدر طبيعية مع تروية وعائية سليمة',
      'بؤرة التهابية محدودة في الفص السفلي',
    ],
  },
  ct_head: {
    complaints: [
      'صداع مفاجئ حاد مع غثيان يستدعي مسحاً مقطعياً للدماغ',
      'تقييم طارئ بعد ارتطام بالرأس لاستبعاد النزف',
    ],
    findings: [
      'نسيج الدماغ سليم دون نزيف داخل القحف أو انحراف في الخط الناصف',
      'بطينات الدماغ طبيعية الحجم والشكل مع سلامة العظام',
    ],
  },
  ct_pelvis: {
    complaints: [
      'ألم حوضي عميق يشتبه معه بحصوة حالبية أو إصابة مفصلية دقيقة',
      'تقييم مقطعي للحوض بعد حادث مروري',
    ],
    findings: [
      'حلقة الحوض سليمة تماماً دون شروخ خفية في الحق الوركي',
      'أعضاء الحوض طبيعية دون تجمعات دموية أو سوائل',
    ],
  },
  ct_cervical: {
    complaints: [
      'ألم رقبي حاد بعد حادث سيارة يتطلب مسحاً مقطعياً ثلاثي الأبعاد',
      'اشتباه بكسر دقيق في الفقرة العنقية الثانية',
    ],
    findings: [
      'الفقرات العنقية C1-C7 سليمة بالكامل مع ثبات القنوات العصبية',
      'سلامة الناتئ السني للفقرة C2 دون كسور',
    ],
  },
  mri_lumbar: {
    complaints: [
      'عرق نسا مستمر وتقييم انزلاق غضروفي بالرنين',
      'ألم ظهر مزمن يتطلب فحص الأعصاب والأقراص',
    ],
    findings: [
      'بروز غضروفي بسيط في L4-L5 دون ضغط شديد على الحبل الشوكي',
      'الأقراص الغضروفية مرطبة وبنية القناة العصبية سليمة',
    ],
  },
  mri_knee: {
    complaints: [
      'اشتباه تمزق في الرباط الصليبي الأمامي أو الغضروف الهلالي',
      'عدم ثبات في مفصل الركبة بعد إصابة رياضية',
    ],
    findings: [
      'سلامة الرباط الصليبي الأمامي والخلفي والغضروفين الهلاليين',
      'تمزق جزئي خفيف في القرن الخلفي للغضروف الهلالي الأنسي',
    ],
  },
  mri_head: {
    complaints: [
      'صداع نصفي متكرر مع طنين يتطلب رنيناً مغناطيسياً للدماغ',
      'فحص تفصيلي للأعصاب القحفية والأنسجة الدماغية',
    ],
    findings: [
      'تروية ونسيج الدماغ طبيعيان دون آفات أو أورام',
      'سلامة جذع الدماغ والمخيخ والأعصاب القحفية',
    ],
  },
  mri_cervical: {
    complaints: [
      'تنميل متكرر وضعف في الذراع يشتبه بانضغاط عصبي عنقي',
      'تقييم الحبل الشوكي والغضاريف العنقية بالرنين',
    ],
    findings: [
      'الحبل الشوكي العنقي سليم بإشارة طبيعية دون اعتلال نخاعي',
      'بروز غضروفي طفيف عند C5-C6 دون ضغط حرج على القناة',
    ],
  },
};

export function isPediatricPatientAge(age?: number): boolean {
  return typeof age === 'number' && age > 0 && age < 14;
}

const roundHalfMas = (val: number): number =>
  Math.max(0.5, Math.round(val * 2) / 2);

/**
 * Exact pediatric clinical kVp & mAs protocol lookup matching reference tables.
 */
export const PEDIATRIC_EXAM_RANGES: Record<
  string,
  {kvpRange: [number, number]; masRange: [number, number]}
> = {
  skull_ap: {kvpRange: [60, 70], masRange: [1, 3]},
  skull_supine: {kvpRange: [60, 70], masRange: [1, 3]},
  skull_lat: {kvpRange: [55, 65], masRange: [1, 2]},
  facial_bones_pa: {kvpRange: [55, 65], masRange: [1, 2]},
  nasal_bones_lat: {kvpRange: [50, 55], masRange: [0.5, 1]},
  soft_tissue_neck_lat: {kvpRange: [55, 65], masRange: [1, 3]},
  cervical_ap: {kvpRange: [55, 65], masRange: [1, 3]},
  cervical_lat: {kvpRange: [55, 65], masRange: [1, 3]},
  cervical_oblique_lao: {kvpRange: [55, 65], masRange: [1, 3]},
  thoracic_ap: {kvpRange: [60, 70], masRange: [2, 4]},
  thoracic_lat: {kvpRange: [65, 75], masRange: [3, 6]},
  lumbar_ap: {kvpRange: [60, 70], masRange: [2, 5]},
  lumbar_erect_pa: {kvpRange: [60, 70], masRange: [2, 5]},
  lumbar_oblique_rpo: {kvpRange: [60, 70], masRange: [2, 5]},
  lumbar_lat_left: {kvpRange: [65, 75], masRange: [3, 7]},
  lumbar_lat_right: {kvpRange: [65, 75], masRange: [3, 7]},
  chest_pa: {kvpRange: [60, 80], masRange: [0.5, 2]},
  chest_ap_supine: {kvpRange: [55, 75], masRange: [0.5, 2]},
  chest_ap_erect: {kvpRange: [55, 75], masRange: [0.5, 2]},
  chest_lat_left: {kvpRange: [65, 85], masRange: [1, 3]},
  chest_lat_right: {kvpRange: [65, 85], masRange: [1, 3]},
  ribs_ap: {kvpRange: [55, 65], masRange: [1, 3]},
  abdomen_ap: {kvpRange: [55, 70], masRange: [1, 4]},
  shoulder_ap: {kvpRange: [55, 65], masRange: [1, 3]},
  clavicle_ap: {kvpRange: [55, 65], masRange: [1, 3]},
  humerus_ap: {kvpRange: [50, 65], masRange: [1, 3]},
  elbow_ap: {kvpRange: [45, 60], masRange: [0.5, 2]},
  forearm_ap: {kvpRange: [45, 60], masRange: [0.5, 2]},
  wrist_pa: {kvpRange: [45, 55], masRange: [0.5, 1.5]},
  hand_pa: {kvpRange: [45, 55], masRange: [0.5, 1.5]},
  hand_oblique: {kvpRange: [45, 55], masRange: [0.5, 1.5]},
  pelvis_ap: {kvpRange: [60, 70], masRange: [1, 4]},
  sacrum_coccyx_ap: {kvpRange: [60, 70], masRange: [2, 4]},
  hip_ap: {kvpRange: [60, 70], masRange: [1, 4]},
  femur_ap: {kvpRange: [55, 70], masRange: [1, 4]},
  knee_ap: {kvpRange: [50, 65], masRange: [1, 3]},
  knee_lat_left: {kvpRange: [50, 65], masRange: [1, 3]},
  tibia_fibula_ap: {kvpRange: [50, 65], masRange: [1, 3]},
  ankle_ap: {kvpRange: [45, 60], masRange: [0.5, 2]},
  foot_ap: {kvpRange: [45, 55], masRange: [0.5, 1.5]},
  toes_ap: {kvpRange: [45, 55], masRange: [0.5, 1]},
};

/**
 * Returns calibrated exposure ranges based on patient age group:
 * Adults (>=14 yrs): exact adult protocol table ranges.
 * Pediatrics (<14 yrs): exact pediatric protocol table ranges.
 */
export function getEffectiveExamRanges(
  exam: ExamProtocol,
  patientAge?: number
): {
  kvpRange: [number, number];
  masRange: [number, number];
  isPediatric: boolean;
} {
  if (!isPediatricPatientAge(patientAge)) {
    return {
      kvpRange: exam.kvpRange,
      masRange: exam.masRange,
      isPediatric: false,
    };
  }

  const exactPediatric = PEDIATRIC_EXAM_RANGES[exam.id];
  if (exactPediatric) {
    return {
      kvpRange: exactPediatric.kvpRange,
      masRange: exactPediatric.masRange,
      isPediatric: true,
    };
  }

  const [minK, maxK] = exam.kvpRange;
  const [minM, maxM] = exam.masRange;

  if (exam.modality !== 'XRAY') {
    const pMinM = roundHalfMas(minM * 0.55);
    const pMaxM = Math.max(pMinM + 2, roundHalfMas(maxM * 0.55));
    return {
      kvpRange: [Math.max(55, minK - 15), Math.max(65, maxK - 15)],
      masRange: [pMinM, pMaxM],
      isPediatric: true,
    };
  }

  const kvpDrop = maxK >= 75 ? 12 : maxK >= 65 ? 8 : 5;
  const pMinK = Math.max(45, minK - kvpDrop);
  const pMaxK = Math.max(pMinK + 5, maxK - kvpDrop);
  const pMinM = roundHalfMas(minM * 0.45);
  const pMaxM = Math.max(pMinM + 0.5, roundHalfMas(maxM * 0.45));

  return {
    kvpRange: [pMinK, pMaxK],
    masRange: [pMinM, pMaxM],
    isPediatric: true,
  };
}

export function getClinicRank(totalRevenue: number): ClinicRank {
  let current = CLINIC_RANKS[0];
  for (const rank of CLINIC_RANKS) {
    if (totalRevenue >= rank.minRevenue) {
      current = rank;
    }
  }
  return current;
}

export function getNextClinicRank(totalRevenue: number): ClinicRank | null {
  for (const rank of CLINIC_RANKS) {
    if (totalRevenue < rank.minRevenue) {
      return rank;
    }
  }
  return null;
}

export function getExamById(id: string): ExamProtocol {
  return EXAMS.find((e) => e.id === id) || EXAMS[0];
}

export function pickAvatarForPatient(
  gender: 'M' | 'F',
  age: number
): string {
  if (gender === 'F') {
    return age >= 42 ? PATIENT_AVATARS.womanSenior : PATIENT_AVATARS.womanYoung;
  }
  return age >= 42 ? PATIENT_AVATARS.manSenior : PATIENT_AVATARS.manYoung;
}

export function generatePatient(ownedUpgrades: UpgradeId[]): PatientCase {
  const availableExams = EXAMS.filter((exam) => {
    if (exam.modality === 'CT') return ownedUpgrades.includes('ct_scanner');
    if (exam.modality === 'MRI') return ownedUpgrades.includes('mri_suite');
    return true;
  });

  const exam =
    availableExams[Math.floor(Math.random() * availableExams.length)];
  const isFemale = Math.random() > 0.5;
  const isPediatric = Math.random() < 0.35;
  const namesPool = isPediatric
    ? isFemale
      ? PEDIATRIC_FEMALE_NAMES
      : PEDIATRIC_MALE_NAMES
    : isFemale
      ? FEMALE_NAMES
      : MALE_NAMES;
  const nameAr = namesPool[Math.floor(Math.random() * namesPool.length)];
  const age = isPediatric
    ? Math.floor(Math.random() * 10) + 4 // 4 to 13 years
    : Math.floor(Math.random() * 52) + 18; // 18 to 69 years
  const avatarPath = pickAvatarForPatient(isFemale ? 'F' : 'M', age);
  const scenario = EXAM_SCENARIOS[exam.id] || EXAM_SCENARIOS.chest_pa;
  const complaintAr =
    scenario.complaints[
      Math.floor(Math.random() * scenario.complaints.length)
    ];
  const findingAr =
    scenario.findings[Math.floor(Math.random() * scenario.findings.length)];

  const needsSide = Boolean(exam.sideRequired || isBilateralRegion(exam.region));
  const requestedSide: BodySide = needsSide
    ? Math.random() < 0.5
      ? 'RIGHT'
      : 'LEFT'
    : 'NONE';

  return {
    id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nameAr,
    age,
    isPediatric,
    gender: isFemale ? 'F' : 'M',
    avatarPath,
    complaintAr,
    examId: exam.id,
    requestedSide,
    findingAr,
    isUrgent: Math.random() < 0.22,
    arrivedAt: Date.now(),
  };
}

export function evaluateExposure(params: {
  exam: ExamProtocol;
  selectedRegion: BodyRegion;
  selectedSide?: BodySide;
  requestedSide?: BodySide;
  patientAge?: number;
  selectedProjection: ProjectionType;
  selectedPosture: PatientPosture;
  kvp: number;
  mas: number;
  shieldUsed: boolean;
  patientPrepped: boolean;
  ownedUpgrades: UpgradeId[];
}): ScanEvaluation {
  const {
    exam,
    selectedRegion,
    selectedSide = 'NONE',
    requestedSide = 'NONE',
    patientAge,
    selectedProjection,
    selectedPosture,
    kvp,
    mas,
    shieldUsed,
    patientPrepped,
    ownedUpgrades,
  } = params;

  const hasDR = ownedUpgrades.includes('digital_dr');
  const hasAutoProc = ownedUpgrades.includes('auto_processor');
  const hasShieldUpgrade = ownedUpgrades.includes('lead_shield');
  const hasAreaMonitor = ownedUpgrades.includes('area_radiation_monitor');
  const hasDosimeter = ownedUpgrades.includes('dosimeter_badge');
  const hasThyroidCollar = ownedUpgrades.includes('thyroid_collar');
  const hasLeadGlass = ownedUpgrades.includes('lead_glass_barrier');
  const hasImmobilization = ownedUpgrades.includes('immobilization_kit');
  const hasBuckyGrid = ownedUpgrades.includes('bucky_grid');
  const hasLaserCollimator = ownedUpgrades.includes('collimator_laser');
  const hasAecSensor = ownedUpgrades.includes('aec_sensor');
  const hasTablePad = ownedUpgrades.includes('ergonomic_table_pad');
  const hasTubeCooler = ownedUpgrades.includes('tube_cooler');
  const hasHepaSterilizer = ownedUpgrades.includes('hepa_sterilizer');
  const hasDryPrinter = ownedUpgrades.includes('dry_laser_printer');
  const hasAiPacs = ownedUpgrades.includes('ai_pacs');
  const hasTeleradiology = ownedUpgrades.includes('teleradiology_link');
  const hasVipLounge = ownedUpgrades.includes('vip_lounge');

  const filmConsumed = exam.modality === 'XRAY' && !hasDR ? 1 : 0;

  if (selectedRegion !== exam.region) {
    return {
      success: false,
      reasonCode: 'WRONG_REGION',
      titleAr: 'تصوير منطقة خاطئة!',
      feedbackAr: `المريض طلب ${exam.titleEn} (${formatRegionWithSide(exam.region, requestedSide, 'ar', true)})، لكنك وجّهت جهاز الأشعة إلى ${REGION_LABELS_AR[selectedRegion]}. تم استهلاك الفيلم وتحتاج لإعادة التصوير.`,
      targetRegionScanned: selectedRegion,
      targetSideScanned: selectedSide,
      exposureDelta: 0,
      baseEarned: 0,
      safetyBonus: 0,
      qualityBonus: 0,
      totalEarned: 0,
      filmConsumed,
    };
  }

  if (
    isBilateralRegion(exam.region) &&
    requestedSide !== 'NONE' &&
    selectedSide !== requestedSide
  ) {
    const reqSideLabel = SIDE_SHORT_I18N.ar[requestedSide];
    const selSideLabel =
      selectedSide !== 'NONE' ? SIDE_SHORT_I18N.ar[selectedSide] : 'غير محدد';
    return {
      success: false,
      reasonCode: 'WRONG_SIDE',
      titleAr: 'تحديد طرف خاطئ (يمين / يسار)!',
      feedbackAr: `الطلب السريري هو «${formatRegionWithSide(exam.region, requestedSide, 'ar', true)}» (${reqSideLabel})، لكنك حددت ${selSideLabel}. اختر الجهة الصحيحة على جسم المريض أو من زر الجهة وأعد التصوير.`,
      targetRegionScanned: selectedRegion,
      targetSideScanned: selectedSide,
      exposureDelta: 0,
      baseEarned: 0,
      safetyBonus: 0,
      qualityBonus: 0,
      totalEarned: 0,
      filmConsumed,
    };
  }

  if (selectedPosture !== exam.recommendedPosture) {
    return {
      success: false,
      reasonCode: 'WRONG_POSTURE',
      titleAr: 'وضعية المريض غير مطابقة!',
      feedbackAr: `الوضعية المطلوبة لهذا الفحص هي: ${POSTURE_LABELS_AR[exam.recommendedPosture]}، بينما الوضعية الحالية هي ${POSTURE_LABELS_AR[selectedPosture]}. عدّل وضعية المريض في المشهد ثلاثي الأبعاد وأعد التصوير.`,
      targetRegionScanned: selectedRegion,
      targetSideScanned: selectedSide,
      exposureDelta: 0,
      baseEarned: 0,
      safetyBonus: 0,
      qualityBonus: 0,
      totalEarned: 0,
      filmConsumed,
    };
  }

  if (selectedProjection !== exam.recommendedProjection) {
    return {
      success: false,
      reasonCode: 'WRONG_PROJECTION',
      titleAr: 'وضعية إسقاط غير مطابقة',
      feedbackAr: `البروتوكول المطلوب هو ${exam.projectionLabelAr}. يُرجى تعديل وضعية التصوير وإعادة المحاولة.`,
      targetRegionScanned: selectedRegion,
      targetSideScanned: selectedSide,
      exposureDelta: 0,
      baseEarned: 0,
      safetyBonus: 0,
      qualityBonus: 0,
      totalEarned: 0,
      filmConsumed,
    };
  }

  const {
    kvpRange: [minKvp, maxKvp],
    masRange: [minMas, maxMas],
    isPediatric,
  } = getEffectiveExamRanges(exam, patientAge);

  const scaleFactor = Math.min(1, Math.max(0.24, maxMas / 12));
  const kvpMargin =
    (maxKvp - minKvp <= 6 ? 4 : 6) +
    (hasImmobilization ? 2 : 0) +
    (hasBuckyGrid ? 1 : 0) +
    (hasAecSensor ? 2 : 0);
  const masLowMargin = Math.max(
    0.5,
    Number(
      ((3 + (hasImmobilization ? 1.5 : 0) + (hasAecSensor ? 1 : 0)) * scaleFactor).toFixed(1)
    )
  );
  const masHighMargin = Math.max(
    1.0,
    Number(
      (
        (5 +
          (hasImmobilization ? 2 : 0) +
          (hasBuckyGrid ? 1 : 0) +
          (hasAecSensor ? 1.5 : 0)) *
        scaleFactor
      ).toFixed(1)
    )
  );

  const kvpTooLow = kvp < minKvp - kvpMargin;
  const kvpTooHigh = kvp > maxKvp + kvpMargin;
  const masTooLow = mas < Math.max(0.25, minMas - masLowMargin);
  const masTooHigh = mas > maxMas + masHighMargin;

  const rangeHintAr = isPediatric
    ? `(نطاق الأطفال: ${minKvp}–${maxKvp} kVp و ${minMas}–${maxMas} mAs)`
    : `(${minKvp}–${maxKvp} kVp و ${minMas}–${maxMas} mAs)`;

  if (kvpTooLow || masTooLow) {
    return {
      success: false,
      reasonCode: 'UNDEREXPOSED',
      titleAr: 'تعريض ضعيف (صورة باهتة)',
      feedbackAr: `قيم التعريض (${kvp} kVp · ${mas} mAs) أقل من اللازم؛ لم تخترق الأشعة الأنسجة بشكل كافٍ. ارفع الإعدادات إلى النطاق الموصى به ${rangeHintAr}.`,
      targetRegionScanned: selectedRegion,
      targetSideScanned: selectedSide,
      exposureDelta: -1,
      baseEarned: 0,
      safetyBonus: 0,
      qualityBonus: 0,
      totalEarned: 0,
      filmConsumed,
    };
  }

  if (kvpTooHigh || masTooHigh) {
    return {
      success: false,
      reasonCode: 'OVEREXPOSED',
      titleAr: isPediatric
        ? 'جرعة عالية على طفل (فيلم محترق)!'
        : 'تعريض زائد (فيلم محترق)',
      feedbackAr: isPediatric
        ? `انتبه! المريض طفل (${patientAge} سنة) ويتطلب جرعة منخفضة، بينما القيم المستخدمة (${kvp} kVp · ${mas} mAs) مرتفعة جداً. التزم بنطاق ${rangeHintAr}.`
        : `قيم التعريض (${kvp} kVp · ${mas} mAs) مرتفعة جداً مما أدى لاسوداد الفيلم وفقدان التفاصيل. التزم بنطاق ${rangeHintAr}.`,
      targetRegionScanned: selectedRegion,
      targetSideScanned: selectedSide,
      exposureDelta: 1,
      baseEarned: 0,
      safetyBonus: 0,
      qualityBonus: 0,
      totalEarned: 0,
      filmConsumed,
    };
  }

  const baseEarned = exam.modality === 'XRAY' && hasDR ? 25 : exam.baseFee;
  const safetyBonus =
    (hasShieldUpgrade && shieldUsed ? 0.5 : 0) +
    (hasAreaMonitor ? 0.5 : 0) +
    (hasDosimeter ? 0.5 : 0) +
    (hasThyroidCollar ? 1 : 0) +
    (hasLeadGlass ? 1 : 0);
  const qualityBonus =
    (hasAutoProc ? 1 : 0) +
    (patientPrepped ? 2 : 0) +
    (hasImmobilization ? 1 : 0) +
    (hasBuckyGrid ? 1 : 0) +
    (hasLaserCollimator ? 1 : 0) +
    (hasAecSensor ? 1.5 : 0) +
    (hasTablePad ? 1.5 : 0) +
    (hasTubeCooler ? 1.5 : 0) +
    (hasHepaSterilizer ? 1.5 : 0) +
    (hasDryPrinter ? 1.5 : 0) +
    (hasAiPacs ? 2 : 0) +
    (hasTeleradiology ? 2 : 0) +
    (hasVipLounge ? 2 : 0);
  const totalEarned = baseEarned + safetyBonus + qualityBonus;

  return {
    success: true,
    reasonCode: 'OPTIMAL',
    titleAr: 'صورة أشعة واضحة ومعتمدة',
    feedbackAr: patientPrepped
      ? 'تباين العظام والأنسجة مثالي بفضل كتم النفس وتحسينات العيادة الفعالة.'
      : 'تباين العظام والأنسجة مثالي للتشخيص الطبي. يمكنك الآن اعتماد النتيجة وتحصيل الرسوم.',
    targetRegionScanned: selectedRegion,
    targetSideScanned: selectedSide,
    exposureDelta: 0,
    baseEarned,
    safetyBonus,
    qualityBonus,
    totalEarned,
    filmConsumed,
  };
}
