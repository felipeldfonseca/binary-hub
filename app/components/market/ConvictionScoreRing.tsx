'use client';

import { getConvictionColor } from '@/types/market-analysis';

interface ConvictionScoreRingProps {
  score: number;
  size?: number;
}

export default function ConvictionScoreRing({
  score,
  size = 120,
}: ConvictionScoreRingProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = score / 100;
  const color = getConvictionColor(score);

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="6"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percentage)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-1000 ease-out"
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="28"
        fontWeight="700"
        className="font-comfortaa"
      >
        {score}
      </text>
      {/* Denominator text */}
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        fill="rgba(255, 255, 255, 0.5)"
        fontSize="10"
        className="font-comfortaa"
      >
        / 100
      </text>
    </svg>
  );
}
