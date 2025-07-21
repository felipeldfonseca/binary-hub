'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

interface FAQItem {
  question: string;
  answer: string;
}

const faqs = [
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
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="pt-24 sm:pt-32 pb-24 sm:pb-32">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-poly text-3xl font-bold">Frequently Asked Questions</h2>
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
                    <div className="pt-4 pb-6 text-gray-400">
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