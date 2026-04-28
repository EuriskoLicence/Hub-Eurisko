import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasSection } from '@/lib/permissions/auth-helpers'
import { Sidebar } from '@/components/layout/Sidebar'
import { getPendingAmendmentCount } from './finance/actions'
import Image from 'next/image'

// Server component: legge la sessione e passa le sezioni alla Sidebar
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  // Il middleware gestisce già il redirect, ma questo è il guard lato server
  if (!session) redirect('/login')

  const { firstName, lastName, email, sections } = session.user
  const fullName = `${firstName} ${lastName}`

  // Badge rettifiche pending (solo per chi ha FINANCE_AMENDMENT)
  const pendingAmendments = hasSection(session, 'FINANCE_AMENDMENT')
    ? await getPendingAmendmentCount()
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        sections={sections}
        userName={fullName}
        userEmail={email}
        pendingAmendments={pendingAmendments}
      />

      {/* Contenuto principale — offset per la sidebar desktop */}
      <div className="lg:pl-64">
        {/* Spacer per mobile (compensate l'header fisso) */}
        <div className="lg:hidden h-14" />

        {/* Top bar con logo Eurisko */}
        <div className="flex justify-end px-4 pt-4 sm:px-6 lg:px-8">
          <Image
            src="/eurisko.png"
            alt="Eurisko"
            width={100}
            height={30}
            className="object-contain"
            priority
          />
        </div>

        <main className="px-4 py-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
