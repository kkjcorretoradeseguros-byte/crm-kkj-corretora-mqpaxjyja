import React, { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Shield,
  Layers,
  Package,
  AlertCircle,
  CheckSquare,
  Users,
  Building,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { productService } from '@/services/productService'
import { userService } from '@/services/userService'
import {
  teamService,
  type CommercialTeam,
  type TeamMember,
  type ManagementCommissionRule,
} from '@/services/teamService'
import { carrierService } from '@/services/carrierService'
import { tagService } from '@/services/tagService'
import { SPECIAL_PME_RULES } from '@/services/commissionEngine'
import { commissionImporter, type ImportReport } from '@/services/commissionImporter'
import {
  commissionRuleService,
  type CommissionRule,
  type SellerSplitSettings,
  DEFAULT_SELLER_SPLITS,
} from '@/services/commissionRuleService'
import {
  systemSettingsService,
  type SystemSettingHistoryItem,
} from '@/services/systemSettingsService'
import { useAuth } from '@/contexts/AuthContext'
import type { Product, ProductCategory, User, UserRole, Carrier, CrmTag } from '@/types/crm'

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<
    | 'OPERADORAS'
    | 'PRODUTOS'
    | 'COMISSOES'
    | 'TAGS'
    | 'ETAPAS'
    | 'PERDAS'
    | 'TAREFAS'
    | 'EQUIPES'
    | 'COMISSAO_GESTAO'
    | 'USUARIOS'
    | 'CONFIG_SISTEMA'
  >('OPERADORAS')

  // Alíquota de imposto e configurações do sistema
  const [taxRate, setTaxRate] = useState<number>(11.0)
  const [taxRateInput, setTaxRateInput] = useState<string>('11.00')
  const [taxHistory, setTaxHistory] = useState<SystemSettingHistoryItem[]>([])
  const [isSavingTax, setIsSavingTax] = useState(false)
  const [taxMessage, setTaxMessage] = useState<string | null>(null)

  // Membros da equipe selecionada no painel de equipes
  const [selectedTeamIdForMembers, setSelectedTeamIdForMembers] = useState<string | null>(null)
  const [currentTeamMembers, setCurrentTeamMembers] = useState<TeamMember[]>([])
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false)
  const [selectedSellerIdToAdd, setSelectedSellerIdToAdd] = useState('')
  const [participaDistribuicao, setParticipaDistribuicao] = useState(true)

  // Carriers state (Operadoras)
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false)
  const [editingCarrierId, setEditingCarrierId] = useState<string | null>(null)
  const [carrierNome, setCarrierNome] = useState('')
  const [carrierNomeCurto, setCarrierNomeCurto] = useState('')
  const [carrierObservacoes, setCarrierObservacoes] = useState('')

  // Comissões & Repasses Tab State
  const [comissoesSubTab, setComissoesSubTab] = useState<'OPERADORAS' | 'REPASSES'>('OPERADORAS')
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([])
  const [sellerSplits, setSellerSplits] = useState<SellerSplitSettings>(DEFAULT_SELLER_SPLITS)
  const [isSavingSplits, setIsSavingSplits] = useState(false)
  const [splitsMessage, setSplitsMessage] = useState<string | null>(null)

  // Modal de Regra de Comissão
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleNome, setRuleNome] = useState('')
  const [ruleCode, setRuleCode] = useState('')
  const [ruleCarrierId, setRuleCarrierId] = useState('')
  const [ruleProductId, setRuleProductId] = useState('')
  const [ruleModalidade, setRuleModalidade] = useState('PME Saúde')
  const [ruleCronograma, setRuleCronograma] = useState<string>('100, 100, 100, 50, 50')
  const [ruleHasRecurring, setRuleHasRecurring] = useState(false)
  const [ruleRecurringPct, setRuleRecurringPct] = useState('2')
  const [ruleRecurringStartMonth, setRuleRecurringStartMonth] = useState('4')
  const [ruleMinLives, setRuleMinLives] = useState('1')
  const [ruleMaxLives, setRuleMaxLives] = useState('')
  const [ruleRepassePct, setRuleRepassePct] = useState('50')
  const [ruleRepasseProprioPct, setRuleRepasseProprioPct] = useState('100')
  const [ruleImpostoPct, setRuleImpostoPct] = useState('11')
  const [ruleDataInicio, setRuleDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [ruleDataFim, setRuleDataFim] = useState('')
  const [ruleObservacoes, setRuleObservacoes] = useState('')
  const [isSavingRule, setIsSavingRule] = useState(false)
  const [ruleModalError, setRuleModalError] = useState<string | null>(null)

  // Equipes e comissão de gestão
  const [teams, setTeams] = useState<CommercialTeam[]>([])
  const [managementRules, setManagementRules] = useState<ManagementCommissionRule[]>([])
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamGestorId, setNewTeamGestorId] = useState('')
  const [newTeamDescricao, setNewTeamDescricao] = useState('')

  // Regra de comissão de gestão
  const [isMgmRuleModalOpen, setIsMgmRuleModalOpen] = useState(false)
  const [mgmRuleGestorId, setMgmRuleGestorId] = useState('')
  const [mgmRuleName, setMgmRuleName] = useState('')
  const [mgmRulePercent, setMgmRulePercent] = useState('0')
  const [mgmRuleBase, setMgmRuleBase] = useState<
    'comissao_liquida_equipe' | 'receita_bruta_equipe' | 'volume_mensalidade'
  >('comissao_liquida_equipe')
  const [mgmRuleAtivo, setMgmRuleAtivo] = useState(false) // Nathany inicialmente desativada (0%)

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [productName, setProductName] = useState('')
  const [productCategory, setProductCategory] = useState<ProductCategory>('Saúde PME')
  const [productDescription, setProductDescription] = useState('')

  // Tags state
  const [tagsList, setTagsList] = useState<CrmTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#2563EB')

  // Importador de Planilha state
  const [csvInput, setCsvInput] = useState('')
  const [importReport, setImportReport] = useState<ImportReport | null>(null)

  // Users state
  const [users, setUsers] = useState<User[]>([])

  // Lost reasons state (Configurável sem alterar código)
  const [lostReasons, setLostReasons] = useState<string[]>([
    'Preço',
    'Sem retorno',
    'Fechou com concorrente',
    'Sem CNPJ elegível',
    'Quantidade de vidas',
    'Carência',
    'Rede inadequada',
    'Desistiu',
    'Outro',
  ])
  const [newLostReason, setNewLostReason] = useState('')

  // Task types state
  const [taskTypes, setTaskTypes] = useState<string[]>([
    'Ligação',
    'WhatsApp',
    'Follow-up',
    'Reunião',
    'Cotação',
    'Documentação',
    'Implantação',
    'Cobrança/Pagamento',
    'Outro',
  ])
  const [newTaskType, setNewTaskType] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [
        prodRes,
        usersRes,
        carriersRes,
        teamsRes,
        mgmRes,
        currentTax,
        taxHist,
        dbRules,
        splits,
      ] = await Promise.all([
        productService.getAllProducts(false),
        userService.getAllUsers(),
        carrierService.getAllCarriers(false),
        teamService.getTeams(),
        teamService.getManagementRules(),
        systemSettingsService.getDefaultTaxRate(),
        systemSettingsService.getTaxHistory(),
        commissionRuleService.getRules(false),
        commissionRuleService.getSellerSplitSettings(),
      ])
      setProducts(prodRes)
      setUsers(usersRes)
      setCarriers(carriersRes)
      setTeams(teamsRes)
      setManagementRules(mgmRes)
      setTagsList(tagService.getAllTags())
      setCommissionRules(dbRules)
      setSellerSplits(splits)
      setTaxRate(currentTax)
      setTaxRateInput(currentTax.toString())
      setTaxHistory(taxHist)
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleSaveTaxRate = async () => {
    const val = parseFloat(taxRateInput)
    if (isNaN(val) || val < 0 || val > 100) {
      setTaxMessage('A alíquota deve ser um número entre 0 e 100%.')
      return
    }

    try {
      setIsSavingTax(true)
      setTaxMessage(null)
      await systemSettingsService.updateDefaultTaxRate(
        val,
        'Atualização via Central do Administrador',
      )
      setTaxRate(val)
      const updatedHist = await systemSettingsService.getTaxHistory()
      setTaxHistory(updatedHist)
      setTaxMessage('Alíquota atualizada com sucesso para ' + val + '%!')
    } catch (err: any) {
      setTaxMessage(err.message || 'Erro ao salvar a alíquota.')
    } finally {
      setIsSavingTax(false)
    }
  }

  const handleSelectTeamMembers = async (teamId: string) => {
    setSelectedTeamIdForMembers(teamId)
    const members = await teamService.getTeamMembers(teamId)
    setCurrentTeamMembers(members)
  }

  const handleAddMemberToTeam = async () => {
    if (!selectedTeamIdForMembers || !selectedSellerIdToAdd) return
    try {
      await teamService.addMemberToTeam(
        selectedTeamIdForMembers,
        selectedSellerIdToAdd,
        participaDistribuicao,
      )
      setIsAddMemberModalOpen(false)
      setSelectedSellerIdToAdd('')
      const members = await teamService.getTeamMembers(selectedTeamIdForMembers)
      setCurrentTeamMembers(members)
      const updatedTeams = await teamService.getTeams()
      setTeams(updatedTeams)
    } catch (err: any) {
      alert(err.message || 'Erro ao transferir/vincular corretor.')
    }
  }

  const handleRemoveMember = async (teamId: string, vendedorId: string) => {
    try {
      await teamService.removeMemberFromTeam(teamId, vendedorId)
      const members = await teamService.getTeamMembers(teamId)
      setCurrentTeamMembers(members)
      const updatedTeams = await teamService.getTeams()
      setTeams(updatedTeams)
    } catch (err: any) {
      alert(err.message || 'Erro ao remover vínculo.')
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productName.trim()) return

    try {
      await productService.createProduct({
        name: productName.trim(),
        category: productCategory,
        description: productDescription.trim() || undefined,
        active: true,
      })
      setIsProductModalOpen(false)
      setProductName('')
      setProductDescription('')
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleProduct = async (prod: Product) => {
    try {
      await productService.updateProduct(prod.id, { active: !prod.active })
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenCarrierModal = (carrier?: Carrier) => {
    if (carrier) {
      setEditingCarrierId(carrier.id)
      setCarrierNome(carrier.nome)
      setCarrierNomeCurto(carrier.nome_curto || '')
      setCarrierObservacoes(carrier.observacoes || '')
    } else {
      setEditingCarrierId(null)
      setCarrierNome('')
      setCarrierNomeCurto('')
      setCarrierObservacoes('')
    }
    setIsCarrierModalOpen(true)
  }

  const handleSaveCarrier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!carrierNome.trim()) return

    try {
      if (editingCarrierId) {
        await carrierService.updateCarrier(editingCarrierId, {
          nome: carrierNome.trim(),
          nome_curto: carrierNomeCurto.trim() || undefined,
          observacoes: carrierObservacoes.trim() || undefined,
        })
      } else {
        await carrierService.createCarrier({
          nome: carrierNome.trim(),
          nome_curto: carrierNomeCurto.trim() || undefined,
          observacoes: carrierObservacoes.trim() || undefined,
          ativo: true,
        })
      }
      setIsCarrierModalOpen(false)
      setEditingCarrierId(null)
      setCarrierNome('')
      setCarrierNomeCurto('')
      setCarrierObservacoes('')
      loadData()
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar operadora.')
    }
  }

  const handleOpenRuleModal = (rule?: CommissionRule) => {
    setRuleModalError(null)
    if (rule) {
      setEditingRuleId(rule.id)
      setRuleNome(rule.nome)
      setRuleCode(rule.code || '')
      setRuleCarrierId(rule.carrier_id || 'todas')
      setRuleProductId(rule.product_id || 'qualquer')
      setRuleModalidade(rule.modalidade || 'PME Saúde')
      const pcts = (rule.cronograma_parcelas || []).map((p) => p.pct)
      setRuleCronograma(pcts.join(', '))
      setRuleHasRecurring(rule.has_recurring)
      setRuleRecurringPct(rule.recurring_percentage ? String(rule.recurring_percentage) : '2')
      setRuleRecurringStartMonth(
        rule.recurring_start_month ? String(rule.recurring_start_month) : '4',
      )
      setRuleMinLives(rule.min_lives ? String(rule.min_lives) : '1')
      setRuleMaxLives(rule.max_lives ? String(rule.max_lives) : '')
      setRuleRepassePct(
        rule.repasse_vendedor_pct != null ? String(rule.repasse_vendedor_pct) : '50',
      )
      setRuleRepasseProprioPct(
        rule.repasse_vendedor_proprio_pct != null
          ? String(rule.repasse_vendedor_proprio_pct)
          : '100',
      )
      setRuleImpostoPct(rule.aliquota_imposto_pct ? String(rule.aliquota_imposto_pct) : '11')
      setRuleDataInicio(rule.data_inicio_vigencia || new Date().toISOString().slice(0, 10))
      setRuleDataFim(rule.data_fim_vigencia || '')
      setRuleObservacoes(rule.observacoes || '')
    } else {
      setEditingRuleId(null)
      setRuleNome('')
      setRuleCode('')
      setRuleCarrierId(carriers[0]?.id || 'todas')
      setRuleProductId('qualquer')
      setRuleModalidade('PME Saúde')
      setRuleCronograma('100, 100, 100, 50, 50')
      setRuleHasRecurring(false)
      setRuleRecurringPct('2')
      setRuleRecurringStartMonth('4')
      setRuleMinLives('1')
      setRuleMaxLives('')
      setRuleRepassePct('50')
      setRuleRepasseProprioPct('100')
      setRuleImpostoPct(taxRate.toString())
      setRuleDataInicio(new Date().toISOString().slice(0, 10))
      setRuleDataFim('')
      setRuleObservacoes('')
    }
    setIsRuleModalOpen(true)
  }

  const handleSaveCommissionRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleNome.trim()) {
      setRuleModalError('Nome da regra é obrigatório.')
      return
    }

    const parcelasRaw = ruleCronograma
      .split(/[,;/]/)
      .map((p) => parseFloat(p.trim().replace('%', '')))
      .filter((n) => !isNaN(n))

    if (parcelasRaw.length === 0) {
      setRuleModalError('Informe ao menos uma parcela válida no cronograma (ex: 100, 50, 50).')
      return
    }

    const cronogramaObj = parcelasRaw.map((pct, idx) => ({
      month: idx + 1,
      pct,
    }))
    const somaTotal = parcelasRaw.reduce((acc, v) => acc + v, 0)

    try {
      setIsSavingRule(true)
      setRuleModalError(null)

      await commissionRuleService.saveRule({
        id: editingRuleId || undefined,
        nome: ruleNome.trim(),
        code: ruleCode.trim() || undefined,
        carrier_id: ruleCarrierId === 'todas' ? undefined : ruleCarrierId || undefined,
        product_id: ruleProductId === 'qualquer' ? undefined : ruleProductId || undefined,
        modalidade: ruleModalidade.trim(),
        cronograma_parcelas: cronogramaObj,
        total_parcelas: cronogramaObj.length,
        total_comissao_pct: somaTotal,
        has_recurring: ruleHasRecurring,
        recurring_percentage: ruleHasRecurring ? parseFloat(ruleRecurringPct) || 0 : 0,
        recurring_start_month: ruleHasRecurring ? parseInt(ruleRecurringStartMonth, 10) || 4 : null,
        min_lives: parseInt(ruleMinLives, 10) || 1,
        max_lives: ruleMaxLives ? parseInt(ruleMaxLives, 10) : null,
        repasse_vendedor_pct: ruleRepassePct.trim() === '' ? 50 : Number(ruleRepassePct),
        repasse_vendedor_proprio_pct:
          ruleRepasseProprioPct.trim() === '' ? 100 : Number(ruleRepasseProprioPct),
        aliquota_imposto_pct: parseFloat(ruleImpostoPct) || 11,
        data_inicio_vigencia: ruleDataInicio,
        data_fim_vigencia: ruleDataFim || null,
        observacoes: ruleObservacoes.trim() || null,
        ativo: true,
      })

      setIsRuleModalOpen(false)
      loadData()
    } catch (err: any) {
      setRuleModalError(err.message || 'Erro ao persistir regra no Supabase.')
    } finally {
      setIsSavingRule(false)
    }
  }

  const handleToggleRule = async (rule: CommissionRule) => {
    try {
      await commissionRuleService.toggleRuleActive(rule.id, rule.ativo)
      loadData()
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status da regra.')
    }
  }

  const handleSaveSellerSplits = async () => {
    try {
      setIsSavingSplits(true)
      setSplitsMessage(null)
      await commissionRuleService.updateSellerSplitSettings(sellerSplits)
      setSplitsMessage('Configurações de repasse salvas com sucesso!')
    } catch (err: any) {
      setSplitsMessage(err.message || 'Erro ao salvar repasses.')
    } finally {
      setIsSavingSplits(false)
    }
  }

  const handleToggleCarrier = async (carrier: Carrier) => {
    try {
      await carrierService.toggleCarrier(carrier.id)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddLostReason = (e: React.FormEvent) => {
    e.preventDefault()
    if (newLostReason.trim() && !lostReasons.includes(newLostReason.trim())) {
      setLostReasons([...lostReasons, newLostReason.trim()])
      setNewLostReason('')
    }
  }

  const handleRemoveLostReason = (reason: string) => {
    setLostReasons(lostReasons.filter((r) => r !== reason))
  }

  const handleAddTaskType = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTaskType.trim() && !taskTypes.includes(newTaskType.trim())) {
      setTaskTypes([...taskTypes, newTaskType.trim()])
      setNewTaskType('')
    }
  }

  const handleRemoveTaskType = (type: string) => {
    setTaskTypes(taskTypes.filter((t) => t !== type))
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await userService.updateUserRole(userId, newRole)
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="p-6 rounded-xl bg-card text-card-foreground border border-border shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Central do Administrador — CRM KKJ
            </h2>
            <p className="text-xs text-muted-foreground">
              Gerenciamento de produtos, funis, motivos de perda, tipos de tarefa e perfis de
              usuários sem alterar código
            </p>
          </div>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-xs">
        {[
          { key: 'OPERADORAS', label: 'Operadoras (Carriers)', icon: Building },
          { key: 'PRODUTOS', label: 'Catálogo de Produtos', icon: Package },
          { key: 'COMISSOES', label: 'Comissões & Regras', icon: Shield },
          { key: 'TAGS', label: 'Tags Coloridas', icon: Layers },
          { key: 'ETAPAS', label: 'Funis & Etapas', icon: Layers },
          { key: 'PERDAS', label: 'Motivos de Perda', icon: AlertCircle },
          { key: 'TAREFAS', label: 'Tipos de Tarefa', icon: CheckSquare },
          { key: 'EQUIPES', label: 'Equipes & Hierarquia', icon: Users },
          { key: 'COMISSAO_GESTAO', label: 'Comissão de Gestão', icon: Shield },
          { key: 'USUARIOS', label: 'Usuários & Perfis', icon: Users },
          { key: 'CONFIG_SISTEMA', label: 'Impostos & Configurações', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'bg-card text-muted-foreground hover:bg-muted border border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 0: OPERADORAS (Carriers) */}
      {activeTab === 'OPERADORAS' && (
        <Card className="border-[#E4E7EC] dark:border-[#24324D] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold text-[#101828] dark:text-foreground">
                Operadoras de Saúde & Seguradoras Parceiras
              </CardTitle>
              <CardDescription className="text-xs text-[#667085] dark:text-muted-foreground">
                Cadastro central de operadoras com soft delete (ativo/inativo) e integridade
                relacional
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenCarrierModal()}
              className="bg-[#1B2A4A] dark:bg-primary text-white text-xs hover:bg-[#2A3D6B]"
            >
              <Plus className="h-4 w-4 mr-1" /> Nova Operadora
            </Button>{' '}
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E7EC] dark:divide-[#24324D]">
              {carriers.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#101828] dark:text-foreground text-sm">
                        {c.nome}
                      </span>
                      {c.nome_curto && (
                        <Badge variant="outline" className="text-[10px]">
                          {c.nome_curto}
                        </Badge>
                      )}
                      <Badge
                        className={`text-[9px] ${
                          c.ativo
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-slate-100 text-[#667085] dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {c.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    {c.observacoes && (
                      <p className="text-[11px] text-[#667085] dark:text-muted-foreground mt-0.5">
                        {c.observacoes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCarrierModal(c)}
                      className="text-xs h-7 px-2"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleCarrier(c)}
                      className="text-xs h-7 text-[#667085] dark:text-muted-foreground hover:text-[#101828] dark:hover:text-foreground"
                    >
                      {c.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: COMISSÕES & MOTOR DE REPASSES */}
      {activeTab === 'COMISSOES' && (
        <div className="space-y-6">
          {/* Sub-abas: Comissões das Operadoras vs Repasses aos Vendedores */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setComissoesSubTab('OPERADORAS')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
                comissoesSubTab === 'OPERADORAS'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Comissões das Operadoras ({commissionRules.length})
            </button>
            <button
              onClick={() => setComissoesSubTab('REPASSES')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
                comissoesSubTab === 'REPASSES'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Repasses aos Vendedores (Origem do Lead & Produtos)
            </button>
          </div>

          {/* SUB-ABA 1: COMISSÕES DAS OPERADORAS */}
          {comissoesSubTab === 'OPERADORAS' && (
            <div className="space-y-6">
              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">
                      Regras de Comissão por Operadora e Produto
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Parametrize percentuais por parcela, faixas de vidas, recorrências e vigências
                      no Supabase
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpenRuleModal()}
                    className="bg-primary text-primary-foreground text-xs"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Nova Regra de Comissão
                  </Button>
                </CardHeader>
                <CardContent>
                  {commissionRules.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      Nenhuma regra cadastrada na tabela commission_rules ainda. Use o botão acima
                      para adicionar ou visualize as regras padrão KKJ abaixo.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {commissionRules.map((rule) => {
                        const cronoText = (rule.cronograma_parcelas || [])
                          .map((p) => `${p.pct}%`)
                          .join('/')
                        return (
                          <div
                            key={rule.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">
                                  {rule.nome}
                                </span>
                                {rule.code && (
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {rule.code}
                                  </Badge>
                                )}
                                <Badge
                                  className={
                                    rule.ativo
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'bg-muted text-muted-foreground'
                                  }
                                >
                                  {rule.ativo ? 'Ativa' : 'Inativa'}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-[11px]">
                                <span>
                                  Operadora: <strong>{rule.carriers?.nome || 'Todas'}</strong>
                                </span>
                                <span>
                                  Modalidade: <strong>{rule.modalidade || 'PME'}</strong>
                                </span>
                                <span>
                                  Cronograma:{' '}
                                  <strong className="font-mono text-primary">
                                    {cronoText || 'N/A'}
                                  </strong>
                                </span>
                                {rule.has_recurring && (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    Recorrência: {rule.recurring_percentage}% (mês{' '}
                                    {rule.recurring_start_month})
                                  </span>
                                )}
                                <span>
                                  Faixa: {rule.min_lives || 1}
                                  {rule.max_lives ? ` a ${rule.max_lives}` : '+'} vidas
                                </span>
                                <span>Repasse Vendedor: {rule.repasse_vendedor_pct}%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRuleModal(rule)}
                                className="h-7 text-xs px-2"
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleRule(rule)}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              >
                                {rule.ativo ? 'Desativar' : 'Ativar'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card de Regras Especiais PME em Memória como Referência Inicial */}
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-foreground">
                    Regras Especiais Saúde PME (Prescrição Padrão KKJ)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Cronogramas comerciais de referência que alimentam a migração 0003 e o motor
                    comercial
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-border">
                    {Object.entries(SPECIAL_PME_RULES)
                      .filter(([k]) => !k.includes(' '))
                      .map(([key, rule]) => (
                        <div key={key} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-foreground text-sm">
                              {rule.carrier}
                            </span>
                            <span className="ml-2 font-mono text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              {rule.parcelas.join('/')}%{' '}
                              {rule.vitalicioPercentual
                                ? `+ ${rule.vitalicioPercentual}% vitalício da ${rule.vitalicioAPartirDe}ª`
                                : '(sem vitalício)'}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Total: {rule.totalPercentual}%
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Importador da Planilha de Comissões */}
              <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-blue-950 dark:text-blue-300 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Importação Oficial: "Grade de comissão - Saúde Bliss.xlsx"
                  </CardTitle>
                  <CardDescription className="text-xs text-blue-700 dark:text-blue-400">
                    Rotina idempotente com exclusão de Go Care, opção 1 da Plena Saúde PME e
                    descarte de duplicatas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs">
                    <strong>Importação Segura:</strong> A importação deve ocorrer exclusivamente no
                    banco Supabase conectado. O CRM já possui a estrutura completa em
                    commission_rules (total_comissao_pct, total_parcelas, cronograma_parcelas JSONB,
                    faixas de vidas, recorrência e vigência).
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Cole dados CSV para validar:&#10;Operadora;Modalidade;1a;2a;3a;4a;5a&#10;Amil;PME;100;100;100;0;0"
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    className="w-full text-xs font-mono p-2 border border-border rounded bg-background text-foreground"
                  />

                  <Button
                    size="sm"
                    onClick={() => {
                      if (!csvInput.trim()) return
                      const rows = commissionImporter.parseCsv(csvInput)
                      const rep = commissionImporter.processRows(rows)
                      setImportReport(rep)
                    }}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Processar e Validar Formato
                  </Button>

                  {importReport && (
                    <div className="p-3 bg-card rounded-lg border border-border space-y-1 text-xs">
                      <h4 className="font-bold text-foreground">Relatório de Validação:</h4>
                      <p>
                        Linhas lidas: <strong>{importReport.totalLinhasLidas}</strong>
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-400">
                        Regras aptas: <strong>{importReport.regrasImportadas}</strong>
                      </p>
                      <p className="text-red-700 dark:text-red-400">
                        Descartadas: <strong>{importReport.regrasDescartadas}</strong>
                      </p>
                      <p className="text-amber-700 dark:text-amber-400">
                        Duplicatas ignoradas: <strong>{importReport.regrasDuplicadas}</strong>
                      </p>
                      {importReport.detalhesDescartes.length > 0 && (
                        <ul className="list-disc pl-4 text-[11px] text-muted-foreground pt-1">
                          {importReport.detalhesDescartes.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* SUB-ABA 2: REPASSES AOS VENDEDORES */}
          {comissoesSubTab === 'REPASSES' && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-foreground">
                  Percentuais de Repasse por Origem do Lead e Categoria de Produto
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Configuração central KKJ: Nenhum percentual fixo no código. Regras comerciais
                  aplicam: Comissão líquida = Bruta recebida menos imposto ({taxRate}%).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {splitsMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs">
                    {splitsMessage}
                  </div>
                )}

                {/* 1. Origens do Lead Saúde */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-primary border-b border-border pb-1">
                    1. Planos de Saúde (Por Origem do Lead)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">
                        Próprio / Indicação
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.lead_proprio_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              lead_proprio_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Padrão KKJ: 100% da comissão líquida
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">KKJ - Saúde PME</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.kkj_pme_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              kkj_pme_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Padrão KKJ: 50% na 1ª parcela líquida
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">KKJ - Adesão</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.kkj_adesao_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              kkj_adesao_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        1º boleto: reconhecido apenas quando pago
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">KKJ - Saúde PF</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.kkj_pf_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              kkj_pf_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Padrão KKJ: 30% na 1ª parcela líquida
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Demais Produtos (Consórcio, Vida, Auto, Outros) */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-primary border-b border-border pb-1">
                    2. Demais Ramos & Produtos (Não presumem PME/PF)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">Consórcio</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.consorcio_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              consorcio_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Independente de Saúde PME/PF
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">Seguro de Vida</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.vida_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              vida_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Independente de Saúde PME/PF
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">Seguro Auto</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.auto_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              auto_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Independente de Saúde PME/PF
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card space-y-1">
                      <Label className="text-xs font-bold text-foreground">Outros Ramos</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={sellerSplits.outros_pct}
                          onChange={(e) =>
                            setSellerSplits({
                              ...sellerSplits,
                              outros_pct: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs font-bold"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Demais apólices e benefícios
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <Button
                    onClick={handleSaveSellerSplits}
                    disabled={isSavingSplits}
                    className="bg-primary text-primary-foreground text-xs"
                  >
                    {isSavingSplits ? 'Salvando...' : 'Salvar Regras de Repasse'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB: TAGS COLORIDAS */}
      {activeTab === 'TAGS' && (
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#101828]">
              Gerenciamento de Tags Coloridas
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Crie novas etiquetas ou desative tags existentes sem perder histórico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Nome da nova tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-8 text-xs max-w-xs"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-8 w-10 p-0 border rounded cursor-pointer"
                title="Escolha a cor da tag"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newTagName.trim()) return
                  tagService.createTag(newTagName.trim(), newTagColor)
                  setNewTagName('')
                  setTagsList(tagService.getAllTags())
                }}
                className="h-8 text-xs bg-[#1B2A4A] text-white"
              >
                + Nova Tag
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {tagsList.map((t) => (
                <div
                  key={t.id}
                  className="px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-semibold shadow-xs"
                  style={{
                    backgroundColor: t.bg_color,
                    color: t.text_color,
                    borderColor: t.color,
                  }}
                >
                  <span>{t.name}</span>
                  {!t.is_system && (
                    <button
                      type="button"
                      onClick={() => {
                        tagService.toggleActive(t.id)
                        setTagsList(tagService.getAllTags())
                      }}
                      className="ml-1 text-xs opacity-70 hover:opacity-100 font-bold"
                    >
                      {t.active ? '✕' : '↺'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 1: CATÁLOGO DE PRODUTOS */}
      {activeTab === 'PRODUTOS' && (
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-bold text-[#101828]">
                Catálogo de Seguros & Benefícios
              </CardTitle>
              <CardDescription className="text-xs text-[#667085]">
                Planos de saúde, odontológico, seguro de vida, auto e consórcios comercializados
                pela KKJ
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsProductModalOpen(true)}
              className="bg-[#1B2A4A] text-white text-xs hover:bg-[#2A3D6B]"
            >
              <Plus className="h-4 w-4 mr-1" /> Novo Produto
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E7EC]">
              {products.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#101828] text-sm">{p.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {p.category}
                      </Badge>
                      <Badge
                        className={`text-[9px] ${
                          p.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-[#667085]'
                        }`}
                      >
                        {p.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    {p.description && (
                      <p className="text-[11px] text-[#667085] mt-0.5">{p.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleProduct(p)}
                    className="text-xs text-[#667085] hover:text-[#101828]"
                  >
                    {p.active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: FUNIS & ETAPAS */}
      {activeTab === 'ETAPAS' && (
        <div className="space-y-4">
          <Card className="border-[#E4E7EC] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#101828]">
                Funil de Vendas (Comercial)
              </CardTitle>
              <CardDescription className="text-xs text-[#667085]">
                Fluxo obrigatório desde a entrada do lead até o fechamento da venda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[
                  '1. Novo Lead',
                  '2. Contato realizado',
                  '3. Qualificado',
                  '4. Cotação',
                  '5. Follow-up',
                  '6. Negociação',
                  '7. Venda ganha',
                  '✕ Venda perdida (saída)',
                ].map((s) => (
                  <div
                    key={s}
                    className="p-2.5 rounded-lg border border-[#E4E7EC] bg-[#F5F7FA] font-semibold text-[#1B2A4A]"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E4E7EC] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#101828]">
                Funil de Pós-Venda (Implantação & Ativação)
              </CardTitle>
              <CardDescription className="text-xs text-[#667085]">
                Iniciado automaticamente quando a oportunidade atinge Venda Ganha
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                {[
                  '1. Documentação',
                  '2. Implantação',
                  '3. Aguardando pagamento',
                  '4. Implantado',
                  '5. Cliente ativo',
                ].map((s) => (
                  <div
                    key={s}
                    className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/40 font-semibold text-emerald-900"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: MOTIVOS DE PERDA */}
      {activeTab === 'PERDAS' && (
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#101828]">
              Motivos de Perda no Funil de Vendas
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Opções obrigatórias exigidas quando uma negociação é encerrada como perdida
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddLostReason} className="flex gap-2">
              <Input
                placeholder="Adicionar novo motivo (ex: CNPJ inativo, Sem carência...)"
                value={newLostReason}
                onChange={(e) => setNewLostReason(e.target.value)}
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" className="bg-[#1B2A4A] text-white text-xs shrink-0">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {lostReasons.map((r) => (
                <Badge
                  key={r}
                  variant="outline"
                  className="p-2 text-xs bg-slate-50 border-[#E4E7EC] flex items-center gap-2"
                >
                  <span className="font-semibold text-[#101828]">{r}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLostReason(r)}
                    className="text-[#667085] hover:text-red-600 font-bold"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: TIPOS DE TAREFA */}
      {activeTab === 'TAREFAS' && (
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#101828]">
              Tipos de Tarefa e Ações
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Categorias padronizadas para acompanhamento da rotina comercial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddTaskType} className="flex gap-2">
              <Input
                placeholder="Novo tipo de tarefa..."
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" className="bg-[#1B2A4A] text-white text-xs shrink-0">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {taskTypes.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="p-2 text-xs bg-slate-50 border-[#E4E7EC] flex items-center gap-2"
                >
                  <span className="font-semibold text-[#101828]">{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTaskType(t)}
                    className="text-[#667085] hover:text-red-600 font-bold"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: EQUIPES & HIERARQUIA COMERCIAL */}
      {activeTab === 'EQUIPES' && (
        <div className="space-y-4">
          <Card className="border-[#E4E7EC] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold text-[#101828]">
                  Equipes Comerciais & Vínculo Histórico
                </CardTitle>
                <CardDescription className="text-xs text-[#667085]">
                  Modelo com data_inicio e data_fim: transfira vendedores mantendo histórico
                  integral. Apenas 1 equipe ativa por corretor; a transferência NÃO altera o
                  responsável de leads existentes.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setIsTeamModalOpen(true)}
                className="bg-[#1B2A4A] text-white text-xs hover:bg-[#2A3D6B]"
              >
                <Plus className="h-4 w-4 mr-1" /> Nova Equipe
              </Button>
            </CardHeader>
            <CardContent>
              <div className="p-3 mb-4 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-blue-900">
                <strong>Configuração Inicial Vigente:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>
                    <strong>Administrador:</strong> Controle geral e superior hierárquico direto de
                    Eliana.
                  </li>
                  <li>
                    <strong>Nathany (Gestora):</strong> Sem subordinados cadastrados inicialmente;
                    atua com foco em vendas próprias.
                  </li>
                  <li>
                    <strong>Eliana (Vendedora):</strong> Vinculada diretamente ao Administrador
                    (fora da gestão de Nathany).
                  </li>
                </ul>
              </div>

              {teams.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed rounded-lg">
                  Nenhuma equipe criada ainda. Crie uma equipe para alocar vendedores sob supervisão
                  de gestores.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-slate-900">{team.nome}</strong>
                          <Badge
                            className={
                              team.ativo
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }
                          >
                            {team.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <p className="text-slate-600 mt-0.5">
                          Gestor responsável:{' '}
                          <strong className="text-slate-800">
                            {team.gestor
                              ? `${team.gestor.nome} (${team.gestor.email})`
                              : 'Sem gestor vinculado'}
                          </strong>
                        </p>
                        {team.descricao && (
                          <p className="text-[11px] text-slate-500">{team.descricao}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSelectTeamMembers(team.id)}
                          className="text-xs h-8"
                        >
                          Ver Membros Ativos
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await teamService.updateTeam(team.id, { ativo: !team.ativo })
                            const tList = await teamService.getTeams()
                            setTeams(tList)
                          }}
                          className="text-xs h-8"
                        >
                          {team.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seção de Membros da Equipe Selecionada */}
          {selectedTeamIdForMembers && (
            <Card className="border-blue-200 bg-blue-50/20 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Membros da Equipe: {teams.find((t) => t.id === selectedTeamIdForMembers)?.nome}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    Apenas 1 vínculo ativo por corretor. Vínculos encerrados guardam data_fim.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  <Plus className="h-4 w-4 mr-1" /> Transferir / Vincular Corretor
                </Button>
              </CardHeader>
              <CardContent>
                {currentTeamMembers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    Nenhum corretor vinculado a esta equipe no momento.
                  </p>
                ) : (
                  <div className="divide-y divide-blue-100">
                    {currentTeamMembers.map((m) => (
                      <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-900">
                            {m.vendedor?.nome || m.vendedor_id}
                          </strong>
                          <span className="text-slate-500 ml-2">({m.vendedor?.email})</span>
                          <span className="text-slate-400 ml-2 text-[10px]">
                            Desde {new Date(m.data_inicio).toLocaleDateString('pt-BR')}
                          </span>
                          {m.participa_distribuicao && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[9px] text-emerald-700 bg-emerald-50"
                            >
                              Recebe Leads
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleRemoveMember(selectedTeamIdForMembers, m.vendedor_id)
                          }
                          className="text-xs text-red-600 hover:text-red-700 h-7"
                        >
                          Desvincular (Voltar p/ Admin)
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB: CONFIGURAÇÕES CENTRAIS DO SISTEMA & ALÍQUOTA DE IMPOSTO */}
      {activeTab === 'CONFIG_SISTEMA' && (
        <div className="space-y-6">
          <Card className="border-[#E4E7EC] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#101828]">
                Alíquota de Imposto Padrão da KKJ (Configuração Central)
              </CardTitle>
              <CardDescription className="text-xs text-[#667085]">
                Esta alíquota (padrão 11.00%) é gravada no snapshot no momento da contratação e na
                emissão de boletos de adesão. Contratos anteriores preservam sua alíquota histórica
                sem impacto retroativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 max-w-md">
                <div className="space-y-1 w-full">
                  <Label className="text-xs font-semibold">Alíquota Padrão (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={taxRateInput}
                      onChange={(e) => setTaxRateInput(e.target.value)}
                      className="h-9 text-sm font-bold pr-8"
                      disabled={isSavingTax}
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                      %
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleSaveTaxRate}
                  disabled={isSavingTax}
                  className="h-9 bg-[#1B2A4A] text-white text-xs hover:bg-[#2A3D6B] w-full sm:w-auto px-5"
                >
                  {isSavingTax ? 'Salvando...' : 'Atualizar Alíquota'}
                </Button>
              </div>

              {taxMessage && (
                <p
                  className={`text-xs font-semibold ${taxMessage.includes('sucesso') ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {taxMessage}
                </p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Histórico Auditado de Alterações da Alíquota
                </h4>
                {taxHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Nenhuma alteração registrada até o momento.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {taxHistory.map((item) => (
                      <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800">
                            {typeof item.new_value === 'object'
                              ? JSON.stringify(item.new_value)
                              : item.new_value}
                            %
                          </span>
                          {item.previous_value !== null && item.previous_value !== undefined && (
                            <span className="text-slate-400 ml-2">
                              (anterior:{' '}
                              {typeof item.previous_value === 'object'
                                ? JSON.stringify(item.previous_value)
                                : item.previous_value}
                              %)
                            </span>
                          )}
                          <span className="text-slate-500 ml-2 text-[11px]">
                            • {item.reason || 'Alteração manual'}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(item.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: COMISSÃO DE GESTÃO */}
      {activeTab === 'COMISSAO_GESTAO' && (
        <div className="space-y-4">
          <Card className="border-[#E4E7EC] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold text-[#101828]">
                  Comissão de Gestão Comercial (Configurável por Gestor)
                </CardTitle>
                <CardDescription className="text-xs text-[#667085]">
                  Regras de remuneração sobre o resultado da equipe subordinada. Inicialmente
                  desativada (0%).
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setIsMgmRuleModalOpen(true)}
                className="bg-[#1B2A4A] text-white text-xs hover:bg-[#2A3D6B]"
              >
                <Plus className="h-4 w-4 mr-1" /> Nova Regra de Gestão
              </Button>
            </CardHeader>
            <CardContent>
              <div className="p-3 mb-4 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950">
                <strong>Diretriz Atual de Negócio:</strong> Nathany NÃO recebe comissão de gestão no
                momento. Status padrão: desativada, 0%, nenhum lançamento financeiro gerado. Quando
                ativada pelo Administrador, o cálculo respeitará vigência e equipe no ato da venda.
              </div>

              {managementRules.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed rounded-lg">
                  Nenhuma regra de comissão de gestão configurada. Comissão desativada para todos os
                  gestores.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {managementRules.map((rule) => {
                    const gestorUser = users.find((u) => u.id === rule.gestor_id)
                    return (
                      <div
                        key={rule.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-slate-900">{rule.nome}</strong>
                            <Badge
                              className={
                                rule.ativo
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }
                            >
                              {rule.ativo ? 'Ativa' : 'Desativada (0%)'}
                            </Badge>
                          </div>
                          <p className="text-slate-600 mt-0.5">
                            Gestor: <strong>{gestorUser?.name || rule.gestor_id}</strong> •
                            Percentual: <strong>{rule.percentual}%</strong> • Base:{' '}
                            <strong>{rule.base_calculo}</strong>
                          </p>
                          {rule.observacoes && (
                            <p className="text-[11px] text-slate-500">{rule.observacoes}</p>
                          )}
                        </div>
                        <div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await teamService.toggleManagementRule(rule.id, !rule.ativo)
                              const rList = await teamService.getManagementRules()
                              setManagementRules(rList)
                            }}
                            className="text-xs h-8"
                          >
                            {rule.ativo ? 'Desativar Regra' : 'Ativar Regra'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: USUÁRIOS & PERFIS */}
      {activeTab === 'USUARIOS' && (
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#101828]">
              Usuários, Perfis e Hierarquia de Acesso
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              ADMINISTRADOR (acesso geral e vendas), GESTOR (vendas próprias + gestão de
              subordinados), VENDEDOR (exclusivamente carteira própria). Alteração dinâmica com
              histórico auditável.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E7EC]">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#101828] text-sm">
                        {u.name || 'Sem nome'}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {u.role}
                      </Badge>
                      <Badge
                        className={
                          u.ativo !== false
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }
                      >
                        {u.ativo !== false ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#667085]">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={u.role || 'vendedor'}
                      onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                    >
                      <SelectTrigger className="h-8 text-xs w-44 bg-white font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="administrador">administrador</SelectItem>
                        <SelectItem value="gestor">gestor</SelectItem>
                        <SelectItem value="vendedor">vendedor</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const nextAtivo = u.ativo === false ? true : false
                        await userService.toggleUserActive(u.id, nextAtivo)
                        loadData()
                      }}
                      className="text-xs h-8 text-slate-600 hover:text-slate-900"
                    >
                      {u.ativo === false ? 'Ativar' : 'Desativar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: NOVA EQUIPE */}
      <Dialog open={isTeamModalOpen} onOpenChange={setIsTeamModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Nova Equipe Comercial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Equipe *</Label>
              <Input
                placeholder="Ex: Equipe Saúde PME Alpha"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gestor Responsável</Label>
              <Select value={newTeamGestorId} onValueChange={setNewTeamGestorId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o gestor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem gestor (Direto ao Admin)</SelectItem>
                  {users
                    .filter(
                      (u) =>
                        u.role?.toLowerCase() === 'gestor' ||
                        u.role?.toLowerCase() === 'administrador',
                    )
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email} ({u.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição / Observações</Label>
              <Input
                placeholder="Observações da equipe..."
                value={newTeamDescricao}
                onChange={(e) => setNewTeamDescricao(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTeamModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!newTeamName.trim()) return
                await teamService.createTeam(
                  newTeamName.trim(),
                  newTeamGestorId === 'none' ? null : newTeamGestorId || null,
                  newTeamDescricao.trim() || undefined,
                )
                setIsTeamModalOpen(false)
                setNewTeamName('')
                setNewTeamGestorId('')
                setNewTeamDescricao('')
                const tList = await teamService.getTeams()
                setTeams(tList)
              }}
              className="bg-[#1B2A4A] text-white text-xs"
            >
              Salvar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: TRANSFERIR / VINCULAR MEMBRO A EQUIPE */}
      <Dialog open={isAddMemberModalOpen} onOpenChange={setIsAddMemberModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Vincular / Transferir Corretor para a Equipe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-500 text-[11px]">
              Se o corretor já tiver outra equipe ativa, seu vínculo anterior será encerrado com a
              data de término atual, preservando o histórico. O responsável de oportunidades
              existentes não será alterado.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Corretor / Vendedor *</Label>
              <Select value={selectedSellerIdToAdd} onValueChange={setSelectedSellerIdToAdd}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o corretor" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(
                      (u) =>
                        u.role?.toLowerCase() === 'vendedor' || u.role?.toLowerCase() === 'gestor',
                    )
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email} ({u.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="chk-participa"
                checked={participaDistribuicao}
                onChange={(e) => setParticipaDistribuicao(e.target.checked)}
                className="rounded border-slate-300"
              />
              <label htmlFor="chk-participa" className="text-xs text-slate-700 cursor-pointer">
                Participa da distribuição automática de leads da equipe
              </label>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddMemberModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAddMemberToTeam}
              className="bg-[#1B2A4A] text-white text-xs"
            >
              Confirmar Vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA REGRA DE GESTÃO */}
      <Dialog open={isMgmRuleModalOpen} onOpenChange={setIsMgmRuleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Regra de Comissão de Gestão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Gestor Elegível *</Label>
              <Select value={mgmRuleGestorId} onValueChange={setMgmRuleGestorId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o gestor" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.role?.toLowerCase() === 'gestor')
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome da Regra *</Label>
              <Input
                placeholder="Ex: Gestão Padrão PME 5%"
                value={mgmRuleName}
                onChange={(e) => setMgmRuleName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Percentual (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={mgmRulePercent}
                  onChange={(e) => setMgmRulePercent(e.target.value)}
                  className="h-8 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Base de Cálculo</Label>
                <Select value={mgmRuleBase} onValueChange={(val: any) => setMgmRuleBase(val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comissao_liquida_equipe">Comissão Líquida Equipe</SelectItem>
                    <SelectItem value="receita_bruta_equipe">Receita Bruta Equipe</SelectItem>
                    <SelectItem value="volume_mensalidade">Volume de Mensalidades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="chkMgmAtivo"
                checked={mgmRuleAtivo}
                onChange={(e) => setMgmRuleAtivo(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="chkMgmAtivo" className="text-xs cursor-pointer">
                Regra Ativa Imediatamente (Deixar desmarcada para 0%)
              </Label>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMgmRuleModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!mgmRuleGestorId || !mgmRuleName.trim()) return
                await teamService.saveManagementRule({
                  gestor_id: mgmRuleGestorId,
                  nome: mgmRuleName.trim(),
                  percentual: parseFloat(mgmRulePercent) || 0,
                  base_calculo: mgmRuleBase,
                  ativo: mgmRuleAtivo,
                })
                setIsMgmRuleModalOpen(false)
                setMgmRuleName('')
                setMgmRuleGestorId('')
                setMgmRulePercent('0')
                setMgmRuleAtivo(false)
                const rList = await teamService.getManagementRules()
                setManagementRules(rList)
              }}
              className="bg-[#1B2A4A] text-white text-xs"
            >
              Gravar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT CARRIER MODAL */}
      <Dialog open={isCarrierModalOpen} onOpenChange={setIsCarrierModalOpen}>
        <DialogContent className="max-w-md bg-background text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {editingCarrierId ? 'Editar Operadora / Seguradora' : 'Nova Operadora / Seguradora'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Parametrize dados da operadora parceira da KKJ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCarrier} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome da Operadora *</Label>
              <Input
                placeholder="Ex: Golden Cross, Notredame Intermédica"
                value={carrierNome}
                onChange={(e) => setCarrierNome(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome Curto / Sigla</Label>
              <Input
                placeholder="Ex: GNDI"
                value={carrierNomeCurto}
                onChange={(e) => setCarrierNomeCurto(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Input
                placeholder="Ex: Planos corporativos e adesão"
                value={carrierObservacoes}
                onChange={(e) => setCarrierObservacoes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCarrierModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-primary text-primary-foreground text-xs"
              >
                {editingCarrierId ? 'Atualizar Operadora' : 'Salvar Operadora'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CRIAR / EDITAR REGRA DE COMISSÃO */}
      <Dialog open={isRuleModalOpen} onOpenChange={setIsRuleModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-background text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingRuleId ? 'Editar Regra de Comissão' : 'Nova Regra de Comissão'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCommissionRule} className="space-y-4 text-xs">
            {ruleModalError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                {ruleModalError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Nome da Regra *</Label>
                <Input
                  value={ruleNome}
                  onChange={(e) => setRuleNome(e.target.value)}
                  placeholder="Ex: Amil PME 300% (3 parcelas)"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Código Interno</Label>
                <Input
                  value={ruleCode}
                  onChange={(e) => setRuleCode(e.target.value)}
                  placeholder="Ex: AMIL-PME-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Operadora</Label>
                <Select value={ruleCarrierId} onValueChange={setRuleCarrierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">(Geral / Todas)</SelectItem>
                    {carriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Modalidade</Label>
                <Select value={ruleModalidade} onValueChange={setRuleModalidade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PME Saúde">PME Saúde</SelectItem>
                    <SelectItem value="PF Saúde">PF Saúde</SelectItem>
                    <SelectItem value="Adesão Saúde">Adesão Saúde</SelectItem>
                    <SelectItem value="PME odonto">PME odonto</SelectItem>
                    <SelectItem value="PF odonto">PF odonto</SelectItem>
                    <SelectItem value="Consórcio">Consórcio</SelectItem>
                    <SelectItem value="Vida">Vida</SelectItem>
                    <SelectItem value="Auto">Auto</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Produto Vinculado</Label>
                <Select value={ruleProductId} onValueChange={setRuleProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualquer">(Qualquer produto da modalidade)</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <Label className="text-foreground font-bold">
                Cronograma de Parcelas (% sobre a mensalidade por mês) *
              </Label>
              <Input
                value={ruleCronograma}
                onChange={(e) => setRuleCronograma(e.target.value)}
                placeholder="Ex: 100, 100, 100 (para 3 parcelas de 100%) ou 100, 50, 50, 25"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Separe os percentuais por vírgula. Exemplo: <code>100, 100, 100</code> = 3 parcelas
                de 100% (total 300%).
              </p>
            </div>

            {/* Recorrência */}
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={ruleHasRecurring}
                  onChange={(e) => setRuleHasRecurring(e.target.checked)}
                  className="rounded"
                />
                Possui comissão recorrente / vitalícia?
              </label>

              {ruleHasRecurring && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Percentual Recorrente (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={ruleRecurringPct}
                      onChange={(e) => setRuleRecurringPct(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">A partir de qual mês?</Label>
                    <Input
                      type="number"
                      value={ruleRecurringStartMonth}
                      onChange={(e) => setRuleRecurringStartMonth(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Faixa de vidas e repasses */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Mínimo de Vidas</Label>
                <Input
                  type="number"
                  value={ruleMinLives}
                  onChange={(e) => setRuleMinLives(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Máximo de Vidas</Label>
                <Input
                  type="number"
                  placeholder="Sem limite"
                  value={ruleMaxLives}
                  onChange={(e) => setRuleMaxLives(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Repasse Lead KKJ (%)</Label>
                <Input
                  type="number"
                  value={ruleRepassePct}
                  onChange={(e) => setRuleRepassePct(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Repasse Lead Próprio (%)</Label>
                <Input
                  type="number"
                  value={ruleRepasseProprioPct}
                  onChange={(e) => setRuleRepasseProprioPct(e.target.value)}
                />
              </div>
            </div>

            {/* Vigência e Alíquota */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Alíquota de Imposto (%)</Label>
                <Input
                  type="number"
                  value={ruleImpostoPct}
                  onChange={(e) => setRuleImpostoPct(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Início Vigência</Label>
                <Input
                  type="date"
                  value={ruleDataInicio}
                  onChange={(e) => setRuleDataInicio(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">Fim Vigência (Opcional)</Label>
                <Input
                  type="date"
                  value={ruleDataFim}
                  onChange={(e) => setRuleDataFim(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Observações Técnicas</Label>
              <Input
                value={ruleObservacoes}
                onChange={(e) => setRuleObservacoes(e.target.value)}
                placeholder="Ex: Requer termo de responsabilidade assinado"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRuleModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingRule}
                className="bg-primary text-primary-foreground"
              >
                {isSavingRule ? 'Salvando...' : editingRuleId ? 'Atualizar Regra' : 'Criar Regra'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE PRODUCT MODAL */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">Novo Produto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProduct} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Nome do Produto *</Label>
              <Input
                placeholder="Ex: Saúde Coletivo por Adesão"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={productCategory}
                onValueChange={(val) => setProductCategory(val as ProductCategory)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'Saúde PME',
                    'Saúde PF',
                    'Adesão',
                    'Odontológico',
                    'Seguro de Vida',
                    'Seguro Auto',
                    'Consórcio',
                    'Outros',
                  ].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input
                placeholder="Detalhes ou regras comerciais..."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProductModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-[#1B2A4A] text-white text-xs">
                Salvar Produto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
