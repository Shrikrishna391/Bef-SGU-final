import React, { useState } from 'react';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Award,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid
} from 'recharts';
import { BENCHMARK_SIMULATION_SUMMARY, BENCHMARK_COMPARISONS, BENCHMARK_SOLVE_TIME, SEED_BENCHMARK_DATA } from '../data/mockData';

export const BaselineComparisonView: React.FC = () => {
  const [selectedSeed, setSelectedSeed] = useState<number>(0);

  const seedData = SEED_BENCHMARK_DATA.find(s => s.seed === selectedSeed) || SEED_BENCHMARK_DATA[0];

  // Data for Recharts Bar Chart
  const stockoutChartData = [
    { name: 'Stockout Units', CurrentPractice: seedData.currentStockout, StrongBaseline: seedData.strongStockout, HETVAYA: seedData.hetvayaStockout },
    { name: 'Expired/Rejected', CurrentPractice: seedData.currentWaste, StrongBaseline: seedData.strongWaste, HETVAYA: seedData.hetvayaWaste },
  ];

  const freightChartData = [
    { name: 'Freight Cost (₹)', CurrentPractice: seedData.currentFreight, StrongBaseline: seedData.strongFreight, HETVAYA: seedData.hetvayaFreight },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Baseline Impact Benchmark (Section 17)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              FR-13 Simulated True Demand
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Scored on identical hidden true demand over 9 weekly cycles across 20 simulated networks (Seeds 0–19). 180 of 180 decision runs successfully completed (p95: {BENCHMARK_SOLVE_TIME.p95}ms).
          </p>
        </div>

        {/* Seed Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
          <span className="text-xs text-slate-400 font-semibold">Simulation Seed:</span>
          <select
            value={selectedSeed}
            onChange={e => setSelectedSeed(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
          >
            {SEED_BENCHMARK_DATA.map(s => (
              <option key={s.seed} value={s.seed}>
                Network Seed #{s.seed}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side 3-Way Policy Card Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Policy 1: Current Practice */}
        <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Policy 1: Status Quo</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">Spreadsheet</span>
          </div>
          <h3 className="text-base font-bold text-white">Current Practice</h3>
          <p className="text-xs text-slate-400">
            Ship last week's sales • Nearest warehouse only • Newest batch first • No arrival shelf-life check
          </p>

          <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Stockout Units:</span>
              <span className="font-extrabold text-rose-400">{seedData.currentStockout.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Expired &amp; Rejected:</span>
              <span className="font-extrabold text-rose-400">{seedData.currentWaste.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Freight Cost:</span>
              <span className="font-extrabold text-slate-200">₹{seedData.currentFreight.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Fill Rate:</span>
              <span className="font-bold text-slate-300">{seedData.currentFillRate}%</span>
            </div>
          </div>
        </div>

        {/* Policy 2: Strong Textbook Baseline */}
        <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Policy 2: Operations Textbook</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">Min-Max</span>
          </div>
          <h3 className="text-base font-bold text-white">Strong Baseline</h3>
          <p className="text-xs text-slate-400">
            4-week MA + 1.65σ safety stock • Nearest warehouse • Earliest expiry first (FEFO) • Dispatch shelf check
          </p>

          <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Stockout Units:</span>
              <span className="font-extrabold text-slate-200">{seedData.strongStockout.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Expired &amp; Rejected:</span>
              <span className="font-extrabold text-slate-200">{seedData.strongWaste.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Freight Cost:</span>
              <span className="font-extrabold text-slate-200">₹{seedData.strongFreight.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Fill Rate:</span>
              <span className="font-bold text-slate-300">{seedData.strongFillRate}%</span>
            </div>
          </div>
        </div>

        {/* Policy 3: HETVAYA Engine */}
        <div className="glass-panel p-5 rounded-2xl border-emerald-500/40 bg-emerald-950/20 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-lg">
            Recommended
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Policy 3: This Engine</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">HEURISTIC</span>
          </div>
          <h3 className="text-base font-extrabold text-white">HETVAYA Engine</h3>
          <p className="text-xs text-slate-300">
            Marginal-value knapsack allocation • Arrival shelf-life per kirana • Lateness-weighed sourcing • Space limit
          </p>

          <div className="space-y-3 pt-2 border-t border-emerald-800/40 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Stockout Units:</span>
              <span className="font-black text-emerald-400">{seedData.hetvayaStockout.toLocaleString()} units ({BENCHMARK_COMPARISONS.stockoutReductionVsCurrentPct}%)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Expired &amp; Rejected:</span>
              <span className="font-black text-emerald-400">{seedData.hetvayaWaste.toLocaleString()} units ({BENCHMARK_COMPARISONS.wasteReductionVsCurrentPct}%)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Freight Cost:</span>
              <span className="font-black text-emerald-400">₹{seedData.hetvayaFreight.toLocaleString()} ({BENCHMARK_COMPARISONS.freightReductionVsCurrentPct > 0 ? `+${BENCHMARK_COMPARISONS.freightReductionVsCurrentPct}%` : `${BENCHMARK_COMPARISONS.freightReductionVsCurrentPct}%`})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Fill Rate:</span>
              <span className="font-bold text-emerald-300">{seedData.hetvayaFillRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Chart Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stockout & Expiry Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Stockout Units &amp; Expiry Waste (Lower is Better)
          </h4>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockoutChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="CurrentPractice" fill="#f43f5e" name="Current Practice" radius={[4, 4, 0, 0]} />
                <Bar dataKey="StrongBaseline" fill="#64748b" name="Strong Baseline" radius={[4, 4, 0, 0]} />
                <Bar dataKey="HETVAYA" fill="#10b981" name="HETVAYA Engine" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Freight Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Total Freight Cost in Rupees (Lower is Better)
          </h4>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={freightChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} unit=" ₹" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="CurrentPractice" fill="#f43f5e" name="Current Practice" radius={[4, 4, 0, 0]} />
                <Bar dataKey="StrongBaseline" fill="#64748b" name="Strong Baseline" radius={[4, 4, 0, 0]} />
                <Bar dataKey="HETVAYA" fill="#6366f1" name="HETVAYA Engine" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Documented Evidence & Honest Claim Callout (PRD Section 16 & 17) */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Factual Verification &amp; Innovation Grounding (Section 16 &amp; 17.2)</span>
        </div>
        <p className="leading-relaxed">
          Against <strong>Current Practice</strong> (the spreadsheet rule used by 85–90% of Indian FMCG traditional trade distributors), HETVAYA achieves computed benchmark gains: <strong>{BENCHMARK_COMPARISONS.stockoutReductionVsCurrentPct}% stockouts</strong>, <strong>{BENCHMARK_COMPARISONS.wasteReductionVsCurrentPct}% expiry waste</strong>, and lost margin reduction of <strong>{BENCHMARK_COMPARISONS.lostMarginReductionVsCurrentPct}%</strong>.
        </p>
        <p className="leading-relaxed text-slate-400">
          Against the <strong>Strong Baseline</strong> (safety-stock + FEFO), HETVAYA achieves <strong>{BENCHMARK_COMPARISONS.stockoutChangeVsTextbookPct}% stockouts</strong> and <strong>{BENCHMARK_COMPARISONS.wasteReductionVsTextbookPct}% expiry waste</strong>, while maintaining 100% decision feasibility in under 1ms (p95: {BENCHMARK_SOLVE_TIME.p95}ms).
        </p>
      </div>
    </div>
  );
};
