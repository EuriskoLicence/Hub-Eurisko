/**
 * Seed — HR Portal
 *
 * Esecuzione:
 *   npm run db:seed
 *   (alias: tsx --env-file .env.local src/db/seed.ts)
 *
 * Il seed è idempotente: può essere eseguito più volte senza duplicare i dati.
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { SECTIONS, SECTIONS_META, type SectionCode } from '../lib/permissions/sections'
import {
  sections,
  profiles,
  profileSections,
  roles,
  roleProfiles,
  users,
  absenceTypes,
  expenseCategories,
  vehicleTypes,
  engagementTypes,
  clients,
  projects,
  engagements,
  italianHolidays,
} from './schema'

// ─── Setup DB ────────────────────────────────────────────────────────────────

const sql = neon(process.env.DATABASE_URL!)
const db  = drizzle(sql)

// ─── Algoritmo di Gauss — calcolo Pasqua ─────────────────────────────────────

function gaussEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 1-based
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

// ─── Helper upsert ────────────────────────────────────────────────────────────

async function findOrCreate<T extends { id: string }>(
  table: any,
  uniqueField: any,
  uniqueValue: string,
  data: Record<string, unknown>,
): Promise<string> {
  const existing = await db.select({ id: table.id }).from(table).where(eq(uniqueField, uniqueValue)).limit(1)
  if (existing.length > 0) return existing[0].id
  const inserted = await db.insert(table).values(data).returning({ id: table.id })
  return inserted[0].id
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Avvio seed HR Portal...\n')

  // ── 1. Sezioni ─────────────────────────────────────────────────────────────
  console.log('1/14 · Sezioni...')
  for (const code of Object.keys(SECTIONS) as SectionCode[]) {
    const meta = SECTIONS_META[code]
    await db
      .insert(sections)
      .values({ code, label: meta.label, description: meta.description, sortOrder: meta.sortOrder })
      .onConflictDoNothing()
  }
  console.log(`     ✓ ${Object.keys(SECTIONS).length} sezioni inserite`)

  // ── 2-6. Profili ───────────────────────────────────────────────────────────
  console.log('2/14 · Profili...')

  const PROFILES: Array<{ name: string; description: string; sectionCodes: SectionCode[] }> = [
    {
      name: 'Consuntivazione',
      description: 'Accesso alla consuntivazione mensile e richiesta rettifica',
      sectionCodes: ['TIMESHEET', 'TIMESHEET_AMENDMENT'],
    },
    {
      name: 'Nota spese',
      description: 'Accesso alla nota spese e richiesta rettifica',
      sectionCodes: ['EXPENSES', 'EXPENSES_AMENDMENT'],
    },
    {
      name: 'Gestione clienti',
      description: 'Visualizzazione e gestione clienti, progetti e commesse',
      sectionCodes: ['CLIENTS_VIEW', 'CLIENTS_MANAGE'],
    },
    {
      name: 'HR Finance',
      description: 'Dashboard riepilogativa, gestione rettifiche ed esportazione',
      sectionCodes: ['FINANCE_DASHBOARD', 'FINANCE_AMENDMENT', 'FINANCE_EXPORT'],
    },
    {
      name: 'Parametrizzazioni',
      description: 'Configurazione completa del sistema (utenti, ruoli, categorie, festività)',
      sectionCodes: ['PARAM_USERS', 'PARAM_ROLES', 'PARAM_ABSENCES', 'PARAM_EXPENSE_CAT', 'PARAM_ENGAGEMENTS', 'PARAM_HOLIDAYS'],
    },
  ]

  const profileIds: Record<string, string> = {}
  for (const p of PROFILES) {
    const id = await findOrCreate(profiles, profiles.name, p.name, { name: p.name, description: p.description })
    profileIds[p.name] = id

    for (const code of p.sectionCodes) {
      await db
        .insert(profileSections)
        .values({ profileId: id, sectionCode: code })
        .onConflictDoNothing()
    }
  }
  console.log(`     ✓ ${PROFILES.length} profili inseriti`)

  // ── 7. Ruoli ───────────────────────────────────────────────────────────────
  console.log('3/14 · Ruoli...')

  const ROLES: Array<{ name: string; description: string; profileNames: string[] }> = [
    {
      name: 'Dipendente',
      description: 'Accesso a consuntivazione e nota spese',
      profileNames: ['Consuntivazione', 'Nota spese'],
    },
    {
      name: 'Manager',
      description: 'Accesso a consuntivazione, nota spese e gestione clienti',
      profileNames: ['Consuntivazione', 'Nota spese', 'Gestione clienti'],
    },
    {
      name: 'HR Finance',
      description: 'Accesso a consuntivazione, nota spese e area finance',
      profileNames: ['Consuntivazione', 'Nota spese', 'HR Finance'],
    },
    {
      name: 'Admin',
      description: 'Accesso completo alle parametrizzazioni di sistema',
      profileNames: ['Parametrizzazioni'],
    },
  ]

  const roleIds: Record<string, string> = {}
  for (const r of ROLES) {
    const id = await findOrCreate(roles, roles.name, r.name, { name: r.name, description: r.description })
    roleIds[r.name] = id

    for (const profileName of r.profileNames) {
      const profileId = profileIds[profileName]
      await db
        .insert(roleProfiles)
        .values({ roleId: id, profileId })
        .onConflictDoNothing()
    }
  }
  console.log(`     ✓ ${ROLES.length} ruoli inseriti`)

  // ── 8. Utente Admin ────────────────────────────────────────────────────────
  console.log('4/14 · Utente admin...')

  const adminEmail    = process.env.ADMIN_EMAIL    ?? 'admin@azienda.it'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme123'
  const adminRoleId   = roleIds['Admin']

  const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1)
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    await db.insert(users).values({
      firstName:    'Admin',
      lastName:     'HR Portal',
      email:        adminEmail,
      passwordHash,
      roleId:       adminRoleId,
      active:       true,
    })
    console.log(`     ✓ Admin creato: ${adminEmail}`)
  } else {
    console.log(`     · Admin già presente: ${adminEmail}`)
  }

  const adminUser = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1)
  const adminId   = adminUser[0].id

  // ── 9. Voci di assenza ─────────────────────────────────────────────────────
  console.log('5/14 · Voci di assenza...')

  const ABSENCE_TYPES = [
    { code: 'FERIE',    label: 'Ferie' },
    { code: 'MALATTIA', label: 'Malattia' },
    { code: 'PERMESSO', label: 'Permesso' },
    { code: 'ROL',      label: 'ROL (Riduzione Orario Lavoro)' },
    { code: 'LUTTO',    label: 'Lutto' },
  ]

  for (const a of ABSENCE_TYPES) {
    await db.insert(absenceTypes).values({ code: a.code, label: a.label }).onConflictDoNothing()
  }
  console.log(`     ✓ ${ABSENCE_TYPES.length} voci di assenza inserite`)

  // ── 10. Categorie nota spese ───────────────────────────────────────────────
  console.log('6/14 · Categorie nota spese...')

  const EXPENSE_CATEGORIES = [
    { code: 'PRANZO',  label: 'Pranzo',        requiresAttachment: true,  isKmBased: false },
    { code: 'CENA',    label: 'Cena',           requiresAttachment: true,  isKmBased: false },
    { code: 'TAXI',    label: 'Taxi / NCC',     requiresAttachment: true,  isKmBased: false },
    { code: 'HOTEL',   label: 'Pernottamento',  requiresAttachment: true,  isKmBased: false },
    { code: 'KM',      label: 'Rimborso km',    requiresAttachment: false, isKmBased: true  },
    { code: 'TRENO',   label: 'Treno',          requiresAttachment: true,  isKmBased: false },
    { code: 'AEREO',   label: 'Aereo',          requiresAttachment: true,  isKmBased: false },
    { code: 'VARIE',   label: 'Varie',          requiresAttachment: false, isKmBased: false },
  ]

  for (const c of EXPENSE_CATEGORIES) {
    await db
      .insert(expenseCategories)
      .values({ code: c.code, label: c.label, requiresAttachment: c.requiresAttachment, isKmBased: c.isKmBased })
      .onConflictDoNothing()
  }
  console.log(`     ✓ ${EXPENSE_CATEGORIES.length} categorie inserite`)

  // ── 11. Tipi veicolo ───────────────────────────────────────────────────────
  console.log('7/14 · Tipi veicolo...')

  const VEHICLE_TYPES = [
    { name: 'Auto propria',    ratePerKm: '0.4200' },
    { name: 'Auto aziendale',  ratePerKm: '0.3000' },
    { name: 'Moto',            ratePerKm: '0.2500' },
  ]

  for (const v of VEHICLE_TYPES) {
    await db.insert(vehicleTypes).values({ name: v.name, ratePerKm: v.ratePerKm }).onConflictDoNothing()
  }
  console.log(`     ✓ ${VEHICLE_TYPES.length} tipi veicolo inseriti`)

  // ── 12. Tipologie commessa ─────────────────────────────────────────────────
  console.log('8/14 · Tipologie commessa...')

  const ENGAGEMENT_TYPES = [
    { name: 'Chiavi in mano',              description: 'Progetto a prezzo fisso con deliverable definiti' },
    { name: 'Time & material',             description: 'Fatturazione su ore lavorate e materiali utilizzati' },
    { name: 'Costo (attività commerciale)', description: 'Attività commerciale a costo interno' },
  ]

  const engagementTypeIds: Record<string, string> = {}
  for (const et of ENGAGEMENT_TYPES) {
    const id = await findOrCreate(engagementTypes, engagementTypes.name, et.name, { name: et.name, description: et.description })
    engagementTypeIds[et.name] = id
  }
  console.log(`     ✓ ${ENGAGEMENT_TYPES.length} tipologie commessa inserite`)

  // ── 13. Clienti, Progetti, Commesse di esempio ─────────────────────────────
  console.log('9/14 · Clienti di esempio...')

  const client1Id = await findOrCreate(clients, clients.code, 'ACME', {
    name:  'Acme S.p.A.',
    code:  'ACME',
    notes: 'Cliente principale — settore manifatturiero',
  })

  const client2Id = await findOrCreate(clients, clients.code, 'BETA', {
    name:  'Beta Industries S.r.l.',
    code:  'BETA',
    notes: 'Cliente secondario — settore logistica',
  })

  console.log('     ✓ 2 clienti inseriti')
  console.log('10/14 · Progetti di esempio...')

  const project1Id = await findOrCreate(projects, projects.code, 'ACME-2025', {
    clientId:          client1Id,
    name:              'Trasformazione digitale Acme',
    code:              'ACME-2025',
    responsibleUserId: adminId,
    notes:             'Progetto pluriennale di digitalizzazione',
  })

  const project2Id = await findOrCreate(projects, projects.code, 'BETA-2025', {
    clientId:          client2Id,
    name:              'Ottimizzazione supply chain Beta',
    code:              'BETA-2025',
    responsibleUserId: adminId,
  })

  console.log('     ✓ 2 progetti inseriti')
  console.log('11/14 · Commesse di esempio...')

  await findOrCreate(engagements, engagements.code, 'ENG-2025-001', {
    projectId:        project1Id,
    engagementTypeId: engagementTypeIds['Chiavi in mano'],
    name:             'Implementazione ERP — Chiavi in mano',
    code:             'ENG-2025-001',
    notes:            'Fornitura e installazione sistema ERP completo',
  })

  await findOrCreate(engagements, engagements.code, 'ENG-2025-002', {
    projectId:        project1Id,
    engagementTypeId: engagementTypeIds['Time & material'],
    name:             'Supporto post-go-live — T&M',
    code:             'ENG-2025-002',
    notes:            'Assistenza e sviluppo evolutivo su base ore',
  })

  await findOrCreate(engagements, engagements.code, 'ENG-2025-003', {
    projectId:        project2Id,
    engagementTypeId: engagementTypeIds['Costo (attività commerciale)'],
    name:             'Pre-sales Beta Industries',
    code:             'ENG-2025-003',
    notes:            'Attività commerciale e proposta tecnica',
  })

  console.log('     ✓ 3 commesse inserite')

  // ── 14. Festività italiane 2024-2030 ──────────────────────────────────────
  console.log('12/14 · Festività italiane 2024-2030...')

  const FIXED_HOLIDAYS = [
    { month: 1,  day: 1,  name: 'Capodanno' },
    { month: 1,  day: 6,  name: 'Epifania' },
    { month: 4,  day: 25, name: 'Festa della Liberazione' },
    { month: 5,  day: 1,  name: 'Festa dei Lavoratori' },
    { month: 6,  day: 2,  name: 'Festa della Repubblica' },
    { month: 8,  day: 15, name: 'Ferragosto' },
    { month: 11, day: 1,  name: 'Ognissanti' },
    { month: 12, day: 8,  name: 'Immacolata Concezione' },
    { month: 12, day: 25, name: 'Natale' },
    { month: 12, day: 26, name: 'Santo Stefano' },
  ]

  const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030]
  let holidayCount = 0

  for (const year of YEARS) {
    // Festività fisse
    for (const h of FIXED_HOLIDAYS) {
      const dateStr = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`
      await db
        .insert(italianHolidays)
        .values({ date: dateStr, name: h.name, isRecurring: true })
        .onConflictDoNothing()
      holidayCount++
    }

    // Pasqua (algoritmo di Gauss)
    const easter      = gaussEaster(year)
    const pasquetta   = addDays(easter, 1)

    await db
      .insert(italianHolidays)
      .values({ date: toIsoDate(easter),    name: 'Pasqua',    isRecurring: false })
      .onConflictDoNothing()

    await db
      .insert(italianHolidays)
      .values({ date: toIsoDate(pasquetta), name: 'Pasquetta', isRecurring: false })
      .onConflictDoNothing()

    holidayCount += 2

    console.log(`     · ${year}: Pasqua ${toIsoDate(easter)}, Pasquetta ${toIsoDate(pasquetta)}`)
  }
  console.log(`     ✓ ${holidayCount} festività inserite (${YEARS.length} anni × ${FIXED_HOLIDAYS.length} fisse + 2 mobili)`)

  // ─── Fine seed ─────────────────────────────────────────────────────────────
  console.log('\n✅ Seed completato con successo!')
  console.log(`\n   Admin: ${adminEmail}`)
  console.log(`   Password: ${adminPassword}`)
  console.log('\n   Avvia il portale con: npm run dev')
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Errore durante il seed:', err)
    process.exit(1)
  })
