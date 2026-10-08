import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, KeyRound, Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
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
import kkjLogoUrl from '@/assets/logo-versao-escura-637a4.png'

export default function Login() {
  const [email, setEmail] = useState('kevinkjekabson@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login, isSupabaseConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setError(errObj.message || 'Falha ao autenticar. Verifique suas credenciais.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#070D18] flex flex-col lg:flex-row text-slate-100 overflow-x-hidden selection:bg-[#1D4ED8] selection:text-white">
      {/* PAINEL ESQUERDO (DESKTOP) / HEADER (MOBILE): IDENTIDADE VISUAL KKJ EXCLUSIVA */}
      <div className="relative w-full lg:w-1/2 min-h-[300px] sm:min-h-[360px] lg:min-h-screen flex flex-col items-center justify-between p-6 sm:p-10 lg:p-14 bg-gradient-to-b from-[#0B1528] via-[#070D18] to-[#040810] border-b lg:border-b-0 lg:border-r border-[#15233D] overflow-hidden">
        {/* Glows sutis e harmônicos com a tonalidade azul-marinho do logo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/15 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -right-24 w-96 h-96 rounded-full bg-sky-500/10 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 w-80 h-80 rounded-full bg-blue-900/20 blur-[90px]"
        />

        {/* Topo institucional discreto (visível no desktop) */}
        <div className="hidden lg:flex w-full items-center justify-between text-xs tracking-wider uppercase text-slate-400/80 z-10">
          <span className="font-semibold text-slate-300">CRM Corporativo</span>
          <span className="text-[11px] text-slate-400">Seguros &amp; Benefícios</span>
        </div>

        {/* Bloco central do Logo Oficial: preservação integral do escudo, tipografia metálica e proporções */}
        <div className="my-auto flex flex-col items-center justify-center text-center w-full max-w-md z-10 py-4 sm:py-6 lg:py-0">
          <div className="relative flex items-center justify-center p-2 rounded-2xl">
            <img
              src={kkjLogoUrl}
              alt="KK JEKABSON Corretora de Seguros"
              className="w-56 sm:w-72 md:w-80 lg:w-[380px] xl:w-[420px] max-w-full h-auto object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.65)] select-none pointer-events-none transition-transform duration-300 hover:scale-[1.01]"
              loading="eager"
            />
          </div>
        </div>

        {/* Rodapé institucional do painel esquerdo (desktop) */}
        <div className="hidden lg:flex w-full items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-6 z-10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sky-400" />
            <span className="text-[12px] text-slate-300 font-medium">Ambiente Seguro</span>
          </div>
          <span className="text-[11px] text-slate-400">KK Jekabson Corretora &bull; 2025</span>
        </div>
      </div>

      {/* PAINEL DIREITO (DESKTOP) / CORPO (MOBILE): FORMULÁRIO DE ACESSO */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-14 bg-[#070D18] lg:bg-gradient-to-br lg:from-[#080F1D] lg:to-[#050A14]">
        <div className="w-full max-w-md my-auto">
          <Card className="border-[#182846] bg-[#0C1527]/90 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-slate-100">
            <CardHeader className="space-y-1.5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Acessar Conta
                </CardTitle>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-950/70 border border-sky-800/50 text-[11px] text-sky-300 font-medium">
                  <Shield className="h-3 w-3 text-sky-400" />
                  <span>CRM KKJ</span>
                </div>
              </div>
              <CardDescription className="text-xs sm:text-sm text-slate-400">
                Insira suas credenciais corporativas para entrar na plataforma
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pt-2">
                {error && (
                  <Alert
                    variant="destructive"
                    className="bg-red-950/60 text-red-200 border-red-800/60"
                  >
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-xs leading-relaxed">{error}</AlertDescription>
                  </Alert>
                )}

                {!isSupabaseConfigured ? (
                  <div className="rounded-lg bg-amber-950/40 border border-amber-600/40 p-3 text-xs text-amber-200 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold text-amber-200">
                        Supabase não configurado
                      </strong>
                      <span className="text-[11px] leading-relaxed text-amber-300/90">
                        As variáveis <code className="text-amber-200">VITE_SUPABASE_URL</code> e{' '}
                        <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> ainda não
                        foram injetadas no ambiente. Configure-as para conectar ao banco de dados e
                        autenticar.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-emerald-950/40 border border-emerald-600/40 p-2.5 text-[11px] text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>
                      Autenticação conectada ao <strong>Supabase Auth</strong> da KKJ Corretora.
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-200">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-9 h-10 bg-[#070D18]/80 border-[#1C2C4C] text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-slate-200">
                      Senha
                    </Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline transition-colors"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-9 h-10 bg-[#070D18]/80 border-[#1C2C4C] text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                    />
                  </div>
                </div>

                <div className="rounded-md bg-blue-950/30 p-3 border border-blue-800/40 text-xs text-blue-200">
                  <span className="font-semibold text-blue-100">
                    Credenciais de teste pré-configuradas:
                  </span>
                  <div className="mt-1 text-slate-300">
                    E-mail: <code className="text-sky-300">kevinkjekabson@gmail.com</code>
                  </div>
                  <div className="text-slate-300">
                    Senha: <code className="text-sky-300">Skip@Pass</code>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-medium h-10 shadow-md shadow-blue-900/30 transition-all duration-150"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>

                <div className="text-center text-xs text-slate-400">
                  Não tem uma conta?{' '}
                  <Link
                    to="/signup"
                    className="font-semibold text-sky-400 hover:text-sky-300 hover:underline transition-colors"
                  >
                    Criar conta
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
