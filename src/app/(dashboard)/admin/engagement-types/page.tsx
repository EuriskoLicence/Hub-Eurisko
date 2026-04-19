import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getEngagementTypes } from '../actions'
import { SimpleListClient } from '@/components/admin/SimpleListClient'
import { Briefcase } from 'lucide-react'

export const metadata = { title: 'Tipologie commessa' }

export default async function AdminEngagementTypesPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_ENGAGEMENTS')) redirect('/dashboard')

  const items = await getEngagementTypes()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
          <Briefcase className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tipologie commessa</h1>
          <p className="text-sm text-gray-500">Chiavi in mano, T&amp;M, ecc.</p>
        </div>
      </div>

      <SimpleListClient
        type="engagement-types"
        items={items.map((i) => ({ id: i.id, label: i.name, active: i.active }))}
      />
    </div>
  )
}
