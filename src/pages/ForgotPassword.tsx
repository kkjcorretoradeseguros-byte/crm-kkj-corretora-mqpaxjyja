import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { requestPasswordReset, isSupabaseConfigured } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await requestPasswordReset(email)
      setIsSubmitted(true)
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setError(errObj.message || 'Ocorreu um erro ao solicitar redefinição. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B2A4A] text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#101828]">KKJ Corretora</h1>
          <p className="text-sm text-[#667085]">Recuperação de Acesso</p>
        </div>

        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-[#101828]">Esqueci Minha Senha</CardTitle>
            <CardDescription className="text-sm text-[#667085]">
              Informe o e-mail cadastrado para receber o link de redefinição
            </CardDescription>
          </CardHeader>

          {isSubmitted ? (
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center text-center py-4">
                <CheckCircle2 className="h-12 w-12 text-[#12B76A] mb-3" />
                <h3 className="text-base font-semibold text-[#101828]">E-mail Enviado!</h3>
                <p className="text-xs text-[#667085] mt-1 max-w-xs">
                  Se o endereço <strong className="text-[#101828]">{email}</strong> estiver
                  cadastrado em nossa base, você receberá um link com instruções para criar uma nova
                  senha.
                </p>
              </div>
              <div className="pt-2">
                <Link to="/login" className="w-full">
                  <Button variant="outline" className="w-full border-[#E4E7EC] text-[#1B2A4A]">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {!isSupabaseConfigured && (
                  <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Supabase não configurado</strong>
                      <span className="text-[11px] leading-relaxed text-amber-900">
                        Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>{' '}
                        para enviar o e-mail de recuperação.
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-[#101828]">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-9 h-10 border-[#E4E7EC] focus-visible:ring-[#1B2A4A]"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white font-medium h-10"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando instruções...
                    </>
                  ) : (
                    'Enviar Link de Recuperação'
                  )}
                </Button>

                <div className="text-center text-xs text-[#667085]">
                  Lembrou a senha?{' '}
                  <Link to="/login" className="font-semibold text-[#1B2A4A] hover:underline">
                    Fazer login
                  </Link>
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
