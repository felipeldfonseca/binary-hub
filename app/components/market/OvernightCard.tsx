'use client';

import DimensionCard from './DimensionCard';
import type { OvernightContextDimension } from '@/types/market-analysis';

interface OvernightCardProps {
  data: OvernightContextDimension;
  delay?: number;
}

export default function OvernightCard({ data, delay = 0 }: OvernightCardProps) {
  const dataPoints = [
    { label: 'Prior Close', value: data.data.prior_close },
    { label: 'Current', value: data.data.current },
    { label: 'Gap', value: data.data.gap },
    { label: 'ON High', value: data.data.on_high },
    { label: 'ON Low', value: data.data.on_low },
    { label: 'ON Range', value: data.data.range },
  ];

  return (
    <DimensionCard dimension={data} delay={delay}>
      <p className="text-[13px] text-white/70 leading-relaxed mt-3">
        {data.narrative}
      </p>

      {/* Data grid */}
      <div className="grid grid-cols-3 gap-2 mt-3.5">
        {dataPoints.map((point, i) => (
          <div
            key={i}
            className="px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08]"
          >
            <div className="text-[9px] text-white/50 uppercase tracking-wider">
              {point.label}
            </div>
            <div className="text-sm font-semibold text-white mt-0.5">
              {point.value}
            </div>
          </div>
        ))}
      </div>
    </DimensionCard>
  );
}
