'use client';

import DimensionCard from './DimensionCard';
import type { NewsSentimentDimension } from '@/types/market-analysis';

interface NewsCardProps {
  data: NewsSentimentDimension;
  delay?: number;
}

export default function NewsCard({ data, delay = 0 }: NewsCardProps) {
  return (
    <DimensionCard dimension={data} delay={delay}>
      <p className="text-[13px] text-white/70 leading-relaxed mt-3">
        {data.narrative}
      </p>

      {/* Headlines list */}
      <div className="flex flex-col gap-1.5 mt-3.5">
        {data.headlines.map((headline, i) => (
          <div
            key={i}
            className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08]"
          >
            <div className="text-xs text-white leading-relaxed">
              {headline.title}
            </div>
            <div className="text-[10px] text-white/50 mt-1">
              {headline.source} &bull; {headline.time}
            </div>
          </div>
        ))}
      </div>
    </DimensionCard>
  );
}
