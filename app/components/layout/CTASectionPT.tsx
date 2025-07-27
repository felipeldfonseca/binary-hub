import Link from 'next/link'

export default function CTASectionPT() {
  return (
    <section className="py-20 bg-primary">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-poly text-3xl font-bold text-gray-600 mb-2">
          Pare de tentar adivinhar.
        </h2>
        <h2 className="font-poly text-3xl font-bold text-gray-600 mb-8">
          Comece a operar com dados.
        </h2>
        <Link 
          href="/auth/register" 
          className="bg-gray-800 text-primary px-8 py-3 text-lg font-comfortaa font-bold rounded-full hover:bg-gray-700 transition-colors"
        >
          Cadastre-se grátis hoje
        </Link>
      </div>
    </section>
  )
} 