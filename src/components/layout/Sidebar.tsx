'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Clock, Receipt, BarChart2, Building2, FolderOpen,
  LayoutDashboard, AlertCircle,
  Users, Shield, CalendarOff, Tag, Briefcase, CalendarDays,
  ChevronDown, Menu, X, Timer, CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SectionCode } from '@/lib/permissions/sections'
import { UserMenu } from './UserMenu'

// ─── Definizione navigazione ──────────────────────────────────────────────────

type NavItem = {
  label:      string
  href:       string
  icon:       React.ElementType
  section?:   SectionCode       // richiede esattamente questa sezione
  anySection?: SectionCode[]    // visibile se ha almeno una delle sezioni
  badge?:     number            // badge numerico (es. rettifiche pendenti)
}

type NavGroup = {
  label?:     string            // assente = gruppo senza intestazione
  anySection?: SectionCode[]   // l'intero gruppo è nascosto se l'utente non ha nessuna di queste sezioni
  items:      NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    // Voci principali senza intestazione
    items: [
      {
        label:   'Consuntivazione',
        href:    '/timesheet',
        icon:    Clock,
        section: 'TIMESHEET',
      },
      {
        label:   'Consuntivazione extra',
        href:    '/timesheet-extra',
        icon:    Timer,
        section: 'TIMESHEET_EXTRA',
      },
      {
        label:   'Note spese',
        href:    '/expenses',
        icon:    Receipt,
        section: 'EXPENSES',
      },
    ],
  },
  {
    label:      'Clienti',
    anySection: ['CLIENTS_VIEW', 'CLIENTS_MANAGE'],
    items: [
      {
        label:      'Report',
        href:       '/clients/reports',
        icon:       BarChart2,
        anySection: ['CLIENTS_VIEW', 'CLIENTS_MANAGE'],
      },
      {
        label:      'Clienti',
        href:       '/clients',
        icon:       Building2,
        anySection: ['CLIENTS_VIEW', 'CLIENTS_MANAGE'],
      },
      {
        label:      'Progetti',
        href:       '/clients/projects',
        icon:       FolderOpen,
        anySection: ['CLIENTS_VIEW', 'CLIENTS_MANAGE'],
      },
    ],
  },
  {
    label:      'Finance',
    anySection: ['FINANCE_DASHBOARD', 'FINANCE_AMENDMENT'],
    items: [
      {
        label:   'Consuntivazioni',
        href:    '/finance',
        icon:    CheckSquare,
        section: 'FINANCE_DASHBOARD',
      },
      {
        label:   'Note spese',
        href:    '/finance/expenses',
        icon:    Receipt,
        section: 'FINANCE_DASHBOARD',
      },
      {
        label:   'Rettifiche',
        href:    '/finance/amendments',
        icon:    AlertCircle,
        section: 'FINANCE_AMENDMENT',
      },
    ],
  },
  {
    label:      'Parametrizzazioni',
    anySection: ['PARAM_USERS', 'PARAM_ROLES', 'PARAM_ABSENCES', 'PARAM_EXPENSE_CAT', 'PARAM_ENGAGEMENTS', 'PARAM_HOLIDAYS'],
    items: [
      {
        label:   'Utenti',
        href:    '/admin/users',
        icon:    Users,
        section: 'PARAM_USERS',
      },
      {
        label:   'Ruoli e profili',
        href:    '/admin/roles',
        icon:    Shield,
        section: 'PARAM_ROLES',
      },
      {
        label:   'Voci assenza',
        href:    '/admin/absences',
        icon:    CalendarOff,
        section: 'PARAM_ABSENCES',
      },
      {
        label:   'Categorie spese',
        href:    '/admin/expense-categories',
        icon:    Tag,
        section: 'PARAM_EXPENSE_CAT',
      },
      {
        label:   'Tipologie commessa',
        href:    '/admin/engagement-types',
        icon:    Briefcase,
        section: 'PARAM_ENGAGEMENTS',
      },
      {
        label:   'Festività',
        href:    '/admin/holidays',
        icon:    CalendarDays,
        section: 'PARAM_HOLIDAYS',
      },
    ],
  },
]

// ─── Helper visibilità ────────────────────────────────────────────────────────

function isItemVisible(item: NavItem, sections: SectionCode[]): boolean {
  if (item.section)    return sections.includes(item.section)
  if (item.anySection) return item.anySection.some((s) => sections.includes(s))
  return true
}

function isGroupVisible(group: NavGroup, sections: SectionCode[]): boolean {
  if (!group.anySection) return true
  return group.anySection.some((s) => sections.includes(s))
}

// ─── Componente NavItem ────────────────────────────────────────────────────────

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item:     NavItem
  pathname: string
  onClick?: () => void
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon     = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-600' : 'text-gray-400')} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  )
}

// ─── Contenuto sidebar (riutilizzato su desktop e mobile) ─────────────────────

function SidebarContent({
  sections,
  userName,
  userEmail,
  pendingAmendments,
  onLinkClick,
}: {
  sections:           SectionCode[]
  userName:           string
  userEmail:          string
  pendingAmendments?: number
  onLinkClick?:       () => void
}) {
  const pathname = usePathname()

  // Inject badge into amendments nav item
  const navGroupsWithBadge: NavGroup[] = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.href === '/finance/amendments' && pendingAmendments
        ? { ...item, badge: pendingAmendments }
        : item,
    ),
  }))

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-4">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src="/favicon-64.png" alt="Hub Eurisko" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-sm font-semibold text-gray-900 truncate">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'HR Portal'}
          </span>
        </Link>
      </div>

      {/* Navigazione */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroupsWithBadge.map((group, gi) => {
          if (!isGroupVisible(group, sections)) return null

          const visibleItems = group.items.filter((item) => isItemVisible(item, sections))
          if (visibleItems.length === 0) return null

          return (
            <div key={gi}>
              {group.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onClick={onLinkClick}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User menu in fondo */}
      <div className="border-t border-gray-200 p-3">
        <UserMenu name={userName} email={userEmail} />
      </div>
    </div>
  )
}

// ─── Sidebar principale ───────────────────────────────────────────────────────

export function Sidebar({
  sections,
  userName,
  userEmail,
  pendingAmendments = 0,
}: {
  sections:           SectionCode[]
  userName:           string
  userEmail:          string
  pendingAmendments?: number
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar (sempre visibile) ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white">
        <SidebarContent
          sections={sections}
          userName={userName}
          userEmail={userEmail}
          pendingAmendments={pendingAmendments}
        />
      </aside>

      {/* ── Mobile: header con hamburger ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Apri menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'HR Portal'}
          </span>
        </div>
        <Image
          src="/eurisko.png"
          alt="Eurisko"
          width={80}
          height={24}
          className="object-contain"
          priority
        />
      </div>

      {/* ── Mobile: overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: sidebar drawer ── */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Pulsante chiusura */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Chiudi menu"
        >
          <X className="h-5 w-5" />
        </button>

        <SidebarContent
          sections={sections}
          userName={userName}
          userEmail={userEmail}
          pendingAmendments={pendingAmendments}
          onLinkClick={() => setMobileOpen(false)}
        />
      </aside>
    </>
  )
}
