import React, { useState, useEffect } from 'react'
import {
  X,
  Building2,
  User,
  Shield,
  Heart,
  Calendar,
  Clock,
  DollarSign,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Send,
  History,
  CheckCircle2,
  ExternalLink,
  Flame,
  Award,
  Link as LinkIcon,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { opportunityService } from '@/services/opportunityService'
import { taskService } from '@/services/taskService'
import type {
  Opportunity,
  OpportunityTimeline,
  Task,
  User as UserType,
  Temperature,
  LostReason,
} from '@/types/crm'

interface OpportunityDetailModalProps {
  opportunityId: string | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  users: UserType[]
  salesStages: string[]
  postSalesStages: string[]
  lostReasons: LostReason[]
}

export function OpportunityDetailModal({
  opportunityId,
  open,
  onClose,
  onUpdated,
  users,
  salesStages,
  postSalesStages,
  lostReasons,
}: OpportunityDetailModalProps) {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [timeline, setTimeline] = useState<OpportunityTimeline[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  // Quick action states
  const [noteText, setNoteText] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskType, setNewTaskType] = useState('Ligação')
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().slice(0, 10))
  const [newTaskTime, setNewTaskTime] = useState('14:00')
  const [newTaskNotes, setNewTaskNotes] = useState('')

  // Lost modal state
  const [isLostModalOpen, setIsLostModalOpen] = useState(false)
  const [selectedLostReason, setSelectedLostReason] = useState<LostReason>('Preço')

  // Collapsible section state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    resumo: false,
    empresa: false,
    saude: false,
    cotacao: false,
    financeiro: false,
  })

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const loadData = async (id: string) => {
    setLoading(true)
    try {
      const [oppRes, tlRes, tasksRes] = await Promise.all([
        opportunityService.getOpportunityById(id),
        opportunityService.getTimeline(id),
        taskService.getTasksByOpportunity(id),
      ])
      setOpportunity(oppRes)
      setTimeline(tlRes)
      setTasks(tasksRes)
    } catch (err) {
      console.error('Failed to load opportunity details:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (opportunityId && open) {
      loadData(opportunityId)
    }
  }, [opportunityId, open])

  if (!open || !opportunity) return null

  const stagesList = opportunity.pipeline_type === 'VENDAS' ? salesStages : postSalesStages

  const nextPendingTask = tasks.find((t) => t.status === 'Pendente')

  const handleStageChange = async (targetStage: string) => {
    if (targetStage === 'Venda perdida') {
      setIsLostModalOpen(true)
      return
    }

    try {
      const prev = opportunity.stage
      await opportunityService.updateStage(opportunity.id, targetStage, prev)
      loadData(opportunity.id)
      onUpdated()
    } catch (err) {
      console.error('Failed to update stage:', err)
    }
  }

  const handleConfirmLost = async () => {
    try {
      const prev = opportunity.stage
      await opportunityService.updateStage(
        opportunity.id,
        'Venda perdida',
        prev,
        selectedLostReason,
      )
      setIsLostModalOpen(false)
      loadData(opportunity.id)
      onUpdated()
    } catch (err) {
      console.error('Failed to mark as lost:', err)
    }
  }

  const handleTemperatureChange = async (temp: Temperature) => {
    try {
      await opportunityService.updateOpportunity(
        opportunity.id,
        { temperature: temp },
        `Temperatura atualizada para ${temp}`,
      )
      loadData(opportunity.id)
      onUpdated()
    } catch (err) {
      console.error(err)
    }
  }

  const handleAssignedChange = async (assignedId: string) => {
    const assignedUser = users.find((u) => u.id === assignedId)
    try {
      await opportunityService.updateAssigned(
        opportunity.id,
        assignedId,
        assignedUser?.name || assignedUser?.email,
      )
      loadData(opportunity.id)
      onUpdated()
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return

    setIsAddingNote(true)
    try {
      await opportunityService.addTimelineNote(opportunity.id, noteText.trim())
      setNoteText('')
      const tlRes = await opportunityService.getTimeline(opportunity.id)
      setTimeline(tlRes)
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setIsAddingNote(false)
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    try {
      await taskService.createTask({
        title: newTaskTitle.trim(),
        type: newTaskType as any,
        due_date: newTaskDate,
        due_time: newTaskTime,
        status: 'Pendente',
        notes: newTaskNotes,
        opportunity_id: opportunity.id,
        assigned_to: opportunity.assigned_to,
      })
      setIsTaskModalOpen(false)
      setNewTaskTitle('')
      setNewTaskNotes('')
      loadData(opportunity.id)
      onUpdated()
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  const getTemperatureBadge = (temp: Temperature) => {
    switch (temp) {
      case 'Quente':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs font-semibold">
            <Flame className="h-3 w-3 fill-red-500 text-red-500" /> Quente
          </Badge>
        )
      case 'Morno':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs font-semibold">
            Morno
          </Badge>
        )
      case 'Frio':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs font-semibold">
            Frio
          </Badge>
        )
    }
  }

  const health = opportunity.health_data

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] h-[92vh] p-0 flex flex-col overflow-hidden bg-[#F5F7FA]">
        {/* Header Bar */}
        <div className="bg-white border-b border-[#E4E7EC] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-[#1B2A4A] text-white shrink-0">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#101828] truncate">
                  {opportunity.title}
                </h2>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {opportunity.pipeline_type === 'VENDAS' ? 'Funil de Vendas' : 'Pós-Venda'}
                </Badge>
                {getTemperatureBadge(opportunity.temperature)}
              </div>
              <p className="text-xs text-[#667085] truncate mt-0.5">
                {opportunity.expand?.company_id?.trade_name || 'Empresa não informada'} • Contato:{' '}
                {opportunity.expand?.contact_id?.name || 'Não informado'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-[#667085]">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 3-Column Body */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* ========================================================= */}
          {/* COLUNA ESQUERDA (32%): DADOS EM BLOCOS RECOLHÍVEIS */}
          {/* ========================================================= */}
          <div className="lg:col-span-4 p-4 lg:p-5 overflow-y-auto space-y-4 border-r border-[#E4E7EC] bg-white">
            {/* Bloco 1: Resumo da Oportunidade */}
            <div className="border border-[#E4E7EC] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('resumo')}
                className="w-full flex items-center justify-between p-3 bg-[#F5F7FA] text-xs font-bold text-[#101828] hover:bg-slate-100 transition"
              >
                <span>Resumo da Oportunidade</span>
                {collapsedSections.resumo ? (
                  <ChevronRight className="h-4 w-4 text-[#667085]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#667085]" />
                )}
              </button>
              {!collapsedSections.resumo && (
                <div className="p-3 text-xs space-y-2">
                  <div>
                    <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                      Produto
                    </span>
                    <span className="font-semibold text-[#101828]">
                      {opportunity.expand?.product_id?.name || 'Não selecionado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                      Origem do Lead
                    </span>
                    <span className="text-[#101828]">{opportunity.origin || 'Não informada'}</span>
                  </div>
                  {opportunity.tags && (
                    <div>
                      <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                        Tags
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(Array.isArray(opportunity.tags)
                          ? opportunity.tags
                          : opportunity.tags.split(',')
                        ).map((t, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] bg-slate-100">
                            {typeof t === 'string' ? t.trim() : String(t)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {opportunity.qualification_notes && (
                    <div>
                      <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                        Notas de Qualificação
                      </span>
                      <p className="text-[#101828] bg-slate-50 p-2 rounded text-[11px] leading-relaxed">
                        {opportunity.qualification_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bloco 2: Empresa & Contato */}
            <div className="border border-[#E4E7EC] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('empresa')}
                className="w-full flex items-center justify-between p-3 bg-[#F5F7FA] text-xs font-bold text-[#101828] hover:bg-slate-100 transition"
              >
                <span>Empresa & Contato Principal</span>
                {collapsedSections.empresa ? (
                  <ChevronRight className="h-4 w-4 text-[#667085]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#667085]" />
                )}
              </button>
              {!collapsedSections.empresa && (
                <div className="p-3 text-xs space-y-2">
                  <div>
                    <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                      Empresa (Nome Fantasia)
                    </span>
                    <span className="font-bold text-[#101828]">
                      {opportunity.expand?.company_id?.trade_name || 'Não vinculado'}
                    </span>
                  </div>
                  {opportunity.expand?.company_id?.cnpj && (
                    <div>
                      <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                        CNPJ
                      </span>
                      <span className="font-mono text-[#101828]">
                        {opportunity.expand?.company_id?.cnpj}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                      Cidade / UF
                    </span>
                    <span className="text-[#101828]">
                      {opportunity.expand?.company_id?.city || '—'} -{' '}
                      {opportunity.expand?.company_id?.state || '—'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#E4E7EC]">
                    <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                      Contato
                    </span>
                    <span className="font-semibold text-[#101828]">
                      {opportunity.expand?.contact_id?.name || 'Não vinculado'}
                    </span>
                    {opportunity.expand?.contact_id?.phone && (
                      <p className="text-[11px] text-[#667085]">
                        WhatsApp: {opportunity.expand?.contact_id?.phone}
                      </p>
                    )}
                    {opportunity.expand?.contact_id?.email && (
                      <p className="text-[11px] text-[#667085]">
                        E-mail: {opportunity.expand?.contact_id?.email}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 3: Dados de Saúde & Benefícios (Bloco Opcional/Específico) */}
            {health && (
              <div className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/20">
                <button
                  type="button"
                  onClick={() => toggleSection('saude')}
                  className="w-full flex items-center justify-between p-3 bg-emerald-50/70 text-xs font-bold text-emerald-950 hover:bg-emerald-100/60 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Dados do Plano de Saúde</span>
                  </span>
                  {collapsedSections.saude ? (
                    <ChevronRight className="h-4 w-4 text-emerald-800" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-emerald-800" />
                  )}
                </button>
                {!collapsedSections.saude && (
                  <div className="p-3 text-xs space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                          Qtd Vidas
                        </span>
                        <span className="font-bold text-[#101828] text-sm">
                          {health.lives_count || '—'} vidas
                        </span>
                      </div>
                      <div>
                        <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                          Acomodação
                        </span>
                        <span className="font-semibold text-[#101828]">
                          {health.accommodation || '—'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                        Operadora Atual vs Cotada
                      </span>
                      <p className="text-[#101828]">
                        <strong>Atual:</strong> {health.current_operator || 'Sem plano anterior'}{' '}
                        {health.current_value
                          ? `(R$ ${health.current_value.toLocaleString('pt-BR')})`
                          : ''}
                      </p>
                      <p className="text-emerald-800 font-medium">
                        <strong>Cotada:</strong> {health.quoted_operator || 'A definir'}
                      </p>
                    </div>

                    {health.objective && (
                      <div>
                        <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                          Objetivo Principal
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-white">
                          {health.objective}
                        </Badge>
                      </div>
                    )}

                    {health.desired_network && (
                      <div>
                        <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                          Hospitais / Rede Desejada
                        </span>
                        <p className="text-[11px] text-[#101828] bg-white p-2 rounded border border-emerald-100">
                          {health.desired_network}
                        </p>
                      </div>
                    )}

                    {health.ages_summary && (
                      <div>
                        <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                          Faixa Etária / Perfil
                        </span>
                        <span className="text-[11px] text-[#667085]">{health.ages_summary}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bloco 4: Cotação e Links */}
            {opportunity.quotation_link && (
              <div className="border border-[#E4E7EC] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('cotacao')}
                  className="w-full flex items-center justify-between p-3 bg-[#F5F7FA] text-xs font-bold text-[#101828] hover:bg-slate-100 transition"
                >
                  <span>Link da Cotação</span>
                  {collapsedSections.cotacao ? (
                    <ChevronRight className="h-4 w-4 text-[#667085]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#667085]" />
                  )}
                </button>
                {!collapsedSections.cotacao && (
                  <div className="p-3 text-xs">
                    <a
                      href={opportunity.quotation_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline break-all font-medium"
                    >
                      <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{opportunity.quotation_link}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Bloco 5: Valores & Financeiro */}
            <div className="border border-blue-100 bg-blue-50/20 rounded-xl p-3 text-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1B2A4A] block">
                Valores da Operação
              </span>
              <div className="flex items-center justify-between">
                <span className="text-[#667085]">Valor da Venda (Mensalidade):</span>
                <strong className="text-sm font-bold text-[#1B2A4A]">
                  R$ {(opportunity.sale_value || 0).toLocaleString('pt-BR')}
                </strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-blue-100">
                <span className="text-[#667085]">Faturamento KKJ (Comissão Est.):</span>
                <strong className="text-xs font-bold text-emerald-700">
                  R$ {(opportunity.commission_value || 0).toLocaleString('pt-BR')}
                </strong>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUNA CENTRAL (42%): TIMELINE / HISTÓRICO CRONOLÓGICO */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 p-4 lg:p-5 overflow-y-auto flex flex-col justify-between border-r border-[#E4E7EC] bg-[#F5F7FA]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[#1B2A4A]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#101828]">
                    Linha do Tempo & Histórico ({timeline.length})
                  </h3>
                </div>
                <span className="text-[10px] text-[#667085]">Auditoria cronológica</span>
              </div>

              {/* Timeline list */}
              <div className="space-y-3 pr-1">
                {timeline.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#667085] bg-white rounded-xl border border-dashed border-[#E4E7EC]">
                    Nenhum registro no histórico ainda.
                  </div>
                ) : (
                  timeline.map((entry) => {
                    const dateObj = new Date(entry.created || '')
                    const formatted = dateObj.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    return (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-white border border-[#E4E7EC] shadow-sm text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#101828] flex items-center gap-1.5">
                            {entry.action_type === 'MUDANCA_ETAPA' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Etapa
                              </Badge>
                            )}
                            {entry.action_type === 'NOTA' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200"
                              >
                                Nota
                              </Badge>
                            )}
                            {entry.action_type === 'TAREFA' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-amber-50 text-amber-700 border-amber-200"
                              >
                                Tarefa
                              </Badge>
                            )}
                            {entry.action_type === 'SISTEMA' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-slate-100 text-[#667085]"
                              >
                                Sistema
                              </Badge>
                            )}
                            {entry.title}
                          </span>
                          <span className="text-[10px] text-[#667085] font-mono">{formatted}</span>
                        </div>
                        {entry.description && (
                          <p className="text-[11px] text-[#667085] leading-relaxed pt-1">
                            {entry.description}
                          </p>
                        )}
                        <div className="pt-1 text-[10px] text-muted-foreground flex items-center justify-end">
                          Por: {entry.expand?.created_by?.name || 'Sistema'}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Nova Nota Input */}
            <form
              onSubmit={handleAddNote}
              className="mt-4 pt-4 border-t border-[#E4E7EC] bg-white p-3 rounded-xl shadow-sm"
            >
              <Label className="text-xs font-semibold text-[#101828] mb-1.5 block">
                Adicionar Nota / Observação
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Escreva uma anotação sobre a negociação..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="h-9 text-xs"
                />
                <Button
                  type="submit"
                  disabled={isAddingNote || !noteText.trim()}
                  className="bg-[#1B2A4A] text-white text-xs shrink-0"
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> Salvar
                </Button>
              </div>
            </form>
          </div>

          {/* ========================================================= */}
          {/* COLUNA DIREITA (26%): AÇÕES RÁPIDAS & RESPONSÁVEL */}
          {/* ========================================================= */}
          <div className="lg:col-span-3 p-4 lg:p-5 overflow-y-auto space-y-4 bg-white">
            {/* Etapa Atual / Mover Etapa */}
            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-[#F5F7FA] space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block">
                Etapa no Funil
              </Label>
              <Select value={opportunity.stage} onValueChange={handleStageChange}>
                <SelectTrigger className="h-9 text-xs font-bold text-[#1B2A4A] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stagesList.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                  {opportunity.pipeline_type === 'VENDAS' && (
                    <SelectItem value="Venda perdida" className="text-red-600 font-semibold">
                      ✕ Venda perdida
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Responsável da Oportunidade */}
            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-[#F5F7FA] space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block">
                Responsável (Corretor)
              </Label>
              <Select value={opportunity.assigned_to || ''} onValueChange={handleAssignedChange}>
                <SelectTrigger className="h-9 text-xs font-semibold text-[#101828] bg-white">
                  <SelectValue placeholder="Selecione o corretor" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperatura do Lead */}
            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-[#F5F7FA] space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block">
                Temperatura
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {(['Frio', 'Morno', 'Quente'] as Temperature[]).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={opportunity.temperature === t ? 'default' : 'outline'}
                    onClick={() => handleTemperatureChange(t)}
                    className={`text-xs h-8 ${
                      opportunity.temperature === t
                        ? t === 'Quente'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : t === 'Morno'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-white text-[#667085]'
                    }`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Próxima Tarefa */}
            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-[#F5F7FA] space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                  Próxima Tarefa
                </Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsTaskModalOpen(true)}
                  className="h-6 px-1.5 text-[11px] text-[#1B2A4A] hover:bg-white"
                >
                  <Plus className="h-3 w-3 mr-1" /> Criar
                </Button>
              </div>

              {nextPendingTask ? (
                <div className="p-2.5 rounded-lg bg-white border border-[#E4E7EC] text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-[#101828]">
                    <span className="truncate">{nextPendingTask.title}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {nextPendingTask.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#667085]">
                    <Clock className="h-3 w-3 text-amber-600" />
                    <span>
                      {nextPendingTask.due_date} {nextPendingTask.due_time || ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-white border border-dashed border-[#E4E7EC] text-center text-xs text-[#667085]">
                  Nenhuma tarefa agendada
                </div>
              )}
            </div>

            {/* Motivo de perda se aplicável */}
            {opportunity.stage === 'Venda perdida' && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs space-y-1">
                <span className="font-bold text-red-900 block">Venda Encerrada como Perdida</span>
                <p className="text-red-700">
                  Motivo registrado: <strong>{opportunity.lost_reason || 'Outro'}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* MODAL: MOTIVO DE PERDA OBRIGATÓRIO */}
      <Dialog open={isLostModalOpen} onOpenChange={setIsLostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Motivo da Perda (Obrigatório)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-[#667085]">
              Para encerrar a oportunidade como perdida, indique o motivo determinante:
            </p>
            <Select
              value={selectedLostReason}
              onValueChange={(val) => setSelectedLostReason(val as LostReason)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lostReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLostModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmLost}
              className="bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              Confirmar Perda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA TAREFA */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Agendar Nova Tarefa
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Título da Tarefa *</Label>
              <Input
                placeholder="Ex: Ligar para confirmar recebimento da proposta"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={newTaskType} onValueChange={setNewTaskType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'Ligação',
                      'WhatsApp',
                      'Follow-up',
                      'Reunião',
                      'Cotação',
                      'Documentação',
                      'Implantação',
                      'Cobrança/Pagamento',
                      'Outro',
                    ].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horário</Label>
              <Input
                type="time"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                placeholder="Detalhes ou checklist da tarefa..."
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTaskModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-[#1B2A4A] text-white text-xs">
                Salvar Tarefa
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
