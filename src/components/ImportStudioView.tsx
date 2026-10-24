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
  Sparkles
} from 'lucide-react';

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export const ImportStudioView: React.FC = () => {
  const [selectedKind, setSelectedKind] = useState<string>('batches');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{
    importId: string;
    fileName: string;
    sha256: string;
    totalRows: number;
    rowsAccepted: number;
    rowsRejected: number;
    errorRatePct: number;
    committed: boolean;
    errors: ValidationError[];
  } | null>(null);

  const sampleDatasets = [
    { kind: 'batches', name: 'inventory_batches.csv', desc: 'Warehouse batch stock, shelf-life expiry dates, versions' },
    { kind: 'sales', name: 'sales_daily.csv', desc: '84 days historical daily sales per kirana store and SKU' },
    { kind: 'products', name: 'products.csv', desc: 'SKU definitions, case sizes, standard space units, perishable flags' },
    { kind: 'retailers', name: 'retailers.csv', desc: 'Kirana accounts, service class (A/B/C), min shelf-life %, storage limits' },
    { kind: 'routes', name: 'routes.csv', desc: 'Warehouse-to-retailer freight ₹/case and transit days' },
  ];

  const handleSimulateUpload = (withErrors: boolean) => {
    setIsProcessing(true);
    setImportResult(null);

    setTimeout(() => {
      setIsProcessing(false);
      const totalRows = 200;
      const rejected = withErrors ? 6 : 0; // 6 / 200 = 3% (<= 5% -> Committed!)
      const accepted = totalRows - rejected;
      const errorRate = (rejected / totalRows) * 100;

      const sampleErrors: ValidationError[] = withErrors
        ? [
            { row: 14, field: 'expiryDate', message: 'Missing expiry date on perishable FMCG SKU' },
            { row: 42, field: 'warehouseId', message: 'Foreign key lookup failed: Unknown WH ID "WH-MUM"' },
            { row: 89, field: 'qtyUnits', message: 'Negative inventory count rejected (-24 units)' },
            { row: 112, field: 'caseSize', message: 'Case size must be >= 1' },
            { row: 156, field: 'expiryDate', message: 'Batch expired before cycle start date' },
            { row: 184, field: 'sku', message: 'Duplicate batch number on same warehouse' },
          ]
        : [];

      setImportResult({
        importId: `IMP-${Date.now().toString().slice(-6)}`,
        fileName: `${selectedKind}_demo_v1.5.csv`,
        sha256: '8f7e2a91c530b420f18d73b64ecf001193d2581ad79e830e23b2c1450a8d42ef',
        totalRows,
        rowsAccepted: accepted,
        rowsRejected: rejected,
        errorRatePct: errorRate,
        committed: errorRate <= 5,
        errors: sampleErrors,
      });
    }, 600);
  };

  const handleSimulateCatastrophicUpload = () => {
    setIsProcessing(true);
    setImportResult(null);

    setTimeout(() => {
      setIsProcessing(false);
      const totalRows = 100;
      const rejected = 18; // 18% (> 5% -> Transaction Rolled Back!)

      const sampleErrors: ValidationError[] = [
        { row: 3, field: 'date', message: 'Invalid ISO date string format' },
        { row: 7, field: 'retailerId', message: 'Foreign key mismatch' },
        { row: 12, field: 'unitsSold', message: 'Negative sales quantity not permitted' },
        { row: 25, field: 'sku', message: 'Unknown SKU code' },
        { row: 31, field: 'date', message: 'Corrupt row encoding' },
      ];

      setImportResult({
        importId: `IMP-REJECTED-${Date.now().toString().slice(-4)}`,
        fileName: 'corrupted_sales_import.csv',
        sha256: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        totalRows,
        rowsAccepted: 0,
        rowsRejected: rejected,
        errorRatePct: 18.0,
        committed: false,
        errors: sampleErrors,
      });
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Master Data &amp; Batch Inventory Import Studio
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">
              J1 Priya &amp; Rohit
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            CSV/XLSX schema verification • Single Sales Path deduplication • 5% Error Threshold Transactional Rule (FR-02)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Target Entity:</span>
          <select
            value={selectedKind}
            onChange={e => setSelectedKind(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            {sampleDatasets.map(d => (
              <option key={d.kind} value={d.kind}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 5% Threshold Rule Explanation Box */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-white">
            Transactional Data Integrity Guarantee (J1 Step 3 &amp; FR-02)
          </h4>
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            If <strong>&le; 5%</strong> of rows fail validation, the valid rows are committed in one transaction and rejected rows are flagged with file:row diagnostics. If <strong>&gt; 5%</strong> fail, nothing is committed—preventing half-updated stock states from corrupting planning runs.
          </p>
        </div>
      </div>

      {/* Drop Zone & Test Scenarios */}
      <div className="glass-panel p-8 rounded-2xl border-slate-800 border-dashed text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white">
            Upload Master Data or Inventory Batches
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Drag and drop CSV or XLSX files (max 10MB) or run a demo scenario below
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => handleSimulateUpload(false)}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Clean Demo Dataset (100% Valid)</span>
          </button>

          <button
            onClick={() => handleSimulateUpload(true)}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1.5"
            title="Demonstrate <= 5% error rule where valid rows commit and 6 errors are reported"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Test 3% Row Errors (Valid Rows Commit)</span>
          </button>

          <button
            onClick={handleSimulateCatastrophicUpload}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1.5"
            title="Demonstrate > 5% error rule where entire file is rolled back"
          >
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>Test 18% Errors (Entire File Rejected)</span>
          </button>
        </div>
      </div>

      {/* Validation Result Inspection */}
      {importResult && (
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">{importResult.fileName}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  importResult.committed
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {importResult.committed ? 'TRANSACTION COMMITTED' : 'IMPORT ROLLED BACK'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                SHA-256: {importResult.sha256}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400">Import Batch ID:</span>
              <span className="block font-mono text-xs font-bold text-indigo-400">{importResult.importId}</span>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Total Rows Processed</span>
              <p className="text-lg font-bold text-white mt-0.5">{importResult.totalRows}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Valid Rows Committed</span>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{importResult.rowsAccepted}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Rejected Rows</span>
              <p className="text-lg font-bold text-rose-400 mt-0.5">{importResult.rowsRejected}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Error Rate</span>
              <p className={`text-lg font-bold mt-0.5 ${importResult.errorRatePct <= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                {importResult.errorRatePct.toFixed(1)}% {importResult.errorRatePct <= 5 ? '(≤ 5% Limit)' : '(> 5% Limit)'}
              </p>
            </div>
          </div>

          {/* Error Diagnostics Table */}
          {importResult.errors.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Row-Level Diagnostics (file:row)</span>
              </h4>

              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3">Target Field</th>
                      <th className="py-2 px-3">Validation Rule Broken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {importResult.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 text-slate-300">
                        <td className="py-2 px-3 text-amber-400">
                          {importResult.fileName}:{err.row}
                        </td>
                        <td className="py-2 px-3 text-indigo-300">
                          {err.field}
                        </td>
                        <td className="py-2 px-3 text-rose-300 font-sans">
                          {err.message}
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
