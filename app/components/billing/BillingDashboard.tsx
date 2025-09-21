'use client'
import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { CreditCard, Calendar, Download, ExternalLink, Crown, Zap, Check, X, Clock } from 'lucide-react'

interface SubscriptionPlan {
  id: string
  name: string
  price: number
  currency: 'BRL' | 'USD'
  interval: 'month' | 'year'
  features: string[]
  aiLimits: {
    individual_trade: number
    daily_report: number
    weekly_report: number
    pattern_analysis: number
  }
  cryptoPrice?: {
    usdt: number
    usdc: number
  }
}

interface Subscription {
  id: string
  planId: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  paymentMethod: 'stripe' | 'crypto'
}

interface BillingHistory {
  id: string
  amount: number
  currency: string
  status: string
  created: string
  invoiceUrl?: string
  description: string
  period: {
    start: string
    end: string
  }
}

export default function BillingDashboard() {
  const { isPortuguese } = useLanguage()
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'history'>('overview')

  const fetchBillingData = async () => {
    try {
      const [subscriptionRes, plansRes, historyRes, usageRes] = await Promise.all([
        fetch('/api/v1/billing/subscription', {
          headers: { 'Authorization': `Bearer mock-token-for-testing` }
        }),
        fetch('/api/v1/billing/plans'),
        fetch('/api/v1/billing/history', {
          headers: { 'Authorization': `Bearer mock-token-for-testing` }
        }),
        fetch('/api/v1/billing/usage', {
          headers: { 'Authorization': `Bearer mock-token-for-testing` }
        })
      ])

      if (subscriptionRes.ok) {
        const subData = await subscriptionRes.json()
        setSubscription(subData.data.subscription)
        setCurrentPlan(subData.data.plan)
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json()
        setPlans(plansData.data.plans)
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setBillingHistory(historyData.data.history)
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json()
        setUsage(usageData.data)
      }
    } catch (error) {
      console.error('Error fetching billing data:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchBillingData()
  }, [])

  const handleUpgrade = async (planId: string) => {
    try {
      const response = await fetch('/api/v1/billing/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing`
        },
        body: JSON.stringify({ planId })
      })

      if (response.ok) {
        const result = await response.json()
        // Handle payment flow (would integrate with Stripe Elements)
        console.log('Subscription created:', result.data)
        fetchBillingData() // Refresh data
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error)
    }
  }

  const handleCancelSubscription = async () => {
    if (!subscription) return

    try {
      const response = await fetch('/api/v1/billing/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing`
        },
        body: JSON.stringify({ subscriptionId: subscription.id })
      })

      if (response.ok) {
        fetchBillingData() // Refresh data
      }
    } catch (error) {
      console.error('Error canceling subscription:', error)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(isPortuguese ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-500/20'
      case 'past_due':
        return 'text-yellow-400 bg-yellow-500/20'
      case 'canceled':
        return 'text-red-400 bg-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getStatusText = (status: string) => {
    const statusMap = {
      active: isPortuguese ? 'Ativo' : 'Active',
      past_due: isPortuguese ? 'Pagamento Pendente' : 'Past Due',
      canceled: isPortuguese ? 'Cancelado' : 'Canceled',
      trialing: isPortuguese ? 'Período de Teste' : 'Trial'
    }
    return statusMap[status as keyof typeof statusMap] || status
  }

  const getPlanBadgeColor = (planId: string) => {
    switch (planId) {
      case 'free':
        return 'bg-gray-500/20 text-gray-400'
      case 'pro':
        return 'bg-blue-500/20 text-blue-400'
      case 'premium':
        return 'bg-purple-500/20 text-purple-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isPortuguese ? 'Cobrança' : 'Billing'}
          </h1>
          <p className="text-gray-400">
            {isPortuguese ? 'Gerencie sua assinatura e histórico de pagamentos' : 'Manage your subscription and payment history'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {['overview', 'plans', 'history'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === tab
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'overview' ? (isPortuguese ? 'Visão Geral' : 'Overview') :
             tab === 'plans' ? (isPortuguese ? 'Planos' : 'Plans') :
             (isPortuguese ? 'Histórico' : 'History')}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Current Subscription */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="h-6 w-6 text-orange-400" />
              <h2 className="text-xl font-bold text-white">
                {isPortuguese ? 'Assinatura Atual' : 'Current Subscription'}
              </h2>
            </div>

            {currentPlan && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPlanBadgeColor(currentPlan.id)}`}>
                      {currentPlan.name}
                    </span>
                    {subscription && (
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(subscription.status)}`}>
                        {getStatusText(subscription.status)}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-3xl font-bold text-white mb-2">
                    {currentPlan.price > 0 ? formatCurrency(currentPlan.price, currentPlan.currency) : 'Grátis'}
                    {currentPlan.price > 0 && (
                      <span className="text-lg text-gray-400 font-normal">
                        /{isPortuguese ? 'mês' : 'month'}
                      </span>
                    )}
                  </div>

                  {subscription && (
                    <div className="text-sm text-gray-400">
                      <p>
                        {isPortuguese ? 'Próxima cobrança' : 'Next billing'}: {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-white mb-3">
                    {isPortuguese ? 'Recursos Inclusos' : 'Included Features'}
                  </h3>
                  <ul className="space-y-2">
                    {currentPlan.features.slice(0, 4).map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="h-4 w-4 text-green-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-700">
              {currentPlan?.id === 'free' ? (
                <button
                  onClick={() => setActiveTab('plans')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {isPortuguese ? 'Fazer Upgrade' : 'Upgrade Plan'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab('plans')}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {isPortuguese ? 'Alterar Plano' : 'Change Plan'}
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    className="border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {isPortuguese ? 'Cancelar' : 'Cancel'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Usage Summary */}
          {usage && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="h-6 w-6 text-orange-400" />
                <h2 className="text-xl font-bold text-white">
                  {isPortuguese ? 'Uso da IA este Mês' : 'AI Usage This Month'}
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(usage.usage).map(([key, used]) => {
                  if (!['individual_trade', 'daily_report', 'weekly_report', 'pattern_analysis'].includes(key)) return null
                  
                  const limit = usage.limits[key]
                  const percentage = limit > 0 ? Math.min((used as number / limit) * 100, 100) : 0
                  
                  const names = {
                    individual_trade: isPortuguese ? 'Análises Individuais' : 'Individual Analysis',
                    daily_report: isPortuguese ? 'Relatórios Diários' : 'Daily Reports',
                    weekly_report: isPortuguese ? 'Relatórios Semanais' : 'Weekly Reports',
                    pattern_analysis: isPortuguese ? 'Análise de Padrões' : 'Pattern Analysis'
                  }
                  
                  return (
                    <div key={key} className="bg-gray-800/50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">
                        {names[key as keyof typeof names]}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold text-white">{used as number}</span>
                        <span className="text-sm text-gray-400">/ {limit === 0 ? '∞' : limit}</span>
                      </div>
                      {limit > 0 && (
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              percentage >= 90 ? 'bg-red-500' : 
                              percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className={`card p-6 ${currentPlan?.id === plan.id ? 'ring-2 ring-orange-500' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                {currentPlan?.id === plan.id && (
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                    {isPortuguese ? 'Atual' : 'Current'}
                  </span>
                )}
              </div>

              <div className="mb-6">
                <div className="text-3xl font-bold text-white">
                  {plan.price > 0 ? formatCurrency(plan.price, plan.currency) : 'Grátis'}
                </div>
                {plan.price > 0 && (
                  <div className="text-sm text-gray-400">
                    {isPortuguese ? 'por mês' : 'per month'}
                    {plan.cryptoPrice && (
                      <span className="ml-2">
                        ou ${plan.cryptoPrice.usdt} USDT/USDC
                      </span>
                    )}
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {currentPlan?.id !== plan.id && plan.id !== 'free' && (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {currentPlan?.id === 'free' 
                    ? (isPortuguese ? 'Fazer Upgrade' : 'Upgrade') 
                    : (isPortuguese ? 'Alterar Plano' : 'Switch Plan')
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="h-6 w-6 text-orange-400" />
            <h2 className="text-xl font-bold text-white">
              {isPortuguese ? 'Histórico de Cobrança' : 'Billing History'}
            </h2>
          </div>

          {billingHistory.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">
                {isPortuguese ? 'Nenhum Histórico Encontrado' : 'No Billing History'}
              </h3>
              <p className="text-gray-500">
                {isPortuguese ? 'Seus pagamentos aparecerão aqui' : 'Your payments will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {billingHistory.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-white">{invoice.description}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(invoice.status)}`}>
                        {getStatusText(invoice.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {formatDate(invoice.created)} • {formatDate(invoice.period.start)} - {formatDate(invoice.period.end)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-white">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </div>
                    </div>
                    
                    {invoice.invoiceUrl && (
                      <a
                        href={invoice.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}