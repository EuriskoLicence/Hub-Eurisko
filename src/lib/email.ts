import { Resend } from 'resend'

// Lazy initialization — evita errori al build quando RESEND_API_KEY non è ancora disponibile
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 'missing')
}

const FROM    = process.env.RESEND_FROM  ?? 'noreply@example.com'
const APP_URL = process.env.NEXTAUTH_URL        ?? 'http://localhost:3000'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'HR Portal'

// ─── Helpers HTML ─────────────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#2563eb;border-radius:12px 12px 0 0;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">${APP_NAME}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
              <h1 style="margin:0 0 16px;font-size:20px;color:#1e293b;">${title}</h1>
              ${body}
              <hr style="margin:32px 0;border:none;border-top:1px solid #e2e8f0;" />
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Questo è un messaggio automatico di ${APP_NAME}. Non rispondere a questa email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(label: string, url: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
       padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${label}</a>
  </p>`
}

function info(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:14px;color:#64748b;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:500;">${value}</td>
  </tr>`
}

function table(...rows: string[]): string {
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows.join('')}</table>`
}

const IT_MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function monthLabel(year: number, month: number) {
  return `${IT_MONTHS[month - 1]} ${year}`
}

// ─── 1. Rettifica richiesta (all'HR Finance) ──────────────────────────────────

export async function sendAmendmentRequestedEmail(params: {
  type:       'timesheet' | 'expense'
  userName:   string
  userEmail:  string
  year:       number
  month:      number
  reason:     string
  reportTitle?: string
}) {
  const financeEmail = process.env.HR_FINANCE_EMAIL
  if (!financeEmail) return

  const typeLabel   = params.type === 'timesheet' ? 'Consuntivazione' : 'Nota spese'
  const detailTitle = params.type === 'expense' && params.reportTitle
    ? ` — ${params.reportTitle}`
    : ''

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      <strong>${params.userName}</strong> ha richiesto una rettifica per la ${typeLabel.toLowerCase()} di
      <strong>${monthLabel(params.year, params.month)}</strong>${detailTitle}.
    </p>
    ${table(
      info('Utente',    params.userName),
      info('Email',     params.userEmail),
      info('Tipo',      typeLabel),
      info('Periodo',   monthLabel(params.year, params.month)),
      info('Motivazione', params.reason),
    )}
    ${btn('Vai alle rettifiche', `${APP_URL}/finance/amendments`)}
  `

  await getResend().emails.send({
    from:    FROM,
    to:      financeEmail,
    subject: `[${APP_NAME}] Rettifica ${typeLabel} — ${params.userName} — ${monthLabel(params.year, params.month)}`,
    html:    layout(`Richiesta di rettifica ${typeLabel}`, body),
  }).catch((err) => console.error('sendAmendmentRequestedEmail error:', err))
}

// ─── 2. Rettifica revisionata (all'utente) ────────────────────────────────────

