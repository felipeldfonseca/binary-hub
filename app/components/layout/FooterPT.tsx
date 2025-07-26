import Link from 'next/link'

export default function FooterPT() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="flex items-center space-x-1">
              <div className="logo-poly font-normal text-primary">
                binary
              </div>
              <div className="bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal" style={{fontSize: '23px'}}>
                hub
              </div>
            </div>
          </div>
          <div className="flex space-x-6 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacidade
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Termos
            </Link>
            <Link href="/support" className="hover:text-primary transition-colors">
              Suporte
            </Link>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-gray-600">
          <p>&copy; 2025 Binary Hub. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
} 