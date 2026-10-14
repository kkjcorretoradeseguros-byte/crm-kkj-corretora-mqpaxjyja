import React, { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  TrendingUp,
  Award,
  Shield,
  Building2,
  Calendar,
  Lock,
  FileSpreadsheet,
  FileCheck2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase/client'
import { contractService } from '@/services/contractService'
import { opportunityService } from '@/services/opportunityService'
import { adesaoService } from '@/services/adesaoService'
import { teamService } from '@/services/teamService'
import { financialService, type FinancialCommissionSummary } from '@/services/financialService'
import { useAuth } from '@/contexts/AuthContext'
import { ModernCommissionPanel } from '@/components/financial/ModernCommissionPanel'
import type { Contract, Opportunity, AdesaoBoleto } from '@/types/crm'

export default function Financial() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [adesaoBoletos, setAdesaoBoletos] = useState<AdesaoBoleto[]>([])
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const [teamName, setTeamName] = useState<string | null>(null)
  const [meuFinanceiro, setMeuFinanceiro] = useState<FinancialCommissionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminInstallments, setAdminInstallments] = useState<
    Array<{
      id: string
      contract_id: string
      numero_parcela: number
      total_parcelas: number
      data_vencimento: string
      valor_previsto: number
      valor_recebido: number | null
      status: string
    }>
  >([])
  const [installmentError, setInstallmentError] = useState<string | null>(null)

  const normalizedRole = user?.role?.toUpperCase()
  const isSeller = normalizedRole === 'VENDEDOR'
  const isGestor = normalizedRole === 'GESTOR'
  const isAdmin = normalizedRole === 'ADMINISTRADOR'
  const isGlobalView = isAdmin

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [contractsRes, oppsRes, boletosRes, financeiroRes] = await Promise.all([
        contractService.getAllContracts(),
        opportunityService.getAllOpportunities(),
        adesaoService.getBoletos(),
        financialService.getMeuFinanceiro().catch(() => null),
      ])

      setMeuFinanceiro(financeiroRes)
      if (isAdmin) {
        const { data: installments, error: installmentsError } = await supabase
          .from('commission_installments')
          .select(
            'id,contract_id,numero_parcela,total_parcelas,data_vencimento,valor_previsto,valor_recebido,status',
          )
          .order('data_vencimento', { ascending: true })
          .limit(500)
        setAdminInstallments(installments || [])
        setInstallmentError(installmentsError?.message || null)
      }

      // Vendedor vê APENAS os próprios contratos (RLS também restringe no banco).
      // Gestor vê somente a própria produção + produção consolidada da equipe.
      // Administrador vê tudo (visão global da corretora).
      if (isSeller && user?.id) {
        setContracts(contractsRes.filter((c) => c.assigned_to === user.id))
        setOpportunities(oppsRes.filter((o) => o.assigned_to === user.id))
        setAdesaoBoletos(boletosRes.filter((b) => b.vendedor_id === user.id))
        setTeamMemberIds([user.id])
        setTeamName(null)
      } else if (isGestor && user?.id) {
        try {
          const teams = await teamService.getMyTeams()
          const minhaEquipe = teams[0]
          const members = minhaEquipe ? await teamService.getTeamMembers(minhaEquipe.id) : []
          const memberIds = Array.from(new Set([user.id, ...members.map((m) => m.vendedor_id)]))
          setTeamMemberIds(memberIds)
          setTeamName(minhaEquipe?.nome || null)
          setContracts(contractsRes.filter((c) => memberIds.includes(c.assigned_to || '')))
          setOpportunities(
            oppsRes.filter(
              (o) => memberIds.includes(o.assigned_to || '') || o.created_by === user.id,
            ),
          )
          setAdesaoBoletos(boletosRes.filter((b) => memberIds.includes(b.vendedor_id || '')))
        } catch {
          // Sem equipe acessível: fica só com a carteira própria
          setTeamMemberIds([user.id])
          setTeamName(null)
          setContracts(contractsRes.filter((c) => c.assigned_to === user.id))
          setOpportunities(oppsRes.filter((o) => o.assigned_to === user.id))
          setAdesaoBoletos(boletosRes.filter((b) => b.vendedor_id === user.id))
        }
      } else {
        setContracts(contractsRes)
        setOpportunities(oppsRes)
        setAdesaoBoletos(boletosRes)
        setTeamMemberIds([])
        setTeamName(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [isSeller, isGestor, isAdmin, user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // =========================================================================
  // SEPARAÇÃO CONCEITUAL E FINANCEIRA RIGOROSA:
  // 1. VALOR VENDIDO = Mensalidades de contratos fechados
  // 2. RECEITA BRUTA DE ADESÃO = Boletos pagos da 1ª mensalidade 100% KKJ
  // 3. COMISSÃO PREVISTA DE VENDAS FECHADAS ≠ COMISSÃO RECEBIDA
  // 4. NÃO ANTECIPAR COMISSÕES / NÃO PRESUMIR RECEBIMENTOS
  // =========================================================================
  const totalSaleValue = contracts.reduce((sum, c) => sum + (c.sale_value || 0), 0)
  const totalReceitaAdesaoPaga = adesaoBoletos
    .filter((b) => b.status === 'pago')
    .reduce((sum, b) => sum + (b.receita_bruta_kkj || 0), 0)
  const totalReceitaAdesaoPendente = adesaoBoletos
    .filter((b) => b.status === 'pendente')
    .reduce((sum, b) => sum + (b.receita_bruta_kkj || 0), 0)

  const totalComissaoPrevista = isAdmin
    ? adminInstallments.reduce((sum, row) => sum + Number(row.valor_previsto || 0), 0)
    : contracts.reduce((sum, c) => sum + (c.commission_value || 0), 0)
  const totalComissaoRecebida = adminInstallments.reduce((sum, row) => sum + Number(row.valor_recebido || 0), 0)
  const totalComissaoAReceber = Math.max(0, totalComissaoPrevista - totalComissaoRecebida)
  // Contrato ativo não comprova recebimento de comissão. Valores recebidos e margem
  // exigem conciliação com lançamentos financeiros confirmados no banco.

  const exportCSV = () => {
    const headers = [
      'Contrato',
      'Empresa',
      'Operadora / Produto',
      'Valor Vendido (Mensalidade)',
      'Comissão prevista (não conciliada)',
      'Vidas',
      'Status',
    ]
    const rows = contracts.map((c) => [
      `"${c.contract_number || c.id}"`,
      `"${c.expand?.company_id?.trade_name || ''}"`,
      `"${c.operator || c.expand?.product_id?.name || ''}"`,
      c.sale_value,
      c.commission_value == null ? 'A conciliar' : c.commission_value,
      c.lives_count || 1,
      `"${c.status}"`,
    ])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `financeiro_kkj_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8">
      {isAdmin && (
        <ModernCommissionPanel
          installments={adminInstallments}
          contracts={contracts}
          error={installmentError}
        />
      )}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white dark:bg-card border border-[#E4E7EC] dark:border-[#24324D] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[#101828] dark:text-foreground">
              Financeiro & Produção
            </h2>
            {isGlobalView && (
              <Badge className="bg-[#1B2A4A] text-white text-[10px] font-semibold">
                Visão Global Administrador
              </Badge>
            )}
            {isGestor && (
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-semibold">
                Visão da Equipe{teamName ? `: ${teamName}` : ''}
              </Badge>
            )}
            {isSeller && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-semibold">
                Carteira Pessoal
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#667085] dark:text-muted-foreground mt-0.5">
            {isGlobalView
              ? 'Gestão financeira global KKJ: faturamento, impostos, repasses, comissões e resultado líquido da corretora.'
              : isGestor
                ? `Produção e repasses consolidados da ${teamName ? `Equipe ${teamName}` : 'sua equipe'} e carteira própria. Restrito ao escopo da equipe.`
                : 'Visão estritamente pessoal da sua carteira: valor vendido, comissão prevista, recebida e a repassar.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          className="text-xs border-[#E4E7EC] dark:border-[#24324D] text-[#667085] dark:text-muted-foreground hover:text-foreground"
        >
          <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Exportar Relatório
        </Button>
      </div>

      {/* Explanatory Banner: Distinction between Concepts */}
      <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs space-y-2">
        <span className="font-bold text-[#1B2A4A] dark:text-blue-300 flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Conceitos Financeiros da KK JEKABSON Corretora
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-[11px] text-[#475467] dark:text-slate-300">
          <div>
            <strong className="text-[#101828] dark:text-foreground block">
              Valor da Venda (Mensalidade)
            </strong>
            <span>Total da fatura mensal paga pelo cliente/empresa à operadora.</span>
          </div>
          <div>
            <strong className="text-emerald-800 dark:text-emerald-300 block">
              Faturamento KKJ
            </strong>
            <span>Comissão e receita bruta recebida pela corretora das operadoras.</span>
          </div>
          <div>
            <strong className="text-purple-800 dark:text-purple-300 block">
              {isSeller ? 'Sua Comissão' : 'Comissão dos Corretores'}
            </strong>
            <span>Repasse ao corretor responsável pelo fechamento do contrato.</span>
          </div>
          <div>
            <strong className="text-[#1B2A4A] dark:text-blue-300 block">
              {isGlobalView
                ? 'Resultado Líquido KKJ'
                : isGestor
                  ? 'Margem Líquida da Equipe'
                  : 'Seu Saldo Repassado'}
            </strong>
            <span>
              {isGlobalView
                ? 'Margem líquida da corretora após repasses e impostos.'
                : isGestor
                  ? 'Margem dos contratos fechados no âmbito da sua equipe.'
                  : 'Total de comissões liberadas e repassadas a você.'}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Metrics Cards: Separados e Não Conflitantes, por perfil */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Valor Vendido */}
        <Card className="border-[#E4E7EC] dark:border-[#24324D] bg-white dark:bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#667085] dark:text-muted-foreground">
                {isGlobalView
                  ? 'Valor Vendido Global'
                  : isGestor
                    ? 'Valor Vendido (Equipe)'
                    : 'Meu Valor Vendido'}
              </span>
              <p className="text-[10px] text-muted-foreground">
                {isGlobalView
                  ? 'Mensalidades totais da corretora'
                  : isGestor
                    ? 'Mensalidades da equipe + própria'
                    : 'Mensalidades da sua carteira'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#1B2A4A] dark:text-blue-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-[#101828] dark:text-foreground">
              R$ {totalSaleValue.toLocaleString('pt-BR')}
            </div>
            <p className="text-[11px] text-[#667085] dark:text-muted-foreground mt-1">
              {contracts.length} contratos autorizados
            </p>
          </CardContent>
        </Card>

        {/* CARD 2: Conforme perfil */}
        {isGlobalView ? (
          <Card className="border-orange-200 dark:border-orange-900/40 bg-orange-50/20 dark:bg-orange-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">
                  Receita Adesão 100% KKJ
                </span>
                <p className="text-[10px] text-orange-700 dark:text-orange-400">
                  1ª mensalidade integral retida
                </p>
              </div>
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300">
                <Award className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-orange-900 dark:text-orange-200">
                R$ {totalReceitaAdesaoPaga.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-orange-700 dark:text-orange-400 mt-1">
                {totalReceitaAdesaoPendente > 0
                  ? `+ R$ ${totalReceitaAdesaoPendente.toLocaleString('pt-BR')} pendentes`
                  : 'Sem boletos pendentes'}
              </p>
            </CardContent>
          </Card>
        ) : isGestor ? (
          <Card className="border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                  Comissão de Gestão
                </span>
                <p className="text-[10px] text-purple-700 dark:text-purple-400">
                  Regra configurável da equipe
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300">
                <Award className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-purple-900 dark:text-purple-200">
                R$ 0,00
              </div>
              <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-1">
                Comissão de gestão desativada (0%)
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Comissão Pessoal Prevista
                </span>
                <p className="text-[10px] text-blue-700 dark:text-blue-400">
                  Total a ser repassado
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-blue-900 dark:text-blue-200">
                R${' '}
                {(meuFinanceiro ? meuFinanceiro.total_repasse_previsto : 0).toLocaleString(
                  'pt-BR',
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                )}
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
                Baseada nas parcelas financeiras registradas
              </p>
            </CardContent>
          </Card>
        )}

        {/* CARD 3: Faturamento KKJ (Admin) / Produção Equipe (Gestor) / Comissão Liberada (Vendedora) */}
        {isGlobalView ? (
          <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Faturamento KKJ Confirmado
                </span>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Comissões recebidas + Adesão paga
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                {totalComissaoRecebida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                A receber: {totalComissaoAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </CardContent>
          </Card>
        ) : isGestor ? (
          <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Produção Confirmada (Equipe)
                </span>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Contratos ativos no escopo da equipe
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                A conciliar
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Previsto da equipe: R$ {totalComissaoPrevista.toLocaleString('pt-BR')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Comissão Recebida / Liberada
                </span>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Valores repassados e pagos
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                <Shield className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
                R${' '}
                {(meuFinanceiro ? meuFinanceiro.total_repasse_pago : 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Lançamentos já pagos em conta
              </p>
            </CardContent>
          </Card>
        )}

        {/* CARD 4: Resultado Líquido KKJ (Admin) / Resultado da Equipe (Gestor) / Pendente de Repasse (Vendedora) */}
        {isGlobalView ? (
          <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A4A] dark:text-blue-300">
                  Resultado Líquido Global KKJ
                </span>
                <p className="text-[10px] text-[#1B2A4A]/80 dark:text-blue-400">
                  Após impostos (11%) e comissões dos corretores
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#1B2A4A] dark:bg-primary text-white">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-[#1B2A4A] dark:text-foreground">
                A conciliar
              </div>
              <p className="text-[11px] text-[#667085] dark:text-muted-foreground mt-1">
                Comissões repassadas: A conciliar
              </p>
            </CardContent>
          </Card>
        ) : isGestor ? (
          <Card className="border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                  Resultado Consolidado da Equipe
                </span>
                <p className="text-[10px] text-purple-700 dark:text-purple-400">
                  Exclusivo para {teamName ? `Equipe ${teamName}` : 'sua equipe'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-700 text-white">
                <Building2 className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-purple-950 dark:text-foreground">
                A conciliar
              </div>
              <p className="text-[11px] text-[#667085] dark:text-muted-foreground mt-1">
                Restrito aos contratos sob sua supervisão
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Pendente de Repasse
                </span>
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  A receber das próximas parcelas
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-600 text-white">
                <Calendar className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-amber-950 dark:text-foreground">
                R${' '}
                {(meuFinanceiro
                  ? meuFinanceiro.total_repasse_pendente
                  : totalSaleValue * 0.4
                ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                {meuFinanceiro?.parcelas_a_vencer || 0} parcelas programadas
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela de Boletos de Adesão (100% KKJ) */}
      {adesaoBoletos.length > 0 && (
        <div className="bg-white dark:bg-card border border-orange-200 dark:border-orange-900/40 rounded-xl overflow-x-auto shadow-sm">
          <div className="p-4 border-b border-orange-100 dark:border-orange-900/30 bg-orange-50/30 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-orange-600" />
                Gestão de Boletos de Adesão (1ª Mensalidade 100% KKJ)
              </h3>
              <p className="text-xs text-orange-700/80 dark:text-orange-400">
                1ª mensalidade gerada pela KKJ sem repasse à operadora
              </p>
            </div>
            <Badge variant="outline" className="border-orange-300 text-orange-800 text-xs">
              {adesaoBoletos.length} boletos
            </Badge>
          </div>

          <Table className="min-w-[680px]">
            <TableHeader className="bg-[#F5F7FA]">
              <TableRow>
                <TableHead className="text-xs font-bold">Contrato</TableHead>
                <TableHead className="text-xs font-bold">Valor Integral (100% KKJ)</TableHead>
                <TableHead className="text-xs font-bold">Vencimento</TableHead>
                <TableHead className="text-xs font-bold">Comissão Vendedor (30% Líq.)</TableHead>
                <TableHead className="text-xs font-bold">Resultado Líquido KKJ</TableHead>
                <TableHead className="text-xs font-bold">Status</TableHead>
                <TableHead className="text-xs font-bold text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adesaoBoletos.map((b) => (
                <TableRow key={b.id} className="text-xs">
                  <TableCell className="font-mono font-bold">{b.contract_id.slice(0, 8)}</TableCell>
                  <TableCell className="font-black text-orange-900">
                    R$ {b.valor_integral.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>{b.data_vencimento}</TableCell>
                  <TableCell className="font-semibold text-purple-700">
                    R$ {b.comissao_vendedor_valor.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-bold text-emerald-700">
                    R$ {b.resultado_liquido_corretora.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        b.status === 'pago'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }
                    >
                      {b.status === 'pago' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {b.status === 'pendente' && isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await adesaoService.confirmarPagamento(b.id)
                          loadData()
                        }}
                        className="h-6 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        Confirmar Pgto
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Production / Contracts Table */}
      <div className="bg-white dark:bg-card border border-[#E4E7EC] dark:border-[#24324D] rounded-xl overflow-x-auto shadow-sm">
        <div className="p-4 border-b border-[#E4E7EC] dark:border-[#24324D] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#101828] dark:text-foreground">
              Contratos & Vendas Fechadas
            </h3>
            <p className="text-xs text-[#667085] dark:text-muted-foreground">
              Relação de contratos gerados a partir do Funil de Vendas (Venda Ganha)
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {contracts.length} contratos
          </Badge>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-slate-100 dark:bg-muted" />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#667085] dark:text-muted-foreground">
            Nenhum contrato consolidado até o momento.
          </div>
        ) : (
          <Table className="min-w-[680px]">
            <TableHeader className="bg-[#F5F7FA] dark:bg-muted/50">
              <TableRow>
                <TableHead className="text-xs font-bold text-[#101828] dark:text-foreground">
                  Contrato
                </TableHead>
                <TableHead className="text-xs font-bold text-[#101828] dark:text-foreground">
                  Empresa / Cliente
                </TableHead>
                <TableHead className="text-xs font-bold text-[#101828] dark:text-foreground">
                  Operadora / Produto
                </TableHead>
                <TableHead className="text-xs font-bold text-[#101828] dark:text-foreground">
                  Vidas
                </TableHead>
                <TableHead className="text-xs font-bold text-[#101828] dark:text-foreground">
                  Valor da Venda
                </TableHead>
                <TableHead className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
                  Faturamento KKJ
                </TableHead>
                <TableHead className="text-xs font-bold text-[#101828] dark:text-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id} className="text-xs">
                  <TableCell className="font-mono font-bold text-[#101828] dark:text-foreground">
                    {c.contract_number || 'KKJ-CONTRATO'}
                  </TableCell>
                  <TableCell className="font-semibold text-[#101828] dark:text-foreground">
                    {c.expand?.company_id?.trade_name || 'Empresa Direta'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#101828] dark:text-foreground">
                        {c.contracted_carrier_name ||
                          c.operator ||
                          c.expand?.carrier_id?.nome ||
                          c.expand?.carrier_id?.nome_curto || (
                            <span className="text-amber-600 dark:text-amber-400 italic">
                              Operadora não informada
                            </span>
                          )}
                      </span>
                      <span className="text-[10px] text-[#667085] dark:text-muted-foreground">
                        {c.contracted_plan_name || c.plano || c.expand?.product_id?.name || (
                          <span className="text-slate-400 italic">Plano a definir</span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-[#101828] dark:text-foreground">
                    {c.lives_count || 1} vidas
                  </TableCell>
                  <TableCell className="font-extrabold text-[#1B2A4A] dark:text-primary">
                    R$ {c.sale_value.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-extrabold text-emerald-700 dark:text-emerald-400">
                    {c.commission_value == null
                      ? 'A conciliar'
                      : 'R$ ' + c.commission_value.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40 text-[10px]"
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
