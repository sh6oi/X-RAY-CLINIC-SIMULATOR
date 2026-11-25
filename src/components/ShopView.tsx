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
    <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-[#0B111A] border border-slate-800/90">
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
        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-cyan-950/25 flex flex-col items-center justify-center gap-2 text-slate-400">
          {fallbackIcon}
          <span className="text-xs">{alt}</span>
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
    <div className="space-y-8">
      {/* Header Summary */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {isAr
              ? 'متجر مستلزمات وتجهيزات الأشعة'
              : 'Radiology Equipment & Supplies Shop'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {isAr
              ? 'أفلام الأشعة متاحة للشراء بعدد لا نهائي من المرات، بينما جميع الأجهزة والترقيات الأخرى تُشترى مرة واحدة فقط.'
              : 'X-ray films can be purchased unlimited times; all clinic equipment and upgrades are one-time purchases.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <div>
            <span className="text-slate-400">
              {isAr ? 'الرصيد المتاح: ' : 'Available Cash: '}
            </span>
            <span className="font-mono-num font-bold text-emerald-400 text-base">
              ${cash.toLocaleString('en-US')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">
              {isAr ? 'المرضى المفحوصون: ' : 'Patients Served: '}
            </span>
            <span className="font-mono-num font-bold text-cyan-300 text-base">
              {patientsServed}
            </span>
          </div>
          <div>
            <span className="text-slate-400">
              {isAr ? 'مخزون الأفلام: ' : 'Film Stock: '}
            </span>
            <span
              className={`font-mono-num font-bold text-base ${
                hasDR
                  ? 'text-cyan-400'
                  : films <= 5
                    ? 'text-amber-400'
                    : 'text-slate-100'
              }`}
            >
              {hasDR
                ? isAr
                  ? 'رقمي غير محدود (DR)'
                  : 'Unlimited Digital (DR)'
                : isAr
                  ? `${films} فيلم`
                  : `${films} films`}
            </span>
          </div>
        </div>
      </div>

      {/* Emergency Film Loan Banner */}
      {needsEmergencyLoan && (
        <div className="rounded-xl border border-amber-600/60 bg-amber-950/30 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 max-w-2xl">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-200">
                {isAr
                  ? 'توريد طارئ للأفلام من المستودع الطبي'
                  : 'Emergency Film Supply Credit'}
              </h3>
              <p className="mt-1 text-xs text-amber-100/80 leading-relaxed">
                {isAr
                  ? `نفدت جميع أفلامك ولا تملك $${MINI_PACK_COST} حالياً لشراء عبوة أفلام. يمكنك طلب حزمة طوارئ (10 أفلام أشعة) وتُسدد قيمتها ($${EMERGENCY_LOAN_DEBT}) تلقائياً من عوائد المرضى القادمين.`
                  : `You ran out of films and don't have $${MINI_PACK_COST} for a film pack. Request an emergency 10-film pack ($${EMERGENCY_LOAN_DEBT} deferred credit deducted automatically from upcoming patients).`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTakeEmergencyLoan}
            className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            {isAr
              ? `استلام 10 أفلام طارئة (آجل $${EMERGENCY_LOAN_DEBT})`
              : `Get 10 Emergency Films ($${EMERGENCY_LOAN_DEBT} Credit)`}
          </button>
        </div>
      )}

      {filmDebt > 0 && (
        <div className="rounded-lg border border-slate-800 bg-[#131C29] px-4 py-3 text-xs text-amber-300 flex items-center justify-between">
          <span>
            {isAr
              ? 'مستحقات آجل للموزع الطبي سيتم خصمها تدريجياً من الفحوصات:'
              : 'Outstanding distributor credit to be deducted gradually:'}
          </span>
          <span className="font-mono-num font-bold">${filmDebt}</span>
        </div>
      )}

      {/* Section 1: X-Ray Films */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {isAr ? 'أفلام التصوير الإشعاعي (CR)' : 'CR X-Ray Film Packs'}
            </h3>
            <p className="text-xs text-cyan-300/90 mt-0.5">
              {isAr
                ? 'شراء غير محدود — يمكنك شراء أفلام الأشعة بعدد لا نهائي من المرات'
                : 'Unlimited purchases — buy film packs as many times as needed'}
            </p>
          </div>
          {hasDR && (
            <span className="text-xs text-cyan-300">
              {isAr
                ? 'تم تفعيل التصوير الرقمي DR — لا حاجة للأفلام أو قارئ CR'
                : 'Digital DR Active — Films & CR Reader no longer required'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Quick 10-Film Pack */}
          <div className="rounded-xl border border-slate-800 bg-[#131C29] p-4 flex flex-col justify-between gap-3.5">
            <ShopImageFrame
              src={FILM_CARTON_IMAGE}
              alt={isAr ? 'عبوة سريعة 10 أفلام أشعة' : '10 X-Ray Film Pack'}
              fallbackIcon={<Package className="w-7 h-7 text-cyan-400" />}
            />

            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr
                      ? `عبوة سريعة (${MINI_PACK_SIZE} أفلام)`
                      : `Quick Pack (${MINI_PACK_SIZE} Films)`}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>
                      {isAr ? `${MINI_PACK_SIZE} أفلام` : `${MINI_PACK_SIZE} films`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isAr ? `$${perMiniFilmCost} للفيلم` : `$${perMiniFilmCost}/film`}
                    </span>
                  </div>
                </div>
                <span className="font-mono-num text-base font-bold text-emerald-400 shrink-0">
                  ${MINI_PACK_COST}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? 'خيار مرن للتزود السريع بالأفلام عند الحاجة بأقل تكلفة.'
                  : 'Flexible small restock pack whenever film stock runs low.'}
              </p>
            </div>

            <button
              type="button"
              disabled={cash < MINI_PACK_COST || hasDR}
              onClick={() => onBuyCarton(0.5)}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 disabled:bg-slate-800/60 disabled:border-slate-800 disabled:text-slate-500 text-cyan-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span>
                {hasDR
                  ? isAr
                    ? 'غير مطلوب مع DR'
                    : 'Not needed'
                  : isAr
                    ? `شراء (${MINI_PACK_SIZE} أفلام) — $${MINI_PACK_COST}`
                    : `Buy ${MINI_PACK_SIZE} — $${MINI_PACK_COST}`}
              </span>
            </button>
          </div>

          {/* Standard 20-Film Carton */}
          <div className="rounded-xl border border-slate-800 bg-[#131C29] p-4 flex flex-col justify-between gap-3.5">
            <ShopImageFrame
              src={FILM_CARTON_IMAGE}
              alt={isAr ? 'كرتون أفلام أشعة سينية 20 فيلم' : '20 X-Ray Film Carton'}
              fallbackIcon={<Package className="w-7 h-7 text-cyan-400" />}
            />

            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr
                      ? `كرتون قياسي (${FILM_CARTON_SIZE} فيلم)`
                      : `Standard Carton (${FILM_CARTON_SIZE} Films)`}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>
                      {isAr ? `${FILM_CARTON_SIZE} فيلماً` : `${FILM_CARTON_SIZE} sheets`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isAr ? `$${perFilmCost} للفيلم` : `$${perFilmCost}/film`}
                    </span>
                  </div>
                </div>
                <span className="font-mono-num text-base font-bold text-emerald-400 shrink-0">
                  ${FILM_CARTON_COST}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? 'الكرتون القياسي لكاسيت الـ CR في العيادات اليومية.'
                  : 'Standard CR cassette carton for regular daily exams.'}
              </p>
            </div>

            <button
              type="button"
              disabled={cash < FILM_CARTON_COST || hasDR}
              onClick={() => onBuyCarton(1)}
              className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span>
                {hasDR
                  ? isAr
                    ? 'غير مطلوب مع DR'
                    : 'Not needed'
                  : isAr
                    ? `شراء (${FILM_CARTON_SIZE} فيلم) — $${FILM_CARTON_COST}`
                    : `Buy ${FILM_CARTON_SIZE} — $${FILM_CARTON_COST}`}
              </span>
            </button>
          </div>

          {/* Bulk 5-Carton Pack */}
          <div className="rounded-xl border border-slate-800 bg-[#131C29] p-4 flex flex-col justify-between gap-3.5">
            <ShopImageFrame
              src={FILM_CARTON_IMAGE}
              alt={isAr ? 'حزمة جملة 5 كراتين أفلام أشعة' : '5-Carton Bulk Pack'}
              fallbackIcon={<Package className="w-7 h-7 text-slate-300" />}
            />

            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr
                      ? `حزمة جملة (${BULK_CARTON_SIZE} فيلم)`
                      : `Bulk Pack (${BULK_CARTON_SIZE} Films)`}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>
                      {isAr ? `$${perBulkFilmCost} للفيلم` : `$${perBulkFilmCost}/film`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-300">
                      {isAr ? `توفير $${bulkSavings}` : `Save $${bulkSavings}`}
                    </span>
                  </div>
                </div>
                <span className="font-mono-num text-base font-bold text-emerald-400 shrink-0">
                  ${BULK_CARTON_COST}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? 'توريد اقتصادي مخصص للعيادات المزدحمة يخفض تكلفة الفيلم.'
                  : 'Cost-effective 5-carton bundle for high-volume clinics.'}
              </p>
            </div>

            <button
              type="button"
              disabled={cash < BULK_CARTON_COST || hasDR}
              onClick={() => onBuyCarton(5)}
              className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-white disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span>
                {hasDR
                  ? isAr
                    ? 'غير مطلوب مع DR'
                    : 'Not needed'
                  : isAr
                    ? `شراء (${BULK_CARTON_SIZE} فيلم) — $${BULK_CARTON_COST}`
                    : `Buy ${BULK_CARTON_SIZE} — $${BULK_CARTON_COST}`}
              </span>
            </button>
          </div>

          {/* Mega 10-Carton Hospital Crate */}
          <div className="rounded-xl border border-slate-800 bg-[#131C29] p-4 flex flex-col justify-between gap-3.5">
            <ShopImageFrame
              src={FILM_CARTON_IMAGE}
              alt={isAr ? 'صندوق مستشفى ضخم 200 فيلم' : '200-Film Hospital Crate'}
              fallbackIcon={<Package className="w-7 h-7 text-amber-300" />}
            />

            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr
                      ? `صندوق مستشفى (${MEGA_CRATE_SIZE} فيلم)`
                      : `Hospital Crate (${MEGA_CRATE_SIZE} Films)`}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>
                      {isAr ? `$${perMegaFilmCost} للفيلم` : `$${perMegaFilmCost}/film`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-300">
                      {isAr ? `توفير $${megaSavings}` : `Save $${megaSavings}`}
                    </span>
                  </div>
                </div>
                <span className="font-mono-num text-base font-bold text-emerald-400 shrink-0">
                  ${MEGA_CRATE_COST}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? 'أكبر كمية توريد متكررة بأقل سعر ممكن للفيلم الواحد.'
                  : 'Maximum hospital supply crate with the lowest cost per film.'}
              </p>
            </div>

            <button
              type="button"
              disabled={cash < MEGA_CRATE_COST || hasDR}
              onClick={() => onBuyCarton(10)}
              className="w-full py-2 px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span>
                {hasDR
                  ? isAr
                    ? 'غير مطلوب مع DR'
                    : 'Not needed'
                  : isAr
                    ? `شراء (${MEGA_CRATE_SIZE} فيلم) — $${MEGA_CRATE_COST}`
                    : `Buy ${MEGA_CRATE_SIZE} — $${MEGA_CRATE_COST}`}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Equipment & Clinic Upgrades */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {isAr
                ? 'الأدوات المساعدة والأجهزة الطبية وترقيات العيادة'
                : 'Technologist Tools, Systems & Clinic Upgrades'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr
                ? 'جميع الأجهزة والأدوات التالية تُشترى مرة واحدة فقط للعيادة'
                : 'Every equipment item & upgrade below is a permanent one-time purchase'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_FILTERS.map((c) => {
              const active = categoryFilter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
            const subtitle = isAr ? item.subtitleAr : item.titleAr;
            const benefit = isAr ? item.benefitSummaryAr : enCopy.benefit;
            const description = isAr ? item.descriptionAr : enCopy.description;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isOwned
                    ? 'border-emerald-800/60 bg-emerald-950/15'
                    : isComingSoon
                      ? 'border-slate-700/80 bg-[#101824] opacity-90'
                      : isPatientGated
                        ? 'border-amber-700/50 bg-[#121824]'
                        : 'border-slate-800 bg-[#131C29]'
                }`}
              >
                <div className="space-y-4">
                  <ShopImageFrame
                    src={item.imagePath}
                    alt={title}
                    fallbackIcon={CATEGORY_ICON[item.category]}
                  />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {CATEGORY_ICON[item.category]}
                        <h4 className="text-base font-bold text-white leading-snug">
                          {title}
                        </h4>
                      </div>
                      {isComingSoon && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold shrink-0">
                          {isAr ? 'قريباً' : 'Soon'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{subtitle}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isComingSoon ? 'text-amber-300' : 'text-cyan-300'
                        }
                      >
                        {benefit}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300/90 leading-relaxed">
                      {description}
                    </p>

                    {isComingSoon && (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-2.5 flex items-center gap-2 text-[11px] font-semibold text-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {isAr
                            ? 'غير متوفر للشراء حالياً — سيتاح قريباً حتى مع توفر الرصيد'
                            : 'Currently unavailable for purchase — coming soon'}
                        </span>
                      </div>
                    )}

                    {isPatientGated && (
                      <div className="rounded-lg border border-amber-700/50 bg-amber-950/25 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-amber-200">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>
                              {isAr
                                ? `يُفتح بعد فحص ${requiredCount} مريض`
                                : `Unlocks after ${requiredCount} patients`}
                            </span>
                          </span>
                          <span className="font-mono-num">
                            {patientsServed}/{requiredCount}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            style={{width: `${progressPct}%`}}
                            className="h-full bg-amber-400 transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <span className="font-mono-num text-base font-bold text-emerald-400">
                    ${item.cost.toLocaleString('en-US')}
                  </span>

                  {isOwned ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>
                        {isAr ? 'تم الشراء والتركيب (مرة واحدة)' : 'Installed (1/1)'}
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isComingSoon || isPatientGated || !canAfford}
                      onClick={() => onBuyUpgrade(item.id)}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      {isComingSoon
                        ? isAr
                          ? 'غير متوفر حالياً'
                          : 'Unavailable'
                        : isPatientGated
                          ? isAr
                            ? `مقفل (${patientsServed}/${requiredCount})`
                            : `Locked (${patientsServed}/${requiredCount})`
                          : canAfford
                            ? isAr
                              ? 'شراء وتركيب'
                              : 'Buy & Install'
                            : isAr
                              ? 'رصيد غير كافٍ'
                              : 'Insufficient Cash'}
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
