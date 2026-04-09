import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Consejo de Barrio',
  description: 'Sistema de reportes para el Consejo de Barrio — La Iglesia de Jesucristo de los Santos de los Últimos Días',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
