import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YouTube Transcriber',
  description: 'Transcribe YouTube videos using AssemblyAI'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <body className='font-sans antialiased flex justify-center'>
        <div className='max-w-[600px]'>{children}</div>
      </body>
    </html>
  )
}
