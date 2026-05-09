import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { ShoppingCart, ChevronLeft } from 'lucide-react'
import { getClientList } from '../../actions'
import { getResponsibleCandidates } from '../actions'
import { NewOrderForm } from '@/components/orders/NewOrderForm'

export const metadata = { title: 'Nuovo OdA' }

export default async function NewPurchaseOrderPage() {
  const session = await auth()
  if (!session || !hasSection(session, 'PURCHASE_ORDERS_MANAGE')) redirect('/dashboard')

  const [clientsList, responsibles] = await Promise.all([
    getClientList(true),
    getResponsibleCandidates(),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="text-xs text-gray-400 flex items-center gap-1">
        <Link href="/clients/orders" className="hover:text-gray-600 flex items-center gap-1">
          <ChevronLeft className="h-3 w-3" />
          Ordini di Acquisto
        </Link>
        <span>/</span>
        <span className="text-gray-600">Nuovo</span>
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
          <ShoppingCart className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nuovo Ordine di Acquisto</h1>
          <p className="text-sm text-gray-500">Compila i dati di testata. Le posizioni si aggiungono dopo la creazione.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <NewOrderForm
          clients={clientsList.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
          responsibles={responsibles}
        />
      </div>
    </div>
  )
}
