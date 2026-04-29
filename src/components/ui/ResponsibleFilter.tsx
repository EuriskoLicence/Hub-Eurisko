'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Option = { id: string; name: string }

type Props = {
  options:      Option[]
  value:        string   // responsibleId corrente ('') = tutti
  paramName?:   string
}

/**
 * Select "Responsabile" che aggiorna il searchParam senza ricaricare la pagina.
 */
export function ResponsibleFilter({ options, value, paramName = 'responsibleId' }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set(paramName, e.target.value)
    } else {
      params.delete(paramName)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700
                 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      <option value="">Tutti i responsabili</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  )
}
