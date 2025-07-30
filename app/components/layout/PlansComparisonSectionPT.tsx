import Link from 'next/link'
import CheckIcon from '@/components/icons/CheckIcon'

export default function PlansComparisonSectionPT() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4 sm:px-8 lg:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
              Compare nossos <span className="text-primary">planos</span>
            </h2>
            <p className="text-xl font-comfortaa font-semibold text-white max-w-3xl mx-auto">
              Escolha o plano que melhor se adapta às suas necessidades de trading
            </p>
          </div>

          {/* Plans Comparison */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Free Plan */}
            <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700">
              <div className="text-center mb-8">
                <h3 className="font-poly text-2xl font-bold text-white mb-4">Grátis</h3>
                <div className="text-4xl font-bold text-primary mb-2">R$ 0</div>
                <p className="text-gray-400">Sempre grátis</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Importação Manual & CSV
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  KPIs Básicos
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Insights de IA Semanais
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Calendário Econômico
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Eventos da Comunidade
                </li>
              </ul>
            </div>

            {/* Premium Plan */}
            <div className="bg-primary/10 p-8 rounded-lg border border-primary relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-dark-background px-4 py-1 rounded-full text-sm font-medium">
                  Mais Popular
                </span>
              </div>
              <div className="text-center mb-8">
                <h3 className="font-poly text-2xl font-bold text-white mb-4">Premium</h3>
                <div className="text-4xl font-bold text-primary mb-2">R$ 97</div>
                <p className="text-gray-400">por mês</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Importação Manual & CSV
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  KPIs Avançados
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Insights de IA Diários
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Calendário Econômico Completo
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Dashboards Personalizados
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Exportação de Dados
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Suporte Prioritário
                </li>
                <li className="flex items-center text-gray-300">
                  <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  Teste Gratuito de 14 Dias
                </li>
              </ul>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Link
              href="/plans?lang=pt"
              className="btn-primary font-comfortaa font-bold transition-all duration-300 hover:scale-105 text-lg px-8 py-4 max-xl:text-base max-xl:px-6 max-xl:py-3 max-md:text-sm max-md:px-4 max-md:py-2"
            >
              Ver planos completos
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
} 