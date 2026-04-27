'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { updateClient } from '@/app/(dashboard)/clients/actions'
import type { ClientDetail } from '@/app/(dashboard)/clients/actions'

type Props = { client: ClientDetail }

function Field({
  label, value, onChange, disabled, type = 'text', placeholder,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  disabled:     boolean
  type?:        string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                   disabled:opacity-50"
      />
    </div>
  )
}

export function ClientActions({ client }: Props) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [error,     setError]     = useState('')
  const [isPending, startTransition] = useTransition()

  // Fields
  const [name,               setName]               = useState(client.name)
  const [active,             setActive]             = useState(client.active)
  const [paese,              setPaese]              = useState(client.paese              ?? '')
  const [indirizzo,          setIndirizzo]          = useState(client.indirizzo          ?? '')
  const [localita,           setLocalita]           = useState(client.localita           ?? '')
  const [provincia,          setProvincia]          = useState(client.provincia          ?? '')
  const [cap,                setCap]                = useState(client.cap                ?? '')
  const [partitaIva,         setPartitaIva]         = useState(client.partitaIva         ?? '')
  const [codiceDestinatario, setCodiceDestinatario] = useState(client.codiceDestinatario ?? '')
  const [pec,                setPec]                = useState(client.pec                ?? '')
  const [telefono,           setTelefono]           = useState(client.telefono           ?? '')
  const [email,              setEmail]              = useState(client.email              ?? '')
  const [terminiPagamento,   setTerminiPagamento]   = useState(client.terminiPagamento   ?? '')

  function handleClose() {
    setOpen(false)
    setError('')
    setName(client.name)
    setActive(client.active)
    setPaese(client.paese              ?? '')
    setIndirizzo(client.indirizzo      ?? '')
    setLocalita(client.localita        ?? '')
    setProvincia(client.provincia      ?? '')
    setCap(client.cap                  ?? '')
    setPartitaIva(client.partitaIva    ?? '')
    setCodiceDestinatario(client.codiceDestinatario ?? '')
    setPec(client.pec                  ?? '')
    setTelefono(client.telefono        ?? '')
    setEmail(client.email              ?? '')
    setTerminiPagamento(client.terminiPagamento ?? '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Il nome è obbligatorio.'); return }
    setError('')
    startTransition(async () => {
      const res = await updateClient(client.id, {
        name,
        active,
        paese,
        indirizzo,
        localita,
        provincia,
        cap,
        partitaIva,
        codiceDestinatario,
        pec,
        telefono,
        email,
        terminiPagamento,
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm
                   font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Pencil className="h-4 w-4" />
        Modifica
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Modifica cliente</h2>
              <button type="button" onClick={handleClose}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Dati anagrafici */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dati principali</p>
                <Field label="Ragione sociale *" value={name} onChange={(v) => { setName(v); setError('') }} disabled={isPending} />
                <div className="flex items-center gap-2">
                  <input
                    id="client-active"
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="client-active" className="text-sm text-gray-700">Attivo</label>
                </div>
              </div>

              {/* Indirizzo */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sede</p>
                <Field label="Paese" value={paese} onChange={setPaese} disabled={isPending} placeholder="Italia" />
                <Field label="Indirizzo" value={indirizzo} onChange={setIndirizzo} disabled={isPending} placeholder="Via Roma 1" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Località" value={localita} onChange={setLocalita} disabled={isPending} placeholder="Milano" />
                  </div>
                  <Field label="Prov." value={provincia} onChange={setProvincia} disabled={isPending} placeholder="MI" />
                </div>
                <div className="w-32">
                  <Field label="CAP" value={cap} onChange={setCap} disabled={isPending} placeholder="20100" />
                </div>
              </div>

              {/* Dati fiscali */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dati fiscali</p>
                <Field label="Partita IVA" value={partitaIva} onChange={setPartitaIva} disabled={isPending} placeholder="IT12345678901" />
                <Field label="Codice Destinatario (SDI)" value={codiceDestinatario} onChange={setCodiceDestinatario} disabled={isPending} placeholder="AAABBB1" />
                <Field label="PEC" value={pec} onChange={setPec} disabled={isPending} type="email" placeholder="pec@esempio.it" />
              </div>

              {/* Contatti + pagamento */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contatti e pagamento</p>
                <Field label="Telefono" value={telefono} onChange={setTelefono} disabled={isPending} type="tel" placeholder="+39 02 1234567" />
                <Field label="Indirizzo email" value={email} onChange={setEmail} disabled={isPending} type="email" placeholder="info@cliente.it" />
                <Field label="Termini di pagamento" value={terminiPagamento} onChange={setTerminiPagamento} disabled={isPending} placeholder="30 gg d.f.f.m." />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium
                             text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                             hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio…' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
