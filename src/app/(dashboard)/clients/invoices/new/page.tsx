import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { FileText, ChevronLeft } from 'lucide-react'
import { getClientList } from '../../actions'
import { NewInvoiceForm } from '@/components/invoices/NewInvoiceForm'

export const metadata = { title: 'Nuovo documento' }

export default async function NewInvoicePage() {
  const session = await auth()
  if (!session || !hasSection(session, 'INVOICES_MANAGE')) redirect('/dashboard')

  const clientsList = await getClientList(true)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="text-xs text-gray-400 flex items-center gap-1">
        <Link href="/clients/invoices" className="hover:text-gray-600 flex items-center gap-1">
          <ChevronLeft className="h-3 w-3" />
          Fatturazione
        </Link>
        <span>/</span>
        <span className="text-gray-600">Nuovo</span>
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuovo documento</h1>
          <p className="text-sm text-gray-500">Compila i dati di testata. Le posizioni si aggiungono dopo la creazione.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <NewInvoiceForm
          clients={clientsList.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
        />
      </div>
    </div>
  )
}
