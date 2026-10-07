import React, { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Shield,
  Layers,
  Package,
  AlertCircle,
  CheckSquare,
  Users,
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
import { useAuth } from '@/contexts/AuthContext'
import type { Product, ProductCategory, User, UserRole } from '@/types/crm'

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<
    'PRODUTOS' | 'ETAPAS' | 'PERDAS' | 'TAREFAS' | 'USUARIOS'
  >('PRODUTOS')

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [productName, setProductName] = useState('')
  const [productCategory, setProductCategory] = useState<ProductCategory>('Saúde PME')
  const [productDescription, setProductDescription] = useState('')

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
      const [prodRes, usersRes] = await Promise.all([
        productService.getAllProducts(false),
        userService.getAllUsers(),
      ])
      setProducts(prodRes)
      setUsers(usersRes)
    } catch (err) {
      console.error(err)
    }
  }, [])

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
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E4E7EC] pb-2 text-xs">
        {[
          { key: 'PRODUTOS', label: 'Catálogo de Produtos', icon: Package },
          { key: 'ETAPAS', label: 'Funis & Etapas', icon: Layers },
          { key: 'PERDAS', label: 'Motivos de Perda', icon: AlertCircle },
          { key: 'TAREFAS', label: 'Tipos de Tarefa', icon: CheckSquare },
          { key: 'USUARIOS', label: 'Usuários & Perfis', icon: Users },
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

      {/* TAB 5: USUÁRIOS & PERFIS */}
      {activeTab === 'USUARIOS' && (
        <Card className="border-[#E4E7EC] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#101828]">
              Usuários e Perfis de Acesso
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              ADMINISTRADOR (acesso total), GESTOR (coordenação comercial), VENDEDOR (restrito à
              própria carteira)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#E4E7EC]">
              {users.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#101828] text-sm">{u.name || 'Sem nome'}</span>
                    <p className="text-[11px] text-[#667085]">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={u.role || 'VENDEDOR'}
                      onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                    >
                      <SelectTrigger className="h-8 text-xs w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMINISTRADOR">ADMINISTRADOR</SelectItem>
                        <SelectItem value="GESTOR">GESTOR</SelectItem>
                        <SelectItem value="VENDEDOR">VENDEDOR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
