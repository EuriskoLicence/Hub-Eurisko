import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Coherence } from '@/lib/oda-coherence'

/** Badge "Coerenza stato" dei report OdA (vedi src/lib/oda-coherence.ts). */
export function CoherenceBadge({ c }: { c: Coherence }) {
  if (c.kind === 'na') return <span className="text-gray-300">—</span>
  if (c.kind === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />Coerente
      </span>
    )
  }
  const tone = c.kind === 'over' || c.kind === 'negative'
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-amber-800 bg-amber-50 border-amber-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${tone}`}>
      <AlertTriangle className="h-3 w-3 shrink-0" />{c.label}
    </span>
  )
}
