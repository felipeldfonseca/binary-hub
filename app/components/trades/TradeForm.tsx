'use client'

import React, { useState, useCallback } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useToastHelpers } from '@/components/ui/Toast'

interface TradeFormProps {
  onSubmit: (tradeData: Partial<Trade>) => Promise<void>
  initialData?: Partial<Trade>
  loading?: boolean
  onCancel?: () => void
  isEdit?: boolean
}

interface FormData {
  asset: string
  direction: 'call' | 'put'
  amount: string
  entryPrice: string
  exitPrice: string
  entryTime: string
  exitTime: string
  timeframe: string
  result: 'win' | 'loss' | 'tie'
  strategy: string
  notes: string
}

interface FormErrors {
  [key: string]: string
}

const TradeForm: React.FC<TradeFormProps> = ({
  onSubmit,
  initialData,
  loading = false,
  onCancel,
  isEdit = false,
}) => {
  const { isPortuguese } = useLanguage()
  const { showError } = useToastHelpers()

  const translations = {
    en: {
      title: isEdit ? 'Edit Trade' : 'Add New Trade',
      asset: 'Asset',
      assetPlaceholder: 'e.g., EURUSD, GBPUSD',
      direction: 'Direction',
      call: 'Call',
      put: 'Put',
      amount: 'Trade Amount ($)',
      amountPlaceholder: '25.00',
      entryPrice: 'Entry Price',
      entryPricePlaceholder: '1.0850',
      exitPrice: 'Exit Price',
      exitPricePlaceholder: '1.0870',
      entryTime: 'Entry Time',
      exitTime: 'Exit Time',
      timeframe: 'Timeframe',
      timeframePlaceholder: '5M, 15M, 1H',
      result: 'Result',
      win: 'Win',
      loss: 'Loss',
      tie: 'Tie',
      strategy: 'Strategy (Optional)',
      strategyPlaceholder: 'Support/Resistance, Trend Following, etc.',
      notes: 'Notes (Optional)',
      notesPlaceholder: 'Additional notes about this trade...',
      submit: isEdit ? 'Update Trade' : 'Add Trade',
      cancel: 'Cancel',
      requiredField: 'This field is required',
      invalidNumber: 'Please enter a valid number',
      invalidPrice: 'Please enter a valid price (up to 5 decimal places)',
      invalidAmount: 'Amount must be greater than 0',
      invalidDateTime: 'Please enter a valid date and time',
      exitBeforeEntry: 'Exit time must be after entry time',
    },
    pt: {
      title: isEdit ? 'Editar Operação' : 'Adicionar Nova Operação',
      asset: 'Ativo',
      assetPlaceholder: 'ex.: EURUSD, GBPUSD',
      direction: 'Direção',
      call: 'Call',
      put: 'Put',
      amount: 'Valor da Operação ($)',
      amountPlaceholder: '25.00',
      entryPrice: 'Preço de Entrada',
      entryPricePlaceholder: '1.0850',
      exitPrice: 'Preço de Saída',
      exitPricePlaceholder: '1.0870',
      entryTime: 'Hora de Entrada',
      exitTime: 'Hora de Saída',
      timeframe: 'Timeframe',
      timeframePlaceholder: '5M, 15M, 1H',
      result: 'Resultado',
      win: 'Ganho',
      loss: 'Perda',
      tie: 'Empate',
      strategy: 'Estratégia (Opcional)',
      strategyPlaceholder: 'Suporte/Resistência, Seguindo Tendência, etc.',
      notes: 'Observações (Opcional)',
      notesPlaceholder: 'Observações adicionais sobre esta operação...',
      submit: isEdit ? 'Atualizar Operação' : 'Adicionar Operação',
      cancel: 'Cancelar',
      requiredField: 'Este campo é obrigatório',
      invalidNumber: 'Por favor, insira um número válido',
      invalidPrice: 'Por favor, insira um preço válido (até 5 casas decimais)',
      invalidAmount: 'O valor deve ser maior que 0',
      invalidDateTime: 'Por favor, insira uma data e hora válidas',
      exitBeforeEntry: 'A hora de saída deve ser posterior à hora de entrada',
    }
  }

  const t = translations[isPortuguese ? 'pt' : 'en']

  // Initialize form data
  const [formData, setFormData] = useState<FormData>(() => {
    const now = new Date()
    const defaultEntryTime = now.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:mm
    const defaultExitTime = new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16) // 5 minutes later

    return {
      asset: initialData?.asset || '',
      direction: initialData?.direction || 'call',
      amount: initialData?.amount?.toString() || '',
      entryPrice: initialData?.entryPrice?.toString() || '',
      exitPrice: initialData?.exitPrice?.toString() || '',
      entryTime: initialData?.entryTime ? new Date(initialData.entryTime).toISOString().slice(0, 16) : defaultEntryTime,
      exitTime: initialData?.exitTime ? new Date(initialData.exitTime).toISOString().slice(0, 16) : defaultExitTime,
      timeframe: initialData?.timeframe || '5M',
      result: initialData?.result || 'win',
      strategy: initialData?.strategy || '',
      notes: initialData?.notes || '',
    }
  })

  const [errors, setErrors] = useState<FormErrors>({})

  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }, [errors])

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    // Required fields
    if (!formData.asset.trim()) {
      newErrors.asset = t.requiredField
    }

    if (!formData.amount.trim()) {
      newErrors.amount = t.requiredField
    } else {
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = t.invalidAmount
      }
    }

    if (!formData.entryPrice.trim()) {
      newErrors.entryPrice = t.requiredField
    } else {
      const price = parseFloat(formData.entryPrice)
      if (isNaN(price) || price <= 0) {
        newErrors.entryPrice = t.invalidPrice
      }
    }

    if (!formData.exitPrice.trim()) {
      newErrors.exitPrice = t.requiredField
    } else {
      const price = parseFloat(formData.exitPrice)
      if (isNaN(price) || price <= 0) {
        newErrors.exitPrice = t.invalidPrice
      }
    }

    if (!formData.entryTime) {
      newErrors.entryTime = t.requiredField
    }

    if (!formData.exitTime) {
      newErrors.exitTime = t.requiredField
    }

    // Validate entry time is before exit time
    if (formData.entryTime && formData.exitTime) {
      const entryDate = new Date(formData.entryTime)
      const exitDate = new Date(formData.exitTime)
      if (exitDate <= entryDate) {
        newErrors.exitTime = t.exitBeforeEntry
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, t])

  const calculateProfit = useCallback((): number => {
    const amount = parseFloat(formData.amount)
    const entryPrice = parseFloat(formData.entryPrice)
    const exitPrice = parseFloat(formData.exitPrice)

    if (isNaN(amount) || isNaN(entryPrice) || isNaN(exitPrice)) {
      return 0
    }

    if (formData.result === 'win') {
      return amount * 0.8 // 80% payout typical for binary options
    } else if (formData.result === 'loss') {
      return -amount
    } else {
      return 0 // Tie
    }
  }, [formData])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      showError('Validation Error', 'Please fix the errors above')
      return
    }

    try {
      const tradeData: Partial<Trade> = {
        asset: formData.asset.trim().toUpperCase(),
        direction: formData.direction,
        amount: parseFloat(formData.amount),
        entryPrice: parseFloat(formData.entryPrice),
        exitPrice: parseFloat(formData.exitPrice),
        entryTime: new Date(formData.entryTime),
        exitTime: new Date(formData.exitTime),
        timeframe: formData.timeframe.trim(),
        result: formData.result,
        status: formData.result === 'win' ? 'WIN' : 'LOSE',
        profit: calculateProfit(),
        payout: formData.result === 'win' ? parseFloat(formData.amount) + calculateProfit() : 0,
        strategy: formData.strategy.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        platform: 'Manual Entry',
      }

      await onSubmit(tradeData)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }, [formData, validateForm, calculateProfit, onSubmit, showError])

  const InputField: React.FC<{
    label: string
    type: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    error?: string
    required?: boolean
    step?: string
  }> = ({ label, type, value, onChange, placeholder, error, required, step }) => (
    <div className="space-y-1">
      <label className="block text-sm font-comfortaa font-medium text-gray-200">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`form-input w-full ${error ? 'border-red-500' : 'border-gray-600'}`}
        step={step}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )

  const SelectField: React.FC<{
    label: string
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
    error?: string
    required?: boolean
  }> = ({ label, value, onChange, options, error, required }) => (
    <div className="space-y-1">
      <label className="block text-sm font-comfortaa font-medium text-gray-200">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`form-input w-full ${error ? 'border-red-500' : 'border-gray-600'}`}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="bg-gray-800 text-white">
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
      <h3 className="text-xl font-comfortaa font-semibold mb-6">{t.title}</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Trade Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label={t.asset}
            type="text"
            value={formData.asset}
            onChange={(value) => handleInputChange('asset', value)}
            placeholder={t.assetPlaceholder}
            error={errors.asset}
            required
          />

          <SelectField
            label={t.direction}
            value={formData.direction}
            onChange={(value) => handleInputChange('direction', value)}
            options={[
              { value: 'call', label: t.call },
              { value: 'put', label: t.put },
            ]}
            error={errors.direction}
            required
          />

          <InputField
            label={t.amount}
            type="number"
            value={formData.amount}
            onChange={(value) => handleInputChange('amount', value)}
            placeholder={t.amountPlaceholder}
            error={errors.amount}
            step="0.01"
            required
          />
        </div>

        {/* Price Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label={t.entryPrice}
            type="number"
            value={formData.entryPrice}
            onChange={(value) => handleInputChange('entryPrice', value)}
            placeholder={t.entryPricePlaceholder}
            error={errors.entryPrice}
            step="0.00001"
            required
          />

          <InputField
            label={t.exitPrice}
            type="number"
            value={formData.exitPrice}
            onChange={(value) => handleInputChange('exitPrice', value)}
            placeholder={t.exitPricePlaceholder}
            error={errors.exitPrice}
            step="0.00001"
            required
          />
        </div>

        {/* Time Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label={t.entryTime}
            type="datetime-local"
            value={formData.entryTime}
            onChange={(value) => handleInputChange('entryTime', value)}
            error={errors.entryTime}
            required
          />

          <InputField
            label={t.exitTime}
            type="datetime-local"
            value={formData.exitTime}
            onChange={(value) => handleInputChange('exitTime', value)}
            error={errors.exitTime}
            required
          />

          <InputField
            label={t.timeframe}
            type="text"
            value={formData.timeframe}
            onChange={(value) => handleInputChange('timeframe', value)}
            placeholder={t.timeframePlaceholder}
            error={errors.timeframe}
          />
        </div>

        {/* Result Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField
            label={t.result}
            value={formData.result}
            onChange={(value) => handleInputChange('result', value)}
            options={[
              { value: 'win', label: t.win },
              { value: 'loss', label: t.loss },
              { value: 'tie', label: t.tie },
            ]}
            error={errors.result}
            required
          />

          <div className="space-y-1">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              Calculated Profit
            </label>
            <div className={`form-input ${calculateProfit() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${calculateProfit().toFixed(2)}
            </div>
          </div>
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label={t.strategy}
            type="text"
            value={formData.strategy}
            onChange={(value) => handleInputChange('strategy', value)}
            placeholder={t.strategyPlaceholder}
            error={errors.strategy}
          />

          <div className="space-y-1">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.notes}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder={t.notesPlaceholder}
              rows={3}
              className="form-input w-full resize-none"
            />
            {errors.notes && <p className="text-red-400 text-xs mt-1">{errors.notes}</p>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-white/20">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {t.cancel}
            </button>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-8 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>}
            <span>{t.submit}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default TradeForm