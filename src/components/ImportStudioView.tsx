import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Database,
  Hash,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Filter,
  Eye,
  Check,
  Layers,
  Lock
} from 'lucide-react';

interface ValidationError {
  row: number;
  field: string;
  message: string;
  isCritical?: boolean;
  value?: string;
}

interface ColumnMapping {
  csvHeader: string;
  targetField: string;
  dataType: string;
  isMapped: boolean;
}

export const ImportStudioView: React.FC = () => {
  const [selectedKind, setSelectedKind] = useState<string>('batches');
  const [sourceSystem, setSourceSystem] = useState<string>('SAP_WMS');
  const [sourceTrustTier, setSourceTrustTier] = useState<string>('TIER_1');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isQuarantineReviewed, setIsQuarantineReviewed] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  const [importResult, setImportResult] = useState<{
    importId: string;
    fileName: string;
    sha256: string;
    sourceSystem: string;
    trustTier: string;
    totalRows: number;
    rowsAccepted: number;
    rowsQuarantined: number;
    errorRatePct: number;
    status: 'CLEAN' | 'QUARANTINE_REVIEW' | 'PUBLICATION_BLOCKED';
    errors: ValidationError[];
  } | null>(null);

  const sampleDatasets = [
    { kind: 'batches', name: 'inventory_batches.csv', desc: 'Warehouse batch stock, shelf-life expiry dates, versions' },
    { kind: 'sales', name: 'sales_daily.csv', desc: '84 days historical daily sales per kirana store and SKU' },
    { kind: 'products', name: 'products.csv', desc: 'SKU definitions, case sizes, standard space units, perishable flags' },
    { kind: 'retailers', name: 'retailers.csv', desc: 'Kirana accounts, service class (A/B/C), min shelf-life %, storage limits' },
    { kind: 'routes', name: 'routes.csv', desc: 'Warehouse-to-retailer freight ₹/case and transit days' },
  ];

  const columnMappings: Record<string, ColumnMapping[]> = {
    batches: [
      { csvHeader: 'batch_number', targetField: 'batchNo', dataType: 'String (UUID/Code)', isMapped: true },
      { csvHeader: 'warehouse_id', targetField: 'warehouseId', dataType: 'Foreign Key (WH)', isMapped: true },
      { csvHeader: 'sku_code', targetField: 'sku', dataType: 'Foreign Key (Product)', isMapped: true },
      { csvHeader: 'qty_on_hand', targetField: 'qtyUnits', dataType: 'Integer (>= 0)', isMapped: true },
      { csvHeader: 'exp_date_iso', targetField: 'expiryDate', dataType: 'Date (YYYY-MM-DD)', isMapped: true },
    ],
    sales: [
      { csvHeader: 'txn_id', targetField: 'transactionId', dataType: 'Unique ID', isMapped: true },
      { csvHeader: 'store_id', targetField: 'retailerId', dataType: 'Foreign Key (Store)', isMapped: true },
      { csvHeader: 'sku', targetField: 'sku', dataType: 'Foreign Key (Product)', isMapped: true },
      { csvHeader: 'units_sold', targetField: 'unitsSold', dataType: 'Integer (> 0)', isMapped: true },
      { csvHeader: 'sale_timestamp', targetField: 'occurredAt', dataType: 'ISO DateTime', isMapped: true },
    ],
  };

  const handleSimulateCleanUpload = () => {
    setIsProcessing(true);
    setImportResult(null);
    setIsQuarantineReviewed(false);
    setIsPublished(false);

    setTimeout(() => {
      setIsProcessing(false);
      setImportResult({
        importId: `IMP-CLN-${Date.now().toString().slice(-5)}`,
        fileName: `${selectedKind}_verified_clean_v1.5.csv`,
        sha256: '9a3f4e18c2198031d77a88ef4101e40a793a52599201a4e12e753f20d52bc194',
        sourceSystem,
        trustTier: sourceTrustTier,
        totalRows: 240,
        rowsAccepted: 240,
        rowsQuarantined: 0,
        errorRatePct: 0.0,
        status: 'CLEAN',
        errors: [],
      });
    }, 450);
  };

  const handleSimulateQuarantineUpload = () => {
    setIsProcessing(true);
    setImportResult(null);
    setIsQuarantineReviewed(false);
    setIsPublished(false);

    setTimeout(() => {
      setIsProcessing(false);
      const totalRows = 200;
      const quarantined = 7; // 7 / 200 = 3.5% (<= 5% -> Quarantine Rule Activated)
      const accepted = totalRows - quarantined;
      const errorRate = (quarantined / totalRows) * 100;

      const sampleErrors: ValidationError[] = [
        { row: 14, field: 'expiryDate', message: 'Missing expiry date on perishable SKU', isCritical: true, value: 'NULL' },
        { row: 42, field: 'warehouseId', message: 'Foreign key lookup failed: Unknown WH "WH-GOA"', isCritical: false, value: 'WH-GOA' },
        { row: 89, field: 'qtyUnits', message: 'Invalid negative stock quantity (-24 units)', isCritical: true, value: '-24' },
        { row: 112, field: 'caseSize', message: 'Case size must be >= 1', isCritical: false, value: '0' },
        { row: 156, field: 'expiryDate', message: 'Batch expired before cycle start date', isCritical: true, value: '2026-09-01' },
        { row: 174, field: 'transactionId', message: 'Duplicate transaction ID detected', isCritical: true, value: 'TXN-9981' },
        { row: 184, field: 'sku', message: 'Unrecognized SKU barcode', isCritical: false, value: 'SKU-UNKNOWN' },
      ];

      setImportResult({
        importId: `IMP-QRN-${Date.now().toString().slice(-5)}`,
        fileName: `${selectedKind}_quarantine_test_v1.5.csv`,
        sha256: '8f7e2a91c530b420f18d73b64ecf001193d2581ad79e830e23b2c1450a8d42ef',
        sourceSystem,
        trustTier: sourceTrustTier,
        totalRows,
        rowsAccepted: accepted,
        rowsQuarantined: quarantined,
        errorRatePct: errorRate,
        status: 'QUARANTINE_REVIEW',
        errors: sampleErrors,
      });
    }, 550);
  };

  const handleSimulateBlockedUpload = () => {
    setIsProcessing(true);
    setImportResult(null);
    setIsQuarantineReviewed(false);
    setIsPublished(false);

    setTimeout(() => {
      setIsProcessing(false);
      const totalRows = 120;
      const quarantined = 16; // 16 / 120 = 13.3% (> 5% -> Publication Blocked)
      const errorRate = (quarantined / totalRows) * 100;

      const sampleErrors: ValidationError[] = [
        { row: 4, field: 'sku', message: 'Missing mandatory SKU code', isCritical: true },
        { row: 11, field: 'qtyUnits', message: 'Corrupt non-numeric quantity "NA"', isCritical: true },
        { row: 19, field: 'transactionId', message: 'Duplicate transaction ID', isCritical: true },
        { row: 28, field: 'warehouseId', message: 'Invalid facility code', isCritical: false },
        { row: 35, field: 'expiryDate', message: 'Invalid ISO date string format', isCritical: true },
        { row: 52, field: 'qtyUnits', message: 'Negative stock (-120 units)', isCritical: true },
        { row: 64, field: 'date', message: 'Corrupt row encoding', isCritical: true },
        { row: 78, field: 'retailerId', message: 'Foreign key mismatch', isCritical: false },
      ];

      setImportResult({
        importId: `IMP-BLK-${Date.now().toString().slice(-5)}`,
        fileName: 'corrupted_distributor_feed.csv',
        sha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        sourceSystem,
        trustTier: sourceTrustTier,
        totalRows,
        rowsAccepted: 0,
        rowsQuarantined: quarantined,
        errorRatePct: errorRate,
        status: 'PUBLICATION_BLOCKED',
        errors: sampleErrors,
      });
    }, 550);
  };

  const handlePublishCleanRows = () => {
    setIsPublished(true);
  };

  const activeMappings = columnMappings[selectedKind] || columnMappings.batches;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Data Import Studio — 5% Rule &amp; Schema Validation
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              5% Rule Enforced
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              Priya Sharma (Admin) &amp; Rohit (Planner)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            CSV upload, column schema mapping, and source information validation.
            If &gt;5% rows are invalid, publication is blocked. If &le;5% are invalid, bad rows are quarantined for review while clean rows can be committed.
          </p>
        </div>

        {/* Source System & Entity Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block px-1">Source System:</span>
            <select
              value={sourceSystem}
              onChange={e => setSourceSystem(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
            >
              <option value="SAP_WMS">WMS (SAP S/4HANA Pune)</option>
              <option value="DISTRIBUTOR_TALLY">Distributor ERP (TallyPrime)</option>
              <option value="FIELD_POS">Kirana Field POS Terminal</option>
              <option value="FLEET_TELEMETRY">Maharashtra Fleet GPS Telemetry</option>
            </select>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block px-1">Target Entity:</span>
            <select
              value={selectedKind}
              onChange={e => setSelectedKind(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white font-bold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
            >
              {sampleDatasets.map(d => (
                <option key={d.kind} value={d.kind}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 5% Rule Contract & Source Information Registry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>5% Rule Transactional Policy</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            • <strong>&le; 5% invalid</strong>: Quarantine bad rows for review; clean rows are publishable.<br />
            • <strong>&gt; 5% invalid</strong>: Publication blocked immediately; corrections required.<br />
            • <strong>Critical errors</strong>: Duplicate IDs &amp; negative stock are always rejected.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Source Trust Level: Tier-1 Authoritative</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Connected via <strong>{sourceSystem}</strong> with SHA-256 idempotency verification.
            Stock mutations and master imports are logged to immutable audit records.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
            <Hash className="w-4 h-4 text-cyan-400" />
            <span>Single Sales Path Deduplication</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Every counter sale, stock receipt, and GRN has a unique UUIDv4 token preventing double-counting during offline synchronization.
          </p>
        </div>
      </div>

      {/* Column Mapping Preview */}
      <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>CSV Column Mapping Contract ({selectedKind})</span>
          </h3>
          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> All {activeMappings.length} schema fields mapped
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Incoming CSV Header</th>
                <th className="py-2.5 px-3">Mapped Target Field</th>
                <th className="py-2.5 px-3">Data Type &amp; Constraint</th>
                <th className="py-2.5 px-3 text-right">Mapping Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {activeMappings.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 text-slate-300">
                  <td className="py-2 px-3 font-mono text-indigo-300">{m.csvHeader}</td>
                  <td className="py-2 px-3 font-mono text-cyan-300 flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span>{m.targetField}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-400">{m.dataType}</td>
                  <td className="py-2 px-3 text-right">
                    <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Auto-Matched ✓
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Drop Zone & Test Scenarios */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 border-dashed text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white">
            Upload CSV / XLSX Dataset for Validation
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Drag and drop data files or test the 3 rule thresholds below
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={handleSimulateCleanUpload}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Test Clean Batch (0% Errors &rarr; Ready to Publish)</span>
          </button>

          <button
            onClick={handleSimulateQuarantineUpload}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Demonstrate 3.5% row errors <= 5% rule where bad rows are quarantined"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Test 3.5% Row Errors (&le;5% &rarr; Quarantine Review)</span>
          </button>

          <button
            onClick={handleSimulateBlockedUpload}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Demonstrate 13.3% row errors > 5% rule where publication is blocked"
          >
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>Test 13.3% Row Errors (&gt;5% &rarr; Publication Blocked)</span>
          </button>
        </div>
      </div>

      {/* Validation Result Inspection */}
      {importResult && (
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-5 animate-in fade-in">
          {/* Status Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">{importResult.fileName}</span>
                <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  importResult.status === 'CLEAN'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : importResult.status === 'QUARANTINE_REVIEW'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {importResult.status === 'CLEAN'
                    ? 'CLEAN DATASET (VERIFIED)'
                    : importResult.status === 'QUARANTINE_REVIEW'
                    ? 'QUARANTINE REVIEW REQUIRED (≤5% ERROR)'
                    : 'PUBLICATION BLOCKED (>5% ERROR)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Batch ID: {importResult.importId} • SHA-256: {importResult.sha256.slice(0, 24)}...
              </p>
            </div>

            {/* Publication / Commitment Actions */}
            <div>
              {importResult.status === 'CLEAN' && !isPublished && (
                <button
                  type="button"
                  onClick={handlePublishCleanRows}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Publish All Clean Rows</span>
                </button>
              )}

              {importResult.status === 'QUARANTINE_REVIEW' && !isPublished && (
                <button
                  type="button"
                  onClick={handlePublishCleanRows}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Publish Verified Clean Rows ({importResult.rowsAccepted} rows)</span>
                </button>
              )}

              {importResult.status === 'PUBLICATION_BLOCKED' && (
                <span className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>Publication Locked: Request Source Correction</span>
                </span>
              )}

              {isPublished && (
                <span className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Published &amp; Committed to DB</span>
                </span>
              )}
            </div>
          </div>

          {/* Stats Quad */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Total Rows Processed</span>
              <p className="text-xl font-black text-white mt-0.5">{importResult.totalRows}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Clean / Valid Rows</span>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{importResult.rowsAccepted}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Quarantined / Rejected</span>
              <p className={`text-xl font-black mt-0.5 ${importResult.rowsQuarantined > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {importResult.rowsQuarantined}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Error Rate</span>
              <p className={`text-xl font-black mt-0.5 ${importResult.errorRatePct <= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                {importResult.errorRatePct.toFixed(1)}% {importResult.errorRatePct <= 5 ? '(≤ 5% Rule)' : '(> 5% Rule)'}
              </p>
            </div>
          </div>

          {/* Quarantined Records Table (if rows were quarantined) */}
          {importResult.errors.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Quarantined Records Review Table ({importResult.errors.length} bad rows)</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  Critical errors (duplicate IDs, invalid stock) cannot be published under any threshold
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Row #</th>
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Invalid Value</th>
                      <th className="py-2 px-3">Reason for Quarantine</th>
                      <th className="py-2 px-3">Severity</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {importResult.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 text-slate-300">
                        <td className="py-2 px-3 text-amber-400 font-bold">
                          Row {err.row}
                        </td>
                        <td className="py-2 px-3 text-indigo-300">
                          {err.field}
                        </td>
                        <td className="py-2 px-3 text-rose-300">
                          {err.value || 'N/A'}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-300">
                          {err.message}
                        </td>
                        <td className="py-2 px-3">
                          {err.isCritical ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              CRITICAL
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              WARNING
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => setIsQuarantineReviewed(true)}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                          >
                            Review &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
