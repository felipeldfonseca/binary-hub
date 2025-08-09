'use client'

import React from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface SkillMetric {
  name: string
  namePT: string
  value: number
  maxValue: number
  color: string
  description: string
  descriptionPT: string
}

export default function SkillRadar() {
  const { stats, loading } = useTradeStats()
  const { trades } = useTrades()
  const { isPortuguese } = useLanguage()

  // Calculate advanced metrics
  const calculateSkillMetrics = (): SkillMetric[] => {
    if (!stats || !trades) {
      return [
        { name: 'Accuracy', namePT: 'Precisão', value: 0, maxValue: 100, color: '#E1FFD9', description: 'Win rate', descriptionPT: 'Taxa de vitória' },
        { name: 'Consistency', namePT: 'Consistência', value: 0, maxValue: 100, color: '#60A5FA', description: 'Trading consistency', descriptionPT: 'Consistência de trading' },
        { name: 'Risk Control', namePT: 'Controle de Risco', value: 0, maxValue: 100, color: '#F472B6', description: 'Risk management', descriptionPT: 'Gestão de risco' },
        { name: 'Profitability', namePT: 'Rentabilidade', value: 0, maxValue: 100, color: '#34D399', description: 'Profit generation', descriptionPT: 'Geração de lucro' },
        { name: 'Discipline', namePT: 'Disciplina', value: 0, maxValue: 100, color: '#FBBF24', description: 'Trading discipline', descriptionPT: 'Disciplina de trading' },
        { name: 'Experience', namePT: 'Experiência', value: 0, maxValue: 100, color: '#A78BFA', description: 'Trading experience', descriptionPT: 'Experiência de trading' }
      ]
    }

    // Calculate consistency (based on win rate stability)
    const consistency = Math.min(100, stats.winRate > 0 ? (stats.winRate / 1.5) : 0)

    // Calculate risk control (inverse of max drawdown ratio)
    const riskControl = stats.totalPnl > 0 ? 
      Math.min(100, 100 - ((Math.abs(stats.maxDrawdown) / stats.totalPnl) * 100)) : 
      50

    // Calculate profitability (based on average PnL and total profit)
    const profitability = Math.min(100, Math.max(0, 
      stats.totalPnl > 0 ? Math.min((stats.totalPnl / 1000) * 50, 100) : 0
    ))

    // Calculate discipline (based on average stake consistency)
    const avgStake = stats.avgStake || 0
    const maxStake = stats.maxStake || 0
    const discipline = maxStake > 0 ? 
      Math.min(100, 100 - ((maxStake - avgStake) / maxStake * 100)) : 
      70

    // Calculate experience (based on total trades)
    const experience = Math.min(100, (stats.totalTrades / 100) * 100)

    return [
      { 
        name: 'Accuracy', 
        namePT: 'Precisão', 
        value: stats.winRate, 
        maxValue: 100, 
        color: '#E1FFD9',
        description: 'Win rate percentage',
        descriptionPT: 'Percentual de taxa de vitória'
      },
      { 
        name: 'Consistency', 
        namePT: 'Consistência', 
        value: consistency, 
        maxValue: 100, 
        color: '#60A5FA',
        description: 'Trading consistency score',
        descriptionPT: 'Pontuação de consistência de trading'
      },
      { 
        name: 'Risk Control', 
        namePT: 'Controle de Risco', 
        value: riskControl, 
        maxValue: 100, 
        color: '#F472B6',
        description: 'Risk management effectiveness',
        descriptionPT: 'Efetividade da gestão de risco'
      },
      { 
        name: 'Profitability', 
        namePT: 'Rentabilidade', 
        value: profitability, 
        maxValue: 100, 
        color: '#34D399',
        description: 'Profit generation capability',
        descriptionPT: 'Capacidade de geração de lucro'
      },
      { 
        name: 'Discipline', 
        namePT: 'Disciplina', 
        value: discipline, 
        maxValue: 100, 
        color: '#FBBF24',
        description: 'Trading discipline level',
        descriptionPT: 'Nível de disciplina de trading'
      },
      { 
        name: 'Experience', 
        namePT: 'Experiência', 
        value: experience, 
        maxValue: 100, 
        color: '#A78BFA',
        description: 'Trading experience level',
        descriptionPT: 'Nível de experiência de trading'
      }
    ]
  }

  const skillMetrics = calculateSkillMetrics()

  // Calculate radar chart points
  const calculateRadarPoints = (metrics: SkillMetric[], radius: number = 80) => {
    const centerX = 120
    const centerY = 120
    const angleStep = (2 * Math.PI) / metrics.length

    return metrics.map((metric, index) => {
      const angle = (index * angleStep) - (Math.PI / 2) // Start from top
      const value = (metric.value / metric.maxValue) * radius
      const x = centerX + Math.cos(angle) * value
      const y = centerY + Math.sin(angle) * value
      return { x, y, angle, metric }
    })
  }

  // Calculate grid lines
  const calculateGridLines = (levels: number = 5, radius: number = 80) => {
    const centerX = 120
    const centerY = 120
    const angleStep = (2 * Math.PI) / skillMetrics.length

    const gridLevels = []
    for (let level = 1; level <= levels; level++) {
      const levelRadius = (radius / levels) * level
      const points = []
      
      for (let i = 0; i < skillMetrics.length; i++) {
        const angle = (i * angleStep) - (Math.PI / 2)
        const x = centerX + Math.cos(angle) * levelRadius
        const y = centerY + Math.sin(angle) * levelRadius
        points.push({ x, y })
      }
      
      gridLevels.push({ level, points, radius: levelRadius })
    }

    return gridLevels
  }

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="font-comfortaa font-bold text-2xl mb-6 text-primary">
            {isPortuguese ? 'Radar de Habilidades' : 'Skill Radar'}
          </h2>
          <div className="card animate-pulse">
            <div className="h-80 bg-gray-200 rounded"></div>
          </div>
        </div>
      </section>
    )
  }

  const radarPoints = calculateRadarPoints(skillMetrics)
  const gridLines = calculateGridLines()

  // Create path for filled area
  const pathData = radarPoints.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ') + ' Z'

  const averageSkill = skillMetrics.reduce((sum, metric) => sum + metric.value, 0) / skillMetrics.length

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <h2 className="font-comfortaa font-bold text-2xl mb-6 text-primary">
          {isPortuguese ? 'Radar de Habilidades' : 'Skill Radar'}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <div className="card">
            <div className="text-center mb-4">
              <h3 className="font-comfortaa font-semibold text-lg text-white mb-2">
                {isPortuguese ? 'Mapa de Habilidades' : 'Skill Map'}
              </h3>
              <div className="text-sm text-gray-400">
                {isPortuguese ? 'Pontuação média:' : 'Average score:'} 
                <span className="text-primary font-bold ml-2">{averageSkill.toFixed(1)}/100</span>
              </div>
            </div>

            <div className="flex justify-center">
              <svg width="240" height="240" className="overflow-visible">
                {/* Grid lines */}
                {gridLines.map((grid, gridIndex) => (
                  <g key={gridIndex}>
                    <polygon
                      points={grid.points.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth="1"
                    />
                  </g>
                ))}

                {/* Axis lines */}
                {radarPoints.map((point, index) => (
                  <line
                    key={index}
                    x1="120"
                    y1="120"
                    x2={120 + Math.cos(point.angle) * 80}
                    y2={120 + Math.sin(point.angle) * 80}
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth="1"
                  />
                ))}

                {/* Filled area */}
                <path
                  d={pathData}
                  fill="rgba(225, 255, 217, 0.2)"
                  stroke="#E1FFD9"
                  strokeWidth="2"
                  className="drop-shadow-lg"
                />

                {/* Data points */}
                {radarPoints.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={skillMetrics[index].color}
                    stroke="white"
                    strokeWidth="2"
                    className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                    title={`${skillMetrics[index].name}: ${skillMetrics[index].value.toFixed(1)}`}
                  />
                ))}

                {/* Labels */}
                {radarPoints.map((point, index) => {
                  const metric = skillMetrics[index]
                  const labelRadius = 95
                  const labelX = 120 + Math.cos(point.angle) * labelRadius
                  const labelY = 120 + Math.sin(point.angle) * labelRadius
                  
                  return (
                    <text
                      key={index}
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white text-xs font-medium"
                      style={{ fontSize: '10px' }}
                    >
                      {isPortuguese ? metric.namePT : metric.name}
                    </text>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* Skill Breakdown */}
          <div className="space-y-4">
            <h3 className="font-comfortaa font-semibold text-lg text-white mb-4">
              {isPortuguese ? 'Detalhamento de Habilidades' : 'Skill Breakdown'}
            </h3>
            
            {skillMetrics.map((skill, index) => (
              <div key={skill.name} className="card bg-gray-800/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: skill.color }}
                    ></div>
                    <span className="font-medium text-white">
                      {isPortuguese ? skill.namePT : skill.name}
                    </span>
                  </div>
                  <span className="font-bold text-primary">
                    {skill.value.toFixed(1)}/100
                  </span>
                </div>
                
                <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${skill.value}%`,
                      backgroundColor: skill.color
                    }}
                  ></div>
                </div>
                
                <p className="text-xs text-gray-400">
                  {isPortuguese ? skill.descriptionPT : skill.description}
                </p>
              </div>
            ))}

            {/* Overall Assessment */}
            <div className="card bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-400/20 mt-6">
              <h4 className="font-comfortaa font-semibold text-purple-400 mb-3">
                {isPortuguese ? '📊 Avaliação Geral' : '📊 Overall Assessment'}
              </h4>
              
              <div className="text-sm text-gray-300">
                {averageSkill >= 80 ? (
                  <p>{isPortuguese ? 'Excelente! Você é um trader muito habilidoso.' : 'Excellent! You are a very skilled trader.'}</p>
                ) : averageSkill >= 60 ? (
                  <p>{isPortuguese ? 'Bom trabalho! Continue aprimorando suas habilidades.' : 'Good work! Keep improving your skills.'}</p>
                ) : averageSkill >= 40 ? (
                  <p>{isPortuguese ? 'Você está progredindo. Foque nas áreas mais fracas.' : 'You are progressing. Focus on weaker areas.'}</p>
                ) : (
                  <p>{isPortuguese ? 'Continue praticando e estudando. Há muito espaço para crescimento!' : 'Keep practicing and studying. There is much room for growth!'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}