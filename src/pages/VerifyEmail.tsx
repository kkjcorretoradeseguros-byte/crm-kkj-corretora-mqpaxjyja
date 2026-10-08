import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState('')
  const { confirmVerification, isSupabaseConfigured } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Token de verificação ausente ou link incompleto.')
      return
    }

    confirmVerification(token)
      .then(() => {
        setStatus('success')
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      })
      .catch((err: unknown) => {
        setStatus('error')
        const errObj = err as { message?: string }
        setErrorMessage(errObj.message || 'Token inválido ou expirado.')
      })
  }, [token, confirmVerification, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B2A4A] text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#101828]">KKJ Corretora</h1>
          <p className="text-sm text-[#667085]">Confirmação de Cadastro</p>
        </div>

        <Card className="border-[#E4E7EC] shadow-sm text-center">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-[#101828]">
              Verificação de E-mail
            </CardTitle>
            <CardDescription className="text-sm text-[#667085]">
              Validando seu e-mail de acesso
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 py-6">
            {!isSupabaseConfigured && (
              <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 flex items-start gap-2.5 text-left mb-3">
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Supabase não configurado</strong>
                  <span className="text-[11px] leading-relaxed text-amber-900">
                    Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> para
                    validar e-mails.
                  </span>
                </div>
              </div>
            )}

            {status === 'verifying' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-[#1B2A4A]" />
                <p className="text-sm text-[#667085]">Confirmando seu e-mail...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-[#12B76A]" />
                <h3 className="text-base font-semibold text-[#101828]">
                  E-mail Confirmado com Sucesso!
                </h3>
                <p className="text-xs text-[#667085] max-w-xs">
                  Sua conta está ativa e pronta para uso. Redirecionando para o login em
                  instantes...
                </p>
                <div className="pt-2 w-full">
                  <Link to="/login">
                    <Button className="w-full bg-[#1B2A4A] text-white">Ir para Login</Button>
                  </Link>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="h-12 w-12 text-[#D92D20]" />
                <h3 className="text-base font-semibold text-[#101828]">Falha na Verificação</h3>
                <p className="text-xs text-[#667085] max-w-xs">
                  {errorMessage ||
                    'Não foi possível validar este link. Solicite outro caso necessário.'}
                </p>
                <div className="pt-2 w-full">
                  <Link to="/login">
                    <Button variant="outline" className="w-full border-[#E4E7EC] text-[#1B2A4A]">
                      Voltar ao Login
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
