'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

interface FAQItem {
  question: string;
  answer: string;
}

const faqs = [
  {
    question: "Is Binary Hub free?",
    answer: "Yes, our Free plan lets you track up to 100 trades per month with core KPIs.",
  },
  {
    question: "Do I need to connect my broker?",
    answer: "No. You can simply upload a CSV export or enter trades manually.",
  },
  {
    question: "Are binary options legal in my country?",
    answer: "Regulations vary. Please check local laws and trade responsibly.",
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