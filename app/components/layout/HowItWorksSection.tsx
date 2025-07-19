export default function HowItWorksSection() {
  const features = [
    {
      icon: (
        <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
        </svg>
      ),
      title: "Connect & Import",
      description: "Upload a CSV or record trades in seconds."
    },
    {
      icon: (
        <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
        </svg>
      ),
      title: "Analyze your trades",
      description: "Automatic KPIs and charts adjusted to your period."
    },
    {
      icon: (
        <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      ),
      title: "Improve faster",
      description: "AI reveals patterns and sends comprehensive reports."
    }
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="font-poly text-3xl font-bold text-center mb-12 text-text">
          From <span className="text-primary">Chaos</span> to <span className="text-primary">Clarity</span>.
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="card text-center p-6">
              {/* Icon */}
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                {feature.icon}
              </div>
              
              {/* Title */}
              <h3 className="font-heading text-xl font-semibold mb-4 text-text">
                {feature.title}
              </h3>
              
              {/* Horizontal Divider */}
              <div className="w-full h-px bg-border mb-4"></div>
              
              {/* Description */}
              <p className="text-primary">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 