import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Search } from 'lucide-react'
import type { Contract } from '@/types/crm'
import type { CommissionRow } from '@/components/financial/ModernCommissionPanel'

export interface PendingInstallmentRow extends CommissionRow {
  cliente_nome?: string | null
  operadora_nome?: string | null
  numero_contrato?: string | null
}

const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDate = (date: string) => {
  if (!date) return '-'
  return date.split('T')[0].split('-').reverse().join('/')
}

export interface PendingReceiptsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  installments: PendingInstallmentRow[]
  contracts: Contract[]
  isAdmin: boolean
  loading?: boolean
  confirmingId?: string | null
  onConfirm: (
    installmentId: string,
    receiptDate: string,
  ) => Promise<{ ok: boolean; message: string }>
}

/**
 * Lista de todas as parcelas pendentes ("A receber").
 * Segue o padrão visual do painel: azul-marinho, tema claro/escuro.
 * Somente o administrador vê data de recebimento + botão "Confirmar recebimento".
 */
export function PendingReceiptsDialog({
  open,
  onOpenChange,
  installments,
  contracts,
  isAdmin,
  loading,
  confirmingId,
  onConfirm,
}: PendingReceiptsDialogProps) {
  const [search, setSearch] = useState('')
  const [receiptDates, setReceiptDates] = useState<Record<string, string>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [rowSuccess, setRowSuccess] = useState<Record<string, string>>({})
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    if (!open) {
      setRowErrors({})
      setRowSuccess({})
      setSearch('')
    }
  }, [open])

  // Parcelas com saldo pendente, mais antigas primeiro
  const pendingRows = useMemo(() => {
    return installments
      .filter((row) => {
        if (row.status === 'cancelado' || row.status === 'estornado') return false
        const isPaid = row.status === 'recebido' || row.status === 'pago'
        if (isPaid) return false
        return Number(row.valor_previsto) > Number(row.valor_recebido || 0)
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
  }, [installments])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return pendingRows
    return pendingRows.filter((row) => {
      const contract = contracts.find((c) => c.id === row.contract_id)
      const cliente = row.cliente_nome || contract?.expand?.company_id?.trade_name || ''
      const operadora =
        row.operadora_nome ||
        contract?.contracted_carrier_name ||
        contract?.operator ||
        contract?.expand?.carrier_id?.nome ||
        ''
      const numero = row.numero_contrato || contract?.contract_number || ''
      return [cliente, operadora, numero].some((value) => value.toLowerCase().includes(term))
    })
  }, [pendingRows, search, contracts])

  const totalPendente = useMemo(
    () =>
      pendingRows.reduce(
        (sum, r) => sum + Math.max(0, Number(r.valor_previsto) - Number(r.valor_recebido || 0)),
        0,
      ),
    [pendingRows],
  )

  const handleConfirm = async (row: PendingInstallmentRow) => {
    const receiptDate = receiptDates[row.id]
    if (!receiptDate) {
      setRowErrors((prev) => ({ ...prev, [row.id]: 'Informe a data de recebimento.' }))
      return
    }
    setRowErrors((prev) => ({ ...prev, [row.id]: '' }))
    const result = await onConfirm(row.id, receiptDate)
    if (result.ok) {
      setRowSuccess((prev) => ({ ...prev, [row.id]: result.message }))
      setReceiptDates((prev) => ({ ...prev, [row.id]: '' }))
    } else {
      setRowErrors((prev) => ({ ...prev, [row.id]: result.message }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-card">
        <DialogHeader className="rounded-2xl bg-[#101f42] p-5 text-white">
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
            <Clock3 className="h-5 w-5 text-blue-300" /> Parcelas pendentes · A receber
          </DialogTitle>
          <DialogDescription className="text-xs text-blue-200">
            {pendingRows.length} parcela(s) pendente(s) · {currency(totalPendente)}
            {isAdmin ? ' · Informe a data e confirme o recebimento de cada parcela.' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="relative px-1 pt-3">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, operadora ou contrato..."
            className="pl-9 text-xs"
            aria-label="Buscar parcela pendente"
          />
          {search && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-1 py-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-slate-100 dark:bg-muted" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nenhuma parcela pendente
              </p>
              <p className="text-xs text-slate-500 dark:text-muted-foreground">
                {search
                  ? 'Nenhum resultado para a busca informada.'
                  : 'Todas as comissões previstas já foram recebidas.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((row) => {
                const contract = contracts.find((c) => c.id === row.contract_id)
                const cliente =
                  row.cliente_nome ||
                  contract?.expand?.company_id?.trade_name ||
                  'Cliente não informado'
                const operadora =
                  row.operadora_nome ||
                  contract?.contracted_carrier_name ||
                  contract?.operator ||
                  contract?.expand?.carrier_id?.nome ||
                  'Operadora não informada'
                const numeroContrato =
                  row.numero_contrato || contract?.contract_number || row.contract_id.slice(0, 8)
                const isOverdue = row.data_vencimento < todayStr
                const receiptDate = receiptDates[row.id] || ''
                const confirming = confirmingId === row.id
                const saldoPendente = Math.max(
                  0,
                  Number(row.valor_previsto) - Number(row.valor_recebido || 0),
                )

                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-800"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {cliente}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {operadora} · <span className="font-mono">{numeroContrato}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-[#101f42] dark:text-blue-300">
                          {currency(saldoPendente)}
                        </p>
                        <Badge
                          className={
                            isOverdue
                              ? 'bg-amber-100 text-amber-800 text-[10px] dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 text-[10px] dark:bg-blue-950 dark:text-blue-300'
                          }
                        >
                          {isOverdue ? 'Atrasada' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Parcela{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {row.numero_parcela}/{row.total_parcelas}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                        Vencimento{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {formatDate(row.data_vencimento)}
                        </strong>
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="mt-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        {rowSuccess[row.id] ? (
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" /> {rowSuccess[row.id]}
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="date"
                              value={receiptDate}
                              onChange={(e) => {
                                const value = e.target.value
                                setReceiptDates((prev) => ({ ...prev, [row.id]: value }))
                                setRowErrors((prev) => ({ ...prev, [row.id]: '' }))
                              }}
                              aria-label={`Data de recebimento da parcela ${row.numero_parcela}/${row.total_parcelas}`}
                              className="h-8 w-[160px] text-xs"
                            />
                            <Button
                              size="sm"
                              disabled={confirming || !receiptDate}
                              onClick={() => void handleConfirm(row)}
                              className="h-8 bg-[#1B2A4A] text-xs font-semibold text-white hover:bg-[#243761] disabled:opacity-50"
                            >
                              {confirming ? 'Confirmando...' : 'Confirmar recebimento'}
                            </Button>
                            {rowErrors[row.id] && (
                              <span
                                role="alert"
                                className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"
                              >
                                <AlertCircle className="h-3.5 w-3.5" /> {rowErrors[row.id]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
