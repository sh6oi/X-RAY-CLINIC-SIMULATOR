import React from 'react';
import {
  BookOpen,
  ClipboardList,
  Image as ImageIcon,
  Monitor,
  ShoppingBag,
  X,
} from 'lucide-react';
import type {
  BodySide,
  CompletedCase,
  ExamProtocol,
  PatientCase,
  PatientPosture,
  ProjectionType,
  ScanEvaluation,
  UpgradeId,
  WorkspaceTab,
} from '../types/radiology';
import {RadiographDisplay} from './RadiographDisplay';
import {PatientLogView} from './PatientLogView';
import {ShopView} from './ShopView';
import {ProtocolsView} from './ProtocolsView';
import {useLanguage} from '../i18n/translations';
import {useStageScroll} from '../hooks/useStageScroll';

interface ClinicPCModalProps {
  isOpen: boolean;
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  onClose: () => void;
  activePatient: PatientCase | null;
  requestedExam: ExamProtocol;
  evaluation: ScanEvaluation | null;
  actualPosture?: PatientPosture;
  actualProjection?: ProjectionType;
  actualSide?: BodySide;
  isDeveloping: boolean;
  hasDR: boolean;
  hasAutoProc: boolean;
  kvp: number;
  mas: number;
  filmsRemaining: number;
  onApproveAndCollect: () => void;
  onRetake: () => void;
  cash: number;
  filmDebt: number;
  patientsServed: number;
  ownedUpgrades: UpgradeId[];
  onBuyCarton: (count: 0.5 | 1 | 5 | 10) => void;
  onTakeEmergencyLoan: () => void;
  onBuyUpgrade: (id: UpgradeId) => void;
  completedCases: CompletedCase[];
  totalRevenue: number;
  retakesCount: number;
}

export const ClinicPCModal: React.FC<ClinicPCModalProps> = ({
  isOpen,
  activeTab,
  onChangeTab,
  onClose,
  activePatient,
  requestedExam,
  evaluation,
  actualPosture,
  actualProjection,
  actualSide,
  isDeveloping,
  hasDR,
  hasAutoProc,
  kvp,
  mas,
  filmsRemaining,
  onApproveAndCollect,
  onRetake,
  cash,
  filmDebt,
  patientsServed,
  ownedUpgrades,
  onBuyCarton,
  onTakeEmergencyLoan,
  onBuyUpgrade,
  completedCases,
  totalRevenue,
  retakesCount,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';
  const {scrollRef, scrollHandlers} = useStageScroll<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  const tabs: {id: WorkspaceTab; label: string; icon: React.ReactNode}[] = [
    {
      id: 'IMAGE',
      label: isAr ? 'الصورة (View & Mask)' : 'Image (View & Mask)',
      icon: <ImageIcon className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'LOG',
      label: isAr ? 'المرضى السابقون' : 'Patient Archive',
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'SHOP',
      label: isAr ? 'المتجر والأفلام' : 'Clinic Shop',
      icon: <ShoppingBag className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'PROTOCOLS',
      label: isAr ? 'البروتوكولات' : 'Protocols',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#050911]/92 flex items-center justify-center p-1.5 sm:p-5">
      <div className="hud-pc-window w-full max-w-5xl h-[96dvh] sm:h-auto sm:max-h-[92vh] rounded-2xl border border-cyan-800/70 bg-[#0B121E] shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Workstation Window Header */}
        <div className="hud-pc-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-800 bg-[#080E18]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
              <Monitor className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {isAr
                  ? 'حاسوب العيادة (نظام PACS)'
                  : 'Clinic PC (PACS Workstation)'}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>{isAr ? 'إغلاق' : 'Close'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeTab(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-[#111B2B] text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
            <span>{isAr ? 'إغلاق الحاسوب' : 'Close PC'}</span>
          </button>
        </div>

        {/* Workstation Content */}
        <div
          ref={scrollRef}
          {...scrollHandlers}
          className="hud-pc-content stage-scroll-area flex-1 overflow-y-auto p-3 sm:p-5"
        >
          {activeTab === 'IMAGE' && (
            <div>
              {isDeveloping ? (
                <div className="rounded-xl border border-slate-800 bg-[#0E1622] p-8 sm:p-12 min-h-[280px] sm:min-h-[360px] flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      {hasDR
                        ? isAr
                          ? 'جاري النقل الرقمي المباشر إلى الحاسوب...'
                          : 'Transferring Direct Digital DR Image...'
                        : hasAutoProc
                          ? isAr
                            ? 'جاري مسح الكاسيت السريع في قارئ CR...'
                            : 'Fast Laser Reading CR Cassette...'
                          : isAr
                            ? 'جاري قراءة الكاسيت في جهاز CR ومعالجة الصورة...'
                            : 'Scanning Cassette in CR Reader...'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isAr
                        ? 'تظهر الصورة هنا فور الانتهاء لتعديل السطوع والتباين واعتمادها'
                        : 'The radiograph will appear here in a moment for View/Mask editing and approval.'}
                    </p>
                  </div>
                </div>
              ) : evaluation && activePatient ? (
                <RadiographDisplay
                  patient={activePatient}
                  requestedExam={requestedExam}
                  evaluation={evaluation}
                  actualPosture={actualPosture}
                  actualProjection={actualProjection}
                  actualSide={actualSide}
                  kvp={kvp}
                  mas={mas}
                  filmsRemaining={filmsRemaining}
                  hasDR={hasDR}
                  onApproveAndCollect={onApproveAndCollect}
                  onRetake={() => {
                    onRetake();
                    onClose();
                  }}
                  onGoToShop={() => onChangeTab('SHOP')}
                />
              ) : (
                <div className="rounded-xl border border-slate-800 bg-[#0E1622] p-8 sm:p-10 text-center space-y-4">
                  <Monitor className="w-10 h-10 text-cyan-400/70 mx-auto" />
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-white">
                      {isAr
                        ? 'لا توجد صورة أشعة ملتقطة حالياً'
                        : 'No Radiograph Loaded Yet'}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {isAr
                        ? hasDR
                          ? 'أدخل المريض وحدد وضعيته، ضع الكاسيت، ثم اخرج وأغلق الباب وأطلق الجرعة لتصل الصورة فوراً للحاسوب.'
                          : 'أدخل المريض وحدد وضعيته، ضع الكاسيت وأطلق الجرعة، ثم أحضر الكاسيت المصوَّر وضعه داخل قارئ الكاسيت (CR) لتظهر الصورة هنا.'
                        : hasDR
                          ? 'Position the patient, place detector, close lead door and fire exposure for instant DR transfer.'
                          : 'Position the patient, insert cassette, trigger exposure, then retrieve the exposed cassette and insert it into the CR Reader.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                  >
                    {isAr ? 'العودة إلى غرفة الأشعة' : 'Return to Clinic'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'LOG' && (
            <PatientLogView
              cases={completedCases}
              totalRevenue={totalRevenue}
              retakesCount={retakesCount}
            />
          )}

          {activeTab === 'SHOP' && (
            <ShopView
              cash={cash}
              films={filmsRemaining}
              filmDebt={filmDebt}
              patientsServed={patientsServed}
              ownedUpgrades={ownedUpgrades}
              onBuyCarton={onBuyCarton}
              onTakeEmergencyLoan={onTakeEmergencyLoan}
              onBuyUpgrade={onBuyUpgrade}
            />
          )}

          {activeTab === 'PROTOCOLS' && <ProtocolsView />}
        </div>
      </div>
    </div>
  );
};
