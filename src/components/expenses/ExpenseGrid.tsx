'use client'

import { useState, useTransition, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Send, Save, AlertCircle, ChevronDown,
  AlertTriangle, CheckCircle2, Clock, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AttachmentButton } from './AttachmentButton'
import { ATTACHMENTS_ENABLED } from '@/lib/features'

import {
  saveExpenseLines,
  submitExpenseReport,
  requestExpenseAmendment,
} from '@/app/(dashboard)/expenses/detail-actions'
import type {
  ExpensePageData, ExpenseRowState, CellData, SaveLine,
} from '@/types/expenses'
import type { CalendarDaySerialized } from '@/types/timesheet'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyCell(): CellData {
  return {
    lineId:             undefined,
    amount:             '0.00',
    currency:           'EUR',
    exchangeRate:       '1.0000',
    amountEur:          '0.00',
    kmDistance:         '',
    description:        '',
    attachmentKey:      null,
    attachmentFilename: null,
  }
}

function calcAmountEur(amount: string, exchangeRate: string): string {
  const a = parseFloat(amount)
  const r = parseFloat(exchangeRate)
  if (isNaN(a) || isNaN(r) || r === 0) return '0.00'
  return (a / r).toFixed(2)
}

function calcKmAmountEur(km: string, ratePerKm: string | null): string {
  if (!ratePerKm) return '0.00'
  const k = parseFloat(km)
  const r = parseFloat(ratePerKm)
  if (isNaN(k) || isNaN(r)) return '0.00'
  return (k * r).toFixed(2)
}

function rowTotal(row: ExpenseRowState): number {
  return Object.values(row.cells).reduce((s, c) => s + parseFloat(c?.amountEur || '0'), 0)
}

function dayTotal(rows: ExpenseRowState[], day: number): number {
  return rows.reduce((s, r) => {
    const c = r.cells[day]
    return s + (c ? parseFloat(c.amountEur || '0') : 0)
  }, 0)
}

function grandTotal(rows: ExpenseRowState[]): number {
  return rows.reduce((s, r) => s + rowTotal(r), 0)
}

function rowsToSaveLines(rows: ExpenseRowState[]): SaveLine[] {
  const lines: SaveLine[] = []
  for (const row of rows) {
    for (const [dayStr, cell] of Object.entries(row.cells)) {
      if (!cell) continue
      const day = parseInt(dayStr)
      const eur = parseFloat(cell.amountEur || '0')
      if (eur === 0 && !cell.kmDistance) continue
      lines.push({
        categoryId:         row.categoryId,
        engagementId:       row.engagementId  ?? null,
        tariffaKm:          row.isKmBased ? (row.kmRate ?? null) : null,
        day,
        description:        cell.description || '',
        amount:             cell.amount,
        currency:           cell.currency,
        exchangeRate:       cell.exchangeRate,
        amountEur:          cell.amountEur,
        kmDistance:         cell.kmDistance || null,
        attachmentKey:      cell.attachmentKey      ?? null,
        attachmentFilename: cell.attachmentFilename ?? null,
      })
    }
  }
  return lines
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type Toast = { id: number; message: string; type: 'success' | 'error' }
let _toastId = 0

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++_toastId
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000)
  }, [])
  return { toasts, push }
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = {
  data: ExpensePageData
  canRequestAmendment: boolean
  readOnly?: boolean
}

