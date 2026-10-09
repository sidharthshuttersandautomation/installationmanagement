import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SiteProgressGaugeProps {
  progress: number;
  size?: number;
  label?: string;
  status?: string;
}

export const SiteProgressGauge: React.FC<SiteProgressGaugeProps> = ({
  progress,
  size = 140,
  label = 'Overall Site Progress',
  status,
}) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  const getColor = () => {
    if (progress >= 100) return '#00A859'; // brand emerald green
    if (progress >= 60) return '#10418A'; // brand deep navy
    if (progress >= 30) return '#1E5BB5'; // brand cobalt blue
    return '#D97706'; // warning amber
  };

  return (
    <div className="flex flex-col items-center justify-center p-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle - clean crisp light track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black font-mono text-[#10418A] tabular-nums">
            {progress}%
          </span>
          {status && (
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
              {status.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
      {label && <span className="text-xs font-bold text-[#10418A] mt-2">{label}</span>}
    </div>
  );
};

interface BudgetMeterProps {
  spent: number;
  allocated: number;
  compact?: boolean;
}

export const BudgetUtilizationMeter: React.FC<BudgetMeterProps> = ({
  spent,
  allocated,
  compact = false,
}) => {
  const safeAllocated = allocated || 1;
  const ratio = (spent / safeAllocated) * 100;
  const isOverBudget = spent > allocated;
  const isWarning = ratio >= 85 && !isOverBudget;

  const barColor = isOverBudget
    ? 'bg-rose-600'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-[#00A859]';

  if (compact) {
    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Budget Spent</span>
          <span className="font-mono font-bold tabular-nums text-slate-900">
            ${spent.toLocaleString()} / ${allocated.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300/40">
          <div
            className={`h-full ${barColor} transition-all duration-700`}
            style={{ width: `${Math.min(100, ratio)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold text-[#10418A] uppercase tracking-wide">
            Budget Utilization Meter
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono text-slate-900 tabular-nums">
              ${spent.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-semibold font-mono">
              of ${allocated.toLocaleString()} allowed
            </span>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
              isOverBudget
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isWarning
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {ratio.toFixed(1)}% Used
          </span>
        </div>
      </div>

      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200/80">
        <div
          className={`h-full ${barColor} transition-all duration-700`}
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600 pt-1.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5 font-medium">
          {isOverBudget ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#00A859] shrink-0" />
          )}
          <span className={isOverBudget ? 'text-rose-700 font-bold' : 'text-slate-700'}>
            {isOverBudget
              ? `Budget exceeded by $${(spent - allocated).toLocaleString()}`
              : `$${(allocated - spent).toLocaleString()} remaining headroom`}
          </span>
        </div>
        <span className="font-mono text-slate-500 font-bold">
          Variance: {(100 - ratio).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

interface DonutDistributionChartProps {
  total: number;
  inProgress: number;
  onHold: number;
  completed: number;
  upcoming: number;
}

export const DonutDistributionChart: React.FC<DonutDistributionChartProps> = ({
  total,
  inProgress,
  onHold,
  completed,
  upcoming,
}) => {
  const safeTotal = total || 1;
  const segments = [
    { label: 'In-Progress', count: inProgress, color: '#10418A' },
    { label: 'On Hold', count: onHold, color: '#D97706' },
    { label: 'Completed', count: completed, color: '#00A859' },
    { label: 'Upcoming', count: upcoming, color: '#1E5BB5' },
  ];

  let cumulativeAngle = 0;
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {segments.map((seg, idx) => {
            const pct = seg.count / safeTotal;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativeAngle * circumference;
            cumulativeAngle += pct;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-black font-mono text-[#10418A] tabular-nums">
            {total}
          </span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Sites
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs w-full max-w-xs">
        {segments.map((seg, idx) => {
          const pct = Math.round((seg.count / safeTotal) * 100);
          return (
            <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-slate-700 font-bold truncate">{seg.label}</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-slate-900 tabular-nums">
                  {seg.count}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
