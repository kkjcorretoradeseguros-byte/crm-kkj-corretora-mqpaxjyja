import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Search,
  Plus,
  MapPin,
  Briefcase,
  Edit2,
  Trash2,
  ArrowRight,
  KanbanSquare,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { companyService } from '@/services/companyService'
import { opportunityService } from '@/services/opportunityService'
import { contractService } from '@/services/contractService'
import type { Company, Opportunity, Contract } from '@/types/crm'

export default function Companies() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal create/edit company
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [tradeName, setTradeName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [segment, setSegment] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal new opportunity for this company (Cliente Ativo / Upsell)
  const [isNewOppModalOpen, setIsNewOppModalOpen] = useState(false)
  const [targetCompany, setTargetCompany] = useState<Company | null>(null)
  const [newOppTitle, setNewOppTitle] = useState('')
  const [newOppValue, setNewOppValue] = useState('')
  const [newOppStage, setNewOppStage] = useState('Novo Lead')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await companyService.getCompanies({ search })
      setCompanies(res.items)
    } catch (err) {
      console.error('Failed to load companies:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const openCreateModal = () => {
    setEditingCompany(null)
    setTradeName('')
    setLegalName('')
    setCnpj('')
    setCity('')
    setState('')
    setSegment('')
    setNotes('')
    setError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (comp: Company) => {
    setEditingCompany(comp)
    setTradeName(comp.trade_name)
    setLegalName(comp.legal_name || '')
    setCnpj(comp.cnpj || '')
    setCity(comp.city || '')
    setState(comp.state || '')
    setSegment(comp.segment || '')
    setNotes(comp.notes || '')
    setError(null)
    setIsModalOpen(true)
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!tradeName.trim()) {
      setError('Nome Fantasia é obrigatório.')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<Company> = {
        trade_name: tradeName.trim(),
        legal_name: legalName.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        segment: segment.trim() || undefined,
        notes: notes.trim() || undefined,
      }

      if (editingCompany) {
        await companyService.updateCompany(editingCompany.id, payload)
      } else {
        await companyService.createCompany(payload)
      }
      setIsModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setError(errObj.message || 'Erro ao salvar empresa.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir esta empresa?')) {
      try {
        await companyService.deleteCompany(id)
        loadData()
      } catch (err) {
        console.error(err)
      }
    }
  }

  const openNewOppForCompany = (comp: Company) => {
    setTargetCompany(comp)
    setNewOppTitle(`Novo Produto / Oportunidade - ${comp.trade_name}`)
    setNewOppValue('')
    setNewOppStage('Novo Lead')
    setIsNewOppModalOpen(true)
  }

  const handleCreateNewOpp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetCompany || !newOppTitle.trim()) return

    try {
      await opportunityService.createOpportunity({
        title: newOppTitle.trim(),
        pipeline_type: 'VENDAS', // Volta ao Funil de Vendas sem afetar produtos ativos
        stage: newOppStage,
        temperature: 'Quente',
        company_id: targetCompany.id,
        sale_value: newOppValue ? parseFloat(newOppValue) : 0,
        origin: 'Base de Clientes / Cross-sell',
      })
      setIsNewOppModalOpen(false)
      navigate('/pipeline')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#101828]">Empresas & Clientes PJ</h2>
          <p className="text-xs text-[#667085]">
            Cadastro único por empresa — gerencie múltiplos produtos e oportunidades ao longo do
            tempo
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          className="bg-[#1B2A4A] text-white text-xs hover:bg-[#2A3D6B]"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Nova Empresa
        </Button>
      </div>

      {/* Search Input */}
      <div className="max-w-md relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
        <Input
          placeholder="Buscar por nome fantasia, razão social, CNPJ ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs bg-white border-[#E4E7EC]"
        />
      </div>

      {/* Companies Table */}
      <div className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-slate-100" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#667085]">Nenhuma empresa cadastrada.</div>
        ) : (
          <Table>
            <TableHeader className="bg-[#F5F7FA]">
              <TableRow>
                <TableHead className="text-xs font-bold text-[#101828]">Nome Fantasia</TableHead>
                <TableHead className="text-xs font-bold text-[#101828]">
                  Razão Social / CNPJ
                </TableHead>
                <TableHead className="text-xs font-bold text-[#101828]">Cidade / UF</TableHead>
                <TableHead className="text-xs font-bold text-[#101828]">Segmento</TableHead>
                <TableHead className="text-xs font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((comp) => (
                <TableRow key={comp.id} className="text-xs">
                  <TableCell className="font-bold text-[#101828]">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#1B2A4A] shrink-0" />
                      <span>{comp.trade_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[#101828]">{comp.legal_name || '—'}</span>
                      {comp.cnpj && (
                        <span className="text-[11px] font-mono text-[#667085]">
                          CNPJ: {comp.cnpj}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[#667085]">
                    {comp.city ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {comp.city} - {comp.state}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {comp.segment ? (
                      <Badge variant="outline" className="text-[10px]">
                        {comp.segment}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* "+ Nova Oportunidade" (volta ao funil de vendas p/ novo produto) */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openNewOppForCompany(comp)}
                        title="Nova Oportunidade no Funil de Vendas"
                        className="h-7 text-[11px] px-2 text-[#1B2A4A] border-[#1B2A4A]/20 hover:bg-[#1B2A4A] hover:text-white"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Oportunidade
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(comp)}
                        className="h-7 w-7 text-[#667085] hover:text-[#101828]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(comp.id)}
                        className="h-7 w-7 text-[#667085] hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* CREATE / EDIT COMPANY MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              {editingCompany ? 'Editar Empresa' : 'Nova Empresa / Cliente PJ'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Dados cadastrais da empresa tomadora de seguros e benefícios
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCompany} className="space-y-3 py-2 text-xs">
            {error && (
              <div className="p-2 rounded bg-red-50 text-red-900 border border-red-200 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Nome Fantasia *</Label>
              <Input
                placeholder="Ex: Lumina Tecnologia"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Razão Social</Label>
              <Input
                placeholder="Ex: Lumina Desenvolvimento de Software Ltda"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Segmento / Ramo</Label>
                <Input
                  placeholder="Ex: Tecnologia / TI"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input
                  placeholder="Ex: São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Estado (UF)</Label>
                <Input
                  placeholder="Ex: SP"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações da Empresa</Label>
              <Textarea
                rows={2}
                placeholder="Histórico, perfil corporativo ou regras de contratação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="bg-[#1B2A4A] text-white text-xs"
              >
                {saving ? 'Salvando...' : 'Salvar Empresa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA OPORTUNIDADE P/ ESTA EMPRESA */}
      <Dialog open={isNewOppModalOpen} onOpenChange={setIsNewOppModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Nova Oportunidade no Funil de Vendas
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Cria uma nova oportunidade para {targetCompany?.trade_name} sem alterar os produtos
              ativos existentes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNewOpp} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Título da Nova Oportunidade *</Label>
              <Input
                value={newOppTitle}
                onChange={(e) => setNewOppTitle(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Valor Estimado (R$)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 8500"
                  value={newOppValue}
                  onChange={(e) => setNewOppValue(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Etapa Inicial</Label>
                <Input value={newOppStage} disabled className="h-8 text-xs bg-slate-50" />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewOppModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-[#1B2A4A] text-white text-xs">
                Criar Oportunidade
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
