import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Layout from '@/components/Layout'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['vietnamese', 'latin'],
})

export const metadata: Metadata = {
  title: 'Test Center',
  description: 'Test Center App',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}
