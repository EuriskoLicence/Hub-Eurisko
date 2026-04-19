import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  // Prima rimuove i vecchi vincoli UNIQUE semplici su projects e engagements
  // (bloccano il backfill perché più progetti/commesse avranno lo stesso codice per clienti/progetti diversi)
  console.log('Dropping old simple unique constraints...')
  await sql`ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_code_unique`
  await sql`ALTER TABLE engagements DROP CONSTRAINT IF EXISTS engagements_code_unique`

  // Clienti: codice globalmente sequenziale
  console.log('Backfilling client codes...')
  await sql`
    UPDATE clients SET code = sub.new_code
    FROM (
      SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 4, '0') AS new_code
      FROM clients
    ) sub
    WHERE clients.id = sub.id
  `

  // Progetti: codice sequenziale PER CLIENTE (PARTITION BY client_id)
  console.log('Backfilling project codes...')
  await sql`
    UPDATE projects SET code = sub.new_code
    FROM (
      SELECT id, LPAD(ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at)::text, 4, '0') AS new_code
      FROM projects
    ) sub
    WHERE projects.id = sub.id
  `

  // Commesse: codice sequenziale PER PROGETTO (PARTITION BY project_id)
  console.log('Backfilling engagement codes...')
  await sql`
    UPDATE engagements SET code = sub.new_code
    FROM (
      SELECT id, LPAD(ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at)::text, 4, '0') AS new_code
      FROM engagements
    ) sub
    WHERE engagements.id = sub.id
  `

  // Aggiunge i nuovi vincoli compositi
  console.log('Adding composite unique constraints...')
  await sql`ALTER TABLE projects ADD CONSTRAINT projects_client_code_unique UNIQUE (client_id, code)`
  await sql`ALTER TABLE engagements ADD CONSTRAINT engagements_project_code_unique UNIQUE (project_id, code)`

  // Rende NOT NULL (se non già fatto)
  console.log('Setting NOT NULL constraints...')
  await sql`ALTER TABLE clients ALTER COLUMN code SET NOT NULL`
  await sql`ALTER TABLE projects ALTER COLUMN code SET NOT NULL`
  await sql`ALTER TABLE engagements ALTER COLUMN code SET NOT NULL`

  console.log('Migration completed successfully!')
}
main().catch(console.error)
