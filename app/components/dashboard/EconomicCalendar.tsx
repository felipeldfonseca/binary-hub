'use client'

import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface EconomicEvent {
  id: string
  time: string
  currency: string
  event: string
  impact: 'high' | 'medium' | 'low'
  forecast?: string
  previous?: string
  actual?: string
}

interface EconomicCalendarProps {
  date?: Date
  isLoading?: boolean
}

// Mock data - in a real app, this would come from an economic calendar API
const mockEconomicEvents: EconomicEvent[] = [
  {
    id: '1',
    time: '08:30',
    currency: 'USD',
    event: 'Non-Farm Payrolls',
    impact: 'high',
    forecast: '200K',
    previous: '187K',
    actual: '215K'
  },
  {
    id: '2',
    time: '08:30',
    currency: 'USD',
    event: 'Unemployment Rate',
    impact: 'high',
    forecast: '3.6%',
    previous: '3.7%'
  },
  {
    id: '3',
    time: '10:00',
    currency: 'USD',
    event: 'ISM Services PMI',
    impact: 'medium',
    forecast: '52.8',
    previous: '53.1'
  },
  {
    id: '4',
    time: '14:00',
    currency: 'EUR',
    event: 'ECB Interest Rate Decision',
    impact: 'high',
    forecast: '4.50%',
    previous: '4.50%'
  },
  {
    id: '5',
    time: '15:30',
    currency: 'GBP',
    event: 'BoE Governor Speech',
    impact: 'medium'
  }
]

export default function EconomicCalendar({ date = new Date(), isLoading = false }: EconomicCalendarProps) {
  const { isPortuguese } = useLanguage()
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [selectedImpact, setSelectedImpact] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  // Translations
  const texts = {
    title: isPortuguese ? 'Calendário Econômico' : 'Economic Calendar',
    today: isPortuguese ? 'Hoje' : 'Today',
    time: isPortuguese ? 'Hora' : 'Time',
    currency: isPortuguese ? 'Moeda' : 'Currency', 
    event: isPortuguese ? 'Evento' : 'Event',
    impact: isPortuguese ? 'Impacto' : 'Impact',
    forecast: isPortuguese ? 'Previsão' : 'Forecast',
    previous: isPortuguese ? 'Anterior' : 'Previous',
    actual: isPortuguese ? 'Atual' : 'Actual',
    high: isPortuguese ? 'Alto' : 'High',
    medium: isPortuguese ? 'Médio' : 'Medium',
    low: isPortuguese ? 'Baixo' : 'Low',
    all: isPortuguese ? 'Todos' : 'All',
    noEvents: isPortuguese ? 'Nenhum evento hoje' : 'No events today',
    loading: isPortuguese ? 'Carregando eventos...' : 'Loading events...'
  }

  // Simulate API call
  useEffect(() => {
    const timer = setTimeout(() => {
      setEvents(mockEconomicEvents)
    }, 1000)

    return () => clearTimeout(timer)
  }, [date])

  // Filter events by impact
  const filteredEvents = selectedImpact === 'all' 
    ? events 
    : events.filter(event => event.impact === selectedImpact)

  // Get impact color
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  // Get currency flag emoji
  const getCurrencyFlag = (currency: string) => {
    const flags: { [key: string]: string } = {
      'USD': '🇺🇸',
      'EUR': '🇪🇺',
      'GBP': '🇬🇧',
      'JPY': '🇯🇵',
      'AUD': '🇦🇺',
      'CAD': '🇨🇦',
      'CHF': '🇨🇭',
      'NZD': '🇳🇿'
    }
    return flags[currency] || '🏳️'
  }

  // Check if time has passed (for styling)
  const hasTimePassed = (eventTime: string) => {
    const now = new Date()
    const [hours, minutes] = eventTime.split(':').map(Number)
    const eventDate = new Date()
    eventDate.setHours(hours, minutes, 0, 0)
    return now > eventDate
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-200 bg-opacity-20 rounded mb-4 w-1/3 animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-200 bg-opacity-10 rounded animate-pulse">
              <div className="h-4 bg-gray-200 bg-opacity-20 rounded w-12"></div>
              <div className="h-4 bg-gray-200 bg-opacity-20 rounded w-8"></div>
              <div className="h-4 bg-gray-200 bg-opacity-20 rounded flex-1"></div>
              <div className="h-4 bg-gray-200 bg-opacity-20 rounded w-16"></div>
            </div>
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
        <div className="text-sm text-gray-300 font-comfortaa">
          {date.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Impact filter */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-gray-300 font-comfortaa mr-2">
          {texts.impact}:
        </span>
        {(['all', 'high', 'medium', 'low'] as const).map((impact) => (
          <button
            key={impact}
            onClick={(e) => {
              setSelectedImpact(impact)
              e.currentTarget.blur()
            }}
            className={`px-3 py-1 rounded-full text-xs font-comfortaa transition-colors focus:outline-none ${
              selectedImpact === impact
                ? 'bg-[#E1FFD9] text-[#505050] font-semibold'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {texts[impact]}
          </button>
        ))}
      </div>

      {/* Events list */}
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-lg mb-2">📅</div>
            <p className="text-gray-400 font-comfortaa">{texts.noEvents}</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`flex items-center gap-4 p-4 bg-gray-800/20 hover:bg-gray-800/40 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 ${
                hasTimePassed(event.time) ? 'opacity-60' : ''
              }`}
            >
              {/* Time */}
              <div className="text-sm font-mono text-gray-300 w-16">
                {event.time}
              </div>

              {/* Impact indicator */}
              <div className={`w-3 h-3 rounded-full ${getImpactColor(event.impact)}`}></div>

              {/* Currency with flag */}
              <div className="flex items-center gap-2 w-20">
                <span className="text-lg">{getCurrencyFlag(event.currency)}</span>
                <span className="text-sm font-semibold text-white">{event.currency}</span>
              </div>

              {/* Event name */}
              <div className="flex-1">
                <div className="text-sm font-comfortaa font-medium text-white">
                  {event.event}
                </div>
              </div>

              {/* Data values */}
              <div className="flex items-center gap-4 text-xs">
                {event.forecast && (
                  <div className="text-center">
                    <div className="text-gray-400">{texts.forecast}</div>
                    <div className="text-white font-semibold">{event.forecast}</div>
                  </div>
                )}
                {event.previous && (
                  <div className="text-center">
                    <div className="text-gray-400">{texts.previous}</div>
                    <div className="text-white font-semibold">{event.previous}</div>
                  </div>
                )}
                {event.actual && (
                  <div className="text-center">
                    <div className="text-gray-400">{texts.actual}</div>
                    <div className={`font-semibold ${
                      event.forecast && parseFloat(event.actual) > parseFloat(event.forecast)
                        ? 'text-green-400'
                        : event.forecast && parseFloat(event.actual) < parseFloat(event.forecast)
                        ? 'text-red-400'
                        : 'text-white'
                    }`}>
                      {event.actual}
                    </div>
                  </div>
                )}
              </div>

              {/* Status indicator */}
              {hasTimePassed(event.time) && (
                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400 font-comfortaa text-center">
        {isPortuguese ? 
          'Dados econômicos podem afetar significativamente os mercados' : 
          'Economic data may significantly impact market movements'
        }
      </div>
    </div>
  )
}