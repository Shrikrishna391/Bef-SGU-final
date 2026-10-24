import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit3,
  HelpCircle,
  FileCheck,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Sparkles,
  Layers,
  Truck,
  Building,
  Store,
  Clock,
  Send,
  Boxes
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PlanRun, AllocationLine, Product, Warehouse, Retailer } from '../types';
import { ReasonCardModal } from './ReasonCardModal';

interface PlanGeneratorViewProps {
  planRun: PlanRun | null;
  onGeneratePlan: (simulateTimeout?: boolean) => void;
  onApproveAll: () => void;
  onApproveLine: (lineId: string) => void;
  onOverrideLine: (lineId: string, newCases: number, reason: string) => void;
  onSimulateStaleConflict: () => void;
  onReplanStaleLines: () => void;
  products: Product[];
  warehouses: Warehouse[];
  retailers: Retailer[];
  isGenerating: boolean;
}

export const PlanGeneratorView: React.FC<PlanGeneratorViewProps> = ({
  planRun,
  onGeneratePlan,
  onApproveAll,
  onApproveLine,
  onOverrideLine,
  onSimulateStaleConflict,
  onReplanStaleLines,
  products,
  warehouses,
  retailers,
  isGenerating,
}) => {
  const [selectedReasonLine, setSelectedReasonLine] = useState<AllocationLine | null>(null);
  const [overrideModalLine, setOverrideModalLine] = useState<AllocationLine | null>(null);
  const [overrideCases, setOverrideCases] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideError, setOverrideError] = useState<string>('');

  const [filterWarehouse, setFilterWarehouse] = useState<string>('all');
  const [filterRetailer, setFilterRetailer] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleOpenOverride = (line: AllocationLine) => {
    setOverrideModalLine(line);
    setOverrideCases(line.cases);
    setOverrideReason('');
    setOverrideError('');
  };

  const handleSaveOverride = () => {
    if (!overrideReason.trim()) {
      setOverrideError('Mandatory planner override reason is required (FR-11).');
      return;
    }
    if (overrideCases <= 0) {
      setOverrideError('Cases must be greater than 0.');
      return;
    }
    if (overrideModalLine) {
      onOverrideLine(overrideModalLine.id, overrideCases, overrideReason);
      setOverrideModalLine(null);
    }
  };

  const handleApproveWithCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#10b981', '#38bdf8', '#fbbf24'],
    });
    onApproveAll();
  };

  const filteredLines = planRun?.lines.filter(line => {
    if (filterWarehouse !== 'all' && line.warehouseId !== filterWarehouse) return false;
    if (filterRetailer !== 'all' && line.retailerId !== filterRetailer) return false;
    if (filterStatus !== 'all' && line.status !== filterStatus) return false;
    return true;
  }) || [];

  const staleLines = planRun?.lines.filter(l => l.status === 'STALE') || [];
  const approvedLinesCount = planRun?.lines.filter(l => l.status === 'APPROVED').length || 0;

  return (
    <div className="space-y-6">
      {/* Top Action Console */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Cycle W43 Allocation Optimization Plan
            </h2>
            {planRun && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                planRun.solverStatus !== 'TIMEOUT'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {planRun.solverStatus} (Solved in {planRun.solveSeconds}s)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Greedy Marginal-Value Allocation • Value-Tier Objective • Hard Constraints: Zero Negative Stock, Shelf-Life on Arrival &ge; 70%, Kirana Storage Limit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => onGeneratePlan(false)}
            disabled={isGenerating}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Computing Allocation...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Generate Allocation Plan</span>
              </>
            )}
          </button>

          {planRun && planRun.lines.length > 0 && (
            <>
              <button
                onClick={handleApproveWithCelebration}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve All ({planRun.lines.length} Lines)</span>
              </button>

              <button
                onClick={onSimulateStaleConflict}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
                title="Test 409 conflict when warehouse inventory changes during planner review (FR-11, T9)"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Simulate 409 Conflict</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 409 Stale Warning Banner & Replan Button (FR-11, FR-11b) */}
      {staleLines.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-300">
                409 Snapshot Stale Conflict Detected ({staleLines.length} line affected)
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Warehouse inventory batch version changed during planner review (FR-11). Approval blocked for affected lines to prevent over-allocation.
              </p>
            </div>
          </div>
          <button
            onClick={onReplanStaleLines}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>1-Click Re-plan Stale Lines (FR-11b)</span>
          </button>
        </div>
      )}

      {/* Plan Metrics Overview Bar */}
      {planRun && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-xs text-slate-400">Total Cases Allocated</span>
            <p className="text-2xl font-black text-white mt-1">{planRun.totalCases} cases</p>
            <span className="text-[11px] text-emerald-400">
              {planRun.lines.reduce((acc, l) => acc + l.units, 0).toLocaleString()} consumer units
            </span>
          </div>

          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-xs text-slate-400">Total Route Freight</span>
            <p className="text-2xl font-black text-amber-300 mt-1">₹{planRun.totalFreightRupees.toLocaleString()}</p>
            <span className="text-[11px] text-slate-400">
              -13.8% savings vs Current Practice
            </span>
          </div>

          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-xs text-slate-400">Expected Gross Margin</span>
            <p className="text-2xl font-black text-emerald-400 mt-1">₹{planRun.expectedMarginRupees.toLocaleString()}</p>
            <span className="text-[11px] text-slate-400">Net after holding & lateness</span>
          </div>

          <div className="glass-panel p-4 rounded-xl border-slate-800">
            <span className="text-xs text-slate-400">Approval Progress</span>
            <p className="text-2xl font-black text-indigo-300 mt-1">
              {approvedLinesCount} / {planRun.lines.length}
            </p>
            <span className="text-[11px] text-slate-400">
              {approvedLinesCount === planRun.lines.length ? '100% Reserved' : 'Pending planner approval'}
            </span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">Filter Allocation Matrix:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={filterWarehouse}
            onChange={e => setFilterWarehouse(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <select
            value={filterRetailer}
            onChange={e => setFilterRetailer(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Retailers</option>
            {retailers.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.city})</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="PROPOSED">Proposed</option>
            <option value="APPROVED">Approved</option>
            <option value="OVERRIDDEN">Overridden</option>
            <option value="STALE">Stale (409)</option>
          </select>
        </div>
      </div>

      {/* Allocation Lines Table */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Warehouse Source</th>
                <th className="py-3 px-4">Kirana Retailer</th>
                <th className="py-3 px-4">Product SKU</th>
                <th className="py-3 px-4">Batch & Expiry</th>
                <th className="py-3 px-4 text-center">Cases (Units)</th>
                <th className="py-3 px-4 text-center">Arrival Shelf Life</th>
                <th className="py-3 px-4">Freight ₹</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Explain / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    {planRun ? 'No lines matching the selected filters.' : 'Click "Generate Plan" above to run the marginal allocation engine.'}
                  </td>
                </tr>
              ) : (
                filteredLines.map(line => {
                  const wh = warehouses.find(w => w.id === line.warehouseId);
                  const ret = retailers.find(r => r.id === line.retailerId);
                  const prod = products.find(p => p.sku === line.sku);

                  return (
                    <tr
                      key={line.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        line.status === 'STALE'
                          ? 'bg-amber-950/20'
                          : line.status === 'OVERRIDDEN'
                          ? 'bg-indigo-950/20'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{wh?.city} Hub</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{wh?.name}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-200">
                          <Store className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{ret?.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span>{ret?.city}</span>
                          <span>•</span>
                          <span className="uppercase text-indigo-400 font-semibold">Class {ret?.serviceClass}</span>
                          {ret?.storageCases && (
                            <span>(Cap: {ret.storageCases}cs)</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-200">{prod?.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{prod?.sku}</p>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                          {line.batchNo}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          ETA: {line.arrivalDate}
                        </p>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="font-extrabold text-sm text-white">
                          {line.cases} cs
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {line.units} units
                        </div>
                        {line.override && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-indigo-300 bg-indigo-500/20 px-1 rounded">
                            Overridden from {line.override.originalCases}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                          <span>{line.shelfLifeOnArrivalPct}%</span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5">&ge; 70% min</p>
                      </td>

                      <td className="py-3 px-4 font-semibold text-amber-300">
                        ₹{line.freightRupees}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {line.status === 'PROPOSED' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            PROPOSED
                          </span>
                        )}
                        {line.status === 'APPROVED' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            RESERVED
                          </span>
                        )}
                        {line.status === 'OVERRIDDEN' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            MODIFIED
                          </span>
                        )}
                        {line.status === 'STALE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            409 STALE
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedReasonLine(line)}
                            className="flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded border border-indigo-500/30 transition-colors"
                            title="Inspect explainable AI reasoning, marginal tiers and trade-offs"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Explain</span>
                          </button>

                          <button
                            onClick={() => handleOpenOverride(line)}
                            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                            title="Override quantity with mandatory justification (FR-11)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {line.status !== 'APPROVED' && line.status !== 'STALE' && (
                            <button
                              onClick={() => onApproveLine(line.id)}
                              className="p-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                              title="Approve and reserve stock atomically"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unmet Demand & Constraint Bound Log (FR-10, T1, T21) */}
      {planRun && planRun.unmet && planRun.unmet.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Unmet / Displaced Demand Diagnostics (Limiting Constraints)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {planRun.unmet.map((item, idx) => {
              const r = retailers.find(ret => ret.id === item.retailerId);
              const p = products.find(prod => prod.sku === item.sku);
              return (
                <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 text-[11px] font-bold">
                    !
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span>{r?.name}</span>
                      <span className="text-slate-500">•</span>
                      <span>{p?.name}</span>
                    </div>
                    <p className="text-[11px] text-amber-300/90 mt-0.5">
                      Unshipped: {item.unmetCases} cases ({item.unmetUnits} units)
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      <strong>Limiting Reason:</strong> {item.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reason Card Modal */}
      {selectedReasonLine && (
        <ReasonCardModal
          card={selectedReasonLine.explanation}
          onClose={() => setSelectedReasonLine(null)}
          onApproveLine={() => onApproveLine(selectedReasonLine.id)}
        />
      )}

      {/* Planner Override Modal */}
      {overrideModalLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Override Allocation Quantity</span>
              </h3>
              <button
                onClick={() => setOverrideModalLine(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Line: {products.find(p => p.sku === overrideModalLine.sku)?.name} to {retailers.find(r => r.id === overrideModalLine.retailerId)?.name}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                New Cases to Dispatch:
              </label>
              <input
                type="number"
                min={1}
                value={overrideCases}
                onChange={e => setOverrideCases(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Original recommendation: {overrideModalLine.cases} cases
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mandatory Planner Reason (FR-11):
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="e.g. Retailer reported upcoming Diwali festival special demand spike; distributor approved manual safety buffer."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {overrideError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/40">
                {overrideError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setOverrideModalLine(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition-all"
              >
                Commit Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
