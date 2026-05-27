'use client'

import { useState, useTransition, useMemo, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, AlertTriangle, ChevronRight, ChevronDown, X, ArrowLeft, User, RotateCcw, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { HolidayBadge } from './HolidayBadge'
import { FillDefaultButton } from './FillDefaultButton'
import {
  saveTimesheetExtraEntriesForUser,
  submitTimesheetExtraForUser,
  reopenTimesheetExtraForUser,
} from '@/app/(dashboard)/timesheet-extra/[userId]/[year]/[month]/actions'
import type {
  TimesheetPageData,
  GridRow,
  SaveEntry,
  CalendarDaySerialized,
} from '@/types/timesheet'

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

// ─── Utility ─────────────────────────────────────────────────────────────────

function buildInitialRows(data: TimesheetPageData): GridRow[] {
  const rowMap = new Map<string, GridRow>()

  for (const entry of data.entries) {
    if (!entry.engagementId) continue
    const key = entry.engagementId

    if (!rowMap.has(key)) {
      const eng = data.engagements.find((e) => e.id === entry.engagementId)
      rowMap.set(key, {
        type:     'engagement',
        id:       entry.engagementId,
        label:    eng?.name ?? 'Commessa sconosciuta',
        sublabel: eng ? `${eng.code} · ${eng.clientName}` : '',
        hours:    {},
      })
    }

    const row = rowMap.get(key)
    if (row) row.hours[entry.day] = entry.hours
  }

  return Array.from(rowMap.values())
}

function rowsToEntries(rows: GridRow[]): SaveEntry[] {
  const entries: SaveEntry[] = []
  for (const row of rows) {
    for (const [dayStr, h] of Object.entries(row.hours)) {
      const hours = Number(h)
      if (h === '' || isNaN(hours) || hours === 0) continue
      entries.push({
        day:           Number(dayStr),
        engagementId:  row.id,
        absenceTypeId: null,
        hours,
      })
    }
  }
  return entries
}

function dayTotals(rows: GridRow[], days: number[]): Record<number, number> {
  const totals: Record<number, number> = {}
  for (const day of days) totals[day] = 0
  for (const row of rows) {
    for (const [dayStr, h] of Object.entries(row.hours)) {
      const hours = Number(h)
      if (h !== '' && !isNaN(hours)) {
        totals[Number(dayStr)] = (totals[Number(dayStr)] ?? 0) + hours
      }
    }
  }
  return totals
}

// ─── Totale ore per riga (commessa) sull'intero mese (può essere negativo) ────

function rowTotal(row: GridRow): number {
  return Object.values(row.hours).reduce<number>((sum, h) => {
    if (h === '') return sum
    const n = Number(h)
    return isFinite(n) ? sum + n : sum
  }, 0)
}

// ─── Componente principale ────────────────────────────────────────────────────

export function ExtraMonthGrid({
  data,
  targetUserId,
  targetUserName,
}: {
  data:           TimesheetPageData
  targetUserId:   string
  targetUserName: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const { year, month, isFuture, monthStatus, calendar, engagements } = data

  const currentStatus = monthStatus?.status ?? 'draft'
  const isEditable    = !isFuture && currentStatus === 'draft'

  const [rows, setRows]             = useState<GridRow[]>(() => buildInitialRows(data))
  const [toast, setToast]           = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [showAddRow, setShowAddRow] = useState(false)

  const days        = calendar.map((d) => d.dayOfMonth)
  const totals      = useMemo(() => dayTotals(rows, days), [rows, days])
  const totalHours  = useMemo(() => Object.values(totals).reduce((a, b) => a + b, 0), [totals])
  const rowTotals   = useMemo(() => rows.map(rowTotal), [rows])
  const workingDays = calendar.filter((d) => d.isWorkingDay).length
  const filledDays  = calendar.filter((d) => d.isWorkingDay && totals[d.dayOfMonth] !== 0).length

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 6000)
  }

  function handleCellChange(rowIdx: number, day: number, value: string) {
    if (value === '') {
      setRows((prev) => {
        const next = [...prev]
        next[rowIdx] = { ...next[rowIdx], hours: { ...next[rowIdx].hours, [day]: '' as any } }
        return next
      })
      return
    }
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) return
    const n = Math.min(24, Math.max(-24, parsed))
    setRows((prev) => {
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
        if (cur !== '' && cur != null && Number(cur) !== 0) continue

        const othersTotal = prev
          .filter((_, i) => i !== rowIdx)
          .reduce((s, r) => s + Number(r.hours[d] || 0), 0)

        if (othersTotal + hours > 24) continue
        row.hours[d] = hours
      }

      next[rowIdx] = row
      return next
    })
  }

  function handleRemoveRow(rowIdx: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx))
  }

  function handleAddRow(id: string) {
    const existing = rows.find((r) => r.id === id)
    if (existing) { setShowAddRow(false); return }

    const eng = engagements.find((e) => e.id === id)
    if (!eng) return

    setRows((prev) => [...prev, {
      type:     'engagement',
      id,
      label:    eng.name,
      sublabel: `${eng.code} · ${eng.clientName}`,
      hours:    {},
    }])
    setShowAddRow(false)
  }

  function handleReopen() {
    startTransition(async () => {
      const res = await reopenTimesheetExtraForUser(targetUserId, year, month)
      if (res.ok) { showToast('ok', 'Consuntivazione extra riaperta. Puoi apportare modifiche.'); router.refresh() }
      else        showToast('err', res.error)
    })
  }

  // Unico handler: salva le entries e porta il mese in stato "approvato"
  function handleSave() {
    startTransition(async () => {
      const saveRes = await saveTimesheetExtraEntriesForUser(targetUserId, year, month, rowsToEntries(rows))
      if (!saveRes.ok) { showToast('err', saveRes.error); return }
      const submitRes = await submitTimesheetExtraForUser(targetUserId, year, month)
      if (submitRes.ok) { showToast('ok', 'Consuntivazione extra salvata con successo.'); router.refresh() }
      else              showToast('err', submitRes.error)
    })
  }

  const availableEngagements = engagements.filter((e) => !rows.some((r) => r.id === e.id))
  const backHref = `/timesheet-extra/${targetUserId}`

  return (
    <div className="space-y-4 pb-24">
      {/* ─── Banner utente ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
        <User className="h-4 w-4 shrink-0 text-teal-500" />
        Stai compilando la consuntivazione extra di{' '}
        <strong className="ml-1">{targetUserName}</strong>
      </div>

      {/* ─── Intestazione ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={backHref}
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
          <nav className="mt-1 text-xs text-gray-400">
            <a href="/timesheet-extra" className="hover:text-gray-600">Consuntivazione extra</a>
            {' / '}
            <a href={backHref} className="hover:text-gray-600">{targetUserName}</a>
            {' / '}
            <span className="text-gray-600">{IT_MONTHS[month - 1]} {year}</span>
          </nav>
        </div>

        {/* KPI */}
        <div className="flex gap-4 text-sm">
          {[
            { label: 'Ore totali',        value: `${totalHours}h` },
            { label: 'Giorni lavorativi', value: workingDays },
            { label: 'Giorni compilati',  value: filledDays },
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

      {/* Banner mese già salvato */}
      {currentStatus === 'approved' && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          La consuntivazione extra è stata salvata per questo mese.
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
              Aggiungi commessa
            </button>

            {showAddRow && (
              <AddRowDropdown
                engagements={availableEngagements}
                onSelect={handleAddRow}
                onClose={() => setShowAddRow(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* ─── Pulsanti azione ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 justify-end z-20">
        {isEditable && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2
                       text-sm font-medium text-white hover:bg-blue-700 transition-colors
                       disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Salva
          </button>
        )}
        {!isFuture && currentStatus === 'approved' && (
          <button
            onClick={handleReopen}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2
                       text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors
                       disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Riapri
          </button>
        )}
      </div>

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

  useLayoutEffect(() => {
    const left  = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    const leftRows  = Array.from(left.querySelectorAll('tr'))
    const rightRows = Array.from(right.querySelectorAll('tr'))

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

      {/* ── Colonna sinistra fissa ─────────────────────────────────── */}
      <div className="shrink-0 border-r border-gray-200 z-10 shadow-[2px_0_6px_-4px_rgba(0,0,0,0.15)]">
        <table ref={leftRef} className="border-separate border-spacing-0 text-sm w-[200px]">
          <thead>
            <tr>
              <th className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-left text-xs
                             font-semibold text-gray-500 uppercase tracking-wider w-[200px]">
                Commessa
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.id} className="group bg-white">
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

      {/* ── Colonne giorni (scorrono orizzontalmente) ──────────────── */}
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
              <tr key={row.id}>
                {calendar.map((d) => {
                  const isOff = d.isWeekend || d.isHoliday
                  const h     = row.hours[d.dayOfMonth]
                  const hNum  = Number(h)
                  const isNeg = typeof h === 'number' && h < 0
                  return (
                    <td
                      key={d.dayOfMonth}
                      className={cn('border-b border-gray-100 px-1 py-1 text-center align-middle', isOff ? 'bg-gray-100' : '')}
                    >
                      {isEditable ? (
                        <input
                          type="number"
                          min={-24}
                          max={24}
                          step={1}
                          value={h ?? ''}
                          onChange={(e) => onCellChange(ri, d.dayOfMonth, e.target.value)}
                          className={cn(
                            'w-10 rounded border px-1 py-0.5 text-center text-base md:text-xs',
                            'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400',
                            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
                            isNeg
                              ? 'border-orange-300 bg-orange-50 text-orange-700'
                              : isOff
                                ? 'border-gray-300 bg-gray-50 text-gray-500'
                                : 'border-gray-200',
                          )}
                        />
                      ) : (
                        <span className={cn(
                          'text-xs',
                          hNum < 0 ? 'text-orange-600 font-medium' :
                          hNum > 0 ? 'text-gray-800 font-medium' : 'text-gray-300',
                        )}>
                          {hNum !== 0 && h !== '' ? h : '—'}
                        </span>
                      )}
                    </td>
                  )
                })}
                {/* Cella totale riga */}
                <td className="border-b border-gray-100 border-l border-gray-200 bg-gray-50 px-2 py-1 text-center align-middle">
                  {rowTotals[ri] === 0
                    ? <span className="text-xs text-gray-300">—</span>
                    : <span className={cn(
                        'text-xs font-semibold tabular-nums',
                        rowTotals[ri] < 0 ? 'text-orange-600' : 'text-gray-800',
                      )}>{rowTotals[ri]}h</span>
                  }
                </td>
              </tr>
            ))}

            {/* Riga totali */}
            <tr className="bg-gray-50">
              {calendar.map((d) => {
                const t   = totals[d.dayOfMonth] ?? 0
                const off = d.isWeekend || d.isHoliday
                const color = t < 0
                  ? 'text-orange-600'
                  : t > 0
                    ? (off ? 'text-gray-500' : 'text-gray-800')
                    : 'text-gray-300'
                return (
                  <td key={d.dayOfMonth} className={cn('border-t-2 border-gray-300 px-1 py-1.5 text-center', off && 'bg-gray-100')}>
                    <span className={cn('text-xs font-semibold', color)}>
                      {t !== 0 ? `${t}h` : '—'}
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
                      : <span className={cn(
                          'text-xs font-semibold tabular-nums',
                          monthTotal < 0 ? 'text-orange-600' : 'text-gray-900',
                        )}>{monthTotal}h</span>
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
  calendar, rows, totals, rowTotals, isEditable, engagements,
  onCellChange, onFillDefault, onRemoveRow, onAddRow,
}: {
  calendar:      CalendarDaySerialized[]
  rows:          GridRow[]
  totals:        Record<number, number>
  rowTotals:     number[]
  isEditable:    boolean
  engagements:   { id: string; name: string; code: string; clientName: string }[]
  onCellChange:  (rowIdx: number, day: number, value: string) => void
  onFillDefault: (rowIdx: number, hours: number) => void
  onRemoveRow:   (rowIdx: number) => void
  onAddRow:      (id: string) => void
}) {
  const [openDay,     setOpenDay]     = useState<number | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
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
              <span className={cn(
                'text-sm font-semibold tabular-nums',
                monthTotal === 0 ? 'text-gray-400' :
                monthTotal < 0   ? 'text-orange-600' :
                                   'text-gray-900',
              )}>
                {monthTotal === 0 ? '—' : `${monthTotal}h`}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', summaryOpen && 'rotate-180')} />
            </div>
          </button>

          {summaryOpen && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {rows.map((row, i) => (
                <div key={row.id} className="flex items-center justify-between px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 truncate">{row.label}</div>
                    {row.sublabel && (
                      <div className="text-xs text-gray-400 truncate">{row.sublabel}</div>
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-semibold tabular-nums shrink-0 ml-3',
                    rowTotals[i] === 0 ? 'text-gray-300' :
                    rowTotals[i] < 0   ? 'text-orange-600' :
                                         'text-gray-800',
                  )}>
                    {rowTotals[i] === 0 ? '—' : `${rowTotals[i]}h`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aggiungi commessa (mobile) */}
      {isEditable && (
        <AddRowMobile
          engagements={engagements.filter((e) => !rows.some((r) => r.id === e.id))}
          onSelect={onAddRow}
        />
      )}

      {/* Pannello righe attive */}
      {isEditable && rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {rows.map((row, ri) => (
            <div
              key={row.id}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0"
            >
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
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
        // Include rows that have any non-zero value (positive or negative)
        const dayRows = rows.filter((r) => {
          const h = Number(r.hours[d.dayOfMonth] || 0)
          return h !== 0
        })

        return (
          <div key={d.dayOfMonth}>
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
                    {dayRows.map((r) => {
                      const h = Number(r.hours[d.dayOfMonth])
                      return (
                        <div key={r.id} className="text-xs text-gray-600 truncate">
                          {r.label} · <strong className={h < 0 ? 'text-orange-600' : ''}>{h}h</strong>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">
                    {isOff
                      ? (isEditable ? `${d.holidayName ?? 'Festivo'} — tocca per inserire` : d.holidayName ?? 'Festivo')
                      : (isEditable ? 'Tocca per inserire' : '—')}
                  </span>
                )}
              </div>

              {total !== 0 && (
                <span className={cn(
                  'text-sm font-semibold shrink-0',
                  total < 0 ? 'text-orange-600' : 'text-blue-600',
                )}>
                  {total}h
                </span>
              )}
              {isEditable && (
                <ChevronRight className={cn('h-4 w-4 text-gray-300 shrink-0 transition-transform', isOpen && 'rotate-90')} />
              )}
            </button>

            {isOpen && (
              <div className="mt-1 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    {d.dayAbbr} {d.dayOfMonth} — Totale:{' '}
                    <span className={cn('font-bold', total < 0 ? 'text-orange-600' : 'text-blue-600')}>
                      {totals[d.dayOfMonth] ?? 0}h
                    </span>
                  </span>
                  <button onClick={() => setOpenDay(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {rows.map((row, ri) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-gray-700 truncate">{row.label}</span>
                    <input
                      type="number"
                      min={-24}
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
                    Aggiungi prima una commessa
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

// ─── Dropdown "Aggiungi commessa" ─────────────────────────────────────────────

function AddRowDropdown({
  engagements, onSelect, onClose,
}: {
  engagements: { id: string; name: string; code: string; clientName: string }[]
  onSelect:    (id: string) => void
  onClose:     () => void
}) {
  return (
    <div className="absolute top-full left-0 z-30 mt-1 w-72 rounded-xl border border-gray-200
                    bg-white shadow-lg overflow-y-auto max-h-64">
      {engagements.length > 0 ? (
        <>
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Commesse disponibili
          </p>
          {engagements.map((e) => (
            <button
              key={e.id}
              onClick={() => { onSelect(e.id); onClose() }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{e.name}</span>
              <span className="block text-xs text-gray-400">{e.code} · {e.clientName}</span>
            </button>
          ))}
        </>
      ) : (
        <p className="px-3 py-3 text-sm text-gray-400 text-center">Nessuna commessa disponibile</p>
      )}
    </div>
  )
}

function AddRowMobile({
  engagements, onSelect,
}: {
  engagements: { id: string; name: string; code: string; clientName: string }[]
  onSelect:    (id: string) => void
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
        Aggiungi commessa
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {engagements.length > 0 ? engagements.map((e) => (
            <button key={e.id} onClick={() => { onSelect(e.id); setOpen(false) }}
              className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-100">
              <span className="font-medium">{e.name}</span>
              <span className="block text-xs text-gray-400">{e.code} · {e.clientName}</span>
            </button>
          )) : (
            <p className="px-4 py-3 text-sm text-gray-400 text-center">Nessuna commessa disponibile</p>
          )}
        </div>
      )}
    </div>
  )
}
