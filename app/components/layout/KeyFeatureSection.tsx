export default function KeyFeatureSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="font-poly text-3xl font-bold text-center mb-16 text-text">
          Sua Jornada: <span className="text-primary">Do Individual ao Comunitário</span>
        </h2>

        <div className="space-y-16">
          {/* Phase 1: Individual Foundation */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="lg:order-1">
              <div className="bg-gray-800/50 rounded-lg p-8">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-4 text-gray-800 font-bold">1</div>
                  <h3 className="font-poly text-2xl font-bold text-primary">Autoconhecimento Individual</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="text-white font-semibold mb-2">IA Personalizada:</h4>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Análise completa do histórico</li>
                        <li>• Padrões únicos identificados</li>
                        <li>• Insights comportamentais</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">Observação Social:</h4>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Feed público disponível</li>
                        <li>• Estratégias de traders experientes</li>
                        <li>• Aprendizado sem pressão</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <p className="text-primary font-medium mt-6 italic">
                  "Clareza total sobre seu perfil de trader"
                </p>
              </div>
            </div>
            
            <div className="lg:order-2">
              <div className="bg-gray-700 rounded-lg p-8 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <p className="text-sm">Dashboard Individual + IA</p>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 2: Community Engagement */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="lg:order-2">
              <div className="bg-gray-800/50 rounded-lg p-8">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-4 text-gray-800 font-bold">2</div>
                  <h3 className="font-poly text-2xl font-bold text-primary">Crescimento Colaborativo</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="text-white font-semibold mb-2">Otimização Contínua:</h4>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Métricas personalizadas</li>
                        <li>• Alertas em tempo real</li>
                        <li>• Relatórios semanais</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">Interação Social:</h4>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Primeiras conexões</li>
                        <li>• Discussões técnicas</li>
                        <li>• Traders compatíveis</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <p className="text-primary font-medium mt-6 italic">
                  "Performance melhorada + conexões iniciais"
                </p>
              </div>
            </div>
            
            <div className="lg:order-1">
              <div className="bg-gray-700 rounded-lg p-8 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 7h-.79l-.28-.9C17.18 5.46 16.65 5 16 5s-1.18.46-1.47 1.1L14.25 7h-.79a1.5 1.5 0 0 0-1.42 1.37L9.5 16H12v6h4z"/>
                  </svg>
                  <p className="text-sm">Rede Social + Analytics</p>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 3: Leadership */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="lg:order-1">
              <div className="bg-gray-800/50 rounded-lg p-8">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-4 text-gray-800 font-bold">3</div>
                  <h3 className="font-poly text-2xl font-bold text-primary">Liderança Comunitária</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="text-white font-semibold mb-2">Maestria Individual:</h4>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Estilo completamente dominado</li>
                        <li>• IA cada vez mais sofisticada</li>
                        <li>• Performance consistente</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-2">Impacto Social:</h4>
                      <ul className="text-gray-300 space-y-1">
                        <li>• Mentoria de novos traders</li>
                        <li>• Liderança de discussões</li>
                        <li>• Análises colaborativas</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <p className="text-primary font-medium mt-6 italic">
                  "Maestria individual + liderança comunitária"
                </p>
              </div>
            </div>
            
            <div className="lg:order-2">
              <div className="bg-gray-700 rounded-lg p-8 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <p className="text-sm">Liderança + Mentoria</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 