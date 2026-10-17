import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import * as regrasDb from '@/lib/hub/regrasDb'
import { hubKeys } from '@/hooks/useContas'
import {
  RULES_NOW_MAX_DELAY_MS,
  RULES_NOW_MIN_DELAY_MS,
  regrasKeys,
  rulesNowRefetchDelay,
  useMergePreferences,
  useRulesConfig,
  useRulesNow,
  useSaveRules,
} from '@/hooks/useRegras'
import { agora, configAntes, configDepois, saveDono } from '@/testing/regras'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesConfig: jest.fn(),
  fetchRulesNow: jest.fn(),
  saveRules: jest.fn(),
  mergePreferences: jest.fn(),
}))

const fetchRulesConfig = regrasDb.fetchRulesConfig as jest.MockedFunction<typeof regrasDb.fetchRulesConfig>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const saveRules = regrasDb.saveRules as jest.MockedFunction<typeof regrasDb.saveRules>
const mergePreferences = regrasDb.mergePreferences as jest.MockedFunction<typeof regrasDb.mergePreferences>

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, wrapper }
}

beforeEach(() => {
  fetchRulesConfig.mockReset().mockResolvedValue(configAntes())
  fetchRulesNow.mockReset().mockResolvedValue(agora('agora-seg-0930-et'))
  saveRules.mockReset().mockResolvedValue(saveDono())
  mergePreferences.mockReset().mockResolvedValue({ theme: 'escuro' })
})

afterEach(() => {
  jest.useRealTimers()
  focusManager.setFocused(undefined)
})

describe('rules cache keys', () => {
  it('sit under the hub’s keys, so the Phase 1 refresh after an import or an archive reaches them', () => {
    expect(regrasKeys.config('u')).toEqual(['hub', 'u', 'regras', 'config'])
    expect(regrasKeys.agora('u')).toEqual(['hub', 'u', 'regras', 'agora'])
    expect(regrasKeys.config('u').slice(0, 2)).toEqual(hubKeys.all('u'))
  })
})

describe('rulesNowRefetchDelay', () => {
  it('waits until the earliest changes_at, on the server’s clock, plus a second', () => {
    // 09:30 ET → the Top One window opens at 10:00 ET
    expect(rulesNowRefetchDelay(agora('agora-seg-0930-et'))).toBe(30 * 60_000 + 1000)
    // 20:30 de Brasília → the Ebinex window closes at 21:00
    expect(rulesNowRefetchDelay(agora('agora-seg-2030-brt'))).toBe(30 * 60_000 + 1000)
  })

  it('never asks in a loop, never waits forever, and does not ask without a change ahead', () => {
    const now = agora('agora-seg-0930-et')
    const past = { ...now, serverNow: new Date('2026-10-19T14:00:05Z') }
    expect(rulesNowRefetchDelay(past)).toBe(RULES_NOW_MIN_DELAY_MS)
    const early = { ...now, serverNow: new Date('2026-10-18T00:00:00Z') }
    expect(rulesNowRefetchDelay(early)).toBe(RULES_NOW_MAX_DELAY_MS)
    expect(rulesNowRefetchDelay({ serverNow: now.serverNow, accounts: [] })).toBe(false)
    expect(rulesNowRefetchDelay(undefined)).toBe(false)
  })
})

describe('useRulesNow', () => {
  it('asks again when the window opens, and gives the new answer', async () => {
    jest.useFakeTimers()
    focusManager.setFocused(true)
    fetchRulesNow.mockResolvedValueOnce(agora('agora-seg-0930-et')).mockResolvedValue(agora('agora-seg-1005-et'))
    const { wrapper } = setup()
    const { result } = renderHook(() => useRulesNow(), { wrapper })
    await waitFor(() => expect(result.current.data?.accounts[0].gate.status).toBe('fora_janela'))
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)

    await act(async () => {
      jest.advanceTimersByTime(30 * 60_000)
    })
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    await waitFor(() => expect(result.current.data?.accounts[0].gate.status).toBe('liberado'))
    expect(fetchRulesNow).toHaveBeenCalledTimes(2)
  })

  it('asks again when the tab gets focus back', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useRulesNow(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(fetchRulesNow).toHaveBeenCalledTimes(2))
  })

  it('reports a failure with its code', async () => {
    fetchRulesNow.mockRejectedValue(new regrasDb.RegrasDataError('network'))
    const { wrapper } = setup()
    const { result } = renderHook(() => useRulesNow(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.code).toBe('network')
  })
})

