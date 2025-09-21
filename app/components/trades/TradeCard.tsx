'use client'

import React, { useState } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { format } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'

interface TradeCardProps {
  trade: Trade
  onEdit?: (trade: Trade) => void
  onDelete?: (tradeId: string) => void
  onDragStart?: (e: React.DragEvent, trade: Trade) => void
  onClick?: (trade: Trade) => void
  className?: string
  isDragging?: boolean
}

export default function TradeCard({
  trade,
  onEdit,
  onDelete,
  onDragStart,
  onClick,
  className = '',
  isDragging = false
}: TradeCardProps) {
  const { isPortuguese } = useLanguage()
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)

  const isWin = trade.result === 'win'
  const isLoss = trade.result === 'loss'
  const isTie = trade.result === 'tie'

  // Format currency based on language
  const formatCurrency = (value: number) => {
    const currency = isPortuguese ? 'BRL' : 'USD'
    const symbol = isPortuguese ? 'R$' : '$'
    return `${symbol} ${Math.abs(value).toFixed(2)}`
  }

  // Format date
  const formatDate = (date: Date) => {
    const dateObj = new Date(date)
    return format(dateObj, 'dd/MM/yyyy HH:mm', {
      locale: isPortuguese ? ptBR : enUS
    })
  }

  // Get result color classes
  const getResultClasses = () => {
    if (isWin) return 'border-win/30 bg-win/5 shadow-win/20'
    if (isLoss) return 'border-error/30 bg-error/5 shadow-error/20'
    return 'border-neutral/30 bg-neutral/5 shadow-neutral/20'
  }

  // Get badge classes
  const getBadgeClasses = () => {
    if (isWin) return 'badge-win'
    if (isLoss) return 'badge-loss'
    return 'bg-neutral text-white px-2 py-1 rounded-full text-xs font-semibold'
  }

  // Get profit display
  const getProfitDisplay = () => {
    if (isWin) return `+${formatCurrency(trade.profit)}`
    if (isLoss) return `-${formatCurrency(Math.abs(trade.profit))}`
    return formatCurrency(trade.profit)
  }

  const getProfitColor = () => {
    if (isWin) return 'text-win'
    if (isLoss) return 'text-error'
    return 'text-neutral'
  }

  // Get direction display
  const getDirectionDisplay = () => {
    if (trade.direction === 'call') {
      return isPortuguese ? '▲ CALL' : '▲ CALL'
    }
    return isPortuguese ? '▼ PUT' : '▼ PUT'
  }

  const getDirectionColor = () => {
    return trade.direction === 'call' ? 'text-win' : 'text-error'
  }

  return (
    <div
      className={`
        card relative cursor-pointer transition-all duration-300 ease-in-out
        hover:scale-105 hover:shadow-2xl group
        ${getResultClasses()}
        ${isDragging ? 'opacity-50 rotate-3 scale-95' : ''}
        ${className}
      `}
      onClick={() => onClick?.(trade)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart?.(e, trade)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary text-sm tracking-wide">
            #{trade.tradeId.slice(-4)}
          </span>
          <span className={`font-bold text-sm ${getBadgeClasses()}`}>
            {isWin ? (isPortuguese ? 'VITÓRIA' : 'WIN') : 
             isLoss ? (isPortuguese ? 'DERROTA' : 'LOSS') : 
             (isPortuguese ? 'EMPATE' : 'TIE')}
          </span>
        </div>
        
        {/* Quick Actions (shown on hover) */}
        <div className={`
          flex gap-1 transition-opacity duration-200
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(trade)
              }}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title={isPortuguese ? 'Editar' : 'Edit'}
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(trade.id)
              }}
              className="p-1.5 rounded-full bg-error/10 hover:bg-error/20 transition-colors"
              title={isPortuguese ? 'Excluir' : 'Delete'}
            >
              <svg className="w-3 h-3 text-error" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Asset & Direction */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white tracking-wide">
          {trade.asset}
        </h3>
        <span className={`text-sm font-semibold ${getDirectionColor()}`}>
          {getDirectionDisplay()}
        </span>
      </div>

      {/* Profit/Loss - Main metric */}
      <div className="text-center mb-4">
        <div className={`text-2xl font-bold mb-1 ${getProfitColor()}`}>
          {getProfitDisplay()}
        </div>
        <div className="text-xs text-white/70">
          {isPortuguese ? 'Resultado' : 'P&L'}
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="text-center">
          <div className="text-white/70 mb-1">
            {isPortuguese ? 'Entrada' : 'Entry'}
          </div>
          <div className="font-semibold text-white">
            {formatCurrency(trade.entryPrice)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-white/70 mb-1">
            {isPortuguese ? 'Saída' : 'Exit'}
          </div>
          <div className="font-semibold text-white">
            {formatCurrency(trade.exitPrice)}
          </div>
        </div>
      </div>

      {/* Amount & Timeframe */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="text-center">
          <div className="text-white/70 mb-1">
            {isPortuguese ? 'Valor' : 'Amount'}
          </div>
          <div className="font-semibold text-white">
            {formatCurrency(trade.amount)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-white/70 mb-1">
            {isPortuguese ? 'Tempo' : 'Timeframe'}
          </div>
          <div className="font-semibold text-primary">
            {trade.timeframe}
          </div>
        </div>
      </div>

      {/* Strategy & Platform */}
      {(trade.strategy || trade.platform) && (
        <div className="flex gap-2 mb-3 text-xs">
          {trade.strategy && (
            <span className="bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
              {trade.strategy}
            </span>
          )}
          {trade.platform && (
            <span className="bg-white/10 text-white/80 px-2 py-1 rounded-full">
              {trade.platform}
            </span>
          )}
        </div>
      )}

      {/* Screenshots Preview */}
      {trade.screenshots && trade.screenshots.length > 0 && (
        <div className="mb-3">
          <div className="flex gap-1">
            {trade.screenshots.slice(0, 3).map((screenshot, index) => (
              <div key={index} className="relative">
                {!imageError ? (
                  <img
                    src={screenshot}
                    alt={`Trade screenshot ${index + 1}`}
                    className="w-8 h-8 rounded object-cover border border-white/20"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-white/10 border border-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {trade.screenshots.length > 3 && (
              <div className="w-8 h-8 rounded bg-white/10 border border-white/20 flex items-center justify-center text-xs text-white/70">
                +{trade.screenshots.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes Preview */}
      {trade.notes && (
        <div className="mb-3">
          <p className="text-xs text-white/80 line-clamp-2 italic">
            "{trade.notes.length > 50 ? trade.notes.substring(0, 50) + '...' : trade.notes}"
          </p>
        </div>
      )}

      {/* Footer - Date */}
      <div className="text-xs text-white/60 flex items-center justify-between pt-2 border-t border-white/10">
        <span>{formatDate(trade.entryTime)}</span>
        {/* Win rate indicator for similar setups could go here */}
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${
            isWin ? 'bg-win' : isLoss ? 'bg-error' : 'bg-neutral'
          }`}></div>
        </div>
      </div>

      {/* Drag indicator */}
      {onDragStart && (
        <div className={`
          absolute top-2 left-2 opacity-0 transition-opacity duration-200
          ${isHovered ? 'opacity-50' : ''}
        `}>
          <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </div>
      )}
    </div>
  )
}