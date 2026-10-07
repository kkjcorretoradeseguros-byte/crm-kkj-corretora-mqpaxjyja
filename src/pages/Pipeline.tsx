import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  KanbanSquare,
  Plus,
  Building2,
  User,
  Heart,
  DollarSign,
  AlertCircle,
  Clock,
  Flame,
  CheckCircle2,
  Calendar,
  Filter,
  Users,
  Shield,
  ChevronDown,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { opportunityService } from '@/services/opportunityService'
import { companyService } from '@/services/companyService'
import { contactService } from '@/services/contactService'
import { productService } from '@/services/productService'
import { taskService } from '@/services/taskService'
import { userService } from '@/services/userService'
import { contractService } from '@/services/contractService'
import { useAuth } from '@/contexts/AuthContext'
import { OpportunityDetailModal } from '@/components/OpportunityDetailModal'
import type {
  Opportunity,
  Company,
  Contact,
  Product,
  Task,
  User as UserType,
  PipelineType,
  Temperature,
  LostReason,
} from '@/types/crm'

const SALES_STAGES = [
  'Novo Lead',
  'Contato realizado',
  'Qualificado',
  'Cotação',
  'Follow-up',
  'Negociação',
  'Venda ganha',
]

const POST_SALES_STAGES = [
  'Documentação',
  'Implantação',
  'Aguardando pagamento',
  'Implantado',
  'Cliente ativo',
]

const LOST_REASONS: LostReason[] = [
  'Preço',
  'Sem retorno',
  'Fechou com concorrente',
  'Sem CNPJ elegível',
  'Quantidade de vidas',
  'Carência',
  'Rede inadequada',
  'Desistiu',
  'Outro',
]

