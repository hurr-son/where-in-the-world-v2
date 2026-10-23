import { formatDistance, formatPoints } from '../format'
import type { RoundResult } from '../game'

/** Fill the final-score table: one row per round. */
export function renderSummary(rows: HTMLTableSectionElement, results: RoundResult[]): void {
  rows.replaceChildren(
    ...results.map((result, i) => {
      const row = document.createElement('tr')
      const cells = [
        String(i + 1),
        result.location.countryName,
        formatDistance(result.distanceKm),
        formatPoints(result.points),
      ]
      for (const text of cells) {
        const cell = document.createElement('td')
        cell.textContent = text // text, not HTML, so names can't inject markup
        row.append(cell)
      }
      return row
    }),
  )
}
