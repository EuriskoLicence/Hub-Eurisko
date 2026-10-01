/**
 * Conversione ore ↔ giornate per il report "Ore mensili".
 * Le somme restano sempre in ore: la conversione avviene solo in visualizzazione/export.
 * Le ore sono intere, quindi ore / 8 ha al massimo 3 decimali (nessun arrotondamento).
 */

export const HOURS_PER_DAY = 8

export function toUnit(hours: number, days: boolean): number {
  return days ? hours / HOURS_PER_DAY : hours
}

export function fmtUnit(hours: number, days: boolean): string {
  return toUnit(hours, days).toLocaleString('it-IT', { maximumFractionDigits: 3 })
}

export function unitSuffix(days: boolean): string {
  return days ? 'gg' : 'h'
}
