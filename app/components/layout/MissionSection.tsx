export default function MissionSection() {
  return (
    <section className="py-20 bg-primary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Side - Phrases */}
          <div className="space-y-4">
            <h2 className="font-poly text-4xl font-bold text-gray-600">
              Noise Filtered.
            </h2>
            <h2 className="font-poly text-4xl font-bold text-gray-600">
              Insight Formed.
            </h2>
          </div>
          
          {/* Right Side - Mission Statement */}
          <div className="space-y-6">
            <p className="text-lg font-medium text-gray-600 leading-relaxed">
              Binary Hub empowers every binary-options trader to operate with the same data science available to big players in traditional markets.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 