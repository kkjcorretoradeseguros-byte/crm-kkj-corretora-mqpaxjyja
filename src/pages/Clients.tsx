import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { clientService } from '@/services/clientService'
import { propertyService } from '@/services/propertyService'
import { interactionService } from '@/services/interactionService'
import { useRealtime } from '@/hooks/use-realtime'
import type { Client, ClientStatus, Property, Interaction } from '@/types/crm'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'ALL'>('ALL')

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientInteractions, setClientInteractions] = useState<Interaction[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<ClientStatus>('Interessado')
  const [notes, setNotes] = useState('')
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([])

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const [clientsRes, propsRes] = await Promise.all([
        clientService.getClients({
          status: statusFilter,
          search,
        }),
        propertyService.getAllProperties(),
      ])
      setClients(clientsRes.items)
      setProperties(propsRes)
    } catch (err) {
      console.error('Failed to load clients:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useRealtime('clients', () => fetchClients())

  const openCreateModal = () => {
    setIsEditing(false)
    setSelectedClient(null)
    setFullName('')
    setPhone('')
    setEmail('')
    setStatus('Interessado')
    setNotes('')
    setSelectedPropertyIds([])
    setFormError(null)
    setIsFormOpen(true)
  }

  const openEditModal = (client: Client) => {
    setIsEditing(true)
    setSelectedClient(client)
    setFullName(client.full_name)
    setPhone(client.phone)
    setEmail(client.email || '')
    setStatus(client.status)
    setNotes(client.notes || '')
    setSelectedPropertyIds(client.interested_properties || [])
    setFormError(null)
    setIsFormOpen(true)
  }

  const openDetailModal = async (client: Client) => {
    setSelectedClient(client)
    setIsDetailOpen(true)
    try {
      const inters = await interactionService.getInteractionsByClient(client.id)
      setClientInteractions(inters)
    } catch (err) {
      console.error('Failed to load interactions for client:', err)
    }
  }

  const openDeleteModal = (client: Client) => {
    setSelectedClient(client)
    setIsDeleteOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!fullName.trim()) {
      setFormError('Nome do cliente é obrigatório.')
      return
    }
    if (!phone.trim()) {
      setFormError('Telefone é obrigatório.')
      return
    }

    setIsSaving(true)
    try {
      const payload: Partial<Client> = {
        full_name: fullName,
        phone,
        email,
        status,
        notes,
        interested_properties: selectedPropertyIds,
      }

      if (isEditing && selectedClient) {
        await clientService.updateClient(selectedClient.id, payload)
      } else {
        await clientService.createClient(payload)
      }

      setIsFormOpen(false)
      fetchClients()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setFormError(errObj.message || 'Erro ao salvar cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedClient) return
    setIsSaving(true)
    try {
      await clientService.deleteClient(selectedClient.id)
      setIsDeleteOpen(false)
      fetchClients()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      alert(errObj.message || 'Erro ao excluir cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusBadge = (s: ClientStatus) => {
    switch (s) {
      case 'Ativo':
        return (
          <Badge className="bg-[#12B76A]/10 text-[#12B76A] hover:bg-[#12B76A]/20 border-[#12B76A]/30">
            Ativo
          </Badge>
        )
      case 'Interessado':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
            Interessado
          </Badge>
        )
      case 'Inativo':
        return (
          <Badge variant="outline" className="text-gray-500 border-gray-300">
            Inativo
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#101828]">
            Gestão de Clientes & Leads
          </h2>
          <p className="text-xs sm:text-sm text-[#667085]">
            Controle de compradores, locatários e contatos comerciais ({clients.length} clientes)
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-[#E4E7EC] shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#667085]" />
              <Input
                type="text"
                placeholder="Buscar por nome, telefone, e-mail ou observações..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs border-[#E4E7EC]"
              />
            </div>
            <div>
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as ClientStatus | 'ALL')}
              >
                <SelectTrigger className="h-9 text-xs border-[#E4E7EC]">
                  <SelectValue placeholder="Status do Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Interessado">Interessado</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients List / Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card className="border-dashed border-2 border-[#E4E7EC] p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <Users className="h-12 w-12 text-[#667085]/60" />
            <h3 className="text-base font-semibold text-[#101828]">Nenhum cliente cadastrado</h3>
            <p className="text-xs text-[#667085] max-w-sm">
              Comece adicionando compradores ou proprietários para gerenciar suas negociações.
            </p>
            <Button onClick={openCreateModal} className="bg-[#1B2A4A] text-white text-xs mt-2">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Primeiro Cliente
            </Button>
          </div>
        </Card>
      ) : (
        <div className="rounded-xl border border-[#E4E7EC] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FA] border-b border-[#E4E7EC] text-[#667085] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Nome do Cliente</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Imóveis de Interesse</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {clients.map((c) => {
                  const interestedCount = c.interested_properties?.length || 0

                  return (
                    <tr key={c.id} className="hover:bg-[#F5F7FA]/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#101828]">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1B2A4A]/10 text-[#1B2A4A] font-bold text-[11px]">
                            {c.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <span>{c.full_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#667085] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-[#667085]" />
                          <span>{c.phone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#667085]">
                        {c.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-[#667085]" />
                            <span className="truncate max-w-[180px]">{c.email}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(c.status)}</td>
                      <td className="py-3.5 px-4 text-[#667085]">
                        {interestedCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px] bg-slate-100">
                            {interestedCount} {interestedCount === 1 ? 'imóvel' : 'imóveis'}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetailModal(c)}
                            title="Ver Detalhes"
                            className="h-7 w-7 text-[#667085] hover:text-[#1B2A4A]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(c)}
                            title="Editar"
                            className="h-7 w-7 text-[#667085] hover:text-[#1B2A4A]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteModal(c)}
                            title="Excluir"
                            className="h-7 w-7 text-[#667085] hover:text-[#D92D20]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#101828]">
              {isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Insira os dados de contato e preferências do cliente
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-900 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="c_name" className="text-xs font-medium">
                Nome Completo *
              </Label>
              <Input
                id="c_name"
                placeholder="Ex: Maria Clara Oliveira"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c_phone" className="text-xs font-medium">
                  Telefone / Celular *
                </Label>
                <Input
                  id="c_phone"
                  placeholder="(11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c_status" className="text-xs font-medium">
                  Status do Cliente
                </Label>
                <Select value={status} onValueChange={(val) => setStatus(val as ClientStatus)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Interessado">Interessado</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c_email" className="text-xs font-medium">
                E-mail
              </Label>
              <Input
                id="c_email"
                type="email"
                placeholder="cliente@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Imóveis de Interesse</Label>
              <div className="max-h-36 overflow-y-auto border border-[#E4E7EC] rounded-lg p-2 space-y-1.5">
                {properties.map((p) => {
                  const isChecked = selectedPropertyIds.includes(p.id)
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-[#F5F7FA] cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPropertyIds([...selectedPropertyIds, p.id])
                          } else {
                            setSelectedPropertyIds(selectedPropertyIds.filter((id) => id !== p.id))
                          }
                        }}
                        className="rounded border-[#E4E7EC]"
                      />
                      <span className="font-medium text-[#101828] truncate">{p.title}</span>
                      <span className="text-[11px] text-[#667085] ml-auto shrink-0">
                        R$ {p.price.toLocaleString('pt-BR')}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c_notes" className="text-xs font-medium">
                Observações & Perfil de Compra
              </Label>
              <Textarea
                id="c_notes"
                rows={3}
                placeholder="Preferências de bairro, faixa orçamentária, composição familiar..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-[#1B2A4A] text-white text-xs">
                {isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CLIENT DETAIL MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClient && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  {getStatusBadge(selectedClient.status)}
                  <span className="text-[11px] text-[#667085]">
                    Cadastrado em{' '}
                    {new Date(selectedClient.created || '').toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold text-[#101828] mt-2">
                  {selectedClient.full_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#667085]">
                  Ficha cadastral completa e histórico de interações
                </DialogDescription>
              </DialogHeader>

              {/* Contact info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F5F7FA] border border-[#E4E7EC]">
                <div className="flex items-center gap-2 text-xs">
                  <Phone className="h-4 w-4 text-[#1B2A4A]" />
                  <div>
                    <span className="text-[10px] text-[#667085] block">Telefone / WhatsApp</span>
                    <strong className="text-[#101828]">{selectedClient.phone}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="h-4 w-4 text-[#1B2A4A]" />
                  <div>
                    <span className="text-[10px] text-[#667085] block">E-mail</span>
                    <strong className="text-[#101828]">
                      {selectedClient.email || 'Não informado'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedClient.notes && (
                <div>
                  <h4 className="text-xs font-bold text-[#101828] uppercase tracking-wider mb-1.5">
                    Observações e Requisitos
                  </h4>
                  <div className="p-3 rounded-lg border border-[#E4E7EC] bg-white text-xs text-[#667085] leading-relaxed">
                    {selectedClient.notes}
                  </div>
                </div>
              )}

              {/* Property Interests */}
              <div>
                <h4 className="text-xs font-bold text-[#101828] uppercase tracking-wider mb-2">
                  Imóveis de Interesse ({selectedClient.interested_properties?.length || 0})
                </h4>
                {!selectedClient.interested_properties ||
                selectedClient.interested_properties.length === 0 ? (
                  <p className="text-xs text-[#667085]">Nenhum imóvel vinculado como interesse.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedClient.interested_properties.map((pId) => {
                      const p = properties.find((item) => item.id === pId)
                      if (!p) return null
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-[#E4E7EC] bg-white text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-[#1B2A4A]" />
                            <span className="font-semibold text-[#101828]">{p.title}</span>
                          </div>
                          <span className="font-bold text-[#1B2A4A]">
                            R$ {p.price.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Interaction History */}
              <div>
                <h4 className="text-xs font-bold text-[#101828] uppercase tracking-wider mb-2">
                  Histórico de Interações ({clientInteractions.length})
                </h4>
                {clientInteractions.length === 0 ? (
                  <p className="text-xs text-[#667085]">
                    Nenhuma interação registrada para este cliente.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {clientInteractions.map((inter) => (
                      <div
                        key={inter.id}
                        className="p-2.5 rounded-lg border border-[#E4E7EC] bg-[#F5F7FA] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">
                            {inter.type}
                          </Badge>
                          <span className="text-[10px] text-[#667085]">
                            {new Date(inter.interaction_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-xs text-[#101828]">{inter.notes}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t border-[#E4E7EC]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailOpen(false)
                    openEditModal(selectedClient)
                  }}
                  className="text-xs"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar Cliente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#D92D20] flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Tem certeza que deseja remover o cliente{' '}
              <strong className="text-[#101828]">{selectedClient?.full_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleDelete}
              className="bg-[#D92D20] hover:bg-red-700 text-white text-xs"
            >
              {isSaving ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
