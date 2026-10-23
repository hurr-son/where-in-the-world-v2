export type Screen = 'start' | 'round' | 'result' | 'summary'

/**
 * Show one screen. The round (imagery and guess map) is always underneath;
 * the other screens are overlays on top of it, marked data-screen="<name>"
 * in index.html. Showing 'round' hides every overlay.
 */
export function showScreen(screen: Screen): void {
  for (const overlay of document.querySelectorAll<HTMLElement>('[data-screen]')) {
    overlay.hidden = overlay.dataset.screen !== screen
  }
}