describe('useRulesConfig', () => {
  it('is read once: not again on focus, so an unsaved draft keeps its base', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useRulesConfig(), { wrapper })
    await waitFor(() => expect(result.current.data?.rev).toBe('none'))
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchRulesConfig).toHaveBeenCalledTimes(1)
  })
})

describe('useSaveRules', () => {
  it('refetches the rules, the accounts and the preferences before a real save settles', async () => {
    const { wrapper, queryClient } = setup()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => ({ config: useRulesConfig(), now: useRulesNow(), save: useSaveRules() }), { wrapper })
    // Reading `data` here also subscribes the result to it (React Query tracks the props a render reads)
    await waitFor(() => expect(result.current.config.data?.rev).toBe('none'))
    await waitFor(() => expect(result.current.now.isSuccess).toBe(true))
    fetchRulesConfig.mockResolvedValue(configDepois())

    const payload = { v: 1 as const, base_rev: 'none' }
    let answer: Awaited<ReturnType<typeof result.current.save.mutateAsync>> | undefined
    await act(async () => {
      answer = await result.current.save.mutateAsync({ payload })
    })
    expect(saveRules).toHaveBeenCalledWith(expect.anything(), payload, { dryRun: false })
    expect(answer?.versions).toHaveLength(2)
    // Already refetched when the mutation settled (the components hear of it on React Query's next tick)
    expect(fetchRulesConfig).toHaveBeenCalledTimes(2)
    expect(fetchRulesNow).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.config.data?.rev).toBe(configDepois().rev))
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(regrasKeys.all('user-1')),
        JSON.stringify(hubKeys.contas('user-1')),
        JSON.stringify(['hub', 'user-1', 'atividade']),
        JSON.stringify(hubKeys.preferencias('user-1')),
      ]),
    )
  })

  it('changes nothing in the cache after a dry run', async () => {
    saveRules.mockResolvedValue({ ...saveDono(), dryRun: true })
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ config: useRulesConfig(), save: useSaveRules() }), { wrapper })
    await waitFor(() => expect(result.current.config.isSuccess).toBe(true))
    await act(async () => {
      await result.current.save.mutateAsync({ payload: { v: 1 }, dryRun: true })
    })
    expect(saveRules).toHaveBeenCalledWith(expect.anything(), { v: 1 }, { dryRun: true })
    expect(fetchRulesConfig).toHaveBeenCalledTimes(1)
  })

  it('gives the refusal’s code', async () => {
    saveRules.mockRejectedValue(new regrasDb.RegrasDataError('rules_changed'))
    const { wrapper } = setup()
    const { result } = renderHook(() => useSaveRules(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ payload: { v: 1 } }).catch(() => undefined)
    })
    await waitFor(() => expect(result.current.error?.code).toBe('rules_changed'))
  })
})

describe('useMergePreferences', () => {
  it('puts the merged preferences in the cache, also inside rules_config', async () => {
    const { wrapper, queryClient } = setup()
    const { result } = renderHook(() => ({ config: useRulesConfig(), merge: useMergePreferences() }), { wrapper })
    await waitFor(() => expect(result.current.config.data?.preferences).toEqual({}))
    await act(async () => {
      await result.current.merge.mutateAsync({ theme: 'escuro' })
    })
    expect(mergePreferences).toHaveBeenCalledWith(expect.anything(), { theme: 'escuro' })
    expect(queryClient.getQueryData(hubKeys.preferencias('user-1'))).toEqual({ theme: 'escuro' })
    // React Query tells the components on its next tick
    await waitFor(() => expect(result.current.config.data?.preferences).toEqual({ theme: 'escuro' }))
    expect(fetchRulesConfig).toHaveBeenCalledTimes(1)
  })
})
