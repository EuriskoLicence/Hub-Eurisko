import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  console.log('Adding must_change_password column to users...')
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false
  `
  console.log('Adding temp_password column to users...')
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password text
  `
  console.log('Migration completed successfully!')
}
main().catch(console.error)
