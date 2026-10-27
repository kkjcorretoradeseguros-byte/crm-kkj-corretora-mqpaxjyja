import React, { useEffect, useState, useMemo } from 'react'
import {
  MessageSquare,
  Smartphone,
  Shield,
  Bot,
  Info,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  PhoneCall,
  Search,
  Filter,
  UserCheck,
  User,
  Users,
  Building,
  Target,
  RefreshCw,
  Send,
  Check,
  CheckCheck,
  AlertCircle,
  PhoneForwarded,
  Layers,
  Inbox,
  Radio,
  ExternalLink,
  ChevronRight,
  UserX,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { whatsappService } from '@/services/whatsappService'
import { userService } from '@/services/userService'
import { teamService } from '@/services/teamService'
import {
  metaWhatsAppService,
  META_WHATSAPP_CONFIG,
  type MetaBackendStatus,
} from '@/services/metaWhatsAppService'
import type { Conversation, Message, WhatsappChannel, User as CRMUser } from '@/types/crm'
import { useToast } from '@/hooks/use-toast'

export default function Conversations() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Normalização de papel (role) conforme padrão do CRM KKJ
  const normalizedRole = (user?.role || '').toString().toLowerCase().trim()
  const isAdmin =
    normalizedRole === 'administrador' ||
    normalizedRole === 'admin' ||
    user?.role?.toUpperCase() === 'ADMINISTRADOR'
  const isGestor =
    normalizedRole === 'gestor' ||
    normalizedRole === 'gestora' ||
    user?.role?.toUpperCase() === 'GESTOR'
  const canTransfer = isAdmin || isGestor

  // Estados principais
  const [activeTab, setActiveTab] = useState<'inbox' | 'channels'>('inbox')
  const [channels, setChannels] = useState<WhatsappChannel[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [usersList, setUsersList] = useState<CRMUser[]>([])
  const [subordinateIds, setSubordinateIds] = useState<string[]>([])

  // Filtros de busca na Caixa de Entrada
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [responsibleFilter, setResponsibleFilter] = useState<string>('todos')

  // Estado do Modal de Transferência
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [targetUserId, setTargetUserId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)

  // Estado da Conexão Meta WhatsApp Business (Embedded Signup com Coexistência)
  // Estados: 'idle' (Não conectado), 'connecting' (Conectando), 'connected' (Conectado), 'error' (Erro)
  const [metaConnectStatus, setMetaConnectStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle')
  const [metaConnectMessage, setMetaConnectMessage] = useState<string>('')
  const [metaErrorMessage, setMetaErrorMessage] = useState<string | null>(null)
  const [metaBackendStatus, setMetaBackendStatus] = useState<MetaBackendStatus | null>(null)
  const [metaConnectModalOpen, setMetaConnectModalOpen] = useState(false)
  const [channelDisplayName, setChannelDisplayName] = useState('')

  // Carregar dados de equipes / hierarquia para gestores
  useEffect(() => {
    async function loadHierarchy() {
      if (!isGestor || !user?.id) return
      try {
        const teams = await teamService.getTeams()
        const myTeam = teams.find((t) => t.gestor_id === user.id)
        if (myTeam) {
          const members = await teamService.getTeamMembers(myTeam.id)
          const ids = members.map((m) => m.vendedor_id)
          setSubordinateIds([user.id, ...ids])
        } else {
          setSubordinateIds([user.id])
        }
      } catch (err) {
        console.warn('Erro ao carregar hierarquia de equipes:', err)
        setSubordinateIds([user?.id || ''])
      }
    }
    loadHierarchy()
  }, [isGestor, user?.id])

  // Carregar lista de usuários para seleção de responsáveis e transferência
  useEffect(() => {
    async function loadUsers() {
      try {
        const list = await userService.getAllUsers()
        setUsersList(list.filter((u) => u.active !== false))
      } catch (err) {
        console.warn('Erro ao carregar lista de usuários:', err)
      }
    }
    loadUsers()
  }, [])

  // Carregar canais e conversas
  const loadData = async () => {
    setLoading(true)
    try {
      const [channelsData, conversationsData] = await Promise.all([
        whatsappService.getChannels(),
        whatsappService.getConversations(),
      ])
      setChannels(channelsData)
      setConversations(conversationsData)

      // Atualizar conversa selecionada se ainda existir
      if (selectedConversation) {
        const updated = conversationsData.find((c) => c.id === selectedConversation.id)
        if (updated) {
          setSelectedConversation(updated)
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do WhatsApp:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Carregar status do backend Meta WhatsApp ao abrir
  useEffect(() => {
    metaWhatsAppService
      .getBackendStatus()
      .then((status) => {
        setMetaBackendStatus(status)
      })
      .catch(() => {
        /* silencioso */
      })
  }, [])

  // Handler de conexão oficial com a Meta via Embedded Signup (Fluxo de Coexistência)
  const handleConnectWhatsAppBusiness = async () => {
    setMetaConnectStatus('connecting')
    setMetaErrorMessage(null)
    setMetaConnectMessage('Inicializando SDK oficial da Meta...')

    try {
      const res = await metaWhatsAppService.launchEmbeddedSignup({
        channelName: channelDisplayName.trim() || undefined,
        onProgress: (step) => {
          setMetaConnectMessage(step)
        },
      })

      setMetaConnectStatus('connected')
      setMetaConnectMessage(res.message || 'WhatsApp conectado com coexistência com sucesso!')
      toast({
        title: 'WhatsApp Business Conectado!',
        description:
          'Seu número foi registrado com sucesso em modo de coexistência. O app do celular continua ativo.',
      })

      // Recarregar canais no CRM
      await loadData()
      setMetaConnectModalOpen(false)
      setChannelDisplayName('')
    } catch (err: any) {
      setMetaConnectStatus('error')
      const msg =
        err?.message ||
        'Não foi possível concluir a conexão com a Meta. O número do celular não foi afetado.'
      setMetaErrorMessage(msg)
      toast({
        title: 'Falha na conexão do WhatsApp',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  // Carregar mensagens quando uma conversa é selecionada
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([])
      return
    }

    async function loadChatMessages() {
      if (!selectedConversation) return
      setLoadingMessages(true)
      try {
        const msgs = await whatsappService.getMessages(selectedConversation.id)
        setMessages(msgs)
        // Se tinha mensagens não lidas, zerar contador no frontend e banco
        if (selectedConversation.nao_lidas > 0) {
          await whatsappService.markAsRead(selectedConversation.id)
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedConversation.id ? { ...c, nao_lidas: 0 } : c)),
          )
        }
      } catch (err) {
        console.warn('Erro ao carregar mensagens:', err)
      } finally {
        setLoadingMessages(false)
      }
    }

    loadChatMessages()
  }, [selectedConversation?.id])

  // Filtragem de conversas por permissão de perfil (Frontend Guard sincronizado com RLS)
  // Administrador: visualiza todas as conversas
  // Gestor: visualiza próprias e de sua equipe (subordinateIds)
  // Vendedor: visualiza estritamente as suas
  const roleFilteredConversations = useMemo(() => {
    if (!user) return []

    return conversations.filter((conv) => {
      if (isAdmin) return true
      if (isGestor) {
        // Se a conversa tem responsável, verificar se é o gestor ou membro da equipe
        if (conv.responsible_user_id) {
          return subordinateIds.length > 0
            ? subordinateIds.includes(conv.responsible_user_id)
            : conv.responsible_user_id === user.id
        }
        // Conversas sem responsável prévio são visíveis para gestores triarem
        return true
      }
      // Vendedor: apenas as que ele é o responsável
      return conv.responsible_user_id === user.id
    })
  }, [conversations, isAdmin, isGestor, subordinateIds, user])

  // Filtros aplicados na Caixa de Entrada (busca textual, status e responsável)
  const displayConversations = useMemo(() => {
    return roleFilteredConversations.filter((conv) => {
      // Filtro de busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesJid = conv.remote_jid?.toLowerCase().includes(q)
        const matchesContact = conv.contact?.nome?.toLowerCase().includes(q)
        const matchesPhone = conv.contact?.celular?.toLowerCase().includes(q)
        const matchesOpp = conv.opportunity?.title?.toLowerCase().includes(q)
        const matchesMsg = conv.last_message?.conteudo?.toLowerCase().includes(q)
        if (!matchesJid && !matchesContact && !matchesPhone && !matchesOpp && !matchesMsg) {
          return false
        }
      }

      // Filtro de status
      if (statusFilter !== 'todos' && conv.status !== statusFilter) {
        return false
      }

      // Filtro de responsável
      if (responsibleFilter !== 'todos') {
        if (responsibleFilter === 'sem_responsavel') {
          if (conv.responsible_user_id) return false
        } else if (conv.responsible_user_id !== responsibleFilter) {
          return false
        }
      }

      return true
    })
  }, [roleFilteredConversations, searchQuery, statusFilter, responsibleFilter])

  // Lista de usuários elegíveis para transferência (Gestor restrito à equipe; Admin vê todos)
  const eligibleTransferUsers = useMemo(() => {
    if (isAdmin) return usersList
    if (isGestor) {
      return usersList.filter((u) => subordinateIds.includes(u.id))
    }
    return []
  }, [isAdmin, isGestor, usersList, subordinateIds])

  // Ação de Transferir Conversa
  const handleTransfer = async () => {
    if (!selectedConversation || !targetUserId) return

    setTransferring(true)
    try {
      await whatsappService.transferConversation(selectedConversation.id, targetUserId)
      const targetUser = usersList.find((u) => u.id === targetUserId)
      toast({
        title: 'Atendimento transferido',
        description: `Conversa transferida com sucesso para ${targetUser?.name || 'novo responsável'}.`,
      })

      // Atualizar localmente
      const updatedConv: Conversation = {
        ...selectedConversation,
        responsible_user_id: targetUserId,
        responsible_user: targetUser
          ? {
              id: targetUser.id,
              nome: targetUser.name,
              email: targetUser.email,
              role: targetUser.role,
            }
          : undefined,
      }
      setSelectedConversation(updatedConv)
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConversation.id ? updatedConv : c)),
      )
      setTransferModalOpen(false)
      setTargetUserId('')
    } catch (err: any) {
      toast({
        title: 'Erro ao transferir',
        description: err?.message || 'Não foi possível transferir a conversa.',
        variant: 'destructive',
      })
    } finally {
      setTransferring(false)
    }
  }

  // Formatador de data/hora amigável
  const formatTimeOrDate = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const now = new Date()
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()

      if (isToday) {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-xl bg-card text-card-foreground border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">WhatsApp & Mensageria</h2>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]"
                >
                  Meta Cloud API Oficial
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Central de atendimento integrada aos Contatos e Oportunidades do CRM KKJ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Navegação por Abas: Caixa de Entrada vs Meus Números */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full sm:w-[380px] grid-cols-2 mb-4 bg-muted/60 p-1">
          <TabsTrigger value="inbox" className="text-xs flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span>Caixa de Entrada</span>
            {roleFilteredConversations.reduce((acc, c) => acc + (c.nao_lidas || 0), 0) > 0 && (
              <Badge className="h-5 px-1.5 text-[10px] bg-emerald-600 text-white rounded-full">
                {roleFilteredConversations.reduce((acc, c) => acc + (c.nao_lidas || 0), 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="channels" className="text-xs flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span>Meus Números</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {channels.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CAIXA DE ENTRADA & VISUALIZAÇÃO DE CONVERSAS */}
        <TabsContent value="inbox" className="m-0 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-270px)] min-h-[580px]">
            {/* Coluna Esquerda: Lista de Conversas (5 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
              {/* Filtros e Busca */}
              <div className="p-3 border-b border-border space-y-2.5 bg-muted/20">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por contato, celular ou conversa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs bg-background"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="aguardando">Aguardando</SelectItem>
                      <SelectItem value="resolvida">Resolvida</SelectItem>
                      <SelectItem value="fechada">Fechada</SelectItem>
                    </SelectContent>
                  </Select>

                  {(isAdmin || isGestor) && (
                    <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Responsável" />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        <SelectItem value="todos">Todos responsáveis</SelectItem>
                        <SelectItem value="sem_responsavel">Sem responsável</SelectItem>
                        {eligibleTransferUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Lista com scroll */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {loading ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground/50" />
                    Carregando conversas do WhatsApp...
                  </div>
                ) : displayConversations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-muted/60 text-muted-foreground/70">
                      <Inbox className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">Nenhuma conversa encontrada</p>
                      <p className="text-[11px] text-muted-foreground max-w-[240px]">
                        {conversations.length === 0
                          ? 'Aguardando sincronização de mensagens pela API oficial do WhatsApp Business.'
                          : 'Nenhuma conversa coincide com os filtros selecionados.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  displayConversations.map((conv) => {
                    const isSelected = selectedConversation?.id === conv.id
                    const contactName =
                      conv.contact?.nome ||
                      conv.remote_jid.replace('@s.whatsapp.net', '') ||
                      'Contato WhatsApp'
                    const contactPhone = conv.contact?.celular || conv.remote_jid
                    const lastMsg = conv.last_message?.conteudo || 'Sem mensagens recentes'
                    const time = formatTimeOrDate(
                      conv.last_message?.created_at || conv.updated_at || conv.created_at,
                    )
                    const responsibleName = conv.responsible_user?.nome || 'Não atribuído'

                    return (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={`p-3.5 cursor-pointer transition-colors text-left flex items-start gap-3 relative ${
                          isSelected
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-l-4 border-l-emerald-600'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="h-10 w-10 shrink-0 rounded-full bg-[#1B2A4A] text-white flex items-center justify-center font-bold text-xs uppercase">
                          {contactName.slice(0, 2)}
                        </div>

                        {/* Conteúdo da Conversa */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {contactName}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {time}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground truncate">{lastMsg}</p>

                          <div className="flex items-center justify-between pt-0.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{responsibleName}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {conv.opportunity && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] py-0 px-1 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5"
                                  title={`Oportunidade: ${conv.opportunity.title || 'Vinculada'}`}
                                >
                                  Oportunidade
                                </Badge>
                              )}
                              {conv.nao_lidas > 0 && (
                                <Badge className="h-4 min-w-[16px] px-1 text-[9px] bg-emerald-600 text-white rounded-full flex items-center justify-center">
                                  {conv.nao_lidas}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Coluna Direita: Visualização da Conversa Selecionada (7 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
              {selectedConversation ? (
                <>
                  {/* Cabeçalho da Conversa Selecionada */}
                  <div className="p-3.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-[#1B2A4A] text-white flex items-center justify-center font-bold text-xs uppercase">
                        {(
                          selectedConversation.contact?.nome ||
                          selectedConversation.remote_jid ||
                          'WA'
                        ).slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {selectedConversation.contact?.nome ||
                              selectedConversation.remote_jid.replace('@s.whatsapp.net', '')}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-semibold capitalize"
                          >
                            {selectedConversation.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>
                            {selectedConversation.contact?.celular ||
                              selectedConversation.remote_jid}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate">
                            <User className="h-3 w-3 shrink-0" />
                            {selectedConversation.responsible_user?.nome || 'Sem responsável'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Botão de Transferência (Apenas Admin e Gestor) */}
                      {canTransfer && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTargetUserId(selectedConversation.responsible_user_id || '')
                            setTransferModalOpen(true)
                          }}
                          className="h-8 text-xs gap-1.5"
                          title="Transferir atendimento para outro corretor"
                        >
                          <PhoneForwarded className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="hidden sm:inline">Transferir</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Vínculos: Contato e Oportunidade */}
                  <div className="px-4 py-2 border-b border-border bg-muted/10 text-xs flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span className="font-medium text-foreground">Contato:</span>
                      <span>
                        {selectedConversation.contact?.nome || 'Não vinculado a contato salvo'}
                      </span>
                    </div>

                    <span className="text-muted-foreground/40">•</span>

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span className="font-medium text-foreground">Oportunidade:</span>
                      {selectedConversation.opportunity ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {selectedConversation.opportunity.title || 'Oportunidade em andamento'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Nenhuma oportunidade vinculada
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Histórico Cronológico de Mensagens */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC] dark:bg-[#0B1322]/50">
                    {loadingMessages ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Carregando mensagens da conversa...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-semibold text-sm text-foreground">
                          Nenhuma mensagem registrada nesta conversa
                        </p>
                        <p className="text-xs max-w-sm">
                          O histórico sincronizado com o WhatsApp aparecerá aqui cronologicamente
                          assim que mensagens forem trocadas pelo número oficial.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isOutgoing = msg.direction === 'outgoing'
                        const msgTime = formatTimeOrDate(msg.created_at)

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs shadow-sm space-y-1 ${
                                isOutgoing
                                  ? 'bg-[#1B2A4A] text-white rounded-br-none'
                                  : 'bg-white dark:bg-[#1A263D] text-foreground border border-border rounded-bl-none'
                              }`}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                              <div
                                className={`flex items-center justify-end gap-1 text-[10px] ${
                                  isOutgoing ? 'text-white/70' : 'text-muted-foreground'
                                }`}
                              >
                                <span>{msgTime}</span>
                                {isOutgoing && (
                                  <>
                                    {msg.status_entrega === 'read' ? (
                                      <CheckCheck className="h-3 w-3 text-cyan-300" />
                                    ) : msg.status_entrega === 'delivered' ? (
                                      <CheckCheck className="h-3 w-3" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Barra inferior de resposta / estado de envio */}
                  <div className="p-3 border-t border-border bg-card space-y-2">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        Envio direto bloqueado nesta etapa: o canal oficial com coexistência será
                        ativado via Meta Cloud API em etapa posterior.
                      </span>
                    </div>

                    <div className="flex items-center gap-2 opacity-60 pointer-events-none">
                      <Input
                        disabled
                        placeholder="Digite sua resposta para o cliente..."
                        className="text-xs h-9 bg-muted"
                      />
                      <Button disabled size="sm" className="h-9 px-3 bg-[#1B2A4A]">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                /* Estado Vazio quando nenhuma conversa foi clicada */
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <MessageSquare className="h-10 w-10" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className="font-bold text-base text-foreground">
                      Selecione uma conversa para visualizar
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Escolha um atendimento na lista à esquerda para conferir o histórico completo,
                      vínculos com contatos, oportunidades e responsável.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: MEUS NÚMEROS & ESTADO DE CONEXÃO COM COEXISTÊNCIA META */}
        <TabsContent value="channels" className="m-0 space-y-4">
          {/* Card Principal de Conexão WhatsApp Business */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-foreground">
                      Canais e Números Conectados
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]"
                    >
                      Coexistência Oficial Meta
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Linhas de atendimento WhatsApp da KKJ Corretora: o número opera simultaneamente
                    no celular e no CRM
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setMetaConnectModalOpen(true)}
                    disabled={metaConnectStatus === 'connecting'}
                    className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm gap-2"
                  >
                    {metaConnectStatus === 'connecting' ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-3.5 w-3.5" />
                        Conectar WhatsApp Business
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Painel de Estado da Conexão em Andamento / Erro recente */}
              {metaConnectStatus === 'connecting' && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Fluxo de Coexistência em Andamento
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {metaConnectMessage || 'Aguardando autorização na janela da Meta...'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px]"
                  >
                    Conectando
                  </Badge>
                </div>
              )}

              {metaConnectStatus === 'error' && metaErrorMessage && (
                <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5 flex items-start justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10 text-destructive mt-0.5">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-destructive">
                        Não foi possível conectar o WhatsApp Business
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {metaErrorMessage}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium pt-1">
                        ✓ Proteção de Coexistência Ativa: Nenhum número existente foi desconectado,
                        migrado ou excluído do aplicativo móvel.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMetaConnectStatus('idle')
                      setMetaErrorMessage(null)
                    }}
                    className="text-xs text-muted-foreground h-7 px-2"
                  >
                    Fechar
                  </Button>
                </div>
              )}

              {/* Lista de Canais */}
              {channels.length === 0 ? (
                /* Estado Vazio de Canais (Não conectado) */
                <div className="py-12 px-6 rounded-xl border border-dashed border-border bg-muted/10 text-center flex flex-col items-center gap-3">
                  <div className="p-3 rounded-full bg-muted text-muted-foreground">
                    <Smartphone className="h-7 w-7" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h4 className="font-semibold text-sm text-foreground">
                      Nenhum número conectado no momento
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Conecte sua linha oficial de atendimento utilizando o fluxo de{' '}
                      <strong>Coexistência da Meta</strong>. Seu WhatsApp continuará funcionando no
                      aplicativo móvel do corretor e no WhatsApp Web sem interrupção.
                    </p>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-[11px] font-medium text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                    Estado atual: Não conectado
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setMetaConnectModalOpen(true)}
                    className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Conectar WhatsApp Business
                  </Button>
                </div>
              ) : (
                /* Grid de Canais Cadastrados */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {channels.map((chan) => {
                    const isChanConnected =
                      chan.ativo && chan.status !== 'error' && chan.status !== 'not_connected'
                    const isChanError = chan.status === 'error'
                    const isChanConnecting = chan.status === 'connecting'

                    return (
                      <div
                        key={chan.id}
                        className="p-4 rounded-xl border border-border bg-card hover:border-emerald-500/40 transition-colors space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2.5 rounded-lg border ${
                                isChanConnected
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : isChanError
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              <Radio className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{chan.nome}</h4>
                              <p className="text-xs text-muted-foreground font-mono">
                                {chan.numero_telefone}
                              </p>
                            </div>
                          </div>

                          {/* Badge de Estado: Não Conectado, Conectando, Conectado, Erro */}
                          {isChanConnected ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Conectado
                            </Badge>
                          ) : isChanConnecting ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] gap-1"
                            >
                              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                              Conectando
                            </Badge>
                          ) : isChanError ? (
                            <Badge
                              variant="outline"
                              className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] gap-1"
                            >
                              <AlertCircle className="h-2.5 w-2.5" />
                              Erro
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]"
                            >
                              Não conectado
                            </Badge>
                          )}
                        </div>

                        {/* Metadados do Canal e Coexistência */}
                        <div className="text-[11px] text-muted-foreground space-y-1.5 border-t border-border/50 pt-2.5">
                          <div className="flex justify-between">
                            <span>Provedor:</span>
                            <span className="font-medium text-foreground uppercase text-[10px]">
                              {chan.provedor === 'oficial'
                                ? 'Meta Cloud API Oficial'
                                : chan.provedor}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Fluxo de Coexistência:</span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              App móvel + CRM ativos
                            </span>
                          </div>

                          {chan.waba_id && (
                            <div className="flex justify-between">
                              <span>WABA ID:</span>
                              <span className="font-mono text-[10px] text-foreground">
                                {chan.waba_id}
                              </span>
                            </div>
                          )}

                          {chan.phone_number_id && (
                            <div className="flex justify-between">
                              <span>Phone ID:</span>
                              <span className="font-mono text-[10px] text-foreground">
                                {chan.phone_number_id}
                              </span>
                            </div>
                          )}

                          {chan.erro_conexao && (
                            <p className="text-[11px] text-destructive pt-1 border-t border-destructive/20">
                              {chan.erro_conexao}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card explicativo sobre a Coexistência Oficial e Governança */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5 text-xs leading-relaxed">
                    <h4 className="font-bold text-sm text-foreground">
                      Garantia de Coexistência (Zero Migração)
                    </h4>
                    <p className="text-muted-foreground">
                      O CRM KKJ utiliza o fluxo oficial{' '}
                      <strong>Embedded Signup com Coexistência</strong> da Meta. Seu número continua
                      100% ativo no WhatsApp Business do celular e no WhatsApp Web.
                    </p>
                    <p className="text-muted-foreground font-medium text-emerald-700 dark:text-emerald-400">
                      ✓ Proibida qualquer migração tradicional, exclusão de conta ou desconexão do
                      aplicativo do corretor.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-500/20">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5 text-xs leading-relaxed">
                    <h4 className="font-bold text-sm text-foreground">
                      Segurança de Credenciais e Backend
                    </h4>
                    <p className="text-muted-foreground">
                      Nenhum token da Meta é exposto ao navegador. A troca de código de autorização
                      é feita estritamente pelo servidor backend do Skip Cloud com a Graph API v21+.
                    </p>
                    <p className="text-muted-foreground">
                      Configuração ativa: Login Empresarial Meta ID{' '}
                      <span className="font-mono font-bold text-foreground">
                        {META_WHATSAPP_CONFIG.CONFIG_ID}
                      </span>
                      .
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL DE TRANSFERÊNCIA DE ATENDIMENTO */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <PhoneForwarded className="h-4 w-4 text-blue-600" />
              Transferir Atendimento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o novo corretor responsável por este atendimento no WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente / Contato:</span>
                <span className="font-semibold text-foreground">
                  {selectedConversation?.contact?.nome || selectedConversation?.remote_jid}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Responsável atual:</span>
                <span className="font-semibold text-foreground">
                  {selectedConversation?.responsible_user?.nome || 'Sem responsável'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Novo Responsável</label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione um corretor..." />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {eligibleTransferUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isGestor && (
                <p className="text-[11px] text-muted-foreground">
                  Gestores só podem transferir para corretores integrantes de sua equipe ativa.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferModalOpen(false)}
              disabled={transferring}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleTransfer}
              disabled={transferring || !targetUserId}
              className="text-xs bg-[#1B2A4A] text-white hover:bg-[#1B2A4A]/90 gap-1.5"
            >
              {transferring ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Transferindo...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Confirmar Transferência
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONEXÃO OFICIAL META WHATSAPP BUSINESS COM COEXISTÊNCIA */}
      <Dialog open={metaConnectModalOpen} onOpenChange={setMetaConnectModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Smartphone className="h-4 w-4" />
              </div>
              Conectar WhatsApp Business Oficial
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fluxo oficial com garantia de coexistência Meta: seu app móvel continua funcionando
              normalmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Aviso de Coexistência */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Modo de Coexistência Habilitado</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Você <strong>não precisará migrar nem desconectar</strong> o WhatsApp do seu
                celular. A Meta validará a coexistência e vinculará o número ao CRM KKJ mantendo o
                app móvel e o WhatsApp Web simultaneamente ativos.
              </p>
            </div>

            {/* Informações da Configuração Meta */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Login Empresarial Config ID:</span>
                <span className="font-mono font-medium text-foreground">
                  {META_WHATSAPP_CONFIG.CONFIG_ID}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Permissões Solicitadas:</span>
                <span className="font-medium text-foreground">
                  whatsapp_business_management, whatsapp_business_messaging
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usuário Responsável:</span>
                <span className="font-medium text-foreground">
                  {user?.name || user?.nome || user?.email}
                </span>
              </div>
            </div>

            {/* Nome de identificação opcional para o canal */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Nome de identificação do canal (opcional)
              </label>
              <Input
                type="text"
                placeholder={`Ex.: Atendimento KKJ - ${user?.name || user?.nome || 'Comercial'}`}
                value={channelDisplayName}
                onChange={(e) => setChannelDisplayName(e.target.value)}
                disabled={metaConnectStatus === 'connecting'}
                className="text-xs h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Deixe em branco para usar o nome verificado registrado na sua conta Meta WhatsApp.
              </p>
            </div>

            {/* Status do Backend / Diagnóstico de Segredos */}
            {metaBackendStatus &&
              (!metaBackendStatus.meta.has_app_id || !metaBackendStatus.meta.has_app_secret) && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Atenção: Configurações da Meta pendentes no servidor</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    As variáveis <code className="font-mono text-[10px]">META_APP_ID</code> e{' '}
                    <code className="font-mono text-[10px]">META_APP_SECRET</code> ainda não foram
                    definidas nos segredos do Skip Cloud. Você pode abrir a janela oficial da Meta
                    para autorizar, mas a finalização da troca do código exigirá essas chaves no
                    painel.
                  </p>
                </div>
              )}

            {/* Mensagem de Progresso / Erro */}
            {metaConnectStatus === 'connecting' && (
              <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 flex items-center gap-2.5 text-xs text-blue-700 dark:text-blue-300">
                <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                <span>{metaConnectMessage || 'Processando autorização na Meta...'}</span>
              </div>
            )}

            {metaConnectStatus === 'error' && metaErrorMessage && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Falha no processo de conexão:
                </p>
                <p className="text-[11px] leading-relaxed">{metaErrorMessage}</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ O número do seu aparelho celular não sofreu nenhuma alteração.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMetaConnectModalOpen(false)
                setMetaConnectStatus('idle')
                setMetaErrorMessage(null)
              }}
              disabled={metaConnectStatus === 'connecting'}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConnectWhatsAppBusiness}
              disabled={metaConnectStatus === 'connecting'}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
            >
              {metaConnectStatus === 'connecting' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Conectando com a Meta...
                </>
              ) : (
                <>
                  <Smartphone className="h-3.5 w-3.5" />
                  Iniciar Conexão com Coexistência
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
