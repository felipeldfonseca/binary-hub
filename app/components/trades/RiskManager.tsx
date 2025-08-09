'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Trade } from '@/hooks/useTrades'
import { TradeStats } from '@/hooks/useTradeStats'

interface RiskManagerProps {
  trades: Trade[]
  stats: TradeStats | null
}

interface RiskSettings {
  accountBalance: number
  maxRiskPerTrade: number // percentage
  maxDailyRisk: number // percentage
  maxConsecutiveLosses: number
  stopTradingAfterLoss: boolean
  riskRewardRatio: number
}

interface PositionSizing {
  recommendedAmount: number
  maxAmount: number
  riskAmount: number
  potentialProfit: number
  potentialLoss: number
}

interface RiskAlert {
  type: 'info' | 'warning' | 'danger'
  title: string
  message: string
  action?: string
}

export default function RiskManager({ trades, stats }: RiskManagerProps) {
  const { isPortuguese } = useLanguage()
  
  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    accountBalance: 10000,
    maxRiskPerTrade: 2, // 2%
    maxDailyRisk: 10, // 10%
    maxConsecutiveLosses: 3,
    stopTradingAfterLoss: false,
    riskRewardRatio: 2.0
  })

  const [positionCalc, setPositionCalc] = useState({
    asset: '',
    entryPrice: 0,
    stopLoss: 0,
    takeProfit: 0,
    direction: 'call' as 'call' | 'put'
  })

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('binaryHubRiskSettings')
    if (saved) {
      try {
        setRiskSettings(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading risk settings:', error)
      }
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('binaryHubRiskSettings', JSON.stringify(riskSettings))
  }, [riskSettings])

  // Calculate current risk metrics
  const riskMetrics = useMemo(() => {
    if (!trades.length) return null

    const today = new Date().toDateString()
    const todayTrades = trades.filter(trade => 
      new Date(trade.entryTime).toDateString() === today
    )

    const recentTrades = trades.slice(-10)
    let consecutiveLosses = 0
    for (let i = recentTrades.length - 1; i >= 0; i--) {
      if (recentTrades[i].result === 'loss') {
        consecutiveLosses++
      } else {
        break
      }
    }

    const totalPnlToday = todayTrades.reduce((sum, trade) => sum + trade.profit, 0)
    const dailyRiskUsed = Math.abs(totalPnlToday) / riskSettings.accountBalance * 100

    // Calculate current drawdown
    let peakBalance = riskSettings.accountBalance
    let currentDrawdown = 0
    let maxDrawdown = 0
    let runningBalance = riskSettings.accountBalance

    trades.forEach(trade => {
      runningBalance += trade.profit
      if (runningBalance > peakBalance) {
        peakBalance = runningBalance
      }
      currentDrawdown = ((peakBalance - runningBalance) / peakBalance) * 100
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown)
    })

    return {
      todayTrades: todayTrades.length,
      dailyPnl: totalPnlToday,
      dailyRiskUsed,
      consecutiveLosses,
      currentDrawdown,
      maxDrawdown,
      currentBalance: runningBalance,
      isRiskLimitReached: dailyRiskUsed >= riskSettings.maxDailyRisk,
      shouldStopTrading: consecutiveLosses >= riskSettings.maxConsecutiveLosses
    }
  }, [trades, riskSettings])

  // Generate risk alerts
  const riskAlerts = useMemo(() => {
    if (!riskMetrics) return []

    const alerts: RiskAlert[] = []

    // Daily risk alert
    if (riskMetrics.dailyRiskUsed >= riskSettings.maxDailyRisk * 0.8) {
      alerts.push({
        type: riskMetrics.dailyRiskUsed >= riskSettings.maxDailyRisk ? 'danger' : 'warning',
        title: isPortuguese ? 'Risco Diário Alto' : 'High Daily Risk',
        message: isPortuguese ?
          `Você já usou ${riskMetrics.dailyRiskUsed.toFixed(1)}% do seu risco diário máximo de ${riskSettings.maxDailyRisk}%.` :
          `You've used ${riskMetrics.dailyRiskUsed.toFixed(1)}% of your max daily risk of ${riskSettings.maxDailyRisk}%.`,
        action: riskMetrics.dailyRiskUsed >= riskSettings.maxDailyRisk ?
          (isPortuguese ? 'Pare de operar hoje' : 'Stop trading today') :
          (isPortuguese ? 'Considere reduzir posições' : 'Consider reducing positions')
      })
    }

    // Consecutive losses alert
    if (riskMetrics.consecutiveLosses >= riskSettings.maxConsecutiveLosses * 0.7) {
      alerts.push({
        type: riskMetrics.shouldStopTrading ? 'danger' : 'warning',
        title: isPortuguese ? 'Sequência de Perdas' : 'Losing Streak',
        message: isPortuguese ?
          `Você tem ${riskMetrics.consecutiveLosses} perdas consecutivas. Limite: ${riskSettings.maxConsecutiveLosses}.` :
          `You have ${riskMetrics.consecutiveLosses} consecutive losses. Limit: ${riskSettings.maxConsecutiveLosses}.`,
        action: riskMetrics.shouldStopTrading ?
          (isPortuguese ? 'Pare e analise sua estratégia' : 'Stop and analyze your strategy') :
          (isPortuguese ? 'Considere reduzir risco' : 'Consider reducing risk')
      })
    }

    // Drawdown alert
    if (riskMetrics.currentDrawdown >= 15) {
      alerts.push({
        type: riskMetrics.currentDrawdown >= 25 ? 'danger' : 'warning',
        title: isPortuguese ? 'Alto Drawdown' : 'High Drawdown',
        message: isPortuguese ?
          `Drawdown atual de ${riskMetrics.currentDrawdown.toFixed(1)}%. Balance: $${riskMetrics.currentBalance.toFixed(2)}.` :
          `Current drawdown of ${riskMetrics.currentDrawdown.toFixed(1)}%. Balance: $${riskMetrics.currentBalance.toFixed(2)}.`,
        action: isPortuguese ?
          'Considere pausar e revisar estratégia' :
          'Consider pausing and reviewing strategy'
      })
    }

    // Low balance alert
    if (riskMetrics.currentBalance <= riskSettings.accountBalance * 0.5) {
      alerts.push({
        type: 'danger',
        title: isPortuguese ? 'Saldo Baixo' : 'Low Balance',
        message: isPortuguese ?
          `Seu saldo atual é $${riskMetrics.currentBalance.toFixed(2)}, 50% abaixo do inicial.` :
          `Your current balance is $${riskMetrics.currentBalance.toFixed(2)}, 50% below initial.`,
        action: isPortuguese ?
          'Pare de operar e revise sua estratégia' :
          'Stop trading and review your strategy'
      })
    }

    return alerts
  }, [riskMetrics, riskSettings, isPortuguese])

  // Calculate position sizing
  const positionSizing = useMemo(() => {
    if (!positionCalc.entryPrice || !positionCalc.stopLoss || !riskMetrics) return null

    const riskAmount = riskSettings.accountBalance * (riskSettings.maxRiskPerTrade / 100)
    const priceRisk = Math.abs(positionCalc.entryPrice - positionCalc.stopLoss)
    
    if (priceRisk === 0) return null

    // For binary options, calculate based on percentage risk
    const recommendedAmount = Math.min(riskAmount, riskSettings.accountBalance * 0.05) // Max 5% per trade
    const maxAmount = riskSettings.accountBalance * (riskSettings.maxRiskPerTrade / 100)
    
    const potentialProfit = positionCalc.takeProfit > 0 ?
      Math.abs(positionCalc.takeProfit - positionCalc.entryPrice) / positionCalc.entryPrice * recommendedAmount :
      recommendedAmount * (riskSettings.riskRewardRatio - 1)
    
    const potentialLoss = recommendedAmount

    return {
      recommendedAmount,
      maxAmount,
      riskAmount,
      potentialProfit,
      potentialLoss
    } as PositionSizing
  }, [positionCalc, riskSettings, riskMetrics])

  const updateRiskSetting = <K extends keyof RiskSettings>(
    key: K,
    value: RiskSettings[K]
  ) => {
    setRiskSettings(prev => ({ ...prev, [key]: value }))
  }

  const updatePositionCalc = (field: string, value: string | number) => {
    setPositionCalc(prev => ({ ...prev, [field]: value }))
  }

  const renderAlertIcon = (type: RiskAlert['type']) => {
    switch (type) {
      case 'danger': return <span className="text-loss">🚨</span>
      case 'warning': return <span className="text-warning">⚠️</span>
      case 'info': return <span className="text-primary">ℹ️</span>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-poly font-bold text-white mb-2">
          {isPortuguese ? 'Gerenciamento de Risco' : 'Risk Management'}
        </h2>
        <p className="text-gray-300 font-comfortaa">
          {isPortuguese ? 'Controle e monitore seus riscos de trading' : 'Control and monitor your trading risks'}
        </p>
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white font-comfortaa">
            {isPortuguese ? 'Alertas de Risco' : 'Risk Alerts'}
          </h3>
          {riskAlerts.map((alert, index) => (
            <div key={index} className={`card border-l-4 ${
              alert.type === 'danger' ? 'border-loss bg-loss/10' :
              alert.type === 'warning' ? 'border-warning bg-warning/10' :
              'border-primary bg-primary/10'
            }`}>
              <div className="flex items-start gap-3">
                {renderAlertIcon(alert.type)}
                <div className="flex-1">
                  <h4 className="font-bold text-white">{alert.title}</h4>
                  <p className="text-gray-300 text-sm mb-1">{alert.message}</p>
                  {alert.action && (
                    <div className="text-xs font-medium text-primary">
                      {isPortuguese ? 'Ação: ' : 'Action: '}{alert.action}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Risk Overview */}
      {riskMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-primary">
              ${riskMetrics.currentBalance.toFixed(0)}
            </div>
            <div className="text-sm text-gray-300">
              {isPortuguese ? 'Saldo Atual' : 'Current Balance'}
            </div>
          </div>
          <div className="card text-center">
            <div className={`text-2xl font-bold ${
              riskMetrics.dailyRiskUsed >= riskSettings.maxDailyRisk ? 'text-loss' : 'text-primary'
            }`}>
              {riskMetrics.dailyRiskUsed.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-300">
              {isPortuguese ? 'Risco Diário Usado' : 'Daily Risk Used'}
            </div>
          </div>
          <div className="card text-center">
            <div className={`text-2xl font-bold ${
              riskMetrics.consecutiveLosses >= riskSettings.maxConsecutiveLosses ? 'text-loss' : 'text-primary'
            }`}>
              {riskMetrics.consecutiveLosses}
            </div>
            <div className="text-sm text-gray-300">
              {isPortuguese ? 'Perdas Consecutivas' : 'Consecutive Losses'}
            </div>
          </div>
          <div className="card text-center">
            <div className={`text-2xl font-bold ${
              riskMetrics.currentDrawdown >= 20 ? 'text-loss' : 'text-primary'
            }`}>
              {riskMetrics.currentDrawdown.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-300">
              {isPortuguese ? 'Drawdown Atual' : 'Current Drawdown'}
            </div>
          </div>
        </div>
      )}

      {/* Risk Settings */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
          {isPortuguese ? 'Configurações de Risco' : 'Risk Settings'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Saldo da Conta ($)' : 'Account Balance ($)'}
              </label>
              <input
                type="number"
                value={riskSettings.accountBalance}
                onChange={(e) => updateRiskSetting('accountBalance', parseFloat(e.target.value) || 0)}
                className="form-input w-full"
                min="100"
                step="100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Risco Máximo por Operação (%)' : 'Max Risk per Trade (%)'}
              </label>
              <input
                type="number"
                value={riskSettings.maxRiskPerTrade}
                onChange={(e) => updateRiskSetting('maxRiskPerTrade', parseFloat(e.target.value) || 0)}
                className="form-input w-full"
                min="0.1"
                max="10"
                step="0.1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Risco Diário Máximo (%)' : 'Max Daily Risk (%)'}
              </label>
              <input
                type="number"
                value={riskSettings.maxDailyRisk}
                onChange={(e) => updateRiskSetting('maxDailyRisk', parseFloat(e.target.value) || 0)}
                className="form-input w-full"
                min="1"
                max="50"
                step="1"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Máx. Perdas Consecutivas' : 'Max Consecutive Losses'}
              </label>
              <input
                type="number"
                value={riskSettings.maxConsecutiveLosses}
                onChange={(e) => updateRiskSetting('maxConsecutiveLosses', parseInt(e.target.value) || 0)}
                className="form-input w-full"
                min="1"
                max="10"
                step="1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Relação Risco/Retorno' : 'Risk/Reward Ratio'}
              </label>
              <input
                type="number"
                value={riskSettings.riskRewardRatio}
                onChange={(e) => updateRiskSetting('riskRewardRatio', parseFloat(e.target.value) || 0)}
                className="form-input w-full"
                min="1"
                max="5"
                step="0.1"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="stopAfterLoss"
                checked={riskSettings.stopTradingAfterLoss}
                onChange={(e) => updateRiskSetting('stopTradingAfterLoss', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="stopAfterLoss" className="text-sm text-gray-300">
                {isPortuguese ? 
                  'Parar após atingir limite de perdas' : 
                  'Stop trading after hitting loss limit'}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Position Size Calculator */}
      <div className="card">
        <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
          {isPortuguese ? 'Calculadora de Posição' : 'Position Size Calculator'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Ativo' : 'Asset'}
              </label>
              <input
                type="text"
                value={positionCalc.asset}
                onChange={(e) => updatePositionCalc('asset', e.target.value)}
                placeholder="EURUSD"
                className="form-input w-full"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updatePositionCalc('direction', 'call')}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  positionCalc.direction === 'call'
                    ? 'bg-win text-background'
                    : 'border border-gray-600 text-gray-300 hover:border-primary'
                }`}
              >
                CALL
              </button>
              <button
                type="button"
                onClick={() => updatePositionCalc('direction', 'put')}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  positionCalc.direction === 'put'
                    ? 'bg-loss text-white'
                    : 'border border-gray-600 text-gray-300 hover:border-primary'
                }`}
              >
                PUT
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Preço de Entrada' : 'Entry Price'}
              </label>
              <input
                type="number"
                value={positionCalc.entryPrice}
                onChange={(e) => updatePositionCalc('entryPrice', parseFloat(e.target.value) || 0)}
                step="0.00001"
                className="form-input w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Stop Loss' : 'Stop Loss'}
              </label>
              <input
                type="number"
                value={positionCalc.stopLoss}
                onChange={(e) => updatePositionCalc('stopLoss', parseFloat(e.target.value) || 0)}
                step="0.00001"
                className="form-input w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Take Profit (Opcional)' : 'Take Profit (Optional)'}
              </label>
              <input
                type="number"
                value={positionCalc.takeProfit}
                onChange={(e) => updatePositionCalc('takeProfit', parseFloat(e.target.value) || 0)}
                step="0.00001"
                className="form-input w-full"
              />
            </div>
          </div>
          
          {/* Position Sizing Results */}
          <div>
            {positionSizing ? (
              <div className="space-y-4">
                <h4 className="font-bold text-primary">
                  {isPortuguese ? 'Resultados da Calculadora' : 'Calculator Results'}
                </h4>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-dark-card p-3 rounded">
                    <div className="text-sm text-gray-400">
                      {isPortuguese ? 'Valor Recomendado' : 'Recommended Amount'}
                    </div>
                    <div className="text-lg font-bold text-win">
                      ${positionSizing.recommendedAmount.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="bg-dark-card p-3 rounded">
                    <div className="text-sm text-gray-400">
                      {isPortuguese ? 'Valor Máximo' : 'Maximum Amount'}
                    </div>
                    <div className="text-lg font-bold text-warning">
                      ${positionSizing.maxAmount.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="bg-dark-card p-3 rounded">
                    <div className="text-sm text-gray-400">
                      {isPortuguese ? 'Lucro Potencial' : 'Potential Profit'}
                    </div>
                    <div className="text-lg font-bold text-win">
                      +${positionSizing.potentialProfit.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="bg-dark-card p-3 rounded">
                    <div className="text-sm text-gray-400">
                      {isPortuguese ? 'Perda Potencial' : 'Potential Loss'}
                    </div>
                    <div className="text-lg font-bold text-loss">
                      -${positionSizing.potentialLoss.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="bg-dark-card p-3 rounded">
                    <div className="text-sm text-gray-400">
                      {isPortuguese ? 'Relação R/R' : 'R/R Ratio'}
                    </div>
                    <div className="text-lg font-bold text-primary">
                      1:{(positionSizing.potentialProfit / positionSizing.potentialLoss).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <p>{isPortuguese ? 
                    'Preencha os campos para calcular' : 
                    'Fill the fields to calculate'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}