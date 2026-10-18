'use client'

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { AuthUser } from '@/lib/auth'

interface WelcomeStepProps {
  user: AuthUser | null
  onNext: () => void
}

export default function WelcomeStep({ user, onNext }: WelcomeStepProps) {
  const { isPortuguese } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        className="text-center max-w-2xl"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Logo */}
        <motion.div 
          className="flex items-center justify-center space-x-2 mb-8"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex items-center space-x-1 text-4xl">
            <div className="logo-poly font-normal text-primary">
              binary
            </div>
            <div className="bg-primary text-dark-background px-3 py-1 rounded-15px font-poly text-dark-background font-normal">
              hub
            </div>
          </div>
        </motion.div>

        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 font-comfortaa">
            {isPortuguese 
              ? `Bem-vindo${user?.displayName ? `, ${user.displayName}` : ''}!` 
              : `Welcome${user?.displayName ? `, ${user.displayName}` : ''}!`
            }
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            {isPortuguese
              ? 'Você acabou de se juntar à primeira plataforma de educação de trading universal com insights de IA vencedores de campeonatos!'
              : "You've just joined the first universal trading education platform with championship-winning AI insights!"
            }
          </p>
        </motion.div>

        {/* Achievement Badge */}
        <motion.div
          className="inline-flex items-center gap-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-full px-6 py-3 mb-12"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <div className="text-2xl">🏆</div>
          <div className="text-white">
            <div className="font-semibold text-sm">
              {isPortuguese ? 'Conquista Desbloqueada' : 'Achievement Unlocked'}
            </div>
            <div className="text-xs text-yellow-400">
              {isPortuguese ? 'Novo Membro da Comunidade' : 'New Community Member'}
            </div>
          </div>
        </motion.div>

        {/* Fun Facts */}
        <motion.div 
          className="grid md:grid-cols-3 gap-6 mb-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <div className="text-3xl mb-2">🤖</div>
            <div className="text-2xl font-bold text-primary mb-1">+117%</div>
            <div className="text-sm text-gray-300">
              {isPortuguese ? 'Desempenho da IA Qwen3 Max' : 'Qwen3 Max AI Performance'}
            </div>
          </div>
          
          <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-2xl font-bold text-primary mb-1">5</div>
            <div className="text-sm text-gray-300">
              {isPortuguese ? 'Mercados Suportados' : 'Supported Markets'}
            </div>
          </div>
          
          <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
            <div className="text-3xl mb-2">📚</div>
            <div className="text-2xl font-bold text-primary mb-1">∞</div>
            <div className="text-sm text-gray-300">
              {isPortuguese ? 'Conteúdo Educacional' : 'Educational Content'}
            </div>
          </div>
        </motion.div>

        {/* Continue Button */}
        <motion.button
          onClick={onNext}
          className="bg-gradient-to-r from-primary to-blue-500 text-white font-semibold px-8 py-4 rounded-full text-lg hover:from-primary/90 hover:to-blue-500/90 transition-all duration-300 transform hover:scale-105"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isPortuguese ? 'Vamos começar! 🚀' : "Let's get started! 🚀"}
        </motion.button>

        {/* Skip Option */}
        <motion.p 
          className="text-gray-400 text-sm mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
        >
          {isPortuguese 
            ? 'Este processo levará apenas 2 minutos'
            : 'This process will take just 2 minutes'
          }
        </motion.p>
      </motion.div>
    </div>
  )
}