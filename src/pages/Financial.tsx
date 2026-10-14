import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DollarSign,
  TrendingUp,
  Award,
  Shield,
  Building2,
  Calendar,
  FileSpreadsheet,
  HelpCircle,
  Clock3,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import {
  previewConfirmedContractCommissions,
  ensureConfirmedContractForecast,
} from '@/services/commissionForecastService'
import { useAuth } from '@/contexts/AuthContext'
import type { Contract, Opportunity, AdesaoBoleto } from '@/types/crm'
import {
  ModernCommissionPanel,
  type CommissionRow,
} from '@/components/financial/ModernCommissionPanel'

export default function Financial() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [adesaoBoletos, setAdesaoBoletos] = useState<AdesaoBoleto[]>([])
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const [teamName, setTeamName] = useState<string | null>(null)
  const [meuFinanceiro, setMeuFinanceiro] = useState<FinancialCommissionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [installments, setInstallments] = useState<CommissionRow[]>([])
  const [installmentError, setInstallmentError] = useState<string | null>(null)
  const [forecastBusy, setForecastBusy] = useState<string | null>(null)
  const [forecastNotice, setForecastNotice] = useState<string | null>(null)

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

      // Carregar parcelas de acordo com a permissão RLS do usuário
      // Admin: consulta direta em commission_installments
      // Vendedor / Gestor: consulta segura via get_minhas_parcelas() ou financialService
      if (isAdmin) {
        const { data: rawInstallments, error: installmentsError } = await supabase
          .from('commission_installments')
          .select(
            'id,contract_id,numero_parcela,total_parcelas,data_vencimento,valor_previsto,valor_recebido,status',
          )
          .order('data_vencimento', { ascending: true })
          .limit(1000)

        if (installmentsError) {
          setInstallmentError(installmentsError.message)
        } else {
          setInstallments(
            (rawInstallments || []).map((p) => ({
              id: p.id,
              contract_id: p.contract_id,
              numero_parcela: p.numero_parcela,
              total_parcelas: p.total_parcelas,
              data_vencimento: p.data_vencimento,
              valor_previsto: Number(p.valor_previsto) || 0,
              valor_recebido: p.valor_recebido != null ? Number(p.valor_recebido) : null,
              status: p.status,
            })),
          )
        }
      } else {
        // Vendedor e Gestor: usar get_minhas_parcelas RPC
        try {
          const parcelasRPC = await financialService.getMinhasParcelas()
          setInstallments(
            parcelasRPC.map((p) => ({
              id: p.parcela_id,
              contract_id: p.contract_id,
              numero_parcela: p.numero_parcela,
              total_parcelas: p.total_parcelas,
              data_vencimento: p.data_vencimento,
              valor_previsto: Number(p.repasse_previsto_vendedor) || 0,
              valor_recebido:
                p.repasse_pago_vendedor != null ? Number(p.repasse_pago_vendedor) : null,
              status: p.status,
            })),
          )
        } catch (rpcErr) {
          console.warn('Erro ao consultar parcelas do usuário:', rpcErr)
          setInstallments([])
        }
      }

      // Filtragem por escopo de visibilidade
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
  // 3. COMISSÃO RECEBIDA = Somente parcelas com valor_recebido > 0 e não canceladas
  // 4. COMISSÃO PENDENTE = Saldo previsto a receber
  // 5. IMPOSTOS E REPASSES = Deduções reais
  // =========================================================================
  const totalSaleValue = useMemo(
    () => contracts.reduce((sum, c) => sum + (c.sale_value || 0), 0),
    [contracts],
  )

  const totalReceitaAdesaoPaga = useMemo(
    () =>
      adesaoBoletos
        .filter((b) => b.status === 'pago')
        .reduce((sum, b) => sum + (b.receita_bruta_kkj || 0), 0),
    [adesaoBoletos],
  )

  const totalReceitaAdesaoPendente = useMemo(
    () =>
      adesaoBoletos
        .filter((b) => b.status === 'pendente')
        .reduce((sum, b) => sum + (b.receita_bruta_kkj || 0), 0),
    [adesaoBoletos],
  )

  // Parcelas ativas (não canceladas/estornadas)
  const activeInstallments = useMemo(
    () => installments.filter((p) => p.status !== 'cancelado' && p.status !== 'estornado'),
    [installments],
  )

  // Comissão recebida efetivamente
  const totalComissaoRecebida = useMemo(
    () => activeInstallments.reduce((sum, p) => sum + (Number(p.valor_recebido) || 0), 0),
    [activeInstallments],
  )

  // Comissão pendente
  const totalComissaoPendente = useMemo(
    () =>
      activeInstallments.reduce(
        (sum, p) => sum + Math.max(0, Number(p.valor_previsto) - (Number(p.valor_recebido) || 0)),
        0,
      ),
    [activeInstallments],
  )

  // Comissão total registrada nas parcelas (ou estimativa baseada nos contratos caso não haja parcelas ainda)
  const totalComissaoPrevista = useMemo(() => {
    if (activeInstallments.length > 0) {
      return activeInstallments.reduce((sum, p) => sum + Number(p.valor_previsto), 0)
    }
    return contracts.reduce((sum, c) => sum + (c.commission_value || 0), 0)
  }, [activeInstallments, contracts])

  // Faturamento KKJ Confirmado = Comissões de parcelas recebidas + Adesão paga
  const faturamentoConfirmadoKKJ = useMemo(() => {
    return totalComissaoRecebida + totalReceitaAdesaoPaga
  }, [totalComissaoRecebida, totalReceitaAdesaoPaga])

  // Estimativa de repasse e impostos da corretora (impostos 11% sobre receita bruta)
  const aliquotaImposto = 0.11
  const impostoEstimadoKKJ = faturamentoConfirmadoKKJ * aliquotaImposto
  // Repasse aos corretores estimado em 30% a 40%
  const repasseEstimadoCorretores = faturamentoConfirmadoKKJ * 0.35
  const resultadoLiquidoKKJ = Math.max(
    0,
    faturamentoConfirmadoKKJ - impostoEstimadoKKJ - repasseEstimadoCorretores,
  )

  const registerForecast = async (contractId: string) => {
    setForecastBusy(contractId)
    setForecastNotice(null)
    try {
      const preview = await previewConfirmedContractCommissions(contractId)
      const values = preview.installments
        .map(
          (p) =>
            `Parcela ${p.numero_parcela}: ${p.data_vencimento} — R$ ${p.valor_previsto.toFixed(2)}`,
        )
        .join('\n')
      if (
        !window.confirm(
          `Gerar previsão financeira com a regra "${preview.ruleName}"?\n${values}\n\nAs parcelas serão registradas como previstas.`,
        )
      ) {
        return
      }
      await ensureConfirmedContractForecast(contractId)
      setForecastNotice('Previsão registrada com sucesso. As parcelas e resumos foram atualizados.')
      await loadData()
    } catch (error) {
      setForecastNotice(error instanceof Error ? error.message : 'Falha ao gerar previsão')
    } finally {
      setForecastBusy(null)
    }
  }

  const exportCSV = () => {
    const headers = [
      'Contrato',
      'Empresa',
      'Operadora / Produto',
      'Valor Vendido (Mensalidade)',
      'Comissão Prevista',
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-foreground">
              Financeiro & Produção
            </h2>
            {isGlobalView && (
              <Badge className="bg-[#101f42] text-white text-[10px] font-semibold">
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
          <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
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
          className="text-xs border-slate-200 dark:border-slate-800 text-slate-600 dark:text-muted-foreground hover:text-foreground"
        >
          <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Exportar Relatório
        </Button>
      </div>

      {forecastNotice && (
        <div className="p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
          {forecastNotice}
        </div>
      )}

      {/* SEÇÃO PRINCIPAL: PAINEL FINANCEIRO VERSÃO B "VISUAL MODERNO" */}
      <ModernCommissionPanel
        installments={installments}
        contracts={contracts}
        error={installmentError}
        userRole={
          isGlobalView
            ? 'Administrador Geral'
            : isGestor
              ? `Gestora (${teamName || 'Equipe'})`
              : 'Vendedora'
        }
        onGenerateForecast={isAdmin ? registerForecast : undefined}
        generatingForecastId={forecastBusy}
      />

      {/* Banner Explicativo: Distinção entre Conceitos */}
      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs space-y-2">
        <span className="font-bold text-[#101f42] dark:text-blue-300 flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Conceitos Financeiros da KK JEKABSON Corretora
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
          <div>
            <strong className="text-slate-900 dark:text-foreground block">
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
            <strong className="text-blue-900 dark:text-blue-300 block">
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
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-card shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
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
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#101f42] dark:text-blue-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-foreground">
              {totalSaleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground mt-1">
              {contracts.length} contratos autorizados
            </p>
          </CardContent>
        </Card>

        {/* CARD 2: Conforme perfil */}
        {isGlobalView ? (
          <Card className="border-orange-200 dark:border-orange-900/40 bg-orange-50/20 dark:bg-orange-950/20 shadow-sm rounded-2xl">
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
                {totalReceitaAdesaoPaga.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-[11px] text-orange-700 dark:text-orange-400 mt-1">
                {totalReceitaAdesaoPendente > 0
                  ? `+ ${totalReceitaAdesaoPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} pendentes`
                  : 'Sem boletos pendentes'}
              </p>
            </CardContent>
          </Card>
        ) : isGestor ? (
          <Card className="border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 shadow-sm rounded-2xl">
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
          <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm rounded-2xl">
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
                {(
                  meuFinanceiro?.total_repasse_previsto || totalComissaoPrevista * 0.35
                ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
                Baseada nas parcelas financeiras registradas
              </p>
            </CardContent>
          </Card>
        )}

        {/* CARD 3: Faturamento KKJ (Admin) / Produção Equipe (Gestor) / Comissão Liberada (Vendedora) */}
        {isGlobalView ? (
          <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm rounded-2xl">
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
                {faturamentoConfirmadoKKJ.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Previsto total:{' '}
                {totalComissaoPrevista.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>
        ) : isGestor ? (
          <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm rounded-2xl">
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
                {totalComissaoRecebida.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Previsto da equipe:{' '}
                {totalComissaoPrevista.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm rounded-2xl">
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
                {(meuFinanceiro?.total_repasse_pago || totalComissaoRecebida * 0.35).toLocaleString(
                  'pt-BR',
                  { style: 'currency', currency: 'BRL' },
                )}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Lançamentos já pagos em conta
              </p>
            </CardContent>
          </Card>
        )}

        {/* CARD 4: Resultado Líquido KKJ (Admin) / Resultado da Equipe (Gestor) / Pendente de Repasse (Vendedora) */}
        {isGlobalView ? (
          <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#101f42] dark:text-blue-300">
                  Resultado Líquido KKJ
                </span>
                <p className="text-[10px] text-slate-500 dark:text-blue-400">
                  Após impostos (11%) e repasses
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#101f42] dark:bg-primary text-white">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-[#101f42] dark:text-foreground">
                {resultadoLiquidoKKJ.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-muted-foreground mt-1">
                Repasses estimados:{' '}
                {repasseEstimadoCorretores.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>
        ) : isGestor ? (
          <Card className="border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-950/20 shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                  Saldo a Receber da Equipe
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
                {totalComissaoPendente.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-muted-foreground mt-1">
                Restrito aos contratos sob sua supervisão
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm rounded-2xl">
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
                {(
                  meuFinanceiro?.total_repasse_pendente || totalComissaoPendente * 0.35
                ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
        <div className="bg-white dark:bg-card border border-orange-200 dark:border-orange-900/40 rounded-2xl overflow-x-auto shadow-sm">
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
      <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-foreground">
              Contratos & Vendas Fechadas
            </h3>
            <p className="text-xs text-slate-500 dark:text-muted-foreground">
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
          <div className="p-8 text-center text-xs text-slate-500 dark:text-muted-foreground">
            Nenhum contrato consolidado até o momento.
          </div>
        ) : (
          <Table className="min-w-[680px]">
            <TableHeader className="bg-[#F5F7FA] dark:bg-muted/50">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-foreground">
                  Contrato
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-foreground">
                  Empresa / Cliente
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-foreground">
                  Operadora / Produto
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-foreground">
                  Vidas
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-foreground">
                  Valor da Venda
                </TableHead>
                <TableHead className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
                  Faturamento KKJ
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id} className="text-xs">
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-foreground">
                    {c.contract_number || 'KKJ-CONTRATO'}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 dark:text-foreground">
                    {c.expand?.company_id?.trade_name || 'Empresa Direta'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 dark:text-foreground">
                        {c.contracted_carrier_name ||
                          c.operator ||
                          c.expand?.carrier_id?.nome ||
                          c.expand?.carrier_id?.nome_curto || (
                            <span className="text-amber-600 dark:text-amber-400 italic">
                              Operadora não informada
                            </span>
                          )}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-muted-foreground">
                        {c.contracted_plan_name || c.plano || c.expand?.product_id?.name || (
                          <span className="text-slate-400 italic">Plano a definir</span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-foreground">
                    {c.lives_count || 1} vidas
                  </TableCell>
                  <TableCell className="font-extrabold text-[#101f42] dark:text-primary">
                    {c.sale_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell className="font-extrabold text-emerald-700 dark:text-emerald-400">
                    {c.commission_value == null
                      ? 'A conciliar'
                      : c.commission_value.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
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
