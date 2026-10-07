import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Shield,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Users,
  Flame,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Filter,
  UserCheck,
  Calendar,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { opportunityService } from '@/services/opportunityService'
import { companyService } from '@/services/companyService'
import { taskService } from '@/services/taskService'
import { contractService } from '@/services/contractService'
import { productService } from '@/services/productService'
import { userService } from '@/services/userService'
import { useAuth } from '@/contexts/AuthContext'
import type { Opportunity, Company, Task, Contract, Product, User } from '@/types/crm'

type PeriodFilter = 'mes_atual' | 'trimestre' | 'ano' | 'todos'

interface DonutSlice {
  id: string
  label: string
  color: string
  secondaryColor?: string
  valueFormatted: string
  detail: string
  count: number
  targetRoute: string
  percentage: number
}

export default function Index() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [usersList, setUsersList] = useState<User[]>([])

  // Filters
  const [period, setPeriod] = useState<PeriodFilter>('mes_atual')
  const [selectedUser, setSelectedUser] = useState<string>('todos')
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null)

  const isSeller = user?.role === 'VENDEDOR'

  const loadData = useCallback(async () => {
    try {
      const [oppsRes, compRes, tasksRes, contractsRes, prodRes, usersRes] = await Promise.all([
        opportunityService.getAllOpportunities(),
        companyService.getAllCompanies(),
        taskService.getAllTasks(),
        contractService.getAllContracts(),
        productService.getAllProducts(),
        userService.getAllUsers().catch(() => [] as User[]),
      ])
      setOpportunities(oppsRes)
      setCompanies(compRes)
      setTasks(tasksRes)
      setContracts(contractsRes)
      setProducts(prodRes)
      setUsersList(usersRes)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Helper date filtering
  const now = useMemo(() => new Date(), [])
  const startOfMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now])
  const startOfQuarter = useMemo(
    () => new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
    [now],
  )
  const startOfYear = useMemo(() => new Date(now.getFullYear(), 0, 1), [now])

  const isWithinPeriod = useCallback(
    (dateStr?: string) => {
      if (period === 'todos') return true
      if (!dateStr) return true // include records without date or fallback
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return true
      if (period === 'mes_atual') return d >= startOfMonth
      if (period === 'trimestre') return d >= startOfQuarter
      if (period === 'ano') return d >= startOfYear
      return true
    },
    [period, startOfMonth, startOfQuarter, startOfYear],
  )

  // Filter items by role/user and period
  const effectiveUserId = isSeller ? user?.id : selectedUser === 'todos' ? null : selectedUser

  const filteredOpps = useMemo(() => {
    return opportunities.filter((o) => {
      if (effectiveUserId && o.assigned_to !== effectiveUserId) return false
      return isWithinPeriod(o.updated || o.created)
    })
  }, [opportunities, effectiveUserId, isWithinPeriod])

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (effectiveUserId && c.assigned_to !== effectiveUserId) return false
      return isWithinPeriod(c.start_date || c.created)
    })
  }, [contracts, effectiveUserId, isWithinPeriod])

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (effectiveUserId && t.assigned_to !== effectiveUserId) return false
      return isWithinPeriod(t.due_date || t.created)
    })
  }, [tasks, effectiveUserId, isWithinPeriod])

  // =========================================================================
  // CALCULOS REAIS DOS 5 INDICADORES OBRIGATÓRIOS
  // 1. Valor vendido: verde-esmeralda #00E8A2
  // 2. Leads: azul-ciano #20C7FF
  // 3. Negociações: violeta #C07AFF
  // 4. Implantação: coral #FF7955
  // 5. Tarefas: amarelo #FFD23F
  // =========================================================================

  const salesOpps = useMemo(
    () => filteredOpps.filter((o) => o.pipeline_type === 'VENDAS'),
    [filteredOpps],
  )
  const postSalesOpps = useMemo(
    () => filteredOpps.filter((o) => o.pipeline_type === 'POS_VENDA'),
    [filteredOpps],
  )

  // 1. Valor vendido (Soma de contratos + vendas ganhas)
  const wonSalesOpps = useMemo(
    () => salesOpps.filter((o) => o.stage === 'Venda ganha'),
    [salesOpps],
  )
  const contractsSaleTotal = filteredContracts.reduce((sum, c) => sum + (c.sale_value || 0), 0)
  const wonOppsSaleTotal = wonSalesOpps.reduce((sum, o) => sum + (o.sale_value || 0), 0)
  const totalSoldValue = contractsSaleTotal + wonOppsSaleTotal
  const totalLivesWon =
    filteredContracts.reduce((sum, c) => sum + (c.lives_count || 0), 0) +
    wonSalesOpps.reduce((sum, o) => sum + (o.health_data?.lives_count || 0), 0)

  // 2. Leads (Etapas iniciais de prospecção e qualificação no funil comercial)
  // 'Novo Lead', 'Contato realizado', 'Qualificado'
  const leadsOpps = useMemo(
    () =>
      salesOpps.filter(
        (o) =>
          o.stage === 'Novo Lead' || o.stage === 'Contato realizado' || o.stage === 'Qualificado',
      ),
    [salesOpps],
  )
  const leadsCount = leadsOpps.length
  const totalSalesLeadsCount = salesOpps.length

  // 3. Negociações (Cotação, Follow-up, Negociação)
  const negotiationsOpps = useMemo(
    () =>
      salesOpps.filter(
        (o) => o.stage === 'Cotação' || o.stage === 'Follow-up' || o.stage === 'Negociação',
      ),
    [salesOpps],
  )
  const negotiationsCount = negotiationsOpps.length
  const negotiationsValue = negotiationsOpps.reduce((sum, o) => sum + (o.sale_value || 0), 0)

  // 4. Implantação (Contratos em implantação ou pós-venda nas etapas de doc/implantação)
  const activeImplementationContracts = useMemo(
    () => filteredContracts.filter((c) => c.status === 'Em Implantação' || c.status === 'Ativo'),
    [filteredContracts],
  )
  const implementationPostSales = useMemo(
    () =>
      postSalesOpps.filter(
        (o) =>
          o.stage === 'Documentação' ||
          o.stage === 'Implantação' ||
          o.stage === 'Aguardando pagamento',
      ),
    [postSalesOpps],
  )
  const implementationCount = activeImplementationContracts.length + implementationPostSales.length

  // 5. Tarefas (Tarefas operacionais do período selecionado, pendentes/hoje)
  const pendingTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === 'Pendente'),
    [filteredTasks],
  )
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const overdueTasksCount = pendingTasks.filter((t) => t.due_date < todayStr).length
  const tasksCount = pendingTasks.length

  // Definição dos 5 indicadores com cores e rotas EXATAS
  const indicators: DonutSlice[] = useMemo(
    () => [
      {
        id: 'valor_vendido',
        label: 'Valor vendido',
        color: '#00E8A2', // verde-esmeralda
        valueFormatted: `R$ ${totalSoldValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        detail: `${wonSalesOpps.length + filteredContracts.length} contratos fechados (${totalLivesWon} vidas)`,
        count: wonSalesOpps.length + filteredContracts.length,
        targetRoute: '/financeiro',
        percentage: 20,
      },
      {
        id: 'leads',
        label: 'Leads',
        color: '#20C7FF', // azul-ciano
        valueFormatted: `${leadsCount} leads`,
        detail: `${totalSalesLeadsCount} no funil de vendas`,
        count: leadsCount,
        targetRoute: '/pipeline?funnel=VENDAS&stage=Novo+Lead',
        percentage: 20,
      },
      {
        id: 'negociacoes',
        label: 'Negociações',
        color: '#C07AFF', // violeta
        valueFormatted: `${negotiationsCount} em negociação`,
        detail: `R$ ${negotiationsValue.toLocaleString('pt-BR')} em pipeline ativo`,
        count: negotiationsCount,
        targetRoute: '/pipeline?funnel=VENDAS&stage=Negociação',
        percentage: 20,
      },
      {
        id: 'implantacao',
        label: 'Implantação',
        color: '#FF7955', // coral
        valueFormatted: `${implementationCount} em processo`,
        detail: `${activeImplementationContracts.length} apólices / ${implementationPostSales.length} pós-venda`,
        count: implementationCount,
        targetRoute: '/pipeline?funnel=POS_VENDA',
        percentage: 20,
      },
      {
        id: 'tarefas',
        label: 'Tarefas',
        color: '#FFD23F', // amarelo
        valueFormatted: `${tasksCount} pendentes`,
        detail: overdueTasksCount > 0 ? `${overdueTasksCount} tarefas atrasadas` : 'Todas em dia',
        count: tasksCount,
        targetRoute: '/tarefas',
        percentage: 20,
      },
    ],
    [
      totalSoldValue,
      wonSalesOpps.length,
      filteredContracts.length,
      totalLivesWon,
      leadsCount,
      totalSalesLeadsCount,
      negotiationsCount,
      negotiationsValue,
      implementationCount,
      activeImplementationContracts.length,
      implementationPostSales.length,
      tasksCount,
      overdueTasksCount,
    ],
  )

  // Cálculos geométricos da rosca SVG (5 segmentos EQUIVALENTES de 72° cada com gap)
  const radius = 80
  const strokeWidth = 22
  const center = 110
  const circumference = 2 * Math.PI * radius // ≈ 502.65
  const segmentLength = circumference / 5 - 8 // gap de 8px
  const gapLength = circumference - segmentLength

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl bg-slate-200 dark:bg-muted" />
        <Skeleton className="h-80 w-full rounded-3xl bg-slate-200 dark:bg-muted" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl bg-slate-200 dark:bg-muted" />
          <Skeleton className="h-64 rounded-2xl bg-slate-200 dark:bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-10">
      {/* Top Banner KKJ */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0F1C34] via-[#152747] to-[#1E3A66] border border-[#203960]/40 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-md relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shrink-0 shadow-inner">
            <Shield className="h-6 w-6 text-[#00E8A2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
                KK JEKABSON — Corretora de Seguros & Benefícios
              </h2>
              <Badge className="bg-[#00E8A2]/20 text-[#00E8A2] border border-[#00E8A2]/30 text-[10px] font-bold px-2 py-0.5">
                CRM Comercial
              </Badge>
            </div>
            <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">
              Operação de Planos de Saúde Corporativo/PME, Odonto, Vida e Benefícios
            </p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          {/* Period Filter */}
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-xl p-1 border border-white/10">
            <Calendar className="h-3.5 w-3.5 text-slate-300 ml-1.5" />
            <Select value={period} onValueChange={(val) => setPeriod(val as PeriodFilter)}>
              <SelectTrigger className="h-7 text-xs bg-transparent border-none text-white focus:ring-0 gap-1 px-2 w-[125px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="ano">Ano 2025</SelectItem>
                <SelectItem value="todos">Todo o Período</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User Filter (Admin/Gestor only) */}
          {!isSeller && (
            <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md rounded-xl p-1 border border-white/10">
              <UserCheck className="h-3.5 w-3.5 text-slate-300 ml-1.5" />
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-7 text-xs bg-transparent border-none text-white focus:ring-0 gap-1 px-2 w-[140px] truncate">
                  <SelectValue placeholder="Corretor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Toda a Corretora</SelectItem>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Link to="/pipeline">
            <Button
              size="sm"
              className="h-8 bg-[#00E8A2] hover:bg-[#00c98c] text-[#0A1628] text-xs font-bold shadow-md transition-all hover:scale-[1.02]"
            >
              Pipeline Comercial <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OPÇÃO 8 — ROSCA FLUTUANTE PREMIUM COM OS 5 INDICADORES OFICIAIS           */}
      {/* Substitui em definitivo os 4 cartões antigos na rota "/"                  */}
      {/* ========================================================================= */}
      <Card className="border border-[#E4E7EC] dark:border-[#1E3252] bg-white dark:bg-[#0E1A2E] shadow-lg rounded-3xl overflow-hidden transition-all">
        <CardHeader className="pb-4 border-b border-[#E4E7EC]/80 dark:border-[#1A2D4A] px-6 sm:px-8 pt-6 sm:pt-8 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-[#13223B]/40 dark:to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#00E8A2] animate-pulse" />
                <CardTitle className="text-lg sm:text-xl font-extrabold tracking-tight text-[#101828] dark:text-white">
                  Painel Comercial Consolidado
                </CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm text-[#667085] dark:text-slate-300 mt-1">
                Visualização integrada das 5 dimensões estratégicas da KK JEKABSON Corretora
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto text-[11px] font-semibold text-[#667085] dark:text-slate-300 bg-slate-100 dark:bg-[#152540] px-3 py-1 rounded-full border border-slate-200 dark:border-[#21385C]">
              <span>Segmentos interativos</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>Clique para navegar</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center">
            {/* LADO ESQUERDO: GRÁFICO DE ROSCA FLUTUANTE (DONUT) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
              <div className="relative w-[240px] h-[240px] sm:w-[270px] sm:h-[270px] flex items-center justify-center">
                {/* Glow de fundo */}
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-25 transition-all duration-500 pointer-events-none"
                  style={{
                    backgroundColor:
                      hoveredSliceIndex !== null ? indicators[hoveredSliceIndex].color : '#00E8A2',
                  }}
                />

                <svg
                  className="w-full h-full -rotate-90 filter drop-shadow-md"
                  viewBox="0 0 220 220"
                >
                  {/* Fundo do trilho */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-slate-100 dark:text-[#162744]"
                  />

                  {/* 5 Segmentos Equivalentes (72° cada, gap uniforme) */}
                  {indicators.map((ind, idx) => {
                    const isHovered = hoveredSliceIndex === idx
                    const strokeOffset = -idx * (circumference / 5)

                    return (
                      <circle
                        key={ind.id}
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke={ind.color}
                        strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={`${segmentLength} ${gapLength}`}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        className="transition-all duration-300 cursor-pointer origin-center"
                        style={{
                          opacity: hoveredSliceIndex === null || isHovered ? 1 : 0.45,
                          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                        }}
                        onMouseEnter={() => setHoveredSliceIndex(idx)}
                        onMouseLeave={() => setHoveredSliceIndex(null)}
                        onClick={() => navigate(ind.targetRoute)}
                      />
                    )
                  })}
                </svg>

                {/* Centro Flutuante do Donut */}
                <div
                  className="absolute flex flex-col items-center justify-center text-center p-4 rounded-full bg-white dark:bg-[#0A1322] border border-slate-100 dark:border-[#1E3456] shadow-xl w-[130px] h-[130px] sm:w-[150px] sm:h-[150px] cursor-pointer transition-transform hover:scale-105"
                  onClick={() => {
                    if (hoveredSliceIndex !== null) {
                      navigate(indicators[hoveredSliceIndex].targetRoute)
                    }
                  }}
                >
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#667085] dark:text-slate-400">
                    {hoveredSliceIndex !== null
                      ? indicators[hoveredSliceIndex].label
                      : 'Total Comercial'}
                  </span>
                  <span
                    className="text-sm sm:text-base font-black tracking-tight mt-0.5 truncate max-w-[125px] sm:max-w-[140px]"
                    style={{
                      color:
                        hoveredSliceIndex !== null
                          ? indicators[hoveredSliceIndex].color
                          : undefined,
                    }}
                  >
                    {hoveredSliceIndex !== null
                      ? indicators[hoveredSliceIndex].valueFormatted
                      : `R$ ${Math.round(totalSoldValue).toLocaleString('pt-BR')}`}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-[#667085] dark:text-slate-400 mt-1 line-clamp-1 px-1">
                    {hoveredSliceIndex !== null
                      ? indicators[hoveredSliceIndex].detail
                      : '5 Indicadores KKJ'}
                  </span>
                </div>
              </div>

              {/* Legenda de auxílio visual sob a rosca */}
              <div className="mt-4 flex items-center gap-2 text-xs text-[#667085] dark:text-slate-400">
                <Layers className="h-3.5 w-3.5 text-[#00E8A2]" />
                <span className="text-[11px]">
                  Segmentos proporcionais por categoria operacional
                </span>
              </div>
            </div>

            {/* LADO DIREITO: OS CINCO INDICADORES EM ORDEM E CORES EXATAS */}
            <div className="lg:col-span-7 space-y-3">
              {indicators.map((ind, index) => {
                const isHovered = hoveredSliceIndex === index
                return (
                  <div
                    key={ind.id}
                    onMouseEnter={() => setHoveredSliceIndex(index)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                    onClick={() => navigate(ind.targetRoute)}
                    className={`group flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isHovered
                        ? 'border-slate-300 dark:border-[#2A4770] bg-slate-50 dark:bg-[#14233D] shadow-md -translate-y-0.5'
                        : 'border-[#E4E7EC] dark:border-[#1A2D4A] bg-white dark:bg-[#0F1C31] hover:border-slate-300 dark:hover:border-[#22395C] hover:bg-slate-50/60 dark:hover:bg-[#12213A]'
                    }`}
                  >
                    {/* Indicador & Título */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Pill de Cor */}
                      <div
                        className="w-3.5 h-10 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-110"
                        style={{ backgroundColor: ind.color }}
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#667085] dark:text-slate-400">
                            {index + 1}. {ind.label}
                          </span>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: ind.color }}
                          />
                        </div>
                        <div className="text-base sm:text-lg font-black tracking-tight text-[#101828] dark:text-white truncate mt-0.5">
                          {ind.valueFormatted}
                        </div>
                        <p className="text-[11px] text-[#667085] dark:text-slate-400 truncate">
                          {ind.detail}
                        </p>
                      </div>
                    </div>

                    {/* Ação / Seta */}
                    <div className="mt-2 sm:mt-0 flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#1A2D4A]">
                      <span className="text-[11px] font-semibold text-[#667085] dark:text-slate-400 group-hover:text-primary transition-colors">
                        Ver detalhes
                      </span>
                      <div
                        className="p-1.5 rounded-lg border transition-colors group-hover:text-white"
                        style={{
                          borderColor: `${ind.color}40`,
                          backgroundColor: isHovered ? ind.color : 'transparent',
                          color: isHovered ? '#0A1628' : ind.color,
                        }}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row complementar: Funil de Vendas Visual Distribution */}
      <Card className="border-[#E4E7EC] dark:border-[#1E3252] bg-white dark:bg-[#0E1A2E] shadow-sm rounded-2xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
          <div>
            <CardTitle className="text-base font-bold text-[#101828] dark:text-foreground">
              Funil de Vendas — Volume e Valor por Etapa
            </CardTitle>
            <CardDescription className="text-xs text-[#667085] dark:text-muted-foreground">
              Distribuição quantitativa e financeira das negociações comerciais ativas
            </CardDescription>
          </div>
          <Link to="/pipeline" className="self-start sm:self-auto">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#1B2A4A] dark:text-primary hover:bg-[#F5F7FA] dark:hover:bg-[#1E2D4A] px-2.5"
            >
              Ver Kanban Completo <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 min-w-[560px] sm:min-w-0">
              {[
                'Novo Lead',
                'Contato realizado',
                'Qualificado',
                'Cotação',
                'Follow-up',
                'Negociação',
                'Venda ganha',
              ].map((stageName, idx) => {
                const oppsInStage = salesOpps.filter((o) => o.stage === stageName)
                const stageValue = oppsInStage.reduce((sum, o) => sum + (o.sale_value || 0), 0)

                return (
                  <div
                    key={stageName}
                    className="rounded-xl p-3 border border-[#E4E7EC] dark:border-[#203658] bg-[#F5F7FA]/40 dark:bg-[#12213A]/60 relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1 bg-[#1B2A4A] dark:bg-primary"
                      style={{ opacity: 0.35 + idx * 0.1 }}
                    />
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#667085] dark:text-muted-foreground truncate mb-1">
                      {stageName}
                    </div>
                    <div className="text-xl font-black text-[#101828] dark:text-foreground">
                      {oppsInStage.length}
                    </div>
                    <div className="text-[11px] font-semibold text-[#1B2A4A] dark:text-primary mt-1 truncate">
                      {stageValue > 0 ? `R$ ${stageValue.toLocaleString('pt-BR')}` : 'R$ 0'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row complementar: Tarefas de Hoje / Atrasadas & Oportunidades Quentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tarefas de Hoje e Atrasadas (7 cols) */}
        <Card className="lg:col-span-7 border-[#E4E7EC] dark:border-[#1E3252] bg-white dark:bg-[#0E1A2E] shadow-sm rounded-2xl">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
            <div>
              <CardTitle className="text-base font-bold text-[#101828] dark:text-foreground">
                Tarefas de Hoje & Atrasadas
              </CardTitle>
              <CardDescription className="text-xs text-[#667085] dark:text-muted-foreground">
                Acompanhamento e compromissos operacionais do corretor
              </CardDescription>
            </div>
            <Link to="/tarefas" className="self-start sm:self-auto">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#1B2A4A] dark:text-primary hover:bg-[#F5F7FA] dark:hover:bg-[#1E2D4A] px-2.5"
              >
                Ver Todas ({tasks.length}) <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pendingTasks.filter((t) => t.due_date <= todayStr).length === 0 ? (
              <div className="py-8 text-center text-xs text-[#667085] dark:text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                <span>Nenhuma tarefa atrasada para hoje. Tudo em dia!</span>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E7EC] dark:divide-[#1E3252]">
                {/* Tarefas Atrasadas */}
                {pendingTasks
                  .filter((t) => t.due_date < todayStr)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="py-3 flex items-start justify-between gap-3 text-xs bg-red-50/60 dark:bg-red-950/30 p-2.5 rounded-lg mb-1.5 border border-red-200/50 dark:border-red-900/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300 text-[9px] border-none font-semibold">
                            ATRASADA
                          </Badge>
                          <span className="font-bold text-red-950 dark:text-red-200 truncate">
                            {t.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-red-700 dark:text-red-300/80 mt-1 line-clamp-1">
                          {t.notes || 'Sem observações adicionais'}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-red-700 dark:text-red-400 shrink-0">
                        Venceu {t.due_date}
                      </span>
                    </div>
                  ))}

                {/* Tarefas de Hoje */}
                {pendingTasks
                  .filter((t) => t.due_date === todayStr)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="py-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] dark:border-[#24324D]">
                            {t.type}
                          </Badge>
                          <span className="font-semibold text-[#101828] dark:text-foreground truncate">
                            {t.title}
                          </span>
                        </div>
                        {t.notes && (
                          <p className="text-[11px] text-[#667085] dark:text-muted-foreground mt-0.5 line-clamp-1">
                            {t.notes}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[#667085] dark:text-muted-foreground shrink-0">
                        Hoje {t.due_time || ''}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Oportunidades Quentes (5 cols) */}
        <Card className="lg:col-span-5 border-[#E4E7EC] dark:border-[#1E3252] bg-white dark:bg-[#0E1A2E] shadow-sm rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#101828] dark:text-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500 fill-red-500" />
              Oportunidades Quentes
            </CardTitle>
            <CardDescription className="text-xs text-[#667085] dark:text-muted-foreground">
              Negociações em fase decisiva de fechamento e proposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredOpps
                .filter((o) => o.temperature === 'Quente')
                .slice(0, 4)
                .map((opp) => (
                  <Link
                    key={opp.id}
                    to="/pipeline"
                    className="block p-3 rounded-xl border border-[#E4E7EC] dark:border-[#1E3252] bg-white dark:bg-[#12213A]/60 hover:border-[#00E8A2] dark:hover:border-[#00E8A2] transition text-xs space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#101828] dark:text-foreground truncate">
                        {opp.title}
                      </span>
                      <Badge className="bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/40 text-[9px] shrink-0">
                        Quente
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#667085] dark:text-muted-foreground">
                      <span className="truncate">{opp.stage}</span>
                      <strong className="text-[#00E8A2] font-black shrink-0 ml-2">
                        R$ {(opp.sale_value || 0).toLocaleString('pt-BR')}
                      </strong>
                    </div>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
