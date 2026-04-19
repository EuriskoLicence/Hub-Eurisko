import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina classi Tailwind risolvendo i conflitti (shadcn/ui pattern). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
