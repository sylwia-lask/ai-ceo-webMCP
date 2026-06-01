import { ACTIONS } from '../companyLogic';

interface ActionButtonsProps {
  onAction: (key: string) => void;
  disabled?: boolean;
}

const CATEGORY_STYLES: Record<string, string> = {
  growth: 'border-blue-700 bg-blue-950 text-blue-300 hover:bg-blue-900 hover:border-blue-500',
  risk: 'border-orange-700 bg-orange-950 text-orange-300 hover:bg-orange-900 hover:border-orange-500',
  hr: 'border-purple-700 bg-purple-950 text-purple-300 hover:bg-purple-900 hover:border-purple-500',
  ops: 'border-emerald-700 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 hover:border-emerald-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  growth: '📈 Growth',
  risk: '⚠️ Risk',
  hr: '👥 People',
  ops: '🔩 Operations',
};

export default function ActionButtons({ onAction, disabled }: ActionButtonsProps) {
  const grouped: Record<string, string[]> = {};
  for (const [key, def] of Object.entries(ACTIONS)) {
    if (!grouped[def.category]) grouped[def.category] = [];
    grouped[def.category].push(key);
  }

  return (
    <div className="flex flex-col gap-5">
      {Object.entries(grouped).map(([cat, keys]) => (
        <div key={cat}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            {CATEGORY_LABELS[cat]}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {keys.map((key) => {
              const def = ACTIONS[key];
              return (
                <button
                  key={key}
                  onClick={() => onAction(key)}
                  disabled={disabled}
                  title={def.description}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${CATEGORY_STYLES[def.category]}`}
                >
                  <span className="text-base w-5 flex-shrink-0">{def.emoji}</span>
                  <span>{def.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
