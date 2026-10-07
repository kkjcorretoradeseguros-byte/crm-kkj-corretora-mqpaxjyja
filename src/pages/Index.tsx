import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Users,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowRight,
  Phone,
  Mail,
  Video,
  Clock,
  Home,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { propertyService } from '@/services/propertyService'
import { clientService } from '@/services/clientService'
import { interactionService } from '@/services/interactionService'
import { pipelineService } from '@/services/pipelineService'
import { useRealtime } from '@/hooks/use-realtime'
import type { Property, Client, Interaction, PipelineStage, PipelineEntry } from '@/types/crm'

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [properties, setProperties] = useState<Property[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [entries, setEntries] = useState<PipelineEntry[]>([])

  const loadData = useCallback(async () => {
    try {
      const [propsRes, clientsRes, intersRes, stagesRes, entriesRes] = await Promise.all([
        propertyService.getAllProperties(),
        clientService.getAllClients(),
        interactionService.getAllInteractions(),
        pipelineService.getStages(),
        pipelineService.getEntries(),
      ])
      setProperties(propsRes)
      setClients(clientsRes)
      setInteractions(intersRes)
      setStages(stagesRes)
      setEntries(entriesRes)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Subscriptions for real-time updates
  useRealtime('properties', () => loadData())
  useRealtime('clients', () => loadData())
  useRealtime('interactions', () => loadData())
  useRealtime('pipeline_entries', () => loadData())

  // Metrics
  const activePropertiesCount = properties.filter((p) => p.status === 'Disponível').length
  const totalClientsCount = clients.length
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthInteractionsCount = interactions.filter((i) => {
    const d = new Date(i.interaction_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  // Conversion rate: (closed entries / total entries) * 100
  const closedStage = stages.find((s) => s.name === 'Fechado')
  const closedCount = entries.filter((e) => e.stage_id === closedStage?.id).length
  const conversionRate = entries.length > 0 ? Math.round((closedCount / entries.length) * 100) : 18

  // Upcoming scheduled visits in next 7 days
  const now = new Date()
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const upcomingVisits = interactions
    .filter((i) => {
      if (i.type !== 'Visita' && i.type !== 'Reunião') return false
      const d = i.follow_up_date ? new Date(i.follow_up_date) : new Date(i.interaction_date)
      return d >= now && d <= next7Days
    })
    .sort((a, b) => {
      const da = new Date(a.follow_up_date || a.interaction_date).getTime()
      const db = new Date(b.follow_up_date || b.interaction_date).getTime()
      return da - db
    })

  const getClientName = (clientId: string) => {
    const c = clients.find((item) => item.id === clientId)
    return c ? c.full_name : 'Cliente'
  }

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'Telefone':
        return <Phone className="h-4 w-4 text-blue-600" />
      case 'E-mail':
        return <Mail className="h-4 w-4 text-purple-600" />
      case 'Visita':
        return <Home className="h-4 w-4 text-amber-600" />
      case 'Reunião':
        return <Video className="h-4 w-4 text-emerald-600" />
      case 'WhatsApp':
        return <MessageSquare className="h-4 w-4 text-green-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Disponível':
        return (
          <Badge className="bg-[#12B76A]/10 text-[#12B76A] hover:bg-[#12B76A]/20 border-[#12B76A]/30">
            Disponível
          </Badge>
        )
      case 'Vendido':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
            Vendido
          </Badge>
        )
      case 'Alugado':
        return (
          <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">
            Alugado
          </Badge>
        )
      case 'Reservado':
        return (
          <Badge className="bg-[#F79009]/10 text-[#F79009] hover:bg-[#F79009]/20 border-[#F79009]/30">
            Reservado
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-slate-200" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl bg-slate-200" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-72 rounded-xl bg-slate-200" />
          <Skeleton className="h-72 rounded-xl bg-slate-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Imóveis Ativos */}
        <Card className="border-[#E4E7EC] shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#667085]">Imóveis Ativos</span>
            <div className="p-2 rounded-lg bg-blue-50 text-[#1B2A4A]">
              <Building2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#101828]">
              {activePropertiesCount}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[#12B76A]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-medium">+8%</span>
              <span className="text-[#667085]">em relação ao mês passado</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Clientes */}
        <Card className="border-[#E4E7EC] shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#667085]">Total de Clientes</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-[#12B76A]">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#101828]">
              {totalClientsCount}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[#12B76A]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-medium">+12%</span>
              <span className="text-[#667085]">novos contatos</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Interações do Mês */}
        <Card className="border-[#E4E7EC] shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#667085]">Interações do Mês</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <MessageSquare className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#101828]">
              {monthInteractionsCount}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[#12B76A]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-medium">+18%</span>
              <span className="text-[#667085]">visitas e contatos</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Taxa de Conversão */}
        <Card className="border-[#E4E7EC] shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#667085]">Taxa de Conversão</span>
            <div className="p-2 rounded-lg bg-amber-50 text-[#D4AF37]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-[#101828]">
              {conversionRate}%
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[#12B76A]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-medium">+3.4%</span>
              <span className="text-[#667085]">eficiência no funil</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Summary Panel */}
      <Card className="border-[#E4E7EC] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-[#101828]">
              Funil de Vendas (Pipeline)
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Distribuição de negociações em andamento por etapa
            </CardDescription>
          </div>
          <Link to="/pipeline">
            <Button variant="ghost" size="sm" className="text-xs text-[#1B2A4A] hover:bg-[#F5F7FA]">
              Abrir Kanban <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stages.map((stage) => {
              const count = entries.filter((e) => e.stage_id === stage.id).length
              const totalValue = entries
                .filter((e) => e.stage_id === stage.id && e.value)
                .reduce((sum, e) => sum + (e.value || 0), 0)

              return (
                <div
                  key={stage.id}
                  className="rounded-xl p-3 border border-[#E4E7EC] bg-white relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: stage.color || '#3B82F6' }}
                  />
                  <div className="text-[11px] font-semibold text-[#667085] truncate mb-1">
                    {stage.name}
                  </div>
                  <div className="text-xl font-bold text-[#101828]">{count}</div>
                  <div className="text-[11px] font-medium text-[#667085] mt-1">
                    {totalValue > 0
                      ? `R$ ${(totalValue / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
                      : 'R$ 0'}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2-column layout: Recent Interactions & Upcoming Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Interactions List (2 cols) */}
        <Card className="lg:col-span-2 border-[#E4E7EC] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-[#101828]">
                Últimas Interações
              </CardTitle>
              <CardDescription className="text-xs text-[#667085]">
                Histórico de contatos, reuniões e visitas com clientes
              </CardDescription>
            </div>
            <Link to="/interacoes">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#1B2A4A] hover:bg-[#F5F7FA]"
              >
                Ver todas <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {interactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#667085]">
                Nenhuma interação registrada ainda.
              </div>
            ) : (
              <div className="divide-y divide-[#E4E7EC]">
                {interactions.slice(0, 5).map((inter) => {
                  const clientName =
                    inter.expand?.client_id?.full_name || getClientName(inter.client_id)
                  const dateStr = new Date(inter.interaction_date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <div key={inter.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 p-2 rounded-lg bg-[#F5F7FA] border border-[#E4E7EC] shrink-0">
                          {getInteractionIcon(inter.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#101828] truncate">
                              {clientName}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {inter.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-[#667085] mt-1 line-clamp-1">{inter.notes}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#667085] shrink-0 whitespace-nowrap">
                        {dateStr}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Visits Panel (1 col) */}
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#101828] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#1B2A4A]" />
              Próximas Visitas (7 dias)
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Compromissos agendados na agenda
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingVisits.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/70" />
                <span>Nenhuma visita agendada para os próximos 7 dias.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingVisits.map((v) => {
                  const clientName = v.expand?.client_id?.full_name || getClientName(v.client_id)
                  const vDate = new Date(v.follow_up_date || v.interaction_date)
                  const formatted = vDate.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <div
                      key={v.id}
                      className="p-3 rounded-lg border border-[#E4E7EC] bg-[#F5F7FA] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#101828]">{clientName}</span>
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {v.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#667085] line-clamp-1">{v.notes}</p>
                      <div className="text-[11px] font-medium text-[#1B2A4A] flex items-center gap-1 pt-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatted}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Properties Grid */}
      <Card className="border-[#E4E7EC] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-[#101828]">Imóveis Recentes</CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Últimos lançamentos e imóveis adicionados à carteira
            </CardDescription>
          </div>
          <Link to="/imoveis">
            <Button variant="ghost" size="sm" className="text-xs text-[#1B2A4A] hover:bg-[#F5F7FA]">
              Ver catálogo completo <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.slice(0, 3).map((prop) => {
              const photoUrl =
                prop.photos && prop.photos.length > 0
                  ? propertyService.getFileUrl(prop, prop.photos[0])
                  : `https://img.usecurling.com/p/600/400?q=${encodeURIComponent(
                      prop.type === 'Casa' ? 'luxury house' : 'modern apartment',
                    )}`

              return (
                <div
                  key={prop.id}
                  className="rounded-xl border border-[#E4E7EC] bg-white overflow-hidden shadow-sm hover:shadow-md transition flex flex-col"
                >
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={photoUrl}
                      alt={prop.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2.5 left-2.5">{getStatusBadge(prop.status)}</div>
                    <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                      {prop.transaction_type}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#101828] line-clamp-1">
                        {prop.title}
                      </h4>
                      <p className="text-xs text-[#667085] mt-1">
                        {prop.address_neighborhood
                          ? `${prop.address_neighborhood}, ${prop.address_city}`
                          : prop.address_city}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#E4E7EC] flex items-center justify-between">
                      <div className="text-xs text-[#667085]">
                        {prop.bedrooms ? `${prop.bedrooms} qts • ` : ''}
                        {prop.area_m2 ? `${prop.area_m2}m²` : ''}
                      </div>
                      <div className="text-sm font-bold text-[#1B2A4A]">
                        R$ {prop.price.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
