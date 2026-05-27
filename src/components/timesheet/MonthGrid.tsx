'use client'

import { useState, useTransition, useCallback, useMemo, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, SendHorizonal, AlertTriangle, ChevronDown, ChevronRight, X, ArrowLeft, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { HolidayBadge } from './HolidayBadge'
import { FillDefaultButton } from './FillDefaultButton'
import { AmendmentModal } from './AmendmentModal'
import {
  saveTimesheetEntries,
  submitTimesheet,
  requestTimesheetAmendment,
} from '@/app/(dashboard)/timesheet/[year]/[month]/actions'
import type {
  TimesheetPageData,
  GridRow,
  SaveEntry,
  CalendarDaySerialized,
} from '@/types/timesheet'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

// ─── Utility: costruisce le righe dal stato iniziale ─────────────────────────

function buildInitialRows(data: TimesheetPageData): GridRow[] {
  const rowMap = new Map<string, GridRow>()

  for (const entry of data.entries) {
    const key = entry.engagementId ?? `absence:${entry.absenceTypeId}`

    if (!rowMap.has(key)) {
      if (entry.engagementId) {
        const eng = data.engagements.find((e) => e.id === entry.engagementId)
        rowMap.set(key, {
          type:     'engagement',
          id:       entry.engagementId,
          label:    eng?.name ?? 'Commessa sconosciuta',
          sublabel: eng ? `${eng.code} · ${eng.clientName}` : '',
          hours:    {},
        })
      } else if (entry.absenceTypeId) {
        const abs = data.absences.find((a) => a.id === entry.absenceTypeId)
        rowMap.set(key, {
          type:     'absence',
          id:       entry.absenceTypeId,
          label:    abs?.label ?? 'Assenza sconosciuta',
          sublabel: abs?.shortCode ?? '',
          hours:    {},
        })
      }
    }

    const row = rowMap.get(key)
    if (row) row.hours[entry.day] = entry.hours
  }

  return Array.from(rowMap.values())
}

// ─── Converte le righe in SaveEntry[] ────────────────────────────────────────

function rowsToEntries(rows: GridRow[]): SaveEntry[] {
  const entries: SaveEntry[] = []
  for (const row of rows) {
    for (const [dayStr, h] of Object.entries(row.hours)) {
      if (h === '' || h === 0) continue
      entries.push({
        day:           Number(dayStr),
        engagementId:  row.type === 'engagement' ? row.id : null,
        absenceTypeId: row.type === 'absence'    ? row.id : null,
        hours:         Number(h),
      })
    }
  }
  return entries
}

// ─── Totale ore per giorno ────────────────────────────────────────────────────

function dayTotals(rows: GridRow[], days: number[]): Record<number, number> {
  const totals: Record<number, number> = {}
  for (const day of days) totals[day] = 0
  for (const row of rows) {
    for (const [dayStr, h] of Object.entries(row.hours)) {
      if (h !== '') totals[Number(dayStr)] = (totals[Number(dayStr)] ?? 0) + Number(h)
    }
  }
  return totals
}

// ─── Totale ore per riga (commessa/assenza) sull'intero mese ─────────────────

function rowTotal(row: GridRow): number {
  return Object.values(row.hours).reduce<number>((sum, h) => {
    if (h === '') return sum
    const n = Number(h)
    return isFinite(n) ? sum + n : sum
  }, 0)
}

// ─── Componente principale ────────────────────────────────────────────────────

export function MonthGrid({
  data,
  canRequestAmendment,
  readOnly = false,
}: {
  data:                TimesheetPageData
  canRequestAmendment: boolean
  readOnly?:           boolean
}) {
  const router     = useRouter()
  const [isPending, startTransition] = useTransition()

  const { year, month, isFuture, monthStatus, calendar, engagements, absences } = data

  // Stato editabilità
  const currentStatus = monthStatus?.status ?? 'draft'
  const isEditable    = !isFuture && currentStatus === 'draft' && !readOnly

  // Righe della griglia
  const [rows, setRows]             = useState<GridRow[]>(() => buildInitialRows(data))
  const [toast, setToast]           = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [showAmendment, setShowAmendment] = useState(false)
  const [showAddRow,    setShowAddRow]    = useState(false)

  const days       = calendar.map((d) => d.dayOfMonth)
  const totals     = useMemo(() => dayTotals(rows, days), [rows, days])
  const totalHours = useMemo(() => Object.values(totals).reduce((a, b) => a + b, 0), [totals])
  const rowTotals  = useMemo(() => rows.map(rowTotal), [rows])
  const workingDays = calendar.filter((d) => d.isWorkingDay).length
  const filledDays  = calendar.filter((d) => d.isWorkingDay && totals[d.dayOfMonth] > 0).length
  const expectedHours = workingDays * 8
  // Giorni lavorativi che non hanno esattamente 8h — blocca il submit
  const incompleteDays = useMemo(
    () => calendar.filter((d) => d.isWorkingDay && totals[d.dayOfMonth] !== 8).length,
    [calendar, totals],
  )
  const canSubmit = incompleteDays === 0

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  function handleCellChange(rowIdx: number, day: number, value: string) {
    setRows((prev) => {
      // Calcola le ore già inserite dalle altre righe per questo giorno
      const othersTotal = prev.reduce((sum, row, i) => {
        if (i === rowIdx) return sum
        return sum + Number(row.hours[day] || 0)
      }, 0)
      const maxAllowed = Math.max(0, 8 - othersTotal)
      const n = value === '' ? '' : Math.min(maxAllowed, Math.max(1, parseInt(value) || 0))
      const next = [...prev]
      next[rowIdx] = { ...next[rowIdx], hours: { ...next[rowIdx].hours, [day]: n as any } }
      return next
    })
  }

  function handleFillDefault(rowIdx: number, hours: number) {
    setRows((prev) => {
      const next = [...prev]
      const row  = { ...next[rowIdx], hours: { ...next[rowIdx].hours } }

      for (const cal of calendar) {
        if (!cal.isWorkingDay) continue
        const d   = cal.dayOfMonth
        const cur = row.hours[d]
        if (cur !== '' && cur != null && Number(cur) > 0) continue  // non sovrascrivere

        const others = prev
          .filter((_, i) => i !== rowIdx)
          .reduce((s, r) => s + Number(r.hours[d] || 0), 0)

        const remaining = 8 - others
        if (remaining <= 0) continue  // giorno già coperto da altre righe → skip silenzioso
        row.hours[d] = Math.min(hours, remaining)
      }

      next[rowIdx] = row
      return next
    })
  }

  function handleRemoveRow(rowIdx: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx))
  }

  function handleAddRow(type: 'engagement' | 'absence', id: string) {
    const existing = rows.find((r) => r.type === type && r.id === id)
    if (existing) { setShowAddRow(false); return }

    let label = '', sublabel = ''
    if (type === 'engagement') {
      const eng = engagements.find((e) => e.id === id)
      label    = eng?.name   ?? ''
      sublabel = eng ? `${eng.code} · ${eng.clientName}` : ''
    } else {
      const abs = absences.find((a) => a.id === id)
      label    = abs?.label ?? ''
      sublabel = abs?.shortCode ?? ''
    }

    setRows((prev) => [...prev, { type, id, label, sublabel, hours: {} }])
    setShowAddRow(false)
  }

  function handleSave() {
    startTransition(async () => {
      const entries = rowsToEntries(rows)
      const res     = await saveTimesheetEntries(year, month, entries)
      if (res.ok) showToast('ok', 'Bozza salvata con successo.')
      else        showToast('err', res.error)
    })
  }

  function handleSubmit() {
    if (!canSubmit) {
      showToast('err', `Impossibile inviare: ${incompleteDays} giorni lavorativi non hanno 8 ore.`)
      return
    }
    if (!confirm('Inviare definitivamente la consuntivazione? Non potrai più modificarla senza richiedere una rettifica.')) return
    startTransition(async () => {
      const saveRes = await saveTimesheetEntries(year, month, rowsToEntries(rows))
      if (!saveRes.ok) { showToast('err', saveRes.error); return }
      const submitRes = await submitTimesheet(year, month)
      if (submitRes.ok) { showToast('ok', 'Consuntivazione inviata definitivamente.'); router.refresh() }
      else              showToast('err', submitRes.error)
    })
  }

  async function handleAmendmentConfirm(reason: string) {
    const res = await requestTimesheetAmendment(year, month, reason)
    setShowAmendment(false)
    if (res.ok) { showToast('ok', 'Richiesta di rettifica inviata.'); router.refresh() }
    else        showToast('err', res.error)
  }

  // Commesse e assenze non ancora in griglia (per "Aggiungi riga")
  const availableEngagements = engagements.filter((e) => !rows.some((r) => r.type === 'engagement' && r.id === e.id))
  const availableAbsences    = absences.filter((a)    => !rows.some((r) => r.type === 'absence'    && r.id === a.id))

  return (
    <div className="space-y-4 pb-24">
      {/* ─── Intestazione ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="/timesheet"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </a>
            <div className="h-4 w-px bg-gray-200 hidden sm:block" />
            <h1 className="text-xl font-bold text-gray-900">
              {IT_MONTHS[month - 1]} {year}
            </h1>
            <StatusBadge status={currentStatus === 'draft' && !monthStatus ? 'not_started' : currentStatus} />
          </div>
          <nav className="mt-1 text-xs text-gray-400 ml-0">
            <a href="/timesheet" className="hover:text-gray-600">Consuntivazione</a>
            {' / '}
            <span className="text-gray-600">{IT_MONTHS[month - 1]} {year}</span>
          </nav>
        </div>

        {/* KPI */}
        <div className="flex gap-4 text-sm">
          {[
            { label: 'Ore inserite',   value: `${totalHours}h` },
            { label: 'Giorni lavorativi', value: workingDays },
            { label: 'Giorni compilati',  value: filledDays },
            { label: 'Ore attese',     value: `${expectedHours}h` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Banner mese futuro */}
      {isFuture && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Questo mese è futuro: la consuntivazione è in sola lettura.
        </div>
      )}

      {/* Banner amendment_rejected */}
      {currentStatus === 'amendment_rejected' && monthStatus?.amendmentRejectionReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>Rettifica rifiutata:</strong> {monthStatus.amendmentRejectionReason}
        </div>
      )}

      {/* Banner amendment_requested */}
      {currentStatus === 'amendment_requested' && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
          Richiesta di rettifica in attesa di revisione da HR Finance.
          {monthStatus?.amendmentReason && <> Motivo: <em>{monthStatus.amendmentReason}</em></>}
        </div>
      )}

      {/* ─── Vista mobile ────────────────────────────────────────────────── */}
      <div className="md:hidden">
        <MobileView
          calendar={calendar}
          rows={rows}
          totals={totals}
          rowTotals={rowTotals}
          isEditable={isEditable}
          engagements={engagements}
          absences={absences}
          onCellChange={handleCellChange}
          onFillDefault={handleFillDefault}
          onRemoveRow={handleRemoveRow}
          onAddRow={handleAddRow}
        />
      </div>

      {/* ─── Vista desktop ───────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <DesktopGrid
          calendar={calendar}
          rows={rows}
          totals={totals}
          rowTotals={rowTotals}
          isEditable={isEditable}
          onCellChange={handleCellChange}
          onFillDefault={handleFillDefault}
          onRemoveRow={handleRemoveRow}
        />

        {/* Aggiungi riga */}
        {isEditable && (
          <div className="mt-2 relative">
            <button
              onClick={() => setShowAddRow((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300
                         px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600
                         transition-colors"
            >
              <Plus className="h-4 w-4" />
              Aggiungi riga
            </button>

            {showAddRow && (
              <AddRowDropdown
                engagements={availableEngagements}
                absences={availableAbsences}
                onSelect={handleAddRow}
                onClose={() => setShowAddRow(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* ─── Pulsanti azione ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 z-20">
        {/* Avviso giorni incompleti */}
        {isEditable && !canSubmit && (
          <span className="flex-1 text-xs text-amber-600 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {incompleteDays} {incompleteDays === 1 ? 'giorno lavorativo non ha' : 'giorni lavorativi non hanno'} 8 ore
          </span>
        )}
        <div className="ml-auto flex gap-3">
        {isEditable && (
          <>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2
                         text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors
                         disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Salva bozza
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              title={!canSubmit ? `${incompleteDays} giorni lavorativi non hanno 8 ore` : undefined}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2
                         text-sm font-medium text-white hover:bg-blue-700 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SendHorizonal className="h-4 w-4" />
              Invia definitivamente
            </button>
          </>
        )}

        {canRequestAmendment && (currentStatus === 'approved' || currentStatus === 'amendment_rejected') && (
          <button
            onClick={() => setShowAmendment(true)}
            className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50
                       px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
          >
            Richiedi rettifica
          </button>
        )}
        </div>
      </div>

      {/* ─── Modali ──────────────────────────────────────────────────────── */}
      {showAmendment && (
        <AmendmentModal
          onClose={() => setShowAmendment(false)}
          onConfirm={handleAmendmentConfirm}
        />
      )}

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-20 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-sm',
            toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Griglia Desktop ──────────────────────────────────────────────────────────

function DesktopGrid({
  calendar, rows, totals, rowTotals, isEditable,
  onCellChange, onFillDefault, onRemoveRow,
}: {
  calendar:      CalendarDaySerialized[]
  rows:          GridRow[]
  totals:        Record<number, number>
  rowTotals:     number[]
  isEditable:    boolean
  onCellChange:  (rowIdx: number, day: number, value: string) => void
  onFillDefault: (rowIdx: number, hours: number) => void
  onRemoveRow:   (rowIdx: number) => void
}) {
  const leftRef  = useRef<HTMLTableElement>(null)
  const rightRef = useRef<HTMLTableElement>(null)

  // Sincronizza le altezze riga per riga dopo ogni render
  useLayoutEffect(() => {
    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    const leftRows  = Array.from(left.querySelectorAll('tr'))
    const rightRows = Array.from(right.querySelectorAll('tr'))

    // Reset per ricalcolare le altezze naturali
    leftRows.forEach((r)  => { r.style.height = '' })
    rightRows.forEach((r) => { r.style.height = '' })

    const count = Math.min(leftRows.length, rightRows.length)
    for (let i = 0; i < count; i++) {
      const max = Math.max(
        leftRows[i].getBoundingClientRect().height,
        rightRows[i].getBoundingClientRect().height,
      )
      leftRows[i].style.height  = `${max}px`
      rightRows[i].style.height = `${max}px`
    }
  })

  return (
    <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">

      {/* ── Colonna sinistra fissa (non scorre mai) ───────────────── */}
      <div className="shrink-0 border-r border-gray-200 z-10 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.15)]">
        <table ref={leftRef} className="border-separate border-spacing-0 text-sm w-[200px]">
          <thead>
            <tr>
              <th className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-left text-xs
                             font-semibold text-gray-500 uppercase tracking-wider w-[200px]">
                Commessa / Assenza
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={`${row.type}-${row.id}`} className={cn(
                'group',
                row.type === 'absence' ? 'bg-amber-50/40' : 'bg-white',
              )}>
                <td className="border-b border-gray-100 px-3 py-2 align-middle w-[200px]">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-xs truncate">{row.label}</div>
                      <div className="text-[10px] text-gray-400 truncate">{row.sublabel}</div>
                    </div>
                    {isEditable && (
                      <FillDefaultButton onClick={(h) => onFillDefault(ri, h)} />
                    )}
                    {isEditable && (
                      <button
                        onClick={() => onRemoveRow(ri)}
                        className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-300
                                   hover:text-red-500 transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="border-t-2 border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 w-[200px]">
                Totale ore / giorno
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Colonne giorni (scorrono orizzontalmente) ─────────────── */}
      <div className="overflow-x-auto flex-1">
        <table ref={rightRef} className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {calendar.map((d) => (
                <th
                  key={d.dayOfMonth}
                  className={cn(
                    'border-b border-gray-200 px-2 py-2 text-center min-w-[52px]',
                    d.isWeekend || d.isHoliday ? 'bg-gray-100' : 'bg-gray-50',
                  )}
                >
                  <div className="text-xs font-semibold text-gray-700">{d.dayOfMonth}</div>
                  <div className="text-[10px] text-gray-400">{d.dayAbbr}</div>
                  {d.isHoliday && d.holidayName && <HolidayBadge name={d.holidayName} />}
                </th>
              ))}
              {/* Totale ore per riga (mese) */}
              <th className="border-b border-gray-200 border-l border-gray-200 bg-gray-50 px-2 py-2 text-center min-w-[64px]">
                <div className="text-xs font-semibold text-gray-700">Totale</div>
                <div className="text-[10px] text-gray-400">mese</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={`${row.type}-${row.id}`} className={cn(
                row.type === 'absence' ? 'bg-amber-50/40' : '',
              )}>
                {calendar.map((d) => {
                  const isOff = d.isWeekend || d.isHoliday
                  const h     = row.hours[d.dayOfMonth]
                  return (
                    <td
                      key={d.dayOfMonth}
                      className={cn('border-b border-gray-100 px-1 py-1 text-center align-middle', isOff ? 'bg-gray-100' : '')}
                    >
                      {isEditable ? (
                        <input
                          type="number"
                          min={1}
                          max={8}
                          step={1}
                          value={h ?? ''}
                          onChange={(e) => onCellChange(ri, d.dayOfMonth, e.target.value)}
                          className={cn(
                            'w-10 rounded border px-1 py-0.5 text-center text-base md:text-xs',
                            'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400',
                            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
                            isOff ? 'border-gray-300 bg-gray-50 text-gray-500' : 'border-gray-200',
                          )}
                        />
                      ) : (
                        <span className={cn('text-xs', h ? 'text-gray-800 font-medium' : 'text-gray-300')}>
                          {h || '—'}
                        </span>
                      )}
                    </td>
                  )
                })}
                {/* Cella totale riga */}
                <td className="border-b border-gray-100 border-l border-gray-200 bg-gray-50 px-2 py-1 text-center align-middle">
                  {rowTotals[ri] === 0
                    ? <span className="text-xs text-gray-300">—</span>
                    : <span className="text-xs font-semibold tabular-nums text-gray-800">{rowTotals[ri]}h</span>
                  }
                </td>
              </tr>
            ))}

            {/* Riga totali */}
            <tr className="bg-gray-50">
              {calendar.map((d) => {
                const t   = totals[d.dayOfMonth] ?? 0
                const off = d.isWeekend || d.isHoliday
                const color = off
                  ? (t > 0 ? 'text-gray-500' : 'text-gray-300')
                  : t === 8 ? 'text-green-600' : t > 8 ? 'text-red-600' : t > 0 ? 'text-amber-600' : 'text-gray-300'
                return (
                  <td key={d.dayOfMonth} className={cn('border-t-2 border-gray-300 px-1 py-1.5 text-center', off && 'bg-gray-100')}>
                    <span className={cn('text-xs font-semibold', color)}>
                      {t > 0 ? `${t}h` : '—'}
                    </span>
                  </td>
                )
              })}
              {/* Cella totale mese (somma totali riga) */}
              {(() => {
                const monthTotal = rowTotals.reduce((s, n) => s + n, 0)
                return (
                  <td className="border-t-2 border-gray-300 border-l border-gray-200 bg-gray-100 px-2 py-1.5 text-center">
                    {monthTotal === 0
                      ? <span className="text-xs text-gray-300">—</span>
                      : <span className="text-xs font-semibold tabular-nums text-gray-900">{monthTotal}h</span>
                    }
                  </td>
                )
              })()}
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  )
}

// ─── Vista Mobile ─────────────────────────────────────────────────────────────

function MobileView({
  calendar, rows, totals, rowTotals, isEditable, engagements, absences,
  onCellChange, onFillDefault, onRemoveRow, onAddRow,
}: {
  calendar:      CalendarDaySerialized[]
  rows:          GridRow[]
  totals:        Record<number, number>
  rowTotals:     number[]
  isEditable:    boolean
  engagements:   { id: string; name: string; code: string; clientName: string }[]
  absences:      { id: string; shortCode: string | null; label: string }[]
  onCellChange:  (rowIdx: number, day: number, value: string) => void
  onFillDefault: (rowIdx: number, hours: number) => void
  onRemoveRow:   (rowIdx: number) => void
  onAddRow:      (type: 'engagement' | 'absence', id: string) => void
}) {
  const [openDay,      setOpenDay]      = useState<number | null>(null)
  const [summaryOpen,  setSummaryOpen]  = useState(false)
  const monthTotal = rowTotals.reduce((s, n) => s + n, 0)

  return (
    <div className="space-y-2">
      {/* Riepilogo per riga (collapsibile) */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-800">Riepilogo per riga</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-gray-900">
                {monthTotal === 0 ? '—' : `${monthTotal}h`}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', summaryOpen && 'rotate-180')} />
            </div>
          </button>

          {summaryOpen && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {rows.map((row, i) => (
                <div key={`${row.type}-${row.id}`} className="flex items-center justify-between px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 truncate">{row.label}</div>
                    {row.sublabel && (
                      <div className="text-xs text-gray-400 truncate">{row.sublabel}</div>
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-semibold tabular-nums shrink-0 ml-3',
                    rowTotals[i] === 0 ? 'text-gray-300' : 'text-gray-800',
                  )}>
                    {rowTotals[i] === 0 ? '—' : `${rowTotals[i]}h`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aggiungi riga (mobile) — in cima */}
      {isEditable && (
        <AddRowMobile
          engagements={engagements.filter((e) => !rows.some((r) => r.type === 'engagement' && r.id === e.id))}
          absences={absences.filter((a) => !rows.some((r) => r.type === 'absence' && r.id === a.id))}
          onSelect={onAddRow}
        />
      )}

      {/* Pannello righe attive: fill + rimuovi */}
      {isEditable && rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {rows.map((row, ri) => (
            <div
              key={`${row.type}-${row.id}`}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0',
                row.type === 'absence' ? 'bg-amber-50/40' : '',
              )}
            >
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                row.type === 'absence' ? 'bg-amber-400' : 'bg-blue-400',
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">{row.label}</div>
                <div className="text-[10px] text-gray-400 truncate">{row.sublabel}</div>
              </div>
              <FillDefaultButton onClick={(h) => onFillDefault(ri, h)} />
              <button
                type="button"
                onClick={() => onRemoveRow(ri)}
                className="rounded p-1 text-gray-300 hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {calendar.map((d) => {
        const isOff   = d.isWeekend || d.isHoliday
        const total   = totals[d.dayOfMonth] ?? 0
        const isOpen  = openDay === d.dayOfMonth
        const dayRows = rows.filter((r) => Number(r.hours[d.dayOfMonth] || 0) > 0)

        return (
          <div key={d.dayOfMonth}>
            {/* Card giorno */}
            <button
              type="button"
              disabled={!isEditable}
              onClick={() => setOpenDay(isOpen ? null : d.dayOfMonth)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                !isEditable
                  ? 'bg-white border-gray-200 cursor-default'
                  : isOff
                    ? dayRows.length > 0
                      ? 'bg-gray-100 border-gray-300 hover:border-blue-300'
                      : 'bg-gray-100 border-dashed border-gray-300 hover:border-blue-300'
                    : dayRows.length > 0
                      ? 'bg-white border-gray-200 hover:border-blue-300'
                      : 'bg-white border-dashed border-gray-300 hover:border-blue-300',
              )}
            >
              <div className="w-10 text-center shrink-0">
                <div className={cn('text-base font-bold', isOff ? 'text-gray-400' : 'text-gray-900')}>{d.dayOfMonth}</div>
                <div className="text-[10px] text-gray-400">{d.dayAbbr}</div>
              </div>

              <div className="flex-1 min-w-0">
                {dayRows.length > 0 ? (
                  <div className="space-y-0.5">
                    {isOff && (
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {d.holidayName ?? 'Festivo'}
                      </div>
                    )}
                    {dayRows.map((r) => (
                      <div key={r.id} className="text-xs text-gray-600 truncate">
                        {r.label} · <strong>{r.hours[d.dayOfMonth]}h</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">
                    {isOff
                      ? (isEditable ? `${d.holidayName ?? 'Festivo'} — tocca per inserire` : d.holidayName ?? 'Festivo')
                      : (isEditable ? 'Tocca per inserire' : '—')}
                  </span>
                )}
              </div>

              {total > 0 && (
                <span className={cn('text-sm font-semibold shrink-0', total > 8 ? 'text-red-600' : 'text-blue-600')}>
                  {total}h
                </span>
              )}
              {isEditable && (
                <ChevronRight className={cn('h-4 w-4 text-gray-300 shrink-0 transition-transform', isOpen && 'rotate-90')} />
              )}
            </button>

            {/* Bottom sheet inline */}
            {isOpen && (
              <div className="mt-1 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    {d.dayAbbr} {d.dayOfMonth} — Totale: {' '}
                    <span className={cn('font-bold', (totals[d.dayOfMonth] ?? 0) > 8 ? 'text-red-600' : 'text-blue-600')}>
                      {totals[d.dayOfMonth] ?? 0}h
                    </span>
                  </span>
                  <button onClick={() => setOpenDay(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {rows.map((row, ri) => (
                  <div key={`${row.type}-${row.id}`} className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-gray-700 truncate">{row.label}</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={row.hours[d.dayOfMonth] ?? ''}
                      onChange={(e) => onCellChange(ri, d.dayOfMonth, e.target.value)}
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-base md:text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-400
                                 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}

                {rows.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    Aggiungi prima una commessa o voce di assenza
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}

// ─── Dropdown "Aggiungi riga" ─────────────────────────────────────────────────

function AddRowDropdown({
  engagements, absences, onSelect, onClose,
}: {
  engagements: { id: string; name: string; code: string; clientName: string }[]
  absences:    { id: string; shortCode: string | null; label: string }[]
  onSelect:    (type: 'engagement' | 'absence', id: string) => void
  onClose:     () => void
}) {
  return (
    <div className="absolute top-full left-0 z-30 mt-1 w-72 rounded-xl border border-gray-200
                    bg-white shadow-lg overflow-y-auto max-h-64">
      {engagements.length > 0 && (
        <>
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Commesse
          </p>
          {engagements.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelect('engagement', e.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{e.name}</span>
              <span className="block text-xs text-gray-400">{e.code} · {e.clientName}</span>
            </button>
          ))}
        </>
      )}
      {absences.length > 0 && (
        <>
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100 mt-1">
            Assenze
          </p>
          {absences.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect('absence', a.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{a.label}</span>
              {a.shortCode && <span className="ml-2 text-xs text-gray-400">{a.shortCode}</span>}
            </button>
          ))}
        </>
      )}
      {engagements.length === 0 && absences.length === 0 && (
        <p className="px-3 py-3 text-sm text-gray-400 text-center">Nessuna opzione disponibile</p>
      )}
    </div>
  )
}

function AddRowMobile({
  engagements, absences, onSelect,
}: {
  engagements: { id: string; name: string; code: string; clientName: string }[]
  absences:    { id: string; shortCode: string | null; label: string }[]
  onSelect:    (type: 'engagement' | 'absence', id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed
                   border-gray-300 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600
                   transition-colors"
      >
        <Plus className="h-4 w-4" />
        Aggiungi commessa o assenza
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {engagements.map((e) => (
            <button key={e.id} onClick={() => { onSelect('engagement', e.id); setOpen(false) }}
              className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-100">
              <span className="font-medium">{e.name}</span>
              <span className="block text-xs text-gray-400">{e.code} · {e.clientName}</span>
            </button>
          ))}
          {absences.map((a) => (
            <button key={a.id} onClick={() => { onSelect('absence', a.id); setOpen(false) }}
              className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-100">
              <span className="font-medium">{a.label}</span>
              {a.shortCode && <span className="ml-2 text-xs text-gray-400">{a.shortCode}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
