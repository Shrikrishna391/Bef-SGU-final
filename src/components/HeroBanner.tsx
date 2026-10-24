import { ArrowDownRight, ShieldCheck, Zap, TrendingDown, Clock, PackageCheck } from 'lucide-react';
import { BENCHMARK_COMPARISONS, BENCHMARK_SOLVE_TIME } from '../data/mockData';

interface HeroBannerProps {
  onQuickGenerate: () => void;
  planStatus: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onQuickGenerate, planStatus }) => {
  const stockoutDisplay = `${BENCHMARK_COMPARISONS.stockoutReductionVsCurrentPct}%`;
  const wasteDisplay = `${BENCHMARK_COMPARISONS.wasteReductionVsCurrentPct}%`;
  const freightDisplay = BENCHMARK_COMPARISONS.freightReductionVsCurrentPct < 0 
    ? `${BENCHMARK_COMPARISONS.freightReductionVsCurrentPct}%` 
    : `+${BENCHMARK_COMPARISONS.freightReductionVsCurrentPct}%`;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 md:p-8 mb-8 shadow-2xl">
      {/* Decorative ambient gradient */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              Indian FMCG & Kirana Traditional Trade
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" /> Weekly Cycle W43
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
            AI Marginal-Value Allocation & Demand Intelligence
          </h1>

          <p className="mt-2 text-sm md:text-base text-slate-300 leading-relaxed">
            Eliminating the kirana replenishment trap for 13M+ stores where 3–5% distributor margins mean one expired case wipes out the profit of 20+ sales. Optimized via greedy marginal-value knapsack allocation with arrival shelf-life gating.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Arrival Shelf-Life Verified (≥70% Min)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-3 py-1 rounded-full">
              <Zap className="w-3.5 h-3.5" />
              <span>Solve Time: {BENCHMARK_SOLVE_TIME.p95}ms p95 (0 Violations)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/60 border border-amber-800/60 px-3 py-1 rounded-full">
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Explainable Marginal Reason Cards</span>
            </div>
          </div>
        </div>

        {/* Quick KPI Stat Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          {/* Stockout reduction */}
          <div className="glass-panel p-3.5 rounded-xl border-emerald-500/30 bg-emerald-950/20">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span>Stockouts</span>
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-300 tracking-tight">{stockoutDisplay}</div>
            <div className="text-[11px] text-slate-400">vs Current (simulated)</div>
          </div>

          {/* Waste reduction */}
          <div className="glass-panel p-3.5 rounded-xl border-indigo-500/30 bg-indigo-950/20">
            <div className="flex items-center justify-between text-xs text-indigo-400 font-medium">
              <span>Expiry & Rejection</span>
              <TrendingDown className="w-4 h-4" />
            </div>
            <div className="mt-1 text-2xl font-black text-indigo-300 tracking-tight">{wasteDisplay}</div>
            <div className="text-[11px] text-slate-400">Total waste (simulated)</div>
          </div>

          {/* vs Textbook */}
          <div className="glass-panel p-3.5 rounded-xl border-amber-500/30 bg-amber-950/20 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
              <span>vs Textbook Baseline</span>
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div className="mt-1 text-2xl font-black text-amber-300 tracking-tight">{BENCHMARK_COMPARISONS.stockoutChangeVsTextbookPct}%</div>
            <div className="text-[11px] text-slate-400">Stockouts (simulated)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

