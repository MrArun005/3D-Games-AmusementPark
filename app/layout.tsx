import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fableland — 3D Amusement Park',
  description:
    'An explorable 3D amusement park: walk the plaza, buy tickets, and ride the Ferris wheel, roller coaster, carousel, teacups, drop tower and bumper cars.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
