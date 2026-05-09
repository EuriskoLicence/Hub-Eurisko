'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  users, roles, profiles, profileSections, roleProfiles,
  absenceTypes, expenseCategories, engagementTypes,
  engagementStatuses, purchaseOrderLineStatuses,
  italianHolidays,
} from '@/db/schema'
import { requireSection, HttpError } from '@/lib/permissions/auth-helpers'
import { invalidateHolidayCache } from '@/lib/italian-calendar'
import { SECTIONS } from '@/lib/permissions/sections'
import type { SectionCode } from '@/lib/permissions/sections'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail, sendPasswordResetEmail } from '@/lib/email'
import { validatePassword } from '@/lib/password-rules'

// ─── USERS ────────────────────────────────────────────────────────────────────

export type UserRow = {
  id:                   string
  firstName:            string
  lastName:             string
  email:                string
  roleId:               string | null
  roleName:             string | null
  active:               boolean
  mustChangePassword:   boolean
  tempPassword:         string | null
  tariffaKm:            string | null
  excludeFromTimesheet: boolean
  partTime:             boolean
}

export type RoleOption = { id: string; name: string }

export async function getUserList(): Promise<{ users: UserRow[]; roles: RoleOption[] }> {
  const session = await auth()
  requireSection(session, 'PARAM_USERS')

  const [userRows, roleRows] = await Promise.all([
    db
      .select({
        id:                   users.id,
        firstName:            users.firstName,
        lastName:             users.lastName,
        email:                users.email,
        roleId:               users.roleId,
        roleName:             roles.name,
        active:               users.active,
        mustChangePassword:   users.mustChangePassword,
        tempPassword:         users.tempPassword,
        tariffaKm:            users.tariffaKm,
        excludeFromTimesheet: users.excludeFromTimesheet,
        partTime:             users.partTime,
      })
      .from(users)
      .leftJoin(roles, eq(roles.id, users.roleId))
      .orderBy(users.lastName, users.firstName),
    db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name),
  ])

  return {
    users: userRows.map((u) => ({
      id:                   u.id,
      firstName:            u.firstName,
      lastName:             u.lastName,
      email:                u.email,
      roleId:               u.roleId,
      roleName:             u.roleName ?? null,
      active:               u.active,
      mustChangePassword:   u.mustChangePassword,
      tempPassword:         u.tempPassword ?? null,
      tariffaKm:            u.tariffaKm   ?? null,
      excludeFromTimesheet: u.excludeFromTimesheet,
      partTime:             u.partTime,
    })),
    roles: roleRows,
  }
}

const UserCreateSchema = z.object({
  firstName: z.string().min(1, 'Nome obbligatorio.').max(80),
  lastName:  z.string().min(1, 'Cognome obbligatorio.').max(80),
  email:     z.string().email('Email non valida.'),
  roleId:    z.string().uuid().nullable().optional(),
})

