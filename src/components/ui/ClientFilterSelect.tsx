'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Props = {
  clients:    { id: string; name: string }[]
  value:      string
  paramName?: string
}

/** Select cliente che aggiorna il searchParam senza ricaricare. */
export function ClientFilterSelect({ clients, value, paramName = 'clientId' }: Props) {
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
      <option value="">Tutti i clienti</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