export default function Pipeline() {
  const { user } = useAuth()

  // Selected funnel (VENDAS or POS_VENDA)
  const [pipelineType, setPipelineType] = useState<PipelineType>('VENDAS')

  // Main data states
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Drag-and-drop state
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null)

  // Modals state
  const [isNewOppOpen, setIsNewOppOpen] = useState(false)
  const [detailOppId, setDetailOppId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLostModalOpen, setIsLostModalOpen] = useState(false)
  const [pendingLostOpp, setPendingLostOpp] = useState<Opportunity | null>(null)
  const [lostReasonChoice, setLostReasonChoice] = useState<LostReason>('Preço')

  // New Opportunity Form states
  const [formTitle, setFormTitle] = useState('')
  const [formCompanyId, setFormCompanyId] = useState('')
  const [formContactId, setFormContactId] = useState('')
  const [formProductId, setFormProductId] = useState('')
  const [formStage, setFormStage] = useState('Novo Lead')
  const [formTemperature, setFormTemperature] = useState<Temperature>('Morno')
  const [formSaleValue, setFormSaleValue] = useState('')
  const [formCommissionValue, setFormCommissionValue] = useState('')
  const [formOrigin, setFormOrigin] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formQuotationLink, setFormQuotationLink] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Optional Health Form fields
  const [includeHealthData, setIncludeHealthData] = useState(true)
  const [healthOperator, setHealthOperator] = useState('')
  const [healthQuotedOperator, setHealthQuotedOperator] = useState('')
  const [healthLives, setHealthLives] = useState('')
  const [healthAccommodation, setHealthAccommodation] = useState('Apartamento')
  const [healthObjective, setHealthObjective] = useState('Reduzir custo')
  const [healthNetwork, setHealthNetwork] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [oppsRes, compRes, contRes, prodRes, usersRes, tasksRes] = await Promise.all([
        opportunityService.getAllOpportunities(pipelineType),
        companyService.getAllCompanies(),
        contactService.getAllContacts(),
        productService.getAllProducts(),
        userService.getAllUsers(),
        taskService.getAllTasks(),
      ])
      setOpportunities(oppsRes)
      setCompanies(compRes)
      setContacts(contRes)
      setProducts(prodRes)
      setUsers(usersRes)
      setTasks(tasksRes)
    } catch (err) {
      console.error('Failed to load pipeline data:', err)
    } finally {
      setLoading(false)
    }
  }, [pipelineType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const currentStages = pipelineType === 'VENDAS' ? SALES_STAGES : POST_SALES_STAGES

  // Filter contacts by chosen company in the form
  const availableContacts = useMemo(() => {
    if (!formCompanyId) return contacts
    return contacts.filter((c) => c.company_id === formCompanyId)
  }, [contacts, formCompanyId])

  // Summary indicators for top bar
  const totalOppsCount = opportunities.length
  const totalSaleValue = opportunities.reduce((sum, o) => sum + (o.sale_value || 0), 0)
  const totalCommissionValue = opportunities.reduce((sum, o) => sum + (o.commission_value || 0), 0)

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    setDraggedOppId(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault()
    const oppId = e.dataTransfer.getData('text/plain') || draggedOppId
    if (!oppId) return

    const opp = opportunities.find((o) => o.id === oppId)
    if (!opp || opp.stage === targetStage) return

    // If moving to Venda Ganha in Sales Funnel: start automatic Post-Sales flow
    if (pipelineType === 'VENDAS' && targetStage === 'Venda ganha') {
      try {
        await opportunityService.updateStage(opp.id, 'Venda ganha', opp.stage)
        // Automatically create or transition to Post-Sales (Funil de Pós-Venda)
        await opportunityService.createOpportunity({
          title: `[Pós-Venda] ${opp.title.replace(/^\[DEMO\]\s*/, '')}`,
          pipeline_type: 'POS_VENDA',
          stage: 'Documentação', // 1ª etapa obrigatória do pós-venda
          temperature: 'Quente',
          contact_id: opp.contact_id,
          company_id: opp.company_id,
          product_id: opp.product_id,
          assigned_to: opp.assigned_to,
          sale_value: opp.sale_value,
          commission_value: opp.commission_value,
          origin: opp.origin,
          health_data: opp.health_data,
        })

        // Also record contract snapshot
        await contractService.createContract({
          contract_number: `KKJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          opportunity_id: opp.id,
          company_id: opp.company_id,
          contact_id: opp.contact_id,
          product_id: opp.product_id,
          sale_value: opp.sale_value || 0,
          commission_value: opp.commission_value || 0,
          lives_count: opp.health_data?.lives_count || 1,
          operator: opp.health_data?.quoted_operator || 'Operadora Parceira',
          status: 'Em Implantação',
          assigned_to: opp.assigned_to,
        })
      } catch (err) {
        console.error('Error on Venda Ganha transition:', err)
      }
      fetchData()
      return
    }

    // Optimistic UI update
    setOpportunities((prev) =>
      prev.map((item) => (item.id === oppId ? { ...item, stage: targetStage } : item)),
    )

    try {
      await opportunityService.updateStage(oppId, targetStage, opp.stage)
    } catch (err) {
      console.error(err)
      fetchData()
    } finally {
      setDraggedOppId(null)
    }
  }

  // Quick move via select dropdown
  const handleQuickMove = async (opp: Opportunity, targetStage: string) => {
    if (targetStage === 'Venda perdida') {
      setPendingLostOpp(opp)
      setIsLostModalOpen(true)
      return
    }

    try {
      await opportunityService.updateStage(opp.id, targetStage, opp.stage)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleConfirmLost = async () => {
    if (!pendingLostOpp) return
    try {
      await opportunityService.updateStage(
        pendingLostOpp.id,
        'Venda perdida',
        pendingLostOpp.stage,
        lostReasonChoice,
      )
      setIsLostModalOpen(false)
      setPendingLostOpp(null)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const openCreateModal = (initialStage?: string) => {
    setFormTitle('')
    setFormCompanyId(companies[0]?.id || '')
    setFormContactId('')
    setFormProductId(products[0]?.id || '')
    setFormStage(initialStage || currentStages[0])
    setFormTemperature('Morno')
    setFormSaleValue('')
    setFormCommissionValue('')
    setFormOrigin('')
    setFormTags('')
    setFormQuotationLink('')
    setFormNotes('')
    setIncludeHealthData(true)
    setHealthOperator('')
    setHealthQuotedOperator('')
    setHealthLives('')
    setHealthNetwork('')
    setFormError(null)
    setIsNewOppOpen(true)
  }

  const handleSaveOpportunity = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formTitle.trim()) {
      setFormError('Nome da oportunidade é obrigatório.')
      return
    }

    setIsSaving(true)
    try {
      const saleVal = formSaleValue ? parseFloat(formSaleValue) : 0
      const commVal = formCommissionValue
        ? parseFloat(formCommissionValue)
        : Math.round(saleVal * 0.2) // estimativa padrão de comissão se não informado

      const payload: Partial<Opportunity> = {
        title: formTitle.trim(),
        pipeline_type: pipelineType,
        stage: formStage,
        temperature: formTemperature,
        company_id: formCompanyId || undefined,
        contact_id: formContactId || undefined,
        product_id: formProductId || undefined,
        assigned_to: user?.id,
        origin: formOrigin.trim() || undefined,
        tags: formTags.trim() || undefined,
        sale_value: saleVal,
        commission_value: commVal,
        quotation_link: formQuotationLink.trim() || undefined,
        qualification_notes: formNotes.trim() || undefined,
      }

      if (includeHealthData) {
        payload.health_data = {
          has_current_plan: !!healthOperator,
          current_operator: healthOperator,
          quoted_operator: healthQuotedOperator,
          lives_count: healthLives ? parseInt(healthLives, 10) : undefined,
          accommodation: healthAccommodation,
          objective: healthObjective,
          desired_network: healthNetwork,
        }
      }

      await opportunityService.createOpportunity(payload)
      setIsNewOppOpen(false)
      fetchData()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setFormError(errObj.message || 'Erro ao criar oportunidade.')
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = (opp: Opportunity) => {
    setDetailOppId(opp.id)
    setIsDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Operational Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
        {/* Left: Funnel selector */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#1B2A4A] text-white">
            <KanbanSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                Funil Ativo:
              </span>
              <Select
                value={pipelineType}
                onValueChange={(val) => setPipelineType(val as PipelineType)}
              >
                <SelectTrigger className="h-8 font-extrabold text-sm text-[#1B2A4A] border-none shadow-none p-0 focus:ring-0 gap-1.5 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VENDAS" className="font-bold">
                    FUNIL DE VENDAS ▾
                  </SelectItem>
                  <SelectItem value="POS_VENDA" className="font-bold">
                    FUNIL DE PÓS-VENDA ▾
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-[#667085]">
              {pipelineType === 'VENDAS'
                ? 'Novo Lead → Contato → Qualificado → Cotação → Follow-up → Negociação → Venda ganha'
                : 'Documentação → Implantação → Aguardando pagamento → Implantado → Cliente ativo'}
            </p>
          </div>
        </div>

        {/* Center / Right: Indicators & Action */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7FA] border border-[#E4E7EC]">
            <span className="font-bold text-[#1B2A4A]">{totalOppsCount}</span>
            <span className="text-[#667085]">oportunidades</span>
            <span className="text-slate-300">•</span>
            <span className="text-[#667085]">Venda:</span>
            <strong className="text-[#101828]">R$ {totalSaleValue.toLocaleString('pt-BR')}</strong>
            <span className="text-slate-300">•</span>
            <span className="text-[#667085]">Faturamento KKJ:</span>
            <strong className="text-emerald-700">
              R$ {totalCommissionValue.toLocaleString('pt-BR')}
            </strong>
          </div>

          <Button
            onClick={() => openCreateModal()}
            className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="h-4 w-4" /> Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="w-80 h-[560px] shrink-0 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 items-start min-h-[640px]">
          {currentStages.map((stageName, stageIdx) => {
            const stageOpps = opportunities.filter((o) => o.stage === stageName)
            const stageSaleTotal = stageOpps.reduce((sum, o) => sum + (o.sale_value || 0), 0)

            // Stage color accent
            const colors = [
              '#3B82F6',
              '#6366F1',
              '#8B5CF6',
              '#EC4899',
              '#F59E0B',
              '#10B981',
              '#059669',
            ]
            const accentColor = colors[stageIdx % colors.length]

            return (
              <div
                key={stageName}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stageName)}
                className="w-80 shrink-0 flex flex-col rounded-xl border border-[#E4E7EC] bg-[#F5F7FA] overflow-hidden"
              >
                {/* Column Header */}
                <div className="p-3.5 bg-white border-b border-[#E4E7EC] relative">
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#101828] truncate">{stageName}</span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 font-bold">
                      {stageOpps.length}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-semibold text-[#667085] mt-1 flex items-center justify-between">
                    <span>
                      {stageSaleTotal > 0 ? `R$ ${stageSaleTotal.toLocaleString('pt-BR')}` : 'R$ 0'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">mensal</span>
                  </div>
                </div>

                {/* Column Body / Informative Cards */}
                <div className="p-2.5 flex-1 space-y-2.5 min-h-[380px]">
                  {stageOpps.map((opp) => {
                    const company =
                      opp.expand?.company_id || companies.find((c) => c.id === opp.company_id)
                    const contact =
                      opp.expand?.contact_id || contacts.find((c) => c.id === opp.contact_id)
                    const product =
                      opp.expand?.product_id || products.find((p) => p.id === opp.product_id)
                    const assigned =
                      opp.expand?.assigned_to || users.find((u) => u.id === opp.assigned_to)

                    // Check for next pending task
                    const oppTask = tasks.find(
                      (t) => t.opportunity_id === opp.id && t.status === 'Pendente',
                    )
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const isTaskOverdue = oppTask ? oppTask.due_date < todayStr : false

                    return (
                      <div
                        key={opp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opp.id)}
                        onClick={() => openDetail(opp)}
                        className="p-3 rounded-lg border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition cursor-pointer active:cursor-grabbing space-y-2 text-xs relative group"
                      >
                        {/* Company & Contact */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <h4 className="font-bold text-[#101828] text-xs truncate">
                              {opp.title}
                            </h4>
                            <p className="text-[11px] text-[#667085] truncate flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3 shrink-0 text-[#667085]" />
                              <span>{company?.trade_name || 'Sem empresa'}</span>
                            </p>
                          </div>

                          {/* Temperature badge */}
                          {opp.temperature === 'Quente' && (
                            <span
                              title="Temperatura Quente"
                              className="p-1 rounded bg-red-50 text-red-600 shrink-0"
                            >
                              <Flame className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                            </span>
                          )}
                          {opp.temperature === 'Morno' && (
                            <span
                              title="Temperatura Morna"
                              className="p-1 rounded bg-amber-50 text-amber-600 shrink-0 text-[10px] font-semibold"
                            >
                              Morno
                            </span>
                          )}
                          {opp.temperature === 'Frio' && (
                            <span
                              title="Temperatura Fria"
                              className="p-1 rounded bg-blue-50 text-blue-600 shrink-0 text-[10px] font-semibold"
                            >
                              Frio
                            </span>
                          )}
                        </div>

                        {/* Product & Lives */}
                        <div className="flex items-center gap-1.5 text-[11px] text-[#667085] flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            {product?.name || 'Seguro / Plano'}
                          </Badge>
                          {opp.health_data?.lives_count && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-emerald-50 text-emerald-700 py-0"
                            >
                              {opp.health_data.lives_count} vidas
                            </Badge>
                          )}
                        </div>

                        {/* Values (Valor Vendido / Mensalidade + Faturamento KKJ) */}
                        <div className="pt-1 border-t border-[#E4E7EC] flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-[#667085] block">Mensalidade:</span>
                            <span className="font-extrabold text-[#1B2A4A]">
                              R$ {(opp.sale_value || 0).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#667085] block">
                              Faturamento KKJ:
                            </span>
                            <span className="font-semibold text-emerald-700 text-[11px]">
                              R$ {(opp.commission_value || 0).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Next Task (with visual highlight if overdue) */}
                        {oppTask && (
                          <div
                            className={`p-1.5 rounded flex items-center justify-between text-[10px] ${
                              isTaskOverdue
                                ? 'bg-red-50 text-red-700 border border-red-200 font-semibold'
                                : 'bg-[#F5F7FA] text-[#667085]'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="truncate">{oppTask.title}</span>
                            </span>
                            <span className="shrink-0 font-mono ml-1">
                              {isTaskOverdue ? 'Atrasada' : oppTask.due_date.slice(5)}
                            </span>
                          </div>
                        )}

                        {/* Card footer: Responsible & quick stage mover */}
                        <div
                          className="pt-1.5 border-t border-[#E4E7EC] flex items-center justify-between text-[10px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[#667085] truncate max-w-[120px]">
                            {assigned?.name || 'Corretor'}
                          </span>

                          <select
                            value={opp.stage}
                            onChange={(e) => handleQuickMove(opp, e.target.value)}
                            className="bg-transparent text-[#1B2A4A] font-semibold text-[10px] focus:outline-none cursor-pointer"
                          >
                            {currentStages.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                            {pipelineType === 'VENDAS' && (
                              <option value="Venda perdida">✕ Venda perdida</option>
                            )}
                          </select>
                        </div>
                      </div>
                    )
                  })}

                  {stageOpps.length === 0 && (
                    <div className="h-28 border-2 border-dashed border-[#E4E7EC] rounded-lg flex items-center justify-center text-[11px] text-[#667085]">
                      Arraste cards para cá
                    </div>
                  )}
                </div>

                {/* Column footer add button */}
                <div className="p-2 border-t border-[#E4E7EC] bg-white">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCreateModal(stageName)}
                    className="w-full text-xs text-[#667085] hover:text-[#101828] hover:bg-[#F5F7FA]"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Oportunidade
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE OPPORTUNITY MODAL */}
      <Dialog open={isNewOppOpen} onOpenChange={setIsNewOppOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-[#101828]">
              Nova Oportunidade ({pipelineType === 'VENDAS' ? 'Funil de Vendas' : 'Pós-Venda'})
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Preencha os dados do cliente, produto cotado e condições do plano
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveOpportunity} className="space-y-4 py-2 text-xs">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-900 border border-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Título da Oportunidade *</Label>
              <Input
                placeholder="Ex: Cotação Saúde PME 24 Vidas - Empresa XYZ"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Empresa / Cliente</Label>
                <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Contato Principal</Label>
                <Select value={formContactId} onValueChange={setFormContactId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione o contato" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableContacts.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.name} ({ct.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Produto</Label>
                <Select value={formProductId} onValueChange={setFormProductId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Etapa Inicial</Label>
                <Select value={formStage} onValueChange={setFormStage}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentStages.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Temperatura</Label>
                <Select
                  value={formTemperature}
                  onValueChange={(val) => setFormTemperature(val as Temperature)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Frio">Frio</SelectItem>
                    <SelectItem value="Morno">Morno</SelectItem>
                    <SelectItem value="Quente">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor da Venda / Mensalidade (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 12500"
                  value={formSaleValue}
                  onChange={(e) => setFormSaleValue(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Faturamento KKJ / Comissão (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 2500 (deixe vazio p/ 20% est.)"
                  value={formCommissionValue}
                  onChange={(e) => setFormCommissionValue(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origem do Lead</Label>
                <Input
                  placeholder="Ex: Indicação, Google Ads, WhatsApp"
                  value={formOrigin}
                  onChange={(e) => setFormOrigin(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tags (separadas por vírgula)</Label>
                <Input
                  placeholder="Ex: PME, Bradesco, Urgente"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Link da Cotação (Opcional)</Label>
              <Input
                placeholder="https://cotador.kkj.com.br/..."
                value={formQuotationLink}
                onChange={(e) => setFormQuotationLink(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Health optional fields toggle */}
            <div className="pt-2 border-t border-[#E4E7EC]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-[#1B2A4A] flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-emerald-600" />
                  Campos Específicos de Plano de Saúde (Opcional)
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={includeHealthData}
                    onChange={(e) => setIncludeHealthData(e.target.checked)}
                    className="rounded text-[#1B2A4A]"
                  />
                  <span>Preencher dados de saúde</span>
                </label>
              </div>

              {includeHealthData && (
                <div className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-100 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Operadora Atual</Label>
                      <Input
                        placeholder="Ex: SulAmérica"
                        value={healthOperator}
                        onChange={(e) => setHealthOperator(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Operadora Cotada</Label>
                      <Input
                        placeholder="Ex: Bradesco / Amil"
                        value={healthQuotedOperator}
                        onChange={(e) => setHealthQuotedOperator(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Qtd de Vidas</Label>
                      <Input
                        type="number"
                        placeholder="Ex: 24"
                        value={healthLives}
                        onChange={(e) => setHealthLives(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Acomodação</Label>
                      <Select value={healthAccommodation} onValueChange={setHealthAccommodation}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Enfermaria">Enfermaria</SelectItem>
                          <SelectItem value="Apartamento">Apartamento</SelectItem>
                          <SelectItem value="Ambos">Ambos / Misto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Objetivo</Label>
                      <Select value={healthObjective} onValueChange={setHealthObjective}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Reduzir custo">Reduzir custo</SelectItem>
                          <SelectItem value="Melhorar rede">Melhorar rede</SelectItem>
                          <SelectItem value="Trocar operadora">Trocar operadora</SelectItem>
                          <SelectItem value="Primeiro plano">Primeiro plano</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Hospitais / Rede Desejada</Label>
                    <Input
                      placeholder="Ex: Sírio-Libanês, Einstein, Oswaldo Cruz"
                      value={healthNetwork}
                      onChange={(e) => setHealthNetwork(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas de Qualificação</Label>
              <Textarea
                rows={2}
                placeholder="Observações importantes coletadas com o cliente..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewOppOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                size="sm"
                className="bg-[#1B2A4A] text-white text-xs"
              >
                {isSaving ? 'Salvando...' : 'Criar Oportunidade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: MOTIVO DA PERDA OBRIGATÓRIO (QUANDO MOVIDO NO PIPELINE) */}
      <Dialog open={isLostModalOpen} onOpenChange={setIsLostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Motivo da Perda (Obrigatório)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-[#667085]">
              Para encerrar esta oportunidade como perdida, indique o motivo determinante:
            </p>
            <Select
              value={lostReasonChoice}
              onValueChange={(val) => setLostReasonChoice(val as LostReason)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((reason) => (
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

      {/* 3-COLUMN DETAIL MODAL */}
      <OpportunityDetailModal
        opportunityId={detailOppId}
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setDetailOppId(null)
        }}
        onUpdated={fetchData}
        users={users}
        salesStages={SALES_STAGES}
        postSalesStages={POST_SALES_STAGES}
        lostReasons={LOST_REASONS}
      />
    </div>
  )
}
