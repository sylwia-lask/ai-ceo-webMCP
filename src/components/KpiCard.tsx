interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  subtitle?: string;
  accentClass: string;
  bgClass: string;
  bar?: number; // 0–100 for a progress bar
  barColor?: string;
}

export default function KpiCard({
  label,
  value,
  icon,
  subtitle,
  accentClass,
  bgClass,
  bar,
  barColor = 'bg-blue-500',
}: KpiCardProps) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <span className={`text-lg ${accentClass}`}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${accentClass}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
      {bar !== undefined && (
        <div className="mt-1">
          <div className="h-1.5 w-full rounded-full bg-gray-800">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${bgClass} ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
