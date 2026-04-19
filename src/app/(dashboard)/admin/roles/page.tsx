import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getRolesAndProfiles } from '../actions'
import { RolesClient } from '@/components/admin/RolesClient'
import { Shield } from 'lucide-react'

export const metadata = { title: 'Ruoli e profili' }

export default async function AdminRolesPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_ROLES')) redirect('/dashboard')

  const { roles, profiles } = await getRolesAndProfiles()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
          <Shield className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ruoli e profili</h1>
          <p className="text-sm text-gray-500">Gestisci profili (set di sezioni) e ruoli (set di profili)</p>
        </div>
      </div>

      <RolesClient roles={roles} profiles={profiles} />
    </div>
  )
}