export async function createUser(data: {
  firstName: string; lastName: string; email: string; roleId?: string | null
  excludeFromTimesheet?: boolean; partTime?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_USERS')

    const parsed = UserCreateSchema.safeParse(data)
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const userEmail    = parsed.data.email.trim().toLowerCase()
    const firstName    = parsed.data.firstName.trim()
    const lastName     = parsed.data.lastName.trim()

    const [row] = await db
      .insert(users)
      .values({
        firstName,
        lastName,
        email:                userEmail,
        passwordHash,
        roleId:               parsed.data.roleId!,
        active:               true,
        mustChangePassword:   true,
        tempPassword,
        excludeFromTimesheet: data.excludeFromTimesheet ?? false,
        partTime:             data.partTime             ?? false,
      })
      .returning({ id: users.id })

    // Invia email di benvenuto con la password temporanea (fire and forget)
    sendWelcomeEmail({
      userEmail,
      userName: firstName + ' ' + lastName,
      password: tempPassword,
    })

    revalidatePath('/admin/users')
    return { ok: true, id: row.id }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Email già in uso.' }
    console.error('createUser error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateUser(
  id: string,
  data: { firstName?: string; lastName?: string; email?: string; roleId?: string | null; active?: boolean; newPassword?: string; tariffaKm?: string | null; excludeFromTimesheet?: boolean; partTime?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_USERS')

    const set: Record<string, any> = {}
    if (data.firstName)            set.firstName = data.firstName.trim()
    if (data.lastName)             set.lastName  = data.lastName.trim()
    if (data.email)                set.email     = data.email.trim().toLowerCase()
    if (data.roleId !== undefined)  set.roleId   = data.roleId
    if (data.active !== undefined)               set.active               = data.active
    if (data.excludeFromTimesheet !== undefined) set.excludeFromTimesheet = data.excludeFromTimesheet
    if (data.partTime !== undefined)             set.partTime             = data.partTime
    if (data.tariffaKm !== undefined) {
      if (data.tariffaKm === '' || data.tariffaKm === null) {
        set.tariffaKm = null
      } else {
        const rate = parseFloat(data.tariffaKm)
        if (isNaN(rate) || rate < 0) return { ok: false, error: 'Tariffa km non valida.' }
        set.tariffaKm = rate.toFixed(4)
      }
    }
    if (data.newPassword) {
      const pwdError = validatePassword(data.newPassword)
      if (pwdError) return { ok: false, error: pwdError }
      set.passwordHash = await bcrypt.hash(data.newPassword, 12)
    }

    await db.update(users).set(set).where(eq(users.id, id))
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Email già in uso.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── RESET USER PASSWORD ──────────────────────────────────────────────────────

function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$%'
  const all = upper + lower + digits + special
  let pwd = upper[Math.floor(Math.random() * upper.length)]
          + lower[Math.floor(Math.random() * lower.length)]
          + digits[Math.floor(Math.random() * digits.length)]
          + special[Math.floor(Math.random() * special.length)]
  for (let i = 4; i < 12; i++) pwd += all[Math.floor(Math.random() * all.length)]
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

export async function resetUserPassword(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_USERS')

    const userRows = await db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (userRows.length === 0) return { ok: false, error: 'Utente non trovato.' }

    const user = userRows[0]
    const tempPassword = generateTempPassword()
    const hash = await bcrypt.hash(tempPassword, 12)

    await db
      .update(users)
      .set({ passwordHash: hash, mustChangePassword: true, tempPassword })
      .where(eq(users.id, userId))

    sendPasswordResetEmail({
      userEmail: user.email,
      userName:  user.firstName + ' ' + user.lastName,
      password:  tempPassword,
    })

    revalidatePath('/admin/users')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    console.error('resetUserPassword error:', err)
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── ROLES & PROFILES ─────────────────────────────────────────────────────────

export type ProfileRow = {
  id:       string
  name:     string
  sections: SectionCode[]
}

export type RoleRow = {
  id:       string
  name:     string
  profiles: { id: string; name: string }[]
}

export async function getRolesAndProfiles(): Promise<{ roles: RoleRow[]; profiles: ProfileRow[] }> {
  const session = await auth()
  requireSection(session, 'PARAM_ROLES')

  const [roleRows, profileRows, rpRows, psRows] = await Promise.all([
    db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name),
    db.select({ id: profiles.id, name: profiles.name }).from(profiles).orderBy(profiles.name),
    db.select({ roleId: roleProfiles.roleId, profileId: roleProfiles.profileId }).from(roleProfiles),
    db.select({ profileId: profileSections.profileId, sectionCode: profileSections.sectionCode }).from(profileSections),
  ])

  const sectionsByProfile = new Map<string, SectionCode[]>()
  for (const ps of psRows) {
    if (!sectionsByProfile.has(ps.profileId)) sectionsByProfile.set(ps.profileId, [])
    sectionsByProfile.get(ps.profileId)!.push(ps.sectionCode as SectionCode)
  }

  const profilesByRole = new Map<string, { id: string; name: string }[]>()
  for (const rp of rpRows) {
    if (!profilesByRole.has(rp.roleId)) profilesByRole.set(rp.roleId, [])
    const p = profileRows.find((x) => x.id === rp.profileId)
    if (p) profilesByRole.get(rp.roleId)!.push(p)
  }

  return {
    roles: roleRows.map((r) => ({
      id:       r.id,
      name:     r.name,
      profiles: profilesByRole.get(r.id) ?? [],
    })),
    profiles: profileRows.map((p) => ({
      id:       p.id,
      name:     p.name,
      sections: sectionsByProfile.get(p.id) ?? [],
    })),
  }
}

export async function createProfile(
  data: { name: string; sections: SectionCode[] },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ROLES')
    if (!data.name.trim()) return { ok: false, error: 'Il nome è obbligatorio.' }

    const [row] = await db.insert(profiles).values({ name: data.name.trim() }).returning({ id: profiles.id })

    if (data.sections.length > 0) {
      await db.insert(profileSections).values(data.sections.map((s) => ({ profileId: row.id, sectionCode: s })))
    }

    revalidatePath('/admin/roles')
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateProfile(
  id: string,
  data: { name?: string; sections?: SectionCode[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ROLES')

    if (data.name) await db.update(profiles).set({ name: data.name.trim() }).where(eq(profiles.id, id))

    if (data.sections !== undefined) {
      await db.delete(profileSections).where(eq(profileSections.profileId, id))
      if (data.sections.length > 0) {
        await db.insert(profileSections).values(data.sections.map((s) => ({ profileId: id, sectionCode: s })))
      }
    }

    revalidatePath('/admin/roles')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function createRole(
  data: { name: string; profileIds: string[] },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ROLES')
    if (!data.name.trim()) return { ok: false, error: 'Il nome è obbligatorio.' }

    const [row] = await db.insert(roles).values({ name: data.name.trim() }).returning({ id: roles.id })

    if (data.profileIds.length > 0) {
      await db.insert(roleProfiles).values(data.profileIds.map((p) => ({ roleId: row.id, profileId: p })))
    }

    revalidatePath('/admin/roles')
    return { ok: true, id: row.id }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateRole(
  id: string,
  data: { name?: string; profileIds?: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ROLES')

    if (data.name) await db.update(roles).set({ name: data.name.trim() }).where(eq(roles.id, id))

    if (data.profileIds !== undefined) {
      await db.delete(roleProfiles).where(eq(roleProfiles.roleId, id))
      if (data.profileIds.length > 0) {
        await db.insert(roleProfiles).values(data.profileIds.map((p) => ({ roleId: id, profileId: p })))
      }
    }

    revalidatePath('/admin/roles')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── ABSENCE TYPES ────────────────────────────────────────────────────────────

export type AbsenceTypeRow = {
  id: string; shortCode: string | null; label: string; active: boolean; partTimeOnly: boolean
}

export async function getAbsenceTypes(): Promise<AbsenceTypeRow[]> {
  const session = await auth()
  requireSection(session, 'PARAM_ABSENCES')
  return db.select().from(absenceTypes).orderBy(absenceTypes.label)
}

const SHORT_CODE_RE = /^[A-Z0-9]{2}$/

export async function createAbsenceType(
  data: { shortCode: string; label: string; partTimeOnly?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ABSENCES')
    if (!data.label.trim()) return { ok: false, error: 'Label obbligatoria.' }
    const sc = data.shortCode.trim().toUpperCase()
    if (!SHORT_CODE_RE.test(sc)) return { ok: false, error: 'La codifica deve essere esattamente 2 caratteri alfanumerici (A-Z, 0-9).' }

    await db.insert(absenceTypes).values({
      shortCode:    sc,
      label:        data.label.trim(),
      active:       true,
      partTimeOnly: data.partTimeOnly ?? false,
    })
    revalidatePath('/admin/absences')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if ((err as any).code === '23505') return { ok: false, error: 'Codifica breve già in uso. Scegli una codifica diversa.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateAbsenceType(
  id: string,
  data: { shortCode?: string; label?: string; active?: boolean; partTimeOnly?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ABSENCES')
    const payload: Record<string, unknown> = { ...data }
    if (data.shortCode !== undefined) {
      const sc = data.shortCode.trim().toUpperCase()
      if (!SHORT_CODE_RE.test(sc)) return { ok: false, error: 'La codifica deve essere esattamente 2 caratteri alfanumerici (A-Z, 0-9).' }
      payload.shortCode = sc
    }
    await db.update(absenceTypes).set(payload).where(eq(absenceTypes.id, id))
    revalidatePath('/admin/absences')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Codifica breve già in uso. Scegli una codifica diversa.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── EXPENSE CATEGORIES ───────────────────────────────────────────────────────

export type ExpenseCategoryRow = {
  id: string; code: string; label: string
  requiresAttachment: boolean; isKmBased: boolean; active: boolean
}
export async function getExpenseCategories(): Promise<{ categories: ExpenseCategoryRow[] }> {
  const session = await auth()
  requireSection(session, 'PARAM_EXPENSE_CAT')
  const cats = await db.select().from(expenseCategories).orderBy(expenseCategories.label)
  return { categories: cats }
}

export async function createExpenseCategory(
  data: { code: string; label: string; requiresAttachment: boolean; isKmBased: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_EXPENSE_CAT')
    if (!data.code.trim() || !data.label.trim()) return { ok: false, error: 'Codice e label obbligatori.' }

    await db.insert(expenseCategories).values({
      code:               data.code.trim().toUpperCase(),
      label:              data.label.trim(),
      requiresAttachment: data.requiresAttachment,
      isKmBased:          data.isKmBased,
      active:             true,
    })
    revalidatePath('/admin/expense-categories')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Codice già in uso.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateExpenseCategory(
  id: string,
  data: { label?: string; requiresAttachment?: boolean; isKmBased?: boolean; active?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_EXPENSE_CAT')
    await db.update(expenseCategories).set(data).where(eq(expenseCategories.id, id))
    revalidatePath('/admin/expense-categories')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── ENGAGEMENT TYPES ─────────────────────────────────────────────────────────

export type EngagementTypeRow = { id: string; name: string; active: boolean }

export async function getEngagementTypes(): Promise<EngagementTypeRow[]> {
  const session = await auth()
  requireSection(session, 'PARAM_ENGAGEMENTS')
  return db.select().from(engagementTypes).orderBy(engagementTypes.name)
}

export async function createEngagementType(
  data: { name: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ENGAGEMENTS')
    if (!data.name.trim()) return { ok: false, error: 'Il nome è obbligatorio.' }

    await db.insert(engagementTypes).values({ name: data.name.trim(), active: true })
    revalidatePath('/admin/engagement-types')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Nome già in uso.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateEngagementType(
  id: string,
  data: { name?: string; active?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ENGAGEMENTS')
    await db.update(engagementTypes).set(data).where(eq(engagementTypes.id, id))
    revalidatePath('/admin/engagement-types')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── HOLIDAYS ─────────────────────────────────────────────────────────────────

export type HolidayRow = { id: string; date: string; name: string; isRecurring: boolean }

export async function getHolidays(year?: number): Promise<HolidayRow[]> {
  const session = await auth()
  requireSection(session, 'PARAM_HOLIDAYS')

  const rows = await db.select().from(italianHolidays).orderBy(italianHolidays.date)

  return rows
    .filter((r) => !year || r.date.startsWith(String(year)))
    .map((r) => ({ id: r.id, date: r.date, name: r.name, isRecurring: r.isRecurring }))
}

export async function createHoliday(
  data: { date: string; name: string; isRecurring: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_HOLIDAYS')
    if (!data.date || !data.name.trim()) return { ok: false, error: 'Data e nome obbligatori.' }

    await db.insert(italianHolidays).values({ date: data.date, name: data.name.trim(), isRecurring: data.isRecurring })
    invalidateHolidayCache()
    revalidatePath('/admin/holidays')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Questa data è già presente.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateHoliday(
  id: string,
  data: { name?: string; isRecurring?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_HOLIDAYS')
    await db.update(italianHolidays).set(data).where(eq(italianHolidays.id, id))
    invalidateHolidayCache()
    revalidatePath('/admin/holidays')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function deleteHoliday(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_HOLIDAYS')
    await db.delete(italianHolidays).where(eq(italianHolidays.id, id))
    invalidateHolidayCache()
    revalidatePath('/admin/holidays')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── ENGAGEMENT STATUSES (stati commessa) ────────────────────────────────────

export type EngagementStatusRow = { id: string; code: string; description: string; active: boolean }

const StatusCodeRegex = /^[A-Z0-9]{3}$/

export async function getEngagementStatuses(): Promise<EngagementStatusRow[]> {
  const session = await auth()
  requireSection(session, 'PARAM_ENGAGEMENT_STATUSES')
  return db
    .select({ id: engagementStatuses.id, code: engagementStatuses.code, description: engagementStatuses.description, active: engagementStatuses.active })
    .from(engagementStatuses)
    .orderBy(engagementStatuses.code)
}

export async function createEngagementStatus(
  data: { code: string; description: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ENGAGEMENT_STATUSES')

    const code = data.code.trim().toUpperCase()
    const description = data.description.trim()

    if (!StatusCodeRegex.test(code)) return { ok: false, error: 'Il codice deve essere di 3 caratteri alfanumerici (A-Z, 0-9).' }
    if (!description) return { ok: false, error: 'La descrizione è obbligatoria.' }

    await db.insert(engagementStatuses).values({ code, description, active: true })
    revalidatePath('/admin/engagement-statuses')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Codice già in uso.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updateEngagementStatus(
  id: string,
  data: { code?: string; description?: string; active?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_ENGAGEMENT_STATUSES')

    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (data.code !== undefined) {
      const code = data.code.trim().toUpperCase()
      if (!StatusCodeRegex.test(code)) return { ok: false, error: 'Il codice deve essere di 3 caratteri alfanumerici (A-Z, 0-9).' }
      set.code = code
    }
    if (data.description !== undefined) {
      const description = data.description.trim()
      if (!description) return { ok: false, error: 'La descrizione è obbligatoria.' }
      set.description = description
    }
    if (data.active !== undefined) set.active = data.active

    await db.update(engagementStatuses).set(set).where(eq(engagementStatuses.id, id))
    revalidatePath('/admin/engagement-statuses')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Codice già in uso.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

// ─── PURCHASE ORDER LINE STATUSES (stati posizione OdA) ──────────────────────

export type PurchaseOrderLineStatusRow = { id: string; code: string; description: string; active: boolean }

export async function getPurchaseOrderLineStatuses(): Promise<PurchaseOrderLineStatusRow[]> {
  const session = await auth()
  requireSection(session, 'PARAM_PO_LINE_STATUSES')
  return db
    .select({ id: purchaseOrderLineStatuses.id, code: purchaseOrderLineStatuses.code, description: purchaseOrderLineStatuses.description, active: purchaseOrderLineStatuses.active })
    .from(purchaseOrderLineStatuses)
    .orderBy(purchaseOrderLineStatuses.code)
}

export async function createPurchaseOrderLineStatus(
  data: { code: string; description: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_PO_LINE_STATUSES')

    const code = data.code.trim().toUpperCase()
    const description = data.description.trim()

    if (!StatusCodeRegex.test(code)) return { ok: false, error: 'Il codice deve essere di 3 caratteri alfanumerici (A-Z, 0-9).' }
    if (!description) return { ok: false, error: 'La descrizione è obbligatoria.' }

    await db.insert(purchaseOrderLineStatuses).values({ code, description, active: true })
    revalidatePath('/admin/po-line-statuses')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Codice già in uso.' }
    return { ok: false, error: 'Errore del server.' }
  }
}

export async function updatePurchaseOrderLineStatus(
  id: string,
  data: { code?: string; description?: string; active?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireSection(session, 'PARAM_PO_LINE_STATUSES')

    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (data.code !== undefined) {
      const code = data.code.trim().toUpperCase()
      if (!StatusCodeRegex.test(code)) return { ok: false, error: 'Il codice deve essere di 3 caratteri alfanumerici (A-Z, 0-9).' }
      set.code = code
    }
    if (data.description !== undefined) {
      const description = data.description.trim()
      if (!description) return { ok: false, error: 'La descrizione è obbligatoria.' }
      set.description = description
    }
    if (data.active !== undefined) set.active = data.active

    await db.update(purchaseOrderLineStatuses).set(set).where(eq(purchaseOrderLineStatuses.id, id))
    revalidatePath('/admin/po-line-statuses')
    return { ok: true }
  } catch (err: any) {
    if (err instanceof HttpError) return { ok: false, error: err.message }
    if (err.code === '23505') return { ok: false, error: 'Codice già in uso.' }
    return { ok: false, error: 'Errore del server.' }
  }
}
