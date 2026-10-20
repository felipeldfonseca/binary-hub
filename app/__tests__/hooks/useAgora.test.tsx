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

  it('with the server’s offset: its clock, and the minute turns with the server’s (Phase 3)', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-22T14:30:30Z'))
    // The server is 25 s ahead: 14:30:55 on its clock
    const { result, rerender } = renderHook(({ off }) => useAgora(60_000, off), { initialProps: { off: 25_000 } })
    expect(result.current.toISOString()).toBe('2026-10-22T14:30:55.000Z')
    act(() => {
      jest.advanceTimersByTime(4_999)
    })
    expect(result.current.toISOString()).toBe('2026-10-22T14:30:55.000Z')
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.toISOString()).toBe('2026-10-22T14:31:00.000Z')
    // A newer answer moves the clock at once
    rerender({ off: -5_000 })
    expect(result.current.toISOString()).toBe('2026-10-22T14:30:30.000Z')
  })
})
