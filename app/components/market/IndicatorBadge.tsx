'use client';

import { IndicatorType, getIndicatorColor } from '@/types/market-analysis';

interface IndicatorBadgeProps {
  label: string;
  type: IndicatorType;
}

export default function IndicatorBadge({ label, type }: IndicatorBadgeProps) {
  const colors = getIndicatorColor(type);

  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
      style={{
        backgroundColor: colors.bg,
        color: colors.fg,
      }}
    >
      {label}
    </span>
  );
}
