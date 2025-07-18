'use client'

import { useState } from 'react'
import { mockCalendarEvents } from '@/lib/mockData'

type CalendarView = 'week' | 'month' | 'year'

export default function CalendarSection() {
  const [selectedView, setSelectedView] = useState<CalendarView>('week')

  const views = [
    { value: 'week' as CalendarView, label: 'Week' },
    { value: 'month' as CalendarView, label: 'Month' },
    { value: 'year' as CalendarView, label: 'Year' },
  ]

  const getColorByResult = (result: string) => {
    switch (result) {
      case 'win': return 'bg-win text-white'
      case 'loss': return 'bg-loss text-white'
      case 'neutral': return 'bg-neutral text-white'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h2 className="font-heading text-3xl font-bold mb-4 md:mb-0">Calendar</h2>
          
          {/* View Filter */}
          <div className="flex gap-2 bg-white p-1 rounded-lg border">
            {views.map((view) => (
              <button
                key={view.value}
                onClick={() => setSelectedView(view.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === view.value
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="card bg-white">
          {selectedView === 'week' && (
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-medium text-gray-600 py-2">
                  {day}
                </div>
              ))}
              {mockCalendarEvents.map((event, index) => (
                <div
                  key={event.date}
                  className={`p-3 rounded-lg text-center text-sm ${getColorByResult(event.result)}`}
                >
                  <div className="font-medium">{15 + index}</div>
                  <div className="text-xs mt-1">
                    {event.result === 'win' ? '+' : event.result === 'loss' ? '-' : ''}
                    ${Math.abs(event.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {selectedView === 'month' && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Monthly calendar view</p>
              <p className="text-sm mt-2">Full month grid with trading results</p>
            </div>
          )}
          
          {selectedView === 'year' && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Yearly calendar view</p>
              <p className="text-sm mt-2">Annual overview with monthly summaries</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
} 