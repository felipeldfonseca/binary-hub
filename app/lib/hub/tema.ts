/**
 * Light or dark skin of the hub screens, kept in this browser until the profile stores it
 * (Phase 1 moves it to profiles.preferences). The values match the `data-tema` attribute
 * the tokens in styles/hub.css are keyed on.
 */
export type HubTheme = 'claro' | 'escuro';

export const DEFAULT_THEME: HubTheme = 'claro';
export const THEME_STORAGE_KEY = 'binaryhub.tema';

const isTheme = (value: unknown): value is HubTheme => value === 'claro' || value === 'escuro';

/** The saved theme, or the default when nothing valid is saved or storage is blocked. */
export function readTheme(): HubTheme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Saves the theme; a private window or blocked storage just keeps it for this visit. */
export function saveTheme(theme: HubTheme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Nothing to do: the screen already shows the chosen theme
  }
}

/**
 * Runs inline as the first child of the `.hub` element, before anything inside it paints,
 * so a saved dark theme never flashes light on a full page load.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==='claro'||t==='escuro')document.currentScript.parentElement.setAttribute('data-tema',t)}catch(e){}`;
