import { redirect } from 'next/navigation'

// I tipi veicolo sono gestiti nella pagina Categorie spese
export default function VehicleTypesRedirect() {
  redirect('/admin/expense-categories')
}
