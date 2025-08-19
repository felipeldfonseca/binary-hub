'use client'
import React, { useState } from 'react'
import { useRealTime } from '@/hooks/useRealTime'
import { useNotifications } from '@/hooks/useNotifications'
import { useImportProgress } from '@/hooks/useImportProgress'
import { useFirestoreTrades } from '@/hooks/useFirestoreTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface RealTimeStatusProps {
  showDetailed?: boolean
  compact?: boolean
}

export default function RealTimeStatus({ 
  showDetailed = false,
  compact = false 
}: RealTimeStatusProps) {
  const { isPortuguese } = useLanguage()
  const [isExpanded, setIsExpanded] = useState(false)

  const { 
    connected: sseConnected, 
    connecting: sseConnecting,
    error: sseError,
    lastHeartbeat,
    events,
    isHealthy: sseHealthy 
  } = useRealTime()

  const {
    connected: firestoreConnected,
    subscription: firestoreSubscription,
    lastUpdate: firestoreLastUpdate,
    isHealthy: firestoreHealthy
  } = useFirestoreTrades({ realTimeUpdates: true })

  const { 
    hasActiveImports, 
    totalProgress,
    activeImports,
    mostRecentImport 
  } = useImportProgress()

  const { 
    unreadCount, 
    hasNotifications,
    criticalNotifications 
  } = useNotifications()

  // Overall connection status
  const overallStatus = sseHealthy && firestoreHealthy ? 'connected' : 
                       (sseConnected || firestoreConnected) ? 'partial' : 
                       (sseConnecting) ? 'connecting' : 'disconnected'

  const statusColor = {
    connected: 'text-green-400',
    partial: 'text-yellow-400', 
    connecting: 'text-blue-400',
    disconnected: 'text-red-400'
  }[overallStatus]

  const statusIcon = {
    connected: '🟢',
    partial: '🟡',
    connecting: '🔵',
    disconnected: '🔴'
  }[overallStatus]

  const statusText = isPortuguese ? {
    connected: 'Conectado',
    partial: 'Parcialmente Conectado',
    connecting: 'Conectando...',
    disconnected: 'Desconectado'
  }[overallStatus] : {
    connected: 'Connected',
    partial: 'Partially Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected'
  }[overallStatus]

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-1 ${statusColor}`}>
          <span className="text-xs">{statusIcon}</span>
          <span className="font-medium">{statusText}</span>
        </div>
        
        {hasActiveImports && (
          <div className="flex items-center gap-1 text-blue-400">
            <span className="text-xs">📤</span>
            <span>{Math.round(totalProgress)}%</span>
          </div>
        )}

        {unreadCount > 0 && (
          <div className="flex items-center gap-1 text-orange-400">
            <span className="text-xs">🔔</span>
            <span>{unreadCount}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 ${statusColor}`}>
            <span className="text-lg">{statusIcon}</span>
            <div>
              <h3 className="font-semibold text-white">
                {isPortuguese ? 'Status em Tempo Real' : 'Real-Time Status'}
              </h3>
              <p className="text-sm">{statusText}</p>
            </div>
          </div>
          
          {/* Quick indicators */}
          <div className="flex items-center gap-4 ml-4">
            {hasActiveImports && (
              <div className="flex items-center gap-2 text-blue-400">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  {isPortuguese ? 'Importando' : 'Importing'} ({Math.round(totalProgress)}%)
                </span>
              </div>
            )}

            {unreadCount > 0 && (
              <div className="flex items-center gap-2 text-orange-400">
                <span className="text-sm">🔔</span>
                <span className="text-sm font-medium">
                  {unreadCount} {isPortuguese ? 'notificações' : 'notifications'}
                </span>
              </div>
            )}

            {criticalNotifications.length > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-sm animate-pulse">⚠️</span>
                <span className="text-sm font-medium">
                  {criticalNotifications.length} {isPortuguese ? 'críticas' : 'critical'}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <button className="text-gray-400 hover:text-white transition-colors">
          <svg 
            className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded details */}
      {(isExpanded || showDetailed) && (
        <div className="mt-4 space-y-4 border-t border-gray-700/50 pt-4">
          {/* Connection Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SSE Connection */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">
                {isPortuguese ? 'Conexão Server-Sent Events' : 'Server-Sent Events Connection'}
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={sseConnected ? 'text-green-400' : 'text-red-400'}>
                    {sseConnected ? 
                      (isPortuguese ? 'Conectado' : 'Connected') : 
                      (isPortuguese ? 'Desconectado' : 'Disconnected')
                    }
                  </span>
                </div>
                {lastHeartbeat && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      {isPortuguese ? 'Último heartbeat:' : 'Last heartbeat:'}
                    </span>
                    <span className="text-gray-300">
                      {new Date(lastHeartbeat).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {sseError && (
                  <div className="text-red-400 text-xs mt-1">
                    {isPortuguese ? 'Erro:' : 'Error:'} {sseError}
                  </div>
                )}
              </div>
            </div>

            {/* Firestore Connection */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">
                {isPortuguese ? 'Firestore Real-time' : 'Firestore Real-time'}
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={firestoreConnected ? 'text-green-400' : 'text-red-400'}>
                    {firestoreConnected ? 
                      (isPortuguese ? 'Conectado' : 'Connected') : 
                      (isPortuguese ? 'Desconectado' : 'Disconnected')
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">
                    {isPortuguese ? 'Subscription:' : 'Subscription:'}
                  </span>
                  <span className={`capitalize ${
                    firestoreSubscription === 'active' ? 'text-green-400' :
                    firestoreSubscription === 'error' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {firestoreSubscription}
                  </span>
                </div>
                {firestoreLastUpdate && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      {isPortuguese ? 'Última atualização:' : 'Last update:'}
                    </span>
                    <span className="text-gray-300">
                      {firestoreLastUpdate.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Imports */}
          {hasActiveImports && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">
                {isPortuguese ? 'Importações Ativas' : 'Active Imports'}
              </h4>
              <div className="space-y-2">
                {activeImports.map((importData) => (
                  <div key={importData.uploadId} className="bg-gray-700/30 rounded p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-white font-medium">
                        {importData.uploadId.slice(0, 8)}...
                      </span>
                      <span className="text-sm text-blue-400 font-medium">
                        {Math.round(importData.progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-600/50 rounded-full h-2">
                      <div 
                        className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importData.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>
                        {importData.processedRows || 0} / {importData.totalRows || '?'} 
                        {isPortuguese ? ' linhas' : ' rows'}
                      </span>
                      <span className="capitalize">{importData.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Events */}
          {events.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">
                {isPortuguese ? 'Eventos Recentes' : 'Recent Events'}
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {events.slice(0, 5).map((event, index) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">
                      {event.type.replace('_', ' ')}
                    </span>
                    <span className="text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Development Controls */}
          {process.env.NODE_ENV === 'development' && (
            <div className="border-t border-gray-700/50 pt-4">
              <p className="text-xs text-gray-500 mb-2">
                {isPortuguese ? 'Controles de Desenvolvimento' : 'Development Controls'}
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30 transition-colors"
                >
                  {isPortuguese ? 'Reconectar' : 'Reconnect'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}