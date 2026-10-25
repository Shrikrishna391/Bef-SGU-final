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
  FileText,
  PlusCircle,
  X,
  Sparkles,
  ClipboardCheck,
  AlertCircle,
  Building2,
  Lock
} from 'lucide-react';
import { Warehouse, InventoryBatch, AllocationLine, Product, Retailer, UserRole, GoodsReceiptNote, ThemeMode } from '../types';
import { INITIAL_BATCHES } from '../data/mockData';

interface WarehouseOpsViewProps {
  warehouses: Warehouse[];
  batches: InventoryBatch[];
  approvedLines: AllocationLine[];
  products: Product[];
  retailers: Retailer[];
  onDispatchLine: (lineId: string) => void;
  onUpdateBatchCount: (batchId: string, countedUnits: number) => void;
  isOnline: boolean;
  userRole?: UserRole;
  theme?: ThemeMode;
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
  userRole = 'sunita',
  theme = 'night',
}) => {
  // Sunita Deshmukh scope is Pune Hub (W-PUN)
  const isSunita = userRole === 'sunita';
  const isAdmin = userRole === 'priya';
  const isPlanner = userRole === 'rohit';
  const isKirana = userRole === 'ganesh';
  const isDay = theme === 'day';

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('WH-PUN');

  React.useEffect(() => {
    if (userRole === 'sunita') {
      setSelectedWarehouseId('WH-PUN');
    }
  }, [userRole]);

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [countInput, setCountInput] = useState<number>(0);

  // GRN Modal State
  const [isGrnModalOpen, setIsGrnModalOpen] = useState<boolean>(false);
  const [grnList, setGrnList] = useState<GoodsReceiptNote[]>([
    {
      grnId: 'GRN-PUN-8821',
      warehouseId: 'WH-PUN',
      receivedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      supplierOrPlant: 'Amul Dairy Plant (Baramati Hub)',
      sku: 'SKU-AML-01',
      batchNo: 'LOT-AML-PUN-09',
      receivedQuantityUnits: 360,
      damagedQuantityUnits: 6,
      expiryDate: '2027-04-15',
      inspectorName: 'Sunita Deshmukh',
      status: 'VERIFIED',
      remarks: 'Cold-chain telemetry logged: 4.2°C compliant.',
    },
    {
      grnId: 'GRN-PUN-8819',
      warehouseId: 'WH-PUN',
      receivedAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
      supplierOrPlant: 'ITC Food Park (Ranjangaon Factory)',
      sku: 'SKU-ATT-05',
      batchNo: 'LOT-ITC-PUN-44',
      receivedQuantityUnits: 480,
      damagedQuantityUnits: 0,
      expiryDate: '2027-05-30',
      inspectorName: 'Sunita Deshmukh',
      status: 'VERIFIED',
      remarks: 'Moisture level 11.2% verified at bay.',
    },
  ]);

  const [newGrnSku, setNewGrnSku] = useState<string>(products[0]?.sku || 'SKU-AML-01');
  const [newGrnBatchNo, setNewGrnBatchNo] = useState<string>('LOT-PUN-NEW-01');
  const [newGrnSupplier, setNewGrnSupplier] = useState<string>('Amul Dairy Plant (Baramati Hub)');
  const [newGrnReceivedUnits, setNewGrnReceivedUnits] = useState<number>(240);
  const [newGrnDamagedUnits, setNewGrnDamagedUnits] = useState<number>(4);
  const [newGrnExpiryDate, setNewGrnExpiryDate] = useState<string>('2027-06-30');
  const [newGrnRemarks, setNewGrnRemarks] = useState<string>('Dock inspection verified.');

  // Reason-Coded Stock Adjustment State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [targetAdjustBatch, setTargetAdjustBatch] = useState<InventoryBatch | null>(null);
  const [adjustQtyDelta, setAdjustQtyDelta] = useState<number>(-12);
  const [adjustReasonCode, setAdjustReasonCode] = useState<string>('PHYSICAL_DAMAGE');
  const [adjustRemarks, setAdjustRemarks] = useState<string>('');
  const [permissionAlert, setPermissionAlert] = useState<string | null>(null);

  const isWarehouseMatch = (idA?: string, idB?: string) => {
    if (!idA || !idB) return false;
    if (idA === idB) return true;
    const norm = (id: string) => {
      const s = id.toLowerCase();
      if (s === 'wh-01' || s === 'wh-pun' || s.includes('pune')) return 'WH-PUN';
      if (s === 'wh-02' || s === 'wh-sat' || s.includes('satara')) return 'WH-SAT';
      if (s === 'wh-03' || s === 'wh-kol' || s.includes('kolhapur')) return 'WH-KOL';
      return id.toUpperCase();
    };
    return norm(idA) === norm(idB);
  };

  const selectedWarehouse = warehouses.find(w => isWarehouseMatch(w.id, selectedWarehouseId)) || warehouses[0] || {
    id: 'WH-PUN',
    name: 'Pune Central Logistics Hub (W-PUN)',
    city: 'Pune',
    capacityCasesPerCycle: 8500,
    utilizationCases: 4120,
    managerName: 'Sunita Deshmukh',
  };

  const effectiveBatches = batches && batches.length > 0 ? batches : INITIAL_BATCHES;
  const directMatches = effectiveBatches.filter(b => isWarehouseMatch(b.warehouseId, selectedWarehouseId));
  const whBatches = directMatches.length > 0 ? directMatches : INITIAL_BATCHES.filter(b => isWarehouseMatch(b.warehouseId, selectedWarehouseId));

  const whDispatchLines = approvedLines.filter(l => isWarehouseMatch(l.warehouseId, selectedWarehouseId) && (l.status === 'APPROVED' || l.status === 'PROPOSED'));

  const handleStartCount = (batch: InventoryBatch) => {
    // Check permission: Rohit (planner) cannot silently edit stock
    if (isPlanner) {
      setPermissionAlert(
        'Rohit Deshpande (Planner) cannot silently edit warehouse stock. Stock adjustments require Sunita Deshmukh (Warehouse Manager) or Admin approval with a reason code.'
      );
      return;
    }
    setEditingBatchId(batch.id);
    setCountInput(batch.qtyUnits);
  };

  const handleSaveCount = (batchId: string) => {
    onUpdateBatchCount(batchId, countInput);
    setEditingBatchId(null);
  };

  const handleOpenAdjustment = (batch: InventoryBatch) => {
    if (isPlanner) {
      setPermissionAlert(
        'Rohit Deshpande (Planner) cannot silently adjust warehouse stock. Stock adjustments require Sunita Deshmukh (Warehouse Manager) approval with a reason code.'
      );
      return;
    }
    setTargetAdjustBatch(batch);
    setAdjustQtyDelta(-12);
    setAdjustReasonCode('PHYSICAL_DAMAGE');
    setAdjustRemarks('Discovered 1 crushed carton during FEFO cycle inspection.');
    setIsAdjustmentModalOpen(true);
  };

  const handleConfirmAdjustment = () => {
    if (!targetAdjustBatch) return;
    const newQty = Math.max(0, targetAdjustBatch.qtyUnits + adjustQtyDelta);
    onUpdateBatchCount(targetAdjustBatch.id, newQty);
    setIsAdjustmentModalOpen(false);
    setTargetAdjustBatch(null);
  };

  const handleCreateGrn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSunita && !isAdmin) {
      setPermissionAlert('Goods Receipt Notes (GRN) can only be created by Sunita Deshmukh (Warehouse Manager - Pune Hub) or Admin.');
      return;
    }

    const newRecord: GoodsReceiptNote = {
      grnId: `GRN-PUN-${Date.now().toString().slice(-4)}`,
      warehouseId: selectedWarehouseId,
      receivedAt: new Date().toISOString(),
      supplierOrPlant: newGrnSupplier,
      sku: newGrnSku,
      batchNo: newGrnBatchNo,
      receivedQuantityUnits: newGrnReceivedUnits,
      damagedQuantityUnits: newGrnDamagedUnits,
      expiryDate: newGrnExpiryDate,
      inspectorName: isSunita ? 'Sunita Deshmukh (Warehouse Manager)' : 'Priya Sharma (Admin)',
      status: 'VERIFIED',
      remarks: newGrnRemarks,
    };

    setGrnList([newRecord, ...grnList]);
    setIsGrnModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Persona Scope Guardrail Banners */}
      {userRole === 'ganesh' && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-amber-300 text-sm">
                  Access Restricted: Ganesh Patil (Kirana Store Owner)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  READ-ONLY AUDIT
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Physical warehouse dock operations are restricted to warehouse managers. You can manage your store counter sales, product returns, and store stock in <strong>Kirana Field POS</strong>.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap">
            Warehouse Actions Disabled
          </span>
        </div>
      )}

      {userRole === 'sunita' && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-emerald-300 text-sm">
                  Active Scope: Sunita Deshmukh — Warehouse Manager (Pune Hub W-PUN)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  PUNE HUB DOCK AUTHORITY
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Full authority for physical batch inward (GRN), FEFO picking, dispatch confirmation, and reason-coded stock adjustments for Pune Hub.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
            Full Dock Control Active
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
                  Planner Audit Mode: Rohit Deshpande (Distribution Planner)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                  READ-ONLY AUDIT
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Viewing warehouse physical stock levels. Silent batch stock editing is blocked; dock adjustments must be executed by Sunita Deshmukh with reason codes.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap">
            Planner Audit View
          </span>
        </div>
      )}

      {/* Top Header */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
        isDay ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-slate-800 text-white'
      }`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`text-xl font-bold tracking-tight ${isDay ? 'text-[#0a192f]' : 'text-white'}`}>
              Warehouse Ops — FEFO Picking &amp; Receipt Console
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              FEFO Enforced
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
              Sunita Deshmukh (Scope: Pune Hub W-PUN)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Goods receipt (GRN), lot/batch tracking, expiry dates, physical stock counts, and picking.
            Stock adjustments are reason-coded and protected against silent planner edits.
          </p>
        </div>

        {/* Warehouse Selector & GRN Action */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl ${
            isDay ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <WarehouseIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <select
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
              className={`font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 border ${
                isDay ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-white'
              }`}
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.city}) {w.id === 'WH-PUN' ? '• Sunita Scope' : ''}
                </option>
              ))}
            </select>
          </div>

          {!isSunita && !isAdmin ? (
            <div className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Dock Audit Mode (Read-Only)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsGrnModalOpen(true)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 cursor-pointer ${
                isDay ? 'btn-navy shadow-indigo-900/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Goods Receipt (GRN)</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Scoping Notice Banner */}
      {selectedWarehouseId !== 'WH-PUN' && isSunita && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Scope Alert:</strong> Sunita Deshmukh's administrative scope is <strong>Pune Central Logistics Hub (W-PUN)</strong>. You are currently viewing {selectedWarehouse.name} in read-only audit mode.
          </span>
        </div>
      )}

      {/* Permission Block Alert (Rohit trying to adjust stock) */}
      {permissionAlert && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-white">Action Denied: Role Boundary Protection</p>
              <p className="text-rose-200 mt-0.5 leading-snug">{permissionAlert}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPermissionAlert(null)}
            className="text-rose-400 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Warehouse Capacity Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${
          isDay ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-slate-800'
        }`}>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Hub Cycle Capacity</span>
          <p className={`text-2xl font-black mt-1 ${isDay ? 'text-[#0a192f]' : 'text-white'}`}>
            {selectedWarehouse.capacityCasesPerCycle.toLocaleString()} cases
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Weekly dock throughput limit</span>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDay ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-slate-800'
        }`}>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ready to Dispatch (FEFO)</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {whDispatchLines.length} shipments
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {whDispatchLines.reduce((acc, l) => acc + l.cases, 0)} cases reserved
          </span>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDay ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-slate-800'
        }`}>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Physical Batches Held</span>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-300 mt-1">
            {whBatches.length} active lots
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">FEFO tracked with version control</span>
        </div>
      </div>

      {/* Picking & Dispatch List for Approved Lines */}
      <div className={`p-6 rounded-2xl border space-y-4 transition-all ${
        isDay ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className={`text-base font-bold ${isDay ? 'text-[#0a192f]' : 'text-white'}`}>
              Approved Dispatch Pick Slip ({selectedWarehouse.name})
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {whDispatchLines.length} lines waiting for truck load
          </span>
        </div>

        {whDispatchLines.length === 0 ? (
          <div className={`text-center py-8 text-xs rounded-xl border ${
            isDay ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-900/40 border-slate-800 text-slate-400'
          }`}>
            No pending dispatches for this warehouse. Approve allocation lines in the "Allocation Plan" tab first.
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${
            isDay ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'
          }`}>
            <table className="w-full text-left text-xs">
              <thead className={`font-semibold border-b ${
                isDay ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                <tr>
                  <th className="py-2.5 px-3">Shipment Line</th>
                  <th className="py-2.5 px-3">Destination Kirana</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Pick Lot (FEFO)</th>
                  <th className="py-2.5 px-3 text-center">Cases</th>
                  <th className="py-2.5 px-3 text-center">Units</th>
                  <th className="py-2.5 px-3 text-right">Dispatch Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-[11px] ${
                isDay ? 'divide-slate-200' : 'divide-slate-800/60'
              }`}>
                {whDispatchLines.map(line => {
                  const ret = retailers.find(r => r.id === line.retailerId);
                  const prod = products.find(p => p.sku === line.sku);
                  return (
                    <tr key={line.id} className={`${isDay ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-slate-900/40 text-slate-300'}`}>
                      <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-300 font-bold">{line.id}</td>
                      <td className={`py-2.5 px-3 font-medium ${isDay ? 'text-slate-900' : 'text-white'}`}>{ret?.name} ({ret?.city})</td>
                      <td className="py-2.5 px-3">{prod?.name}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold">{line.batchNo}</td>
                      <td className={`py-2.5 px-3 text-center font-bold ${isDay ? 'text-slate-900' : 'text-white'}`}>{line.cases} cs</td>
                      <td className="py-2.5 px-3 text-center font-mono">{line.units} u</td>
                      <td className="py-2.5 px-3 text-right">
                        {!isSunita && !isAdmin ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
                            Audit View
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDispatchLine(line.id)}
                            className="px-3 py-1 rounded-lg text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow cursor-pointer"
                          >
                            Confirm Dispatch
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warehouse Batches Physical Inventory & FEFO Stock Table */}
      <div className={`p-6 rounded-2xl border space-y-4 transition-all ${
        isDay ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h3 className={`text-base font-bold ${isDay ? 'text-[#0a192f]' : 'text-white'}`}>
              Physical Batch Inventory &amp; Expiry Details (FEFO Sorter)
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Stock mutations are reason-coded and versioned
          </span>
        </div>

        <div className={`rounded-xl border overflow-hidden ${
          isDay ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/60'
        }`}>
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-semibold uppercase text-[11px] ${
              isDay ? 'bg-slate-100 text-slate-700 border-slate-200' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}>
              <tr>
                <th className="py-2.5 px-3">Batch / Lot #</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Expiry Date (FEFO)</th>
                <th className="py-2.5 px-3 text-center">Physical Units</th>
                <th className="py-2.5 px-3 text-center">Reserved Units</th>
                <th className="py-2.5 px-3 text-center">Available Units</th>
                <th className="py-2.5 px-3 text-center">Version</th>
                <th className="py-2.5 px-3 text-right">Management</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-[11px] ${
              isDay ? 'divide-slate-200' : 'divide-slate-800/60'
            }`}>
              {whBatches.map(batch => {
                const prod = products.find(p => p.sku === batch.sku);
                const available = Math.max(0, batch.qtyUnits - batch.reservedUnits);
                const isEditing = editingBatchId === batch.id;

                return (
                  <tr key={batch.id} className={`${isDay ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-slate-900/40 text-slate-300'}`}>
                    <td className="py-2.5 px-3 font-mono text-indigo-600 dark:text-indigo-300 font-medium">
                      {batch.batchNo}
                    </td>
                    <td className={`py-2.5 px-3 font-medium ${isDay ? 'text-slate-900' : 'text-slate-200'}`}>
                      {prod?.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-300">
                      {batch.expiryDate}
                    </td>
                    <td className={`py-2.5 px-3 text-center font-bold ${isDay ? 'text-slate-900' : 'text-white'}`}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={countInput}
                          onChange={e => setCountInput(parseInt(e.target.value) || 0)}
                          className={`w-20 border rounded px-2 py-0.5 text-center ${
                            isDay ? 'bg-slate-100 border-indigo-400 text-slate-900' : 'bg-slate-800 border-indigo-500 text-white'
                          }`}
                        />
                      ) : (
                        `${batch.qtyUnits} u`
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-amber-400">
                      {batch.reservedUnits} u
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                      {available} u
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      v{batch.version}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {!isSunita && !isAdmin ? (
                        <div className="flex items-center justify-end">
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 font-mono">
                            Stock Locked ✓
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustment(batch)}
                            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 cursor-pointer"
                          >
                            Adjust (Reason)
                          </button>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveCount(batch.id)}
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBatchId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-[10px]"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartCount(batch)}
                              className="text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded cursor-pointer"
                            >
                              Count
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goods Receipt (GRN) History Table */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <span>Goods Receipt Notes (GRN) Inward Log</span>
          </h3>
          <span className="text-xs text-slate-400">Receipts recorded by Sunita Deshmukh</span>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">GRN #</th>
                <th className="py-2.5 px-3">Supplier / Plant</th>
                <th className="py-2.5 px-3">SKU &amp; Batch</th>
                <th className="py-2.5 px-3 text-center">Received Units</th>
                <th className="py-2.5 px-3 text-center">Damaged Units</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {grnList.map(grn => {
                const prod = products.find(p => p.sku === grn.sku);
                return (
                  <tr key={grn.grnId} className="hover:bg-slate-900/40 text-slate-300">
                    <td className="py-2.5 px-3 font-mono text-indigo-300 font-bold">{grn.grnId}</td>
                    <td className="py-2.5 px-3 text-white">{grn.supplierOrPlant}</td>
                    <td className="py-2.5 px-3">
                      <div>{prod?.name}</div>
                      <span className="font-mono text-[10px] text-slate-400">{grn.batchNo}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400">{grn.receivedQuantityUnits} u</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-400">{grn.damagedQuantityUnits} u</td>
                    <td className="py-2.5 px-3 font-mono">{grn.expiryDate}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {grn.status} ✓
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD GRN MODAL */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-950 border border-slate-800 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400">Goods Receipt Note</span>
                <h3 className="text-lg font-bold">Record Physical Goods Inward (GRN)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGrnModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Supplier / Manufacturing Plant:</label>
                <input
                  type="text"
                  value={newGrnSupplier}
                  onChange={e => setNewGrnSupplier(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Product SKU:</label>
                  <select
                    value={newGrnSku}
                    onChange={e => setNewGrnSku(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  >
                    {products.map(p => (
                      <option key={p.sku} value={p.sku}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Lot / Batch Number:</label>
                  <input
                    type="text"
                    value={newGrnBatchNo}
                    onChange={e => setNewGrnBatchNo(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Received Units:</label>
                  <input
                    type="number"
                    value={newGrnReceivedUnits}
                    onChange={e => setNewGrnReceivedUnits(parseInt(e.target.value) || 0)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Damaged Units:</label>
                  <input
                    type="number"
                    value={newGrnDamagedUnits}
                    onChange={e => setNewGrnDamagedUnits(parseInt(e.target.value) || 0)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-rose-400"
                    min="0"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Expiry Date:</label>
                  <input
                    type="date"
                    value={newGrnExpiryDate}
                    onChange={e => setNewGrnExpiryDate(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Inspector Remarks / Cold-Chain Temp:</label>
                <input
                  type="text"
                  value={newGrnRemarks}
                  onChange={e => setNewGrnRemarks(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow"
                >
                  Confirm &amp; Receive GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASON-CODED STOCK ADJUSTMENT MODAL */}
      {isAdjustmentModalOpen && targetAdjustBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-950 border border-slate-800 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400">Audit-Controlled Adjustment</span>
                <h3 className="text-lg font-bold">Reason-Coded Stock Adjustment</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Target Lot:</span>
                <div className="font-mono font-bold text-indigo-300 text-sm">{targetAdjustBatch.batchNo}</div>
                <div className="text-slate-300 mt-0.5">Current Stock: <strong>{targetAdjustBatch.qtyUnits} units</strong></div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Adjustment Delta (Units):</label>
                <input
                  type="number"
                  value={adjustQtyDelta}
                  onChange={e => setAdjustQtyDelta(parseInt(e.target.value) || 0)}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold"
                />
                <span className="text-[10px] text-slate-500">Negative value reduces stock; positive value increases stock.</span>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Mandatory Reason Code:</label>
                <select
                  value={adjustReasonCode}
                  onChange={e => setAdjustReasonCode(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold"
                >
                  <option value="PHYSICAL_DAMAGE">PHYSICAL_DAMAGE — Dented/Crushed carton</option>
                  <option value="EXPIRY_SPOILAGE">EXPIRY_SPOILAGE — FEFO shelf-life expired</option>
                  <option value="AUDIT_DISCREPANCY">AUDIT_DISCREPANCY — Physical count variance</option>
                  <option value="TRANSIT_SPILLAGE">TRANSIT_SPILLAGE — Damaged during unloading</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Reason Explanation &amp; Approval Notes:</label>
                <input
                  type="text"
                  value={adjustRemarks}
                  onChange={e => setAdjustRemarks(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  placeholder="e.g. Approved by Sunita Deshmukh following cycle count audit"
                  required
                />
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                Authorized by: <strong>Sunita Deshmukh (Pune Hub Manager)</strong> • Changes increment batch version from v{targetAdjustBatch.version} to v{targetAdjustBatch.version + 1}.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdjustment}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white shadow"
                >
                  Authorize Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
