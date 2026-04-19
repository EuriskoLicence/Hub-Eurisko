/**
 * Test suite per src/lib/permissions/auth-helpers.ts
 *
 * Copre:
 *  - hasSection / hasAnySection / hasAllSections
 *  - getUserSections
 *  - requireAuthenticated / requireSection → throws HttpError corretto
 *  - HttpError (status, message, name)
 */

import { describe, it, expect } from 'vitest'
import {
  HttpError,
  isAuthenticated,
  hasSection,
  hasAnySection,
  hasAllSections,
  getUserSections,
  requireAuthenticated,
  requireSection,
} from './auth-helpers'
import type { SectionCode } from './sections'

// ─── Fixture sessione mock ────────────────────────────────────────────────────

function makeSession(sections: SectionCode[] = []) {
  return {
    user: {
      id:        'user-abc',
      email:     'test@example.com',
      firstName: 'Mario',
      lastName:  'Rossi',
      roleId:    'role-1',
      roleName:  'Dipendente',
      sections,
    },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(),
  } as any  // cast: Session è augmented ma qui interessa solo la forma
}

const SESSION_TS   = makeSession(['TIMESHEET', 'TIMESHEET_AMENDMENT'])
const SESSION_ALL  = makeSession(Object.keys({
  TIMESHEET: '', TIMESHEET_AMENDMENT: '', EXPENSES: '', EXPENSES_AMENDMENT: '',
  CLIENTS_VIEW: '', CLIENTS_MANAGE: '', FINANCE_DASHBOARD: '', FINANCE_AMENDMENT: '',
  FINANCE_EXPORT: '', PARAM_USERS: '', PARAM_ROLES: '', PARAM_ABSENCES: '',
  PARAM_EXPENSE_CAT: '', PARAM_ENGAGEMENTS: '', PARAM_HOLIDAYS: '',
}) as SectionCode[])
const SESSION_NONE = makeSession([])
const NULL_SESSION = null

// ─── HttpError ────────────────────────────────────────────────────────────────

describe('HttpError', () => {
  it('costruisce un 401 con messaggio', () => {
    const e = new HttpError(401, 'Non autenticato')
    expect(e.status).toBe(401)
    expect(e.message).toBe('Non autenticato')
    expect(e.name).toBe('HttpError')
  })

  it('costruisce un 403 con messaggio', () => {
    const e = new HttpError(403, 'Accesso negato')
    expect(e.status).toBe(403)
    expect(e.message).toBe('Accesso negato')
  })

  it('è un instanceof Error', () => {
    expect(new HttpError(401, 'x')).toBeInstanceOf(Error)
  })
})

// ─── isAuthenticated ──────────────────────────────────────────────────────────

describe('isAuthenticated', () => {
  it('restituisce true per una sessione valida', () => {
    expect(isAuthenticated(SESSION_TS)).toBe(true)
  })

  it('restituisce false per null', () => {
    expect(isAuthenticated(null)).toBe(false)
  })
})

// ─── hasSection ───────────────────────────────────────────────────────────────

describe('hasSection', () => {
  it('restituisce true se la sezione è presente', () => {
    expect(hasSection(SESSION_TS, 'TIMESHEET')).toBe(true)
    expect(hasSection(SESSION_TS, 'TIMESHEET_AMENDMENT')).toBe(true)
  })

  it('restituisce false se la sezione è assente', () => {
    expect(hasSection(SESSION_TS, 'EXPENSES')).toBe(false)
    expect(hasSection(SESSION_TS, 'FINANCE_DASHBOARD')).toBe(false)
  })

  it('restituisce false per sessione null', () => {
    expect(hasSection(null, 'TIMESHEET')).toBe(false)
  })

  it('restituisce false per sessione senza sezioni', () => {
    expect(hasSection(SESSION_NONE, 'TIMESHEET')).toBe(false)
  })

  it('restituisce true su sessione con tutte le sezioni', () => {
    expect(hasSection(SESSION_ALL, 'PARAM_HOLIDAYS')).toBe(true)
  })
})

// ─── hasAnySection ────────────────────────────────────────────────────────────

