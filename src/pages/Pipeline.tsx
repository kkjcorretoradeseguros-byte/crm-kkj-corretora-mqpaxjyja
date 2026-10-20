import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  KanbanSquare,
  Plus,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Filter,
  ShieldCheck,
  RotateCcw,
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
import { Skeleton } from '@/components/ui/skeleton'
import { opportunityService } from '@/services/opportunityService'
import { companyService } from '@/services/companyService'
import { contactService } from '@/services/contactService'
import { productService } from '@/services/productService'
import { carrierService } from '@/services/carrierService'
import { taskService } from '@/services/taskService'
import { userService } from '@/services/userService'
import { contractService } from '@/services/contractService'
import { supabase } from '@/lib/supabase/client'
import { tagService } from '@/services/tagService'
import { useAuth } from '@/contexts/AuthContext'
import { OpportunityDetailModal } from '@/components/OpportunityDetailModal'
import { VendaGanhaModal } from '@/components/VendaGanhaModal'
import { OpportunityCardView, type PipelineStageItem } from '@/components/OpportunityCard'
import { KanbanColumn } from '@/components/KanbanColumn'
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

const LOST_REASONS: LostReason[] = [
  'Preço',
  'Carência',
  'Rede hospitalar',
  'Concorrência',
  'Falta de retorno',
  'Decisão adiada',
  'Sem interesse',
  'Outros',
]

