import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getPurchaseOrderLineStatuses } from '../actions'
import { SimpleListClient } from '@/components/admin/SimpleListClient'
import { ListChecks } from 'lucide-react'

export const metadata = { title: 'Stati posizione OdA' }

export default async function AdminPoLineStatusesPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_PO_LINE_STATUSES')) redirect('/dashboard')

  const items = await getPurchaseOrderLineStatuses()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
          <ListChecks className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stati posizione OdA</h1>
          <p className="text-sm text-gray-500">Codice 3 caratteri alfanumerici + descrizione (facoltativi sulle posizioni OdA)</p>
        </div>
      </div>

      <SimpleListClient
        type="po-line-statuses"
        items={items.map((i) => ({ id: i.id, code: i.code, label: i.description, active: i.active }))}
      />
    </div>
  )
}
