import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { FileText, Plus, ChevronRight, Building2, Calendar, Euro, Paperclip, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getInvoices, type InvoiceType } from './actions'
import { getClientList } from '../actions'
import { ClientFilterSelect } from '@/components/ui/ClientFilterSelect'
import { InvoiceTypeFilter } from '@/components/invoices/InvoiceTypeFilter'
import { OnlyOpenToggle } from '@/components/ui/OnlyOpenToggle'

export const metadata = { title: 'Fatturazione' }

type Props = { searchParams: { clientId?: string; type?: string; onlyUnbalanced?: string } }

export default async function InvoicesListPage({ searchParams }: Props) {
  const session = await auth()
  if (!session || !hasSection(session, 'INVOICES_VIEW')) redirect('/dashboard')

  const canManage = hasSection(session, 'INVOICES_MANAGE')

  const typeFilter = (['invoice', 'credit_note'].includes(searchParams.type ?? '')
    ? (searchParams.type as InvoiceType)
    : undefined)

  const [rows, clientsList] = await Promise.all([
    getInvoices({
      clientId:       searchParams.clientId,
      type:           typeFilter,
      onlyUnbalanced: searchParams.onlyUnbalanced === '1',
    }),
    getClientList(true),
  ])

  function fmtCur(s: string, currency: string) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(s))
  }
  function fmtDate(s: string) {
    return new Date(s + 'T00:00:00').toLocaleDateString('it-IT')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fatturazione</h1>
            <p className="text-sm text-gray-500">{rows.length} document{rows.length === 1 ? 'o' : 'i'}</p>
          </div>
        </div>
        {canManage && (
          <Link
            href="/clients/invoices/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nuovo documento
          </Link>
        )}
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Cliente fatturazione</label>
          <ClientFilterSelect clients={clientsList.map((c) => ({ id: c.id, name: c.name }))} value={searchParams.clientId ?? ''} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipologia</label>
          <InvoiceTypeFilter value={typeFilter ?? ''} />
        </div>
        <OnlyOpenToggle checked={searchParams.onlyUnbalanced === '1'} paramName="onlyUnbalanced" label="Solo da quadrare" />
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nessun documento.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/clients/invoices/${r.id}`}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                r.type === 'credit_note' ? 'bg-violet-50' : 'bg-blue-50'
              }`}>
                <FileText className={`h-4 w-4 ${r.type === 'credit_note' ? 'text-violet-500' : 'text-blue-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">N. {r.documentNumber}</span>
                  {r.type === 'credit_note' && (
                    <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                      Nota credito
                    </span>
                  )}
                  {r.linesCount === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Senza posizioni
                    </span>
                  ) : r.isBalanced ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Quadrata
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Da quadrare
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar  className="h-3 w-3" />{fmtDate(r.documentDate)}</span>
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{r.clientName}</span>
                  <span className="flex items-center gap-1"><Euro      className="h-3 w-3" />{fmtCur(r.totalAmount, r.currency)} (IVA {fmtCur(r.vatAmount, r.currency)})</span>
                  <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{r.attachmentsCount}</span>
                  <span>{r.linesCount} posizion{r.linesCount === 1 ? 'e' : 'i'}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 mt-1 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
