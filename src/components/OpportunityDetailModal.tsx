import React, { useState, useEffect } from 'react'
import {
  X,
  Heart,
  Clock,
  History,
  Send,
  Plus,
  Flame,
  Check,
  Loader2,
  Trash2,
  Star,
  ExternalLink,
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
import { companyService } from '@/services/companyService'
import { contactService } from '@/services/contactService'
import { tagService } from '@/services/tagService'
import { carrierService } from '@/services/carrierService'
import { productService } from '@/services/productService'
import { KkjShield } from '@/components/KkjShield'
import type {
  Opportunity,
  OpportunityTimeline,
  Task,
  User as UserType,
  Temperature,
  LostReason,
  Company,
  Contact,
  Carrier,
  Product,
  PlanSuggestion,
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
  const [planSuggestions, setPlanSuggestions] = useState<PlanSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  // Listas auxiliares para seleção rápida e vinculação inline
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Feedback visual inline
  const [savingField, setSavingField] = useState<string | null>(null)
  const [saveSuccessField, setSaveSuccessField] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Timeline / Anotações
  const [noteText, setNoteText] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)

  // Modal de tarefa
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskType, setNewTaskType] = useState('Ligação')
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().slice(0, 10))
  const [newTaskTime, setNewTaskTime] = useState('14:00')
  const [newTaskNotes, setNewTaskNotes] = useState('')

  // Modal de motivo de perda obrigatório
  const [isLostModalOpen, setIsLostModalOpen] = useState(false)
  const [selectedLostReason, setSelectedLostReason] = useState<LostReason>('Preço')

  // Nova cotação / sugestão de plano
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false)
  const [newPlanCarrierId, setNewPlanCarrierId] = useState('')
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanValue, setNewPlanValue] = useState('')
  const [newPlanLives, setNewPlanLives] = useState('1')
  const [newPlanIsPrincipal, setNewPlanIsPrincipal] = useState(false)

  // Cadastro rápido inline de empresa/contato
  const [showQuickCompany, setShowQuickCompany] = useState(false)
  const [quickCompanyName, setQuickCompanyName] = useState('')
  const [quickCompanyCnpj, setQuickCompanyCnpj] = useState('')

  const [showQuickContact, setShowQuickContact] = useState(false)
  const [quickContactName, setQuickContactName] = useState('')
  const [quickContactPhone, setQuickContactPhone] = useState('')
  const [quickContactEmail, setQuickContactEmail] = useState('')

  // Carregar dados da oportunidade e listas auxiliares
  const loadData = async (id: string) => {
    setLoading(true)
    try {
      const [oppRes, tlRes, tasksRes, plansRes, compRes, contRes, carList, prodList] =
        await Promise.all([
          opportunityService.getOpportunityById(id),
          opportunityService.getTimeline(id),
          taskService.getTasksByOpportunity(id),
          opportunityService.getPlanSuggestions(id),
          companyService.getCompanies(),
          contactService.getContacts(),
          carrierService.getAllCarriers(true),
          productService.getAllProducts(true),
        ])
      setOpportunity(oppRes)
      setTimeline(tlRes)
      setTasks(tasksRes)
      setPlanSuggestions(plansRes)
      setCompanies(compRes.items)
      setContacts(contRes.items)
      setCarriers(carList)
      setProducts(prodList)
    } catch (err: any) {
      console.error('Falha ao carregar detalhes da oportunidade:', err)
      setSaveError('Erro ao carregar dados da oportunidade.')
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

  // Helper de salvamento inline silencioso estilo Kommo com feedback visual imediato
  const saveInlineField = async (
    fieldName: string,
    updates: Partial<Opportunity>,
    optimisticOpp: Partial<Opportunity>,
  ) => {
    setSavingField(fieldName)
    setSaveError(null)

    // Atualização otimista na tela
    setOpportunity((prev) => (prev ? { ...prev, ...optimisticOpp } : null))

    try {
      await opportunityService.updateOpportunity(opportunity.id, updates)
      setSaveSuccessField(fieldName)
      setTimeout(() => setSaveSuccessField(null), 1800)
      onUpdated()
      // Recarregar timeline em background para refletir alterações
      const tl = await opportunityService.getTimeline(opportunity.id)
      setTimeline(tl)
    } catch (err: any) {
      setSaveError(err.message || `Falha ao salvar ${fieldName}`)
      // Reverter recarregando do banco
      loadData(opportunity.id)
    } finally {
      setSavingField(null)
    }
  }

  // Tags
  const allTags = tagService.getAllTags()
  const currentTags: string[] = Array.isArray(opportunity.tags)
    ? opportunity.tags
    : typeof opportunity.tags === 'string' && opportunity.tags
      ? (opportunity.tags as string).split(',').map((t) => t.trim())
      : []

  const toggleTag = async (tagName: string) => {
    let next: string[]
    if (currentTags.includes(tagName)) {
      next = currentTags.filter((t) => t !== tagName)
    } else {
      next = [...currentTags, tagName]
    }
    await saveInlineField('tags', { tags: next }, { tags: next })
  }

  // Etapa
  const handleStageChange = async (targetStage: string) => {
    if (targetStage === 'Venda perdida') {
      setIsLostModalOpen(true)
      return
    }

    try {
      const prev = opportunity.stage
      await opportunityService.updateStage(opportunity.id, targetStage, prev)
      setOpportunity((o) => (o ? { ...o, stage: targetStage } : null))
      const tl = await opportunityService.getTimeline(opportunity.id)
      setTimeline(tl)
      onUpdated()
    } catch (err: any) {
      setSaveError(err.message || 'Falha ao mudar etapa')
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
    } catch (err: any) {
      setSaveError(err.message || 'Falha ao marcar como perdida')
    }
  }

  // Temperatura
  const handleTemperatureChange = async (temp: Temperature) => {
    if (opportunity.temperature === temp) return
    await saveInlineField('temperature', { temperature: temp }, { temperature: temp })
  }

  // Responsável
  const handleAssignedChange = async (assignedId: string) => {
    if (opportunity.assigned_to === assignedId) return
    const assignedUser = users.find((u) => u.id === assignedId)
    await saveInlineField(
      'assigned_to',
      { assigned_to: assignedId },
      {
        assigned_to: assignedId,
        expand: {
          ...opportunity.expand,
          assigned_to: assignedUser
            ? {
                id: assignedUser.id,
                name: assignedUser.name,
                email: assignedUser.email,
                role: assignedUser.role,
              }
            : undefined,
        },
      },
    )
  }

  const [isSubmittingQuickCompany, setIsSubmittingQuickCompany] = useState(false)
  const [isSubmittingQuickContact, setIsSubmittingQuickContact] = useState(false)

  // Cadastro rápido de Empresa
  const handleCreateQuickCompany = async () => {
    if (!quickCompanyName.trim()) return
    setIsSubmittingQuickCompany(true)
    setSaveError(null)
    try {
      const created = await companyService.createCompany({
        trade_name: quickCompanyName.trim(),
        legal_name: quickCompanyName.trim(),
        cnpj: quickCompanyCnpj.trim() || undefined,
      })
      setCompanies((prev) => {
        const exists = prev.some((c) => c.id === created.id)
        return exists ? prev : [created, ...prev]
      })
      setShowQuickCompany(false)
      setQuickCompanyName('')
      setQuickCompanyCnpj('')
      await saveInlineField(
        'company_id',
        { company_id: created.id },
        {
          company_id: created.id,
          expand: { ...opportunity.expand, company_id: created },
        },
      )
      // Atualizar lista de contatos caso tenha alterado vínculo
      const contRes = await contactService.getContacts()
      setContacts(contRes.items)
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao cadastrar e vincular nova empresa')
    } finally {
      setIsSubmittingQuickCompany(false)
    }
  }

  // Cadastro rápido de Contato
  const handleCreateQuickContact = async () => {
    if (!quickContactName.trim()) return
    setIsSubmittingQuickContact(true)
    setSaveError(null)
    try {
      const created = await contactService.createContact({
        name: quickContactName.trim(),
        phone: quickContactPhone.trim() || '',
        email: quickContactEmail.trim() || undefined,
        company_id: opportunity.company_id || undefined,
      })
      setContacts((prev) => {
        const exists = prev.some((c) => c.id === created.id)
        return exists ? prev : [created, ...prev]
      })
      setShowQuickContact(false)
      setQuickContactName('')
      setQuickContactPhone('')
      setQuickContactEmail('')
      await saveInlineField(
        'contact_id',
        { contact_id: created.id },
        {
          contact_id: created.id,
          expand: { ...opportunity.expand, contact_id: created },
        },
      )
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao cadastrar e vincular novo contato')
    } finally {
      setIsSubmittingQuickContact(false)
    }
  }

  // Anotações na timeline
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return

    setIsAddingNote(true)
    try {
      await opportunityService.addTimelineNote(opportunity.id, noteText.trim())
      setNoteText('')
      const tl = await opportunityService.getTimeline(opportunity.id)
      setTimeline(tl)
    } catch (err: any) {
      setSaveError(err.message || 'Falha ao registrar anotação')
    } finally {
      setIsAddingNote(false)
    }
  }

  // Tarefas
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
      const [tList, tl] = await Promise.all([
        taskService.getTasksByOpportunity(opportunity.id),
        opportunityService.getTimeline(opportunity.id),
      ])
      setTasks(tList)
      setTimeline(tl)
      onUpdated()
    } catch (err: any) {
      setSaveError(err.message || 'Falha ao agendar tarefa')
    }
  }

  const handleToggleTaskStatus = async (task: Task) => {
    const isCompleted = task.status === 'Concluída'
    const newStatus = isCompleted ? 'Pendente' : 'Concluída'
    try {
      await taskService.updateTask(task.id, {
        status: newStatus,
        completed_at: isCompleted ? null : new Date().toISOString(),
      })
      const [tList, tl] = await Promise.all([
        taskService.getTasksByOpportunity(opportunity.id),
        opportunityService.getTimeline(opportunity.id),
      ])
      setTasks(tList)
      setTimeline(tl)
      onUpdated()
    } catch (err: any) {
      setSaveError(err.message || 'Falha ao alterar status da tarefa')
    }
  }

  // Cotações / Planos Sugeridos
  const handleAddPlanSuggestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlanCarrierId || !newPlanName.trim() || !newPlanValue) return

    try {
      await opportunityService.addPlanSuggestion(opportunity.id, {
        carrier_id: newPlanCarrierId,
        nome_plano: newPlanName.trim(),
        valor_mensal: parseFloat(newPlanValue) || 0,
        vidas: parseInt(newPlanLives, 10) || 1,
        is_principal: newPlanIsPrincipal,
      })
      setIsAddPlanOpen(false)
      setNewPlanCarrierId('')
      setNewPlanName('')
      setNewPlanValue('')
      setNewPlanLives('1')
      setNewPlanIsPrincipal(false)
      const [pList, oppUpdated] = await Promise.all([
        opportunityService.getPlanSuggestions(opportunity.id),
        opportunityService.getOpportunityById(opportunity.id),
      ])
      setPlanSuggestions(pList)
      setOpportunity(oppUpdated)
      onUpdated()
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao adicionar cotação de plano')
    }
  }

  const handleSetPrincipalPlan = async (suggestionId: string) => {
    try {
      await opportunityService.setPrincipalPlanSuggestion(opportunity.id, suggestionId)
      const [pList, oppUpdated] = await Promise.all([
        opportunityService.getPlanSuggestions(opportunity.id),
        opportunityService.getOpportunityById(opportunity.id),
      ])
      setPlanSuggestions(pList)
      setOpportunity(oppUpdated)
      onUpdated()
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao definir plano principal')
    }
  }

  const handleDeletePlanSuggestion = async (suggestionId: string) => {
    try {
      await opportunityService.deletePlanSuggestion(opportunity.id, suggestionId)
      const pList = await opportunityService.getPlanSuggestions(opportunity.id)
      setPlanSuggestions(pList)
      onUpdated()
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao excluir cotação')
    }
  }

  const health = opportunity.health_data || {}

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-7xl w-[96vw] max-h-[94vh] h-[94vh] p-0 flex flex-col overflow-hidden bg-background text-foreground border-border">
        {/* ========================================================= */}
        {/* CABEÇALHO UNIFICADO COM ESCUDO OFICIAL KKJ */}
        {/* ========================================================= */}
        <div className="bg-card border-b border-border px-6 py-3.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {/* ESCUDO OFICIAL KKJ: Acabamento prateado chanfrado e check azul */}
            <div className="p-1.5 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0 border border-slate-700">
              <KkjShield className="h-6 w-6" size={26} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Título com Edição Inline rápida */}
                <input
                  type="text"
                  defaultValue={opportunity.title}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== opportunity.title) {
                      saveInlineField(
                        'title',
                        { title: e.target.value.trim() },
                        { title: e.target.value.trim() },
                      )
                    }
                  }}
                  className="text-base sm:text-lg font-bold text-foreground bg-transparent hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-primary rounded px-1.5 py-0.5 border-transparent border focus:border-border transition"
                  title="Clique para editar o título"
                />

                <Badge variant="outline" className="text-[11px] font-mono">
                  {opportunity.pipeline_type === 'VENDAS' ? 'Funil de Vendas' : 'Pós-Venda'}
                </Badge>

                {/* Destaque visual da Temperatura */}
                {opportunity.temperature === 'Quente' && (
                  <Badge className="bg-red-50 text-red-700 border-red-300 gap-1 text-xs font-bold">
                    <Flame className="h-3 w-3 fill-red-500 text-red-500" /> Quente
                  </Badge>
                )}
                {opportunity.temperature === 'Morno' && (
                  <Badge className="bg-amber-50 text-amber-800 border-amber-300 gap-1 text-xs font-bold">
                    Morno
                  </Badge>
                )}
                {opportunity.temperature === 'Frio' && (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-300 gap-1 text-xs font-bold">
                    Frio
                  </Badge>
                )}

                {/* Feedback de salvamento */}
                {savingField && (
                  <span className="text-[11px] text-blue-600 flex items-center gap-1 font-medium animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                  </span>
                )}
                {saveSuccessField && (
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                    <Check className="h-3 w-3 text-emerald-600" /> Salvo
                  </span>
                )}
              </div>

              <p className="text-xs text-[#667085] truncate mt-0.5">
                {opportunity.expand?.company_id?.trade_name || 'Sem empresa vinculada'} • Contato:{' '}
                {opportunity.expand?.contact_id?.name || 'Sem contato vinculado'} • Responsável:{' '}
                <strong className="text-slate-800">
                  {opportunity.expand?.assigned_to?.name || 'Administrador KKJ'}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-[#667085] hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 text-red-800 border-b border-red-200 px-6 py-1.5 text-xs flex items-center justify-between">
            <span>{saveError}</span>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* LAYOUT DE 3 COLUNAS ESTILO KOMMO */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* ========================================================= */}
          {/* COLUNA ESQUERDA (33%): EDIÇÃO INLINE COMPLETA DE CAMPOS */}
          {/* ========================================================= */}
          <div className="lg:col-span-4 p-4 lg:p-5 overflow-y-auto space-y-4 border-r border-border bg-card text-card-foreground text-xs">
            {/* Bloco 1: Dados Comerciais & Produto */}
            <div className="p-3.5 rounded-xl border border-border bg-card dark:bg-[#141F36] space-y-3">
              <span className="font-bold text-foreground dark:text-slate-100 text-xs uppercase tracking-wider block">
                1. Condições Comerciais (Edição Inline)
              </span>

              {/* Produto (NÃO selecionar automaticamente Adesão se indefinido) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                  Produto
                </Label>
                <Select
                  value={opportunity.product_id || 'none'}
                  onValueChange={(val) => {
                    const finalVal = val === 'none' ? undefined : val
                    saveInlineField(
                      'product_id',
                      { product_id: finalVal },
                      { product_id: finalVal },
                    )
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 font-medium">
                    <SelectValue placeholder="Nenhum / A definir" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100">
                    <SelectItem value="none">Nenhum / A definir</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operadora Atual vs Operadora Cotada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                    Operadora Atual
                  </Label>
                  <Input
                    defaultValue={health.current_operator || ''}
                    placeholder="Ex: Unimed"
                    onBlur={(e) => {
                      const val = e.target.value.trim()
                      if (val !== (health.current_operator || '')) {
                        const updatedH = { ...health, current_operator: val }
                        saveInlineField(
                          'health_data',
                          { health_data: updatedH },
                          { health_data: updatedH },
                        )
                      }
                    }}
                    className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 dark:placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                    Operadora Cotada
                  </Label>
                  <Select
                    value={opportunity.carrier_id || 'none'}
                    onValueChange={(val) => {
                      const finalVal = val === 'none' ? undefined : val
                      saveInlineField(
                        'carrier_id',
                        { carrier_id: finalVal },
                        { carrier_id: finalVal },
                      )
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 font-medium">
                      <SelectValue placeholder="Selecione a operadora" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100">
                      <SelectItem value="none">A Definir</SelectItem>
                      {carriers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Qtd Vidas e Mensalidade Cotada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                    Qtd. de Vidas
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    defaultValue={health.lives_count || ''}
                    placeholder="Ex: 5"
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10) || undefined
                      if (val !== health.lives_count) {
                        const updatedH = { ...health, lives_count: val }
                        saveInlineField(
                          'health_data',
                          { health_data: updatedH },
                          { health_data: updatedH },
                        )
                      }
                    }}
                    className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                    Mensalidade Cotada (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={opportunity.sale_value || ''}
                    placeholder="Ex: 2500.00"
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      if (val !== (opportunity.sale_value || 0)) {
                        saveInlineField(
                          'sale_value',
                          { sale_value: val, value: val },
                          { sale_value: val, value: val },
                        )
                      }
                    }}
                    className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 font-bold"
                  />
                </div>
              </div>

              {/* Origem do Lead */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                  Origem do Lead
                </Label>
                <Select
                  value={opportunity.origin || 'none'}
                  onValueChange={(val) => {
                    const finalVal = val === 'none' ? undefined : val
                    saveInlineField('origin', { origin: finalVal }, { origin: finalVal })
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100">
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100">
                    <SelectItem value="none">Não informada</SelectItem>
                    <SelectItem value="Meta Ads (Tráfego)">Meta Ads (Tráfego Pago)</SelectItem>
                    <SelectItem value="Google Ads">Google Ads</SelectItem>
                    <SelectItem value="Indicação">Indicação de Cliente / Amigo</SelectItem>
                    <SelectItem value="BNI">Membro BNI</SelectItem>
                    <SelectItem value="Base Própria">Base Própria / Carteira</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Seleção Múltipla de Tags Oficiais KKJ */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                  Tags Oficiais da Oportunidade
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const isSelected = currentTags.includes(tag.name)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border transition font-medium ${
                          isSelected
                            ? 'shadow-sm ring-1 ring-offset-1 font-bold'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: tag.bg_color || '#F1F5F9',
                          color: tag.text_color || '#334155',
                          borderColor: tag.color || '#CBD5E1',
                        }}
                      >
                        {isSelected ? `✓ ${tag.name}` : `+ ${tag.name}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Bloco 2: Empresa & Contato (Pesquisar / Vincular / Criar Rápido / Pode ficar sem) */}
            <div className="p-3.5 rounded-xl border border-border bg-card dark:bg-[#141F36] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground dark:text-slate-100 text-xs uppercase tracking-wider">
                  2. Empresa & Interlocutor
                </span>
                <span className="text-[10px] text-muted-foreground dark:text-slate-400">
                  Vínculo flexível
                </span>
              </div>

              {/* Vínculo de Empresa */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                    Empresa / Razão Social
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCompany(!showQuickCompany)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {showQuickCompany ? 'Cancelar' : '+ Nova Empresa'}
                  </button>
                </div>

                {!showQuickCompany ? (
                  <Select
                    value={opportunity.company_id || 'none'}
                    onValueChange={(val) => {
                      const finalId = val === 'none' ? undefined : val
                      const comp = companies.find((c) => c.id === finalId)
                      saveInlineField(
                        'company_id',
                        { company_id: finalId },
                        {
                          company_id: finalId,
                          expand: { ...opportunity.expand, company_id: comp },
                        },
                      )
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 font-medium">
                      <SelectValue placeholder="Sem empresa (Pessoa Física)" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 max-h-60">
                      <SelectItem value="none">Sem empresa (Pessoa Física)</SelectItem>
                      {companies.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.trade_name} {comp.cnpj ? `(${comp.cnpj})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2.5 rounded-lg bg-blue-50/20 dark:bg-[#182540] border border-blue-200 dark:border-[#24324D] space-y-2">
                    <Input
                      placeholder="Nome Fantasia / Razão Social *"
                      value={quickCompanyName}
                      onChange={(e) => setQuickCompanyName(e.target.value)}
                      className="h-7 text-xs bg-background dark:bg-[#0B1322] dark:border-[#24324D] dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                    <Input
                      placeholder="CNPJ (opcional para PF)"
                      value={quickCompanyCnpj}
                      onChange={(e) => setQuickCompanyCnpj(e.target.value)}
                      className="h-7 text-xs bg-background dark:bg-[#0B1322] dark:border-[#24324D] dark:text-slate-100 font-mono dark:placeholder:text-slate-400"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSubmittingQuickCompany || !quickCompanyName.trim()}
                      onClick={handleCreateQuickCompany}
                      className="h-7 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      {isSubmittingQuickCompany ? 'Salvando...' : 'Salvar e Vincular Empresa'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Vínculo de Contato */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                    Contato Principal
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowQuickContact(!showQuickContact)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {showQuickContact ? 'Cancelar' : '+ Novo Contato'}
                  </button>
                </div>

                {!showQuickContact ? (
                  <Select
                    value={opportunity.contact_id || 'none'}
                    onValueChange={(val) => {
                      const finalId = val === 'none' ? undefined : val
                      const cont = contacts.find((c) => c.id === finalId)
                      saveInlineField(
                        'contact_id',
                        { contact_id: finalId },
                        {
                          contact_id: finalId,
                          expand: { ...opportunity.expand, contact_id: cont },
                        },
                      )
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 font-medium">
                      <SelectValue placeholder="Sem contato vinculado" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 max-h-60">
                      <SelectItem value="none">Sem contato vinculado</SelectItem>
                      {contacts.map((cont) => (
                        <SelectItem key={cont.id} value={cont.id}>
                          {cont.name} {cont.phone ? `(${cont.phone})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2.5 rounded-lg bg-blue-50/20 dark:bg-[#182540] border border-blue-200 dark:border-[#24324D] space-y-2">
                    <Input
                      placeholder="Nome do Contato *"
                      value={quickContactName}
                      onChange={(e) => setQuickContactName(e.target.value)}
                      className="h-7 text-xs bg-background dark:bg-[#0B1322] dark:border-[#24324D] dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                    <Input
                      placeholder="WhatsApp / Telefone"
                      value={quickContactPhone}
                      onChange={(e) => setQuickContactPhone(e.target.value)}
                      className="h-7 text-xs bg-background dark:bg-[#0B1322] dark:border-[#24324D] dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                    <Input
                      placeholder="E-mail (opcional)"
                      value={quickContactEmail}
                      onChange={(e) => setQuickContactEmail(e.target.value)}
                      className="h-7 text-xs bg-background dark:bg-[#0B1322] dark:border-[#24324D] dark:text-slate-100 dark:placeholder:text-slate-400"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSubmittingQuickContact || !quickContactName.trim()}
                      onClick={handleCreateQuickContact}
                      className="h-7 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      {isSubmittingQuickContact ? 'Salvando...' : 'Salvar e Vincular Contato'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Cidade / UF inline */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground dark:text-slate-300 font-semibold">
                  Cidade / Região
                </Label>
                <Input
                  defaultValue={opportunity.expand?.company_id?.city || ''}
                  placeholder="Ex: São Paulo - SP"
                  onBlur={async (e) => {
                    const compId = opportunity.company_id
                    if (compId && e.target.value.trim()) {
                      await companyService.updateCompany(compId, { city: e.target.value.trim() })
                      setSaveSuccessField('cidade')
                      setTimeout(() => setSaveSuccessField(null), 1500)
                    }
                  }}
                  className="h-8 text-xs bg-background dark:bg-[#182540] dark:border-[#24324D] dark:text-slate-100 dark:placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Bloco 3: Informações de Saúde e Observações Técnicas */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 space-y-2.5">
              <span className="font-bold text-emerald-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-emerald-600" /> 3. Detalhes do Plano de Saúde
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 font-semibold">Acomodação</Label>
                  <Select
                    value={health.accommodation || 'apartamento'}
                    onValueChange={(val) => {
                      const updatedH = { ...health, accommodation: val }
                      saveInlineField(
                        'health_data',
                        { health_data: updatedH },
                        { health_data: updatedH },
                      )
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartamento">Apartamento (Individual)</SelectItem>
                      <SelectItem value="enfermaria">Enfermaria (Coletivo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 font-semibold">Coparticipação</Label>
                  <Select
                    value={(health as any).coparticipation ? 'sim' : 'nao'}
                    onValueChange={(val) => {
                      const updatedH = { ...health, coparticipation: val === 'sim' }
                      saveInlineField(
                        'health_data',
                        { health_data: updatedH },
                        { health_data: updatedH },
                      )
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Com Coparticipação</SelectItem>
                      <SelectItem value="nao">Sem Coparticipação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-slate-500 font-semibold">
                  Hospitais / Rede Desejada
                </Label>
                <Input
                  defaultValue={health.desired_network || ''}
                  placeholder="Ex: Sírio, Einstein, São Luiz"
                  onBlur={(e) => {
                    const val = e.target.value.trim()
                    if (val !== (health.desired_network || '')) {
                      const updatedH = { ...health, desired_network: val }
                      saveInlineField(
                        'health_data',
                        { health_data: updatedH },
                        { health_data: updatedH },
                      )
                    }
                  }}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-slate-500 font-semibold">
                  Observações / Qualificação
                </Label>
                <Textarea
                  defaultValue={opportunity.qualification_notes || ''}
                  placeholder="Anotações comerciais sobre o perfil do cliente..."
                  rows={2}
                  onBlur={(e) => {
                    const val = e.target.value.trim()
                    if (val !== (opportunity.qualification_notes || '')) {
                      saveInlineField(
                        'qualification_notes',
                        { qualification_notes: val },
                        { qualification_notes: val },
                      )
                    }
                  }}
                  className="text-xs bg-white"
                />
              </div>
            </div>

            {/* Bloco 4: Cotações & Planos Sugeridos (Múltiplas cotações + UMA principal) */}
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1B2A4A] text-xs uppercase tracking-wider">
                  4. Planos Cotados ({planSuggestions.length})
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddPlanOpen(!isAddPlanOpen)}
                  className="h-6 px-2 text-[10px] font-semibold text-blue-700 bg-white"
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Cotação
                </Button>
              </div>

              {isAddPlanOpen && (
                <form
                  onSubmit={handleAddPlanSuggestion}
                  className="p-2.5 rounded-lg bg-white border border-blue-200 space-y-2"
                >
                  <Select value={newPlanCarrierId} onValueChange={setNewPlanCarrierId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Selecione a Operadora *" />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((car) => (
                        <SelectItem key={car.id} value={car.id}>
                          {car.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Nome do Plano (Ex: Amil S380 QP) *"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="h-7 text-xs"
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Valor Mensal (R$) *"
                      value={newPlanValue}
                      onChange={(e) => setNewPlanValue(e.target.value)}
                      className="h-7 text-xs font-bold"
                      required
                    />
                    <Input
                      type="number"
                      placeholder="Vidas"
                      value={newPlanLives}
                      onChange={(e) => setNewPlanLives(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPlanIsPrincipal}
                        onChange={(e) => setNewPlanIsPrincipal(e.target.checked)}
                        className="rounded"
                      />
                      <span>Cotação Principal</span>
                    </label>

                    <Button type="submit" size="sm" className="h-7 text-xs bg-blue-700 text-white">
                      Salvar Cotação
                    </Button>
                  </div>
                </form>
              )}

              {planSuggestions.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic text-center py-2">
                  Nenhuma cotação cadastrada ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {planSuggestions.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                        plan.is_principal
                          ? 'bg-blue-50 border-blue-300 font-medium'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {plan.is_principal && (
                            <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0">
                              Principal
                            </Badge>
                          )}
                          <strong className="text-slate-900 truncate">{plan.carrier_name}</strong>
                          <span className="text-slate-600 truncate">- {plan.product_name}</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-800 block">
                          R${' '}
                          {plan.quoted_monthly_value.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!plan.is_principal && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetPrincipalPlan(plan.id)}
                            className="h-6 px-1.5 text-[10px] text-blue-700 hover:bg-blue-100"
                            title="Tornar cotação principal"
                          >
                            <Star className="h-3 w-3 mr-0.5" /> Principal
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletePlanSuggestion(plan.id)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUNA CENTRAL (41%): HISTÓRICO & AUDITORIA CRONOLÓGICA */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 p-4 lg:p-5 overflow-y-auto flex flex-col justify-between border-r border-[#E4E7EC] bg-[#F5F7FA]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[#1B2A4A]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#101828]">
                    Linha do Tempo & Atividades ({timeline.length})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">
                  Persistência auditável
                </span>
              </div>

              {/* Lista Cronológica */}
              <div className="space-y-2.5 pr-1 max-h-[calc(94vh-180px)] overflow-y-auto">
                {timeline.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#667085] bg-white rounded-xl border border-dashed border-[#E4E7EC]">
                    Nenhum registro no histórico ainda. Todas as alterações e tarefas serão gravadas
                    aqui.
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
                        className="p-3 rounded-xl bg-white border border-[#E4E7EC] shadow-xs text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#101828] flex items-center gap-1.5">
                            {entry.action === 'temperatura_alterada' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-red-50 text-red-700 border-red-200"
                              >
                                Temperatura
                              </Badge>
                            )}
                            {entry.action === 'etapa_alterada' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Etapa
                              </Badge>
                            )}
                            {entry.action === 'responsavel_alterado' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-purple-50 text-purple-700 border-purple-200"
                              >
                                Responsável
                              </Badge>
                            )}
                            {(entry.action === 'tarefa_criada' ||
                              entry.action === 'tarefa_alterada' ||
                              entry.action === 'tarefa_concluida') && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-amber-50 text-amber-800 border-amber-200"
                              >
                                Tarefa
                              </Badge>
                            )}
                            {entry.action === 'venda_ganha' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                              >
                                Venda Ganha
                              </Badge>
                            )}
                            {entry.action === 'pos_venda' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-cyan-50 text-cyan-800 border-cyan-300"
                              >
                                Pós-Venda
                              </Badge>
                            )}
                            {entry.action === 'nota' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-slate-100 text-slate-700"
                              >
                                Nota
                              </Badge>
                            )}
                            <span>{entry.title}</span>
                          </span>
                          <span className="text-[10px] text-[#667085] font-mono">{formatted}</span>
                        </div>

                        {entry.description && (
                          <p className="text-[11px] text-slate-700 leading-relaxed pt-0.5">
                            {entry.description}
                          </p>
                        )}

                        <div className="pt-1 text-[10px] text-slate-400 flex items-center justify-end">
                          Por: {entry.expand?.created_by?.name || 'Administrador / Corretor'}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Input Rápido de Nova Anotação */}
            <form
              onSubmit={handleAddNote}
              className="mt-3 pt-3 border-t border-[#E4E7EC] bg-white p-2.5 rounded-xl shadow-xs"
            >
              <Label className="text-xs font-bold text-[#101828] mb-1 block">
                Registrar Atividade / Observação
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Escreva uma anotação sobre esta oportunidade..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  type="submit"
                  disabled={isAddingNote || !noteText.trim()}
                  className="bg-[#1B2A4A] hover:bg-[#0f172a] text-white text-xs shrink-0 h-8"
                >
                  <Send className="h-3 w-3 mr-1" /> Salvar
                </Button>
              </div>
            </form>
          </div>

          {/* ========================================================= */}
          {/* COLUNA DIREITA (26%): ETAPA, RESPONSÁVEL, TEMPERATURA & TAREFAS */}
          {/* ========================================================= */}
          <div className="lg:col-span-3 p-4 lg:p-5 overflow-y-auto space-y-4 bg-white text-xs">
            {/* 1. Mover Etapa */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Etapa do Pipeline
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

            {/* 2. Responsável Comercial (Admin, Nathany e Eliana elegíveis) */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Responsável (Corretor)
              </Label>
              <Select value={opportunity.assigned_to || ''} onValueChange={handleAssignedChange}>
                <SelectTrigger className="h-9 text-xs font-bold text-[#101828] bg-white">
                  <SelectValue placeholder="Selecione o corretor" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Temperatura do Lead (Destaque visual Frio / Morno / Quente) */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Temperatura do Lead
              </Label>
              <div className="grid grid-cols-3 gap-1">
                {(['Frio', 'Morno', 'Quente'] as Temperature[]).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={opportunity.temperature === t ? 'default' : 'outline'}
                    onClick={() => handleTemperatureChange(t)}
                    className={`text-xs h-8 font-bold ${
                      opportunity.temperature === t
                        ? t === 'Quente'
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                          : t === 'Morno'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* 4. Tarefas e Próxima Atividade */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Próxima Tarefa
                </Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsTaskModalOpen(true)}
                  className="h-6 px-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="h-3 w-3 mr-1" /> Agendar
                </Button>
              </div>

              {nextPendingTask ? (
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span className="truncate">{nextPendingTask.title}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {nextPendingTask.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-600">
                    <Clock className="h-3 w-3 text-amber-600" />
                    <span>
                      {nextPendingTask.due_date} {nextPendingTask.due_time || ''}
                    </span>
                  </div>
                  <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleToggleTaskStatus(nextPendingTask)}
                      className="text-[11px] text-emerald-700 font-bold hover:underline"
                    >
                      ✓ Marcar Concluída
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  Nenhuma tarefa pendente agendada
                </div>
              )}

              {/* Lista de tarefas da oportunidade */}
              {tasks.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Histórico de Tarefas ({tasks.length})
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {tasks.map((t) => (
                      <div
                        key={t.id}
                        className={`p-1.5 rounded border text-[11px] flex items-center justify-between ${
                          t.status === 'Concluída'
                            ? 'bg-slate-100 border-slate-200 line-through text-slate-400'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="truncate flex-1">{t.title}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleTaskStatus(t)}
                          className="text-[10px] ml-1 font-bold text-slate-600 hover:text-emerald-700"
                        >
                          {t.status === 'Concluída' ? 'Reabrir' : 'Concluir'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Motivo de perda se aplicável */}
            {opportunity.stage === 'Venda perdida' && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs space-y-1">
                <span className="font-bold text-red-900 block">Venda Perdida</span>
                <p className="text-red-700">
                  Motivo: <strong>{opportunity.lost_reason || 'Outro'}</strong>
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
            <DialogTitle className="text-base font-bold text-red-700">
              Motivo da Perda (Obrigatório)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-600">
              Para registrar a perda da oportunidade, selecione o motivo determinante:
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
                placeholder="Ex: Ligar para confirmar proposta"
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
                placeholder="Detalhes ou orientações..."
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
