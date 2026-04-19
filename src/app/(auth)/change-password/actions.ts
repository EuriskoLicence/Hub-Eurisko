'use server'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAuthenticated } from '@/lib/permissions/auth-helpers'

export async function forceChangePassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth()
    requireAuthenticated(session)

    if (!newPassword || newPassword.length < 8) {
      return { ok: false, error: 'La password deve avere almeno 8 caratteri.' }
    }

    const newHash = await bcrypt.hash(newPassword, 12)
    await db.update(users)
      .set({ passwordHash: newHash, mustChangePassword: false, tempPassword: null })
      .where(eq(users.id, session.user.id))

    return { ok: true }
  } catch {
    return { ok: false, error: 'Errore del server. Riprova.' }
  }
}
