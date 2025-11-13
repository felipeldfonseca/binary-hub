'use client'

import React from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export type ConquistasVersion = 'v1' | 'v2' | 'v3'

interface ConquistasVersionSelectorProps {
  currentVersion: ConquistasVersion
  onVersionChange: (version: ConquistasVersion) => void
}

const conquistasVersionInfo = {
  v1: {
    name: (isPortuguese: boolean) => isPortuguese ? 'Gamificação Profissional' : 'Professional Gamification',
    description: (isPortuguese: boolean) => isPortuguese 
      ? 'Sistema completo de conquistas com níveis XP, rankings e desafios diários'
      : 'Complete achievement system with XP levels, rankings, and daily challenges',
    icon: (
      <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    color: 'from-purple-800/20 to-pink-800/20',
    features: (isPortuguese: boolean) => isPortuguese 
      ? ['Sistema de Níveis XP', 'Série de Vitórias', 'Conquistas por Categoria', 'Ranking Competitivo', 'Desafios Diários', 'Metas de Progresso']
      : ['XP Level System', 'Win Streaks', 'Category Achievements', 'Competitive Ranking', 'Daily Challenges', 'Progress Goals']
  },
  v2: {
    name: (isPortuguese: boolean) => isPortuguese ? 'Jornada Visual' : 'Visual Journey',
    description: (isPortuguese: boolean) => isPortuguese
      ? 'Jornada visual gamificada com níveis simples, marcos e desafios diários'
      : 'Gamified visual journey with simple levels, milestones and daily challenges',
    icon: (
      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'from-blue-800/20 to-indigo-800/20',
    features: (isPortuguese: boolean) => isPortuguese 
      ? ['Sistema de Níveis Simples', 'Marco de Conquistas', 'Progressão Visual', 'Desafios Diários', 'Mensagens Motivacionais', 'Estatísticas Fáceis']
      : ['Simple Level System', 'Achievement Milestones', 'Visual Progression', 'Daily Challenges', 'Motivational Messages', 'Easy Stats']
  },
  v3: {
    name: (isPortuguese: boolean) => isPortuguese ? 'Comunidade Social' : 'Social Community',
    description: (isPortuguese: boolean) => isPortuguese
      ? 'Experiência social divertida com amigos, desafios em grupo e comparações amigáveis'
      : 'Fun social experience with friends, group challenges and friendly comparisons',
    icon: (
      <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'from-pink-800/20 to-purple-800/20',
    features: (isPortuguese: boolean) => isPortuguese 
      ? ['Sistema de Amigos', 'Desafios em Grupo', 'Ranking da Comunidade', 'Conquistas Sociais', 'Comparação com Pares', 'Motivação Social']
      : ['Friend System', 'Group Challenges', 'Community Rankings', 'Social Achievements', 'Peer Comparison', 'Social Motivation']
  }
}

export default function ConquistasVersionSelector({ currentVersion, onVersionChange }: ConquistasVersionSelectorProps) {
  const { isPortuguese } = useLanguage()

  return (
    <div className="mb-8">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">
          {isPortuguese ? 'Escolha a Versão de Conquistas' : 'Choose Achievement Version'}
        </h2>
        <p className="text-gray-400 text-sm">
          {isPortuguese ? 'Selecione a versão que melhor atende às suas necessidades' : 'Select the version that best fits your needs'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(conquistasVersionInfo).map(([version, info]) => (
          <button
            key={version}
            onClick={() => onVersionChange(version as ConquistasVersion)}
            className={`bg-gray-800/50 rounded-lg p-6 text-left transition-all duration-300 transform hover:scale-105 border ${
              currentVersion === version 
                ? `bg-gradient-to-r ${info.color} border-[#E1FFD9]/50 shadow-lg shadow-[#E1FFD9]/20` 
                : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/70'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              {info.icon}
              <div>
                <h3 className="font-bold text-white">
                  V{version.charAt(1)} - {info.name(isPortuguese)}
                </h3>
                <p className="text-xs text-gray-400">{info.description(isPortuguese)}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              {info.features(isPortuguese).map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                  <div className="w-1.5 h-1.5 bg-[#E1FFD9] rounded-full"></div>
                  {feature}
                </div>
              ))}
            </div>

            {currentVersion === version && (
              <div className="mt-3 pt-3 border-t border-[#E1FFD9]/20">
                <div className="flex items-center gap-2 text-[#E1FFD9] text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isPortuguese ? 'Versão Ativa' : 'Active Version'}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}