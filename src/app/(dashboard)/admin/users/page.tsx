import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getUserList } from '../actions'
import { UsersClient } from '@/components/admin/UsersClient'
import { Users } from 'lucide-react'

export const metadata = { title: 'Gestione utenti' }

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PARAM_USERS')) redirect('/dashboard')

  const { users, roles } = await getUserList()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestione utenti</h1>
          <p className="text-sm text-gray-500">{users.length} utenti totali</p>
        </div>
      </div>

      <UsersClient users={users} roles={roles} />
    </div>
  )
}
