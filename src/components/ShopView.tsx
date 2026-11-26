import React, {useMemo, useState} from 'react';
import {
  Package,
  ShoppingCart,
  Check,
  Shield,
  Cpu,
  Users,
  Sparkles,
  AlertCircle,
  Lock,
  Clock,
} from 'lucide-react';
import type {UpgradeId, UpgradeItem} from '../types/radiology';
import {
  BULK_CARTON_COST,
  BULK_CARTON_SIZE,
  EMERGENCY_LOAN_DEBT,
  FILM_CARTON_COST,
  FILM_CARTON_IMAGE,
  FILM_CARTON_SIZE,
  MEGA_CRATE_COST,
  MEGA_CRATE_SIZE,
  MINI_PACK_COST,
  MINI_PACK_SIZE,
  UPGRADES,
} from '../data/radiologyData';
import {UPGRADE_EN, useLanguage} from '../i18n/translations';

interface ShopViewProps {
  cash: number;
  films: number;
  filmDebt: number;
  patientsServed: number;
  ownedUpgrades: UpgradeId[];
  onBuyCarton: (count: 0.5 | 1 | 5 | 10) => void;
  onTakeEmergencyLoan: () => void;
  onBuyUpgrade: (id: UpgradeId) => void;
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  safety: <Shield className="w-4 h-4 text-sky-400 shrink-0" />,
  efficiency: <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />,
  modality: <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />,
  staff: <Users className="w-4 h-4 text-amber-400 shrink-0" />,
};

const CATEGORY_FILTERS: {
  id: 'ALL' | UpgradeItem['category'];
  labelAr: string;
  labelEn: string;
}[] = [
  {id: 'ALL', labelAr: 'الكل', labelEn: 'All'},
  {id: 'safety', labelAr: 'السلامة والحماية', labelEn: 'Radiation Safety'},
  {
    id: 'efficiency',
    labelAr: 'أدوات مساعدة للتقني',
    labelEn: 'Tech Efficiency',
  },
  {id: 'modality', labelAr: 'الأجهزة والأجنحة', labelEn: 'Systems & Suites'},
  {id: 'staff', labelAr: 'الطاقم', labelEn: 'Staffing'},
];

const ShopImageFrame: React.FC<{
  src: string;
  alt: string;
  fallbackIcon: React.ReactNode;
}> = ({src, alt, fallbackIcon}) => {
  const [errored, setErrored] = useState(false);

  return (
    <div className="hud-shop-img relative aspect-[16/9] sm:aspect-[4/3] w-full rounded-lg overflow-hidden bg-[#0B111A] border border-slate-800/90 shrink-0">
      {!errored ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-cyan-950/25 flex flex-col items-center justify-center gap-1 text-slate-400">
          {fallbackIcon}
          <span className="text-[10px] truncate px-1">{alt}</span>
        </div>
      )}
    </div>
  );
};

