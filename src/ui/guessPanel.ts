export interface GuessPanel {
  close(): void
}

/**
 * Phones: the guess map starts small over the imagery; tapping it opens it,
 * and "Show image" closes it again. Desktop: an "Enlarge" button toggles a
 * bigger map, which stays big across rounds. styles.css decides which
 * buttons appear on which screens; this just toggles the classes.
 */
export function setupGuessPanel(panel: HTMLElement): GuessPanel {
  panel.querySelector('#guess-expand')!.addEventListener('click', () => {
    panel.classList.add('expanded')
  })
  panel.querySelector('#guess-collapse')!.addEventListener('click', () => {
    panel.classList.remove('expanded')
  })

  const resize = panel.querySelector<HTMLButtonElement>('#guess-resize')!
  resize.addEventListener('click', () => {
    const large = panel.classList.toggle('large')
    resize.textContent = large ? 'Shrink' : 'Enlarge'
    resize.setAttribute('aria-pressed', String(large))
  })

  // Only the phone view closes between rounds; the desktop size is kept.
  return { close: () => panel.classList.remove('expanded') }
}
