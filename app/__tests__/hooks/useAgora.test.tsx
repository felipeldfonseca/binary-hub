import { act, renderHook } from '@testing-library/react'
import { useAgora } from '@/hooks/useAgora'

afterEach(() => {
  jest.useRealTimers()
})

describe('useAgora', () => {
  it('redraws on each minute turn, aligned to :00', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-19T13:59:40Z'))
    const { result } = renderHook(() => useAgora())
    expect(result.current.toISOString()).toBe('2026-10-19T13:59:40.000Z')

    act(() => {
      jest.advanceTimersByTime(19_999)
    })
    expect(result.current.toISOString()).toBe('2026-10-19T13:59:40.000Z')
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.toISOString()).toBe('2026-10-19T14:00:00.000Z')
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(result.current.toISOString()).toBe('2026-10-19T14:01:00.000Z')
  })

  it('catches up when the tab becomes visible again', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-19T13:59:40Z'))
    const { result } = renderHook(() => useAgora())
    // A sleeping device: the clock moved, no timer ran
    jest.setSystemTime(new Date('2026-10-19T15:30:12Z'))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.toISOString()).toBe('2026-10-19T15:30:12.000Z')
  })

  it('stops when the screen goes away', () => {
    jest.useFakeTimers()
    const { unmount } = renderHook(() => useAgora())
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})
