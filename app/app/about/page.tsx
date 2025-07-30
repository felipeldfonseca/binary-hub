'use client'
import PublicRoute from '../../components/auth/PublicRoute'
import Navbar from '../../components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import FooterPT from '@/components/layout/FooterPT'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function AboutPage() {
  const { isPortuguese } = useLanguage()

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
              <div className="text-left mb-16">
                <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 font-poly">
                  {isPortuguese ? 'Sobre o ' : 'About '}<span className="text-primary">{isPortuguese ? 'Binary Hub' : 'Binary Hub'}</span>
                </h1>
              </div>

              {/* Content Sections */}
              <div className="space-y-16">
                {/* Mission Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8 font-poly">
                    {isPortuguese ? 'Nossa Missão' : 'Our Mission'}
                  </h2>
                  <p className="text-lg text-white leading-relaxed mb-6">
                    {isPortuguese 
                      ? 'Empoderar traders de opções binárias a tomar decisões melhores e mais consistentes através de ferramentas profissionais de gestão de portfólio, registro abrangente, análises avançadas e insights impulsionados por IA.'
                      : 'To empower binary options traders to make better, more consistent decisions through professional portfolio management tools, comprehensive journaling, advanced analytics, and AI-driven insights.'
                    }
                  </p>
                  <p className="text-lg text-white leading-relaxed mb-6">
                    {isPortuguese
                      ? 'Nosso objetivo é transformar dados em clareza, disciplina e melhoria constante, ajudando você a estruturar sua rotina, medir o que importa e melhorar seus resultados operação após operação.'
                      : 'Our goal is to transform data into clarity, discipline, and constant improvement, helping you structure your routine, measure what matters, and improve your results trade after trade.'
                    }
                  </p>
                  <p className="text-lg text-white leading-relaxed">
                    {isPortuguese
                      ? 'Acreditamos que o desempenho sustentável depende não apenas de entradas bem-sucedidas, mas também de entender seus padrões, aprender com seus erros e evoluir continuamente.'
                      : 'We believe that sustainable performance depends not only on successful entries, but also on understanding your patterns, learning from your mistakes, and continually evolving.'
                    }
                  </p>
                </section>

                {/* Features Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8 font-poly">
                    {isPortuguese ? 'O Que Oferecemos' : 'What We Offer'}
                  </h2>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">
                        {isPortuguese ? 'Registro Inteligente' : 'Smart Journaling'}
                      </h3>
                      <p className="text-gray-300">
                        {isPortuguese
                          ? 'Acompanhe suas operações com formulários inteligentes que se adaptam ao seu estilo de trading e capturam todos os detalhes que importam para sua análise.'
                          : 'Track your trades with intelligent forms that adapt to your trading style and capture all the details that matter for your analysis.'
                        }
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">
                        {isPortuguese ? 'Análises Avançadas' : 'Advanced Analytics'}
                      </h3>
                      <p className="text-gray-300">
                        {isPortuguese
                          ? 'Obtenha insights profundos sobre seu desempenho de trading com gráficos abrangentes, estatísticas e métricas de performance.'
                          : 'Get deep insights into your trading performance with comprehensive charts, statistics, and performance metrics.'
                        }
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">
                        {isPortuguese ? 'Insights de IA' : 'AI Insights'}
                      </h3>
                      <p className="text-gray-300">
                        {isPortuguese
                          ? 'Aproveite a inteligência artificial para identificar padrões, sugerir melhorias e obter recomendações personalizadas de trading.'
                          : 'Leverage artificial intelligence to identify patterns, suggest improvements, and get personalized trading recommendations.'
                        }
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">
                        {isPortuguese ? 'Eventos da Comunidade' : 'Community Events'}
                      </h3>
                      <p className="text-gray-300">
                        {isPortuguese
                          ? 'Conecte-se com outros traders, participe de eventos e aprenda com a sabedoria coletiva da comunidade de trading.'
                          : 'Connect with other traders, participate in events, and learn from the collective wisdom of the trading community.'
                        }
                      </p>
                    </div>
                  </div>
                </section>

                {/* Team Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8 font-poly">
                    {isPortuguese ? 'Nossa Equipe' : 'Our Team'}
                  </h2>
                  <p className="text-lg text-white leading-relaxed">
                    {isPortuguese
                      ? 'O Binary Hub é construído por traders, para traders. Nossa equipe combina anos de experiência em trading com tecnologia de ponta para criar ferramentas que realmente ajudam você a melhorar seu desempenho de trading.'
                      : 'Binary Hub is built by traders, for traders. Our team combines years of trading experience with cutting-edge technology to create tools that actually help you improve your trading performance.'
                    }
                  </p>
                </section>
              </div>
            </div>
          </div>
        </main>
        {isPortuguese ? <FooterPT /> : <Footer />}
      </div>
    </PublicRoute>
  )
} 