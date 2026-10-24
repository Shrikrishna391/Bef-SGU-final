import React from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowRight, Truck, Calendar, Layers, ShieldCheck, DollarSign, HelpCircle } from 'lucide-react';
import { ReasonCard } from '../types';

interface ReasonCardModalProps {
  card: ReasonCard | null;
  onClose: () => void;
  onApproveLine?: () => void;
}

export const ReasonCardModal: React.FC<ReasonCardModalProps> = ({ card, onClose, onApproveLine }) => {
  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>AI Allocation Reason Card</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  FR-10 Explainable Allocation
                </span>
              </h3>
              <p className="text-xs text-slate-400">{card.skuName} → {card.retailerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Executive Summary Callout */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
            <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Planner Explanation</span>
            </div>
            <p className="text-sm font-medium text-slate-100 leading-relaxed">
              {card.summary}
            </p>
          </div>

          {/* Demand & Inventory Position */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-panel p-3 rounded-xl border-slate-800">
              <span className="text-[11px] text-slate-400">Demand Median (q50)</span>
              <p className="text-lg font-bold text-white mt-0.5">{card.demandMedian} units</p>
              <span className="text-[10px] text-slate-500">7-day cycle total</span>
            </div>

            <div className="glass-panel p-3 rounded-xl border-slate-800">
              <span className="text-[11px] text-slate-400">95th Percentile (q95)</span>
              <p className="text-lg font-bold text-indigo-300 mt-0.5">{card.demandP95} units</p>
              <span className="text-[10px] text-indigo-400/80">Peak demand coverage</span>
            </div>

            <div className="glass-panel p-3 rounded-xl border-slate-800">
              <span className="text-[11px] text-slate-400">Stock After Transit</span>
              <p className="text-lg font-bold text-white mt-0.5">{card.effectiveStockBefore} units</p>
              <span className="text-[10px] text-slate-500">On-hand minus lead time</span>
            </div>

            <div className="glass-panel p-3 rounded-xl border-slate-800">
              <span className="text-[11px] text-slate-400">Allocated</span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{card.casesAllocated} cases</p>
              <span className="text-[10px] text-emerald-400/80">{card.unitsAllocated} units</span>
            </div>
          </div>

          {/* Marginal Value Tiers Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Marginal Value Tiers (Why Shipping Stopped Here)</span>
              </h4>
              <span className="text-[11px] text-slate-400">Objective: Expected Margin &gt; Freight + Holding</span>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/50">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Tier</th>
                    <th className="py-2.5 px-3 font-semibold">Prob (This Week)</th>
                    <th className="py-2.5 px-3 font-semibold">Expected Margin</th>
                    <th className="py-2.5 px-3 font-semibold">Freight + Holding</th>
                    <th className="py-2.5 px-3 font-semibold">Net Value (₹)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {card.marginalTiers.map((tier, idx) => (
                    <tr
                      key={idx}
                      className={tier.allocated ? 'bg-slate-900/30' : 'bg-rose-950/10 text-slate-400'}
                    >
                      <td className="py-2.5 px-3 font-medium text-slate-200">{tier.tier} ({tier.caseRange} units)</td>
                      <td className="py-2.5 px-3 text-slate-300">{tier.probThisCycle}%</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">₹{tier.expectedMarginRupees}</td>
                      <td className="py-2.5 px-3 text-amber-400">₹{tier.freightAndHoldingRupees}</td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={tier.netValueRupees > 0 ? 'text-emerald-300' : 'text-rose-400'}>
                          ₹{tier.netValueRupees}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {tier.allocated ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            SHIPPED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            CUTOFF
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cutoff highlight */}
            <div className="mt-2 text-xs text-slate-300 bg-slate-800/40 border border-slate-700/60 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{card.cutoffReason}</span>
            </div>
          </div>

          {/* Shelf Life on Arrival */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Shelf Life on Arrival Check (FR-09 Hard Constraint)</span>
              </span>
              <span className="text-emerald-400 font-bold">
                {card.shelfLifeOnArrivalPct}% (Store Min: {card.minRequiredShelfLifePct}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                style={{ width: `${Math.min(100, card.shelfLifeOnArrivalPct)}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              Batch retains {card.shelfLifeDaysRemaining} days remaining upon arrival. Delivery meets the retailer's 70% minimum freshness requirement and will not trigger kirana rejection waste.
            </p>
          </div>

          {/* Delivery-Time-Aware Sourcing Comparison (T4 test case) */}
          {card.alternativeWarehouseCompared && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-400" />
                <span>Alternative Warehouse Evaluated (Trade-off Matrix)</span>
              </h4>

              <div className="text-xs space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="font-medium text-slate-300">Selected Source: {card.sourceWarehouseName}</span>
                  <span className="text-emerald-400 font-semibold">Optimal on-time arrival</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-400">Compared Source: {card.alternativeWarehouseCompared.warehouseName}</span>
                  <span className="text-amber-400">Lateness penalty ₹{card.alternativeWarehouseCompared.latenessCostRupees}</span>
                </div>

                <p className="text-[11px] text-slate-400 mt-1">
                  <strong>Why not chosen:</strong> {card.alternativeWarehouseCompared.reasonNotChosen}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
          {onApproveLine && (
            <button
              onClick={() => {
                onApproveLine();
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve This Allocation Line</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
