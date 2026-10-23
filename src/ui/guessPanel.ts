export interface GuessPanel {
  close(): void
}

/**
 * On phones the guess map starts small over the imagery: tapping it opens
 * it, and "Show image" closes it again. styles.css decides when those
 * buttons appear (only on narrow screens); this just toggles the class.
 */
export function setupGuessPanel(panel: HTMLElement): GuessPanel {
  panel.querySelector('#guess-expand')!.addEventListener('click', () => {
    panel.classList.add('expanded')
  })
  panel.querySelector('#guess-collapse')!.addEventListener('click', () => {
    panel.classList.remove('expanded')
  })
  return { close: () => panel.classList.remove('expanded') }
}
