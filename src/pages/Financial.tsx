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
import { contractService } from '@/services/contractService'
import { opportunityService } from '@/services/opportunityService'
import { adesaoService } from '@/services/adesaoService'
import { useAuth } from '@/contexts/AuthContext'
import type { Contract, Opportunity, AdesaoBoleto } from '@/types/crm'

export default function Financial() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [adesaoBoletos, setAdesaoBoletos] = useState<AdesaoBoleto[]>([])
  const [loading, setLoading] = useState(true)

  const isSeller = user?.role === 'VENDEDOR'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [contractsRes, oppsRes, boletosRes] = await Promise.all([
        contractService.getAllContracts(),
        opportunityService.getAllOpportunities(),
        adesaoService.getBoletos(),
      ])

      // Vendedor vê apenas contratos e oportunidades da sua própria carteira
      if (isSeller && user?.id) {
        setContracts(contractsRes.filter((c) => c.assigned_to === user.id))
        setOpportunities(oppsRes.filter((o) => o.assigned_to === user.id))
        setAdesaoBoletos(boletosRes.filter((b) => b.vendedor_id === user.id))
      } else {
        setContracts(contractsRes)
        setOpportunities(oppsRes)
        setAdesaoBoletos(boletosRes)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [isSeller, user?.id])

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

  const totalComissaoPrevista = contracts.reduce((sum, c) => sum + (c.commission_value || 0), 0)
  const totalComissaoRecebida = contracts
    .filter((c) => c.status === 'Ativo')
    .reduce((sum, c) => sum + (c.commission_value || 0), 0)

  // Faturamento KKJ Realmente Recebido = Comissões Confirmadas + Adesão Paga
  const faturamentoKKJConfirmado = totalComissaoRecebida + totalReceitaAdesaoPaga
  // Comissão repassada ao vendedor
  const totalComissaoVendedor = faturamentoKKJConfirmado * 0.4
  // Resultado líquido da corretora
  const totalResultadoKKJ = faturamentoKKJConfirmado - totalComissaoVendedor

  const exportCSV = () => {
    const headers = [
      'Contrato',
      'Empresa',
      'Operadora / Produto',
      'Valor Vendido (Mensalidade)',
      'Faturamento KKJ',
      'Vidas',
      'Status',
    ]
    const rows = contracts.map((c) => [
      `"${c.contract_number || c.id}"`,
      `"${c.expand?.company_id?.trade_name || ''}"`,
      `"${c.operator || c.expand?.product_id?.name || ''}"`,
      c.sale_value,
      c.commission_value || 0,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white dark:bg-card border border-[#E4E7EC] dark:border-[#24324D] shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#101828] dark:text-foreground">
            Financeiro & Produção
          </h2>
          <p className="text-xs text-[#667085] dark:text-muted-foreground">
            {isSeller
              ? 'Visão restrita da sua carteira comercial pessoal'
              : 'Gestão consolidada de produção, comissões, faturamento e resultado KKJ'}
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
              Comissão do Vendedor
            </strong>
            <span>Repasse ao corretor responsável pelo fechamento do contrato.</span>
          </div>
          <div>
            <strong className="text-[#1B2A4A] dark:text-blue-300 block">Resultado KKJ</strong>
            <span>Margem líquida da corretora após repasses de comissão.</span>
          </div>
        </div>
      </div>

      {/* Financial Metrics Cards: Separados e Não Conflitantes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Valor Vendido (Mensalidades dos Contratos Fechados) */}
        <Card className="border-[#E4E7EC] dark:border-[#24324D] bg-white dark:bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#667085] dark:text-muted-foreground">
                Valor Vendido
              </span>
              <p className="text-[10px] text-muted-foreground">
                Mensalidades de contratos fechados
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
              Contratos ativos e em implantação
            </p>
          </CardContent>
        </Card>

        {/* 2. Receita Bruta de Adesão (100% KKJ) */}
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

        {/* 3. Faturamento KKJ (Confirmado vs Previsto) */}
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
              R$ {faturamentoKKJConfirmado.toLocaleString('pt-BR')}
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
              Previsto: R$ {totalComissaoPrevista.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        {/* 4. Resultado Líquido KKJ */}
        {!isSeller ? (
          <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A4A] dark:text-blue-300">
                  Resultado Líquido KKJ
                </span>
                <p className="text-[10px] text-[#1B2A4A]/80 dark:text-blue-400">
                  Após impostos e comissões dos corretores
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#1B2A4A] dark:bg-primary text-white">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-[#1B2A4A] dark:text-foreground">
                R$ {totalResultadoKKJ.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-[#667085] dark:text-muted-foreground mt-1">
                Comissões pagas aos vendedores: R$ {totalComissaoVendedor.toLocaleString('pt-BR')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#E4E7EC] dark:border-[#24324D] bg-slate-50 dark:bg-muted/40 flex flex-col justify-center items-center p-6 text-center text-xs text-[#667085] dark:text-muted-foreground">
            <Lock className="h-6 w-6 text-slate-400 mb-1" />
            <span>Resultado global KKJ restrito ao Gestor e Administrador</span>
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
                    {b.status === 'pendente' && !isSeller && (
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
                        {c.operator || 'Operadora'}
                      </span>
                      <span className="text-[10px] text-[#667085] dark:text-muted-foreground">
                        {c.expand?.product_id?.name || 'Saúde PME'}
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
                    R$ {(c.commission_value || 0).toLocaleString('pt-BR')}
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
