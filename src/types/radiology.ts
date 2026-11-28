export type BodyRegion =
  | 'head'
  | 'facial_bones'
  | 'nasal_bones'
  | 'soft_tissue_neck'
  | 'cervical'
  | 'thoracic'
  | 'lumbar'
  | 'chest'
  | 'ribs'
  | 'abdomen'
  | 'shoulder'
  | 'clavicle'
  | 'humerus'
  | 'elbow'
  | 'forearm'
  | 'wrist'
  | 'hand'
  | 'pelvis'
  | 'hip'
  | 'femur'
  | 'knee'
  | 'tibia_fibula'
  | 'ankle'
  | 'foot'
  | 'toes'
  | 'sacrum_coccyx';

export type BodySide = 'LEFT' | 'RIGHT' | 'NONE';

export type Modality = 'XRAY' | 'CT' | 'MRI';

export type ProjectionType =
  | 'PA'
  | 'AP'
  | 'LATERAL'
  | 'OBLIQUE'
  | 'AXIAL'
  | 'SAGITTAL';

export type PatientPosture =
  | 'SUPINE'
  | 'PRONE'
  | 'TABLE_LEFT_LAT'
  | 'TABLE_RIGHT_LAT'
  | 'TABLE_RPO'
  | 'TABLE_LPO'
  | 'ERECT_PA'
  | 'ERECT_AP'
  | 'ERECT_LEFT_LAT'
  | 'ERECT_RIGHT_LAT'
  | 'ERECT_RAO'
  | 'ERECT_LAO';

export interface TechProfile {
  uid: string;
  name: string;
  email: string;
}

export interface ExamProtocol {
  id: string;
  titleAr: string;
  titleEn: string;
  region: BodyRegion;
  regionLabelAr: string;
  sideRequired?: boolean;
  modality: Modality;
  modalityLabelAr: string;
  recommendedProjection: ProjectionType;
  projectionLabelAr: string;
  recommendedPosture: PatientPosture;
  postureLabelAr: string;
  kvpRange: [number, number];
  masRange: [number, number];
  rfFrequencyMhz?: number;
  magneticFieldTesla?: number;
  rfSequence?: string;
  baseFee: number;
  imagePath: string;
  clinicalTipAr: string;
}

export interface PatientCase {
  id: string;
  nameAr: string;
  age: number;
  isPediatric?: boolean;
  gender: 'M' | 'F';
  avatarPath: string;
  complaintAr: string;
  examId: string;
  requestedSide: BodySide;
  hasFracture?: boolean;
  findingAr: string;
  isUrgent: boolean;
  arrivedAt: number;
}

export interface ScanEvaluation {
  success: boolean;
  reasonCode:
    | 'OPTIMAL'
    | 'WRONG_REGION'
    | 'WRONG_SIDE'
    | 'WRONG_PROJECTION'
    | 'WRONG_POSTURE'
    | 'UNDEREXPOSED'
    | 'OVEREXPOSED';
  titleAr: string;
  feedbackAr: string;
  targetRegionScanned: BodyRegion;
  targetSideScanned?: BodySide;
  exposureDelta: number; // < 0 underexposed, > 0 overexposed, 0 optimal
  baseEarned: number;
  safetyBonus: number;
  qualityBonus: number;
  totalEarned: number;
  filmConsumed: number;
}

export interface CompletedCase {
  id: string;
  patientNameAr: string;
  patientAvatarPath?: string;
  patientAge?: number;
  examTitleAr: string;
  examImagePath?: string;
  modality: Modality;
  sideUsed?: BodySide;
  hasFracture?: boolean;
  findingAr: string;
  earned: number;
  kvpUsed: number;
  masUsed: number;
  shieldUsed: boolean;
  postureUsed?: PatientPosture;
  timestamp: number;
}

export type UpgradeId =
  | 'lead_shield'
  | 'area_radiation_monitor'
  | 'dosimeter_badge'
  | 'thyroid_collar'
  | 'lead_glass_barrier'
  | 'auto_processor'
  | 'immobilization_kit'
  | 'bucky_grid'
  | 'collimator_laser'
  | 'protocol_assist'
  | 'aec_sensor'
  | 'waiting_room'
  | 'ergonomic_table_pad'
  | 'tube_cooler'
  | 'hepa_sterilizer'
  | 'dry_laser_printer'
  | 'ai_pacs'
  | 'teleradiology_link'
  | 'digital_dr'
  | 'vip_lounge'
  | 'assistant_tech'
  | 'ct_scanner'
  | 'mri_suite';

export interface UpgradeItem {
  id: UpgradeId;
  titleAr: string;
  subtitleAr: string;
  descriptionAr: string;
  cost: number;
  category: 'safety' | 'efficiency' | 'modality' | 'staff';
  benefitSummaryAr: string;
  imagePath: string;
  requiredPatientsServed?: number;
  comingSoon?: boolean;
}

export interface ClinicRank {
  id: string;
  titleAr: string;
  minRevenue: number;
  subtitleAr: string;
}

export type Language = 'ar' | 'en';

export type JoystickPreset =
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right'
  | 'custom';

export type JoystickSize = 'sm' | 'md' | 'lg';

export interface JoystickConfig {
  preset: JoystickPreset;
  size: JoystickSize;
  customX: number;
  customY: number;
}

export type TechLocation = 'ROOM' | 'BOOTH';
export type CassetteState =
  | 'RACK'
  | 'IN_HAND'
  | 'TABLE_BUCKY'
  | 'WALL_BUCKY'
  | 'EXPOSED_IN_HAND'
  | 'IN_CR_READER';

export type ScreenMode = 'AUTH' | 'PLAYING';
export type WorkspaceTab = 'IMAGE' | 'LOG' | 'SHOP' | 'PROTOCOLS';

export interface DaySummaryRecord {
  dayNumber: number;
  patientsTarget: number;
  patientsCompleted: number;
  earned: number;
  spentPurchases: number;
  spentExpenses: number;
  doctorDeduction: number;
  netProfit: number;
  retakes: number;
  filmsUsed: number;
  endedAt: number;
}

export interface ClinicSaveState {
  cash: number;
  totalRevenue: number;
  films: number;
  cartonsBought: number;
  patientsServed: number;
  retakesCount: number;
  filmDebt: number;
  ownedUpgrades: UpgradeId[];
  completedCases: CompletedCase[];
  soundEnabled: boolean;
  updatedAt?: number;
  currentDay?: number;
  dailyTargetPatients?: number;
  dailyPatientsHandled?: number;
  dailyEarned?: number;
  dailySpentPurchases?: number;
  dailySpentExpenses?: number;
  dailyRetakes?: number;
  dailyFilmsUsed?: number;
  dayCompletedAwaitingNext?: boolean;
  dayHistory?: DaySummaryRecord[];
}
