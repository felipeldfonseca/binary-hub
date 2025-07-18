import { mockEconomicEvents } from '@/lib/mockData'

export default function EventsSection() {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-3xl font-bold">Daily Events</h2>
          <div className="text-sm text-gray-600">
            Today • {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {mockEconomicEvents.map((event) => (
            <div key={event.id} className="card border-l-4 border-l-primary">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-text">{event.time}</div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(event.impact)}`}>
                    {event.impact.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <h3 className="font-semibold text-text mb-3">{event.event}</h3>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 mb-1">Previous</p>
                  <p className="font-medium">{event.previous || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Forecast</p>
                  <p className="font-medium">{event.forecast || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Actual</p>
                  <p className="font-medium">{event.actual || 'Pending'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Events are updated under demand. High impact events may significantly affect market volatility.
          </p>
        </div>
      </div>
    </section>
  )
} 