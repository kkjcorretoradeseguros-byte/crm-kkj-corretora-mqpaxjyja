/* 404 Page - Displays when a user attempts to access a non-existent route - translate to the language of the user */
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-background px-4">
      <div className="text-center max-w-md p-8 rounded-xl bg-white dark:bg-card border border-[#E4E7EC] dark:border-border shadow-sm">
        <h1 className="text-5xl font-black text-[#1B2A4A] dark:text-primary mb-3">404</h1>
        <h2 className="text-lg font-bold text-[#101828] dark:text-foreground mb-2">
          Página não encontrada
        </h2>
        <p className="text-xs text-[#667085] dark:text-muted-foreground mb-6">
          O endereço acessado não existe ou foi movido dentro do CRM KKJ.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1B2A4A] dark:bg-primary text-white text-xs font-semibold hover:bg-[#2A3D6B] transition shadow-sm"
        >
          Voltar ao Início
        </a>
      </div>
    </div>
  )
}

export default NotFound
