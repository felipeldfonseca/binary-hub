'use client';

import DimensionCard from './DimensionCard';
import VixGauge from './VixGauge';
import type { VolatilityRegimeDimension } from '@/types/market-analysis';

interface VolatilityCardProps {
  data: VolatilityRegimeDimension;
  delay?: number;
}

export default function VolatilityCard({ data, delay = 0 }: VolatilityCardProps) {
  const vixValue = parseFloat(data.data.vix) || 0;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Rising':
        return '▲';
      case 'Declining':
        return '▼';
      default:
        return '—';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'Declining':
        return '#E1FFD9'; // Declining VIX is good for trading
      case 'Rising':
        return '#FF4444'; // Rising VIX is cautionary
      default:
        return 'rgba(255, 255, 255, 0.5)';
    }
  };

  return (
    <DimensionCard dimension={data} delay={delay}>
      <p className="text-[13px] text-white/70 leading-relaxed mt-3">
        {data.narrative}
      </p>

      {/* VIX display */}
      <div
        className="flex items-center gap-5 mt-3.5 px-4 py-3 rounded-xl
                   bg-white/[0.03] border border-white/[0.08]"
      >
        <VixGauge value={vixValue} />
        <div className="flex-1">
          <div className="text-2xl font-bold text-white">{data.data.vix}</div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: getTrendColor(data.data.trend) }}
          >
            {getTrendIcon(data.data.trend)} {data.data.trend}
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">
            {data.data.regime}
          </div>
        </div>
      </div>
    </DimensionCard>
  );
}
