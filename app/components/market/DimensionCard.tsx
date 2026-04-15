'use client';

import { ReactNode } from 'react';
import IndicatorBadge from './IndicatorBadge';
import type { BaseDimension } from '@/types/market-analysis';

interface DimensionCardProps {
  dimension: BaseDimension;
  children: ReactNode;
  delay?: number;
}

export default function DimensionCard({
  dimension,
  children,
  delay = 0,
}: DimensionCardProps) {
  return (
    <div
      className="p-5 rounded-2xl bg-white/5 border border-white/10
                 transition-all duration-500 hover:bg-white/[0.07]
                 animate-fade-in"
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-white">{dimension.title}</h3>
          <p className="text-[11px] text-white/50 mt-0.5">{dimension.subtitle}</p>
        </div>
        <IndicatorBadge
          label={dimension.indicator_label}
          type={dimension.indicator_type}
        />
      </div>

      {/* Content */}
      {children}

      {/* Bottom line */}
      <div
        className="mt-4 px-3.5 py-2.5 rounded-xl text-sm text-white/80 leading-relaxed"
        style={{
          background: 'rgba(225, 255, 217, 0.06)',
          borderLeft: '3px solid #E1FFD9',
        }}
      >
        {dimension.bottom_line}
      </div>
    </div>
  );
}
