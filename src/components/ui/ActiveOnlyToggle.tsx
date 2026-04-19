'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Props = {
  checked:   boolean
  label?:    string
  paramName?: string
}

/**
 * Toggle "Visualizza solo attivi" che aggiorna il searchParam senza ricaricare
 * l'intera pagina (usa router.push).
 */
export function ActiveOnlyToggle({ checked, label = 'Visualizza solo attivi', paramName = 'onlyActive' }: Props) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.checked) {
      params.set(paramName, '1')
    } else {
      params.delete(paramName)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
      </div>
      {label}
    </label>
  )
}
