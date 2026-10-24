import React, { useState } from 'react';
import {
  Building,
  Store,
  Calendar,
  HelpCircle,
  Edit3,
  CheckCircle2,
  Copy,
  Check,
  Truck,
  Boxes,
  ShieldAlert
} from 'lucide-react';
import { AllocationLine, Product, Warehouse, Retailer } from '../../types';
import { ShelfLifeIndicator } from './ShelfLifeIndicator';

interface PlanCardItemProps {
  line: AllocationLine;
  product?: Product;
  warehouse?: Warehouse;
  retailer?: Retailer;
  onExplain: (line: AllocationLine) => void;
  onEdit: (line: AllocationLine) => void;
  onApprove: (lineId: string) => void;
  isApproving?: boolean;
}

export const PlanCardItem: React.FC<PlanCardItemProps> = ({
  line,
  product,
  warehouse,
  retailer,
  onExplain,
  onEdit,
  onApprove,
  isApproving = false,
}) => {
  const [copiedSku, setCopiedSku] = useState(false);

  const handleCopySku = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(line.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

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
    <div
      className={`glass-panel p-4 rounded-xl border transition-all space-y-3 ${
        line.status === 'STALE'
          ? 'border-amber-500/40 bg-amber-950/20'
          : line.status === 'OVERRIDDEN'
          ? 'border-indigo-500/40 bg-indigo-950/20'
          : line.status === 'APPROVED'
          ? 'border-emerald-500/30'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Card Header: Route & Status */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>{warehouse?.city || line.warehouseId} Hub</span>
            <span className="text-slate-500">→</span>
            <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[150px]">{retailer?.name || line.retailerId}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>{retailer?.city}</span>
            <span>•</span>
            <span className="text-indigo-400 font-semibold uppercase">Class {retailer?.serviceClass}</span>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${statusConfig.className}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Product & SKU Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h4 className="text-xs font-bold text-white truncate" title={product?.name}>
            {product?.name || line.sku}
          </h4>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleCopySku}
              type="button"
              className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700/80 transition-colors whitespace-nowrap"
              title="Click to copy SKU code"
            >
              <span>{line.sku}</span>
              {copiedSku ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
            </button>
            <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 whitespace-nowrap">
              {line.batchNo}
            </span>
          </div>
        </div>

        {/* Shelf Life Gauge */}
        <div className="shrink-0 text-center">
          <ShelfLifeIndicator
            percentage={line.shelfLifeOnArrivalPct}
            minThresholdPct={retailer?.minShelfLifePct ? Math.round(retailer.minShelfLifePct * 100) : 70}
            daysRemaining={line.explanation?.shelfLifeDaysRemaining}
            compact
          />
        </div>
      </div>

      {/* Quantitative Details Grid */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-center">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Cases</span>
          <span className="text-xs font-bold text-white font-mono">{line.cases} cs</span>
          <span className="text-[9px] text-slate-500 block">({line.units} u)</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Route Freight</span>
          <span className="text-xs font-bold text-amber-300 font-mono">₹{line.freightRupees}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Arrival ETA</span>
          <span className="text-xs font-semibold text-slate-300 font-mono">{line.arrivalDate}</span>
        </div>
      </div>

      {/* Overridden Callout if present */}
      {line.override && (
        <div className="text-[10px] text-indigo-300 bg-indigo-950/40 p-1.5 rounded border border-indigo-800/40 flex items-center justify-between">
          <span>Overridden: {line.override.originalCases}cs → {line.override.newCases}cs</span>
          <span className="text-slate-400 truncate max-w-[140px] italic">"{line.override.reason}"</span>
        </div>
      )}

      {/* Card Actions Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => onExplain(line)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors"
          title="Inspect explainable AI reasoning and value tiers"
        >
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>Explain</span>
        </button>

        <button
          type="button"
          onClick={() => onEdit(line)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          title="Override quantity with mandatory justification"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>

        {line.status !== 'APPROVED' && line.status !== 'STALE' && (
          <button
            type="button"
            onClick={() => onApprove(line.id)}
            disabled={isApproving}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            title="Approve line and reserve stock atomically"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve</span>
          </button>
        )}
      </div>
    </div>
  );
};