export const ShopView: React.FC<ShopViewProps> = ({
  cash,
  films,
  filmDebt,
  patientsServed,
  ownedUpgrades,
  onBuyCarton,
  onTakeEmergencyLoan,
  onBuyUpgrade,
}) => {
  const {lang} = useLanguage();
  const isAr = lang === 'ar';

  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | UpgradeItem['category']
  >('ALL');

  const hasDR = ownedUpgrades.includes('digital_dr');
  const needsEmergencyLoan =
    !hasDR && films === 0 && cash < MINI_PACK_COST;

  const visibleUpgrades = useMemo(
    () =>
      categoryFilter === 'ALL'
        ? UPGRADES
        : UPGRADES.filter((u) => u.category === categoryFilter),
    [categoryFilter]
  );

  const perMiniFilmCost = (MINI_PACK_COST / MINI_PACK_SIZE).toFixed(2);
  const perFilmCost = (FILM_CARTON_COST / FILM_CARTON_SIZE).toFixed(2);
  const perBulkFilmCost = (BULK_CARTON_COST / BULK_CARTON_SIZE).toFixed(2);
  const perMegaFilmCost = (MEGA_CRATE_COST / MEGA_CRATE_SIZE).toFixed(2);
  const bulkSavings = FILM_CARTON_COST * 5 - BULK_CARTON_COST;
  const megaSavings = FILM_CARTON_COST * 10 - MEGA_CRATE_COST;

  return (
    <div className="hud-shop-root space-y-4 sm:space-y-6">
      {/* Header Summary */}
      <div className="hud-view-header flex flex-wrap items-end justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div>
          <h2 className="hud-view-title text-lg sm:text-2xl font-bold text-white">
            {isAr
              ? 'متجر مستلزمات وتجهيزات الأشعة'
              : 'Radiology Equipment & Supplies Shop'}
          </h2>
          <p className="hud-view-sub mt-0.5 text-xs sm:text-sm text-slate-400">
            {isAr
              ? 'أفلام الأشعة متاحة بعدد لا نهائي، وجميع الأجهزة والترقيات تُشترى مرة واحدة فقط.'
              : 'Unlimited film packs; all equipment and clinic upgrades are permanent one-time purchases.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs sm:text-sm">
          <div>
            <span className="text-slate-400">
              {isAr ? 'الرصيد: ' : 'Cash: '}
            </span>
            <span className="font-mono-num font-bold text-emerald-400 text-sm sm:text-base">
              ${cash.toLocaleString('en-US')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">
              {isAr ? 'المرضى: ' : 'Patients: '}
            </span>
            <span className="font-mono-num font-bold text-cyan-300 text-sm sm:text-base">
              {patientsServed}
            </span>
          </div>
          <div>
            <span className="text-slate-400">
              {isAr ? 'الأفلام: ' : 'Films: '}
            </span>
            <span
              className={`font-mono-num font-bold text-sm sm:text-base ${
                hasDR
                  ? 'text-cyan-400'
                  : films <= 5
                    ? 'text-amber-400'
                    : 'text-slate-100'
              }`}
            >
              {hasDR
                ? isAr
                  ? 'رقمي (DR)'
                  : 'Digital (DR)'
                : isAr
                  ? `${films} فيلم`
                  : `${films} films`}
            </span>
          </div>
        </div>
      </div>

      {/* Emergency Film Loan Banner */}
      {needsEmergencyLoan && (
        <div className="rounded-xl border border-amber-600/60 bg-amber-950/30 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 max-w-2xl">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-200">
                {isAr
                  ? 'توريد طارئ للأفلام من المستودع الطبي'
                  : 'Emergency Film Supply Credit'}
              </h3>
              <p className="mt-0.5 text-[11px] sm:text-xs text-amber-100/80 leading-relaxed">
                {isAr
                  ? `نفدت جميع أفلامك ولا تملك $${MINI_PACK_COST} حالياً. يمكنك طلب 10 أفلام طوارئ وتُسدد قيمتها ($${EMERGENCY_LOAN_DEBT}) تلقائياً من المرضى القادمين.`
                  : `You ran out of films and don't have $${MINI_PACK_COST}. Request 10 emergency films ($${EMERGENCY_LOAN_DEBT} deferred credit).`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTakeEmergencyLoan}
            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            {isAr
              ? `استلام 10 أفلام طارئة (آجل $${EMERGENCY_LOAN_DEBT})`
              : `Get 10 Emergency Films ($${EMERGENCY_LOAN_DEBT})`}
          </button>
        </div>
      )}

      {filmDebt > 0 && (
        <div className="rounded-lg border border-slate-800 bg-[#131C29] px-3.5 py-2 text-xs text-amber-300 flex items-center justify-between">
          <span>
            {isAr
              ? 'مستحقات آجل للموزع الطبي سيتم خصمها تدريجياً:'
              : 'Outstanding distributor credit:'}
          </span>
          <span className="font-mono-num font-bold">${filmDebt}</span>
        </div>
      )}

      {/* Section 1: X-Ray Films */}
      <section className="space-y-2.5 sm:space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="hud-shop-sec-title text-sm sm:text-lg font-bold text-slate-100">
              {isAr ? 'أفلام التصوير الإشعاعي (CR)' : 'CR X-Ray Film Packs'}
            </h3>
            <p className="text-[11px] sm:text-xs text-cyan-300/90 mt-0.5">
              {isAr
                ? 'شراء غير محدود — متاح بعدد لا نهائي من المرات'
                : 'Unlimited purchases — buy as needed'}
            </p>
          </div>
          {hasDR && (
            <span className="text-[11px] sm:text-xs text-cyan-300">
              {isAr
                ? 'التصوير الرقمي DR مفعّل — لا حاجة للأفلام'
                : 'Digital DR Active — Films not required'}
            </span>
          )}
        </div>

        <div className="hud-shop-films-grid grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Quick 10-Film Pack */}
          <div className="hud-shop-card rounded-xl border border-slate-800 bg-[#131C29] p-2.5 sm:p-3.5 flex flex-col justify-between gap-2.5">
            <div className="hud-shop-card-top space-y-2">
              <ShopImageFrame
                src={FILM_CARTON_IMAGE}
                alt={isAr ? 'عبوة سريعة 10 أفلام أشعة' : '10 X-Ray Film Pack'}
                fallbackIcon={<Package className="w-6 h-6 text-cyan-400" />}
              />

              <div className="min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <h4 className="hud-shop-title text-xs sm:text-sm font-bold text-white truncate">
                      {isAr
                        ? `عبوة سريعة (${MINI_PACK_SIZE} أفلام)`
                        : `Quick Pack (${MINI_PACK_SIZE})`}
                    </h4>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      {isAr
                        ? `${MINI_PACK_SIZE} أفلام · $${perMiniFilmCost}/فيلم`
                        : `${MINI_PACK_SIZE} films · $${perMiniFilmCost}/ea`}
                    </div>
                  </div>
                  <span className="font-mono-num text-sm sm:text-base font-bold text-emerald-400 shrink-0">
                    ${MINI_PACK_COST}
                  </span>
                </div>
                <p className="hud-shop-desc text-[10.5px] text-slate-400 leading-snug line-clamp-2">
                  {isAr
                    ? 'تزود سريع بالأفلام عند الحاجة بأقل تكلفة.'
                    : 'Flexible small restock pack.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={cash < MINI_PACK_COST || hasDR}
              onClick={() => onBuyCarton(0.5)}
              className="hud-shop-btn w-full py-1.5 sm:py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 disabled:bg-slate-800/60 disabled:border-slate-800 disabled:text-slate-500 text-cyan-200 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {hasDR
                  ? isAr
                    ? 'غير مطلوب (DR)'
                    : 'DR Active'
                  : isAr
                    ? `شراء (${MINI_PACK_SIZE}) — $${MINI_PACK_COST}`
                    : `Buy ${MINI_PACK_SIZE} — $${MINI_PACK_COST}`}
              </span>
            </button>
          </div>

          {/* Standard 20-Film Carton */}
          <div className="hud-shop-card rounded-xl border border-slate-800 bg-[#131C29] p-2.5 sm:p-3.5 flex flex-col justify-between gap-2.5">
            <div className="hud-shop-card-top space-y-2">
              <ShopImageFrame
                src={FILM_CARTON_IMAGE}
                alt={isAr ? 'كرتون أفلام أشعة 20 فيلم' : '20 X-Ray Film Carton'}
                fallbackIcon={<Package className="w-6 h-6 text-cyan-400" />}
              />

              <div className="min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <h4 className="hud-shop-title text-xs sm:text-sm font-bold text-white truncate">
                      {isAr
                        ? `كرتون قياسي (${FILM_CARTON_SIZE} فيلم)`
                        : `Standard (${FILM_CARTON_SIZE})`}
                    </h4>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      {isAr
                        ? `${FILM_CARTON_SIZE} فيلماً · $${perFilmCost}/فيلم`
                        : `${FILM_CARTON_SIZE} sheets · $${perFilmCost}/ea`}
                    </div>
                  </div>
                  <span className="font-mono-num text-sm sm:text-base font-bold text-emerald-400 shrink-0">
                    ${FILM_CARTON_COST}
                  </span>
                </div>
                <p className="hud-shop-desc text-[10.5px] text-slate-400 leading-snug line-clamp-2">
                  {isAr
                    ? 'الكرتون القياسي لكاسيت CR اليومي.'
                    : 'Standard CR carton for daily exams.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={cash < FILM_CARTON_COST || hasDR}
              onClick={() => onBuyCarton(1)}
              className="hud-shop-btn w-full py-1.5 sm:py-2 px-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {hasDR
                  ? isAr
                    ? 'غير مطلوب (DR)'
                    : 'DR Active'
                  : isAr
                    ? `شراء (${FILM_CARTON_SIZE}) — $${FILM_CARTON_COST}`
                    : `Buy ${FILM_CARTON_SIZE} — $${FILM_CARTON_COST}`}
              </span>
            </button>
          </div>

          {/* Bulk 5-Carton Pack */}
          <div className="hud-shop-card rounded-xl border border-slate-800 bg-[#131C29] p-2.5 sm:p-3.5 flex flex-col justify-between gap-2.5">
            <div className="hud-shop-card-top space-y-2">
              <ShopImageFrame
                src={FILM_CARTON_IMAGE}
                alt={isAr ? 'حزمة جملة 5 كراتين' : '5-Carton Bulk Pack'}
                fallbackIcon={<Package className="w-6 h-6 text-slate-300" />}
              />

              <div className="min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <h4 className="hud-shop-title text-xs sm:text-sm font-bold text-white truncate">
                      {isAr
                        ? `حزمة جملة (${BULK_CARTON_SIZE} فيلم)`
                        : `Bulk Pack (${BULK_CARTON_SIZE})`}
                    </h4>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      <span>${perBulkFilmCost}/ea</span>
                      <span className="mx-1">·</span>
                      <span className="text-emerald-300">
                        {isAr ? `توفير $${bulkSavings}` : `Save $${bulkSavings}`}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono-num text-sm sm:text-base font-bold text-emerald-400 shrink-0">
                    ${BULK_CARTON_COST}
                  </span>
                </div>
                <p className="hud-shop-desc text-[10.5px] text-slate-400 leading-snug line-clamp-2">
                  {isAr
                    ? 'توريد اقتصادي للعيادات يخفض سعر الفيلم.'
                    : 'Cost-effective 5-carton clinic bundle.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={cash < BULK_CARTON_COST || hasDR}
              onClick={() => onBuyCarton(5)}
              className="hud-shop-btn w-full py-1.5 sm:py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-white disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {hasDR
                  ? isAr
                    ? 'غير مطلوب (DR)'
                    : 'DR Active'
                  : isAr
                    ? `شراء (${BULK_CARTON_SIZE}) — $${BULK_CARTON_COST}`
                    : `Buy ${BULK_CARTON_SIZE} — $${BULK_CARTON_COST}`}
              </span>
            </button>
          </div>

          {/* Mega 10-Carton Hospital Crate */}
          <div className="hud-shop-card rounded-xl border border-slate-800 bg-[#131C29] p-2.5 sm:p-3.5 flex flex-col justify-between gap-2.5">
            <div className="hud-shop-card-top space-y-2">
              <ShopImageFrame
                src={FILM_CARTON_IMAGE}
                alt={isAr ? 'صندوق مستشفى 200 فيلم' : '200-Film Hospital Crate'}
                fallbackIcon={<Package className="w-6 h-6 text-amber-300" />}
              />

              <div className="min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <h4 className="hud-shop-title text-xs sm:text-sm font-bold text-white truncate">
                      {isAr
                        ? `صندوق مستشفى (${MEGA_CRATE_SIZE} فيلم)`
                        : `Hospital Crate (${MEGA_CRATE_SIZE})`}
                    </h4>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      <span>${perMegaFilmCost}/ea</span>
                      <span className="mx-1">·</span>
                      <span className="text-emerald-300">
                        {isAr ? `توفير $${megaSavings}` : `Save $${megaSavings}`}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono-num text-sm sm:text-base font-bold text-emerald-400 shrink-0">
                    ${MEGA_CRATE_COST}
                  </span>
                </div>
                <p className="hud-shop-desc text-[10.5px] text-slate-400 leading-snug line-clamp-2">
                  {isAr
                    ? 'أكبر كمية توريد بأقل سعر ممكن للفيلم.'
                    : 'Maximum crate at the lowest per-film cost.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={cash < MEGA_CRATE_COST || hasDR}
              onClick={() => onBuyCarton(10)}
              className="hud-shop-btn w-full py-1.5 sm:py-2 px-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {hasDR
                  ? isAr
                    ? 'غير مطلوب (DR)'
                    : 'DR Active'
                  : isAr
                    ? `شراء (${MEGA_CRATE_SIZE}) — $${MEGA_CRATE_COST}`
                    : `Buy ${MEGA_CRATE_SIZE} — $${MEGA_CRATE_COST}`}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Equipment & Clinic Upgrades */}
      <section className="space-y-2.5 sm:space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="hud-shop-sec-title text-sm sm:text-lg font-bold text-slate-100">
              {isAr
                ? 'الأدوات المساعدة والأجهزة الطبية وترقيات العيادة'
                : 'Technologist Tools, Systems & Clinic Upgrades'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAr
                ? 'تُشترى مرة واحدة فقط وتبقى مفعّلة دائماً'
                : 'Every upgrade is a permanent one-time purchase'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-0.5">
            {CATEGORY_FILTERS.map((c) => {
              const active = categoryFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                    active
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-[#121B29] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hud-shop-upgrades-grid grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {visibleUpgrades.map((item) => {
            const isOwned = ownedUpgrades.includes(item.id);
            const isComingSoon = !isOwned && Boolean(item.comingSoon);
            const requiredCount = item.requiredPatientsServed ?? 0;
            const isPatientGated =
              !isOwned &&
              !isComingSoon &&
              requiredCount > 0 &&
              patientsServed < requiredCount;
            const canAfford = cash >= item.cost;
            const progressPct =
              requiredCount > 0
                ? Math.min(100, Math.round((patientsServed / requiredCount) * 100))
                : 100;

            const enCopy = UPGRADE_EN[item.id];
            const title = isAr ? item.titleAr : enCopy.title;
            const benefit = isAr ? item.benefitSummaryAr : enCopy.benefit;
            const description = isAr ? item.descriptionAr : enCopy.description;

            return (
              <div
                key={item.id}
                className={`hud-shop-card rounded-xl border p-2.5 sm:p-4 flex flex-col justify-between gap-2.5 transition-colors ${
                  isOwned
                    ? 'border-emerald-800/60 bg-emerald-950/15'
                    : isComingSoon
                      ? 'border-slate-700/80 bg-[#101824] opacity-90'
                      : isPatientGated
                        ? 'border-amber-700/50 bg-[#121824]'
                        : 'border-slate-800 bg-[#131C29]'
                }`}
              >
                <div className="hud-shop-card-top space-y-2">
                  <ShopImageFrame
                    src={item.imagePath}
                    alt={title}
                    fallbackIcon={CATEGORY_ICON[item.category]}
                  />

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {CATEGORY_ICON[item.category]}
                        <h4 className="hud-shop-title text-xs sm:text-sm font-bold text-white leading-snug truncate">
                          {title}
                        </h4>
                      </div>
                      {isComingSoon && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[9.5px] font-bold shrink-0">
                          {isAr ? 'قريباً' : 'Soon'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] sm:text-xs font-semibold truncate">
                      <span
                        className={
                          isComingSoon ? 'text-amber-300' : 'text-cyan-300'
                        }
                      >
                        {benefit}
                      </span>
                    </div>
                    <p className="hud-shop-desc text-[10.5px] sm:text-xs text-slate-300/90 leading-snug line-clamp-2">
                      {description}
                    </p>

                    {isComingSoon && (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 flex items-center gap-1.5 text-[10px] font-semibold text-amber-200">
                        <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">
                          {isAr
                            ? 'سيتاح قريباً'
                            : 'Coming soon'}
                        </span>
                      </div>
                    )}

                    {isPatientGated && (
                      <div className="rounded-lg border border-amber-700/50 bg-amber-950/25 px-2 py-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-amber-200">
                          <span className="flex items-center gap-1 truncate">
                            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>
                              {isAr
                                ? `يُفتح بعد ${requiredCount} مريض`
                                : `Unlocks at ${requiredCount} pts`}
                            </span>
                          </span>
                          <span className="font-mono-num shrink-0">
                            {patientsServed}/{requiredCount}
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            style={{width: `${progressPct}%`}}
                            className="h-full bg-amber-400 transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="font-mono-num text-sm sm:text-base font-bold text-emerald-400">
                    ${item.cost.toLocaleString('en-US')}
                  </span>

                  {isOwned ? (
                    <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-400">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isAr ? 'مثبّت (1/1)' : 'Installed'}
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isComingSoon || isPatientGated || !canAfford}
                      onClick={() => onBuyUpgrade(item.id)}
                      className="hud-shop-btn px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] sm:text-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      {isComingSoon
                        ? isAr
                          ? 'غير متوفر'
                          : 'Soon'
                        : isPatientGated
                          ? isAr
                            ? `مقفل (${patientsServed}/${requiredCount})`
                            : `Locked (${patientsServed}/${requiredCount})`
                          : canAfford
                            ? isAr
                              ? 'شراء وتركيب'
                              : 'Buy'
                            : isAr
                              ? 'رصيد غير كافٍ'
                              : 'Need Cash'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
