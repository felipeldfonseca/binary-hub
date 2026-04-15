'use client';

interface VixGaugeProps {
  value: number;
  label?: string;
}

export default function VixGauge({ value, label = 'VIX' }: VixGaugeProps) {
  // VIX typically ranges 10-40, normalize to 0-100
  const normalizedValue = Math.min((value / 40) * 100, 100);
  const angle = -90 + (normalizedValue / 100) * 180;

  // Color based on VIX level
  const getColor = () => {
    if (value >= 30) return '#FF4444'; // High volatility - red
    if (value >= 20) return '#FFA500'; // Elevated - orange
    return '#E1FFD9'; // Normal/low - green
  };

  const color = getColor();

  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="48" viewBox="0 0 80 48">
        {/* Background arc */}
        <path
          d="M8 44 A 32 32 0 0 1 72 44"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d="M8 44 A 32 32 0 0 1 72 44"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="100.5"
          strokeDashoffset={100.5 * (1 - normalizedValue / 100)}
          className="transition-all duration-1000 ease-out"
        />
        {/* Needle */}
        <line
          x1="40"
          y1="44"
          x2="40"
          y2="16"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${angle} 40 44)`}
          className="transition-transform duration-1000 ease-out"
        />
        {/* Center dot */}
        <circle cx="40" cy="44" r="3" fill={color} />
      </svg>
      <span className="text-[10px] text-white/50 mt-1">{label}</span>
    </div>
  );
}
