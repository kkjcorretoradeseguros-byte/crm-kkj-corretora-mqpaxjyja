import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, KeyRound, Mail, AlertCircle, Loader2 } from 'lucide-react'
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

export default function Login() {
  const [email, setEmail] = useState('kevinkjekabson@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
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
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B2A4A] text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#101828]">KKJ Corretora</h1>
          <p className="text-sm text-[#667085]">CRM Imobiliário & Gestão de Clientes</p>
        </div>

        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-[#101828]">Acessar Conta</CardTitle>
            <CardDescription className="text-sm text-[#667085]">
              Insira seus dados para acessar o painel
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-[#101828]">
                    Senha
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-[#1B2A4A] hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
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

              <div className="rounded-md bg-blue-50/70 p-3 border border-blue-100 text-xs text-blue-800">
                <span className="font-semibold">Credenciais de teste pré-configuradas:</span>
                <div className="mt-1">
                  E-mail: <code>kevinkjekabson@gmail.com</code>
                </div>
                <div>
                  Senha: <code>Skip@Pass</code>
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
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>

              <div className="text-center text-xs text-[#667085]">
                Não tem uma conta?{' '}
                <Link to="/signup" className="font-semibold text-[#1B2A4A] hover:underline">
                  Criar conta
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
