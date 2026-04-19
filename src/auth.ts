import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users, roles, roleProfiles, profiles, profileSections } from '@/db/schema'
import type { SectionCode } from '@/lib/permissions/sections'
import { authConfig } from './auth.config'

// ─── Validazione credenziali ──────────────────────────────────────────────────

const credentialsSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

// ─── Query utente + sezioni ───────────────────────────────────────────────────
//
// Calcola l'unione di tutte le sezioni abilitate per l'utente tramite JOIN:
//   users → roles → role_profiles → profiles → profile_sections
//
// Il risultato viene serializzato nel JWT al momento del login.

async function getUserWithSections(email: string) {
  // 1. Utente + ruolo
  const rows = await db
    .select({
      id:                 users.id,
      firstName:          users.firstName,
      lastName:           users.lastName,
      email:              users.email,
      passwordHash:       users.passwordHash,
      active:             users.active,
      mustChangePassword: users.mustChangePassword,
      roleId:             roles.id,
      roleName:           roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1)

  if (rows.length === 0) return null

  const user = rows[0]
  if (!user.active) return null

  // 2. Sezioni abilitate (DISTINCT per evitare duplicati se profili si sovrappongono)
  const sectionRows = await db
    .selectDistinct({ sectionCode: profileSections.sectionCode })
    .from(roleProfiles)
    .innerJoin(profiles,        eq(roleProfiles.profileId,   profiles.id))
    .innerJoin(profileSections, eq(profiles.id,              profileSections.profileId))
    .where(eq(roleProfiles.roleId, user.roleId))

  const userSections = sectionRows.map((r) => r.sectionCode as SectionCode)

  return { ...user, sections: userSections, mustChangePassword: user.mustChangePassword }
}

// ─── NextAuth v5 — configurazione ────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        // Valida formato input
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        // Carica utente + sezioni dal DB
        const user = await getUserWithSections(parsed.data.email)
        if (!user) return null

        // Verifica password
        const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!passwordValid) return null

        // L'oggetto restituito viene passato al callback jwt({ user })
        return {
          id:                 user.id,
          email:              user.email,
          firstName:          user.firstName,
          lastName:           user.lastName,
          roleId:             user.roleId,
          roleName:           user.roleName,
          sections:           user.sections,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],

})
