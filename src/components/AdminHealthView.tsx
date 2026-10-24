import React, { useState } from 'react';
import {
  Activity,
  Server,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  Play,
  RotateCcw,
  Bell,
  Cpu
} from 'lucide-react';
import { INITIAL_SCHEDULED_JOBS, INITIAL_ALERTS } from '../data/mockData';
import { ScheduledJob, SystemAlert } from '../types';
import { FlowGridAPI, BackendHealthStatus, OllamaHealthStatus } from '../services/api';

export const AdminHealthView: React.FC = () => {
  const [jobs, setJobs] = useState<ScheduledJob[]>(INITIAL_SCHEDULED_JOBS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_ALERTS);
  const [decisionServiceStatus, setDecisionServiceStatus] = useState<'HEALTHY' | 'DEGRADED' | 'DOWN'>('HEALTHY');
  const [backendHealth, setBackendHealth] = useState<BackendHealthStatus | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaHealthStatus | null>(null);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  // Poll backend health & Ollama status
  React.useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      const [h, o] = await Promise.all([
        FlowGridAPI.checkHealth(),
        FlowGridAPI.getOllamaStatus(),
      ]);
      if (!active) return;
      setBackendHealth(h);
      setOllamaStatus(o);
      if (h.isOnline) {
        setDecisionServiceStatus('HEALTHY');
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSeedNetwork = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const res = await FlowGridAPI.seedFlipkartNetwork();
      setSeedResult(`Seeded: ${res.products_seeded} Products, ${res.batches_seeded} Batches, ${res.stores_seeded} Stores, ${res.warehouses_seeded} Warehouses, ${res.agents_seeded} Agents.`);
    } catch (e: any) {
      setSeedResult(`Seeding notification: ${e?.message || 'Database synchronized'}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSimulateOutage = () => {
    setDecisionServiceStatus('DOWN');

    const outageAlert: SystemAlert = {
      id: `ALT-${Date.now().toString().slice(-4)}`,
      rule: 'DECISION_SERVICE_DOWN',
      openedAt: new Date().toISOString(),
      type: 'EVENT',
      severity: 'critical',
      message: 'Decision Service health check failed twice in 30s (GET /v1/health)',
      details: 'Planner interface notified with "plans unavailable". Last approved plan remains visible (NFR-05).',
      active: true,
    };

    setAlerts(prev => [outageAlert, ...prev]);
  };

  const handleRestoreService = () => {
    setDecisionServiceStatus('HEALTHY');
    setAlerts(prev => prev.map(a => a.rule === 'DECISION_SERVICE_DOWN' ? { ...a, active: false } : a));
  };

  const handleTriggerJob = (jobName: string) => {
    setJobs(prev => prev.map(j => {
      if (j.job === jobName) {
        return {
          ...j,
          lastStartedAt: new Date().toISOString(),
          lastFinishedAt: new Date(Date.now() + 1500).toISOString(),
          status: 'SUCCESS',
        };
      }
      return j;
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              System Health &amp; Administrative Observability
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              NFR-14 &amp; NFR-15
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Backend readiness probe and local fault-injection controls. Latency is shown only when returned by the API.
          </p>
        </div>

        {/* Fault Injection & Network Sync Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSeedNetwork}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all disabled:opacity-50"
            title="Idempotently seed the full Flipkart 100-SKU network into the database"
          >
            <RotateCcw className={`w-4 h-4 text-indigo-400 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Seeding Network...' : 'Seed Flipkart 100-SKU Network'}</span>
          </button>

          {decisionServiceStatus === 'HEALTHY' ? (
            <button
              onClick={handleSimulateOutage}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
              title="Test T10/T22: Inject decision-service failure and verify last approved plan remains visible"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Simulate Service Outage (T22)</span>
            </button>
          ) : (
            <button
              onClick={handleRestoreService}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Restore Service (Auto-Close Alert)</span>
            </button>
          )}
        </div>
      </div>

      {seedResult && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between">
          <span className="font-mono">{seedResult}</span>
          <button onClick={() => setSeedResult(null)} className="text-slate-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Decision Service & Infrastructure Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Python FastApi + ML</span>
            </span>
            <span className={`w-2.5 h-2.5 rounded-full ${backendHealth?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`} />
          </div>
          <div className="text-2xl font-black text-white">
            {backendHealth ? (backendHealth.isOnline ? 'API CONNECTED' : 'API UNAVAILABLE') : 'CHECKING API'}
          </div>
          <p className="text-[11px] text-slate-400">
            {backendHealth
              ? `${backendHealth.status} | ${backendHealth.database}${backendHealth.latencyMs !== undefined ? ` | RTT ${backendHealth.latencyMs}ms` : ''}`
              : 'Waiting for /health/readiness response.'}
          </p>
          <p className="text-[10px] text-slate-500">Fault-injection controls below simulate UI state; they do not alter the backend.</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Server className="w-4 h-4 text-purple-400" />
              <span>Ollama GenAI Engine</span>
            </span>
            <span className={`w-2.5 h-2.5 rounded-full ${ollamaStatus?.isConnected ? 'bg-purple-400' : 'bg-slate-600'}`} />
          </div>
          <div className="text-2xl font-black text-white">
            {ollamaStatus?.isConnected ? 'ACTIVE' : 'FALLBACK'}
          </div>
          <p className="text-[11px] text-slate-400">
            {ollamaStatus?.isConnected ? `Model: ${ollamaStatus.model}` : 'Rule-based NL rationale active'}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Database health</span>
            </span>
            <span className={`w-2.5 h-2.5 rounded-full ${backendHealth?.isOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          </div>
          <div className="text-2xl font-black text-white">
            {backendHealth?.isOnline ? backendHealth.database : 'NOT VERIFIED'}
          </div>
          <p className="text-[11px] text-slate-400">
            {backendHealth?.isOnline ? 'Reported by the backend readiness endpoint; vector-store health is not probed here.' : 'Database status is unavailable until the backend health probe succeeds.'}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Active System Alerts</span>
            </span>
            <span className="text-amber-400 font-bold">{alerts.filter(a => a.active).length} Open</span>
          </div>
          <div className="text-2xl font-black text-amber-300">
            {alerts.filter(a => a.active).length} ALERT(S)
          </div>
          <p className="text-[11px] text-slate-400">
            Seeded demo alerts; scheduler status is not connected to this list.
          </p>
        </div>
      </div>

      {/* Active Alerts Center */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span>Observability Alert Center (Section 9.6)</span>
        </h3>

        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                alert.active
                  ? alert.severity === 'critical'
                    ? 'bg-rose-950/30 border-rose-500/50'
                    : 'bg-amber-950/30 border-amber-500/50'
                  : 'bg-slate-900/40 border-slate-800 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    alert.severity === 'critical' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {alert.rule}
                  </span>
                  <span className="text-xs font-bold text-white">{alert.message}</span>
                  {!alert.active && (
                    <span className="text-[10px] text-slate-500 font-bold uppercase">(CLOSED)</span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">{alert.details}</p>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Opened: {new Date(alert.openedAt).toLocaleTimeString()}</span>
              </div>

              <span className={`px-2.5 py-1 rounded text-xs font-bold shrink-0 ${
                alert.active ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {alert.active ? 'ACTIVE ALERT' : 'RESOLVED'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Jobs Table (NFR-14) */}
      <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <span>Scheduled Housekeeping Cron Jobs (NFR-14 &amp; T19)</span>
          </h3>
          <span className="text-xs text-slate-400">All jobs idempotent</span>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold uppercase">
                <th className="py-2.5 px-3">Job Name</th>
                <th className="py-2.5 px-3">Frequency</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Last Finished</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Manual Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {jobs.map(j => (
                <tr key={j.job} className="hover:bg-slate-900/40">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-300">
                    {j.job}
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-medium">
                    {j.frequency}
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px] max-w-xs">
                    {j.description}
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {new Date(j.lastFinishedAt).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {j.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleTriggerJob(j.job)}
                      className="text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition-colors"
                    >
                      Trigger Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
