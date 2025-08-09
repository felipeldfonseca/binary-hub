import type { Metadata, Viewport } from 'next'
import { Comfortaa } from 'next/font/google'
import '../styles/globals.css'
import { AuthProvider } from '../lib/contexts/AuthContext'
import { LanguageProvider } from '../lib/contexts/LanguageContext'

const comfortaa = Comfortaa({ 
  subsets: ['latin'], 
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-comfortaa'
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#E1FFD9',
}

export const metadata: Metadata = {
  title: 'Binary Hub - Discipline. Data. Domination.',
  description: 'Journaling & performance insights for binary options traders',
  keywords: ['binary options', 'trading', 'journaling', 'performance', 'insights', 'KPIs'],
  authors: [{ name: 'Binary Hub Team' }],
  creator: 'Binary Hub',
  publisher: 'Binary Hub',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://binaryhub.app'),
  alternates: {
    canonical: '/',
    languages: {
      'pt-BR': '/',
      'en-US': '/en',
    },
  },
  openGraph: {
    title: 'Binary Hub - Discipline. Data. Domination.',
    description: 'Journaling & performance insights for binary options traders',
    url: 'https://binaryhub.app',
    siteName: 'Binary Hub',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Binary Hub - Trading Performance Analytics',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Binary Hub - Discipline. Data. Domination.',
    description: 'Journaling & performance insights for binary options traders',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#00E28A' },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`scroll-smooth ${comfortaa.variable}`}>
      <head>
        <meta name="theme-color" content="#E1FFD9" />
        <meta name="msapplication-TileColor" content="#E1FFD9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Binary Hub" />
        <meta name="application-name" content="Binary Hub" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-starturl" content="/" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preload" href="/fonts/etna-free-font.otf" as="font" type="font/otf" crossOrigin="" />
      </head>
      <body 
        className={`${comfortaa.className} antialiased`}
        suppressHydrationWarning={true}
      >
                <div id="root" className="min-h-screen bg-background text-text">

          <AuthProvider>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </AuthProvider>
        </div>
        <div id="modal-root" />
        <div id="toast-root" />
      </body>
    </html>
  )
} 