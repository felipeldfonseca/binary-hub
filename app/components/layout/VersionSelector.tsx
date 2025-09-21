'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export type LandingVersion = 'original' | 'animated-v1'

interface VersionSelectorProps {
  currentVersion: LandingVersion
  onVersionChange: (version: LandingVersion) => void
}

const versionInfo = {
  original: {
    name: isPortuguese => isPortuguese ? 'Versão Original' : 'Original Version',
    description: isPortuguese => isPortuguese ? 'Design clássico e profissional com layout estruturado' : 'Classic, professional design with structured layout',
    icon: '📄',
    color: 'from-slate-800/20 to-gray-800/20',
    features: isPortuguese => isPortuguese ? 
      ['Layout estruturado', 'Design profissional', 'Compatibilidade total', 'Carregamento rápido', 'Design responsivo'] :
      ['Structured layout', 'Professional design', 'Full compatibility', 'Fast loading', 'Responsive design'],
    category: 'static'
  },
  'animated-v1': {
    name: isPortuguese => isPortuguese ? 'Performance Animado' : 'Performance Animated',
    description: isPortuguese => isPortuguese ? 'Animações de scroll/parallax com otimização de 60fps' : 'Scroll/parallax animations with 60fps performance optimization',
    icon: '⚡',
    color: 'from-blue-800/20 to-cyan-800/20',
    features: isPortuguese => isPortuguese ?
      ['Camadas de parallax', 'Indicador de progresso', 'Contadores animados', 'Revelação progressiva', 'Aceleração de hardware'] :
      ['Parallax scrolling layers', 'Scroll progress indicator', 'Animated counters', 'Progressive text reveal', 'Hardware acceleration'],
    category: 'animated'
  }
}

// Mini Preview Components
const ScrollProgressPreview = () => {
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => (prev >= 100 ? 0 : prev + 2))
    }, 50)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="w-full h-16 bg-gray-900/50 rounded-md relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gray-700">
        <div 
          className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="p-2 space-y-1">
        <div className="h-2 bg-gray-700 rounded animate-pulse" />
        <div className="h-1.5 bg-gray-800 rounded w-3/4" />
        <div className="h-1.5 bg-gray-800 rounded w-1/2" />
      </div>
      <div className="absolute bottom-1 right-1 text-xs text-blue-400">⚡ 60fps</div>
    </div>
  )
}

