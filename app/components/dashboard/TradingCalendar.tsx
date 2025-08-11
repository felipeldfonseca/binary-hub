'use client'

import React, { useState } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface DayData {
  date: string
  pnl: number
  trades: number
  winRate: number
}

interface TradingCalendarProps {
  data?: DayData[]
  month?: Date
  onMonthChange?: (month: Date) => void
  isLoading?: boolean
}

export default function TradingCalendar({ 
  data = [], 
  month = new Date(), 
  onMonthChange,
  isLoading = false 
}: TradingCalendarProps) {
  const { isPortuguese } = useLanguage()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Translations
  const texts = {
    title: isPortuguese ? 'Calendário de Trading' : 'Trading Calendar',
    noTrades: isPortuguese ? 'Sem trades' : 'No trades',
    trades: isPortuguese ? 'trades' : 'trades',
    winRate: isPortuguese ? 'Taxa de vitória' : 'Win rate',
    pnl: isPortuguese ? 'P&L' : 'P&L',
    today: isPortuguese ? 'Hoje' : 'Today',
    mon: isPortuguese ? 'Seg' : 'Mon',
    tue: isPortuguese ? 'Ter' : 'Tue',
    wed: isPortuguese ? 'Qua' : 'Wed',
    thu: isPortuguese ? 'Qui' : 'Thu',
    fri: isPortuguese ? 'Sex' : 'Fri',
    sat: isPortuguese ? 'Sáb' : 'Sat',
    sun: isPortuguese ? 'Dom' : 'Sun'
  }

  const dayHeaders = [texts.sun, texts.mon, texts.tue, texts.wed, texts.thu, texts.fri, texts.sat]

  // Get days for the current month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const firstDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    
    const days: (Date | null)[] = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  // Get color intensity based on P&L performance
  const getColorIntensity = (pnl: number, maxPnl: number) => {
    if (pnl === 0) return 'bg-gray-700'
    if (pnl > 0) {
      const intensity = Math.min(pnl / maxPnl, 1) * 0.8 + 0.2
      return `bg-green-500` // We'll use style for opacity
    } else {
      const intensity = Math.min(Math.abs(pnl) / Math.abs(maxPnl || 1), 1) * 0.8 + 0.2
      return `bg-red-500` // We'll use style for opacity  
    }
  }

  const maxPnl = data.length > 0 ? Math.max(...data.map(d => Math.abs(d.pnl))) : 100

  // Get data for a specific date
  const getDataForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return data.find(d => d.date === dateStr)
  }

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const days = getDaysInMonth(month)
  
  // Month navigation
  const goToPreviousMonth = () => {
    if (onMonthChange) {
      const newMonth = new Date(month)
      newMonth.setMonth(month.getMonth() - 1)
      onMonthChange(newMonth)
    }
  }
  
  const goToNextMonth = () => {
    if (onMonthChange) {
      const newMonth = new Date(month)
      newMonth.setMonth(month.getMonth() + 1)
      onMonthChange(newMonth)
    }
  }
  
  const goToCurrentMonth = () => {
    if (onMonthChange) {
      onMonthChange(new Date())
    }
  }
  
  // Check if we can go forward (not future months)
  const canGoNext = () => {
    const nextMonth = new Date(month)
    nextMonth.setMonth(month.getMonth() + 1)
    const today = new Date()
    return nextMonth <= new Date(today.getFullYear(), today.getMonth(), 1)
  }
  
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-200 bg-opacity-20 rounded mb-4 w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayHeaders.map((day) => (
            <div key={day} className="h-8 bg-gray-200 bg-opacity-10 rounded animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 bg-opacity-10 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-comfortaa font-semibold text-white">
          {texts.title}
        </h3>
        
        {/* Month Navigation */}
        {onMonthChange && (
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                goToPreviousMonth()
                e.currentTarget.blur()
              }}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none"
              title={isPortuguese ? 'Mês anterior' : 'Previous month'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={(e) => {
                goToCurrentMonth()
                e.currentTarget.blur()
              }}
              className="px-4 py-2 text-sm font-comfortaa font-medium text-gray-300 hover:text-[#E1FFD9] transition-all duration-200 focus:outline-none"
              title={isPortuguese ? 'Mês atual' : 'Current month'}
            >
              {month.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
                year: 'numeric', 
                month: 'long' 
              })}
            </button>
            
            <button
              onClick={(e) => {
                goToNextMonth()
                e.currentTarget.blur()
              }}
              disabled={!canGoNext()}
              className={`p-2 rounded-lg transition-all duration-200 focus:outline-none ${
                canGoNext() 
                  ? 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white' 
                  : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
              }`}
              title={isPortuguese ? 'Próximo mês' : 'Next month'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Display month when no navigation */}
        {!onMonthChange && (
          <div className="text-sm text-gray-300 font-comfortaa">
            {month.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { 
              year: 'numeric', 
              month: 'long' 
            })}
          </div>
        )}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayHeaders.map((day) => (
          <div key={day} className="text-center text-xs text-gray-400 font-comfortaa font-medium p-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map((day, index) => {
          if (!day) {
            return <div key={index} className="aspect-square"></div>
          }

          const dayData = getDataForDate(day)
          const isSelected = selectedDate === day.toISOString().split('T')[0]
          const todayClass = isToday(day) ? 'ring-2 ring-[#E1FFD9]' : ''
          
          let bgClass = 'bg-gray-700'
          let opacity = 0.4
          let boxShadowClass = ''
          
          if (dayData) {
            if (dayData.pnl > 0) {
              bgClass = 'bg-gradient-to-br from-emerald-400 to-green-500'
              opacity = Math.min(dayData.pnl / maxPnl, 1) * 0.7 + 0.5
              boxShadowClass = 'shadow-lg shadow-green-400/30'
            } else if (dayData.pnl < 0) {
              bgClass = 'bg-gradient-to-br from-red-400 to-red-600'
              opacity = Math.min(Math.abs(dayData.pnl) / maxPnl, 1) * 0.7 + 0.5
              boxShadowClass = 'shadow-lg shadow-red-400/30'
            } else {
              bgClass = 'bg-gradient-to-br from-gray-600 to-gray-700'
            }
          }

          return (
            <div
              key={index}
              className={`aspect-square ${bgClass} ${boxShadowClass} rounded-lg cursor-pointer transition-all duration-300 hover:scale-110 hover:z-10 ${todayClass} ${
                isSelected ? 'ring-2 ring-white' : ''
              } flex items-center justify-center relative group border border-transparent hover:border-white/20`}
              style={{ opacity }}
              onClick={() => setSelectedDate(day.toISOString().split('T')[0])}
            >
              <span className="text-xs font-semibold text-white">
                {day.getDate()}
              </span>
              
              {/* Hover tooltip */}
              {dayData && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 whitespace-nowrap">
                  <div>${dayData.pnl.toFixed(2)}</div>
                  <div>{dayData.trades} {texts.trades}</div>
                  <div>{dayData.winRate.toFixed(0)}% WR</div>
                </div>
              )}
              
              {/* Today indicator */}
              {isToday(day) && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#E1FFD9] rounded-full"></div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected date details */}
      {selectedDate && (() => {
        const selected = data.find(d => d.date === selectedDate)
        const selectedDay = new Date(selectedDate)
        
        return (
          <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-comfortaa font-semibold text-white">
                {selectedDay.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h4>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {selected ? (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 font-comfortaa">{texts.pnl}</div>
                  <div className={`font-semibold ${selected.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${selected.pnl.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 font-comfortaa">{texts.trades}</div>
                  <div className="font-semibold text-white">{selected.trades}</div>
                </div>
                <div>
                  <div className="text-gray-400 font-comfortaa">{texts.winRate}</div>
                  <div className="font-semibold text-white">{selected.winRate.toFixed(1)}%</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm font-comfortaa">
                {texts.noTrades}
              </div>
            )}
          </div>
        )
      })()}

      {/* Enhanced Legend */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-comfortaa">
            <span className="text-gray-400">{isPortuguese ? 'Menor atividade' : 'Less activity'}</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-700 rounded border border-gray-600" style={{ opacity: 0.4 }}></div>
              <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-green-500 rounded shadow-sm shadow-green-400/20" style={{ opacity: 0.5 }}></div>
              <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-green-500 rounded shadow shadow-green-400/25" style={{ opacity: 0.7 }}></div>
              <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-green-500 rounded shadow-md shadow-green-400/30" style={{ opacity: 0.9 }}></div>
              <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-green-500 rounded shadow-lg shadow-green-400/40" style={{ opacity: 1.0 }}></div>
            </div>
            <span className="text-gray-400">{isPortuguese ? 'Maior atividade' : 'More activity'}</span>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-comfortaa">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-green-500 rounded shadow-sm shadow-green-400/30"></div>
              <span className="text-gray-300">{isPortuguese ? 'Lucro' : 'Profit'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-br from-red-400 to-red-600 rounded shadow-sm shadow-red-400/30"></div>
              <span className="text-gray-300">{isPortuguese ? 'Prejuízo' : 'Loss'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-700 rounded border border-gray-600"></div>
              <span className="text-gray-300">{isPortuguese ? 'Sem trades' : 'No trades'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}