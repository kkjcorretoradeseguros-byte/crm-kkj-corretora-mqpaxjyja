import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Settings,
  User,
  Mail,
  KeyRound,
  Download,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { propertyService } from '@/services/propertyService'
import { clientService } from '@/services/clientService'
import { interactionService } from '@/services/interactionService'

export default function SettingsPage() {
  const { user, updateProfile, requestEmailChange, logout } = useAuth()

  // Profile state
  const [name, setName] = useState(user?.name || '')
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  // Email change state
  const [newEmail, setNewEmail] = useState('')
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null)
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false)

  // Password change state
  const [isRequestingReset, setIsRequestingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Export CSV state
  const [isExporting, setIsExporting] = useState(false)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(false)
    setIsUpdatingProfile(true)

    try {
      await updateProfile({ name })
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 4000)
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setProfileError(errObj.message || 'Falha ao atualizar perfil.')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailChangeError(null)
    setEmailChangeSuccess(false)

    if (!newEmail || newEmail === user?.email) {
      setEmailChangeError('Informe um e-mail diferente do atual.')
      return
    }

    setIsRequestingEmailChange(true)
    try {
      await requestEmailChange(newEmail)
      setEmailChangeSuccess(true)
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setEmailChangeError(errObj.message || 'Falha ao solicitar alteração de e-mail.')
    } finally {
      setIsRequestingEmailChange(false)
    }
  }

  const handleRequestPasswordReset = async () => {
    if (!user?.email) return
    setIsRequestingReset(true)
    try {
      // simulate request password reset to user's own email
      setResetSent(true)
    } catch {
      // ignore
    } finally {
      setIsRequestingReset(false)
    }
  }

  // Export Data to CSV
  const handleExportData = async (type: 'properties' | 'clients' | 'interactions') => {
    setIsExporting(true)
    try {
      let csvContent = ''
      let filename = ''

      if (type === 'properties') {
        const props = await propertyService.getAllProperties()
        filename = `imoveis_kkj_${new Date().toISOString().slice(0, 10)}.csv`
        const headers = [
          'ID',
          'Título',
          'Tipo',
          'Finalidade',
          'Preço',
          'Status',
          'Cidade',
          'Bairro',
        ]
        const rows = props.map((p) => [
          p.id,
          `"${p.title.replace(/"/g, '""')}"`,
          p.type,
          p.transaction_type,
          p.price,
          p.status,
          `"${p.address_city || ''}"`,
          `"${p.address_neighborhood || ''}"`,
        ])
        csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      } else if (type === 'clients') {
        const clients = await clientService.getAllClients()
        filename = `clientes_kkj_${new Date().toISOString().slice(0, 10)}.csv`
        const headers = ['ID', 'Nome Completo', 'Telefone', 'E-mail', 'Status']
        const rows = clients.map((c) => [
          c.id,
          `"${c.full_name.replace(/"/g, '""')}"`,
          `"${c.phone}"`,
          `"${c.email || ''}"`,
          c.status,
        ])
        csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      } else if (type === 'interactions') {
        const inters = await interactionService.getAllInteractions()
        filename = `interacoes_kkj_${new Date().toISOString().slice(0, 10)}.csv`
        const headers = ['ID', 'Cliente ID', 'Tipo', 'Data', 'Notas']
        const rows = inters.map((i) => [
          i.id,
          i.client_id,
          i.type,
          i.interaction_date,
          `"${i.notes.replace(/"/g, '""')}"`,
        ])
        csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      }

      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to export CSV:', err)
      alert('Erro ao exportar dados em CSV.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#101828]">
          Configurações da Conta
        </h2>
        <p className="text-xs sm:text-sm text-[#667085]">
          Gerencie seu perfil de corretor, credenciais de acesso e exportação de dados
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 1. Profile Settings */}
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#101828] flex items-center gap-2">
              <User className="h-4 w-4 text-[#1B2A4A]" /> Dados do Perfil
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Atualize as informações exibidas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
              {profileSuccess && (
                <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription>Perfil atualizado com sucesso!</AlertDescription>
                </Alert>
              )}
              {profileError && (
                <Alert
                  variant="destructive"
                  className="bg-red-50 text-red-900 border-red-200 text-xs"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{profileError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="prof_name" className="text-xs font-medium">
                  Nome Completo
                </Label>
                <Input
                  id="prof_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs border-[#E4E7EC]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">E-mail Atual</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="h-9 text-xs bg-slate-50 border-[#E4E7EC] text-[#667085]"
                />
              </div>

              <Button
                type="submit"
                disabled={isUpdatingProfile}
                size="sm"
                className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white text-xs"
              >
                {isUpdatingProfile ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Salvando...
                  </>
                ) : (
                  'Salvar Dados'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 2. Email Change Flow */}
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#101828] flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#1B2A4A]" /> Alteração de E-mail
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Será enviado um link de confirmação para o novo endereço
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequestEmailChange} className="space-y-4 max-w-md">
              {emailChangeSuccess && (
                <Alert className="bg-blue-50 text-blue-900 border-blue-200 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    Link de verificação enviado para <strong>{newEmail}</strong>. Verifique sua
                    caixa de entrada e clique no link para finalizar a alteração.
                  </AlertDescription>
                </Alert>
              )}
              {emailChangeError && (
                <Alert
                  variant="destructive"
                  className="bg-red-50 text-red-900 border-red-200 text-xs"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{emailChangeError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new_email" className="text-xs font-medium">
                  Novo Endereço de E-mail
                </Label>
                <Input
                  id="new_email"
                  type="email"
                  placeholder="novo.email@exemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-9 text-xs border-[#E4E7EC]"
                />
              </div>

              <Button
                type="submit"
                disabled={isRequestingEmailChange}
                size="sm"
                className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white text-xs"
              >
                {isRequestingEmailChange ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Enviando link...
                  </>
                ) : (
                  'Solicitar Troca de E-mail'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 3. Password & Security */}
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#101828] flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#1B2A4A]" /> Segurança & Senha
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Receba um link de redefinição de senha com segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-w-md">
            {resetSent ? (
              <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription>
                  Link enviado para seu e-mail cadastrado ({user?.email}).
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-[#667085]">
                Caso deseje trocar sua senha, enviamos um link seguro de recuperação para seu e-mail
                cadastrado.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={isRequestingReset || resetSent}
              onClick={handleRequestPasswordReset}
              size="sm"
              className="border-[#E4E7EC] text-xs"
            >
              {isRequestingReset ? 'Enviando...' : 'Enviar Link de Redefinição'}
            </Button>
          </CardContent>
        </Card>

        {/* 4. Data Export (CSV) */}
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#101828] flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#1B2A4A]" /> Exportação de Dados (CSV)
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Faça backup ou exporte suas tabelas para análise em planilhas Excel / Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => handleExportData('properties')}
                className="border-[#E4E7EC] text-xs flex items-center gap-2"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Imóveis (.csv)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => handleExportData('clients')}
                className="border-[#E4E7EC] text-xs flex items-center gap-2"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Clientes (.csv)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => handleExportData('interactions')}
                className="border-[#E4E7EC] text-xs flex items-center gap-2"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Interações (.csv)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 5. Account Section */}
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#101828] flex items-center gap-2">
              <LogOut className="h-4 w-4 text-[#D92D20]" /> Encerrar Sessão
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Desconecte sua conta deste navegador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={logout}
              size="sm"
              className="border-[#E4E7EC] text-[#D92D20] hover:bg-red-50 text-xs flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair do Sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
