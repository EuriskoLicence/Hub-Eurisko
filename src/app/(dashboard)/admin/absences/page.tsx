import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getAbsenceTypes } from '../actions'
import { SimpleListClient } from '@/components/admin/SimpleListClient'
import { CalendarOff } from 'lucide-react'

export const metadata = { title: 'Voci di assenza' }

export default async function AdminAbsencesPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_ABSENCES')) redirect('/dashboard')

  const items = await getAbsenceTypes()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
          <CalendarOff className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Voci di assenza</h1>
          <p className="text-sm text-gray-500">Ferie, malattia, permessi, ecc.</p>
        </div>
      </div>

      <SimpleListClient
        type="absences"
        items={items.map((i) => ({ id: i.id, code: i.code, shortCode: i.shortCode, label: i.label, active: i.active }))}
      />
    </div>
  )
}
