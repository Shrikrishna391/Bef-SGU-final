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
  Info,
  Sliders,
  ShieldCheck,
  Lock,
  Gauge,
  Compass,
  PackageCheck,
  FileText,
  Warehouse as WarehouseIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PlanRun, AllocationLine, Product, Warehouse, Retailer, UserRole, ThemeMode } from '../types';
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
  userRole?: UserRole;
  theme?: ThemeMode;
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
  userRole = 'rohit',
  theme = 'night',
}) => {
  // Planner Objective & Input Controls (Rohit Deshpande Scope)
  const [planningObjective, setPlanningObjective] = useState<'SERVICE_MARGIN' | 'MIN_FREIGHT' | 'RAPID_FEFO'>('SERVICE_MARGIN');
  const [serviceTargetPct, setServiceTargetPct] = useState<number>(95);
  const [planningHorizonDays, setPlanningHorizonDays] = useState<number>(14);
  const [routeRiskTolerance, setRouteRiskTolerance] = useState<number>(0.65);
  const [vehicleSelection, setVehicleSelection] = useState<string>('MIXED_FLEET');
  const [isPlannerControlsOpen, setIsPlannerControlsOpen] = useState<boolean>(false);

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
  const [isBriefingExpanded, setIsBriefingExpanded] = useState<boolean>(true);

  // Auto-sync toolbar filters when persona/user switches
  React.useEffect(() => {
    if (userRole === 'sunita') {
      setFilters(prev => ({ ...prev, warehouseId: 'WH-PUN', retailerId: 'all' }));
    } else if (userRole === 'ganesh') {
      setFilters(prev => ({ ...prev, retailerId: 'RET-GAN', warehouseId: 'all' }));
    } else {
      setFilters(prev => ({ ...prev, warehouseId: 'all', retailerId: 'all' }));
    }
    setCurrentPage(1);
  }, [userRole]);

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

  // PERSONA DATA SCOPING: Filter raw plan lines by persona authority
  const personaScopedLines = useMemo(() => {
    if (!planRun) return [];
    let list = [...planRun.lines];
    if (userRole === 'sunita') {
      // Sunita Deshmukh: Pune Hub (W-PUN / WH-PUN / WH-01) outbound lines
      list = list.filter(l =>
        l.warehouseId === 'WH-PUN' ||
        l.warehouseId === 'WH-01' ||
        l.warehouseId.toLowerCase().includes('pun') ||
        (l.explanation?.sourceWarehouseName && l.explanation.sourceWarehouseName.toLowerCase().includes('pune'))
      );
    } else if (userRole === 'ganesh') {
      // Ganesh Patil: Kolhapur store (STORE-MH-KOL-001 / RET-GAN / STORE-001) inbound lines
      list = list.filter(l =>
        l.retailerId === 'RET-GAN' ||
        l.retailerId === 'STORE-001' ||
        l.retailerId.toLowerCase().includes('kol') ||
        l.retailerId.toLowerCase().includes('gan') ||
        (l.explanation?.retailerName && l.explanation.retailerName.toLowerCase().includes('ganesh'))
      );
    }
    return list;
  }, [planRun, userRole]);

  // Dynamically scoped PlanRun for KPI Cards
  const scopedPlanRun = useMemo(() => {
    if (!planRun) return null;
    const totalCases = personaScopedLines.reduce((sum, l) => sum + (l.cases || 0), 0);
    const totalFreightRupees = personaScopedLines.reduce((sum, l) => sum + (l.freightRupees || 0), 0);
    return {
      ...planRun,
      lines: personaScopedLines,
      totalCases,
      totalFreightRupees,
    };
  }, [planRun, personaScopedLines]);

  // Multi-tier filtering & sorting
  const filteredAndSortedLines = useMemo(() => {
    let list = [...personaScopedLines];

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
  }, [personaScopedLines, filters, products, warehouses, retailers]);

  // Pagination slicing
  const totalFilteredCount = filteredAndSortedLines.length;
  const totalPages = Math.ceil(totalFilteredCount / filters.pageSize) || 1;
  const paginatedLines = useMemo(() => {
    const start = (currentPage - 1) * filters.pageSize;
    return filteredAndSortedLines.slice(start, start + filters.pageSize);
  }, [filteredAndSortedLines, currentPage, filters.pageSize]);

  const staleLines = personaScopedLines.filter(l => l.status === 'STALE');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Persona Scope Guardrail Banner */}
      {userRole === 'sunita' && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-emerald-300 text-sm">
                  Sunita Deshmukh — Warehouse Manager (Pune Hub W-PUN)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  PUNE DOCK SCOPE
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Showing {personaScopedLines.length} outbound allocation lines originating from Pune Central Logistics Hub. Non-Pune lines are hidden per role scope.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
            Dock Picking &amp; Dispatches Active
          </span>
        </div>
      )}

      {userRole === 'ganesh' && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-amber-300 text-sm">
                  Ganesh Patil — Kirana Store Owner (Kolhapur STORE-MH-KOL-001)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  KIRANA INBOUND SCOPE
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Showing {personaScopedLines.length} incoming allocations reserved for Ganesh Kirana &amp; General Store. Transaction data for other stores is restricted.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">
            Inbound Delivery Stream
          </span>
        </div>
      )}

      {userRole === 'rohit' && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-indigo-300 text-sm">
                  Rohit Deshpande — Distribution Planner (Statewide Planning)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                  STATEWIDE SCOPE
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Statewide multi-warehouse allocation matrix active across 3 hubs and 10 kirana stores ({personaScopedLines.length} total lines). Planning objectives and route-risk tolerances configurable below.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap">
            Optimization Engine Active
          </span>
        </div>
      )}

      {userRole === 'priya' && (
        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold text-sm">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-purple-300 text-sm">
                  Priya Sharma — System Administrator (Systemwide Governance)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                  ADMINISTRATIVE OVERVIEW
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Systemwide administrative inspection mode. All allocation overrides and security changes are recorded in the immutable audit log.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 whitespace-nowrap">
            Audit Trail Logging
          </span>
        </div>
      )}

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
                {planRun.solverStatus}{planRun.solveSeconds !== undefined
                  ? ` · ${(planRun.solveSeconds * 1000).toFixed(2)} ms local decision calculation`
                  : ' · timing not reported by API'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Greedy Marginal-Value Allocation • Value-Tier Objective • Hard Constraints: Zero Negative Stock, Shelf-Life on Arrival &ge; 70%, Kirana Storage Limits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {userRole === 'ganesh' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => triggerFeedback('✓ Inbound delivery order receipt acknowledged for Kolhapur Kirana (STORE-MH-KOL-001).')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs text-white bg-amber-600 hover:bg-amber-500 transition-all shadow-md shadow-amber-600/30 select-none cursor-pointer"
                title="Acknowledge incoming shipment from Pune Logistics Hub"
              >
                <PackageCheck className="w-4 h-4 text-white" />
                <span>Acknowledge Inbound Deliveries</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFeedback('✓ Rapid 24h restock request signaled to Pune Central Hub dispatcher.')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all select-none cursor-pointer"
                title="Request priority replenishment for store stockouts"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Request 24h Restock</span>
              </button>
            </div>
          ) : userRole === 'sunita' ? (
            <div className="flex flex-wrap items-center gap-2">
              {scopedPlanRun && scopedPlanRun.lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsApproveAllOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/30 select-none cursor-pointer"
                  title="Approve all Pune outbound lines for dock picking"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Pune Lines ({scopedPlanRun.lines.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => triggerFeedback('✓ Pune Hub FEFO stock reservations synchronized with active dock picking slips.')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all select-none cursor-pointer"
                title="Inspect Pune Hub stock status and dock picking"
              >
                <WarehouseIcon className="w-4 h-4 text-emerald-400" />
                <span>Sync Dock Batches</span>
              </button>
            </div>
          ) : (
            <>
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

              {scopedPlanRun && scopedPlanRun.lines.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsApproveAllOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/30 select-none cursor-pointer"
                    title="Review and approve recommended lines"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve All ({scopedPlanRun.lines.length} Lines)</span>
                  </button>

                  {userRole === 'rohit' ? (
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
                  ) : (
                    <button
                      type="button"
                      onClick={() => triggerFeedback('✓ Immutable statewide audit matrix exported to system log.')}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all select-none cursor-pointer"
                      title="Export Allocation Audit Log"
                    >
                      <FileText className="w-4 h-4 text-purple-400" />
                      <span>Audit Export</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Planner Objectives & Optimization Controls (Rohit Deshpande Scope) */}
      <div className={`p-5 rounded-2xl border transition-all ${
        theme === 'day' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-slate-800 shadow-xl'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Planning Objectives &amp; Optimization Parameters
              </span>
              <span className="text-xs text-slate-500">
                • Persona:{' '}
                <strong className={
                  userRole === 'sunita'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : userRole === 'ganesh'
                    ? 'text-amber-600 dark:text-amber-400'
                    : userRole === 'priya'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-indigo-600 dark:text-indigo-400'
                }>
                  {userRole === 'sunita'
                    ? 'Sunita Deshmukh (Pune Hub Dispatch Scope)'
                    : userRole === 'ganesh'
                    ? 'Ganesh Patil (Kolhapur Kirana Inbound Scope)'
                    : userRole === 'priya'
                    ? 'Priya Sharma (Systemwide Audit Scope)'
                    : 'Rohit Deshpande (Statewide Planning)'}
                </strong>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {userRole === 'ganesh' ? (
                <span>Inbound store replenishment focus for <strong>Ganesh Kirana (Kolhapur)</strong> • Hard Constraint: <strong>&ge;70% Shelf Life on Arrival</strong></span>
              ) : userRole === 'sunita' ? (
                <span>Outbound dispatch matrix for <strong>Pune Central Logistics Hub (W-PUN)</strong> • Hard Constraint: <strong>Strict FEFO Picking</strong></span>
              ) : (
                <span>Horizon: <strong>{planningHorizonDays} Days</strong> • Target Service Level: <strong>{serviceTargetPct}%</strong> • Route-Risk Tolerance: <strong>{routeRiskTolerance}</strong> • Fleet: <strong>{vehicleSelection === 'MIXED_FLEET' ? 'Mixed FMCG Commercial Fleet' : vehicleSelection}</strong></span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch lg:self-auto shrink-0">
            {userRole === 'ganesh' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>SLA: &ge;70% Fresh Shelf Life Guaranteed</span>
              </div>
            ) : userRole === 'sunita' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Dock Policy: Strict FEFO Picking</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsPlannerControlsOpen(!isPlannerControlsOpen)}
                className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  theme === 'day'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isPlannerControlsOpen ? 'Hide Parameters' : 'Adjust Objectives & Parameters'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isPlannerControlsOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Expandable Planner Controls Console (Rohit and Priya only) */}
        {isPlannerControlsOpen && (userRole === 'rohit' || userRole === 'priya') && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Objective Selector */}
              <div className={`p-3.5 rounded-xl border ${theme === 'day' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Optimization Objective
                </label>
                <select
                  value={planningObjective}
                  onChange={e => {
                    setPlanningObjective(e.target.value as any);
                    triggerFeedback(`Planning objective updated to: ${e.target.value}`);
                  }}
                  className={`w-full p-2 rounded-lg border text-xs font-semibold ${
                    theme === 'day' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  <option value="SERVICE_MARGIN">Maximize Service Level &amp; Margin</option>
                  <option value="MIN_FREIGHT">Minimize Direct Logistics Freight</option>
                  <option value="RAPID_FEFO">Aggressive FEFO Expiry Clearance</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">Value-Tier Greedy allocation priority</span>
              </div>

              {/* Service Target Slider */}
              <div className={`p-3.5 rounded-xl border ${theme === 'day' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Target Service Level</label>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{serviceTargetPct}%</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="99"
                  value={serviceTargetPct}
                  onChange={e => setServiceTargetPct(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>80% (Min)</span>
                  <span>95% (SLA Target)</span>
                  <span>99% (Peak)</span>
                </div>
              </div>

              {/* Planning Horizon Selector */}
              <div className={`p-3.5 rounded-xl border ${theme === 'day' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Planning Horizon (Days)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[7, 14, 21].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setPlanningHorizonDays(d);
                        triggerFeedback(`Planning horizon set to ${d} days.`);
                      }}
                      className={`py-1.5 rounded-lg font-bold text-xs transition-all ${
                        planningHorizonDays === d
                          ? theme === 'day' ? 'btn-navy text-white' : 'bg-indigo-600 text-white'
                          : theme === 'day' ? 'bg-white border border-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">FMCG replenishment cycle window</span>
              </div>

              {/* Route-Risk Tolerance */}
              <div className={`p-3.5 rounded-xl border ${theme === 'day' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Route-Risk Tolerance</label>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{routeRiskTolerance}</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="0.9"
                  step="0.05"
                  value={routeRiskTolerance}
                  onChange={e => setRouteRiskTolerance(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0.3 (Cautious)</span>
                  <span>0.65 (Medium Ghat)</span>
                  <span>0.9 (Direct)</span>
                </div>
              </div>
            </div>

            {/* Hard Constraints & Policy Authority Indicator */}
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs ${
              theme === 'day' ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-indigo-950/20 border-indigo-500/30 text-indigo-200'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Active Hard Constraints:</strong> Zero Negative Stock • Shelf-Life on Arrival &ge; 70% • Kirana Storage Limits • Vehicle Lane Width Clearance
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Planner Policy: Cannot silently edit warehouse batch stock</span>
              </div>
            </div>
          </div>
        )}
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
      <PlanKpiCards planRun={scopedPlanRun} onFilterClick={handleKpiFilterClick} />

      {/* AI Executive Briefing & Ollama Causal Driver Insights */}
      {planRun && (planRun.executiveDispatchBriefing || (planRun.keyFeatureInsights && planRun.keyFeatureInsights.length > 0)) && (
        <div className="glass-panel p-5 rounded-2xl border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Ollama Executive Dispatch Briefing &amp; Causal Intelligence
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Local LLM Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Synthesized trade-off rationales, inventory risk alerts, and causal drivers for warehouse managers
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsBriefingExpanded(!isBriefingExpanded)}
              className="text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{isBriefingExpanded ? 'Collapse' : 'Expand'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isBriefingExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {isBriefingExpanded && (
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              {planRun.executiveDispatchBriefing && (
                <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
                  {planRun.executiveDispatchBriefing}
                </div>
              )}

              {planRun.keyFeatureInsights && planRun.keyFeatureInsights.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Key Causal Drivers &amp; Critical Store Risks
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {planRun.keyFeatureInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-indigo-300">
                            {insight.store_id} • {insight.sku_id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            insight.risk_level === 'CRITICAL' || insight.urgency_rating === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {insight.risk_level || insight.urgency_rating || 'HIGH RISK'}
                          </span>
                        </div>
                        {insight.product_name && (
                          <div className="text-xs font-semibold text-white truncate">
                            {insight.product_name}
                          </div>
                        )}
                        {insight.causal_drivers && insight.causal_drivers.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {insight.causal_drivers.map((driver: string, dIdx: number) => (
                              <span
                                key={dIdx}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {driver}
                              </span>
                            ))}
                          </div>
                        )}
                        {insight.recommended_action && (
                          <p className="text-[11px] text-emerald-400 font-medium">
                            Action: {insight.recommended_action}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                userRole={userRole}
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

                          {userRole === 'ganesh' ? (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Truck className="w-3 h-3 text-amber-400" />
                              <span>Inbound</span>
                            </span>
                          ) : userRole === 'sunita' && line.warehouseId !== 'WH-PUN' && line.warehouseId !== 'WH-01' ? (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                              Non-Pune Hub
                            </span>
                          ) : (
                            <>
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
                            </>
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