export function ExpenseGrid({ data, canRequestAmendment, readOnly = false }: Props) {
  const { report, year, month, isFuture, rows: initialRows, categories, engagements, userTariffaKm, calendar } = data
  const router = useRouter()

  const [rows,        setRows]        = useState<ExpenseRowState[]>(initialRows)
  const [reportId,    setReportId]    = useState<string | null>(report?.id ?? null)
  const [isPending,   startTransition] = useTransition()
  const [amendReason, setAmendReason] = useState('')
  const [showAmend,   setShowAmend]   = useState(false)
  const [showAddRow,  setShowAddRow]  = useState(false)
  const [showKmConfirm, setShowKmConfirm] = useState(false)
  const tariffaKm = userTariffaKm ?? ''
  const { toasts, push } = useToast()

  // Categorie km-based disponibili
  const hasKmCategories = categories.some((c) => c.isKmBased)

  // Righe km-based con almeno una cella valorizzata
  const kmRowsWithData = rows.filter(
    (r) => r.isKmBased && Object.values(r.cells).some((c) => parseFloat(c?.kmDistance || '0') > 0),
  )

  const isReadOnly = readOnly || (report !== null && report.status !== 'draft') || isFuture

  // Tutti i giorni del mese (festivi inclusi)
  const workDays: CalendarDaySerialized[] = useMemo(
    () => calendar,
    [calendar],
  )

  // ── Cell helpers ─────────────────────────────────────────────────────────

  function updateCell(rowIdx: number, day: number, patch: Partial<CellData>) {
    setRows((prev) => {
      const next = [...prev]
      const row  = { ...next[rowIdx], cells: { ...next[rowIdx].cells } }
      const cell = { ...(row.cells[day] ?? emptyCell()), ...patch }

      // Auto-recalc amountEur
      if (row.isKmBased && (patch.kmDistance !== undefined)) {
        cell.amountEur = calcKmAmountEur(cell.kmDistance, tariffaKm || null)
        cell.amount    = cell.amountEur
      } else if (!row.isKmBased && (patch.amount !== undefined || patch.exchangeRate !== undefined)) {
        cell.amountEur = calcAmountEur(cell.amount, cell.exchangeRate)
      }

      row.cells[day] = cell
      next[rowIdx]   = row
      return next
    })
  }

  function clearCell(rowIdx: number, day: number) {
    setRows((prev) => {
      const next = [...prev]
      const row  = { ...next[rowIdx], cells: { ...next[rowIdx].cells } }
      delete row.cells[day]
      next[rowIdx] = row
      return next
    })
  }

  function setAttachment(rowIdx: number, day: number, key: string, filename: string) {
    setRows((prev) => {
      const next = [...prev]
      const row  = { ...next[rowIdx], cells: { ...next[rowIdx].cells } }
      const cell = { ...(row.cells[day] ?? emptyCell()) }
      cell.attachmentKey      = key
      cell.attachmentFilename = filename
      row.cells[day] = cell
      next[rowIdx]   = row
      return next
    })
  }

  function removeAttachment(rowIdx: number, day: number) {
    setRows((prev) => {
      const next = [...prev]
      const row  = { ...next[rowIdx], cells: { ...next[rowIdx].cells } }
      const cell = { ...(row.cells[day] ?? emptyCell()) }
      cell.attachmentKey      = null
      cell.attachmentFilename = null
      row.cells[day] = cell
      next[rowIdx]   = row
      return next
    })
  }

  // ── Auto-save dopo upload/rimozione allegato ──────────────────────────────

  function autoSaveWithRows(updatedRows: ExpenseRowState[]) {
    startTransition(async () => {
      const res = await saveExpenseLines(reportId, year, month, rowsToSaveLines(updatedRows))
      if (res.ok) {
        setReportId(res.reportId)
        push('Allegato salvato.')
        router.refresh()
      } else {
        push(res.error, 'error')
      }
    })
  }

  function handleSetAttachment(rowIdx: number, day: number, key: string, filename: string) {
    const updatedRows = rows.map((row, i) => {
      if (i !== rowIdx) return row
      const cell = { ...(row.cells[day] ?? emptyCell()), attachmentKey: key, attachmentFilename: filename }
      return { ...row, cells: { ...row.cells, [day]: cell } }
    })
    setRows(updatedRows)
    autoSaveWithRows(updatedRows)
  }

  function handleRemoveAttachment(rowIdx: number, day: number) {
    const updatedRows = rows.map((row, i) => {
      if (i !== rowIdx) return row
      const cell = { ...(row.cells[day] ?? emptyCell()), attachmentKey: null, attachmentFilename: null }
      return { ...row, cells: { ...row.cells, [day]: cell } }
    })
    setRows(updatedRows)
    autoSaveWithRows(updatedRows)
  }

  function removeRow(rowIdx: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx))
  }

  // ── Add Row ──────────────────────────────────────────────────────────────

  function addRow(categoryId: string, engagementId: string | null) {
    const cat     = categories.find((c) => c.id === categoryId)!
    const eng     = engagements.find((e) => e.id === engagementId)
    const localId = `${categoryId}|${engagementId ?? ''}`

    // Avoid duplicates
    if (rows.some((r) => r.localId === localId)) {
      push('Questa riga esiste già.', 'error')
      return
    }

    const newRow: ExpenseRowState = {
      localId,
      categoryId,
      categoryLabel:      cat.label,
      categoryCode:       cat.code,
      requiresAttachment: cat.requiresAttachment,
      isKmBased:          cat.isKmBased,
      engagementId:       engagementId,
      engagementName:     eng ? `${eng.name} (${eng.code})` : null,
      kmRate:             cat.isKmBased ? (tariffaKm || null) : null,
      cells:              {},
    }
    setRows((p) => [...p, newRow])
    setShowAddRow(false)
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      const res = await saveExpenseLines(reportId, year, month, rowsToSaveLines(rows))
      if (res.ok) {
        setReportId(res.reportId)
        push('Bozza salvata.')
        router.refresh()
      } else {
        push(res.error, 'error')
      }
    })
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  function validateBeforeSubmit(): boolean {
    const rowsWithoutEngagement = rows.filter((r) => !r.engagementId)
    if (rowsWithoutEngagement.length > 0) {
      push(`Commessa mancante per: ${rowsWithoutEngagement.map((r) => r.categoryLabel).join(', ')}`, 'error')
      return false
    }
    const missingRows = ATTACHMENTS_ENABLED ? rows.filter((r) => {
      if (!r.requiresAttachment) return false
      return Object.values(r.cells).some((c) => parseFloat(c?.amountEur || '0') > 0 && !c?.attachmentKey)
    }) : []
    if (missingRows.length > 0) {
      push(`Allegato mancante per: ${missingRows.map((r) => r.categoryLabel).join(', ')}`, 'error')
      return false
    }
    return true
  }

  function handleSubmit() {
    if (!validateBeforeSubmit()) return
    // Se ci sono righe km-based con dati, mostra prima la conferma tariffa
    if (kmRowsWithData.length > 0) {
      setShowKmConfirm(true)
      return
    }
    doSubmit()
  }

  function doSubmit() {
    startTransition(async () => {
      const saveRes = await saveExpenseLines(reportId, year, month, rowsToSaveLines(rows))
      if (!saveRes.ok) { push(saveRes.error, 'error'); return }

      const subRes = await submitExpenseReport(saveRes.reportId)
      if (subRes.ok) {
        setReportId(saveRes.reportId)
        push('Nota spese inviata definitivamente.')
        router.refresh()
      } else {
        push(subRes.error, 'error')
      }
    })
  }

  // ── Amendment ────────────────────────────────────────────────────────────

  function handleAmendment() {
    if (!reportId) { push('Salva prima la nota spese.', 'error'); return }
    if (!amendReason.trim()) { push('Il motivo è obbligatorio.', 'error'); return }
    startTransition(async () => {
      const res = await requestExpenseAmendment(reportId, amendReason)
      if (res.ok) {
        push('Richiesta di rettifica inviata.')
        setShowAmend(false)
        router.refresh()
      } else {
        push(res.error, 'error')
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const total = grandTotal(rows)

  return (
    <div className="space-y-4">

      {/* ── Toasts ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={cn(
            'rounded-lg px-4 py-3 text-sm font-medium shadow-lg pointer-events-auto',
            t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          )}>
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Sinistra: indietro + titolo + badge + totale */}
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={`/expenses?year=${year}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Indietro
          </a>
          <div className="h-4 w-px bg-gray-200 hidden sm:block" />
          <h1 className="text-lg font-bold text-gray-900">
            Nota Spese{' '}
            {new Date(year, month - 1).toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
          </h1>
          {report ? (
            <>
              <StatusBadgeExpense status={report.status} />
              <span className="text-sm text-gray-500">
                Totale:{' '}
                <span className="font-semibold text-gray-800">
                  € {total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400 italic">Non ancora salvata</span>
          )}
        </div>

        {/* Destra: azioni */}
        {!isReadOnly && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isPending ? 'Salvataggio…' : 'Salva bozza'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {isPending ? 'Invio…' : 'Invia nota spese'}
            </button>
          </div>
        )}
      </div>

      {/* ── Tariffa km ── */}
      {hasKmCategories && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-800">Tariffa rimborso km:</span>
          <span className="text-sm font-semibold text-blue-900">
            {tariffaKm ? `€ ${parseFloat(tariffaKm).toFixed(4)}/km` : <span className="text-amber-600 italic">non impostata — contatta l'amministratore</span>}
          </span>
        </div>
      )}

      {/* ── Banners ── */}
      {isFuture && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Non puoi modificare mesi futuri.
        </div>
      )}

      {report?.status === 'amendment_rejected' && report.amendmentRejectionReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 space-y-1">
          <div className="font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Rettifica rifiutata
          </div>
          <div className="text-red-700">{report.amendmentRejectionReason}</div>
        </div>
      )}

      {report?.status === 'amendment_requested' && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          <Clock className="h-4 w-4 shrink-0" />
          Rettifica in attesa di revisione.
          {report.amendmentReason && <span className="text-blue-600 ml-1">"{report.amendmentReason}"</span>}
        </div>
      )}

      {report?.status === 'approved' && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Nota spese approvata.
          {report.approvedAt && (
            <span className="text-green-600 ml-1">
              {new Date(report.approvedAt).toLocaleDateString('it-IT')}
            </span>
          )}
        </div>
      )}

      {/* ── Desktop Grid ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Sticky first column header */}
                <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 text-left px-3 py-2 font-medium text-gray-600 min-w-[200px]">
                  Voce Spesa / Commessa
                </th>
                {workDays.map((d) => (
                  <th key={d.isoDate} className={cn(
                    'border-r border-gray-100 text-center px-1 py-2 font-medium min-w-[80px]',
                    d.isWeekend || d.isHoliday ? 'text-gray-400' : 'text-gray-600',
                  )}>
                    <div>{d.dayAbbr}</div>
                    <div className={cn(d.isHoliday ? 'text-amber-500' : '')}>{d.dayOfMonth}</div>
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-medium text-gray-600 min-w-[80px]">Totale</th>
                {!isReadOnly && <th className="w-8" />}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={workDays.length + 3} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nessuna riga. Aggiungi una categoria di spesa.
                  </td>
                </tr>
              )}
              {rows.map((row, rowIdx) => (
                <DesktopRow
                  key={row.localId}
                  row={row}
                  rowIdx={rowIdx}
                  workDays={workDays}
                  isReadOnly={isReadOnly}
                  isPending={isPending}
                  year={year}
                  month={month}
                  onUpdateCell={updateCell}
                  onClearCell={clearCell}
                  onSetAttachment={handleSetAttachment}
                  onRemoveAttachment={handleRemoveAttachment}
                  onRemoveRow={removeRow}
                />
              ))}
            </tbody>

            {/* Totals row */}
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-700">
                  <td className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 px-3 py-2">
                    Totale
                  </td>
                  {workDays.map((d) => {
                    const dt = dayTotal(rows, d.dayOfMonth)
                    const isOff = d.isWeekend || d.isHoliday
                    return (
                      <td key={d.isoDate} className={cn('border-r border-gray-100 text-center px-1 py-2', isOff && 'bg-gray-100')}>
                        {dt > 0 ? (
                          <span className="text-gray-900">€ {dt.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-right px-3 py-2 text-blue-700">
                    € {total.toFixed(2)}
                  </td>
                  {!isReadOnly && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            Nessuna riga. Aggiungi una categoria.
          </div>
        )}
        {rows.map((row, rowIdx) => (
          <MobileRowCard
            key={row.localId}
            row={row}
            rowIdx={rowIdx}
            workDays={workDays}
            isReadOnly={isReadOnly}
            isPending={isPending}
            year={year}
            month={month}
            onUpdateCell={updateCell}
            onClearCell={clearCell}
            onSetAttachment={handleSetAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onRemoveRow={removeRow}
          />
        ))}
      </div>

      {/* ── Add Row ── */}
      {!isReadOnly && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddRow((p) => !p)}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300
                       px-4 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600
                       transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Aggiungi riga
          </button>

          {showAddRow && (
            <AddRowDropdown
              categories={categories}
              engagements={engagements}
              userTariffaKm={tariffaKm || null}
              existingLocalIds={rows.map((r) => r.localId)}
              onAdd={addRow}
              onClose={() => setShowAddRow(false)}
            />
          )}
        </div>
      )}

      {/* ── Grand total mobile ── */}
      {rows.length > 0 && (
        <div className="md:hidden flex justify-between items-center rounded-xl bg-white border border-gray-200 px-4 py-3">
          <span className="text-sm font-medium text-gray-600">Totale nota spese</span>
          <span className="text-base font-bold text-blue-700">€ {total.toFixed(2)}</span>
        </div>
      )}

      {/* ── Modal conferma tariffa km ── */}
      {showKmConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Conferma invio nota spese</h2>
            <p className="text-sm text-gray-600">
              La nota spese include voci di rimborso chilometrico calcolate con la tariffa dal tuo profilo:
            </p>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-center">
              <span className="text-2xl font-bold text-blue-700">
                € {tariffaKm ? parseFloat(tariffaKm).toFixed(4) : '0.0000'}
              </span>
              <span className="text-sm text-blue-500 ml-1">/km</span>
            </div>
            <p className="text-sm text-gray-500">Confermi di voler inviare la nota spese?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowKmConfirm(false)}
                disabled={isPending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => { setShowKmConfirm(false); doSubmit() }}
                disabled={isPending}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? 'Invio…' : 'Conferma e invia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Richiedi rettifica ── */}
      {canRequestAmendment && report && (report.status === 'approved' || report.status === 'amendment_rejected') && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          {!showAmend ? (
            <button
              type="button"
              onClick={() => setShowAmend(true)}
              className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              <AlertCircle className="h-4 w-4" />
              Richiedi rettifica
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Motivo della rettifica</label>
              <textarea
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                rows={3}
                placeholder="Descrivi il motivo della richiesta di rettifica..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                           resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAmend(false); setAmendReason('') }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleAmendment}
                  disabled={isPending || !amendReason.trim()}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white
                             hover:bg-amber-600 disabled:opacity-50"
                >
                  {isPending ? 'Invio…' : 'Invia richiesta'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadgeExpense({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft:                { label: 'Bozza',            className: 'bg-gray-100 text-gray-600' },
    approved:             { label: 'Approvata',        className: 'bg-green-100 text-green-700' },
    amendment_requested:  { label: 'Rettifica inviata', className: 'bg-blue-100 text-blue-700' },
    amendment_rejected:   { label: 'Rettifica rifiutata', className: 'bg-red-100 text-red-700' },
  }
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn('rounded-full px-3 py-1 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

// ─── Desktop Row ──────────────────────────────────────────────────────────────

type RowProps = {
  row:                ExpenseRowState
  rowIdx:             number
  workDays:           CalendarDaySerialized[]
  isReadOnly:         boolean
  isPending:          boolean
  year:               number
  month:              number
  onUpdateCell:       (rowIdx: number, day: number, patch: Partial<CellData>) => void
  onClearCell:        (rowIdx: number, day: number) => void
  onSetAttachment:    (rowIdx: number, day: number, key: string, filename: string) => void
  onRemoveAttachment: (rowIdx: number, day: number) => void
  onRemoveRow:        (rowIdx: number) => void
}

function DesktopRow({
  row, rowIdx, workDays, isReadOnly, isPending, year, month,
  onUpdateCell, onClearCell, onSetAttachment, onRemoveAttachment, onRemoveRow,
}: RowProps) {
  const total = rowTotal(row)

  return (
    <tr className="hover:bg-gray-50/50">
      {/* Category label */}
      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 align-top">
        <div className="font-medium text-gray-800 text-[11px]">{row.categoryLabel}</div>
        {row.engagementName && (
          <div className="text-[10px] text-blue-600 mt-0.5 truncate max-w-[180px]" title={row.engagementName}>
            {row.engagementName}
          </div>
        )}
        {row.kmRate && (
          <div className="text-[10px] text-gray-400 mt-0.5">€ {row.kmRate}/km</div>
        )}
      </td>

      {/* Day cells */}
      {workDays.map((d) => {
        const cell = row.cells[d.dayOfMonth] ?? undefined
        const isOff = d.isWeekend || d.isHoliday
        return (
          <td key={d.isoDate} className={cn('border-r border-gray-100 px-1 py-1.5 align-top', isOff && 'bg-gray-50')}>
            {row.isKmBased ? (
              <KmCell
                cell={cell}
                day={d.dayOfMonth}
                rowIdx={rowIdx}
                isReadOnly={isReadOnly}
                isPending={isPending}
                row={row}
                year={year}
                month={month}
                onUpdateCell={onUpdateCell}
                onClearCell={onClearCell}
                onSetAttachment={onSetAttachment}
                onRemoveAttachment={onRemoveAttachment}
              />
            ) : (
              <AmountCell
                cell={cell}
                day={d.dayOfMonth}
                rowIdx={rowIdx}
                isReadOnly={isReadOnly}
                isPending={isPending}
                row={row}
                year={year}
                month={month}
                onUpdateCell={onUpdateCell}
                onClearCell={onClearCell}
                onSetAttachment={onSetAttachment}
                onRemoveAttachment={onRemoveAttachment}
              />
            )}
          </td>
        )
      })}

      {/* Row total */}
      <td className="text-right px-3 py-2 font-semibold text-gray-700 text-[11px] align-top">
        {total > 0 ? `€ ${total.toFixed(2)}` : <span className="text-gray-300">—</span>}
      </td>

      {/* Remove row */}
      {!isReadOnly && (
        <td className="px-1 py-2 align-top">
          <button
            type="button"
            onClick={() => onRemoveRow(rowIdx)}
            disabled={isPending}
            className="rounded p-0.5 text-gray-300 hover:text-red-500 transition-colors"
            title="Rimuovi riga"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  )
}

// ─── Amount Cell ──────────────────────────────────────────────────────────────

type CellProps = {
  cell:               CellData | undefined
  day:                number
  rowIdx:             number
  isReadOnly:         boolean
  isPending:          boolean
  row:                ExpenseRowState
  year:               number
  month:              number
  onUpdateCell:       (rowIdx: number, day: number, patch: Partial<CellData>) => void
  onClearCell:        (rowIdx: number, day: number) => void
  onSetAttachment:    (rowIdx: number, day: number, key: string, filename: string) => void
  onRemoveAttachment: (rowIdx: number, day: number) => void
}

function AmountCell({ cell, day, rowIdx, isReadOnly, isPending, row, year, month, onUpdateCell, onClearCell, onSetAttachment, onRemoveAttachment }: CellProps) {
  const eur = cell ? parseFloat(cell.amountEur || '0') : 0

  if (isReadOnly) {
    if (!cell || eur === 0) return <span className="text-gray-300 text-[10px] block text-center">—</span>
    return (
      <div className="space-y-0.5">
        <div className="text-center text-[11px] font-medium text-gray-700">€ {eur.toFixed(2)}</div>
        {cell.description && <div className="text-[9px] text-gray-400 truncate max-w-[70px]">{cell.description}</div>}
        {ATTACHMENTS_ENABLED && cell.attachmentKey && (
          <AttachmentButton
            attachmentKey={cell.attachmentKey}
            attachmentFilename={cell.attachmentFilename}
            requiresAttachment={row.requiresAttachment}
            year={year}
            month={month}
            disabled
            onUploaded={() => {}}
            onRemoved={() => {}}
          />
        )}
      </div>
    )
  }

  function handleAmountBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value)
    if (isNaN(val) || val === 0) {
      if (!cell?.attachmentKey) { onClearCell(rowIdx, day); return }
    }
    onUpdateCell(rowIdx, day, { amount: isNaN(val) ? '0.00' : val.toFixed(2) })
  }

  return (
    <div className="space-y-1 min-w-[70px]">
      <input
        type="number"
        step="0.01"
        min="0"
        defaultValue={cell?.amount !== '0.00' ? cell?.amount : ''}
        placeholder="0,00"
        disabled={isPending}
        onBlur={handleAmountBlur}
        className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-right
                   focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200
                   placeholder:text-gray-300 disabled:opacity-50"
      />
      {cell && eur > 0 && (
        <input
          type="text"
          defaultValue={cell.description}
          placeholder="Descrizione"
          disabled={isPending}
          onBlur={(e) => onUpdateCell(rowIdx, day, { description: e.target.value })}
          className="w-full rounded border border-gray-100 px-1.5 py-0.5 text-[10px]
                     text-gray-600 focus:outline-none focus:border-gray-300 placeholder:text-gray-300
                     disabled:opacity-50"
        />
      )}
      {ATTACHMENTS_ENABLED && ((cell && eur > 0) || row.requiresAttachment) ? (
        <AttachmentButton
          attachmentKey={cell?.attachmentKey ?? null}
          attachmentFilename={cell?.attachmentFilename ?? null}
          requiresAttachment={row.requiresAttachment && eur > 0}
          year={year}
          month={month}
          disabled={isPending}
          onUploaded={(key, filename) => onSetAttachment(rowIdx, day, key, filename)}
          onRemoved={() => onRemoveAttachment(rowIdx, day)}
        />
      ) : null}
    </div>
  )
}

// ─── Km Cell ──────────────────────────────────────────────────────────────────

function KmCell({ cell, day, rowIdx, isReadOnly, isPending, row, year, month, onUpdateCell, onClearCell, onSetAttachment, onRemoveAttachment }: CellProps) {
  const km  = cell?.kmDistance ? parseFloat(cell.kmDistance) : 0
  const eur = cell ? parseFloat(cell.amountEur || '0') : 0

  if (isReadOnly) {
    if (!cell || km === 0) return <span className="text-gray-300 text-[10px] block text-center">—</span>
    return (
      <div className="space-y-0.5 text-center">
        <div className="text-[11px] font-medium text-gray-700">{km} km</div>
        <div className="text-[10px] text-gray-400">€ {eur.toFixed(2)}</div>
      </div>
    )
  }

  function handleKmBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value)
    if (isNaN(val) || val === 0) { onClearCell(rowIdx, day); return }
    onUpdateCell(rowIdx, day, { kmDistance: val.toString() })
  }

  return (
    <div className="space-y-0.5 min-w-[60px]">
      <input
        type="number"
        step="1"
        min="0"
        defaultValue={cell?.kmDistance || ''}
        placeholder="km"
        disabled={isPending}
        onBlur={handleKmBlur}
        className="w-full rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-right
                   focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200
                   placeholder:text-gray-300 disabled:opacity-50"
      />
      {cell && eur > 0 && (
        <div className="text-[10px] text-blue-600 text-right">€ {eur.toFixed(2)}</div>
      )}
    </div>
  )
}

// ─── Mobile Row Card ──────────────────────────────────────────────────────────

function MobileRowCard({ row, rowIdx, workDays, isReadOnly, isPending, year, month, onUpdateCell, onClearCell, onSetAttachment, onRemoveAttachment, onRemoveRow }: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const total = rowTotal(row)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="font-medium text-gray-800 text-sm">{row.categoryLabel}</div>
          {row.kmRate && (
            <div className="text-xs text-gray-400">€ {row.kmRate}/km</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-700">
            {total > 0 ? `€ ${total.toFixed(2)}` : '—'}
          </span>
          {!isReadOnly && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveRow(rowIdx) }}
              className="rounded p-1 text-gray-300 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {workDays.map((d) => {
            const cell = row.cells[d.dayOfMonth]
            const eur  = cell ? parseFloat(cell.amountEur || '0') : 0
            return (
              <div key={d.isoDate} className="flex items-center gap-3 px-4 py-2">
                <div className="w-10 shrink-0 text-center">
                  <div className="text-[10px] text-gray-400">{d.dayAbbr}</div>
                  <div className={cn('text-xs font-medium', d.isHoliday ? 'text-amber-500' : 'text-gray-700')}>{d.dayOfMonth}</div>
                </div>
                <div className="flex-1">
                  {row.isKmBased ? (
                    isReadOnly ? (
                      <span className="text-sm">{cell?.kmDistance ? `${cell.kmDistance} km` : '—'}</span>
                    ) : (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        defaultValue={cell?.kmDistance || ''}
                        placeholder="km"
                        disabled={isPending}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value)
                          if (isNaN(val) || val === 0) onClearCell(rowIdx, d.dayOfMonth)
                          else onUpdateCell(rowIdx, d.dayOfMonth, { kmDistance: val.toString() })
                        }}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-base text-right
                                   focus:outline-none focus:border-blue-400"
                      />
                    )
                  ) : (
                    isReadOnly ? (
                      <span className="text-sm">{eur > 0 ? `€ ${eur.toFixed(2)}` : '—'}</span>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={cell?.amount !== '0.00' ? cell?.amount : ''}
                          placeholder="0,00"
                          disabled={isPending}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value)
                            if (isNaN(val) || val === 0) { onClearCell(rowIdx, d.dayOfMonth); return }
                            onUpdateCell(rowIdx, d.dayOfMonth, { amount: val.toFixed(2) })
                          }}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-base text-right
                                     focus:outline-none focus:border-blue-400"
                        />
                        {ATTACHMENTS_ENABLED && cell && eur > 0 && (
                          <AttachmentButton
                            attachmentKey={cell.attachmentKey}
                            attachmentFilename={cell.attachmentFilename}
                            requiresAttachment={row.requiresAttachment}
                            year={year}
                            month={month}
                            disabled={isPending}
                            onUploaded={(key, fn) => onSetAttachment(rowIdx, d.dayOfMonth, key, fn)}
                            onRemoved={() => onRemoveAttachment(rowIdx, d.dayOfMonth)}
                          />
                        )}
                      </div>
                    )
                  )}
                </div>
                {cell && eur > 0 && (
                  <div className="text-xs font-medium text-gray-700">€ {eur.toFixed(2)}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Add Row Dropdown ─────────────────────────────────────────────────────────

type AddRowDropdownProps = {
  categories:       ExpensePageData['categories']
  engagements:      ExpensePageData['engagements']
  userTariffaKm:    string | null
  existingLocalIds: string[]
  onAdd:            (categoryId: string, engagementId: string | null) => void
  onClose:          () => void
}

function AddRowDropdown({ categories, engagements, userTariffaKm, existingLocalIds, onAdd, onClose }: AddRowDropdownProps) {
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedEng, setSelectedEng] = useState('')

  const cat = categories.find((c) => c.id === selectedCat)

  function handleAdd() {
    if (!selectedCat) return
    onAdd(selectedCat, selectedEng || null)
  }

  return (
    <div className="absolute top-full left-0 mt-2 z-20 bg-white rounded-xl border border-gray-200 shadow-lg p-4 w-72 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-base
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Seleziona…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {cat?.isKmBased && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
          {userTariffaKm
            ? <>Tariffa km: <span className="font-semibold">€ {userTariffaKm}/km</span></>
            : <span className="text-amber-600">Tariffa km non impostata nel profilo utente.</span>
          }
        </div>
      )}

      {cat && engagements.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Commessa <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedEng}
            onChange={(e) => setSelectedEng(e.target.value)}
            className={cn(
              'w-full rounded-lg border px-2.5 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              !selectedEng ? 'border-red-300 bg-red-50' : 'border-gray-300',
            )}
          >
            <option value="">Seleziona commessa…</option>
            {engagements.map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {e.clientName}</option>
            ))}
          </select>
          {!selectedEng && (
            <p className="mt-1 text-[10px] text-red-500">Campo obbligatorio</p>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedCat || (engagements.length > 0 && !selectedEng)}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white
                     hover:bg-blue-700 disabled:opacity-50"
        >
          Aggiungi
        </button>
      </div>
    </div>
  )
}
