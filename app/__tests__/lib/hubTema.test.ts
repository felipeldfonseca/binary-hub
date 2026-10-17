import { DEFAULT_THEME, THEME_SCRIPT, THEME_STORAGE_KEY, readTheme, saveTheme } from '@/lib/hub/tema'

describe('hub theme storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.restoreAllMocks()
  })

  it('starts light when nothing is saved', () => {
    expect(DEFAULT_THEME).toBe('claro')
    expect(readTheme()).toBe('claro')
  })

  it('reads back what was saved', () => {
    saveTheme('escuro')

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('escuro')
    expect(readTheme()).toBe('escuro')
  })

  it('ignores a value that is not a theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'roxo')

    expect(readTheme()).toBe('claro')
  })

  it('keeps working when storage is blocked', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(readTheme()).toBe('claro')
    expect(() => saveTheme('escuro')).not.toThrow()
  })
})

describe('inline theme script', () => {
  // Runs the script text the way the browser does, with the element it sits in as its parent
  const run = (storage: Pick<Storage, 'getItem'>) => {
    const root = document.createElement('div')
    root.setAttribute('data-tema', 'claro')
    new Function('localStorage', 'document', THEME_SCRIPT)(storage, { currentScript: { parentElement: root } })
    return root.getAttribute('data-tema')
  }

  it('applies a saved dark theme before the page paints', () => {
    expect(run({ getItem: (key: string) => (key === THEME_STORAGE_KEY ? 'escuro' : null) })).toBe('escuro')
  })

  it('leaves the default alone when nothing valid is saved', () => {
    expect(run({ getItem: () => null })).toBe('claro')
    expect(run({ getItem: () => 'javascript:alert(1)' })).toBe('claro')
  })

  it('does not throw when storage is blocked', () => {
    expect(
      run({
        getItem: () => {
          throw new Error('SecurityError')
        },
      })
    ).toBe('claro')
  })
})
