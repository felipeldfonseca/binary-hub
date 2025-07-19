'use client'

import { useEffect, useState } from 'react'

const testimonials = [
  {
    text: "Finally understand why I was losing money.",
    author: "@traderJP"
  },
  {
    text: "My win-rate jumped 12% in two weeks.",
    author: "@anaOptions"
  },
  {
    text: "The data insights completely changed my strategy.",
    author: "@cryptoTrader"
  },
  {
    text: "Finally have clarity on my trading performance.",
    author: "@dayTraderPro"
  },
  {
    text: "This tool helped me identify my biggest weaknesses.",
    author: "@swingTrader"
  }
]

export default function SocialProofSection() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Create a longer array by repeating testimonials for infinite loop
  const carouselItems = [...testimonials, ...testimonials, ...testimonials]

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1
        // If we're in the middle section, just continue
        if (nextIndex < testimonials.length * 2) {
          return nextIndex
        }
        // If we're at the end of middle section, jump to start of middle section
        return testimonials.length
      })
    }, 6000) // 6 seconds as specified

    return () => clearInterval(interval)
  }, [])

  const handleDotClick = (index: number) => {
    setIsTransitioning(true)
    // Map dot index to middle section of carousel
    setCurrentIndex(index + testimonials.length)
    setTimeout(() => setIsTransitioning(false), 1000)
  }

  // Get the actual testimonial index for dots (middle section)
  const actualIndex = currentIndex >= testimonials.length && currentIndex < testimonials.length * 2 
    ? currentIndex - testimonials.length 
    : currentIndex % testimonials.length

  return (
    <section id="testimonials" className="py-20 bg-background">
      <div className="container mx-auto px-4 text-center">
        {/* Section Title */}
        <h2 className="font-poly text-4xl font-bold text-white mb-16">
          Real Traders. <span className="text-primary">Real Wins.</span>
        </h2>

        {/* Testimonial Carousel */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="overflow-hidden">
              <div 
                className="flex transition-transform duration-1000 ease-in-out"
                style={{ 
                  transform: `translateX(-${currentIndex * 100}%)`,
                  transition: isTransitioning ? 'transform 1s ease-in-out' : 'none'
                }}
              >
                {carouselItems.map((testimonial, index) => (
                  <div 
                    key={index}
                    className="w-full flex-shrink-0 px-8"
                  >
                    <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700">
                      <blockquote className="text-2xl text-white mb-6 leading-relaxed">
                        "{testimonial.text}"
                      </blockquote>
                      <cite className="text-primary font-semibold text-lg">
                        — {testimonial.author}
                      </cite>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Dots */}
            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === actualIndex 
                      ? 'bg-primary' 
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 