/**
 * Regole di validazione password condivise tra tutti i form dell'applicazione.
 */

export const PASSWORD_HINT =
  'Minimo 12 caratteri, una maiuscola, un numero e un carattere speciale (!@#$%&*?-_).'

/**
 * Valida una password secondo le regole aziendali.
 * Restituisce un messaggio di errore in italiano, oppure null se la password è valida.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 12)
    return 'La password deve avere almeno 12 caratteri.'
  if (!/[A-Z]/.test(password))
    return 'La password deve contenere almeno una lettera maiuscola.'
  if (!/[0-9]/.test(password))
    return 'La password deve contenere almeno un numero.'
  if (!/[!@#$%&*?\-_]/.test(password))
    return 'La password deve contenere almeno un carattere speciale (!@#$%&*?-_).'
  return null
}
