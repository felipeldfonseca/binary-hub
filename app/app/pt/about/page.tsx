import PublicRoute from '../../../components/auth/PublicRoute'
import Navbar from '../../../components/layout/Navbar'

export default function AboutPagePT() {
  return (
    <PublicRoute>
      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <Navbar />
        
        {/* Main Content */}
        <main className="pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-4xl mx-auto">
              {/* Hero Section */}
              <div className="text-center mb-16">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                  Sobre o <span className="text-primary">Binary Hub</span>
                </h1>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                  Capacitando traders com insights inteligentes e ferramentas abrangentes de journaling
                </p>
              </div>

              {/* Content Sections */}
              <div className="space-y-16">
                {/* Mission Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8">Nossa Missão</h2>
                  <p className="text-lg text-gray-300 leading-relaxed">
                    O Binary Hub foi criado com uma missão simples: ajudar traders a tomar melhores decisões 
                    através de journaling abrangente, análises avançadas e insights alimentados por IA. 
                    Acreditamos que o trading bem-sucedido não é apenas sobre fazer os trades certos, 
                    mas sobre entender seus padrões, aprender com seus erros e melhorar continuamente.
                  </p>
                </section>

                {/* Features Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8">O Que Oferecemos</h2>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">Journaling Inteligente</h3>
                      <p className="text-gray-300">
                        Acompanhe seus trades com formulários inteligentes que se adaptam ao seu estilo de trading e 
                        capturam todos os detalhes que importam para sua análise.
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">Análises Avançadas</h3>
                      <p className="text-gray-300">
                        Obtenha insights profundos sobre seu desempenho de trading com gráficos abrangentes, 
                        estatísticas e métricas de performance.
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">Insights de IA</h3>
                      <p className="text-gray-300">
                        Aproveite a inteligência artificial para identificar padrões, sugerir melhorias e 
                        obter recomendações personalizadas de trading.
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">Eventos da Comunidade</h3>
                      <p className="text-gray-300">
                        Conecte-se com outros traders, participe de eventos e aprenda com a 
                        sabedoria coletiva da comunidade de trading.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Team Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8">Nossa Equipe</h2>
                  <p className="text-lg text-gray-300 leading-relaxed">
                    O Binary Hub é construído por traders, para traders. Nossa equipe combina anos de 
                    experiência em trading com tecnologia de ponta para criar ferramentas que realmente 
                    ajudam você a melhorar seu desempenho de trading.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </PublicRoute>
  )
} 