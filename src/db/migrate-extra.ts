import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  console.log('Creating timesheet_extra_entries...')
  await sql`
    CREATE TABLE IF NOT EXISTS timesheet_extra_entries (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id),
      year          INTEGER NOT NULL,
      month         INTEGER NOT NULL,
      day           INTEGER NOT NULL,
      engagement_id UUID REFERENCES engagements(id),
      hours         INTEGER NOT NULL,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  console.log('Creating timesheet_extra_months...')
  await sql`
    CREATE TABLE IF NOT EXISTS timesheet_extra_months (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                   UUID NOT NULL REFERENCES users(id),
      year                      INTEGER NOT NULL,
      month                     INTEGER NOT NULL,
      status                    timesheet_status NOT NULL DEFAULT 'draft',
      approved_at               TIMESTAMPTZ,
      amendment_requested_at    TIMESTAMPTZ,
      amendment_reason          TEXT,
      amendment_reviewed_by     UUID REFERENCES users(id),
      amendment_reviewed_at     TIMESTAMPTZ,
      amendment_rejection_reason TEXT,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, year, month)
    )
  `

  console.log('Adding TIMESHEET_EXTRA section...')
  await sql`
    INSERT INTO sections (code, label, description, sort_order)
    VALUES ('TIMESHEET_EXTRA', 'Consuntivazione extra', 'Accesso alla consuntivazione ore extra', 25)
    ON CONFLICT (code) DO NOTHING
  `

  console.log('Adding Dipendente Plus profile...')
  await sql`
    INSERT INTO profiles (name, description, active)
    VALUES ('Dipendente Plus', 'Dipendente con accesso alla consuntivazione extra', true)
    ON CONFLICT (name) DO NOTHING
  `

  // Aggiunge le sezioni al profilo Dipendente Plus
  const profile = await sql`SELECT id FROM profiles WHERE name = 'Dipendente Plus' LIMIT 1`
  if (profile.length > 0) {
    const profileId = profile[0].id
    for (const code of ['TIMESHEET', 'EXPENSES', 'TIMESHEET_EXTRA']) {
      await sql`
        INSERT INTO profile_sections (profile_id, section_code)
        VALUES (${profileId}, ${code})
        ON CONFLICT DO NOTHING
      `
    }
    console.log(`Profile sections assigned to Dipendente Plus`)
  }

  console.log('Migration completed successfully!')
}

main().catch(console.error)
