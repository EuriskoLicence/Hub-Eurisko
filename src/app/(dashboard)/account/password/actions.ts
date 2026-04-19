'use server'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAuthenticated } from '@/lib/permissions/auth-helpers'

export async function changePassword(
  currentPassword: string,
  newPassword:     string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireAuthenticated(session)
    const userId = session.user.id

    if (!currentPassword || !newPassword) {
      return { ok: false, error: 'Tutti i campi sono obbligatori.' }
    }
    if (newPassword.length < 8) {
      return { ok: false, error: 'La nuova password deve avere almeno 8 caratteri.' }
    }
    if (currentPassword === newPassword) {
      return { ok: false, error: 'La nuova password deve essere diversa da quella attuale.' }
    }

    // Recupera hash attuale
    const rows = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!rows.length) return { ok: false, error: 'Utente non trovato.' }

    const valid = await bcrypt.compare(currentPassword, rows[0].passwordHash)
    if (!valid) return { ok: false, error: 'La password attuale non è corretta.' }

    const newHash = await bcrypt.hash(newPassword, 12)
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId))

    return { ok: true }
  } catch {
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}
