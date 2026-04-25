'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'

/**
 * Pulsante "Compila Xh" per una riga della griglia.
 * - Click sulla bacchetta → esegue il fill con le ore correnti
 * - Click sul numero → apre un mini-input per cambiare il valore di default
 * onClick riceve il numero di ore scelto dall'utente.
 */
export function FillDefaultButton({ onClick }: { onClick: (hours: number) => void }) {
  const [hours,   setHours]   = useState(8)
  const [editing, setEditing] = useState(false)

  function commitEdit(val: string) {
    const n = parseInt(val)
    if (!isNaN(n) && n >= 1 && n <= 24) setHours(n)
    setEditing(false)
  }

  return (
    <div
      className="ml-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5
                 hover:bg-blue-50 transition-colors shrink-0"
    >
      {/* Bacchetta: esegue il fill */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(hours) }}
        title={`Compila ${hours}h nei giorni lavorativi vuoti`}
        className="inline-flex items-center text-blue-600"
      >
        <Wand2 className="h-3 w-3" />
      </button>

      {/* Numero: cliccabile per modificare */}
      {editing ? (
        <input
          type="number"
          min={1}
          max={24}
          defaultValue={hours}
          autoFocus
          onBlur={(e) => commitEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); commitEdit((e.target as HTMLInputElement).value) }
            if (e.key === 'Escape') setEditing(false)
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-6 text-center text-[11px] font-medium text-blue-600
                     border-b border-blue-400 bg-transparent outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setEditing(true) }}
          title="Clicca per modificare le ore da compilare"
          className="min-w-[20px] text-center text-[11px] font-medium text-blue-600"
        >
          {hours}h
        </button>
      )}
    </div>
  )
}
