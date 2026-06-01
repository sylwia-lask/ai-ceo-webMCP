import type { LogEntry } from '../types';
import { formatDelta } from '../companyLogic';

interface ActivityLogProps {
  entries: LogEntry[];
  onClear: () => void;
}

const DELTA_META: Record<string, { label: string; goodWhenPositive: boolean }> = {
  cash: { label: 'Cash', goodWhenPositive: true },
  monthlyRevenue: { label: 'Revenue', goodWhenPositive: true },
  developers: { label: 'Devs', goodWhenPositive: true },
  employeeHappiness: { label: 'Happiness', goodWhenPositive: true },
  technicalDebt: { label: 'Tech Debt', goodWhenPositive: false },
  productionIncidents: { label: 'Incidents', goodWhenPositive: false },
  hypeLevel: { label: 'Hype', goodWhenPositive: true },
};

function DeltaChip({ metricKey, value }: { metricKey: string; value: number }) {
  const meta = DELTA_META[metricKey];
  if (!meta || value === 0) return null;
  const isGood = meta.goodWhenPositive ? value > 0 : value < 0;
  const colorClass = isGood
    ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
    : 'bg-red-900/60 text-red-300 border-red-700';
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono border ${colorClass}`}
    >
      {meta.label} {formatDelta(metricKey, value)}
    </span>
  );
}

export default function ActivityLog({ entries, onClear }: ActivityLogProps) {
  const reversed = [...entries].reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Activity Log
        </h2>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {reversed.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-600 text-sm gap-2 py-12">
          <span className="text-3xl">📋</span>
          <span>No board decisions yet.</span>
          <span>Make a bold move.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
          {reversed.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">{entry.label}</span>
                <span className="text-xs text-gray-600 font-mono flex-shrink-0">{entry.timestamp}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{entry.message}</p>
              {Object.keys(entry.changes).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {Object.entries(entry.changes).map(([k, v]) =>
                    v !== undefined ? (
                      <DeltaChip key={k} metricKey={k} value={v} />
                    ) : null,
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
