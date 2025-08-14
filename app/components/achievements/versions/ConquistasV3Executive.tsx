'use client'

import React from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

// TypeScript interfaces
interface ExecutiveKPI {
  id: string
  title: string
  value: string
  change: number
  trend: 'up' | 'down' | 'stable'
  target?: string
  category: 'performance' | 'risk' | 'growth' | 'efficiency'
}

interface BusinessMilestone {
  id: string
  title: string
  description: string
  status: 'achieved' | 'in_progress' | 'pending'
  progress: number
  impact: 'high' | 'medium' | 'low'
  category: 'revenue' | 'risk' | 'compliance' | 'operational'
  completedDate?: string
}

interface QuarterlyReport {
  quarter: string
  kpis: {
    roi: { value: number; target: number; status: 'above' | 'at' | 'below' }
    riskScore: { value: number; target: number; status: 'above' | 'at' | 'below' }
    compliance: { value: number; target: number; status: 'above' | 'at' | 'below' }
    efficiency: { value: number; target: number; status: 'above' | 'at' | 'below' }
  }
  summary: string
}

// Professional Executive-focused Conquistas V3
export default function ConquistasV3Executive() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('monthly')
  const { trades } = useTrades()

  // Executive KPIs
  const executiveKPIs: ExecutiveKPI[] = [
    {
      id: 'monthly_roi',
      title: isPortuguese ? 'ROI Mensal' : 'Monthly ROI',
      value: '12.4%',
      change: 2.3,
      trend: 'up',
      target: '10%',
      category: 'performance'
    },
    {
      id: 'sharpe_ratio',
      title: isPortuguese ? 'Índice Sharpe' : 'Sharpe Ratio',
      value: '1.85',
      change: 0.15,
      trend: 'up',
      target: '1.5',
      category: 'risk'
    },
    {
      id: 'var',
      title: isPortuguese ? 'VaR (95%)' : 'VaR (95%)',
      value: '8.2%',
      change: -0.5,
      trend: 'down',
      target: '10%',
      category: 'risk'
    },
    {
      id: 'capital_efficiency',
      title: isPortuguese ? 'Eficiência de Capital' : 'Capital Efficiency',
      value: '94.7%',
      change: 1.2,
      trend: 'up',
      target: '90%',
      category: 'efficiency'
    }
  ]

  // Business Milestones
  const businessMilestones: BusinessMilestone[] = [
    {
      id: 'regulatory_compliance',
      title: isPortuguese ? 'Conformidade Regulatória' : 'Regulatory Compliance',
      description: isPortuguese ? 'Aderência total às regulamentações' : 'Full adherence to regulations',
      status: 'achieved',
      progress: 100,
      impact: 'high',
      category: 'compliance',
      completedDate: '2025-02-15'
    },
    {
      id: 'risk_framework',
      title: isPortuguese ? 'Framework de Risco' : 'Risk Framework',
      description: isPortuguese ? 'Implementação do sistema de gestão de risco' : 'Risk management system implementation',
      status: 'achieved',
      progress: 100,
      impact: 'high',
      category: 'risk',
      completedDate: '2025-01-30'
    },
    {
      id: 'profitability_target',
      title: isPortuguese ? 'Meta de Lucratividade' : 'Profitability Target',
      description: isPortuguese ? 'Alcançar 15% ROI anualizado' : 'Achieve 15% annualized ROI',
      status: 'in_progress',
      progress: 82,
      impact: 'high',
      category: 'revenue'
    },
    {
      id: 'operational_excellence',
      title: isPortuguese ? 'Excelência Operacional' : 'Operational Excellence',
      description: isPortuguese ? 'Otimização de processos e eficiência' : 'Process optimization and efficiency',
      status: 'in_progress',
      progress: 67,
      impact: 'medium',
      category: 'operational'
    },
    {
      id: 'diversification_strategy',
      title: isPortuguese ? 'Estratégia de Diversificação' : 'Diversification Strategy',
      description: isPortuguese ? 'Expansão para novos ativos e mercados' : 'Expansion to new assets and markets',
      status: 'pending',
      progress: 25,
      impact: 'high',
      category: 'revenue'
    }
  ]

  // Quarterly Reports
  const quarterlyReports: QuarterlyReport[] = [
    {
      quarter: 'Q1 2025',
      kpis: {
        roi: { value: 12.4, target: 10, status: 'above' },
        riskScore: { value: 8.2, target: 10, status: 'below' },
        compliance: { value: 100, target: 100, status: 'at' },
        efficiency: { value: 94.7, target: 90, status: 'above' }
      },
      summary: isPortuguese 
        ? 'Desempenho excepcional no primeiro trimestre com ROI acima da meta e gestão de risco eficaz.'
        : 'Exceptional performance in the first quarter with ROI above target and effective risk management.'
    }
  ]

  // Risk Assessment
  const riskAssessment = {
    currentScore: 8.2,
    maxExposure: 15.0,
    diversification: 85,
    correlation: 0.34
  }

  // Get KPI icon based on category
  const getKPIIcon = (category: string) => {
    switch (category) {
      case 'performance':
        return (
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        )
      case 'risk':
        return (
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )
      case 'growth':
        return (
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        )
      case 'efficiency':
        return (
          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      default:
        return (
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )
    }
  }

  // Get milestone icon based on category
  const getMilestoneIcon = (category: string) => {
    switch (category) {
      case 'revenue':
        return (
          <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'risk':
        return (
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )
      case 'compliance':
        return (
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        )
      case 'operational':
        return (
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
        )
      default:
        return (
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'achieved': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
      case 'in_progress': return 'text-amber-400 bg-amber-400/10 border-amber-400/30'
      case 'pending': return 'text-slate-400 bg-slate-400/10 border-slate-400/30'
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/30'
    }
  }

  // Get impact color
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400'
      case 'medium': return 'text-amber-400'
      case 'low': return 'text-emerald-400'
      default: return 'text-slate-400'
    }
  }

  // Get benchmark status color
  const getBenchmarkColor = (status: string) => {
    switch (status) {
      case 'above': return 'text-emerald-400'
      case 'at': return 'text-amber-400'
      case 'below': return 'text-red-400'
      default: return 'text-slate-400'
    }
  }

  return (
    <div className="space-y-8">
      {/* Executive Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h1 className="text-4xl font-bold text-white">
            {isPortuguese ? 'Dashboard Executivo' : 'Executive Dashboard'}
          </h1>
        </div>
        <p className="text-slate-400 max-w-3xl mx-auto">
          {isPortuguese 
            ? 'Visão executiva abrangente de performance, marcos estratégicos e indicadores-chave de negócio.'
            : 'Comprehensive executive view of performance, strategic milestones, and key business indicators.'
          }
        </p>
      </div>

      {/* Executive KPIs */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {isPortuguese ? 'Indicadores Executivos' : 'Executive KPIs'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {executiveKPIs.map((kpi) => (
            <div key={kpi.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                {getKPIIcon(kpi.category)}
                <div className={`flex items-center gap-1 text-sm ${
                  kpi.trend === 'up' ? 'text-emerald-400' :
                  kpi.trend === 'down' ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {kpi.trend === 'up' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7V17" />
                    </svg>
                  ) : kpi.trend === 'down' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17L7 7M7 7H17M7 7V17" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12H19" />
                    </svg>
                  )}
                  {kpi.change > 0 ? '+' : ''}{kpi.change}%
                </div>
              </div>
              
              <h3 className="text-sm font-medium text-slate-400 mb-2">{kpi.title}</h3>
              <div className="text-3xl font-bold text-white mb-1">{kpi.value}</div>
              
              {kpi.target && (
                <div className="text-xs text-slate-500">
                  {isPortuguese ? 'Meta' : 'Target'}: {kpi.target}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Strategic Objectives */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          {isPortuguese ? 'Objetivos Estratégicos' : 'Strategic Objectives'}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {businessMilestones.map((milestone) => (
            <div key={milestone.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getMilestoneIcon(milestone.category)}
                  <div>
                    <h3 className="text-lg font-semibold text-white">{milestone.title}</h3>
                    <p className="text-sm text-slate-400">{milestone.description}</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(milestone.status)}`}>
                    {milestone.status.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className={`text-xs font-medium ${getImpactColor(milestone.impact)}`}>
                    {milestone.impact.toUpperCase()} {isPortuguese ? 'IMPACTO' : 'IMPACT'}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-slate-400 mb-2">
                  <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                  <span>{milestone.progress}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-700 ${
                      milestone.status === 'achieved' ? 'bg-emerald-500' :
                      milestone.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-500'
                    }`}
                    style={{ width: `${milestone.progress}%` }}
                  ></div>
                </div>
              </div>

              {milestone.completedDate && (
                <div className="text-xs text-slate-500">
                  {isPortuguese ? 'Concluído em' : 'Completed on'}: {milestone.completedDate}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Performance Reports */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isPortuguese ? 'Relatórios de Performance' : 'Performance Reports'}
        </h2>

        {quarterlyReports.map((report) => (
          <div key={report.quarter} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">{report.quarter} {isPortuguese ? 'Relatório' : 'Report'}</h3>
              <div className="text-sm text-slate-400">
                {isPortuguese ? 'Atualizado' : 'Updated'}: {new Date().toLocaleDateString()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-slate-800/30 rounded-lg">
                <div className="text-sm text-slate-400 mb-1">ROI</div>
                <div className={`text-lg font-bold ${getBenchmarkColor(report.kpis.roi.status)}`}>
                  {report.kpis.roi.value}%
                </div>
                <div className="text-xs text-slate-500">
                  {isPortuguese ? 'Meta' : 'Target'}: {report.kpis.roi.target}%
                </div>
              </div>
              
              <div className="text-center p-4 bg-slate-800/30 rounded-lg">
                <div className="text-sm text-slate-400 mb-1">{isPortuguese ? 'Risco' : 'Risk'}</div>
                <div className={`text-lg font-bold ${getBenchmarkColor(report.kpis.riskScore.status)}`}>
                  {report.kpis.riskScore.value}
                </div>
                <div className="text-xs text-slate-500">
                  {isPortuguese ? 'Meta' : 'Target'}: &lt;{report.kpis.riskScore.target}
                </div>
              </div>
              
              <div className="text-center p-4 bg-slate-800/30 rounded-lg">
                <div className="text-sm text-slate-400 mb-1">{isPortuguese ? 'Compliance' : 'Compliance'}</div>
                <div className={`text-lg font-bold ${getBenchmarkColor(report.kpis.compliance.status)}`}>
                  {report.kpis.compliance.value}%
                </div>
                <div className="text-xs text-slate-500">
                  {isPortuguese ? 'Meta' : 'Target'}: {report.kpis.compliance.target}%
                </div>
              </div>
              
              <div className="text-center p-4 bg-slate-800/30 rounded-lg">
                <div className="text-sm text-slate-400 mb-1">{isPortuguese ? 'Eficiência' : 'Efficiency'}</div>
                <div className={`text-lg font-bold ${getBenchmarkColor(report.kpis.efficiency.status)}`}>
                  {report.kpis.efficiency.value}%
                </div>
                <div className="text-xs text-slate-500">
                  {isPortuguese ? 'Meta' : 'Target'}: {report.kpis.efficiency.target}%
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-800/20 rounded-lg">
              <h4 className="text-sm font-medium text-slate-300 mb-2">
                {isPortuguese ? 'Resumo Executivo' : 'Executive Summary'}
              </h4>
              <p className="text-sm text-slate-400">{report.summary}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Risk Management Overview */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {isPortuguese ? 'Visão Geral de Riscos' : 'Risk Management Overview'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 text-center">
            <div className="text-sm text-slate-400 mb-2">{isPortuguese ? 'Score de Risco Atual' : 'Current Risk Score'}</div>
            <div className="text-3xl font-bold text-amber-400 mb-1">{riskAssessment.currentScore}</div>
            <div className="text-xs text-slate-500">{isPortuguese ? 'Baixo Risco' : 'Low Risk'}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 text-center">
            <div className="text-sm text-slate-400 mb-2">{isPortuguese ? 'Exposição Máxima' : 'Maximum Exposure'}</div>
            <div className="text-3xl font-bold text-red-400 mb-1">{riskAssessment.maxExposure}%</div>
            <div className="text-xs text-slate-500">{isPortuguese ? 'do Capital' : 'of Capital'}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 text-center">
            <div className="text-sm text-slate-400 mb-2">{isPortuguese ? 'Diversificação' : 'Diversification'}</div>
            <div className="text-3xl font-bold text-emerald-400 mb-1">{riskAssessment.diversification}%</div>
            <div className="text-xs text-slate-500">{isPortuguese ? 'Bem Diversificado' : 'Well Diversified'}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 text-center">
            <div className="text-sm text-slate-400 mb-2">{isPortuguese ? 'Correlação de Mercado' : 'Market Correlation'}</div>
            <div className="text-3xl font-bold text-blue-400 mb-1">{riskAssessment.correlation}</div>
            <div className="text-xs text-slate-500">{isPortuguese ? 'Baixa Correlação' : 'Low Correlation'}</div>
          </div>
        </div>
      </section>

      {/* Compliance Status */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          {isPortuguese ? 'Status de Compliance' : 'Compliance Status'}
        </h2>

        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3 p-4 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <div className="text-sm font-medium text-emerald-400">{isPortuguese ? 'Regulamentações' : 'Regulations'}</div>
                <div className="text-xs text-slate-400">{isPortuguese ? 'Totalmente Compatível' : 'Fully Compliant'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-emerald-400">{isPortuguese ? 'Auditoria' : 'Audit Trail'}</div>
                <div className="text-xs text-slate-400">{isPortuguese ? 'Atualizada' : 'Up to Date'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-emerald-400">{isPortuguese ? 'Documentação' : 'Documentation'}</div>
                <div className="text-xs text-slate-400">{isPortuguese ? 'Completa' : 'Complete'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}