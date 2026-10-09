import React from 'react';
import { DELAY_REASONS, DelayReason } from '../types';
import { AlertTriangle, Clock } from 'lucide-react';

interface DelayDropdownProps {
  value: DelayReason;
  onChange: (val: DelayReason) => void;
  otherRemarks?: string;
  onOtherRemarksChange?: (remarks: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  showIcon?: boolean;
}

export const DelayDropdown: React.FC<DelayDropdownProps> = ({
  value,
  onChange,
  otherRemarks = '',
  onOtherRemarksChange,
  label = 'Primary Delay / Hold Category *',
  required = false,
  className = '',
  showIcon = true,
}) => {
  const isDelay = value !== 'No Delay';

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-[#10418A] flex items-center gap-1.5">
          {showIcon && (
            isDelay ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
            )
          )}
          <span>{label}</span>
          {isDelay && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
              Delay Flagged
            </span>
          )}
        </label>
      )}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DelayReason)}
        required={required}
        className="w-full bg-white border-2 border-[#10418A]/40 focus:border-[#10418A] focus:ring-2 focus:ring-[#10418A]/20 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 transition-colors shadow-xs"
      >
        {DELAY_REASONS.map((reason) => (
          <option key={reason} value={reason} className="text-slate-800">
            {reason === 'No Delay' ? '🟢 No Delay (On Track)' : `⚠️ ${reason}`}
          </option>
        ))}
      </select>

      {/* When 'Other' is chosen, show mandatory specific remarks field */}
      {value === 'Other' && onOtherRemarksChange && (
        <div className="pt-1.5 space-y-1 animate-fadeIn">
          <label className="text-[11px] font-semibold text-amber-800 block">
            Specific Delay Remarks (Mandatory for 'Other') *
          </label>
          <input
            type="text"
            required
            value={otherRemarks}
            onChange={(e) => onOtherRemarksChange(e.target.value)}
            placeholder="Specify unique obstacle, technical challenge or client dependency..."
            className="w-full bg-white border-2 border-amber-500 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      )}
    </div>
  );
};
