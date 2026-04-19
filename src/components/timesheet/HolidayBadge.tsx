/** Micro-badge mostrato nell'intestazione colonna dei giorni festivi. */
export function HolidayBadge({ name }: { name: string }) {
  // Tronca nomi molto lunghi per non spezzare il layout della griglia
  const short = name.length > 12 ? name.slice(0, 11) + '…' : name
  return (
    <span
      title={name}
      className="block mt-0.5 rounded bg-orange-100 px-1 py-0.5 text-[9px] font-medium
                 leading-none text-orange-700 text-center truncate"
    >
      {short}
    </span>
  )
}
