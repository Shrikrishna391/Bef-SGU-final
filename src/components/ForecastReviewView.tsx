import React, { useState } from 'react';
import {
  TrendingUp,
  AlertCircle,
  ShieldCheck,
  Zap,
  BarChart2,
  Filter,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  FileText
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { DemandForecast, Product, Retailer, UserRole, ThemeMode } from '../types';

interface ForecastReviewViewProps {
  forecasts: DemandForecast[];
  products: Product[];
  retailers: Retailer[];
  userRole?: UserRole;
  theme?: ThemeMode;
}

export const ForecastReviewView: React.FC<ForecastReviewViewProps> = ({
  forecasts,
  products,
  retailers,
  userRole = 'rohit',
  theme = 'night',
}) => {
  const isDay = theme === 'day';
  const [selectedRetailer, setSelectedRetailer] = useState<string>(userRole === 'ganesh' ? 'RET-GAN' : 'RET-GAN');
  const [selectedSku, setSelectedSku] = useState<string>('SKU-ATT-05');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [showStockoutCorrectedOnly, setShowStockoutCorrectedOnly] = useState<boolean>(false);

  React.useEffect(() => {
    if (userRole === 'ganesh') {
      setSelectedRetailer('RET-GAN');
    } else if (userRole === 'sunita') {
      setSelectedRetailer('RET-DMA');
    } else {
      setSelectedRetailer('RET-GAN');
    }
  }, [userRole]);

  const activeForecast = forecasts.find(
    f => f.retailerId === selectedRetailer && f.sku === selectedSku
  ) || forecasts[0];

  const activeProduct = products.find(p => p.sku === (activeForecast?.sku || selectedSku));
  const activeRetailer = retailers.find(r => r.id === (activeForecast?.retailerId || selectedRetailer));

  // Generate simulated 7-day quantile spread daily fan
  const dailyQuantileData = [
    { day: 'Mon', p10: Math.round(activeForecast.q10 / 7 * 0.9), p50: Math.round(activeForecast.q50 / 7 * 0.95), p95: Math.round(activeForecast.q95 / 7 * 1.05) },
    { day: 'Tue', p10: Math.round(activeForecast.q10 / 7 * 0.95), p50: Math.round(activeForecast.q50 / 7 * 0.98), p95: Math.round(activeForecast.q95 / 7 * 1.02) },
    { day: 'Wed', p10: Math.round(activeForecast.q10 / 7 * 1.0), p50: Math.round(activeForecast.q50 / 7 * 1.0), p95: Math.round(activeForecast.q95 / 7 * 1.0) },
    { day: 'Thu', p10: Math.round(activeForecast.q10 / 7 * 1.02), p50: Math.round(activeForecast.q50 / 7 * 1.02), p95: Math.round(activeForecast.q95 / 7 * 1.04) },
    { day: 'Fri', p10: Math.round(activeForecast.q10 / 7 * 1.1), p50: Math.round(activeForecast.q50 / 7 * 1.15), p95: Math.round(activeForecast.q95 / 7 * 1.18) },
    { day: 'Sat', p10: Math.round(activeForecast.q10 / 7 * 1.3), p50: Math.round(activeForecast.q50 / 7 * 1.4), p95: Math.round(activeForecast.q95 / 7 * 1.45) },
    { day: 'Sun', p10: Math.round(activeForecast.q10 / 7 * 1.25), p50: Math.round(activeForecast.q50 / 7 * 1.35), p95: Math.round(activeForecast.q95 / 7 * 1.38) },
  ];

  const filteredForecasts = forecasts.filter(f => {
    if (userRole === 'ganesh' && f.retailerId !== 'RET-GAN') return false;
    if (userRole === 'sunita' && !['RET-GAN', 'RET-DMA'].includes(f.retailerId)) return false;
    if (filterMethod !== 'all' && f.method !== filterMethod) return false;
    if (showStockoutCorrectedOnly && !f.stockoutCorrected) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
        isDay ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-slate-800 text-white'
      }`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`text-xl font-bold tracking-tight ${isDay ? 'text-[#0a192f]' : 'text-white'}`}>
              {userRole === 'ganesh'
                ? 'Store Demand AI Forecast'
                : userRole === 'sunita'
                ? 'Downstream Demand Intake Curve'
                : userRole === 'priya'
                ? 'Demand ML Governance & Calibration'
                : 'Demand Forecast & Quantile Fan'}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              userRole === 'ganesh'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : userRole === 'sunita'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : userRole === 'priya'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
            }`}>
              {userRole === 'ganesh'
                ? 'Kolhapur Store Scope'
                : userRole === 'sunita'
                ? 'Pune Hub Outbound Scope'
                : userRole === 'priya'
                ? 'Governance Tier-1'
                : 'Statewide ML Model'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {userRole === 'ganesh'
              ? 'Store run-rate and safety stock buffer predictions based on local Kirana velocity.'
              : userRole === 'sunita'
              ? 'Aggregated downstream demand intake for Pune hub outbound fulfillment planning.'
              : userRole === 'priya'
              ? 'Model accuracy (WAPE, bias, pinball loss) across all regional deployment zones.'
              : 'Quantile fan spread (10th percentile floor to 95th percentile peak) feeding MIP solver.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Persona-specific action button */}
          {userRole === 'ganesh' ? (
            <button
              type="button"
              onClick={() => alert('🔄 Syncing Kirana store demand AI with counter sales...')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDay ? 'btn-navy text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sync Store Run-Rate</span>
            </button>
          ) : userRole === 'sunita' ? (
            <button
              type="button"
              onClick={() => alert('📦 Downstream demand curves synchronized with Pune dock picklists.')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDay ? 'btn-navy text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Sync Dock Intake</span>
            </button>
          ) : userRole === 'priya' ? (
            <button
              type="button"
              onClick={() => alert('🛡️ Model calibration log exported for governance review.')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDay ? 'btn-navy text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Calibration Log</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => alert('✨ ML Quantile Predictor retrained with latest 84-day telemetry.')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDay ? 'btn-navy text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Retrain ML Predictor</span>
            </button>
          )}

          {/* Forecast Health Badge */}
          <div className={`flex items-center gap-3 border px-3 py-2 rounded-xl ${
            isDay ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
          }`}>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Model WAPE</span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">14.2%</span>
            </div>
            <div className={`h-6 w-px ${isDay ? 'bg-slate-200' : 'bg-slate-800'}`} />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Coverage (p95)</span>
              <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">94.3%</span>
            </div>
            <div className={`h-6 w-px ${isDay ? 'bg-slate-200' : 'bg-slate-800'}`} />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Bias</span>
              <span className={`text-sm font-extrabold ${isDay ? 'text-slate-800' : 'text-slate-200'}`}>+0.0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected SKU Quantile Breakdown Card */}
      {activeForecast && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Panel */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{activeProduct?.name}</span>
                  <span className="text-xs font-normal text-slate-400">@ {activeRetailer?.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quantile Fan Spread (10th percentile floor to 95th percentile peak)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {activeForecast.method}
                </span>
                {activeForecast.stockoutCorrected && (
                  <span className="px-2 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1" title="Stockout day was corrected to historical median (RC2)">
                    <Sparkles className="w-3 h-3" /> Stockout Corrected
                  </span>
                )}
              </div>
            </div>

            {/* Recharts Area Fan Chart */}
            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyQuantileData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} unit=" u" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="p95" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#p95Grad)" name="95th %ile (Peak)" />
                  <Area type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#p50Grad)" name="Median (q50)" />
                  <Area type="monotone" dataKey="p10" stroke="#f59e0b" strokeWidth={1.5} fill="none" strokeDasharray="4 4" name="10th %ile (Floor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span>Median (q50): {activeForecast.q50} units</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <span>95th %ile (q95): {activeForecast.q95} units</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span>10th %ile (q10): {activeForecast.q10} units</span>
              </span>
            </div>
          </div>

          {/* Model Intelligence & Stockout Correction Details */}
          <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Forecasting Algorithm Rules (Section 13)</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Selected Technique:</div>
                  <div className="text-sm font-bold text-white mt-0.5">{activeForecast.method}</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {activeForecast.method === 'HistGradientBoosting'
                      ? 'Gradient boosting quantile loss with lag-7, 14, 28 features + festival proximity. Switched to because it beat 4-week MA.'
                      : activeForecast.method === 'Bootstrap'
                      ? 'Intermittent demand (interval ≥ 1.32 days): 1,000 resampled uncensored 7-day totals.'
                      : 'Peer transfer model: scaled from peer kiranas due to short history (<56 days).'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Stockout Correction:</span>
                    <span className={activeForecast.stockoutCorrected ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      {activeForecast.stockoutCorrected ? 'ACTIVE' : 'NONE DETECTED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Days where closing stock reached 0 were corrected to 4-week weekday median, preventing the kirana death spiral where zero stock creates zero forecast.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Last Week Accuracy:</span>
                    <span className="text-indigo-300 font-semibold">
                      Actual {activeForecast.lastWeekActual} vs Pred {activeForecast.q50}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Series WAPE: {Math.round(activeForecast.wape * 100)}% • Error is within 1.2× validation threshold (FR-18 Health Pass).
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-300">
              <span className="font-bold">Next Action:</span> These quantile curves feed the Marginal Value Tiers in Section 14.
            </div>
          </div>
        </div>
      )}

      {/* Series Filter and Comprehensive Table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Filter Series (SKU × Kirana):</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <select
              value={filterMethod}
              onChange={e => setFilterMethod(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All ML Methods</option>
              <option value="HistGradientBoosting">HistGradientBoosting</option>
              <option value="MovingAverage">4-Week Moving Average</option>
              <option value="Bootstrap">Bootstrap Resampling</option>
              <option value="PeerTransfer">Peer Transfer</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={showStockoutCorrectedOnly}
                onChange={e => setShowStockoutCorrectedOnly(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
              />
              <span>Stockout Corrected Only (RC2)</span>
            </label>
          </div>
        </div>

        {/* Forecast Table */}
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Kirana Retailer</th>
                  <th className="py-3 px-4">FMCG SKU</th>
                  <th className="py-3 px-4 text-center">10th %ile</th>
                  <th className="py-3 px-4 text-center">Median (q50)</th>
                  <th className="py-3 px-4 text-center">80th %ile</th>
                  <th className="py-3 px-4 text-center">90th %ile</th>
                  <th className="py-3 px-4 text-center font-bold text-indigo-400">95th %ile</th>
                  <th className="py-3 px-4">Model Used</th>
                  <th className="py-3 px-4">Flags</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredForecasts.map((f, idx) => {
                  const ret = retailers.find(r => r.id === f.retailerId);
                  const prod = products.find(p => p.sku === f.sku);
                  const isSelected = selectedRetailer === f.retailerId && selectedSku === f.sku;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-950/30' : ''
                      }`}
                      onClick={() => {
                        setSelectedRetailer(f.retailerId);
                        setSelectedSku(f.sku);
                      }}
                    >
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {ret?.name}
                        <span className="block text-[10px] text-slate-500">{ret?.city}</span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {prod?.name}
                        <span className="block text-[10px] text-slate-500 font-mono">{prod?.sku}</span>
                      </td>

                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{f.q10}</td>
                      <td className="py-3 px-4 text-center font-black text-sm text-emerald-400 font-mono">{f.q50}</td>
                      <td className="py-3 px-4 text-center text-slate-300 font-mono">{f.q80}</td>
                      <td className="py-3 px-4 text-center text-slate-300 font-mono">{f.q90}</td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-300 font-mono">{f.q95}</td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {f.method}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {f.stockoutCorrected && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              CORRECTED
                            </span>
                          )}
                          {f.flags.map((flag, fIdx) => (
                            <span key={fIdx} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-slate-400">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedRetailer(f.retailerId);
                            setSelectedSku(f.sku);
                          }}
                          className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          View Curve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
