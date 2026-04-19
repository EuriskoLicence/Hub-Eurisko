import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getExpenseCategoriesAndVehicles } from '../actions'
import { ExpenseCatClient } from '@/components/admin/ExpenseCatClient'
import { Tag, PaperclipIcon } from 'lucide-react'

export const metadata = { title: 'Categorie spese' }

export default async function AdminExpenseCatPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_EXPENSE_CAT')) redirect('/dashboard')

  const { categories, vehicleTypes } = await getExpenseCategoriesAndVehicles()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
          <Tag className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categorie spese</h1>
          <p className="text-sm text-gray-500">Categorie nota spese e tipi veicolo (rimborso km)</p>
        </div>
      </div>

      {/* Banner: allegati disabilitati */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <PaperclipIcon className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-700">
          <span className="font-semibold">Gestione allegati disabilitata.</span>{' '}
          Le impostazioni "Allegato obbligatorio" e "Allegato facoltativo" sono configurabili ma al momento
          la funzionalità di caricamento allegati nelle note spese è disattivata.
          Per riattivarla contattare il team tecnico.
        </p>
      </div>

      <ExpenseCatClient categories={categories} vehicleTypes={vehicleTypes} />
    </div>
  )
}