export async function sendAmendmentReviewedEmail(params: {
  type:             'timesheet' | 'expense'
  userEmail:        string
  userName:         string
  year:             number
  month:            number
  action:           'approve' | 'reject'
  rejectionReason?: string
  reportTitle?:     string
}) {
  const typeLabel    = params.type === 'timesheet' ? 'Consuntivazione' : 'Nota spese'
  const approved     = params.action === 'approve'
  const actionLabel  = approved ? 'approvata' : 'rifiutata'
  const detailHref   = params.type === 'timesheet'
    ? `${APP_URL}/timesheet`
    : `${APP_URL}/expenses`

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      La tua richiesta di rettifica per la ${typeLabel.toLowerCase()} di
      <strong>${monthLabel(params.year, params.month)}</strong> è stata <strong>${actionLabel}</strong>.
    </p>
    ${!approved && params.rejectionReason ? `
    <div style="margin:0 0 16px;padding:16px;background:#fef2f2;border-radius:8px;border-left:4px solid #ef4444;">
      <p style="margin:0;font-size:14px;color:#b91c1c;font-weight:600;">Motivazione del rifiuto</p>
      <p style="margin:8px 0 0;font-size:14px;color:#7f1d1d;">${params.rejectionReason}</p>
    </div>
    ` : ''}
    ${approved ? `
    <div style="margin:0 0 16px;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #22c55e;">
      <p style="margin:0;font-size:14px;color:#15803d;">
        La ${typeLabel.toLowerCase()} è tornata in bozza: puoi ora modificarla e inviarla nuovamente.
      </p>
    </div>
    ` : ''}
    ${btn(`Vai alla ${typeLabel.toLowerCase()}`, detailHref)}
  `

  await getResend().emails.send({
    from:    FROM,
    to:      params.userEmail,
    subject: `[${APP_NAME}] Rettifica ${actionLabel} — ${typeLabel} ${monthLabel(params.year, params.month)}`,
    html:    layout(`Rettifica ${actionLabel}`, body),
  }).catch((err) => console.error('sendAmendmentReviewedEmail error:', err))
}

// ─── 3. Sollecito consuntivazione (agli utenti) ───────────────────────────────

export async function sendTimesheetReminderEmail(params: {
  userEmail: string
  userName:  string
  year:      number
  month:     number
}) {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      Gentile <strong>${params.userName}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      ti ricordiamo che la consuntivazione del mese di
      <strong>${monthLabel(params.year, params.month)}</strong> risulta ancora non inviata.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      Ti chiediamo di completarla e inviarla al più presto accedendo al portale.
    </p>
    ${btn('Vai alla consuntivazione', `${APP_URL}/timesheet`)}
  `

  await getResend().emails.send({
    from:    FROM,
    to:      params.userEmail,
    subject: `[${APP_NAME}] Sollecito: consuntivazione ${monthLabel(params.year, params.month)} non inviata`,
    html:    layout('Sollecito consuntivazione', body),
  }).catch((err) => console.error('sendTimesheetReminderEmail error:', err))
}

// ─── 4. Benvenuto nuovo utente ────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  userEmail: string
  userName:  string
  password:  string
}) {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      Benvenuto/a <strong>${params.userName}</strong>!
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      È stato creato un account per te su ${APP_NAME}. Di seguito trovi le credenziali di accesso iniziali.
    </p>
    <div style="margin:0 0 24px;padding:20px 24px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      ${table(
        info('Email',    params.userEmail),
        info('Password', params.password),
      )}
    </div>
    <div style="margin:0 0 16px;padding:14px 16px;background:#fffbeb;border-radius:8px;border-left:4px solid #f59e0b;">
      <p style="margin:0;font-size:14px;color:#92400e;">
        Al primo accesso ti verrà chiesto di impostare una nuova password personale.
      </p>
    </div>
    ${btn('Accedi al portale', APP_URL)}
  `
  await getResend().emails.send({
    from:    FROM,
    to:      params.userEmail,
    subject: `[${APP_NAME}] Benvenuto — le tue credenziali di accesso`,
    html:    layout('Benvenuto su ' + APP_NAME, body),
  }).catch((err) => console.error('sendWelcomeEmail error:', err))
}

// ─── 5. Reset password (all'utente) ──────────────────────────────────────────

export async function sendPasswordResetEmail(params: {
  userEmail: string
  userName:  string
  password:  string
}) {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      Gentile <strong>${params.userName}</strong>,
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;">
      la tua password è stata reimpostata dall'amministratore. Usa le credenziali seguenti per accedere.
    </p>
    <div style="margin:0 0 24px;padding:20px 24px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      ${table(
        info('Email',    params.userEmail),
        info('Password', params.password),
      )}
    </div>
    <div style="margin:0 0 16px;padding:14px 16px;background:#fffbeb;border-radius:8px;border-left:4px solid #f59e0b;">
      <p style="margin:0;font-size:14px;color:#92400e;">
        Al prossimo accesso ti verrà chiesto di impostare una nuova password personale.
      </p>
    </div>
    ${btn('Accedi al portale', APP_URL)}
  `
  await getResend().emails.send({
    from:    FROM,
    to:      params.userEmail,
    subject: `[${APP_NAME}] Password reimpostata`,
    html:    layout('Password reimpostata', body),
  }).catch((err) => console.error('sendPasswordResetEmail error:', err))
}
