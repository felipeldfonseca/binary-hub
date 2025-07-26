export default function MissionSectionPT() {
  return (
    <section className="py-20 bg-primary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Side - Phrases */}
          <div className="space-y-4">
            <h2 className="font-poly text-4xl font-bold text-gray-600">
              Padrões Mapeados.
            </h2>
            <h2 className="font-poly text-4xl font-bold text-gray-600">
              Decisões Melhores.
            </h2>
          </div>
          {/* Right Side - Mission Statement */}
          <div className="space-y-6">
            <p className="text-lg font-medium text-gray-600 leading-relaxed">
              Binary Hub capacita todos os negociadores de opções binárias a operar com a mesma ciência de dados disponível para grandes players nos mercados tradicionais.
            </p>
            <a href="/about" className="text-primary underline font-medium">Saiba mais</a>
          </div>
        </div>
      </div>
    </section>
  );
} 