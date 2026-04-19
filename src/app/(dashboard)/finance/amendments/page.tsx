import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { getAmendmentList } from '../actions'
import { AmendmentsClient } from '@/components/finance/AmendmentsClient'
import { AlertCircle } from 'lucide-react'

export const metadata = { title: 'Rettifiche' }

export default async function AmendmentsPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'FINANCE_AMENDMENT')) redirect('/dashboard')

  const amendments = await getAmendmentList()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
          <AlertCircle className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rettifiche</h1>
          <p className="text-sm text-gray-500">
            Richieste di rettifica in attesa di revisione
            {amendments.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-100
                               text-amber-700 text-xs font-bold px-2 py-0.5">
                {amendments.length}
              </span>
            )}
          </p>
        </div>
      </div>

      <AmendmentsClient amendments={amendments} />
    </div>
  )
}
