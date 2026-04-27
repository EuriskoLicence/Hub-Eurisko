'use client'

import { COUNTRIES } from '@/lib/countries'

type Props = {
  value:    string          // ISO 2-char code or ''
  onChange: (code: string) => void
  disabled: boolean
}

export function CountrySelect({ value, onChange, disabled }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Paese</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                   disabled:opacity-50 bg-white"
      >
        <option value="">— seleziona —</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
