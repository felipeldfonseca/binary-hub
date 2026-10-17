import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HubRoot from '@/components/hub/HubRoot'
import ThemeSwitch from '@/components/hub/ThemeSwitch'
import { THEME_STORAGE_KEY } from '@/lib/hub/tema'

const renderSwitch = () => {
  const view = render(
    <HubRoot>
      <ThemeSwitch />
    </HubRoot>
  )
  return { ...view, hub: view.container.querySelector('.hub') as HTMLElement }
}

describe('ThemeSwitch', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.restoreAllMocks()
  })

  it('starts light, as a switch that is off', () => {
    const { hub } = renderSwitch()

    expect(screen.getByRole('switch', { name: 'Modo escuro' })).toHaveAttribute('aria-checked', 'false')
    expect(hub).toHaveAttribute('data-tema', 'claro')
  })

  it('switches the whole frame to dark and remembers it', async () => {
    const { hub } = renderSwitch()

    await userEvent.click(screen.getByRole('switch', { name: 'Modo escuro' }))

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(hub).toHaveAttribute('data-tema', 'escuro')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('escuro')
  })

  it('switches back to light', async () => {
    const { hub } = renderSwitch()
    const toggle = screen.getByRole('switch', { name: 'Modo escuro' })

    await userEvent.click(toggle)
    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(hub).toHaveAttribute('data-tema', 'claro')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('claro')
  })

  it('opens in the theme saved on an earlier visit', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'escuro')

    const { hub } = renderSwitch()

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(hub).toHaveAttribute('data-tema', 'escuro')
  })

  it('works from the keyboard', async () => {
    const { hub } = renderSwitch()

    await userEvent.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
    await userEvent.keyboard(' ')

    expect(hub).toHaveAttribute('data-tema', 'escuro')
  })

  it('still switches when storage is blocked', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { hub } = renderSwitch()

    await userEvent.click(screen.getByRole('switch', { name: 'Modo escuro' }))

    expect(hub).toHaveAttribute('data-tema', 'escuro')
  })
})
