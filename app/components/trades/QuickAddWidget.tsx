'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useToastHelpers } from '@/components/ui/Toast'

interface QuickAddWidgetProps {
  onAddTrade: (tradeData: Partial<Trade>) => Promise<Trade>
  isOpen: boolean
  onToggle: () => void
  loading?: boolean
  className?: string
}

interface QuickTradeForm {
  asset: string
  direction: 'call' | 'put'
  amount: string
  entryPrice: string
  exitPrice: string
  timeframe: string
  result: 'win' | 'loss' | 'tie'
  notes: string
}

const initialForm: QuickTradeForm = {
  asset: '',
  direction: 'call',
  amount: '',
  entryPrice: '',
  exitPrice: '',
  timeframe: '5min',
  result: 'win',
  notes: ''
}

const popularAssets = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
  'BTC/USD', 'ETH/USD', 'Gold', 'Silver', 'Oil',
  'S&P 500', 'NASDAQ', 'Apple', 'Google', 'Tesla'
]

const timeframes = ['1min', '5min', '15min', '30min', '1h', '4h', '1d']

export default function QuickAddWidget({
  onAddTrade,
  isOpen,
  onToggle,
  loading = false,
  className = ''
}: QuickAddWidgetProps) {
  const { isPortuguese } = useLanguage()
  const { showSuccess, showError } = useToastHelpers()
  const [form, setForm] = useState<QuickTradeForm>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAssetSuggestions, setShowAssetSuggestions] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const assetInputRef = useRef<HTMLInputElement>(null)

  // Filter asset suggestions
  const filteredAssets = popularAssets.filter(asset =>
    asset.toLowerCase().includes(form.asset.toLowerCase())
  ).slice(0, 5)

  // Handle form input changes
  const handleInputChange = useCallback((field: keyof QuickTradeForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    
    if (field === 'asset') {
      setShowAssetSuggestions(value.length > 0)
    }
  }, [])

  // Handle asset selection from suggestions
  const handleAssetSelect = useCallback((asset: string) => {
    setForm(prev => ({ ...prev, asset }))
    setShowAssetSuggestions(false)
    assetInputRef.current?.blur()
  }, [])

  // Calculate profit based on form data
  const calculateProfit = useCallback(() => {
    const amount = parseFloat(form.amount) || 0
    const entry = parseFloat(form.entryPrice) || 0
    const exit = parseFloat(form.exitPrice) || 0
    
    if (amount === 0 || entry === 0 || exit === 0) return 0
    
    if (form.result === 'win') {
      return amount * 0.8 // Assuming 80% payout
    } else if (form.result === 'loss') {
      return -amount
    }
    return 0 // tie
  }, [form])

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!form.asset.trim()) {
      showError(
        isPortuguese ? 'Erro' : 'Error',
        isPortuguese ? 'Ativo é obrigatório' : 'Asset is required'
      )
      return
    }
    
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showError(
        isPortuguese ? 'Erro' : 'Error',
        isPortuguese ? 'Valor deve ser maior que zero' : 'Amount must be greater than zero'
      )
      return
    }
    
    if (!form.entryPrice || parseFloat(form.entryPrice) <= 0) {
      showError(
        isPortuguese ? 'Erro' : 'Error',
        isPortuguese ? 'Preço de entrada inválido' : 'Invalid entry price'
      )
      return
    }
    
    if (!form.exitPrice || parseFloat(form.exitPrice) <= 0) {
      showError(
        isPortuguese ? 'Erro' : 'Error',
        isPortuguese ? 'Preço de saída inválido' : 'Invalid exit price'
      )
      return
    }

    setIsSubmitting(true)
    
    try {
      const now = new Date()
      const profit = calculateProfit()
      
      const tradeData: Partial<Trade> = {
        asset: form.asset.trim().toUpperCase(),
        direction: form.direction,
        amount: parseFloat(form.amount),
        entryPrice: parseFloat(form.entryPrice),
        exitPrice: parseFloat(form.exitPrice),
        entryTime: now,
        exitTime: new Date(now.getTime() + 5 * 60000), // 5 minutes later
        timeframe: form.timeframe,
        candleTime: form.timeframe,
        refunded: 0,
        executed: parseFloat(form.amount),
        status: form.result === 'win' ? 'WIN' : 'LOSE',
        result: form.result,
        profit,
        payout: form.result === 'win' ? parseFloat(form.amount) * 1.8 : 0,
        platform: 'Manual Entry',
        notes: form.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      }

      await onAddTrade(tradeData)
      
      showSuccess(
        isPortuguese ? 'Sucesso!' : 'Success!',
        isPortuguese ? 'Operação adicionada com sucesso' : 'Trade added successfully'
      )
      
      // Reset form
      setForm(initialForm)
      onToggle() // Close widget
      
    } catch (error) {
      console.error('Error adding trade:', error)
      showError(
        isPortuguese ? 'Erro' : 'Error',
        isPortuguese ? 'Falha ao adicionar operação' : 'Failed to add trade'
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [form, calculateProfit, onAddTrade, showSuccess, showError, isPortuguese, onToggle])

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setShowAssetSuggestions(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get profit display
  const profitDisplay = calculateProfit()
  const profitColor = profitDisplay > 0 ? 'text-win' : profitDisplay < 0 ? 'text-error' : 'text-neutral'

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={onToggle}
        className={`
          fixed bottom-6 right-6 z-50 
          w-14 h-14 bg-primary text-background rounded-full 
          shadow-lg hover:shadow-xl transition-all duration-300
          flex items-center justify-center
          ${isOpen ? 'rotate-45' : 'hover:scale-110'}
          ${className}
        `}
        title={isPortuguese ? 'Adicionar Operação Rápida' : 'Quick Add Trade'}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Widget Panel */}
      <div className={`
        fixed bottom-20 right-6 z-40 w-80 max-w-[calc(100vw-2rem)]
        transition-all duration-300 ease-in-out transform-gpu
        ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95 pointer-events-none'}
      `}>
        <div
          ref={formRef}
          className="card shadow-2xl border-2 border-primary/30 backdrop-blur-lg bg-background/90"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">
              {isPortuguese ? 'Adicionar Operação' : 'Add Trade'}
            </h3>
            <button
              onClick={onToggle}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Asset - with autocomplete */}
            <div className="relative">
              <label className="block text-xs text-white/70 mb-1">
                {isPortuguese ? 'Ativo' : 'Asset'}
              </label>
              <input
                ref={assetInputRef}
                type="text"
                value={form.asset}
                onChange={(e) => handleInputChange('asset', e.target.value)}
                onFocus={() => setShowAssetSuggestions(form.asset.length > 0)}
                placeholder={isPortuguese ? 'EUR/USD, BTC/USD...' : 'EUR/USD, BTC/USD...'}
                className="form-input w-full text-sm"
                required
              />
              
              {/* Asset Suggestions */}
              {showAssetSuggestions && filteredAssets.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-white/20 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                  {filteredAssets.map((asset) => (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => handleAssetSelect(asset)}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {asset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Direction & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">
                  {isPortuguese ? 'Direção' : 'Direction'}
                </label>
                <select
                  value={form.direction}
                  onChange={(e) => handleInputChange('direction', e.target.value)}
                  className="form-input w-full text-sm"
                >
                  <option value="call">📈 CALL</option>
                  <option value="put">📉 PUT</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-white/70 mb-1">
                  {isPortuguese ? 'Valor' : 'Amount'}
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  placeholder="100.00"
                  step="0.01"
                  min="0.01"
                  className="form-input w-full text-sm"
                  required
                />
              </div>
            </div>

            {/* Entry & Exit Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">
                  {isPortuguese ? 'Entrada' : 'Entry'}
                </label>
                <input
                  type="number"
                  value={form.entryPrice}
                  onChange={(e) => handleInputChange('entryPrice', e.target.value)}
                  placeholder="1.0850"
                  step="0.0001"
                  min="0"
                  className="form-input w-full text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs text-white/70 mb-1">
                  {isPortuguese ? 'Saída' : 'Exit'}
                </label>
                <input
                  type="number"
                  value={form.exitPrice}
                  onChange={(e) => handleInputChange('exitPrice', e.target.value)}
                  placeholder="1.0870"
                  step="0.0001"
                  min="0"
                  className="form-input w-full text-sm"
                  required
                />
              </div>
            </div>

            {/* Timeframe & Result */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">
                  {isPortuguese ? 'Tempo' : 'Timeframe'}
                </label>
                <select
                  value={form.timeframe}
                  onChange={(e) => handleInputChange('timeframe', e.target.value)}
                  className="form-input w-full text-sm"
                >
                  {timeframes.map(tf => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs text-white/70 mb-1">
                  {isPortuguese ? 'Resultado' : 'Result'}
                </label>
                <select
                  value={form.result}
                  onChange={(e) => handleInputChange('result', e.target.value as 'win' | 'loss' | 'tie')}
                  className="form-input w-full text-sm"
                >
                  <option value="win">✅ {isPortuguese ? 'Vitória' : 'Win'}</option>
                  <option value="loss">❌ {isPortuguese ? 'Derrota' : 'Loss'}</option>
                  <option value="tie">➖ {isPortuguese ? 'Empate' : 'Tie'}</option>
                </select>
              </div>
            </div>

            {/* Profit Preview */}
            {(form.amount && form.entryPrice && form.exitPrice) && (
              <div className="text-center py-2 px-3 bg-white/5 rounded-lg">
                <div className="text-xs text-white/70 mb-1">
                  {isPortuguese ? 'Lucro Estimado' : 'Expected Profit'}
                </div>
                <div className={`font-semibold ${profitColor}`}>
                  {profitDisplay > 0 ? '+' : ''}${Math.abs(profitDisplay).toFixed(2)}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs text-white/70 mb-1">
                {isPortuguese ? 'Observações' : 'Notes'} ({isPortuguese ? 'opcional' : 'optional'})
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder={isPortuguese ? 'Estratégia, setup, observações...' : 'Strategy, setup, observations...'}
                rows={2}
                className="form-input w-full text-sm resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full btn-primary py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                  {isPortuguese ? 'Adicionando...' : 'Adding...'}
                </div>
              ) : (
                isPortuguese ? 'Adicionar Operação' : 'Add Trade'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={onToggle}
        />
      )}
    </>
  )
}