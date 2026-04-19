import { Wand2 } from 'lucide-react'

/**
 * Pulsante "Compila 8h" per una riga-commessa della griglia.
 * onClick è gestito dal MonthGrid che conosce lo stato completo.
 */
export function FillDefaultButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Compila 8h nei giorni lavorativi vuoti"
      className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]
                 font-medium text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
    >
      <Wand2 className="h-3 w-3" />
      8h
    </button>
  )
}
