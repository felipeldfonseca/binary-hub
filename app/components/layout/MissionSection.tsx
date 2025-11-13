export default function MissionSection() {
  return (
    <section className="py-20 bg-primary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Side - Phrases */}
          <div className="space-y-4">
            <h2 className="font-poly text-4xl font-bold text-gray-600">
              Multi-Mercado. Inteligente.
            </h2>
            <h2 className="font-poly text-4xl font-bold text-gray-600">
              IA Campeã. Educação.
            </h2>
          </div>
          
          {/* Right Side - Mission Statement */}
          <div className="space-y-6">
            <p className="text-lg font-medium text-gray-600 leading-relaxed">
              Binary Hub é a plataforma definitiva de educação em trading, onde traders de TODOS os mercados evoluem suas habilidades através de IA campeã em competições e aprendizado colaborativo.
            </p>
            <p className="text-base text-gray-700 leading-relaxed">
              Usando os únicos modelos de IA que foram lucrativos em competições reais (+117% retorno), conectamos traders de Binary Options, Forex, Crypto e Futuros em uma comunidade focada em crescimento sustentável.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 