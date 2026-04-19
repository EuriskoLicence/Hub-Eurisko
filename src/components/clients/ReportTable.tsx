'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportRow } from '@/app/(dashboard)/clients/reports/ore-commessa/actions'

function groupByClient(rows: ReportRow[]) {
  const map = new Map<string, { clientName: string; projects: Map<string, { projectName: string; projectManagerName: string; engagements: ReportRow[] }> }>()
  for (const row of rows) {
    if (!map.has(row.clientId)) {
      map.set(row.clientId, { clientName: row.clientName, projects: new Map() })
    }
    const client = map.get(row.clientId)!
    if (!client.projects.has(row.projectId)) {
      client.projects.set(row.projectId, { projectName: row.projectName, projectManagerName: row.projectManagerName, engagements: [] })
    }
    client.projects.get(row.projectId)!.engagements.push(row)
  }
  return map
}

function HoursCell({ std, extra, bold }: { std: number; extra: number; bold?: boolean }) {
  const total = std + extra
  return (
    <div className={cn('text-right tabular-nums', bold ? 'font-semibold text-gray-800' : 'text-gray-600')}>
      <span className="text-sm">{total.toFixed(1)} h</span>
      {extra > 0 && (
        <div className="text-[10px] text-gray-400 leading-tight">
          <span>{std.toFixed(1)} std</span>
          <span className="text-orange-500 ml-1">+{extra.toFixed(1)} extra</span>
        </div>
      )}
    </div>
  )
}

export function ReportTable({ rows, showUsers }: { rows: ReportRow[]; showUsers: boolean }) {
  const grouped = groupByClient(rows)
  const [expandedEngagements, setExpandedEngagements] = useState<Set<string>>(new Set())

  function toggleEngagement(id: string) {
    setExpandedEngagements((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Controlla se nel dataset ci sono ore extra, per mostrare la legenda
  const hasExtra = rows.some((r) => r.extraHours > 0)

  return (
    <div className="space-y-2">
      {/* Legenda ore extra */}
      {hasExtra && (
        <div className="flex items-center gap-4 px-1 text-xs text-gray-400">
          <span>Il totale include:</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-300" /> ore standard
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-400" /> ore extra
          </span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <div className="col-span-8">Cliente / Progetto / Commessa</div>
          <div className="col-span-2 text-right">Ore</div>
          {showUsers && <div className="col-span-2 text-right">Persone</div>}
        </div>

        {Array.from(grouped.entries()).map(([clientId, { clientName, projects }]) => {
          const allEngs   = Array.from(projects.values()).flatMap((p) => p.engagements)
          const clientStd   = allEngs.reduce((s, e) => s + e.standardHours, 0)
          const clientExtra = allEngs.reduce((s, e) => s + e.extraHours,    0)

          return (
            <div key={clientId} className="border-b border-gray-100 last:border-0">
              {/* Cliente */}
              <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50/50">
                <div className="col-span-8 font-semibold text-gray-800 text-sm">{clientName}</div>
                <div className="col-span-2">
                  <HoursCell std={clientStd} extra={clientExtra} bold />
                </div>
                {showUsers && <div className="col-span-2" />}
              </div>

              {Array.from(projects.entries()).map(([projectId, { projectName, projectManagerName, engagements }]) => {
                const projStd   = engagements.reduce((s, e) => s + e.standardHours, 0)
                const projExtra = engagements.reduce((s, e) => s + e.extraHours,    0)

                return (
                  <div key={projectId}>
                    {/* Progetto */}
                    <div className="grid grid-cols-12 gap-4 px-5 py-2.5 border-t border-gray-50">
                      <div className="col-span-8 pl-4 text-sm text-gray-700 font-medium flex items-center gap-2">
                        {projectName}
                        {projectManagerName && (
                          <span className="text-xs text-gray-400 font-normal">— resp. {projectManagerName}</span>
                        )}
                      </div>
                      <div className="col-span-2">
                        <HoursCell std={projStd} extra={projExtra} />
                      </div>
                      {showUsers && <div className="col-span-2" />}
                    </div>

                    {/* Commesse */}
                    {engagements.map((eng) => (
                      <div key={eng.engagementId}>
                        <button
                          type="button"
                          onClick={() => showUsers && toggleEngagement(eng.engagementId)}
                          className="w-full grid grid-cols-12 gap-4 px-5 py-2 border-t border-gray-50 hover:bg-gray-50 transition-colors"
                        >
                          <div className="col-span-8 pl-8 flex items-center gap-2 text-sm text-gray-600">
                            {showUsers && (
                              expandedEngagements.has(eng.engagementId)
                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            )}
                            <span>{eng.engagementName}</span>
                            <span className="text-xs text-gray-400 font-mono">{eng.compositeCode}</span>
                            {eng.extraHours > 0 && (
                              <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                                +extra
                              </span>
                            )}
                          </div>
                          <div className="col-span-2">
                            <HoursCell std={eng.standardHours} extra={eng.extraHours} />
                          </div>
                          {showUsers && (
                            <div className="col-span-2 text-right text-xs text-gray-400 self-center">{eng.users.length} pers.</div>
                          )}
                        </button>

                        {/* Dettaglio utenti */}
                        {showUsers && expandedEngagements.has(eng.engagementId) && (
                          <div className="border-t border-gray-50 bg-blue-50/30">
                            {eng.users.map((u) => (
                              <div key={u.userId} className="grid grid-cols-12 gap-4 px-5 py-1.5">
                                <div className="col-span-8 pl-16 text-xs text-gray-500">{u.userName}</div>
                                <div className="col-span-2 text-right text-xs tabular-nums">
                                  <span className="text-gray-500">{u.totalHours.toFixed(1)} h</span>
                                  {u.extraHours > 0 && (
                                    <div className="text-[10px] text-gray-400 leading-tight">
                                      <span>{u.standardHours.toFixed(1)} std</span>
                                      <span className="text-orange-500 ml-1">+{u.extraHours.toFixed(1)} extra</span>
                                    </div>
                                  )}
                                </div>
                                <div className="col-span-2" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
