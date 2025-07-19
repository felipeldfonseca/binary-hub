import Link from 'next/link'

export default function KeyFeatureSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Mock Screenshot */}
          <div className="flex justify-center">
            <div className="w-full max-w-md h-64 bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <p className="text-sm">AI Report Mock</p>
              </div>
            </div>
          </div>
          
          {/* Right Side - Content */}
          <div className="space-y-6 md:text-left text-center">
            <h2 className="font-poly text-3xl font-bold text-text">
              <span className="md:inline block">Your Daily Report by the </span>
              <span className="text-primary md:inline block">Most Powerful AI</span> in the World
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3 md:justify-start justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7"/>
                </svg>
                <p className="text-primary text-lg font-normal">Strategy Analysis</p>
              </div>
              <div className="flex items-center space-x-3 md:justify-start justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7"/>
                </svg>
                <p className="text-primary text-lg font-normal">Pattern Detection</p>
              </div>
              <div className="flex items-center space-x-3 md:justify-start justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7"/>
                </svg>
                <p className="text-primary text-lg font-normal">Performance Overview</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 