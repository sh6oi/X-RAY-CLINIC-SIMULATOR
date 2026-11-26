import React from 'react';
import {
  ArrowUpRight,
  CalendarCheck2,
  Coins,
  Film,
  Percent,
  RotateCcw,
  ShoppingBag,
  Sunrise,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type {DaySummaryRecord} from '../types/radiology';
import {useLanguage} from '../i18n/translations';

interface DaySummaryModalProps {
  isOpen: boolean;
  summary: DaySummaryRecord | null;
  currentCash: number;
  hasWaitingRoom: boolean;
  dayHistory: DaySummaryRecord[];
  onStartNewDay: () => void;
}

export const DaySummaryModal: React.FC<DaySummaryModalProps> = ({
  isOpen,
  summary,
  currentCash,
  hasWaitingRoom,
  dayHistory,
  onStartNewDay,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  if (!isOpen || !summary) return null;

  const grossProfitBeforeDoctor =
    summary.earned - summary.spentPurchases - summary.spentExpenses;
  const isPositiveNet = summary.netProfit >= 0;
  const nextDayNumber = summary.dayNumber + 1;
  const nextRangeLabel = hasWaitingRoom ? '20–25' : '10–15';

  return (
    <div className="fixed inset-0 z-[75] bg-[#04080F]/92 flex items-center justify-center p-2.5 sm:p-4">
      <div className="hud-modal-scroll w-full max-w-xl max-h-[94dvh] overflow-y-auto rounded-2xl border border-cyan-500/60 bg-[#0A1320] text-slate-100 shadow-2xl p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <CalendarCheck2 className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <span className="inline-block text-[11px] font-bold text-cyan-300 tracking-wide">
                {isAr
                  ? `ملخص حسابات اليوم #${summary.dayNumber}`
                  : `End of Day #${summary.dayNumber} Report`}
              </span>
              <h2 className="text-base sm:text-xl font-display font-bold text-white">
                {isAr
                  ? `تم إتمام جميع مراجعي اليوم (${summary.patientsCompleted} / ${summary.patientsTarget})`
                  : `All Daily Patients Completed (${summary.patientsCompleted} / ${summary.patientsTarget})`}
              </h2>
            </div>
          </div>
        </div>

        {/* Core 4 Financial Metrics + 10% Doctor Deduction */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* 1. Earned */}
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {isAr ? 'المبالغ التي حصلت عليها' : 'Amounts Collected'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isAr ? 'إجمالي رسوم الفحوصات اليوم' : 'Total patient revenue today'}
              </p>
            </div>
            <span className="font-mono-num text-lg font-bold text-emerald-400 shrink-0">
              +${summary.earned.toLocaleString('en-US')}
            </span>
          </div>

          {/* 2. Spent on Purchases / Upgrades (المبالغ التي صرفتها) */}
          <div className="rounded-xl border border-sky-700/50 bg-sky-950/20 p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-200">
                <ShoppingBag className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>
                  {isAr ? 'المبالغ التي صرفتها' : 'Amounts Spent (Upgrades)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? 'شراء الأجهزة والتجهيزات والترقيات'
                  : 'Equipment & clinic upgrades'}
              </p>
            </div>
            <span className="font-mono-num text-lg font-bold text-sky-300 shrink-0">
              -${summary.spentPurchases.toLocaleString('en-US')}
            </span>
          </div>

          {/* 3. Spent on Operating / Films (المبالغ التي أنفقتها) */}
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                <TrendingDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  {isAr ? 'المبالغ التي أنفقتها' : 'Operating Expenses'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? 'كراتين الأفلام وسداد المستحقات'
                  : 'Film cartons & credit repayments'}
              </p>
            </div>
            <span className="font-mono-num text-lg font-bold text-amber-300 shrink-0">
              -${summary.spentExpenses.toLocaleString('en-US')}
            </span>
          </div>

          {/* 4. Doctor 10% Deduction */}
          <div className="rounded-xl border border-rose-700/50 bg-rose-950/20 p-3.5 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                <Percent className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>
                  {isAr ? 'خصم نسبة الطبيب (10%)' : 'Doctor Share (10%)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {grossProfitBeforeDoctor > 0
                  ? isAr
                    ? `10% من ربح اليوم ($${grossProfitBeforeDoctor.toLocaleString('en-US')})`
                    : `10% of daily profit ($${grossProfitBeforeDoctor.toLocaleString('en-US')})`
                  : isAr
                    ? 'لا يوجد ربح موجب للخصم اليوم'
                    : 'No positive profit to deduct'}
              </p>
            </div>
            <span className="font-mono-num text-lg font-bold text-rose-300 shrink-0">
              -${summary.doctorDeduction.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {/* Net Profit Highlight Card */}
        <div
          className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
            isPositiveNet
              ? 'border-emerald-500/60 bg-[#0D211D]'
              : 'border-rose-500/60 bg-[#221016]'
          }`}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Coins
                className={`w-5 h-5 shrink-0 ${
                  isPositiveNet ? 'text-emerald-400' : 'text-rose-400'
                }`}
              />
              <span>
                {isAr ? 'الربح الصافي لليوم' : 'Daily Net Profit'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {isAr
                ? 'بعد خصم جميع المصروفات والنفقات ونسبة الطبيب (10%)'
                : 'After all expenses, purchases & 10% doctor deduction'}
            </p>
          </div>
          <span
            dir="ltr"
            className={`font-mono-num text-2xl sm:text-3xl font-bold ${
              isPositiveNet ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {isPositiveNet ? '+' : '-'}$
            {Math.abs(summary.netProfit).toLocaleString('en-US')}
          </span>
        </div>

        {/* Secondary Activity & Wallet Strip */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-slate-800 bg-[#0E1929] p-2.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{isAr ? 'المرضى' : 'Patients'}</span>
            </div>
            <div className="mt-0.5 font-mono-num text-sm font-bold text-white">
              {summary.patientsCompleted}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0E1929] p-2.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <Film className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{isAr ? 'أفلام مستهلكة' : 'Films Used'}</span>
            </div>
            <div className="mt-0.5 font-mono-num text-sm font-bold text-white">
              {summary.filmsUsed}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0E1929] p-2.5">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <RotateCcw className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>{isAr ? 'إعادة تصوير' : 'Retakes'}</span>
            </div>
            <div className="mt-0.5 font-mono-num text-sm font-bold text-white">
              {summary.retakes}
            </div>
          </div>
        </div>

        {/* Updated Clinic Balance Bar */}
        <div className="rounded-xl border border-slate-800 bg-[#0E1929] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="flex items-center gap-2 text-slate-300 font-medium">
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isAr
                ? 'رصيد العيادة الحالي (بعد خصم الطبيب):'
                : 'Clinic Cash Balance (After Deduction):'}
            </span>
          </span>
          <span className="font-mono-num font-bold text-emerald-400 text-base">
            ${currentCash.toLocaleString('en-US')}
          </span>
        </div>

        {/* Recent Days Mini History */}
        {dayHistory.length > 1 && (
          <div className="rounded-xl border border-slate-800 bg-[#0D1726] p-3 space-y-2">
            <div className="text-[11px] font-bold text-slate-400">
              {isAr ? 'سجل الأيام السابقة' : 'Recent Days History'}
            </div>
            <div className="space-y-1.5 max-h-24 overflow-y-auto">
              {dayHistory.slice(0, 5).map((rec) => (
                <div
                  key={`${rec.dayNumber}-${rec.endedAt}`}
                  className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-800/80"
                >
                  <span className="text-slate-300 font-semibold">
                    {isAr
                      ? `اليوم ${rec.dayNumber} · ${rec.patientsCompleted} مريض`
                      : `Day ${rec.dayNumber} · ${rec.patientsCompleted} pts`}
                  </span>
                  <span
                    dir="ltr"
                    className={`font-mono-num font-bold ${
                      rec.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {rec.netProfit >= 0 ? '+' : '-'}$
                    {Math.abs(rec.netProfit).toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start New Day CTA */}
        <button
          type="button"
          onClick={onStartNewDay}
          className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 cursor-pointer transition-all shadow-lg"
        >
          <Sunrise className="w-5 h-5 shrink-0" />
          <span>
            {isAr
              ? `بدء اليوم الجديد (اليوم ${nextDayNumber} · ${nextRangeLabel} مراجعاً)`
              : `Start Day ${nextDayNumber} (${nextRangeLabel} Patients)`}
          </span>
          <ArrowUpRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
