import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Wallet,
  AlertCircle,
  FileCheck2,
  Filter,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Contract } from '@/types/crm'

export interface CommissionRow {
  id: string
  contract_id: string
  numero_parcela: number
  total_parcelas: number
  data_vencimento: string
  valor_previsto: number
  valor_recebido: number | null
  status: string
}

const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDate = (date: string) => {
  if (!date) return '-'
  return date.split('T')[0].split('-').reverse().join('/')
}

export function ModernCommissionPanel({
  installments,
  contracts,
  error,
  userRole,
  onGenerateForecast,
  generatingForecastId,
}: {
  installments: CommissionRow[]
  contracts: Contract[]
  error?: string | null
  userRole?: string
  onGenerateForecast?: (contractId: string) => void
  generatingForecastId?: string | null
}) {
  const [filter, setFilter] = useState<'todas' | 'recebido' | 'previsto' | 'atrasado'>('todas')
  const [month, setMonth] = useState('todos')
  const [operatorFilter, setOperatorFilter] = useState('todas')
  const [contractFilter, setContractFilter] = useState('todos')

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Ignorar canceladas e estornadas da receita recebida/pendente
  const activeRows = useMemo(
    () => installments.filter((row) => row.status !== 'cancelado' && row.status !== 'estornado'),
    [installments],
  )

  const received = activeRows.reduce((sum, row) => sum + Number(row.valor_recebido || 0), 0)
  const pending = activeRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.valor_previsto) - Number(row.valor_recebido || 0)),
    0,
  )
  const total = received + pending
  const percentageReceived = total > 0 ? Math.round((received / total) * 100) : 0

  // Meses únicos para filtro e gráfico (ordenados)
  const months = useMemo(() => {
    return Array.from(
      new Set(
        activeRows
          .map((row) => (row.data_vencimento ? row.data_vencimento.slice(0, 7) : ''))
          .filter(Boolean),
      ),
    ).sort()
  }, [activeRows])

  // Operadoras únicas dos contratos presentes nas parcelas
  const operators = useMemo(() => {
    const set = new Set<string>()
    contracts.forEach((c) => {
      const op = c.contracted_carrier_name || c.operator || c.expand?.carrier_id?.nome
      if (op) set.add(op)
    })
    return Array.from(set).sort()
  }, [contracts])

  // Próximo vencimento com saldo pendente (menor data >= hoje com saldo, ou menor data global com saldo)
  const nextPendingInstallment = useMemo(() => {
    const pendingItems = activeRows
      .filter((r) => Number(r.valor_previsto) > Number(r.valor_recebido || 0))
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
    if (!pendingItems.length) return null

    // Tentar primeira que vença a partir de hoje; se todas forem passadas, pegar a mais próxima
    const futureOrToday = pendingItems.find((r) => r.data_vencimento >= todayStr)
    return futureOrToday || pendingItems[0]
  }, [activeRows, todayStr])

  // Evolução mensal (para o gráfico de barras)
  const monthly = useMemo(() => {
    return months.map((key) => {
      const selected = activeRows.filter((row) => row.data_vencimento?.startsWith(key))
      const mReceived = selected.reduce((sum, row) => sum + Number(row.valor_recebido || 0), 0)
      const mPending = selected.reduce(
        (sum, row) =>
          sum + Math.max(0, Number(row.valor_previsto) - Number(row.valor_recebido || 0)),
        0,
      )
      return {
        key,
        received: mReceived,
        pending: mPending,
        total: mReceived + mPending,
      }
    })
  }, [months, activeRows])

  const maxMonthly = useMemo(() => Math.max(1, ...monthly.map((item) => item.total)), [monthly])

  // Filtragem das linhas da tabela
  const visible = useMemo(() => {
    return activeRows.filter((row) => {
      // Filtro de mês
      if (month !== 'todos' && !row.data_vencimento?.startsWith(month)) return false

      // Filtro de contrato
      if (contractFilter !== 'todos' && row.contract_id !== contractFilter) return false

      const contract = contracts.find((c) => c.id === row.contract_id)
      const op =
        contract?.contracted_carrier_name ||
        contract?.operator ||
        contract?.expand?.carrier_id?.nome ||
        ''
      if (operatorFilter !== 'todas' && op !== operatorFilter) return false

      const isPaid = Number(row.valor_recebido || 0) >= Number(row.valor_previsto)
      const isOverdue = !isPaid && row.data_vencimento < todayStr

      if (filter === 'recebido') return isPaid
      if (filter === 'previsto') return !isPaid
      if (filter === 'atrasado') return isOverdue

      return true
    })
  }, [activeRows, month, contractFilter, operatorFilter, filter, contracts, todayStr])

  // Identificar contratos de teste/homologação
  const isTestContract = (c?: Contract) => {
    if (!c) return false
    const num = c.contract_number || ''
    return num.includes('KKJ-2026-6080') || num.includes('KKJ-2026-5113') || num.includes('TESTE')
  }

  // Contratos únicos com parcelas
  const contractsWithInstallments = useMemo(() => {
    const ids = Array.from(new Set(activeRows.map((r) => r.contract_id)))
    return ids.map((id) => {
      const contract = contracts.find((c) => c.id === id)
      const items = activeRows.filter((r) => r.contract_id === id)
      const cPaid = items.reduce((sum, r) => sum + Number(r.valor_recebido || 0), 0)
      const cTotal = items.reduce((sum, r) => sum + Number(r.valor_previsto), 0)
      const cPending = Math.max(0, cTotal - cPaid)
      const progress = cTotal > 0 ? Math.round((cPaid / cTotal) * 100) : 0
      return {
        id,
        contract,
        paid: cPaid,
        total: cTotal,
        pending: cPending,
        progress,
        installmentsCount: items.length,
      }
    })
  }, [activeRows, contracts])

  // Contratos que aguardam geração de previsão (confirmaram pagamento mas não têm parcelas)
  const contractsWaitingForecast = useMemo(() => {
    return contracts.filter(
      (c) =>
        c.data_confirmacao_pagamento &&
        !installments.some((p) => p.contract_id === c.id) &&
        c.status !== 'Cancelado',
    )
  }, [contracts, installments])

  const card =
    'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card'

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
      >
        <p className="font-semibold flex items-center gap-2">
          <AlertCircle size={16} /> Falha ao carregar comissões:
        </p>
        <p className="mt-1 text-xs">{error}</p>
      </div>
    )
  }

  return (
    <section className="space-y-6" aria-label="Painel de comissões KKJ">
      {/* Botões rápidos para gerar previsão quando há contratos confirmados sem cronograma */}
      {contractsWaitingForecast.length > 0 && onGenerateForecast && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-blue-950 dark:text-blue-200">
                {contractsWaitingForecast.length} contrato(s) confirmado(s) sem cronograma
                financeiro gerado
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                Gere o cronograma para calcular automaticamente as comissões e atualizar os
                indicadores.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {contractsWaitingForecast.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={generatingForecastId === c.id}
                  onClick={() => onGenerateForecast(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B2A4A] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#243761] disabled:opacity-50"
                >
                  <FileCheck2 size={14} />
                  {generatingForecastId === c.id
                    ? 'Gerando...'
                    : `Gerar: ${c.contract_number || c.id.slice(0, 8)}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAINEL SUPERIOR HERO: AZUL-MARINHO COM INDICADOR CIRCULAR E 3 CARDS */}
      <div className="rounded-3xl bg-[#101f42] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                Gestão Consolidada KKJ
              </span>
              {userRole && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                  {userRole}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white">
              Comissões da KKJ
            </h2>
            <div className="mt-2 text-3xl font-black text-white sm:text-4xl md:text-5xl">
              {currency(total)}
            </div>
            <p className="mt-1.5 text-xs text-slate-300">
              Total de comissões registradas · {activeRows.length} parcelas ·{' '}
              {contractsWithInstallments.length} contratos ativos
            </p>
          </div>

          {/* INDICADOR CIRCULAR DO PERCENTUAL RECEBIDO */}
          <div className="flex items-center gap-4 self-start sm:self-auto">
            <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="9"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth="9"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - percentageReceived / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-white sm:text-2xl">
                  {percentageReceived}%
                </span>
                <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                  recebido
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 CARDS SUPERIORES: RECEBIDO, A RECEBER, PRÓXIMO VENCIMENTO */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {/* Card 1: Recebido */}
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/10">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCircle2 size={16} className="text-emerald-400" /> Recebido
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-400">{currency(received)}</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {activeRows.filter((r) => Number(r.valor_recebido || 0) > 0).length} parcelas
              liquidadas
            </p>
          </div>

          {/* Card 2: A receber */}
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/10">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Clock3 size={16} className="text-blue-300" /> A receber
            </p>
            <p className="mt-2 text-2xl font-black text-blue-200">{currency(pending)}</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {
                activeRows.filter((r) => Number(r.valor_previsto) > Number(r.valor_recebido || 0))
                  .length
              }{' '}
              parcelas pendentes
            </p>
          </div>

          {/* Card 3: Próximo vencimento */}
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/10">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CalendarDays size={16} className="text-amber-300" /> Próximo vencimento
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {nextPendingInstallment
                ? currency(
                    activeRows
                      .filter((row) => row.data_vencimento === nextPendingInstallment.data_vencimento)
                      .reduce(
                        (sum, row) =>
                          sum + Math.max(0, Number(row.valor_previsto) - Number(row.valor_recebido || 0)),
                        0,
                      ),
                  )
                : currency(0)}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {nextPendingInstallment
                ? formatDate(nextPendingInstallment.data_vencimento)
                : 'Sem parcelas pendentes'}
            </p>
          </div>
        </div>
      </div>

      {/* GRÁFICO MENSAL DE BARRAS: EVOLUÇÃO DAS COMISSÕES */}
      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Evolução das comissões por competência
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Valores em reais agrupados por mês de vencimento
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Recebido
            </span>
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Previsto / A receber
            </span>
          </div>
        </div>

        <div className="flex min-h-48 items-end gap-3 overflow-x-auto pb-2 pt-4">
          {monthly.length ? (
            monthly.map((item) => {
              const pendingHeight = maxMonthly > 0 ? (item.pending / maxMonthly) * 128 : 0
              const receivedHeight = maxMonthly > 0 ? (item.received / maxMonthly) * 128 : 0

              return (
                <div
                  key={item.key}
                  className="flex min-w-[85px] flex-1 flex-col items-center gap-1.5"
                >
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {currency(item.total)}
                  </span>
                  <div
                    className="flex h-36 w-full max-w-[56px] flex-col justify-end overflow-hidden rounded-t-lg bg-slate-100 p-0.5 dark:bg-slate-800/80"
                    title={`Mês: ${item.key}\nRecebido: ${currency(item.received)}\nA receber: ${currency(item.pending)}`}
                  >
                    {item.pending > 0 && (
                      <div
                        className="w-full rounded-t-sm bg-blue-400 transition-all duration-500"
                        style={{ height: `${Math.max(4, pendingHeight)}px` }}
                      />
                    )}
                    {item.received > 0 && (
                      <div
                        className="w-full bg-emerald-500 transition-all duration-500"
                        style={{ height: `${Math.max(4, receivedHeight)}px` }}
                      />
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {item.key.split('-').reverse().join('/')}
                  </span>
                </div>
              )
            })
          ) : (
            <p className="py-8 text-center text-sm text-slate-500 w-full">
              Nenhuma comissão registrada para exibição no gráfico.
            </p>
          )}
        </div>
      </div>

      {/* TABELA DE PARCELAS COM FILTROS FUNCIONAIS */}
      <div className={card}>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tabela de parcelas de comissão
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {visible.length} de {activeRows.length} parcelas exibidas
            </p>
          </div>

          {/* BARRA DE FILTROS */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Mês */}
            <select
              aria-label="Filtrar por mês"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="todos">Todos os meses</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m.split('-').reverse().join('/')}
                </option>
              ))}
            </select>

            {/* Filtro Operadora */}
            {operators.length > 0 && (
              <select
                aria-label="Filtrar por operadora"
                value={operatorFilter}
                onChange={(e) => setOperatorFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="todas">Todas as operadoras</option>
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            )}

            {/* Filtro Contrato */}
            {contractsWithInstallments.length > 1 && (
              <select
                aria-label="Filtrar por contrato"
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 max-w-[160px] truncate"
              >
                <option value="todos">Todos os contratos</option>
                {contractsWithInstallments.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract?.contract_number || c.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}

            {/* Filtro Status */}
            <select
              aria-label="Filtrar por status"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="todas">Todos os status</option>
              <option value="recebido">Recebidas</option>
              <option value="previsto">Previstas / A receber</option>
              <option value="atrasado">Atrasadas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800">
                <th className="py-3">Operadora e Contrato</th>
                <th>Parcela</th>
                <th>Data de Vencimento</th>
                <th className="text-right">Valor da Comissão</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((row) => {
                const contract = contracts.find((c) => c.id === row.contract_id)
                const isPaid = Number(row.valor_recebido || 0) >= Number(row.valor_previsto)
                const isOverdue = !isPaid && row.data_vencimento < todayStr
                const isTest = isTestContract(contract)

                let statusBadge = (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    Previsto
                  </span>
                )

                if (isPaid) {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Recebido
                    </span>
                  )
                } else if (isOverdue) {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Atrasado
                    </span>
                  )
                } else if (row.status === 'cancelado' || row.status === 'estornado') {
                  statusBadge = (
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      Cancelado
                    </span>
                  )
                }

                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {contract?.contracted_carrier_name ||
                            contract?.operator ||
                            contract?.expand?.carrier_id?.nome ||
                            'Operadora'}
                        </span>
                        {isTest && (
                          <Badge
                            variant="outline"
                            className="text-[9px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                          >
                            Homologação
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {contract?.contract_number || row.contract_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="text-slate-700 dark:text-slate-300 font-medium">
                      {row.numero_parcela}/{row.total_parcelas}
                    </td>
                    <td className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                      {formatDate(row.data_vencimento)}
                    </td>
                    <td className="text-right font-black text-slate-900 dark:text-white">
                      {currency(Number(row.valor_previsto))}
                    </td>
                    <td className="text-right">{statusBadge}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!visible.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhuma parcela encontrada para os filtros selecionados.
            </p>
          )}
        </div>
      </div>

      {/* CARDS COMPACTOS DE COMISSÕES POR CONTRATO COM BARRA DE PROGRESSO */}
      <div className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet size={18} className="text-blue-600 dark:text-blue-400" />
            Comissões por contrato
          </h3>
          <span className="text-xs text-slate-500">
            {contractsWithInstallments.length} contratos com parcelas
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {contractsWithInstallments.map((item) => {
            const isTest = isTestContract(item.contract)
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-card/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {item.contract?.contracted_carrier_name ||
                          item.contract?.operator ||
                          item.contract?.expand?.carrier_id?.nome ||
                          'Operadora'}
                      </p>
                      {isTest && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                        >
                          Homologação
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-500">
                      {item.contract?.contract_number || item.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-slate-900 dark:text-white">
                      {currency(item.total)}
                    </p>
                    <p className="text-[10px] text-slate-500">{item.installmentsCount} parcelas</p>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] mb-1 font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Recebido: {currency(item.paid)} ({item.progress}%)
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      A receber: {currency(item.pending)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Valores de parcelas iniciais conciliados. Comissões vitalícias (recorrência) são calculadas
        a partir da competência definida em cada operadora após confirmação.
      </p>
    </section>
  )
}
