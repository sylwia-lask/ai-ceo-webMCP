import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompanyState, LogEntry } from './types';
import {
  INITIAL_STATE,
  executeAction,
  formatCash,
  getCompanyStatus,
} from './companyLogic';
import { registerWebMcpTools } from './webmcp';
import KpiCard from './components/KpiCard';
import ActionButtons from './components/ActionButtons';
import ActivityLog from './components/ActivityLog';
import SuggestedPrompts from './components/SuggestedPrompts';

const SESSION_KEY_STATE = 'aiceo_company';
const SESSION_KEY_LOG = 'aiceo_log';

function loadFromSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const STATUS_BADGE: Record<string, string> = {
  blue: 'bg-blue-900/60 text-blue-300 border-blue-700',
  green: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  yellow: 'bg-amber-900/60 text-amber-300 border-amber-700',
  orange: 'bg-orange-900/60 text-orange-300 border-orange-700',
  red: 'bg-red-900/60 text-red-300 border-red-700',
  purple: 'bg-purple-900/60 text-purple-300 border-purple-700',
};

export default function App() {
  const [company, setCompany] = useState<CompanyState>(() =>
    loadFromSession(SESSION_KEY_STATE, INITIAL_STATE),
  );
  const [log, setLog] = useState<LogEntry[]>(() =>
    loadFromSession(SESSION_KEY_LOG, []),
  );
  const [webMcpStatus, setWebMcpStatus] = useState<'loading' | 'active' | 'unavailable'>('loading');

  // Keep refs so WebMCP handlers always read current state without re-registering.
  const companyRef = useRef(company);
  companyRef.current = company;

  const dispatchRef = useRef<(key: string) => void>(() => {});

  // Persist to sessionStorage on every change.
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY_STATE, JSON.stringify(company));
  }, [company]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY_LOG, JSON.stringify(log));
  }, [log]);

  const handleAction = useCallback((key: string) => {
    setCompany((prev) => {
      const result = executeAction(prev, key);
      if (!result) return prev;
      setLog((l) => [...l, result.entry]);
      return result.newState;
    });
  }, []);

  dispatchRef.current = handleAction;

  const handleReset = useCallback(() => {
    setCompany(INITIAL_STATE);
    setLog([]);
    sessionStorage.removeItem(SESSION_KEY_STATE);
    sessionStorage.removeItem(SESSION_KEY_LOG);
  }, []);

  // Register WebMCP tools once on mount.
  // registerWebMcpTools always exposes tools (postMessage + window globals),
  // so it always resolves true — the badge always shows "tools exposed".
  useEffect(() => {
    registerWebMcpTools(
      () => companyRef.current,
      (key) => dispatchRef.current(key),
      handleReset,
    ).then((ok) => {
      setWebMcpStatus(ok ? 'active' : 'unavailable');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = getCompanyStatus(company);
  const statusBadgeClass = STATUS_BADGE[status.color];

  const kpis = [
    {
      label: 'Cash',
      value: formatCash(company.cash),
      icon: '💰',
      subtitle: company.cash < 1_000_000 ? '⚠️ Getting low!' : 'Available balance',
      accentClass: company.cash < 1_000_000 ? 'text-red-400' : 'text-emerald-400',
      bgClass: '',
    },
    {
      label: 'Monthly Revenue',
      value: formatCash(company.monthlyRevenue) + '/mo',
      icon: '📊',
      subtitle: company.monthlyRevenue < 0 ? '💸 Losing money' : 'ARR: ' + formatCash(company.monthlyRevenue * 12),
      accentClass: company.monthlyRevenue < 0 ? 'text-red-400' : 'text-blue-400',
      bgClass: '',
    },
    {
      label: 'Developers',
      value: String(company.developers),
      icon: '👨‍💻',
      subtitle: company.developers === 0 ? 'Just the CEO now' : `${company.developers} headcount`,
      accentClass: 'text-purple-400',
      bgClass: '',
    },
    {
      label: 'Employee Happiness',
      value: `${company.employeeHappiness}%`,
      icon: company.employeeHappiness > 60 ? '😊' : company.employeeHappiness > 30 ? '😐' : '😤',
      accentClass:
        company.employeeHappiness > 60
          ? 'text-amber-400'
          : company.employeeHappiness > 30
            ? 'text-amber-600'
            : 'text-red-400',
      bgClass: '',
      bar: company.employeeHappiness,
      barColor:
        company.employeeHappiness > 60
          ? 'bg-amber-400'
          : company.employeeHappiness > 30
            ? 'bg-amber-700'
            : 'bg-red-500',
    },
    {
      label: 'Technical Debt',
      value: `${company.technicalDebt}%`,
      icon: company.technicalDebt > 70 ? '💀' : company.technicalDebt > 40 ? '⚠️' : '✅',
      accentClass:
        company.technicalDebt > 70
          ? 'text-red-400'
          : company.technicalDebt > 40
            ? 'text-orange-400'
            : 'text-emerald-400',
      bgClass: '',
      bar: company.technicalDebt,
      barColor:
        company.technicalDebt > 70
          ? 'bg-red-500'
          : company.technicalDebt > 40
            ? 'bg-orange-500'
            : 'bg-emerald-500',
    },
    {
      label: 'Production Incidents',
      value: String(company.productionIncidents),
      icon: company.productionIncidents === 0 ? '🟢' : company.productionIncidents < 4 ? '🟡' : '🔴',
      subtitle:
        company.productionIncidents === 0
          ? 'All quiet'
          : `${company.productionIncidents} active issues`,
      accentClass:
        company.productionIncidents === 0
          ? 'text-emerald-400'
          : company.productionIncidents < 4
            ? 'text-amber-400'
            : 'text-red-400',
      bgClass: '',
    },
    {
      label: 'Hype Level',
      value: `${company.hypeLevel}%`,
      icon: company.hypeLevel > 70 ? '🚀' : company.hypeLevel > 40 ? '📣' : '😶',
      accentClass: 'text-pink-400',
      bgClass: '',
      bar: company.hypeLevel,
      barColor: 'bg-pink-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-screen-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤵</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">AI CEO Simulator</h1>
              <p className="text-xs text-gray-500">{company.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Company status */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              {status.label}
            </span>

            {/* WebMCP badge */}
            {webMcpStatus === 'loading' ? null : webMcpStatus === 'active' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-700 bg-green-900/60 px-3 py-1 text-xs font-semibold text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                WebMCP tools exposed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs font-semibold text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                WebMCP unavailable in this browser
              </span>
            )}

            <button
              onClick={handleReset}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-6 flex flex-col gap-6">
        {/* KPI grid */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Company Metrics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {kpis.map((kpi) => (
              <KpiCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                subtitle={kpi.subtitle}
                accentClass={kpi.accentClass}
                bgClass={kpi.bgClass}
                bar={kpi.bar}
                barColor={kpi.barColor}
              />
            ))}
          </div>
        </section>

        {/* Main panel */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Board Decisions */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 h-full">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                🏛️ Board Decisions
              </h2>
              <ActionButtons onAction={handleAction} />
            </div>
          </div>

          {/* Activity Log */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 min-h-96 flex flex-col">
              <ActivityLog entries={log} onClear={() => setLog([])} />
            </div>
          </div>
        </section>

        {/* Suggested prompts */}
        <section>
          <SuggestedPrompts />
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-600 pb-4">
          AI CEO Simulator · All decisions are equally fictitious and irresponsible ·
          <span className="ml-1">WebMCP API: {webMcpStatus}</span>
        </footer>
      </main>
    </div>
  );
}
