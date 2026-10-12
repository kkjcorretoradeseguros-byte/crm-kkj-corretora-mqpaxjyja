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
  const [carrierNome, setCarrierNome] = useState('')
  const [carrierNomeCurto, setCarrierNomeCurto] = useState('')
  const [carrierObservacoes, setCarrierObservacoes] = useState('')

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
      const [prodRes, usersRes, carriersRes, teamsRes, mgmRes, currentTax, taxHist] =
        await Promise.all([
          productService.getAllProducts(false),
          userService.getAllUsers(),
          carrierService.getAllCarriers(false),
          teamService.getTeams(),
          teamService.getManagementRules(),
          systemSettingsService.getDefaultTaxRate(),
          systemSettingsService.getTaxHistory(),
        ])
      setProducts(prodRes)
      setUsers(usersRes)
      setCarriers(carriersRes)
      setTeams(teamsRes)
      setManagementRules(mgmRes)
      setTagsList(tagService.getAllTags())
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

  const handleCreateCarrier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!carrierNome.trim()) return

    try {
      await carrierService.createCarrier({
        nome: carrierNome.trim(),
        nome_curto: carrierNomeCurto.trim() || undefined,
        observacoes: carrierObservacoes.trim() || undefined,
        ativo: true,
      })
      setIsCarrierModalOpen(false)
      setCarrierNome('')
      setCarrierNomeCurto('')
      setCarrierObservacoes('')
      loadData()
    } catch (err) {
      console.error(err)
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
      <div className="p-6 rounded-xl bg-white border border-[#E4E7EC] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#1B2A4A] text-white">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#101828]">
              Central do Administrador — CRM KKJ
            </h2>
            <p className="text-xs text-[#667085]">
              Gerenciamento de produtos, funis, motivos de perda, tipos de tarefa e perfis de
              usuários sem alterar código
            </p>
          </div>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E4E7EC] dark:border-[#24324D] pb-2 text-xs">
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
                  ? 'bg-[#1B2A4A] text-white font-semibold shadow-sm'
                  : 'bg-white text-[#667085] hover:bg-slate-100 border border-[#E4E7EC]'
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
              onClick={() => setIsCarrierModalOpen(true)}
              className="bg-[#1B2A4A] dark:bg-primary text-white text-xs hover:bg-[#2A3D6B]"
            >
              <Plus className="h-4 w-4 mr-1" /> Nova Operadora
            </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleCarrier(c)}
                    className="text-xs text-[#667085] dark:text-muted-foreground hover:text-[#101828] dark:hover:text-foreground"
                  >
                    {c.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB: COMISSÕES & REGRAS ESPECIAIS PME */}
      {activeTab === 'COMISSOES' && (
        <div className="space-y-6">
          <Card className="border-[#E4E7EC] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#101828]">
                Regras Especiais Saúde PME (Ativas e Vigentes)
              </CardTitle>
              <CardDescription className="text-xs text-[#667085]">
                Regras especiais prescritas que prevalecem sobre qualquer planilha para contratações
                PME
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-[#E4E7EC]">
                {Object.entries(SPECIAL_PME_RULES)
                  .filter(([k]) => !k.includes(' '))
                  .map(([key, rule]) => (
                    <div key={key} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{rule.carrier}</span>
                        <span className="ml-2 font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {rule.parcelas.join('/')}%{' '}
                          {rule.vitalicioPercentual
                            ? `+ ${rule.vitalicioPercentual}% vitalício da ${rule.vitalicioAPartirDe}ª`
                            : '(sem vitalício)'}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-slate-600">
                        Total: {rule.totalPercentual}%
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Importador da Planilha de Comissões */}
          <Card className="border-blue-200 bg-blue-50/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-blue-950 flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                Importação Oficial: "Grade de comissão - Saúde Bliss.xlsx"
              </CardTitle>
              <CardDescription className="text-xs text-blue-700">
                Rotina idempotente com exclusão de Go Care, opção 1 da Plena Saúde PME e descarte de
                duplicatas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <strong>Status da Planilha:</strong> O arquivo original ainda não foi anexado nesta
                sessão. Insira abaixo dados formatados (CSV) para teste ou importe assim que o
                arquivo for disponibilizado.
              </div>

              <textarea
                rows={3}
                placeholder="Exemplo CSV:&#10;Operadora;Modalidade;1a;2a;3a;4a;5a&#10;Amil;PME;100;100;100;0;0"
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                className="w-full text-xs font-mono p-2 border border-slate-300 rounded bg-white"
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
                Processar e Validar Importação
              </Button>

              {importReport && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 text-xs">
                  <h4 className="font-bold text-slate-800">Relatório de Importação:</h4>
                  <p>
                    Linhas processadas: <strong>{importReport.totalLinhasLidas}</strong>
                  </p>
                  <p className="text-emerald-700">
                    Regras importadas: <strong>{importReport.regrasImportadas}</strong>
                  </p>
                  <p className="text-red-700">
                    Regras descartadas: <strong>{importReport.regrasDescartadas}</strong>
                  </p>
                  <p className="text-amber-700">
                    Regras duplicadas ignoradas: <strong>{importReport.regrasDuplicadas}</strong>
                  </p>
                  {importReport.detalhesDescartes.length > 0 && (
                    <ul className="list-disc pl-4 text-[11px] text-slate-600 pt-1">
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

      {/* CREATE CARRIER MODAL */}
      <Dialog open={isCarrierModalOpen} onOpenChange={setIsCarrierModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828] dark:text-foreground">
              Nova Operadora / Seguradora
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Cadastre uma nova operadora parceira da KKJ
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCarrier} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Operadora *</Label>
              <Input
                placeholder="Ex: Golden Cross, Notredame Intermédica"
                value={carrierNome}
                onChange={(e) => setCarrierNome(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome Curto / Sigla</Label>
              <Input
                placeholder="Ex: GNDI"
                value={carrierNomeCurto}
                onChange={(e) => setCarrierNomeCurto(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
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
                className="bg-[#1B2A4A] dark:bg-primary text-white text-xs"
              >
                Salvar Operadora
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