const MagneticHoverPreview = () => {
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHovered(prev => !prev)
      if (!hovered) {
        setPosition({ x: Math.random() * 10 - 5, y: Math.random() * 10 - 5 })
      } else {
        setPosition({ x: 0, y: 0 })
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [hovered])
  
  return (
    <div className="w-full h-16 bg-gray-900/50 rounded-md relative overflow-hidden p-2">
      <div 
        className="w-12 h-8 bg-gradient-to-r from-emerald-400 to-teal-400 rounded transition-all duration-300 transform"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) ${hovered ? 'scale(1.1)' : 'scale(1)'}`,
          boxShadow: hovered ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none'
        }}
      />
      <div className="absolute bottom-1 right-1 text-xs text-emerald-400">🎯 Magnetic</div>
    </div>
  )
}

const AuroraPreview = () => {
  const [phase, setPhase] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => prev + 0.1)
    }, 100)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="w-full h-16 bg-gray-900/50 rounded-md relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-60"
        style={{
          background: `linear-gradient(${45 + Math.sin(phase) * 30}deg, 
            rgba(139, 92, 246, ${0.3 + Math.sin(phase) * 0.2}), 
            rgba(168, 85, 247, ${0.2 + Math.cos(phase) * 0.2}), 
            rgba(236, 72, 153, ${0.3 + Math.sin(phase + 1) * 0.2}))`
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              animationDelay: `${i * 200}ms`,
              opacity: 0.3 + Math.sin(phase + i) * 0.3
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-1 right-1 text-xs text-violet-400">✨ Aurora</div>
    </div>
  )
}

const StaticPreview = () => {
  return (
    <div className="w-full h-16 bg-gray-900/50 rounded-md relative overflow-hidden p-2">
      <div className="space-y-1.5">
        <div className="h-2 bg-gray-700 rounded" />
        <div className="h-1.5 bg-gray-800 rounded w-3/4" />
        <div className="h-1.5 bg-gray-800 rounded w-1/2" />
      </div>
      <div className="absolute bottom-1 right-1 text-xs text-gray-400">
        📄 Original
      </div>
    </div>
  )
}

const PreviewComponent = ({ version }: { version: LandingVersion }) => {
  switch (version) {
    case 'animated-v1':
      return <ScrollProgressPreview />
    case 'original':
      return <StaticPreview />
    default:
      return <StaticPreview />
  }
}

export default function VersionSelector({ currentVersion, onVersionChange }: VersionSelectorProps) {
  const { isPortuguese } = useLanguage()
  const [hoveredVersion, setHoveredVersion] = useState<LandingVersion | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const versions = Object.entries(versionInfo)

  return (
    <div className="mb-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-3">
          {isPortuguese ? 'Comparar Versões da Landing Page' : 'Compare Landing Page Versions'}
        </h2>
        <p className="text-gray-400">
          {isPortuguese ? 'Escolha entre o design original e a nova versão com animações' : 'Choose between the original design and the new animated version'}
        </p>
        
        {/* Preview Mode Toggle */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-sm text-gray-400">
            {isPortuguese ? 'Modo Prévia' : 'Preview Mode'}
          </span>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
              previewMode ? 'bg-primary' : 'bg-gray-600'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
              previewMode ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Two Version Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {versions.map(([version, info]) => (
          <VersionCard
            key={version}
            version={version as LandingVersion}
            info={info}
            currentVersion={currentVersion}
            hoveredVersion={hoveredVersion}
            previewMode={previewMode}
            onVersionChange={onVersionChange}
            onHover={setHoveredVersion}
            isPortuguese={isPortuguese}
          />
        ))}
      </div>
    </div>
  )
}

interface VersionCardProps {
  version: LandingVersion
  info: typeof versionInfo[keyof typeof versionInfo]
  currentVersion: LandingVersion
  hoveredVersion: LandingVersion | null
  previewMode: boolean
  onVersionChange: (version: LandingVersion) => void
  onHover: (version: LandingVersion | null) => void
  isPortuguese: boolean
}

const VersionCard = ({ 
  version, 
  info, 
  currentVersion, 
  hoveredVersion,
  previewMode,
  onVersionChange, 
  onHover,
  isPortuguese 
}: VersionCardProps) => {
  const isActive = currentVersion === version
  const isHovered = hoveredVersion === version
  const isAnimated = info.category === 'animated'
  
  // Get dynamic values
  const name = typeof info.name === 'function' ? info.name(isPortuguese) : info.name
  const description = typeof info.description === 'function' ? info.description(isPortuguese) : info.description
  const features = typeof info.features === 'function' ? info.features(isPortuguese) : info.features
  
  return (
    <div
      className={`relative group transition-all duration-500 ${
        isActive ? 'transform scale-105' : 'hover:scale-102'
      }`}
      onMouseEnter={() => onHover(version)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        onClick={() => onVersionChange(version)}
        className={`w-full card p-6 text-left transition-all duration-300 relative overflow-hidden ${
          isActive
            ? `bg-gradient-to-r ${info.color} border-primary/50 shadow-glow` 
            : 'hover:bg-dark-card/70 border-gray-700/50'
        }`}
      >
        {/* Animated Background for Animated Versions */}
        {isAnimated && (isHovered || isActive) && (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`text-3xl transition-transform duration-300 ${
              isHovered ? 'scale-110' : 'scale-100'
            }`}>
              {info.icon}
            </span>
            <div>
              <h3 className="font-bold text-white text-lg">
                {name}
              </h3>
              <p className="text-sm text-gray-400 mt-1">{description}</p>
            </div>
          </div>
          
          {isAnimated && (
            <div className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
              {isPortuguese ? 'ANIMADO' : 'ANIMATED'}
            </div>
          )}
        </div>
        
        {/* Preview Section */}
        {previewMode && (
          <div className="mb-4 transition-all duration-300 transform">
            <div className="bg-gray-800/30 rounded-lg p-2">
              <PreviewComponent version={version} />
            </div>
          </div>
        )}
        
        {/* Features */}
        <div className="space-y-2 mb-4">
          {features.slice(0, 5).map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
              <div className={`w-2 h-2 rounded-full ${
                isAnimated ? 'bg-primary animate-pulse' : 'bg-gray-500'
              }`}></div>
              {feature}
            </div>
          ))}
        </div>

        {/* Active Indicator */}
        {isActive && (
          <div className="mt-4 pt-4 border-t border-primary/20">
            <div className="flex items-center gap-2 text-primary text-sm font-medium">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              {isPortuguese ? 'Versão Ativa' : 'Active Version'}
            </div>
          </div>
        )}

        {/* Hover Tooltip */}
        {isHovered && !isActive && (
          <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
            {isPortuguese ? 'Clique para ativar' : 'Click to activate'}
          </div>
        )}
      </button>
    </div>
  )
}