import React, { useState } from 'react';
import {
  Warehouse as WarehouseIcon,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Send,
  Boxes,
  FileText
} from 'lucide-react';
import { Warehouse, InventoryBatch, AllocationLine, Product, Retailer } from '../types';

interface WarehouseOpsViewProps {
  warehouses: Warehouse[];
  batches: InventoryBatch[];
  approvedLines: AllocationLine[];
  products: Product[];
  retailers: Retailer[];
  onDispatchLine: (lineId: string) => void;
  onUpdateBatchCount: (batchId: string, countedUnits: number) => void;
  isOnline: boolean;
}

export const WarehouseOpsView: React.FC<WarehouseOpsViewProps> = ({
  warehouses,
  batches,
  approvedLines,
  products,
  retailers,
  onDispatchLine,
  onUpdateBatchCount,
  isOnline,
}) => {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('WH-PUN');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [countInput, setCountInput] = useState<number>(0);

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0];
  const whBatches = batches.filter(b => b.warehouseId === selectedWarehouseId);
  const whDispatchLines = approvedLines.filter(l => l.warehouseId === selectedWarehouseId && l.status === 'APPROVED');

  const handleStartCount = (batch: InventoryBatch) => {
    setEditingBatchId(batch.id);
    setCountInput(batch.qtyUnits);
  };

  const handleSaveCount = (batchId: string) => {
    onUpdateBatchCount(batchId, countInput);
    setEditingBatchId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Warehouse Picking &amp; Dispatch Console
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              J4 Sunita (Warehouse Mgr)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pick approved batches in FEFO order • Shift stock to in-transit • Record offline warehouse counts (Section 11.3 Rule 7)
          </p>
        </div>

        {/* Warehouse Selector */}
        <div className="flex items-center gap-2">
          <WarehouseIcon className="w-4 h-4 text-indigo-400" />
          <select
            value={selectedWarehouseId}
            onChange={e => setSelectedWarehouseId(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Warehouse Capacity Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border-slate-800">
          <span className="text-xs text-slate-400">Hub Cycle Capacity</span>
          <p className="text-2xl font-black text-white mt-1">
            {selectedWarehouse.capacityCasesPerCycle.toLocaleString()} cases
          </p>
          <span className="text-[11px] text-slate-400">Weekly dock throughput limit</span>
        </div>

        <div className="glass-panel p-4 rounded-xl border-slate-800">
          <span className="text-xs text-slate-400">Ready to Dispatch</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {whDispatchLines.length} shipments
          </p>
          <span className="text-[11px] text-slate-400">
            {whDispatchLines.reduce((acc, l) => acc + l.cases, 0)} cases reserved
          </span>
        </div>

        <div className="glass-panel p-4 rounded-xl border-slate-800">
          <span className="text-xs text-slate-400">Physical Batches Held</span>
          <p className="text-2xl font-black text-indigo-300 mt-1">
            {whBatches.length} active batches
          </p>
          <span className="text-[11px] text-slate-400">FEFO tracked with version control</span>
        </div>
      </div>

      {/* Picking & Dispatch List for Approved Lines */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              Approved Dispatch Pick Slip ({selectedWarehouse.name})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {whDispatchLines.length} lines waiting for truck load
          </span>
        </div>

        {whDispatchLines.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
            No pending dispatches for this warehouse. Approve allocation lines in the "Allocation Plan" tab first.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase">
                  <th className="py-2.5 px-3">Destination Kirana</th>
                  <th className="py-2.5 px-3">Product SKU</th>
                  <th className="py-2.5 px-3">Batch to Pick</th>
                  <th className="py-2.5 px-3 text-center">Cases (Units)</th>
                  <th className="py-2.5 px-3">Shelf Life Remaining</th>
                  <th className="py-2.5 px-3 text-right">Dispatch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {whDispatchLines.map(line => {
                  const ret = retailers.find(r => r.id === line.retailerId);
                  const prod = products.find(p => p.sku === line.sku);

                  return (
                    <tr key={line.id} className="hover:bg-slate-900/40">
                      <td className="py-3 px-3 font-medium text-slate-200">
                        {ret?.name} ({ret?.city})
                        <span className="block text-[10px] text-slate-500">Class {ret?.serviceClass} Kirana</span>
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {prod?.name}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          {line.batchNo}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-white">
                        {line.cases} cs ({line.units} units)
                      </td>

                      <td className="py-3 px-3 font-bold text-emerald-400">
                        {line.shelfLifeOnArrivalPct}% upon arrival
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onDispatchLine(line.id)}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all ml-auto"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Confirm Dispatch</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warehouse Physical Batches & Inventory Count (Offline-Capable) */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              Warehouse Batch Physical Inventory &amp; Stock Count
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Changes trigger batch version increment (Section 11.3)
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase">
                <th className="py-2.5 px-3">Batch Number</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3 text-center">Physical Units</th>
                <th className="py-2.5 px-3 text-center">Reserved Units</th>
                <th className="py-2.5 px-3 text-center">Available Units</th>
                <th className="py-2.5 px-3 text-center">Version</th>
                <th className="py-2.5 px-3 text-right">Count Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {whBatches.map(batch => {
                const prod = products.find(p => p.sku === batch.sku);
                const available = Math.max(0, batch.qtyUnits - batch.reservedUnits);
                const isEditing = editingBatchId === batch.id;

                return (
                  <tr key={batch.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-3 font-mono text-indigo-300 font-medium">
                      {batch.batchNo}
                    </td>

                    <td className="py-3 px-3 font-medium text-slate-200">
                      {prod?.name}
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      {batch.expiryDate}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-white">
                      {isEditing ? (
                        <input
                          type="number"
                          value={countInput}
                          onChange={e => setCountInput(parseInt(e.target.value) || 0)}
                          className="w-20 bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-center text-white"
                        />
                      ) : (
                        `${batch.qtyUnits} u`
                      )}
                    </td>

                    <td className="py-3 px-3 text-center font-semibold text-amber-400">
                      {batch.reservedUnits} u
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-emerald-400">
                      {available} u
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-slate-400">
                      v{batch.version}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSaveCount(batch.id)}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingBatchId(null)}
                            className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartCount(batch)}
                          className="text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition-colors"
                        >
                          Record Count
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
