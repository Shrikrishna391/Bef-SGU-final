import React, { useState, useMemo } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit3,
  HelpCircle,
  ShieldAlert,
  Boxes,
  Truck,
  Building,
  Store,
  Calendar,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  FilterX,
  X,
  Sparkles,
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PlanRun, AllocationLine, Product, Warehouse, Retailer } from '../types';
import { ReasonCardModal } from './ReasonCardModal';
import { ShelfLifeIndicator, normalizeShelfLifePct } from './plan/ShelfLifeIndicator';
import { PlanKpiCards } from './plan/PlanKpiCards';
import { PlanToolbar, PlanFilterState, SortOption, ShelfLifeFilter } from './plan/PlanToolbar';
import { PlanCardItem } from './plan/PlanCardItem';
import { ApproveAllModal } from './plan/ApproveAllModal';

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
  // Modals & Popovers
  const [selectedReasonLine, setSelectedReasonLine] = useState<AllocationLine | null>(null);
  const [overrideModalLine, setOverrideModalLine] = useState<AllocationLine | null>(null);
  const [overrideCases, setOverrideCases] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideError, setOverrideError] = useState<string>('');
  const [isApproveAllOpen, setIsApproveAllOpen] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [copiedSkuId, setCopiedSkuId] = useState<string | null>(null);
  const [approvingLineId, setApprovingLineId] = useState<string | null>(null);

  // Filter & Toolbar State
  const [filters, setFilters] = useState<PlanFilterState>({
    searchQuery: '',
    warehouseId: 'all',
    retailerId: 'all',
    status: 'all',
    shelfLifeRisk: 'all',
    sortBy: 'default',
    viewMode: 'table',
    pageSize: 10,
  });

  const [currentPage, setCurrentPage] = useState<number>(1);

  // Helper to show transient toast message
  const triggerFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => {
      setActionFeedback(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleFilterChange = (partial: Partial<PlanFilterState>) => {
    setFilters(prev => ({ ...prev, ...partial }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      warehouseId: 'all',
      retailerId: 'all',
      status: 'all',
      shelfLifeRisk: 'all',
      sortBy: 'default',
      viewMode: filters.viewMode,
      pageSize: filters.pageSize,
    });
    setCurrentPage(1);
    triggerFeedback('Search and filter criteria reset to default.');
  };

  // KPI Card direct click handler
  const handleKpiFilterClick = (filterType: 'all' | 'PROPOSED' | 'APPROVED' | 'urgent' | 'expiry') => {
    if (filterType === 'all') {
      handleResetFilters();
    } else if (filterType === 'PROPOSED' || filterType === 'APPROVED') {
      handleFilterChange({ status: filterType, shelfLifeRisk: 'all', searchQuery: '' });
    } else if (filterType === 'expiry') {
      handleFilterChange({ shelfLifeRisk: 'warning', status: 'all', searchQuery: '' });
    } else if (filterType === 'urgent') {
      handleFilterChange({ shelfLifeRisk: 'critical', status: 'all', searchQuery: '' });
    }
  };

  // SKU Copy Handler
  const handleCopySku = (sku: string, lineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sku);
    setCopiedSkuId(lineId);
    setTimeout(() => setCopiedSkuId(null), 2000);
  };

  // Override Modal Handlers
  const handleOpenOverride = (line: AllocationLine) => {
    setOverrideModalLine(line);
    setOverrideCases(line.cases);
    setOverrideReason(line.override?.reason || '');
    setOverrideError('');
  };

  const handleSaveOverride = () => {
    if (!overrideReason.trim()) {
      setOverrideError('Mandatory planner override justification is required (FR-11).');
      return;
    }
    if (overrideCases <= 0) {
      setOverrideError('Allocated cases must be greater than zero.');
      return;
    }
    if (overrideModalLine) {
      onOverrideLine(overrideModalLine.id, overrideCases, overrideReason);
      triggerFeedback(`Line ${overrideModalLine.id} quantity overridden to ${overrideCases} cases.`);
      setOverrideModalLine(null);
    }
  };

  // Single Line Approval Handler
  const handleApproveLineWithFeedback = async (lineId: string) => {
    setApprovingLineId(lineId);
    onApproveLine(lineId);
    setTimeout(() => {
      setApprovingLineId(null);
      triggerFeedback(`Allocation ${lineId} approved and stock reserved.`);
    }, 250);
  };

  // Bulk Approval Confirmation
  const handleConfirmApproveAll = () => {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#10b981', '#38bdf8', '#fbbf24'],
    });
    onApproveAll();
    setIsApproveAllOpen(false);
    triggerFeedback(`All ${planRun?.lines.length || 0} allocation lines approved and locked for dispatch.`);
  };

  // Multi-tier filtering & sorting
  const filteredAndSortedLines = useMemo(() => {
    if (!planRun) return [];
    let list = [...planRun.lines];

    // Search query
    const q = filters.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(line => {
        const prod = products.find(p => p.sku === line.sku);
        const wh = warehouses.find(w => w.id === line.warehouseId);
        const ret = retailers.find(r => r.id === line.retailerId);

        return (
          line.sku.toLowerCase().includes(q) ||
          line.id.toLowerCase().includes(q) ||
          line.batchNo.toLowerCase().includes(q) ||
          (prod?.name && prod.name.toLowerCase().includes(q)) ||
          (ret?.name && ret.name.toLowerCase().includes(q)) ||
          (ret?.city && ret.city.toLowerCase().includes(q)) ||
          (wh?.name && wh.name.toLowerCase().includes(q)) ||
          (wh?.city && wh.city.toLowerCase().includes(q))
        );
      });
    }

    // Warehouse filter
    if (filters.warehouseId !== 'all') {
      list = list.filter(line => line.warehouseId === filters.warehouseId);
    }

    // Retailer filter
    if (filters.retailerId !== 'all') {
      list = list.filter(line => line.retailerId === filters.retailerId);
    }

    // Status filter
    if (filters.status !== 'all') {
      list = list.filter(line => line.status === filters.status);
    }

    // Shelf Life filter
    if (filters.shelfLifeRisk !== 'all') {
      list = list.filter(line => {
        const pct = normalizeShelfLifePct(line.shelfLifeOnArrivalPct);
        if (filters.shelfLifeRisk === 'critical') return pct < 70;
        if (filters.shelfLifeRisk === 'warning') return pct >= 70 && pct < 75;
        if (filters.shelfLifeRisk === 'healthy') return pct >= 75;
        return true;
      });
    }

    // Sorting
    switch (filters.sortBy) {
      case 'freight_asc':
        list.sort((a, b) => a.freightRupees - b.freightRupees);
        break;
      case 'freight_desc':
        list.sort((a, b) => b.freightRupees - a.freightRupees);
        break;
      case 'cases_desc':
        list.sort((a, b) => b.cases - a.cases);
        break;
      case 'cases_asc':
        list.sort((a, b) => a.cases - b.cases);
        break;
      case 'shelf_life_asc':
        list.sort((a, b) => normalizeShelfLifePct(a.shelfLifeOnArrivalPct) - normalizeShelfLifePct(b.shelfLifeOnArrivalPct));
        break;
      case 'shelf_life_desc':
        list.sort((a, b) => normalizeShelfLifePct(b.shelfLifeOnArrivalPct) - normalizeShelfLifePct(a.shelfLifeOnArrivalPct));
        break;
      case 'product_asc':
        list.sort((a, b) => {
          const nameA = products.find(p => p.sku === a.sku)?.name || a.sku;
          const nameB = products.find(p => p.sku === b.sku)?.name || b.sku;
          return nameA.localeCompare(nameB);
        });
        break;
      case 'retailer_asc':
        list.sort((a, b) => {
          const nameA = retailers.find(r => r.id === a.retailerId)?.name || a.retailerId;
          const nameB = retailers.find(r => r.id === b.retailerId)?.name || b.retailerId;
          return nameA.localeCompare(nameB);
        });
        break;
      default:
        break;
    }

    return list;
  }, [planRun, filters, products, warehouses, retailers]);

  // Pagination slicing
  const totalFilteredCount = filteredAndSortedLines.length;
  const totalPages = Math.ceil(totalFilteredCount / filters.pageSize) || 1;
  const paginatedLines = useMemo(() => {
    const start = (currentPage - 1) * filters.pageSize;
    return filteredAndSortedLines.slice(start, start + filters.pageSize);
  }, [filteredAndSortedLines, currentPage, filters.pageSize]);

  const staleLines = planRun?.lines.filter(l => l.status === 'STALE') || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Action Console */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Boxes className="w-5 h-5 text-indigo-400" />
              <span>Distribution Allocation Matrix</span>
            </h2>
            {planRun && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono ${
                  planRun.solverStatus !== 'TIMEOUT'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {planRun.solverStatus} ({planRun.solveSeconds}s solver wall time)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Greedy Marginal-Value Allocation • Value-Tier Objective • Hard Constraints: Zero Negative Stock, Shelf-Life on Arrival &ge; 70%, Kirana Storage Limits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => onGeneratePlan(false)}
            disabled={isGenerating}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 select-none cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin text-white" />
                <span>Computing Optimizations...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Allocation Engine</span>
              </>
            )}
          </button>

          {planRun && planRun.lines.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setIsApproveAllOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/30 select-none cursor-pointer"
                title="Review and approve all recommended lines"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve All ({planRun.lines.length} Lines)</span>
              </button>

              <button
                type="button"
                onClick={onSimulateStaleConflict}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all select-none cursor-pointer"
                title="Simulate 409 conflict when warehouse inventory changes during planner review (FR-11, T9)"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Simulate 409 Conflict</span>
                <span className="sm:hidden">409 Test</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action Feedback Notification Banner */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-indigo-950/70 border border-indigo-500/40 flex items-center justify-between text-xs text-indigo-200 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 409 Stale Conflict Warning Banner (FR-11, FR-11b) */}
      {staleLines.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-300">
                409 Snapshot Conflict Detected ({staleLines.length} line affected)
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Warehouse inventory batch version changed during planner review (FR-11). Approval blocked for affected lines to prevent over-allocation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReplanStaleLines}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20 whitespace-nowrap select-none cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>1-Click Re-plan Stale Lines (FR-11b)</span>
          </button>
        </div>
      )}

      {/* Section 2: Dashboard Summary KPIs */}
      <PlanKpiCards planRun={planRun} onFilterClick={handleKpiFilterClick} />

      {/* Section 3: Toolbar with Search, Filters, and Sorting */}
      <PlanToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        warehouses={warehouses}
        retailers={retailers}
        totalResultsCount={planRun?.lines.length || 0}
        filteredCount={totalFilteredCount}
      />

      {/* Section 1 & 7: Allocation Table View vs Mobile Card Grid */}
      {isGenerating ? (
        // Loading Skeleton
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-3 text-indigo-400 font-semibold text-sm">
            <RotateCcw className="w-5 h-5 animate-spin" />
            <span>Optimizing multi-tier FMCG supply allocations across hubs...</span>
          </div>
          <div className="space-y-2 max-w-2xl mx-auto">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredAndSortedLines.length === 0 ? (
        // Empty Search / Filter State
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
            <FilterX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No allocations match your filters</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            We couldn't find any allocation lines matching your current search query or active filter criteria. Try adjusting or clearing filters.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all mt-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All Filters</span>
          </button>
        </div>
      ) : filters.viewMode === 'cards' ? (
        // Responsive Card Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginatedLines.map(line => {
            const wh = warehouses.find(w => w.id === line.warehouseId);
            const ret = retailers.find(r => r.id === line.retailerId);
            const prod = products.find(p => p.sku === line.sku);

            return (
              <PlanCardItem
                key={line.id}
                line={line}
                product={prod}
                warehouse={wh}
                retailer={ret}
                onExplain={setSelectedReasonLine}
                onEdit={handleOpenOverride}
                onApprove={handleApproveLineWithFeedback}
                isApproving={approvingLineId === line.id}
              />
            );
          })}
        </div>
      ) : (
        // High-Density Desktop Table View with Sticky Header & Non-Wrapping SKU
        <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 shadow-xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md text-slate-400 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-20 shadow-sm">
                  <th className="py-3.5 px-4 min-w-[160px]">Source Warehouse</th>
                  <th className="py-3.5 px-4 min-w-[210px]">Kirana Retailer</th>
                  <th className="py-3.5 px-4 min-w-[230px]">Product & SKU</th>
                  <th className="py-3.5 px-4 min-w-[150px]">Batch & ETA</th>
                  <th className="py-3.5 px-4 min-w-[120px] text-right">Cases (Units)</th>
                  <th className="py-3.5 px-4 min-w-[150px] text-center">Arrival Shelf Life</th>
                  <th className="py-3.5 px-4 min-w-[110px] text-right">Route Freight</th>
                  <th className="py-3.5 px-4 min-w-[120px] text-center">Status</th>
                  <th className="py-3.5 px-4 min-w-[180px] text-right sticky right-0 bg-slate-950/95 backdrop-blur-md">
                    Explain / Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {paginatedLines.map(line => {
                  const wh = warehouses.find(w => w.id === line.warehouseId);
                  const ret = retailers.find(r => r.id === line.retailerId);
                  const prod = products.find(p => p.sku === line.sku);

                  const statusMap: Record<string, { label: string; className: string }> = {
                    PROPOSED: {
                      label: 'PROPOSED',
                      className: 'bg-slate-800 text-slate-300 border-slate-700',
                    },
                    APPROVED: {
                      label: 'RESERVED',
                      className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                    },
                    OVERRIDDEN: {
                      label: 'MODIFIED',
                      className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                    },
                    STALE: {
                      label: '409 STALE',
                      className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
                    },
                    DISPATCHED: {
                      label: 'DISPATCHED',
                      className: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
                    },
                    CANCELLED: {
                      label: 'CANCELLED',
                      className: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                    },
                    EXPIRED: {
                      label: 'EXPIRED',
                      className: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                    },
                  };
                  const statusConfig = statusMap[line.status] || {
                    label: line.status,
                    className: 'bg-slate-800 text-slate-300 border-slate-700',
                  };

                  return (
                    <tr
                      key={line.id}
                      className={`hover:bg-slate-800/40 transition-colors group ${
                        line.status === 'STALE'
                          ? 'bg-amber-950/20'
                          : line.status === 'OVERRIDDEN'
                          ? 'bg-indigo-950/20'
                          : ''
                      }`}
                    >
                      {/* Warehouse Column */}
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                          <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{wh?.city || line.warehouseId} Hub</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate max-w-[150px]" title={wh?.name}>
                          {wh?.name || line.warehouseId}
                        </span>
                      </td>

                      {/* Retailer Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                          <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[190px]" title={ret?.name}>
                            {ret?.name || line.retailerId}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <span>{ret?.city}</span>
                          <span>•</span>
                          <span className="uppercase text-indigo-400 font-semibold font-mono">
                            Class {ret?.serviceClass}
                          </span>
                          {ret?.storageCases && (
                            <span className="text-slate-500 font-mono">(Cap: {ret.storageCases}cs)</span>
                          )}
                        </div>
                      </td>

                      {/* Product & SKU Column - Fix wrapping */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-100 truncate max-w-[210px]" title={prod?.name}>
                          {prod?.name || line.sku}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={e => handleCopySku(line.sku, line.id, e)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700/80 transition-colors whitespace-nowrap cursor-pointer select-all"
                            title="Click to copy SKU code"
                          >
                            <span>{line.sku}</span>
                            {copiedSkuId === line.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                            )}
                          </button>
                          {prod?.category && (
                            <span className="text-[10px] text-slate-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800/80 truncate max-w-[90px]">
                              {prod.category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Batch & ETA Column */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/80 whitespace-nowrap">
                          {line.batchNo}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                          <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="font-mono">ETA {line.arrivalDate}</span>
                        </div>
                      </td>

                      {/* Cases / Units Column - Right aligned */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-black text-sm text-white font-mono tabular-nums">
                          {line.cases} cs
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                          {line.units.toLocaleString()} units
                        </div>
                        {line.override && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-indigo-300 bg-indigo-500/20 px-1 rounded">
                            Overridden from {line.override.originalCases}
                          </span>
                        )}
                      </td>

                      {/* Shelf Life Column - Indicators & SLA Gauge */}
                      <td className="py-3.5 px-4 text-center">
                        <ShelfLifeIndicator
                          percentage={line.shelfLifeOnArrivalPct}
                          minThresholdPct={ret?.minShelfLifePct ? Math.round(ret.minShelfLifePct * 100) : 70}
                          daysRemaining={line.explanation?.shelfLifeDaysRemaining}
                        />
                      </td>

                      {/* Route Freight Column - Right aligned */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-sm text-amber-300 font-mono tabular-nums">
                          ₹{line.freightRupees.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                          ₹{line.cases > 0 ? Math.round(line.freightRupees / line.cases) : 0}/cs
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase font-mono ${statusConfig.className}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right sticky right-0 bg-slate-900/95 backdrop-blur-md">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Explain Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedReasonLine(line)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 transition-colors cursor-pointer"
                            title="Inspect explainable AI reasoning, value tiers and trade-offs"
                          >
                            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Explain</span>
                          </button>

                          {/* Override / Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenOverride(line)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Override allocation quantity with mandatory justification"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Approve Button */}
                          {line.status !== 'APPROVED' && line.status !== 'STALE' && (
                            <button
                              type="button"
                              onClick={() => handleApproveLineWithFeedback(line.id)}
                              disabled={approvingLineId === line.id}
                              className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 transition-colors cursor-pointer disabled:opacity-50"
                              title="Approve and reserve stock atomically"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination Controls */}
          <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={filters.pageSize}
                onChange={e => {
                  handleFilterChange({ pageSize: parseInt(e.target.value) || 10 });
                }}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[11px] text-slate-500 ml-2">
                Showing {(currentPage - 1) * filters.pageSize + 1}–
                {Math.min(currentPage * filters.pageSize, totalFilteredCount)} of {totalFilteredCount}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-slate-300 font-semibold">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unmet Demand & Constraint Bound Log (FR-10, T1, T21) */}
      {planRun && planRun.unmet && planRun.unmet.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
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
                      <span>{r?.name || item.retailerId}</span>
                      <span className="text-slate-500">•</span>
                      <span>{p?.name || item.sku}</span>
                    </div>
                    <p className="text-[11px] text-amber-300/90 mt-0.5">
                      Unshipped: <span className="font-mono font-bold">{item.unmetCases}</span> cases ({item.unmetUnits} units)
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

      {/* Reason Card Modal for Explainable AI Reasoning */}
      {selectedReasonLine && (
        <ReasonCardModal
          card={selectedReasonLine.explanation}
          onClose={() => setSelectedReasonLine(null)}
          onApproveLine={() => {
            handleApproveLineWithFeedback(selectedReasonLine.id);
            setSelectedReasonLine(null);
          }}
        />
      )}

      {/* Confirmation Modal for Bulk Approve All */}
      {planRun && (
        <ApproveAllModal
          isOpen={isApproveAllOpen}
          onClose={() => setIsApproveAllOpen(false)}
          onConfirm={handleConfirmApproveAll}
          planRun={planRun}
        />
      )}

      {/* Enhanced Planner Override Modal with Instant Validation & Presets */}
      {overrideModalLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Override Allocation Quantity</span>
              </h3>
              <button
                type="button"
                onClick={() => setOverrideModalLine(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <p className="text-xs font-bold text-white">
                {products.find(p => p.sku === overrideModalLine.sku)?.name || overrideModalLine.sku}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Destination: {retailers.find(r => r.id === overrideModalLine.retailerId)?.name}</span>
                <span className="font-mono text-indigo-400">{overrideModalLine.sku}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  New Cases to Dispatch:
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  = {overrideCases * (products.find(p => p.sku === overrideModalLine.sku)?.caseSize || 12)} units
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={overrideCases}
                  onChange={e => {
                    setOverrideCases(parseInt(e.target.value) || 0);
                    setOverrideError('');
                  }}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm font-mono focus:outline-none focus:border-indigo-500"
                />
                {/* Presets */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOverrideCases(c => Math.max(1, c - 1))}
                    className="px-2 py-1.5 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideCases(c => c + 1)}
                    className="px-2 py-1.5 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideCases(c => c + 5)}
                    className="px-2 py-1.5 text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                  >
                    +5
                  </button>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Original algorithm recommendation: <strong className="text-slate-200">{overrideModalLine.cases} cases</strong>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mandatory Planner Audit Reason (FR-11):
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={e => {
                  setOverrideReason(e.target.value);
                  setOverrideError('');
                }}
                placeholder="e.g. Retailer reported upcoming festival demand surge; branch manager authorized safety buffer."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {overrideError && (
              <p className="text-xs text-rose-300 bg-rose-950/60 p-2.5 rounded-xl border border-rose-800/60 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{overrideError}</span>
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setOverrideModalLine(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all cursor-pointer"
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
