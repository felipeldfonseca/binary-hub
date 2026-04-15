'use client';

import DimensionCard from './DimensionCard';
import type { MacroContextDimension } from '@/types/market-analysis';

interface MacroCardProps {
  data: MacroContextDimension;
  delay?: number;
}

export default function MacroCard({ data, delay = 0 }: MacroCardProps) {
  return (
    <DimensionCard dimension={data} delay={delay}>
      <p className="text-[13px] text-white/70 leading-relaxed mt-3">
        {data.narrative}
      </p>

      {/* Events list */}
      <div className="flex flex-col gap-1.5 mt-3.5">
        {data.events.map((event, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl
                       bg-white/[0.03] border border-white/[0.08]"
          >
            {/* Impact indicator */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  event.impact === 'high'
                    ? '#FFA500'
                    : event.impact === 'medium'
                    ? '#E1FFD9'
                    : 'rgba(255, 255, 255, 0.3)',
              }}
            />
            {/* Event name */}
            <span className="text-xs text-white flex-1">{event.event}</span>
            {/* Time */}
            <span className="text-[11px] text-white/50">{event.time}</span>
            {/* Forecast/Actual */}
            <span className="text-[11px] text-white/50">
              {event.actual ? `Act: ${event.actual}` : event.forecast ? `Est: ${event.forecast}` : ''}
            </span>
          </div>
        ))}
      </div>
    </DimensionCard>
  );
}
