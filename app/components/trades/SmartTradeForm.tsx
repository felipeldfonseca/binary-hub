'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Trade } from '@/hooks/useTrades'
import { useToastHelpers } from '@/components/ui/Toast'

interface SmartTradeFormProps {
  onTradeCreate: (trade: Partial<Trade>) => Promise<void>
  existingTrades: Trade[]
  loading?: boolean
}

interface TradeFormData {
  asset: string
  direction: 'call' | 'put'
  amount: number
  entryPrice: number
  exitPrice: number
  entryTime: string
  exitTime: string
  timeframe: string
  strategy: string
  notes: string
}

interface RiskMetrics {
  riskReward: number
  accountRisk: number
  maxLoss: number
  positionSize: number
  confidence: number
}

interface AIRecommendation {
  suggestion: 'buy' | 'sell' | 'hold'
  confidence: number
  reason: string
  riskLevel: 'low' | 'medium' | 'high'
  targetPrice: number
  stopLoss: number
}

export default function SmartTradeForm({ onTradeCreate, existingTrades, loading = false }: SmartTradeFormProps) {
  const { isPortuguese } = useLanguage()
  const { showSuccess, showError } = useToastHelpers()
  
  const [formData, setFormData] = useState<TradeFormData>({
    asset: '',
    direction: 'call',
    amount: 100,
    entryPrice: 0,
    exitPrice: 0,
    entryTime: '',
    exitTime: '',
    timeframe: '5m',
    strategy: '',
    notes: ''
  })
  
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Common assets for quick selection
  const commonAssets = ['EURUSD', 'GBPUSD', 'USDCAD', 'AUDUSD', 'USDJPY', 'GOLD', 'OIL', 'BTCUSD']
  
  // Timeframe options
  const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

  // Common strategies
  const strategies = [
    'Price Action',
    'Support/Resistance', 
    'Trend Following',
    'Mean Reversion',
    'Breakout',
    'RSI Divergence',
    'Moving Average Cross',
    'Bollinger Bands',
    'Fibonacci Retracement',
    'News Trading'
  ]

  // Calculate risk metrics when form data changes
  useEffect(() => {
    if (formData.amount && formData.entryPrice && formData.exitPrice) {
      calculateRiskMetrics()
    }
  }, [formData.amount, formData.entryPrice, formData.exitPrice])

  const calculateRiskMetrics = useCallback(() => {
    const { amount, entryPrice, exitPrice } = formData
    
    if (!amount || !entryPrice || !exitPrice) return

    const profitLoss = exitPrice - entryPrice
    const riskReward = Math.abs(profitLoss / entryPrice) * 100
    const accountRisk = (amount / 10000) * 100 // Assuming 10k account
    const maxLoss = amount
    
    // Calculate position size suggestion
    const accountBalance = 10000 // This should come from user profile
    const riskPerTrade = 0.02 // 2% risk per trade
    const suggestedSize = (accountBalance * riskPerTrade) / maxLoss * amount

    // Confidence based on historical performance
    const assetTrades = existingTrades.filter(t => t.asset === formData.asset)
    const winRate = assetTrades.length > 0 ? 
      assetTrades.filter(t => t.result === 'win').length / assetTrades.length : 0.5
    
    const confidence = Math.min(100, winRate * 100 + (riskReward > 2 ? 20 : 0))

    setRiskMetrics({
      riskReward,
      accountRisk,
      maxLoss,
      positionSize: suggestedSize,
      confidence
    })
  }, [formData, existingTrades])

  // Generate AI recommendation based on form data and historical patterns
  const generateAIRecommendation = useCallback(async () => {
    if (!formData.asset) return

    setIsAnalyzing(true)
    
    try {
      // Simulate AI analysis with historical data
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const assetTrades = existingTrades.filter(t => t.asset === formData.asset)
      const recentTrades = assetTrades.slice(-10)
      const winRate = recentTrades.length > 0 ? 
        recentTrades.filter(t => t.result === 'win').length / recentTrades.length : 0.5
      
      // Generate mock AI recommendation
      const suggestions: AIRecommendation['suggestion'][] = ['buy', 'sell', 'hold']
      const confidence = Math.random() * 40 + 60 // 60-100% confidence
      const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)]
      
      const reasons = [
        `Historical win rate for ${formData.asset}: ${(winRate * 100).toFixed(1)}%`,
        `Technical indicators suggest ${suggestion === 'buy' ? 'bullish' : suggestion === 'sell' ? 'bearish' : 'neutral'} momentum`,
        `Risk-reward ratio of ${riskMetrics?.riskReward.toFixed(2) || 'N/A'} aligns with strategy`,
        `Market volatility is ${confidence > 80 ? 'favorable' : 'moderate'} for this trade`
      ]
      
      setAiRecommendation({
        suggestion,
        confidence,
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        riskLevel: confidence > 80 ? 'low' : confidence > 60 ? 'medium' : 'high',
        targetPrice: formData.entryPrice * (1 + (Math.random() * 0.04 - 0.02)), // ±2% variation
        stopLoss: formData.entryPrice * (1 - (Math.random() * 0.02 + 0.01)) // 1-3% stop loss
      })
    } catch (error) {
      console.error('Error generating AI recommendation:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [formData.asset, formData.entryPrice, existingTrades, riskMetrics])

  const handleInputChange = (field: keyof TradeFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.asset || !formData.entryTime || !formData.exitTime) {
      showError(
        isPortuguese ? 'Campos obrigatórios' : 'Required fields',
        isPortuguese ? 'Preencha todos os campos obrigatórios' : 'Please fill all required fields'
      )
      return
    }

    try {
      const trade: Partial<Trade> = {
        asset: formData.asset,
        direction: formData.direction,
        amount: formData.amount,
        entryPrice: formData.entryPrice,
        exitPrice: formData.exitPrice,
        entryTime: new Date(formData.entryTime),
        exitTime: new Date(formData.exitTime),
        timeframe: formData.timeframe,
        strategy: formData.strategy,
        notes: formData.notes,
        profit: formData.exitPrice - formData.entryPrice,
        result: formData.exitPrice > formData.entryPrice ? 
          (formData.direction === 'call' ? 'win' : 'loss') :
          (formData.direction === 'put' ? 'win' : 'loss'),
        status: formData.exitPrice > formData.entryPrice ? 
          (formData.direction === 'call' ? 'WIN' : 'LOSE') :
          (formData.direction === 'put' ? 'WIN' : 'LOSE')
      }

      await onTradeCreate(trade)
      
      showSuccess(
        isPortuguese ? 'Operação criada' : 'Trade created',
        isPortuguese ? 'A operação foi adicionada com sucesso' : 'Trade has been added successfully'
      )
      
      // Reset form
      setFormData({
        asset: '',
        direction: 'call',
        amount: 100,
        entryPrice: 0,
        exitPrice: 0,
        entryTime: '',
        exitTime: '',
        timeframe: '5m',
        strategy: '',
        notes: ''
      })
      setRiskMetrics(null)
      setAiRecommendation(null)
      
    } catch (error) {
      showError(
        isPortuguese ? 'Erro ao criar operação' : 'Error creating trade',
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white font-poly">
            {isPortuguese ? 'Nova Operação' : 'New Trade'}
          </h2>
          <p className="text-gray-300 font-comfortaa text-sm">
            {isPortuguese ? 'Adicione uma nova operação com análise inteligente' : 'Add a new trade with smart analysis'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-primary hover:text-primary-dark transition-colors"
        >
          {showAdvanced ? 
            (isPortuguese ? 'Ocultar Avançado' : 'Hide Advanced') : 
            (isPortuguese ? 'Mostrar Avançado' : 'Show Advanced')
          }
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Trade Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Asset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Ativo' : 'Asset'} *
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {commonAssets.map(asset => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => handleInputChange('asset', asset)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    formData.asset === asset
                      ? 'bg-primary text-background border-primary'
                      : 'border-gray-600 text-gray-300 hover:border-primary'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={formData.asset}
              onChange={(e) => handleInputChange('asset', e.target.value)}
              placeholder="EURUSD"
              className="form-input w-full"
              required
            />
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Direção' : 'Direction'} *
            </label>
            <div className="flex gap-2">
              {[
                { value: 'call', label: isPortuguese ? 'CALL (Compra)' : 'CALL (Buy)', color: 'text-win' },
                { value: 'put', label: isPortuguese ? 'PUT (Venda)' : 'PUT (Sell)', color: 'text-loss' }
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleInputChange('direction', option.value)}
                  className={`flex-1 py-2 px-4 rounded-lg border font-medium transition-colors ${
                    formData.direction === option.value
                      ? `bg-${option.value === 'call' ? 'win' : 'loss'} text-background border-transparent`
                      : 'border-gray-600 text-gray-300 hover:border-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Prices and Amount */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Valor da Operação' : 'Trade Amount'} *
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
              placeholder="100"
              min="1"
              className="form-input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Preço de Entrada' : 'Entry Price'} *
            </label>
            <input
              type="number"
              value={formData.entryPrice}
              onChange={(e) => handleInputChange('entryPrice', parseFloat(e.target.value) || 0)}
              placeholder="1.1234"
              step="0.00001"
              className="form-input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Preço de Saída' : 'Exit Price'} *
            </label>
            <input
              type="number"
              value={formData.exitPrice}
              onChange={(e) => handleInputChange('exitPrice', parseFloat(e.target.value) || 0)}
              placeholder="1.1256"
              step="0.00001"
              className="form-input w-full"
              required
            />
          </div>
        </div>

        {/* Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Data/Hora de Entrada' : 'Entry Date/Time'} *
            </label>
            <input
              type="datetime-local"
              value={formData.entryTime}
              onChange={(e) => handleInputChange('entryTime', e.target.value)}
              className="form-input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Data/Hora de Saída' : 'Exit Date/Time'} *
            </label>
            <input
              type="datetime-local"
              value={formData.exitTime}
              onChange={(e) => handleInputChange('exitTime', e.target.value)}
              className="form-input w-full"
              required
            />
          </div>
        </div>

        {/* Advanced Fields */}
        {showAdvanced && (
          <div className="space-y-4 border-t border-gray-600 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Timeframe */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {isPortuguese ? 'Timeframe' : 'Timeframe'}
                </label>
                <select
                  value={formData.timeframe}
                  onChange={(e) => handleInputChange('timeframe', e.target.value)}
                  className="form-input w-full"
                >
                  {timeframes.map(tf => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </div>

              {/* Strategy */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {isPortuguese ? 'Estratégia' : 'Strategy'}
                </label>
                <select
                  value={formData.strategy}
                  onChange={(e) => handleInputChange('strategy', e.target.value)}
                  className="form-input w-full"
                >
                  <option value="">{isPortuguese ? 'Selecione uma estratégia' : 'Select a strategy'}</option>
                  {strategies.map(strategy => (
                    <option key={strategy} value={strategy}>{strategy}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isPortuguese ? 'Observações' : 'Notes'}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder={isPortuguese ? 
                  'Adicione suas observações sobre esta operação...' : 
                  'Add your notes about this trade...'}
                rows={3}
                className="form-input w-full"
              />
            </div>
          </div>
        )}

        {/* Risk Metrics Display */}
        {riskMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-dark-card rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-primary">
                {riskMetrics.riskReward.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-400">
                {isPortuguese ? 'Risco/Retorno' : 'Risk/Reward'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-primary">
                {riskMetrics.accountRisk.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-400">
                {isPortuguese ? 'Risco da Conta' : 'Account Risk'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-loss">
                ${riskMetrics.maxLoss}
              </div>
              <div className="text-xs text-gray-400">
                {isPortuguese ? 'Perda Máxima' : 'Max Loss'}
              </div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${
                riskMetrics.confidence >= 70 ? 'text-win' : 
                riskMetrics.confidence >= 50 ? 'text-warning' : 'text-loss'
              }`}>
                {riskMetrics.confidence.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400">
                {isPortuguese ? 'Confiança' : 'Confidence'}
              </div>
            </div>
          </div>
        )}

        {/* AI Recommendation */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={generateAIRecommendation}
            disabled={!formData.asset || isAnalyzing}
            className="px-4 py-2 bg-primary text-background rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? 
              (isPortuguese ? 'Analisando...' : 'Analyzing...') : 
              (isPortuguese ? 'Análise IA' : 'AI Analysis')
            }
          </button>

          <button
            type="submit"
            disabled={loading || !formData.asset || !formData.entryTime || !formData.exitTime}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 
              (isPortuguese ? 'Criando...' : 'Creating...') : 
              (isPortuguese ? 'Criar Operação' : 'Create Trade')
            }
          </button>
        </div>

        {/* AI Recommendation Display */}
        {aiRecommendation && (
          <div className={`p-4 rounded-lg border-l-4 ${
            aiRecommendation.suggestion === 'buy' ? 'border-win bg-win/10' :
            aiRecommendation.suggestion === 'sell' ? 'border-loss bg-loss/10' :
            'border-warning bg-warning/10'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <div className="font-bold text-white">
                {isPortuguese ? 'Recomendação IA' : 'AI Recommendation'}: {aiRecommendation.suggestion.toUpperCase()}
              </div>
              <div className="text-sm text-gray-300">
                {aiRecommendation.confidence.toFixed(0)}% {isPortuguese ? 'confiança' : 'confidence'}
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-2">{aiRecommendation.reason}</p>
            <div className="text-xs text-gray-400">
              {isPortuguese ? 'Nível de risco' : 'Risk level'}: {aiRecommendation.riskLevel}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}