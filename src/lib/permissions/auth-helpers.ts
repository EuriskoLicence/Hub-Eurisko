/**
 * Helper di autorizzazione — HR Portal
 *
 * Regola fondamentale: tutte le API route e le pagine protette usano
 * ESCLUSIVAMENTE hasSection() / requireSection().
 * Mai confronti sul nome del ruolo o del profilo.
 *
 * Utilizzo tipico in un route handler:
 *
 *   const session = await auth()
 *   requireSection(session, 'TIMESHEET')          // lancia ForbiddenError se assente
 *   // oppure, per gestione esplicita:
 *   if (!hasSection(session, 'TIMESHEET')) return forbidden()
 */

import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { SectionCode } from './sections'

// ─── Errore 401 / 403 ─────────────────────────────────────────────────────────

/** Lanciato da requireSection() e requireAuthenticated() */
export class HttpError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

// ─── Controlli di autenticazione ─────────────────────────────────────────────

/**
 * Restituisce true se la sessione è presente e l'utente è autenticato.
 */
export function isAuthenticated(session: Session | null): session is Session {
  return session !== null && !!session.user?.id
}

/**
 * Lancia HttpError 401 se l'utente non è autenticato.
 * Usare come prima istruzione nelle API route che richiedono login.
 */
export function requireAuthenticated(
  session: Session | null,
): asserts session is Session {
  if (!isAuthenticated(session)) {
    throw new HttpError(401, 'Non autenticato')
  }
}

// ─── Controlli di autorizzazione ─────────────────────────────────────────────

/**
 * Restituisce true se la sessione contiene la sezione richiesta.
 * Safe su sessione null (restituisce false).
 */
export function hasSection(
  session: Session | null,
  section: SectionCode,
): boolean {
  return session?.user?.sections?.includes(section) ?? false
}

/**
 * Restituisce true se la sessione contiene ALMENO UNA delle sezioni indicate.
 * Utile per le voci di sidebar con accesso multi-sezione (es. CLIENTS_VIEW || CLIENTS_MANAGE).
 */
export function hasAnySection(
  session: Session | null,
  ...sections: SectionCode[]
): boolean {
  return sections.some((s) => hasSection(session, s))
}

/**
 * Restituisce true se la sessione contiene TUTTE le sezioni indicate.
 */
export function hasAllSections(
  session: Session | null,
  ...sections: SectionCode[]
): boolean {
  return sections.every((s) => hasSection(session, s))
}

/**
 * Lancia HttpError 403 se la sessione NON contiene la sezione richiesta.
 *
 * Usare come prima istruzione nelle API route protette:
 *
 *   const session = await auth()
 *   requireSection(session, 'TIMESHEET')
 */
export function requireSection(
  session: Session | null,
  section: SectionCode,
): asserts session is Session {
  requireAuthenticated(session)
  if (!hasSection(session, section)) {
    throw new HttpError(403, `Accesso negato: sezione '${section}' richiesta`)
  }
}

/**
 * Variante multi-sezione: lancia 403 se l'utente non ha NESSUNA delle sezioni.
 * Utile per route accessibili da più sezioni (es. CLIENTS_VIEW o CLIENTS_MANAGE).
 */
export function requireAnySection(
  session: Session | null,
  ...sections: SectionCode[]
): asserts session is Session {
  requireAuthenticated(session)
  if (!hasAnySection(session, ...sections)) {
    throw new HttpError(
      403,
      `Accesso negato: richiesta almeno una tra [${sections.join(', ')}]`,
    )
  }
}

// ─── Restituisce le sezioni della sessione ────────────────────────────────────

/**
 * Restituisce le sezioni abilitate per l'utente corrente.
 * Restituisce array vuoto se la sessione è assente.
 */
export function getUserSections(session: Session | null): SectionCode[] {
  return session?.user?.sections ?? []
}

// ─── Utility per route handler ────────────────────────────────────────────────

/**
 * Converte un HttpError nel NextResponse corrispondente (401 o 403).
 * Usare nel catch dei route handler per rispondere correttamente.
 *
 * Esempio:
 *
 *   try {
 *     const session = await auth()
 *     requireSection(session, 'TIMESHEET')
 *     // ... logica
 *   } catch (e) {
 *     return handleAuthError(e)
 *   }
 */
export function handleAuthError(error: unknown): NextResponse | never {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.status === 401 ? 'Non autenticato' : 'Accesso negato', message: error.message },
      { status: error.status },
    )
  }
  throw error // rilancia errori non gestiti (verranno catturati da Next.js → 500)
}

/**
 * Scorciatoia per restituire direttamente un 401 senza lanciare.
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
}

/**
 * Scorciatoia per restituire direttamente un 403 senza lanciare.
 */
export function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
}
