import React, { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
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

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { confirmEmailChange, isSupabaseConfigured } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Token de alteração de e-mail ausente na URL.')
      return
    }

    setIsLoading(true)

    try {
      await confirmEmailChange(token, password)
      setIsSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setError(errObj.message || 'Senha incorreta ou token expirado.')
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
          <p className="text-sm text-[#667085]">Confirmação de Troca de E-mail</p>
        </div>

        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-[#101828]">
              Confirmar Novo E-mail
            </CardTitle>
            <CardDescription className="text-sm text-[#667085]">
              Digite sua senha atual para confirmar a troca de e-mail
            </CardDescription>
          </CardHeader>

          {isSuccess ? (
            <CardContent className="space-y-4 py-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#12B76A]" />
              <h3 className="text-base font-semibold text-[#101828]">E-mail Atualizado!</h3>
              <p className="text-xs text-[#667085]">
                Seu endereço de e-mail foi atualizado. Você foi desconectado e redirecionado para o
                login.
              </p>
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
                        para confirmar novo e-mail.
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

                {!token && (
                  <Alert className="bg-amber-50 text-amber-900 border-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Atenção: O link deve conter o parâmetro <code>?token=...</code> enviado ao seu
                      novo e-mail.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-[#101828]">
                    Senha Atual
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                      Validando confirmação...
                    </>
                  ) : (
                    'Confirmar Troca de E-mail'
                  )}
                </Button>

                <div className="text-center text-xs text-[#667085]">
                  <Link to="/login" className="font-semibold text-[#1B2A4A] hover:underline">
                    Cancelar e voltar ao login
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