describe('hasAnySection', () => {
  it('restituisce true se ha almeno una sezione', () => {
    expect(hasAnySection(SESSION_TS, 'TIMESHEET', 'EXPENSES')).toBe(true)
  })

  it('restituisce false se non ha nessuna delle sezioni', () => {
    expect(hasAnySection(SESSION_TS, 'EXPENSES', 'FINANCE_DASHBOARD')).toBe(false)
  })

  it('restituisce false per sessione null', () => {
    expect(hasAnySection(null, 'TIMESHEET', 'EXPENSES')).toBe(false)
  })

  it('restituisce false con lista sezioni vuota', () => {
    // Nessuna sezione richiesta → nessuna presente → false
    expect(hasAnySection(SESSION_TS)).toBe(false)
  })

  it('restituisce true con singola sezione presente', () => {
    expect(hasAnySection(SESSION_TS, 'TIMESHEET_AMENDMENT')).toBe(true)
  })
})

// ─── hasAllSections ───────────────────────────────────────────────────────────

describe('hasAllSections', () => {
  it('restituisce true se ha tutte le sezioni', () => {
    expect(hasAllSections(SESSION_TS, 'TIMESHEET', 'TIMESHEET_AMENDMENT')).toBe(true)
  })

  it('restituisce false se manca anche solo una sezione', () => {
    expect(hasAllSections(SESSION_TS, 'TIMESHEET', 'EXPENSES')).toBe(false)
  })

  it('restituisce true con lista vuota (vacuously true)', () => {
    expect(hasAllSections(SESSION_TS)).toBe(true)
  })

  it('restituisce false per sessione null', () => {
    expect(hasAllSections(null, 'TIMESHEET')).toBe(false)
  })
})

// ─── getUserSections ──────────────────────────────────────────────────────────

describe('getUserSections', () => {
  it('restituisce le sezioni della sessione', () => {
    const sections = getUserSections(SESSION_TS)
    expect(sections).toContain('TIMESHEET')
    expect(sections).toContain('TIMESHEET_AMENDMENT')
    expect(sections).toHaveLength(2)
  })

  it('restituisce array vuoto per sessione null', () => {
    expect(getUserSections(null)).toEqual([])
  })

  it('restituisce array vuoto per sessione senza sezioni', () => {
    expect(getUserSections(SESSION_NONE)).toEqual([])
  })
})

// ─── requireAuthenticated ─────────────────────────────────────────────────────

describe('requireAuthenticated', () => {
  it('non lancia per una sessione valida', () => {
    expect(() => requireAuthenticated(SESSION_TS)).not.toThrow()
  })

  it('lancia HttpError 401 per sessione null', () => {
    expect(() => requireAuthenticated(null)).toThrow(HttpError)
    try {
      requireAuthenticated(null)
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError)
      expect((e as HttpError).status).toBe(401)
    }
  })
})

// ─── requireSection ───────────────────────────────────────────────────────────

describe('requireSection', () => {
  it('non lancia se la sezione è presente', () => {
    expect(() => requireSection(SESSION_TS, 'TIMESHEET')).not.toThrow()
  })

  it('lancia HttpError 403 se la sezione è assente', () => {
    expect(() => requireSection(SESSION_TS, 'EXPENSES')).toThrow(HttpError)
    try {
      requireSection(SESSION_TS, 'EXPENSES')
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError)
      expect((e as HttpError).status).toBe(403)
      expect((e as HttpError).message).toContain('EXPENSES')
    }
  })

  it('lancia HttpError 401 per sessione null', () => {
    expect(() => requireSection(null, 'TIMESHEET')).toThrow(HttpError)
    try {
      requireSection(null, 'TIMESHEET')
    } catch (e) {
      expect((e as HttpError).status).toBe(401)
    }
  })

  it('il messaggio di errore 403 include il nome della sezione richiesta', () => {
    try {
      requireSection(SESSION_TS, 'FINANCE_DASHBOARD')
      expect.fail('avrebbe dovuto lanciare')
    } catch (e) {
      expect((e as HttpError).message).toContain('FINANCE_DASHBOARD')
    }
  })
})
