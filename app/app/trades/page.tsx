'use client'
import React from 'react'
import Navbar from '@/components/layout/Navbar'
import CsvUploadSection from '@/components/dashboard/CsvUploadSection'
import Footer from '@/components/layout/Footer'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function TradesPage() {
  const { isPortuguese } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
                {isPortuguese ? 'Gerenciar Operações' : 'Manage Trades'}
              </h1>
              <p className="text-xl font-comfortaa font-normal text-white max-w-3xl mx-auto">
                {isPortuguese 
                  ? 'Importe seus dados do Ebinex ou adicione operações manualmente.' 
                  : 'Import your Ebinex data or add trades manually.'
                }
              </p>
            </div>
            
            <CsvUploadSection />
            
            {/* TODO: Add manual trade entry form */}
            {/* TODO: Add trades list/table */}
            {/* TODO: Add trade editing capabilities */}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
} 