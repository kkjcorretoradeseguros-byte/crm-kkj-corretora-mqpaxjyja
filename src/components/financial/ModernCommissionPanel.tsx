import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Wallet } from 'lucide-react'
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

const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = (date: string) => date.split('-').reverse().join('/')

export function ModernCommissionPanel({ installments, contracts, error }: {
  installments: CommissionRow[]
  contracts: Contract[]
  error?: string | null
}) {
  const [filter, setFilter] = useState<'todas' | 'recebido' | 'previsto'>('todas')
  const [month, setMonth] = useState('todos')
  const rows = useMemo(() => installments.filter((row) => row.status !== 'cancelado' && row.status !== 'estornado'), [installments])
  const received = rows.reduce((sum, row) => sum + Number(row.valor_recebido || 0), 0)
  const pending = rows.reduce((sum, row) => sum + Math.max(0, Number(row.valor_previsto) - Number(row.valor_recebido || 0)), 0)
  const total = received + pending
  const months = Array.from(new Set(rows.map((row) => row.data_vencimento.slice(0, 7)))).sort()
  const monthly = months.map((key) => {
    const selected = rows.filter((row) => row.data_vencimento.startsWith(key))
    return {
      key,
      received: selected.reduce((sum, row) => sum + Number(row.valor_recebido || 0), 0),
      pending: selected.reduce((sum, row) => sum + Math.max(0, Number(row.valor_previsto) - Number(row.valor_recebido || 0)), 0),
    }
  })
  const next = monthly.find((item) => item.pending > 0)
  const visible = rows.filter((row) =>
    (month === 'todos' || row.data_vencimento.startsWith(month)) &&
    (filter === 'todas' || (filter === 'recebido' ? Number(row.valor_recebido || 0) > 0 : Number(row.valor_previsto) > Number(row.valor_recebido || 0))),
  )
  const maxMonthly = Math.max(1, ...monthly.map((item) => item.received + item.pending))
  const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'
  if (error) return <p role="alert" className="text-sm text-red-600">Não foi possível carregar as comissões: {error}</p>
  return <section className="space-y-4" aria-label="Painel de comissões KKJ">
    <div className="rounded-2xl bg-[#101f42] p-5 text-white shadow-lg sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-300">Comissões da KKJ</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{currency(total)}</h2>
          <p className="mt-1 text-xs text-slate-300">{rows.length} parcelas · {new Set(rows.map((r) => r.contract_id)).size} contratos · parcelas iniciais</p>
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-[9px] border-emerald-400 bg-[#1d3359] text-center text-xs font-bold sm:h-24 sm:w-24">
          {total ? Math.round(received / total * 100) : 0}%<span className="sr-only"> recebido</span>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/10 p-3"><p className="flex items-center gap-2 text-xs text-slate-200"><CheckCircle2 size={16}/> Recebido</p><p className="mt-1 text-xl font-bold text-emerald-300">{currency(received)}</p></div>
        <div className="rounded-xl bg-white/10 p-3"><p className="flex items-center gap-2 text-xs text-slate-200"><Clock3 size={16}/> A receber</p><p className="mt-1 text-xl font-bold">{currency(pending)}</p></div>
        <div className="rounded-xl bg-white/10 p-3"><p className="flex items-center gap-2 text-xs text-slate-200"><CalendarDays size={16}/> Próximo vencimento</p><p className="mt-1 text-xl font-bold">{currency(next?.pending || 0)}</p><p className="text-xs text-slate-300">{next ? next.key.split('-').reverse().join('/') : 'Sem pendências'}</p></div>
      </div>
    </div>
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Evolução das comissões</h3><span className="text-xs text-slate-500">Verde: recebido · Azul: a receber</span></div>
      <div className="flex min-h-44 items-end gap-3 overflow-x-auto pb-2">
        {monthly.length ? monthly.map((item) => <div key={item.key} className="flex min-w-20 flex-1 flex-col items-center gap-1">
          <span className="text-xs font-semibold">{currency(item.received + item.pending)}</span>
          <div className="flex h-28 w-full max-w-20 flex-col justify-end overflow-hidden rounded-t-md bg-slate-100 dark:bg-slate-800">
            <div className="bg-blue-300" style={{height: `${item.pending / maxMonthly * 112}px`}} title={`A receber: ${currency(item.pending)}`}/>
            <div className="bg-emerald-500" style={{height: `${item.received / maxMonthly * 112}px`}} title={`Recebido: ${currency(item.received)}`}/>
          </div><span className="text-xs text-slate-500">{item.key.split('-').reverse().join('/')}</span>
        </div>) : <p className="text-sm text-slate-500">Nenhuma parcela registrada.</p>}
      </div>
    </div>
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">Parcelas de comissão</h3>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filtrar por mês" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700"><option value="todos">Todos os meses</option>{months.map((m) => <option key={m} value={m}>{m.split('-').reverse().join('/')}</option>)}</select>
          <select aria-label="Filtrar por status" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-slate-700"><option value="todas">Todas</option><option value="recebido">Recebidas</option><option value="previsto">A receber</option></select>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
        <thead><tr className="border-b text-xs text-slate-500"><th className="py-3">Contrato / Operadora</th><th>Parcela</th><th>Vencimento</th><th className="text-right">Valor</th><th className="text-right">Status</th></tr></thead>
        <tbody>{visible.map((row) => {
          const contract = contracts.find((c) => c.id === row.contract_id)
          const paid = Number(row.valor_recebido || 0) >= Number(row.valor_previsto)
          return <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
            <td className="py-3"><span className="block font-semibold">{contract?.operator || 'Operadora'}</span><span className="text-xs text-slate-500">{contract?.contract_number || row.contract_id.slice(0, 8)}</span></td>
            <td>{row.numero_parcela}/{row.total_parcelas}</td><td>{formatDate(row.data_vencimento)}</td>
            <td className="text-right font-semibold">{currency(Number(row.valor_previsto))}</td>
            <td className="text-right"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'}`}>{paid ? 'Recebido' : 'A receber'}</span></td>
          </tr>
        })}</tbody>
      </table>{!visible.length && <p className="py-6 text-center text-sm text-slate-500">Nenhuma parcela para o filtro selecionado.</p>}</div>
    </div>
    <div className={card}><h3 className="mb-3 flex items-center gap-2 font-bold"><Wallet size={18}/> Comissões por contrato</h3>
      <div className="grid gap-3 md:grid-cols-2">{Array.from(new Set(rows.map((r) => r.contract_id))).map((id) => {
        const contract = contracts.find((c) => c.id === id)
        const items = rows.filter((r) => r.contract_id === id)
        const paid = items.reduce((sum, r) => sum + Number(r.valor_recebido || 0), 0)
        const amount = items.reduce((sum, r) => sum + Number(r.valor_previsto), 0)
        return <div key={id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex justify-between gap-3"><div><p className="font-semibold">{contract?.operator || 'Operadora'}</p><p className="text-xs text-slate-500">{contract?.contract_number || id.slice(0, 8)}</p></div><p className="font-bold">{currency(amount)}</p></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-emerald-500" style={{width: `${amount ? paid / amount * 100 : 0}%`}}/></div>
          <div className="mt-2 flex justify-between gap-2 text-xs"><span className="text-emerald-600">Recebido: {currency(paid)}</span><span className="text-slate-500">A receber: {currency(Math.max(0, amount - paid))}</span></div>
        </div>
      })}</div>
    </div>
    <p className="text-xs text-slate-500">Comissões iniciais registradas. Comissões vitalícias ainda não incluídas nesta previsão.</p>
  </section>
}
