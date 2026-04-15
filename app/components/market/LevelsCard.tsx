'use client';

import DimensionCard from './DimensionCard';
import type { KeyLevelsDimension } from '@/types/market-analysis';

interface LevelsCardProps {
  data: KeyLevelsDimension;
  delay?: number;
}

export default function LevelsCard({ data, delay = 0 }: LevelsCardProps) {
  const getLevelColor = (type: string) => {
    switch (type) {
      case 'resistance':
        return '#FF4444';
      case 'support':
        return '#E1FFD9';
      default:
        return 'rgba(255, 255, 255, 0.5)';
    }
  };

  return (
    <DimensionCard dimension={data} delay={delay}>
      <p className="text-[13px] text-white/70 leading-relaxed mt-3">
        {data.narrative}
      </p>

      {/* Levels list */}
      <div className="flex flex-col gap-1 mt-3.5">
        {data.levels.map((level, i) => {
          const color = getLevelColor(level.type);
          return (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-1.5 rounded-xl
                         bg-white/[0.03]"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <span className="text-xs text-white">{level.label}</span>
              <span
                className="text-[13px] font-semibold font-mono"
                style={{ color }}
              >
                {level.price}
              </span>
            </div>
          );
        })}
      </div>
    </DimensionCard>
  );
}
