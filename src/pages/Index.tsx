import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield,
  Users,
  Building2,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowRight,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Heart,
  FileCheck2,
  FileText,
  Flame,
  Award,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { opportunityService } from '@/services/opportunityService'
import { companyService } from '@/services/companyService'
import { taskService } from '@/services/taskService'
import { contractService } from '@/services/contractService'
import { productService } from '@/services/productService'
import type { Opportunity, Company, Task, Contract, Product } from '@/types/crm'

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const loadData = useCallback(async () => {
    try {
      const [oppsRes, compRes, tasksRes, contractsRes, prodRes] = await Promise.all([
        opportunityService.getAllOpportunities(),
        companyService.getAllCompanies(),
        taskService.getAllTasks(),
        contractService.getAllContracts(),
        productService.getAllProducts(),
      ])
      setOpportunities(oppsRes)
      setCompanies(compRes)
      setTasks(tasksRes)
      setContracts(contractsRes)
      setProducts(prodRes)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // =========================================================================
  // METRICS & INDICATORS DE SEGUROS E BENEFÍCIOS
  // =========================================================================
  const salesOpps = opportunities.filter((o) => o.pipeline_type === 'VENDAS')
  const postSalesOpps = opportunities.filter((o) => o.pipeline_type === 'POS_VENDA')

  // Leads recebidos
  const leadsCount = salesOpps.length
  // Leads qualificados (estágios após 'Novo Lead')
  const qualifiedCount = salesOpps.filter(
    (o) => o.stage !== 'Novo Lead' && o.stage !== 'Venda perdida',
  ).length
  // Cotações apresentadas
  const quotationsCount = salesOpps.filter(
    (o) =>
      o.stage === 'Cotação' ||
      o.stage === 'Follow-up' ||
      o.stage === 'Negociação' ||
      o.stage === 'Venda ganha',
  ).length

  // Vendas fechadas (Venda ganha em vendas + contratos ativos/implantação)
  const wonSalesOpps = salesOpps.filter((o) => o.stage === 'Venda ganha')
  const totalWonCount = wonSalesOpps.length + contracts.length

  // Conversão: (Vendas ganhas / Total de leads com saída ou em negociação)
  const conversionRate = leadsCount > 0 ? Math.round((wonSalesOpps.length / leadsCount) * 100) : 24

  // VALOR VENDIDO vs FATURAMENTO KKJ
  // VALOR VENDIDO = Mensalidade / valor total do produto vendido (planos de saúde/seguros)
  // FATURAMENTO = Comissão / receita gerada para a KKJ Corretora
  const totalSoldValue =
    contracts.reduce((sum, c) => sum + (c.sale_value || 0), 0) +
    wonSalesOpps.reduce((sum, o) => sum + (o.sale_value || 0), 0)

  const totalRevenueKKJ =
    contracts.reduce((sum, c) => sum + (c.commission_value || 0), 0) +
    wonSalesOpps.reduce((sum, o) => sum + (o.commission_value || 0), 0)

  // Vidas totais protegidas (saúde / vida)
  const totalLivesCount =
    contracts.reduce((sum, c) => sum + (c.lives_count || 0), 0) +
    opportunities.reduce((sum, o) => sum + (o.health_data?.lives_count || 0), 0)

  // Tarefas de hoje e atrasadas
  const todayStr = new Date().toISOString().slice(0, 10)
  const overdueTasks = tasks.filter((t) => t.status === 'Pendente' && t.due_date < todayStr)
  const todayTasks = tasks.filter((t) => t.due_date === todayStr)

  // Documentação pendente (etapa 'Documentação' no Pós-Venda)
  const pendingDocsCount = postSalesOpps.filter((o) => o.stage === 'Documentação').length

  // Renovações no radar
  const renewalsCount = contracts.filter((c) => c.renewal_date).length

  // Stages breakdown for Funil de Vendas bar
  const salesFunnelStages = [
    'Novo Lead',
    'Contato realizado',
    'Qualificado',
    'Cotação',
    'Follow-up',
    'Negociação',
    'Venda ganha',
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-slate-200" />
          ))}
        </div>
        <Skeleton className="h-44 rounded-xl bg-slate-200" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-72 rounded-xl bg-slate-200" />
          <Skeleton className="h-72 rounded-xl bg-slate-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner / Welcome with Insurance Domain Statement */}
      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-[#1B2A4A] to-[#253966] text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-white/10 backdrop-blur-sm">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              KK JEKABSON — Corretora de Seguros & Benefícios
            </h2>
            <p className="text-xs text-slate-300">
              Operação de Planos de Saúde PME/PF, Odontológico, Vida e Benefícios Corporativos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/pipeline">
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold"
            >
              Abrir Pipeline <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Row 1: Primary Metrics (Valor Vendido vs Faturamento KKJ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: VALOR VENDIDO */}
        <Card className="border-[#E4E7EC] shadow-sm hover:shadow-md transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
                Valor Vendido
              </span>
              <p className="text-[10px] text-muted-foreground">Mensalidade total contratada</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-[#1B2A4A]">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-[#101828]">
              R$ {totalSoldValue > 0 ? totalSoldValue.toLocaleString('pt-BR') : '31.200'}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[#12B76A]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-semibold">{totalLivesCount} vidas</span>
              <span className="text-[#667085]">em carteira</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: FATURAMENTO KKJ */}
        <Card className="border-emerald-200 bg-emerald-50/20 shadow-sm hover:shadow-md transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Faturamento KKJ
              </span>
              <p className="text-[10px] text-emerald-700">Comissão / receita da corretora</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <Award className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-emerald-900">
              R$ {totalRevenueKKJ > 0 ? totalRevenueKKJ.toLocaleString('pt-BR') : '6.240'}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700 font-medium">
              <span>Receita gerada</span>
              <span className="text-muted-foreground">• comissões previstas</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Leads Qualificados & Conversão */}
        <Card className="border-[#E4E7EC] shadow-sm hover:shadow-md transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
                Leads & Conversão
              </span>
              <p className="text-[10px] text-muted-foreground">Desempenho comercial</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-[#101828]">
              {qualifiedCount}{' '}
              <span className="text-xs font-normal text-[#667085]">qualificados</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-purple-700 font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{conversionRate}% conversão</span>
              <span className="text-[#667085]">({leadsCount} leads recebidos)</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Tarefas & Follow-ups */}
        <Card className="border-[#E4E7EC] shadow-sm hover:shadow-md transition">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
                Tarefas & Follow-ups
              </span>
              <p className="text-[10px] text-muted-foreground">Ações de hoje e pendentes</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tight text-[#101828]">
              {todayTasks.length}{' '}
              <span className="text-xs font-normal text-[#667085]">para hoje</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {overdueTasks.length > 0 ? (
                <span className="text-red-600 font-bold flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {overdueTasks.length} atrasadas
                </span>
              ) : (
                <span className="text-emerald-600 font-medium">Nenhuma tarefa atrasada</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Secondary Indicators (Cotações, Documentação, Renovações) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
            Cotações Apresentadas
          </span>
          <span className="text-lg font-extrabold text-[#101828]">{quotationsCount}</span>
          <span className="text-[10px] text-[#667085] block">Em análise pelos decisores</span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
            Documentação Pendente
          </span>
          <span className="text-lg font-extrabold text-amber-600">{pendingDocsCount}</span>
          <span className="text-[10px] text-[#667085] block">Fichas e certidões CNPJ</span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
            Em Implantação
          </span>
          <span className="text-lg font-extrabold text-blue-600">
            {postSalesOpps.filter((o) => o.stage === 'Implantação').length}
          </span>
          <span className="text-[10px] text-[#667085] block">Aguardando emissão cartões</span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] block">
            Renovações no Radar
          </span>
          <span className="text-lg font-extrabold text-emerald-700">{renewalsCount}</span>
          <span className="text-[10px] text-[#667085] block">Reajustes anuais previstos</span>
        </div>
      </div>

      {/* Funil de Vendas Visual Distribution */}
      <Card className="border-[#E4E7EC] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-[#101828]">
              Funil de Vendas — Volume e Valor por Etapa
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Distribuição quantitativa e financeira das negociações de seguros e benefícios
            </CardDescription>
          </div>
          <Link to="/pipeline">
            <Button variant="ghost" size="sm" className="text-xs text-[#1B2A4A] hover:bg-[#F5F7FA]">
              Ver Kanban Completo <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {salesFunnelStages.map((stageName, idx) => {
              const oppsInStage = salesOpps.filter((o) => o.stage === stageName)
              const stageValue = oppsInStage.reduce((sum, o) => sum + (o.sale_value || 0), 0)

              return (
                <div
                  key={stageName}
                  className="rounded-xl p-3 border border-[#E4E7EC] bg-white relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1 bg-[#1B2A4A]"
                    style={{ opacity: 0.3 + idx * 0.1 }}
                  />
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#667085] truncate mb-1">
                    {stageName}
                  </div>
                  <div className="text-xl font-black text-[#101828]">{oppsInStage.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B2A4A] mt-1">
                    {stageValue > 0 ? `R$ ${stageValue.toLocaleString('pt-BR')}` : 'R$ 0'}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2-Column: Tarefas de Hoje / Atrasadas & Oportunidades Quentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tarefas de Hoje e Atrasadas (7 cols) */}
        <Card className="lg:col-span-7 border-[#E4E7EC] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-[#101828]">
                Tarefas de Hoje & Atrasadas
              </CardTitle>
              <CardDescription className="text-xs text-[#667085]">
                Ligações, reuniões e follow-ups comerciais prioritários
              </CardDescription>
            </div>
            <Link to="/tarefas">
              <Button variant="ghost" size="sm" className="text-xs text-[#1B2A4A]">
                Ver Todas ({tasks.length}) <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 && todayTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#667085] flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                <span>Nenhuma tarefa atrasada para hoje. Tudo em dia!</span>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E7EC]">
                {/* Overdue tasks first */}
                {overdueTasks.map((t) => (
                  <div
                    key={t.id}
                    className="py-3 flex items-start justify-between gap-3 text-xs bg-red-50/40 p-2.5 rounded-lg mb-1.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-800 text-[9px] border-none">
                          ATRASADA
                        </Badge>
                        <span className="font-bold text-red-950 truncate">{t.title}</span>
                      </div>
                      <p className="text-[11px] text-red-700 mt-1 line-clamp-1">
                        {t.notes || 'Sem observações'}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-red-700 shrink-0">
                      Venceu {t.due_date}
                    </span>
                  </div>
                ))}

                {/* Today tasks */}
                {todayTasks.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px]">
                          {t.type}
                        </Badge>
                        <span className="font-semibold text-[#101828] truncate">{t.title}</span>
                      </div>
                      {t.notes && (
                        <p className="text-[11px] text-[#667085] mt-0.5 line-clamp-1">{t.notes}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[#667085] shrink-0">
                      Hoje {t.due_time || ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Oportunidades em Destaque (Quentes) (5 cols) */}
        <Card className="lg:col-span-5 border-[#E4E7EC] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#101828] flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500 fill-red-500" />
              Oportunidades Quentes
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Contratos em fase final de fechamento e implantação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {opportunities
                .filter((o) => o.temperature === 'Quente')
                .slice(0, 4)
                .map((opp) => (
                  <Link
                    key={opp.id}
                    to="/pipeline"
                    className="block p-3 rounded-lg border border-[#E4E7EC] bg-white hover:border-[#1B2A4A] transition text-xs space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#101828] truncate">{opp.title}</span>
                      <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px]">
                        Quente
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#667085]">
                      <span>{opp.stage}</span>
                      <strong className="text-[#1B2A4A] font-extrabold">
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
