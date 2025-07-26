'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  variant: 'landing' | 'plans'
  language?: 'en' | 'pt' // Made optional since we'll auto-detect
}

const faqContent = {
  landing: {
    en: [
      {
        question: "Is Binary Hub free?",
        answer: "Yes. The Free plan allows up to 100 trades per month with essential KPIs, plus weekly access to AI reports focused on improving your trading performance.",
      },
      {
        question: "Do I need to connect my broker?",
        answer: "No. You can simply upload a CSV or enter trades manually.",
      },
      {
        question: "Are binary options legal in my country?",
        answer: "Regulations vary. Please check local laws and trade responsibly.",
      },
    ],
    pt: [
      {
        question: "O Binary Hub é gratuito?",
        answer: "Sim. O plano Free permite até 100 trades por mês com KPIs essenciais, além de acesso semanal a reportes feitos por IA focados em melhorar o seu operacional.",
      },
      {
        question: "Preciso conectar minha corretora?",
        answer: "Não. Você pode simplesmente fazer upload de um CSV ou inserir manualmente.",
      },
      {
        question: "Opções binárias são legais no meu país?",
        answer: "A regulamentação varia. Verifique as leis locais e opere com responsabilidade.",
      },
    ]
  },
  plans: {
    en: [
      {
        question: "Is my payment and data secure?",
        answer: "Absolutely. Binary Hub never stores your card details. Payments are processed via Stripe/PayPal with PCI-DSS encryption, and your trade data is encrypted at rest and in transit.",
      },
      {
        question: "Which payment methods do you accept?",
        answer: "All major credit cards, PayPal, Apple Pay, and cryptocurrency.",
      },
      {
        question: "Can I pay with crypto?",
        answer: "Yes. Choose \"Crypto\" on the checkout screen and follow the on-screen instructions for monthly or annual plans.",
      },
      {
        question: "Is there a free trial?",
        answer: "Yes—14 days on the Premium plan. Cancel anytime during the trial and you won't be charged.",
      },
      {
        question: "Can I cancel or change plans anytime?",
        answer: "Yes. Upgrade, downgrade, or cancel whenever you like. Downgrades/prorates apply instantly; cancellations stop auto-renew and your paid features stay active until the end of the current term.",
      },
      {
        question: "Will my data be deleted if I cancel?",
        answer: "Your account reverts to the Free plan; data stays preserved for 90 days. You can request permanent deletion at any time under Settings > Privacy.",
      },
      {
        question: "Do you offer refunds?",
        answer: "Monthly plans are non-refundable after the billing date. Annual plans have a 14-day cooling-off period. Contact support within that window for a full refund.",
      },
    ],
    pt: [
      {
        question: "Meu pagamento e dados são seguros?",
        answer: "Absolutamente. O Binary Hub nunca armazena os detalhes do seu cartão. Os pagamentos são processados via Stripe/PayPal com criptografia PCI-DSS, e seus dados de trading são criptografados em repouso e em trânsito.",
      },
      {
        question: "Quais métodos de pagamento vocês aceitam?",
        answer: "Todos os principais cartões de crédito, PayPal, Apple Pay e criptomoedas.",
      },
      {
        question: "Posso pagar com cripto?",
        answer: "Sim. Escolha \"Cripto\" na tela de checkout e siga as instruções na tela para planos mensais ou anuais.",
      },
      {
        question: "Há um teste gratuito?",
        answer: "Sim—14 dias no plano Premium. Cancele a qualquer momento durante o teste e você não será cobrado.",
      },
      {
        question: "Posso cancelar ou mudar planos a qualquer momento?",
        answer: "Sim. Faça upgrade, downgrade ou cancele quando quiser. Downgrades/proratas aplicam-se instantaneamente; cancelamentos param a renovação automática e seus recursos pagos permanecem ativos até o final do período atual.",
      },
      {
        question: "Meus dados serão excluídos se eu cancelar?",
        answer: "Sua conta volta ao plano Free; os dados permanecem preservados por 90 dias. Você pode solicitar exclusão permanente a qualquer momento em Configurações > Privacidade.",
      },
      {
        question: "Vocês oferecem reembolsos?",
        answer: "Planos mensais não são reembolsáveis após a data de cobrança. Planos anuais têm um período de arrependimento de 14 dias. Entre em contato com o suporte dentro dessa janela para um reembolso total.",
      },
    ]
  }
}

const getTitle = (variant: 'landing' | 'plans', language: 'en' | 'pt') => {
  if (variant === 'landing') {
    return language === 'en' ? 'Frequently Asked Questions' : 'Perguntas Frequentes'
  }
  return language === 'en' ? 'Frequently Asked Questions' : 'Perguntas Frequentes'
}

export default function FAQSection({ variant, language }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const pathname = usePathname();
  
  // Auto-detect language from pathname if not provided
  const detectedLanguage = language || (pathname.startsWith('/pt') ? 'pt' : 'en');
  
  // Robust validation with fallbacks
  const validVariant = ['landing', 'plans'].includes(variant) ? variant : 'landing'
  const validLanguage = ['en', 'pt'].includes(detectedLanguage) ? detectedLanguage : 'en'
  
  const faqs = faqContent[validVariant][validLanguage]
  const title = getTitle(validVariant, validLanguage)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="pt-24 sm:pt-32 pb-24 sm:pb-32">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-poly text-3xl font-bold">{title}</h2>
        </div>
        
        <dl className="mt-12">
          {faqs.map((faq, index) => (
            <div key={index} className="divide-y divide-white/10 border-b border-white/10">
              <dt className="py-6">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="flex w-full items-start justify-between text-left focus:outline-none focus:ring-0 focus:border-0 active:outline-none active:ring-0 active:border-0 hover:outline-none hover:ring-0 hover:border-0"
                >
                  <span className="text-lg font-semibold leading-7">
                    {faq.question}
                  </span>
                  <Plus
                    className={`ml-6 h-5 w-5 flex-shrink-0 transform transition-transform duration-500 ${
                      openIndex === index ? 'rotate-45' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </dt>
              <dd>
                <div
                  className={`grid transition-all duration-500 ease-in-out ${
                    openIndex === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pt-4 pb-6 text-white">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
} 