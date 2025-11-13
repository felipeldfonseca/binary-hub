export default function CommunityFeaturesSection() {
  return (
    <section className="py-20 bg-gray-900/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-poly text-3xl font-bold text-text mb-4">
            Nossa Comunidade Está <span className="text-primary">Nascendo</span>
          </h2>
          <p className="text-gray-400 max-w-3xl mx-auto">
            Seja um dos primeiros membros fundadores e ajude a construir a melhor comunidade de trading do Brasil
          </p>
        </div>

        {/* Current Features */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-white mb-8 text-center">Recursos Sociais Disponíveis</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-6 bg-gray-800/50">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-3">Perfis Públicos de Trader</h4>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• Compartilhe métricas com controle de privacidade</li>
                <li>• Mostre suas conquistas e especialidades</li>
                <li>• Construa reputação baseada em resultados</li>
              </ul>
            </div>

            <div className="card p-6 bg-gray-800/50">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-3">Feed Social Inteligente</h4>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• Timeline com insights e análises de qualidade</li>
                <li>• Filtros por tipo de estratégia e ativo</li>
                <li>• Algoritmo que destaca conteúdo relevante</li>
              </ul>
            </div>

            <div className="card p-6 bg-gray-800/50">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-3">Sistema de Seguidores</h4>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• Siga traders que admira e respeita</li>
                <li>• Receba notificações de suas melhores análises</li>
                <li>• Construa sua própria base de seguidores</li>
              </ul>
            </div>
          </div>
        </div>


        {/* Founder Benefits */}
        <div className="card p-8 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-primary mb-4">Vantagens de Membro Fundador</h3>
            <p className="text-white mb-6">
              Seja um dos primeiros e ganhe benefícios exclusivos permanentes
            </p>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-primary font-semibold mb-2">Badge Exclusivo</div>
                <div className="text-gray-300">Identificação permanente de fundador</div>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-primary font-semibold mb-2">Acesso Antecipado</div>
                <div className="text-gray-300">Teste novos recursos antes de todos</div>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-primary font-semibold mb-2">Voz Ativa</div>
                <div className="text-gray-300">Influencie o desenvolvimento da comunidade</div>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-primary font-semibold mb-2">Networking Premium</div>
                <div className="text-gray-300">Conecte-se com outros fundadores</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}