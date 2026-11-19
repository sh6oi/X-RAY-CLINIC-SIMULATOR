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
  CompletedCase,
  ExamProtocol,
  PatientCase,
  ScanEvaluation,
  UpgradeId,
  WorkspaceTab,
} from '../types/radiology';
import {RadiographDisplay} from './RadiographDisplay';
import {PatientLogView} from './PatientLogView';
import {ShopView} from './ShopView';
import {ProtocolsView} from './ProtocolsView';

interface ClinicPCModalProps {
  isOpen: boolean;
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  onClose: () => void;
  // Image Editor props
  activePatient: PatientCase | null;
  requestedExam: ExamProtocol;
  evaluation: ScanEvaluation | null;
  isDeveloping: boolean;
  hasDR: boolean;
  hasAutoProc: boolean;
  kvp: number;
  mas: number;
  filmsRemaining: number;
  onApproveAndCollect: () => void;
  onRetake: () => void;
  // Shop props
  cash: number;
  filmDebt: number;
  patientsServed: number;
  ownedUpgrades: UpgradeId[];
  onBuyCarton: (count: 1 | 5) => void;
  onTakeEmergencyLoan: () => void;
  onBuyUpgrade: (id: UpgradeId) => void;
  // Log props
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
  if (!isOpen) return null;

  const tabs: {id: WorkspaceTab; label: string; icon: React.ReactNode}[] = [
    {
      id: 'IMAGE',
      label: 'الصورة (View & Mask)',
      icon: <ImageIcon className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'LOG',
      label: 'المرضى السابقون',
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'SHOP',
      label: 'المتجر والأفلام',
      icon: <ShoppingBag className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'PROTOCOLS',
      label: 'البروتوكولات',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#050911]/92 flex items-center justify-center p-2 sm:p-5">
      <div className="w-full max-w-5xl h-[94dvh] sm:h-auto sm:max-h-[92vh] rounded-2xl border border-cyan-800/70 bg-[#0B121E] shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden">
        {/* Workstation Window Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-3.5 sm:px-5 py-3 border-b border-slate-800 bg-[#080E18]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
              <Monitor className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>حاسوب العيادة (نظام PACS)</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>إغلاق</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
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
            <span>إغلاق الحاسوب</span>
          </button>
        </div>

        {/* Workstation Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {activeTab === 'IMAGE' && (
            <div>
              {isDeveloping ? (
                <div className="rounded-xl border border-slate-800 bg-[#0E1622] p-12 min-h-[360px] flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      {hasDR
                        ? 'جاري معالجة الصورة الرقمية...'
                        : hasAutoProc
                          ? 'جاري التحميض السريع للفيلم...'
                          : 'جاري تحميض الفيلم ومعالجته...'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      تظهر الصورة هنا فور الانتهاء لتعديل السطوع والتباين واعتمادها
                    </p>
                  </div>
                </div>
              ) : evaluation && activePatient ? (
                <RadiographDisplay
                  patient={activePatient}
                  requestedExam={requestedExam}
                  evaluation={evaluation}
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
                <div className="rounded-xl border border-slate-800 bg-[#0E1622] p-10 text-center space-y-4">
                  <Monitor className="w-10 h-10 text-cyan-400/70 mx-auto" />
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-white">
                      لا توجد صورة أشعة ملتقطة حالياً
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      أدخل المريض وحدد وضعيته، ضع الكاسيت داخل الطاولة أو الحامل الواقف، ثم اخرج وأغلق الباب وأطلق الجرعة من لوحة التحكم لتظهر الصورة هنا للتعديل والاعتماد.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                  >
                    العودة إلى غرفة الأشعة
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
