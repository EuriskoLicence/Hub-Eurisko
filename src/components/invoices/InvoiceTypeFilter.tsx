'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Props = {
  value:      string   // '' = tutte, 'invoice', 'credit_note'
  paramName?: string
}

/** Select tipologia documento che aggiorna il searchParam senza ricaricare. */
export function InvoiceTypeFilter({ value, paramName = 'type' }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) params.set(paramName, e.target.value)
    else                params.delete(paramName)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-base md:text-sm text-gray-700
                 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      <option value="">Tutte le tipologie</option>
      <option value="invoice">Fattura</option>
      <option value="credit_note">Nota credito</option>
    </select>
  )
}
