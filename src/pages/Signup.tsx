import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, User, KeyRound, Mail, AlertCircle, Loader2 } from 'lucide-react'
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

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { signup, isSupabaseConfigured } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    setIsLoading(true)

    try {
      await signup(email, password, name)
      navigate('/')
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setError(errObj.message || 'Falha ao criar conta. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B2A4A] text-white shadow-md">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#101828]">
            KK JEKABSON Corretora
          </h1>
          <p className="text-sm text-[#667085]">
            Crie sua conta para gerenciar seguros, benefícios e clientes
          </p>
        </div>

        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-[#101828]">Criar Conta</CardTitle>
            <CardDescription className="text-sm text-[#667085]">
              Preencha os campos abaixo para começar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {!isSupabaseConfigured && (
                <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Supabase não configurado</strong>
                    <span className="text-[11px] leading-relaxed text-amber-900">
                      As credenciais Supabase ainda não foram injetadas. Defina{' '}
                      <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> para
                      cadastrar usuários.
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
                <Label htmlFor="name" className="text-xs font-medium text-[#101828]">
                  Nome Completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-9 h-10 border-[#E4E7EC] focus-visible:ring-[#1B2A4A]"
                  />
                </div>
              </div>

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
                <Label htmlFor="password" className="text-xs font-medium text-[#101828]">
                  Senha (mínimo 8 dígitos)
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
                    minLength={8}
                    className="pl-9 h-10 border-[#E4E7EC] focus-visible:ring-[#1B2A4A]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-[#101828]">
                  Confirmar Senha
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    Criando conta...
                  </>
                ) : (
                  'Cadastrar'
                )}
              </Button>

              <div className="text-center text-xs text-[#667085]">
                Já tem uma conta?{' '}
                <Link to="/login" className="font-semibold text-[#1B2A4A] hover:underline">
                  Fazer login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
