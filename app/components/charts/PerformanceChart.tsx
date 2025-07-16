'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { mockChartData } from '@/lib/mockData'

type Period = 'day' | 'week' | 'month' | '3months' | '6months' | 'year'

interface PerformanceChartProps {
  period: Period
}

export default function PerformanceChart({ period }: PerformanceChartProps) {
  const data = mockChartData[period]

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#666"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            formatter={(value: number) => [`$${value}`, 'P&L']}
            labelFormatter={(label) => `Date: ${label}`}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Line 
            type="monotone" 
            dataKey="amount" 
            stroke="#00E28A" 
            strokeWidth={2}
            dot={{ fill: '#00E28A', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#00E28A', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
} 