export default function Pipeline() {
  const { user } = useAuth()
  const isAdmin = user?.role?.toUpperCase() === 'ADMINISTRADOR'

  // Funil ativo (VENDAS ou POS_VENDA)
  const [pipelineType, setPipelineType] = useState<PipelineType>('VENDAS')

  // Etapas dinâmicas do banco (pipeline_stages do Supabase)
  const [stages, setStages] = useState<PipelineStageItem[]>([])

  // Estados principais
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

  // Drag-and-drop state com @dnd-kit
  const [activeDragOpp, setActiveDragOpp] = useState<Opportunity | null>(null)

  // Sensores otimizados para mouse (distância mínima de 4px para distinguir clique de arrasto) e toque (delay 200ms com tolerância de 5px)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 4,
    },
  })
  const keyboardSensor = useSensor(KeyboardSensor)
  const sensors = useSensors(pointerSensor, keyboardSensor)

  // Modais
  const [isNewOppOpen, setIsNewOppOpen] = useState(false)
  const [detailOppId, setDetailOppId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Modal de Venda Perdida
  const [isLostModalOpen, setIsLostModalOpen] = useState(false)
  const [pendingLostOpp, setPendingLostOpp] = useState<Opportunity | null>(null)
  const [lostReasonChoice, setLostReasonChoice] = useState<LostReason>('Preço')
  const [lostNotes, setLostNotes] = useState('')
  const [savingLost, setSavingLost] = useState(false)

  // Modal de Venda Ganha
  const [isVendaGanhaOpen, setIsVendaGanhaOpen] = useState(false)
  const [vendaGanhaTargetOpp, setVendaGanhaTargetOpp] = useState<Opportunity | null>(null)

  // Modal de Data Prevista do Primeiro Pagamento (Aguardando pagamento)
  const [pendingPaymentDateOpp, setPendingPaymentDateOpp] = useState<Opportunity | null>(null)
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('')
  const [savingPaymentDate, setSavingPaymentDate] = useState(false)

  // Modal de Confirmação do Primeiro Pagamento (Exclusivo Administrador)
  const [isConfirmPaymentModalOpen, setIsConfirmPaymentModalOpen] = useState(false)
  const [pendingConfirmPaymentOpp, setPendingConfirmPaymentOpp] = useState<Opportunity | null>(null)
  const [confirmPaymentDate, setConfirmPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [confirmPaymentError, setConfirmPaymentError] = useState<string | null>(null)
  const [savingConfirmPayment, setSavingConfirmPayment] = useState(false)

  // Modal de Implantação
  const [isImplantationModalOpen, setIsImplantationModalOpen] = useState(false)
  const [pendingImplantationOpp, setPendingImplantationOpp] = useState<Opportunity | null>(null)
  const [implantationDate, setImplantationDate] = useState(new Date().toISOString().slice(0, 10))
  const [implantationBlockMessage, setImplantationBlockMessage] = useState<string | null>(null)
  const [savingImplantation, setSavingImplantation] = useState(false)

  // Modal de Repescagem
  const [isRepescagemModalOpen, setIsRepescagemModalOpen] = useState(false)
  const [pendingRepescagemOpp, setPendingRepescagemOpp] = useState<Opportunity | null>(null)
  const [repescagemReason, setRepescagemReason] = useState('')
  const [repescagemContactDate, setRepescagemContactDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  )
  const [repescagemTime, setRepescagemTime] = useState('10:00')
  const [repescagemNotes, setRepescagemNotes] = useState('')
  const [savingRepescagem, setSavingRepescagem] = useState(false)

  // Formulário Nova Oportunidade
  const [showQuickCompany, setShowQuickCompany] = useState(false)
  const [showQuickContact, setShowQuickContact] = useState(false)
  const [quickCompanyName, setQuickCompanyName] = useState('')
  const [quickCompanyCnpj, setQuickCompanyCnpj] = useState('')
  const [quickContactName, setQuickContactName] = useState('')
  const [quickContactPhone, setQuickContactPhone] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formCompanyId, setFormCompanyId] = useState('')
  const [formContactId, setFormContactId] = useState('')
  const [formProductId, setFormProductId] = useState('')
  const [formCarrierId, setFormCarrierId] = useState('')
  const [formSuggestedPlan, setFormSuggestedPlan] = useState('')
  const [formStage, setFormStage] = useState('')
  const [formTemperature, setFormTemperature] = useState<Temperature>('Morno')
  const [formQuotedValue, setFormQuotedValue] = useState('')
  const [formOrigin, setFormOrigin] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [formQuotationLink, setFormQuotationLink] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Carregar dados e etapas dinamicamente
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [stagesRes, oppsRes, compRes, contRes, prodRes, carrRes, usersRes, tasksRes] =
        await Promise.all([
          opportunityService.getPipelineStages(pipelineType),
          opportunityService.getAllOpportunities(pipelineType),
          companyService.getAllCompanies(),
          contactService.getAllContacts(),
          productService.getAllProducts(),
          carrierService.getAllCarriers(),
          userService.getAllUsers(),
          taskService.getAllTasks(),
        ])

      // Ordenar rigorosamente pela coluna ordem do banco
      const sortedStages = [...stagesRes].sort((a, b) => a.ordem - b.ordem)
      setStages(sortedStages)
      setOpportunities(oppsRes)
      setCompanies(compRes)
      setContacts(contRes)
      setProducts(prodRes)
      setCarriers(carrRes)
      setUsers(usersRes)
      setTasks(tasksRes)
      setCrmTags(tagService.getAllTags())
    } catch (err) {
      console.error('Falha ao carregar dados do pipeline:', err)
    } finally {
      setLoading(false)
    }
  }, [pipelineType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Contatos disponíveis pela empresa
  const availableContacts = useMemo(() => {
    if (!formCompanyId) return contacts
    return contacts.filter((c) => c.company_id === formCompanyId)
  }, [contacts, formCompanyId])

  // Indicadores do topo
  const totalOppsCount = opportunities.length
  const totalSaleValue = opportunities.reduce((sum, o) => sum + (o.sale_value || 0), 0)

  // Lista de etapas disponíveis (para selects e formulários)
  const currentStageNames = useMemo(() => stages.map((s) => s.nome), [stages])

  // Central de transição de etapa (usada tanto pelo DnD quanto pelo QuickMove)
  const executeStageTransition = async (
    opp: Opportunity,
    targetStage: string,
    targetStageId?: string,
  ) => {
    if (opp.stage === targetStage) return

    // 1. Venda Ganha no Funil de Vendas: EXIGIR conferência cadastral dos 4 marcos
    if (pipelineType === 'VENDAS' && targetStage.toLowerCase() === 'venda ganha') {
      setVendaGanhaTargetOpp(opp)
      setIsVendaGanhaOpen(true)
      return
    }

    // 2. Venda Perdida / Perdido no Funil de Vendas: EXIGIR motivo obrigatório
    if (
      pipelineType === 'VENDAS' &&
      (targetStage.toLowerCase() === 'venda perdida' || targetStage.toLowerCase() === 'perdido')
    ) {
      setPendingLostOpp(opp)
      setLostReasonChoice('Preço')
      setLostNotes('')
      setIsLostModalOpen(true)
      return
    }

    // 3. Repescagem no Funil de Vendas: EXIGIR motivo + data de novo contato obrigatórios + criar tarefa
    if (pipelineType === 'VENDAS' && targetStage.toLowerCase() === 'repescagem') {
      setPendingRepescagemOpp(opp)
      setRepescagemReason('')
      setRepescagemNotes('')
      setRepescagemContactDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
      setIsRepescagemModalOpen(true)
      return
    }

    // 4. Aguardando pagamento no Funil de Pós-Venda: solicitar data prevista
    if (pipelineType === 'POS_VENDA' && targetStage.toLowerCase() === 'aguardando pagamento') {
      setPendingPaymentDateOpp(opp)
      setExpectedPaymentDate('')
      return
    }

    // 5. Implantação / Implantado no Funil de Pós-Venda: VALIDAR antes de efetivar
    if (
      pipelineType === 'POS_VENDA' &&
      (targetStage.toLowerCase() === 'implantado' || targetStage.toLowerCase() === 'implantação')
    ) {
      setPendingImplantationOpp(opp)
      setImplantationBlockMessage(null)
      setImplantationDate(new Date().toISOString().slice(0, 10))
      setIsImplantationModalOpen(true)
      return
    }

    // 6. Transição direta padrão (com atualização otimista e reversão em caso de erro)
    const previousStage = opp.stage
    const previousStageId = opp.stage_id

    // Atualização otimista
    setOpportunities((prev) =>
      prev.map((item) =>
        item.id === opp.id
          ? {
              ...item,
              stage: targetStage,
              stage_id: targetStageId || item.stage_id,
            }
          : item,
      ),
    )

    try {
      await opportunityService.updateStage(
        opp.id,
        targetStage,
        previousStage,
        undefined,
        targetStageId,
      )
      // Confirmação com dados frescos do Supabase
      await fetchData()
    } catch (err: any) {
      console.error('Falha ao atualizar etapa da oportunidade:', err)
      // Reversão do card para a coluna original
      setOpportunities((prev) =>
        prev.map((item) =>
          item.id === opp.id
            ? {
                ...item,
                stage: previousStage,
                stage_id: previousStageId,
              }
            : item,
        ),
      )
      alert(
        `Não foi possível mover a oportunidade para "${targetStage}". A alteração foi revertida.\n\nDetalhes: ${
          err?.message || 'Erro de comunicação com o Supabase'
        }`,
      )
      await fetchData()
    }
  }

  // Handlers do DndContext (@dnd-kit)
  const handleDndDragStart = (event: DragStartEvent) => {
    const { active } = event
    const foundOpp = opportunities.find((o) => o.id === active.id)
    if (foundOpp) {
      setActiveDragOpp(foundOpp)
    }
  }

  const handleDndDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragOpp(null)

    if (!over) return

    const oppId = String(active.id)
    const opp = opportunities.find((o) => o.id === oppId)
    if (!opp) return

    const targetStageIdOrName = String(over.id)
    // Localizar a etapa alvo por id ou por nome
    const targetStageItem = stages.find(
      (s) => s.id === targetStageIdOrName || s.nome === targetStageIdOrName,
    )
    if (!targetStageItem) return

    await executeStageTransition(opp, targetStageItem.nome, targetStageItem.id)
  }

  const handleDndDragCancel = () => {
    setActiveDragOpp(null)
  }

  // Quick Move via Select do card
  const handleQuickMove = async (opp: Opportunity, targetStageName: string) => {
    const targetStage = stages.find((s) => s.nome.toLowerCase() === targetStageName.toLowerCase())
    await executeStageTransition(opp, targetStageName, targetStage?.id)
  }

  // Conclusão auditada de Venda Ganha
  const handleConfirmVendaGanha = async (data: {
    origem_comercial_lead: 'kkj' | 'vendedor'
    contractedCarrierId: string
    contractedCarrierName: string
    contractedPlan: string
    contractedValue: number
    modalidade: string
    livesCount: number
    hiringDate: string
    firstInstallmentRef: string
    firstPaymentDueDate: string
    paymentConfirmedDate?: string
    isPaymentConfirmed?: boolean
    companyName: string
    cnpj: string
    contactName: string
    phone: string
    email: string
  }) => {
    if (!vendaGanhaTargetOpp) return
    if (
      !Number.isFinite(data.contractedValue) ||
      data.contractedValue <= 0 ||
      !Number.isInteger(data.livesCount) ||
      data.livesCount < 1
    ) {
      alert('Informe mensalidade positiva e quantidade de vidas válida.')
      return
    }
    if (data.isPaymentConfirmed && !data.paymentConfirmedDate) {
      alert('Informe a data do pagamento confirmado.')
      return
    }
    if (data.isPaymentConfirmed && user?.role !== 'ADMINISTRADOR') {
      alert('A confirmação de pagamento exige perfil administrador.')
      return
    }

    try {
      const existingContracts = await contractService.getContracts({
        opportunity_id: vendaGanhaTargetOpp.id,
      })

      if (existingContracts.totalItems > 1) {
        throw new Error(
          'Há mais de um contrato vinculado a esta oportunidade. Selecione o contrato correto antes de reprocessar a venda.',
        )
      }

      let activeContract = existingContracts.items[0]
      if (activeContract) {
        // Não alterar a origem comercial após a geração do financeiro:
        // o snapshot de comissões mantém os percentuais da origem anterior.
        const { data: existingFinancial, error: financialCheckError } = await supabase
          .from('contract_financials')
          .select('id')
          .eq('contract_id', activeContract.id)
          .maybeSingle()
        if (financialCheckError) {
          throw new Error(
            'Não foi possível verificar o financeiro existente: ' + financialCheckError.message,
          )
        }
        if (
          existingFinancial &&
          activeContract.origem_comercial_lead !== data.origem_comercial_lead
        ) {
          throw new Error(
            'Contrato com comissões geradas: não é permitido alterar a origem comercial sem revisão financeira administrativa.',
          )
        }
        if (
          existingFinancial &&
          (activeContract.carrier_id !== data.contractedCarrierId ||
            Number(activeContract.sale_value) !== data.contractedValue ||
            Number(activeContract.lives_count || 1) !== data.livesCount ||
            (activeContract.first_installment_reference || '').slice(0, 7) !==
              data.firstInstallmentRef.slice(0, 7))
        ) {
          throw new Error(
            'Contrato com financeiro existente: dados que afetam as comissões exigem revisão administrativa.',
          )
        }
      }

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

      const contractNum = activeContract
        ? activeContract.contract_number
        : `KKJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

      if (activeContract) {
        activeContract = await contractService.updateContract(activeContract.id, {
          company_id: companyId,
          contact_id: contactId,
          carrier_id: data.contractedCarrierId,
          plano: data.contractedPlan,
          sale_value: data.contractedValue,
          lives_count: data.livesCount,
          start_date: data.hiringDate,
          origem_comercial_lead: data.origem_comercial_lead,
          data_vencimento_primeiro_pagamento: data.firstPaymentDueDate,
          data_confirmacao_pagamento: data.isPaymentConfirmed
            ? data.paymentConfirmedDate
            : undefined,
          usuario_confirmou_pagamento_id: data.isPaymentConfirmed
            ? user?.id || undefined
            : undefined,
          primeira_competencia: data.firstInstallmentRef,
          first_installment_reference: data.firstInstallmentRef,
          status: activeContract.status === 'Ativo' ? 'Ativo' : 'Em Implantação',
          assigned_to: vendaGanhaTargetOpp.assigned_to || user?.id,
          notes: `Venda Ganha reprocessada em ${new Date().toLocaleDateString('pt-BR')}. Ref 1ª Mensalidade: ${data.firstInstallmentRef} | 1º Vencimento: ${data.firstPaymentDueDate}`,
        })
      } else {
        activeContract = await contractService.createContract({
          contract_number: contractNum,
          opportunity_id: vendaGanhaTargetOpp.id,
          company_id: companyId,
          contact_id: contactId,
          carrier_id: data.contractedCarrierId,
          product_id: vendaGanhaTargetOpp.product_id,
          origem_comercial_lead: data.origem_comercial_lead,
          plano: data.contractedPlan,
          sale_value: data.contractedValue,
          lives_count: data.livesCount,
          start_date: data.hiringDate,
          data_vencimento_primeiro_pagamento: data.firstPaymentDueDate,
          data_confirmacao_pagamento: data.isPaymentConfirmed
            ? data.paymentConfirmedDate
            : undefined,
          usuario_confirmou_pagamento_id: data.isPaymentConfirmed
            ? user?.id || undefined
            : undefined,
          primeira_competencia: data.firstInstallmentRef,
          first_installment_reference: data.firstInstallmentRef,
          status: 'Em Implantação',
          assigned_to: vendaGanhaTargetOpp.assigned_to || user?.id,
          notes: `Venda Ganha concluída em ${new Date().toLocaleDateString('pt-BR')}. Ref 1ª Mensalidade: ${data.firstInstallmentRef} | 1º Vencimento: ${data.firstPaymentDueDate}`,
        })
      }

      // O cadastro da venda pode já conter a confirmação do primeiro pagamento.
      // Nessa situação, concluir também o recebimento inicial e a previsão financeira.
      // A rotina é idempotente e não marca o repasse ao vendedor como pago.
      if (data.isPaymentConfirmed) {
        const { ensureConfirmedContractForecast } =
          await import('@/services/commissionForecastService')
        await ensureConfirmedContractForecast(activeContract.id)
      }

      await opportunityService.updateOpportunity(vendaGanhaTargetOpp.id, {
        stage: 'Venda ganha',
        company_id: companyId,
        contact_id: contactId,
        carrier_id: data.contractedCarrierId,
        value: data.contractedValue,
        sale_value: data.contractedValue,
      })

      await opportunityService.addTimelineEvent(
        vendaGanhaTargetOpp.id,
        'venda_contrato',
        `Venda Ganha concluída com sucesso! Contrato nº ${contractNum} (${data.contractedCarrierName} - ${data.contractedPlan}) gerado com mensalidade de R$ ${data.contractedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Vencimento 1º pagamento: ${data.firstPaymentDueDate}.`,
        {
          contract_id: activeContract.id,
          contract_number: contractNum,
          operadora_id: data.contractedCarrierId,
          mensalidade: data.contractedValue,
          vidas: data.livesCount,
          primeiro_vencimento: data.firstPaymentDueDate,
          primeiro_pagamento_confirmado: !!data.isPaymentConfirmed,
        },
      )

      // A mesma oportunidade segue para o pós-venda, preservando contrato e histórico.
      await opportunityService.updateOpportunity(vendaGanhaTargetOpp.id, {
        pipeline_type: 'POS_VENDA',
        stage: 'Documentação',
      })
      await opportunityService.addTimelineEvent(
        vendaGanhaTargetOpp.id,
        'mudanca_etapa',
        'Venda concluída e encaminhada ao Pós-venda. Etapa inicial: Documentação.',
        { contract_id: activeContract.id },
      )

      setIsVendaGanhaOpen(false)
      setVendaGanhaTargetOpp(null)
      await fetchData()
    } catch (err: any) {
      console.error('Falha ao concluir Venda Ganha:', err)
      alert(
        `Erro ao concluir venda ganha: ${err?.message || 'Verifique a conexão ou os dados informados.'}`,
      )
    }
  }

  // Confirmação de Venda Perdida
  const handleConfirmLost = async () => {
    if (!pendingLostOpp) return
    setSavingLost(true)
    try {
      await opportunityService.updateStage(
        pendingLostOpp.id,
        'Perdido',
        pendingLostOpp.stage,
        lostReasonChoice,
      )
      if (lostNotes.trim()) {
        await opportunityService.addTimelineNote(
          pendingLostOpp.id,
          `Motivo da perda detalhado: ${lostReasonChoice} — ${lostNotes.trim()}`,
        )
      }
      setIsLostModalOpen(false)
      setPendingLostOpp(null)
      setLostNotes('')
      await fetchData()
    } catch (err: any) {
      alert(`Erro ao registrar venda perdida: ${err?.message || 'Erro inesperado'}`)
    } finally {
      setSavingLost(false)
    }
  }

  // Confirmação de Repescagem
  const handleConfirmRepescagem = async () => {
    if (!pendingRepescagemOpp) return
    if (!repescagemReason.trim()) {
      alert('O motivo do envio para repescagem é obrigatório.')
      return
    }
    if (!repescagemContactDate) {
      alert('A data de novo contato é obrigatória.')
      return
    }

    setSavingRepescagem(true)
    try {
      // 1. Atualizar etapa da oportunidade para Repescagem
      await opportunityService.updateStage(
        pendingRepescagemOpp.id,
        'Repescagem',
        pendingRepescagemOpp.stage,
        repescagemReason.trim(),
      )

      // 2. Criar tarefa obrigatória de acompanhamento vinculada
      await taskService.createTask({
        opportunity_id: pendingRepescagemOpp.id,
        contact_id: pendingRepescagemOpp.contact_id,
        company_id: pendingRepescagemOpp.company_id,
        title: `Repescagem: ${pendingRepescagemOpp.title}`,
        type: 'Follow-up',
        due_date: repescagemContactDate,
        due_time: repescagemTime || '10:00',
        priority: 'Alta',
        status: 'Pendente',
        assigned_to: pendingRepescagemOpp.assigned_to || user?.id,
        notes: `Motivo da repescagem: ${repescagemReason.trim()}${
          repescagemNotes.trim() ? `\nObservações: ${repescagemNotes.trim()}` : ''
        }`,
      })

      // 3. Registrar na timeline
      await opportunityService.addTimelineEvent(
        pendingRepescagemOpp.id,
        'repescagem',
        `Oportunidade enviada para Repescagem. Motivo: ${repescagemReason.trim()}. Novo contato agendado para ${repescagemContactDate}${
          repescagemTime ? ` às ${repescagemTime}` : ''
        }.`,
        {
          motivo: repescagemReason.trim(),
          data_contato: repescagemContactDate,
          horario: repescagemTime,
        },
      )

      setIsRepescagemModalOpen(false)
      setPendingRepescagemOpp(null)
      setRepescagemReason('')
      setRepescagemNotes('')
      await fetchData()
    } catch (err: any) {
      alert(`Erro ao registrar repescagem: ${err?.message || 'Erro inesperado'}`)
    } finally {
      setSavingRepescagem(false)
    }
  }

  // Confirmação do Primeiro Pagamento (Exclusivo Administrador)
  const handleConfirmFirstPayment = async () => {
    if (!pendingConfirmPaymentOpp) return
    if (!confirmPaymentDate) {
      setConfirmPaymentError('Informe a data efetiva do recebimento.')
      return
    }

    setSavingConfirmPayment(true)
    setConfirmPaymentError(null)

    try {
      const contract = await contractService.getContractForOpportunity(pendingConfirmPaymentOpp.id)

      if (!contract) {
        throw new Error('Nenhum contrato vinculado foi localizado para esta oportunidade.')
      }

      await contractService.confirmFirstPayment(contract.id, confirmPaymentDate)

      setIsConfirmPaymentModalOpen(false)
      setPendingConfirmPaymentOpp(null)
      await fetchData()
    } catch (err: any) {
      setConfirmPaymentError(err?.message || 'Falha ao confirmar o primeiro pagamento.')
    } finally {
      setSavingConfirmPayment(false)
    }
  }

  // Execução de Implantação no Funil de Pós-Venda
  const handleExecuteImplantation = async () => {
    if (!pendingImplantationOpp) return
    setSavingImplantation(true)
    setImplantationBlockMessage(null)

    try {
      const contract = await contractService.getContractForOpportunity(pendingImplantationOpp.id)

      if (!contract) {
        setImplantationBlockMessage(
          'Não é possível implantar este contrato. Nenhum contrato vinculado foi localizado.',
        )
        return
      }

      // Validar primeiro pagamento
      const isConfirmed = !!contract.data_confirmacao_pagamento || contract.status === 'Ativo'
      if (!isConfirmed) {
        setImplantationBlockMessage(
          'Não é possível implantar este contrato. O primeiro pagamento ainda não foi confirmado.',
        )
        return
      }

      // Concluir implantação auditada via contractService
      await contractService.markAsImplanted(contract.id, implantationDate)

      // Atualizar etapa da oportunidade para Implantado
      await opportunityService.updateStage(
        pendingImplantationOpp.id,
        'Implantado',
        pendingImplantationOpp.stage,
      )

      setIsImplantationModalOpen(false)
      setPendingImplantationOpp(null)
      await fetchData()
    } catch (err: any) {
      setImplantationBlockMessage(err?.message || 'Erro ao processar implantação no Supabase.')
    } finally {
      setSavingImplantation(false)
    }
  }

  const openCreateModal = (initialStage?: string) => {
    setFormTitle('')
    setFormCompanyId('')
    setFormContactId('')
    setFormProductId('')
    setFormCarrierId(carriers[0]?.id || '')
    setFormSuggestedPlan('')
    setFormStage(initialStage || stages[0]?.nome || 'Novo Lead')
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
    setFormError(null)
    setIsNewOppOpen(true)
  }

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
      const quotedVal = formQuotedValue ? parseFloat(formQuotedValue) : 0

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
        stage: formStage || stages[0]?.nome || 'Novo Lead',
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

      await opportunityService.createOpportunity(payload)
      setIsNewOppOpen(false)
      await fetchData()
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
      {/* Barra Operacional Superior */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-card text-card-foreground border border-border shadow-sm">
        {/* Seletor de Funil */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow-sm">
            <KanbanSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Funil Ativo:
              </span>
              <Select
                value={pipelineType}
                onValueChange={(val) => setPipelineType(val as PipelineType)}
              >
                <SelectTrigger className="h-8 font-extrabold text-sm text-foreground bg-transparent border-none shadow-none p-0 focus:ring-0 gap-1.5 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="VENDAS" className="font-bold text-foreground">
                    FUNIL DE VENDAS ▾
                  </SelectItem>
                  <SelectItem value="POS_VENDA" className="font-bold text-foreground">
                    FUNIL DE PÓS-VENDA ▾
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {stages.length > 0
                ? stages.map((s) => s.nome).join(' → ')
                : pipelineType === 'VENDAS'
                  ? 'Carregando etapas do Funil Comercial...'
                  : 'Carregando etapas do Funil de Pós-Venda...'}
            </p>
          </div>
        </div>

        {/* Indicadores & Ação */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border">
            <span className="font-bold text-foreground">{totalOppsCount}</span>
            <span className="text-muted-foreground">em negociação</span>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-muted-foreground">Volume do Pipeline (Mensalidades):</span>
            <strong className="text-foreground font-bold">
              R$ {totalSaleValue.toLocaleString('pt-BR')}
            </strong>
          </div>

          <Button
            onClick={() => openCreateModal()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 text-xs shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* Barra de Filtros por Tag, Operadora e Responsável */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-semibold mr-1">
          <Filter className="h-3.5 w-3.5" />
          <span>Filtros:</span>
        </div>

        {/* Filtro por Tag */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Tag:</span>
          <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
            <SelectTrigger className="h-7 text-xs w-[130px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
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
          <span className="text-muted-foreground">Operadora:</span>
          <Select value={selectedCarrierFilter} onValueChange={setSelectedCarrierFilter}>
            <SelectTrigger className="h-7 text-xs w-[140px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
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
          <span className="text-muted-foreground">Responsável:</span>
          <Select value={selectedOwnerFilter} onValueChange={setSelectedOwnerFilter}>
            <SelectTrigger className="h-7 text-xs w-[130px] bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
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

      {/* Kanban Board Dinâmico com DndContext e DragOverlay */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="w-80 h-[560px] shrink-0 rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDndDragStart}
          onDragEnd={handleDndDragEnd}
          onDragCancel={handleDndDragCancel}
        >
          <div className="flex gap-4 overflow-x-auto pb-6 items-start min-h-[640px]">
            {stages.map((stageItem, stageIdx) => {
              const stageName = stageItem.nome
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

              return (
                <KanbanColumn
                  key={stageItem.id || stageName}
                  stageItem={stageItem}
                  stageIndex={stageIdx}
                  opportunities={stageOpps}
                  companies={companies}
                  products={products}
                  carriers={carriers}
                  users={users}
                  tasks={tasks}
                  crmTags={crmTags}
                  stages={stages}
                  pipelineType={pipelineType}
                  isAdmin={isAdmin}
                  useDroppableHook={useDroppable}
                  useDraggableHook={useDraggable}
                  onOpenDetail={openDetail}
                  onMoveToStage={handleQuickMove}
                  onOpenConfirmPayment={(opp) => {
                    setPendingConfirmPaymentOpp(opp)
                    setConfirmPaymentDate(new Date().toISOString().slice(0, 10))
                    setConfirmPaymentError(null)
                    setIsConfirmPaymentModalOpen(true)
                  }}
                  onAddOpportunity={openCreateModal}
                />
              )
            })}
          </div>

          {/* DragOverlay renderiza o card acompanhando fielmente o cursor em tempo real */}
          <DragOverlay dropAnimation={null}>
            {activeDragOpp ? (
              <div className="w-80 pointer-events-none">
                <OpportunityCardView
                  opp={activeDragOpp}
                  companies={companies}
                  products={products}
                  carriers={carriers}
                  users={users}
                  tasks={tasks}
                  crmTags={crmTags}
                  stages={stages}
                  pipelineType={pipelineType}
                  isAdmin={isAdmin}
                  isOverlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* MODAL 1: CONFIRMAÇÃO DO PRIMEIRO PAGAMENTO (Exclusivo Administrador) */}
      <Dialog
        open={isConfirmPaymentModalOpen}
        onOpenChange={(open) => {
          if (!open && !savingConfirmPayment) {
            setIsConfirmPaymentModalOpen(false)
            setPendingConfirmPaymentOpp(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Confirmação do Primeiro Pagamento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ação exclusiva do administrador da KKJ. Registre a data REAL em que o primeiro
              pagamento foi recebido para auditar a liquidação financeira do contrato.
            </DialogDescription>
          </DialogHeader>

          {confirmPaymentError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{confirmPaymentError}</span>
            </div>
          )}

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
              <p className="font-semibold text-foreground">
                {pendingConfirmPaymentOpp?.title || 'Contrato'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Valor mensal contratado: R${' '}
                {(pendingConfirmPaymentOpp?.sale_value || 0).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirm-payment-date" className="text-xs font-semibold">
                Data REAL do Pagamento Recebido *
              </Label>
              <Input
                id="confirm-payment-date"
                type="date"
                value={confirmPaymentDate}
                onChange={(e) => setConfirmPaymentDate(e.target.value)}
                className="h-8 text-xs font-semibold"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Não informe data prevista. A confirmação auditará a liberação para implantação.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingConfirmPayment}
              onClick={() => {
                setIsConfirmPaymentModalOpen(false)
                setPendingConfirmPaymentOpp(null)
              }}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingConfirmPayment || !confirmPaymentDate}
              onClick={handleConfirmFirstPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {savingConfirmPayment ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: VALIDAÇÃO E EXECUÇÃO DE IMPLANTAÇÃO */}
      <Dialog
        open={isImplantationModalOpen}
        onOpenChange={(open) => {
          if (!open && !savingImplantation) {
            setIsImplantationModalOpen(false)
            setPendingImplantationOpp(null)
            setImplantationBlockMessage(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Implantação do Contrato
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A implantação ativa formalmente o contrato na KKJ Corretora e requer primeiro
              pagamento auditado.
            </DialogDescription>
          </DialogHeader>

          {implantationBlockMessage ? (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-600 border border-red-500/25 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Implantação Bloqueada</span>
              </div>
              <p className="text-xs leading-relaxed">{implantationBlockMessage}</p>
            </div>
          ) : (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="font-semibold text-foreground">
                  {pendingImplantationOpp?.title || 'Contrato'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ao confirmar, o contrato será ativado e registrado na timeline com data de
                  implantação e usuário responsável.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="implantation-date" className="text-xs font-semibold">
                  Data Efetiva da Implantação *
                </Label>
                <Input
                  id="implantation-date"
                  type="date"
                  value={implantationDate}
                  onChange={(e) => setImplantationDate(e.target.value)}
                  className="h-8 text-xs font-semibold"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingImplantation}
              onClick={() => {
                setIsImplantationModalOpen(false)
                setPendingImplantationOpp(null)
                setImplantationBlockMessage(null)
              }}
              className="text-xs"
            >
              Fechar
            </Button>
            {!implantationBlockMessage && (
              <Button
                type="button"
                size="sm"
                disabled={savingImplantation}
                onClick={handleExecuteImplantation}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
              >
                {savingImplantation ? 'Implantando...' : 'Confirmar Implantação'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: MOTIVO DE VENDA PERDIDA OBRIGATÓRIO */}
      <Dialog
        open={isLostModalOpen}
        onOpenChange={(open) => {
          if (!open && !savingLost) {
            setIsLostModalOpen(false)
            setPendingLostOpp(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Motivo da Perda (Obrigatório)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Para encerrar esta oportunidade como perdida, indique o motivo determinante para a
              auditoria comercial da corretora.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Motivo Principal *</Label>
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

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações / Detalhes (Opcional)</Label>
              <Textarea
                rows={3}
                placeholder="Ex: Cliente fechou proposta direta com operadora concorrente por valor 15% menor..."
                value={lostNotes}
                onChange={(e) => setLostNotes(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingLost}
              onClick={() => {
                setIsLostModalOpen(false)
                setPendingLostOpp(null)
              }}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingLost}
              onClick={handleConfirmLost}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              {savingLost ? 'Salvando...' : 'Confirmar Venda Perdida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: REPESCAGEM COM MOTIVO E TAREFA DE NOVO CONTATO OBRIGATÓRIOS */}
      <Dialog
        open={isRepescagemModalOpen}
        onOpenChange={(open) => {
          if (!open && !savingRepescagem) {
            setIsRepescagemModalOpen(false)
            setPendingRepescagemOpp(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Enviar para Repescagem
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A repescagem mantém o lead no funil comercial com motivo registrado e agenda uma
              tarefa obrigatória de acompanhamento futuro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="repescagem-reason" className="text-xs font-semibold">
                Motivo da Repescagem *
              </Label>
              <Input
                id="repescagem-reason"
                placeholder="Ex: Contrato atual vence em 60 dias / aguardar próxima assembleia"
                value={repescagemReason}
                onChange={(e) => setRepescagemReason(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="repescagem-date" className="text-xs font-semibold">
                  Data de Novo Contato *
                </Label>
                <Input
                  id="repescagem-date"
                  type="date"
                  value={repescagemContactDate}
                  onChange={(e) => setRepescagemContactDate(e.target.value)}
                  className="h-8 text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="repescagem-time" className="text-xs font-semibold">
                  Horário Previsto
                </Label>
                <Input
                  id="repescagem-time"
                  type="time"
                  value={repescagemTime}
                  onChange={(e) => setRepescagemTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações Complementares</Label>
              <Textarea
                rows={2}
                placeholder="Orientação para o corretor quando a tarefa for aberta..."
                value={repescagemNotes}
                onChange={(e) => setRepescagemNotes(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingRepescagem}
              onClick={() => {
                setIsRepescagemModalOpen(false)
                setPendingRepescagemOpp(null)
              }}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingRepescagem || !repescagemReason.trim() || !repescagemContactDate}
              onClick={handleConfirmRepescagem}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            >
              {savingRepescagem ? 'Agendando...' : 'Salvar Repescagem & Criar Tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: DATA PREVISTA DO PRIMEIRO PAGAMENTO */}
      <Dialog
        open={!!pendingPaymentDateOpp}
        onOpenChange={(open) => {
          if (!open && !savingPaymentDate) setPendingPaymentDateOpp(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Data Prevista do Primeiro Pagamento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Informe a previsão antes de avançar para a etapa Aguardando pagamento. Esta data não
              confirma o recebimento financeiro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <Label htmlFor="expected-first-payment-date" className="font-semibold">
              Data Prevista de Vencimento *
            </Label>
            <Input
              id="expected-first-payment-date"
              type="date"
              value={expectedPaymentDate}
              onChange={(e) => setExpectedPaymentDate(e.target.value)}
              className="h-8 text-xs font-semibold"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingPaymentDate}
              onClick={() => setPendingPaymentDateOpp(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingPaymentDate || !expectedPaymentDate}
              onClick={async () => {
                if (!pendingPaymentDateOpp || !expectedPaymentDate) return
                setSavingPaymentDate(true)
                try {
                  const contract = await contractService.getContractForOpportunity(
                    pendingPaymentDateOpp.id,
                  )
                  if (contract) {
                    await contractService.updateContract(contract.id, {
                      data_vencimento_primeiro_pagamento: expectedPaymentDate,
                    })
                  }
                  await opportunityService.updateStage(
                    pendingPaymentDateOpp.id,
                    'Aguardando pagamento',
                    pendingPaymentDateOpp.stage,
                  )
                  setPendingPaymentDateOpp(null)
                  setExpectedPaymentDate('')
                  await fetchData()
                } catch (err: any) {
                  alert(
                    'Não foi possível salvar a previsão: ' + (err?.message || 'erro inesperado'),
                  )
                } finally {
                  setSavingPaymentDate(false)
                }
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              {savingPaymentDate ? 'Salvando...' : 'Salvar e Avançar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: CRIAR OPORTUNIDADE */}
      <Dialog open={isNewOppOpen} onOpenChange={setIsNewOppOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Nova Oportunidade ({pipelineType === 'VENDAS' ? 'Funil de Vendas' : 'Pós-Venda'})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preencha os dados do cliente, produto cotado e condições do plano
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveOpportunity} className="space-y-4 py-2 text-xs">
            {formError && (
              <div className="p-3 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Título da Oportunidade *</Label>
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
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 mt-1">
                  {duplicateWarning}
                </p>
              )}
            </div>

            {/* Empresa Opcional */}
            <div className="p-2.5 rounded-lg border border-border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Empresa (Opcional na entrada)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickCompany(!showQuickCompany)}
                  className="h-6 text-[11px] text-primary p-1"
                >
                  {showQuickCompany ? '✕ Fechar rápida' : '+ Nova empresa'}
                </Button>
              </div>

              {!showQuickCompany ? (
                <Select value={formCompanyId} onValueChange={setFormCompanyId}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-background p-2 rounded border border-primary/30">
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
                    className="h-7 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Salvar Empresa
                  </Button>
                </div>
              )}
            </div>

            {/* Contato Opcional */}
            <div className="p-2.5 rounded-lg border border-border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Contato (Opcional na entrada)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowQuickContact(!showQuickContact)}
                  className="h-6 text-[11px] text-primary p-1"
                >
                  {showQuickContact ? '✕ Fechar rápido' : '+ Novo contato'}
                </Button>
              </div>

              {!showQuickContact ? (
                <Select value={formContactId} onValueChange={setFormContactId}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-background p-2 rounded border border-primary/30">
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
                    className="h-7 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Salvar Contato
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Produto</Label>
                <Select
                  value={formProductId || 'none_clear'}
                  onValueChange={(val) => setFormProductId(val === 'none_clear' ? '' : val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_clear">Nenhum / A definir</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Etapa Inicial</Label>
                <Select value={formStage} onValueChange={setFormStage}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((st) => (
                      <SelectItem key={st.id} value={st.nome}>
                        {st.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Temperatura</Label>
                <Select
                  value={formTemperature}
                  onValueChange={(val) => setFormTemperature(val as Temperature)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
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

            {/* Sugestão de Plano */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Operadora Sugerida</Label>
                <Select value={formCarrierId} onValueChange={setFormCarrierId}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
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
                <Label className="text-xs font-semibold">Plano Sugerido</Label>
                <Input
                  placeholder="Ex: Smart 500 / Nacional"
                  value={formSuggestedPlan}
                  onChange={(e) => setFormSuggestedPlan(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Valor da Cotação / Mensalidade (R$)</Label>
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
                <Label className="text-xs font-semibold">Origem do Lead</Label>
                <Input
                  placeholder="Ex: Indicação, Google Ads, WhatsApp"
                  value={formOrigin}
                  onChange={(e) => setFormOrigin(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Tags Coloridas:</Label>
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
                              ? 'ring-2 ring-primary shadow-sm'
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
              <Label className="text-xs font-semibold">Link da Cotação (Opcional)</Label>
              <Input
                placeholder="https://cotador.kkj.com.br/..."
                value={formQuotationLink}
                onChange={(e) => setFormQuotationLink(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Notas de Qualificação</Label>
              <Textarea
                rows={2}
                placeholder="Observações importantes coletadas com o cliente..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
              >
                {isSaving ? 'Salvando...' : 'Criar Oportunidade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 7: DETALHES DA OPORTUNIDADE EM 3 COLUNAS */}
      <OpportunityDetailModal
        opportunityId={detailOppId}
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setDetailOppId(null)
        }}
        onUpdated={fetchData}
        onRequestStageChange={executeStageTransition}
        users={users}
        salesStages={currentStageNames}
        postSalesStages={currentStageNames}
        lostReasons={LOST_REASONS}
      />

      {/* MODAL 8: CONFERÊNCIA CADASTRAL DE VENDA GANHA */}
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
