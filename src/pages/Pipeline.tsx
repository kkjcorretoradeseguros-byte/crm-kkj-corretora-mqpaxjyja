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
import { carrierService } from '@/services/carrierService'
import { taskService } from '@/services/taskService'
import { userService } from '@/services/userService'
import { contractService } from '@/services/contractService'
import { tagService } from '@/services/tagService'
import { commissionEngine } from '@/services/commissionEngine'
import { adesaoService } from '@/services/adesaoService'
import { useAuth } from '@/contexts/AuthContext'
import { OpportunityDetailModal } from '@/components/OpportunityDetailModal'
import { VendaGanhaModal } from '@/components/VendaGanhaModal'
import type {
  Opportunity,
  Company,
  Contact,
  Product,
  Carrier,
  CrmTag,
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
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [crmTags, setCrmTags] = useState<CrmTag[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros avançados do Pipeline
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('TODAS')
  const [selectedCarrierFilter, setSelectedCarrierFilter] = useState<string>('TODAS')
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('TODOS')

  // Drag-and-drop state
  const [draggedOppId, setDraggedOppId] = useState<string | null>(null)

  // Modais de Venda Ganha e Perda
  const [isNewOppOpen, setIsNewOppOpen] = useState(false)
  const [detailOppId, setDetailOppId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLostModalOpen, setIsLostModalOpen] = useState(false)
  const [pendingLostOpp, setPendingLostOpp] = useState<Opportunity | null>(null)
  const [lostReasonChoice, setLostReasonChoice] = useState<LostReason>('Preço')
  const [isVendaGanhaOpen, setIsVendaGanhaOpen] = useState(false)
  const [vendaGanhaTargetOpp, setVendaGanhaTargetOpp] = useState<Opportunity | null>(null)

  // Novo Cadastro Rápido inline dentro do formulário
  const [showQuickCompany, setShowQuickCompany] = useState(false)
  const [showQuickContact, setShowQuickContact] = useState(false)
  const [quickCompanyName, setQuickCompanyName] = useState('')
  const [quickCompanyCnpj, setQuickCompanyCnpj] = useState('')
  const [quickContactName, setQuickContactName] = useState('')
  const [quickContactPhone, setQuickContactPhone] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  // New Opportunity Form states (flexíveis, sem exigência de empresa/CNPJ/telefone/email)
  const [formTitle, setFormTitle] = useState('')
  const [formCompanyId, setFormCompanyId] = useState('')
  const [formContactId, setFormContactId] = useState('')
  const [formProductId, setFormProductId] = useState('')
  const [formCarrierId, setFormCarrierId] = useState('')
  const [formSuggestedPlan, setFormSuggestedPlan] = useState('')
  const [formStage, setFormStage] = useState('Novo Lead')
  const [formTemperature, setFormTemperature] = useState<Temperature>('Morno')
  const [formQuotedValue, setFormQuotedValue] = useState('') // Valor da Cotação / Mensalidade (R$)
  const [formOrigin, setFormOrigin] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
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
      const [oppsRes, compRes, contRes, prodRes, carrRes, usersRes, tasksRes] = await Promise.all([
        opportunityService.getAllOpportunities(pipelineType),
        companyService.getAllCompanies(),
        contactService.getAllContacts(),
        productService.getAllProducts(),
        carrierService.getAllCarriers(),
        userService.getAllUsers(),
        taskService.getAllTasks(),
      ])
      setOpportunities(oppsRes)
      setCompanies(compRes)
      setContacts(contRes)
      setProducts(prodRes)
      setCarriers(carrRes)
      setUsers(usersRes)
      setTasks(tasksRes)
      setCrmTags(tagService.getAllTags())
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

    // Se for Venda Ganha no Funil de Vendas: EXIGIR conferência cadastral via VendaGanhaModal
    if (pipelineType === 'VENDAS' && targetStage === 'Venda ganha') {
      setVendaGanhaTargetOpp(opp)
      setIsVendaGanhaOpen(true)
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
    if (targetStage === 'Venda ganha' && pipelineType === 'VENDAS') {
      setVendaGanhaTargetOpp(opp)
      setIsVendaGanhaOpen(true)
      return
    }

    try {
      await opportunityService.updateStage(opp.id, targetStage, opp.stage)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  // Conclusão auditada e consistente de Venda Ganha com regras completas
  const handleConfirmVendaGanha = async (data: {
    contractedCarrierId: string
    contractedCarrierName: string
    contractedPlan: string
    contractedValue: number
    modalidade: string
    livesCount: number
    hiringDate: string
    firstInstallmentRef: string
    companyName: string
    cnpj: string
    contactName: string
    phone: string
    email: string
  }) => {
    if (!vendaGanhaTargetOpp) return

    // 1. Atualizar ou vincular Empresa e Contato com dados completos
    let companyId = vendaGanhaTargetOpp.company_id
    if (companyId) {
      await companyService.updateCompany(companyId, {
        trade_name: data.companyName,
        legal_name: data.companyName,
        cnpj: data.cnpj,
      })
    } else {
      const newComp = await companyService.createCompany({
        trade_name: data.companyName,
        legal_name: data.companyName,
        cnpj: data.cnpj,
      })
      companyId = newComp.id
    }

    let contactId = vendaGanhaTargetOpp.contact_id
    if (contactId) {
      await contactService.updateContact(contactId, {
        name: data.contactName,
        phone: data.phone,
        email: data.email,
        company_id: companyId,
      })
    } else {
      const newCont = await contactService.createContact({
        name: data.contactName,
        phone: data.phone,
        email: data.email,
        company_id: companyId,
      })
      contactId = newCont.id
    }

    // 2. Atualizar oportunidade com status de Venda Ganha e valores contratados
    await opportunityService.updateOpportunity(vendaGanhaTargetOpp.id, {
      stage: 'Venda ganha',
      company_id: companyId,
      contact_id: contactId,
      carrier_id: data.contractedCarrierId,
      value: data.contractedValue,
      sale_value: data.contractedValue,
    })

    // 3. Criar Contrato único e auditável
    const contractNum = `KKJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    const createdContract = await contractService.createContract({
      contract_number: contractNum,
      opportunity_id: vendaGanhaTargetOpp.id,
      company_id: companyId,
      contact_id: contactId,
      carrier_id: data.contractedCarrierId,
      product_id: vendaGanhaTargetOpp.product_id,
      plano: data.contractedPlan,
      sale_value: data.contractedValue,
      lives_count: data.livesCount,
      start_date: data.hiringDate,
      status: 'Em Implantação',
      assigned_to: vendaGanhaTargetOpp.assigned_to || user?.id,
      notes: `Venda Ganha concluída em ${new Date().toLocaleDateString('pt-BR')}. Ref 1ª Mensalidade: ${data.firstInstallmentRef}`,
    })

    // 4. Se for Adesão: Gerar 1º Boleto Integral KKJ (100% receita bruta da corretora)
    if (data.modalidade === 'Adesão') {
      await adesaoService.registrarPrimeiroBoleto({
        contract_id: createdContract.id,
        company_id: companyId,
        contact_id: contactId,
        vendedor_id: vendaGanhaTargetOpp.assigned_to || user?.id,
        valor_integral: data.contractedValue,
        data_vencimento: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
        aliquota_imposto: 0.11, // Padrão central KKJ 11%
      })
    }

    // 5. Timeline de Venda Ganha e Contrato Gerado
    await opportunityService.addTimelineEvent(
      vendaGanhaTargetOpp.id,
      'venda_ganha',
      `Venda Ganha concluída com sucesso! Contrato nº ${contractNum} (${data.contractedCarrierName} - ${data.contractedPlan}) gerado com mensalidade de R$ ${data.contractedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      {
        contract_id: createdContract.id,
        contract_number: contractNum,
        operadora_id: data.contractedCarrierId,
        mensalidade: data.contractedValue,
        vidas: data.livesCount,
      },
    )

    // 6. Criar automaticamente fluxo de Pós-Venda e registrar na timeline
    const posVendaOpp = await opportunityService.createOpportunity({
      title: `[Pós-Venda] ${data.companyName} (${data.contractedPlan})`,
      pipeline_type: 'POS_VENDA',
      stage: 'Documentação',
      temperature: 'Quente',
      company_id: companyId,
      contact_id: contactId,
      carrier_id: data.contractedCarrierId,
      assigned_to: vendaGanhaTargetOpp.assigned_to || user?.id,
      sale_value: data.contractedValue,
      origin: vendaGanhaTargetOpp.origin,
    })

    await opportunityService.addTimelineEvent(
      vendaGanhaTargetOpp.id,
      'pos_venda',
      `Lead encaminhado para o Funil de Pós-Venda (${posVendaOpp.title}). Etapa inicial: Documentação.`,
      { pos_venda_id: posVendaOpp.id },
    )

    setIsVendaGanhaOpen(false)
    setVendaGanhaTargetOpp(null)
    fetchData()
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
    setFormCompanyId('')
    setFormContactId('')
    setFormProductId('') // NÃO selecionar automaticamente nenhum produto (ex.: Adesão)
    setFormCarrierId(carriers[0]?.id || '')
    setFormSuggestedPlan('')
    setFormStage(initialStage || currentStages[0])
    setFormTemperature('Morno')
    setFormQuotedValue('')
    setFormOrigin('')
    setSelectedTags([])
    setFormQuotationLink('')
    setFormNotes('')
    setShowQuickCompany(false)
    setShowQuickContact(false)
    setQuickCompanyName('')
    setQuickCompanyCnpj('')
    setQuickContactName('')
    setQuickContactPhone('')
    setDuplicateWarning(null)
    setIncludeHealthData(true)
    setHealthOperator('')
    setHealthQuotedOperator('')
    setHealthLives('')
    setHealthNetwork('')
    setFormError(null)
    setIsNewOppOpen(true)
  }

  // Cadastro rápido inline de empresa
  const handleCreateQuickCompany = async () => {
    if (!quickCompanyName.trim()) return
    try {
      const created = await companyService.createCompany({
        trade_name: quickCompanyName.trim(),
        legal_name: quickCompanyName.trim(),
        cnpj: quickCompanyCnpj.trim() || undefined,
      })
      setCompanies((prev) => [created, ...prev])
      setFormCompanyId(created.id)
      setShowQuickCompany(false)
      setQuickCompanyName('')
      setQuickCompanyCnpj('')
    } catch (err: any) {
      setFormError(err.message || 'Erro ao cadastrar empresa rápida.')
    }
  }

  // Cadastro rápido inline de contato
  const handleCreateQuickContact = async () => {
    if (!quickContactName.trim()) return
    try {
      const created = await contactService.createContact({
        name: quickContactName.trim(),
        phone: quickContactPhone.trim(),
        company_id: formCompanyId || undefined,
      })
      setContacts((prev) => [created, ...prev])
      setFormContactId(created.id)
      setShowQuickContact(false)
      setQuickContactName('')
      setQuickContactPhone('')
    } catch (err: any) {
      setFormError(err.message || 'Erro ao cadastrar contato rápido.')
    }
  }

  // Verificação de possíveis duplicidades ao digitar nome/título
  const checkDuplicateWarning = (title: string) => {
    const trimmed = title.trim().toLowerCase()
    if (trimmed.length >= 3) {
      const match = opportunities.find((o) => o.title.toLowerCase().includes(trimmed))
      if (match) {
        setDuplicateWarning(
          `Atenção: Já existe uma oportunidade com título semelhante ("${match.title}").`,
        )
        return
      }
    }
    setDuplicateWarning(null)
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
      // Valor da Cotação / Mensalidade Comercial (podendo ficar vazio)
      const quotedVal = formQuotedValue ? parseFloat(formQuotedValue) : 0

      // Se o usuário digitou dados de contato rápido e não clicou em salvar
      let finalContactId = formContactId || undefined
      if (!finalContactId && quickContactName.trim()) {
        const quickC = await contactService.createContact({
          name: quickContactName.trim(),
          phone: quickContactPhone.trim() || '',
          company_id: formCompanyId || undefined,
        })
        setContacts((prev) => [quickC, ...prev])
        finalContactId = quickC.id
      }

      // Se o usuário digitou dados de empresa rápida e não clicou em salvar
      let finalCompanyId = formCompanyId || undefined
      if (!finalCompanyId && quickCompanyName.trim()) {
        const quickComp = await companyService.createCompany({
          trade_name: quickCompanyName.trim(),
          legal_name: quickCompanyName.trim(),
          cnpj: quickCompanyCnpj.trim() || undefined,
        })
        setCompanies((prev) => [quickComp, ...prev])
        finalCompanyId = quickComp.id
      }

      const payload: Partial<Opportunity> = {
        title: formTitle.trim(),
        pipeline_type: pipelineType,
        stage: formStage,
        temperature: formTemperature,
        company_id: finalCompanyId,
        contact_id: finalContactId,
        product_id: formProductId || undefined,
        carrier_id: formCarrierId || undefined,
        suggested_plan: formSuggestedPlan.trim() || undefined,
        assigned_to: user?.id,
        origin: formOrigin.trim() || undefined,
        tags: selectedTags,
        value: quotedVal,
        sale_value: quotedVal,
        quotation_link: formQuotationLink.trim() || undefined,
        qualification_notes: formNotes.trim() || undefined,
      }

      if (includeHealthData) {
        payload.health_data = {
          has_current_plan: !!healthOperator,
          current_operator: healthOperator,
          quoted_operator:
            healthQuotedOperator || carriers.find((c) => c.id === formCarrierId)?.nome || '',
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
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Indicadores Separados: Volume do Pipeline (Mensalidades em Negociação) vs Total Oportunidades */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7FA] border border-[#E4E7EC]">
            <span className="font-bold text-[#1B2A4A]">{totalOppsCount}</span>
            <span className="text-[#667085]">em negociação</span>
            <span className="text-slate-300">•</span>
            <span className="text-[#667085]">Volume do Pipeline (Mensalidades):</span>
            <strong className="text-[#1B2A4A] font-bold">
              R$ {totalSaleValue.toLocaleString('pt-BR')}
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

      {/* Barra de Filtros por Tag, Operadora e Responsável */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-[#E4E7EC] text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
          <Filter className="h-3.5 w-3.5" />
          <span>Filtros:</span>
        </div>

        {/* Filtro por Tag */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Tag:</span>
          <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
            <SelectTrigger className="h-7 text-xs w-[130px] bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as tags</SelectItem>
              {crmTags.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Operadora */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Operadora:</span>
          <Select value={selectedCarrierFilter} onValueChange={setSelectedCarrierFilter}>
            <SelectTrigger className="h-7 text-xs w-[140px] bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as operadoras</SelectItem>
              {carriers.map((car) => (
                <SelectItem key={car.id} value={car.id}>
                  {car.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Responsável */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Responsável:</span>
          <Select value={selectedOwnerFilter} onValueChange={setSelectedOwnerFilter}>
            <SelectTrigger className="h-7 text-xs w-[130px] bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos corretores</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            const stageOpps = opportunities.filter((o) => {
              if (o.stage !== stageName) return false
              if (selectedTagFilter !== 'TODAS') {
                const oppTags = Array.isArray(o.tags)
                  ? o.tags
                  : typeof o.tags === 'string'
                    ? [o.tags]
                    : []
                if (!oppTags.includes(selectedTagFilter)) return false
              }
              if (selectedCarrierFilter !== 'TODAS' && o.carrier_id !== selectedCarrierFilter) {
                return false
              }
              if (selectedOwnerFilter !== 'TODOS' && o.assigned_to !== selectedOwnerFilter) {
                return false
              }
              return true
            })
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

                        {/* Tags Coloridas */}
                        {Array.isArray(opp.tags) && opp.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {opp.tags.map((tName) => {
                              const tagObj = crmTags.find(
                                (t) => t.name.toLowerCase() === tName.toLowerCase(),
                              )
                              return (
                                <span
                                  key={tName}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                  style={{
                                    backgroundColor: tagObj?.bg_color || '#F1F5F9',
                                    color: tagObj?.text_color || '#334155',
                                  }}
                                >
                                  {tName}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {/* Mensalidade Comercial (Cotação Principal) - Sem estimativa de comissão */}
                        <div className="pt-1 border-t border-[#E4E7EC] flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-[#667085] block">
                              Mensalidade Cotação:
                            </span>
                            <span className="font-extrabold text-[#1B2A4A]">
                              R$ {(opp.sale_value || opp.value || 0).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">
                              Cotação Principal
                            </span>
                            <span className="text-[11px] font-medium text-slate-600">
                              {opp.expand?.carrier_id?.nome || 'Operadora'}
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
                onChange={(e) => {
                  setFormTitle(e.target.value)
                  checkDuplicateWarning(e.target.value)
                }}
                required
                className="h-8 text-xs"
              />
              {duplicateWarning && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1">
                  {duplicateWarning}
                </p>
              )}
            </div>

            {/* Cadastro Flexível: Empresa Opcional + Botão + Nova Empresa */}
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Empresa (Opcional na entrada)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickCompany(!showQuickCompany)}
                  className="h-6 text-[11px] text-blue-600 hover:text-blue-800 p-1"
                >
                  {showQuickCompany ? '✕ Fechar rápida' : '+ Nova empresa'}
                </Button>
              </div>

              {!showQuickCompany ? (
                <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecione empresa cadastrada ou deixe vazio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma / Lead sem empresa ainda</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name} {c.cnpj ? `(${c.cnpj})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2 rounded border border-blue-200">
                  <Input
                    placeholder="Nome Fantasia / Razão"
                    value={quickCompanyName}
                    onChange={(e) => setQuickCompanyName(e.target.value)}
                    className="h-7 text-xs sm:col-span-1"
                  />
                  <Input
                    placeholder="CNPJ (opcional)"
                    value={quickCompanyCnpj}
                    onChange={(e) => setQuickCompanyCnpj(e.target.value)}
                    className="h-7 text-xs sm:col-span-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateQuickCompany}
                    className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Salvar Empresa
                  </Button>
                </div>
              )}
            </div>

            {/* Cadastro Flexível: Contato Opcional + Botão + Novo Contato */}
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Contato (Opcional na entrada)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickContact(!showQuickContact)}
                  className="h-6 text-[11px] text-blue-600 hover:text-blue-800 p-1"
                >
                  {showQuickContact ? '✕ Fechar rápido' : '+ Novo contato'}
                </Button>
              </div>

              {!showQuickContact ? (
                <Select value={formContactId} onValueChange={setFormContactId}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecione contato cadastrado ou deixe vazio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum / Informar depois</SelectItem>
                    {availableContacts.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.name} {ct.phone ? `(${ct.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2 rounded border border-blue-200">
                  <Input
                    placeholder="Nome do cliente"
                    value={quickContactName}
                    onChange={(e) => setQuickContactName(e.target.value)}
                    className="h-7 text-xs sm:col-span-1"
                  />
                  <Input
                    placeholder="Telefone / WhatsApp"
                    value={quickContactPhone}
                    onChange={(e) => setQuickContactPhone(e.target.value)}
                    className="h-7 text-xs sm:col-span-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateQuickContact}
                    className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Salvar Contato
                  </Button>
                </div>
              )}
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

            {/* Sugestão de Plano (Operadora Sugerida e Plano Sugerido) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Operadora Sugerida</Label>
                <Select value={formCarrierId} onValueChange={setFormCarrierId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.map((car) => (
                      <SelectItem key={car.id} value={car.id}>
                        {car.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Plano Sugerido</Label>
                <Input
                  placeholder="Ex: Smart 500 / Nacional"
                  value={formSuggestedPlan}
                  onChange={(e) => setFormSuggestedPlan(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor da Cotação / Mensalidade (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Opcional. Ex: 1850.00"
                  value={formQuotedValue}
                  onChange={(e) => setFormQuotedValue(e.target.value)}
                  className="h-8 text-xs font-semibold"
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
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Tags Coloridas (clique para selecionar):</Label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {crmTags
                    .filter((t) => t.active)
                    .map((t) => {
                      const isSelected = selectedTags.includes(t.name)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTags((prev) => prev.filter((name) => name !== t.name))
                            } else {
                              setSelectedTags((prev) => [...prev, t.name])
                            }
                          }}
                          className={`px-2 py-1 rounded text-xs font-semibold border transition ${
                            isSelected
                              ? 'ring-2 ring-blue-500 shadow-sm'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: t.bg_color,
                            color: t.text_color,
                            borderColor: t.color,
                          }}
                        >
                          {isSelected ? `✓ ${t.name}` : `+ ${t.name}`}
                        </button>
                      )
                    })}
                </div>
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

      {/* MODAL RIGOROSO DE VENDA GANHA */}
      <VendaGanhaModal
        open={isVendaGanhaOpen}
        onClose={() => {
          setIsVendaGanhaOpen(false)
          setVendaGanhaTargetOpp(null)
        }}
        opportunity={vendaGanhaTargetOpp}
        carriers={carriers}
        companies={companies}
        contacts={contacts}
        onConfirm={handleConfirmVendaGanha}
      />
    </div>
  )
}
