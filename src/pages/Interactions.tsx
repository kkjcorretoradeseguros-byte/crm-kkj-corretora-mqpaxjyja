import React, { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Plus,
  Phone,
  Mail,
  Video,
  Clock,
  Home,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
  Filter,
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
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { interactionService } from '@/services/interactionService'
import { clientService } from '@/services/clientService'
import { useRealtime } from '@/hooks/use-realtime'
import type { Interaction, InteractionType, Client } from '@/types/crm'

export default function Interactions() {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [clientFilter, setClientFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<InteractionType | 'ALL'>('ALL')

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Form Fields
  const [clientId, setClientId] = useState('')
  const [type, setType] = useState<InteractionType>('WhatsApp')
  const [notes, setNotes] = useState('')
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().slice(0, 16))
  const [followUpDate, setFollowUpDate] = useState('')

  const fetchInteractions = useCallback(async () => {
    setLoading(true)
    try {
      const [intersRes, clientsRes] = await Promise.all([
        interactionService.getInteractions({
          clientId: clientFilter !== 'ALL' ? clientFilter : undefined,
          type: typeFilter !== 'ALL' ? typeFilter : undefined,
          perPage: 50,
        }),
        clientService.getAllClients(),
      ])
      setInteractions(intersRes.items)
      setClients(clientsRes)
    } catch (err) {
      console.error('Failed to load interactions:', err)
    } finally {
      setLoading(false)
    }
  }, [clientFilter, typeFilter])

  useEffect(() => {
    fetchInteractions()
  }, [fetchInteractions])

  useRealtime('interactions', () => fetchInteractions())

  const openCreateModal = () => {
    setIsEditing(false)
    setSelectedInteraction(null)
    setClientId(clients.length > 0 ? clients[0].id : '')
    setType('WhatsApp')
    setNotes('')
    setInteractionDate(new Date().toISOString().slice(0, 16))
    setFollowUpDate('')
    setFormError(null)
    setIsFormOpen(true)
  }

  const openEditModal = (inter: Interaction) => {
    setIsEditing(true)
    setSelectedInteraction(inter)
    setClientId(inter.client_id)
    setType(inter.type)
    setNotes(inter.notes)
    setInteractionDate(new Date(inter.interaction_date).toISOString().slice(0, 16))
    setFollowUpDate(
      inter.follow_up_date ? new Date(inter.follow_up_date).toISOString().slice(0, 16) : '',
    )
    setFormError(null)
    setIsFormOpen(true)
  }

  const openDeleteModal = (inter: Interaction) => {
    setSelectedInteraction(inter)
    setIsDeleteOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!clientId) {
      setFormError('Selecione um cliente para a interação.')
      return
    }
    if (!notes.trim()) {
      setFormError('Descreva o que foi tratado na interação.')
      return
    }

    setIsSaving(true)
    try {
      const payload: Partial<Interaction> = {
        client_id: clientId,
        type,
        notes,
        interaction_date: new Date(interactionDate).toISOString(),
        follow_up_date: followUpDate ? new Date(followUpDate).toISOString() : undefined,
      }

      if (isEditing && selectedInteraction) {
        await interactionService.updateInteraction(selectedInteraction.id, payload)
      } else {
        await interactionService.createInteraction(payload)
      }

      setIsFormOpen(false)
      fetchInteractions()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setFormError(errObj.message || 'Erro ao registrar interação.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedInteraction) return
    setIsSaving(true)
    try {
      await interactionService.deleteInteraction(selectedInteraction.id)
      setIsDeleteOpen(false)
      fetchInteractions()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      alert(errObj.message || 'Erro ao excluir interação.')
    } finally {
      setIsSaving(false)
    }
  }

  const getInteractionIcon = (t: string) => {
    switch (t) {
      case 'Telefone':
        return <Phone className="h-4 w-4 text-blue-600" />
      case 'E-mail':
        return <Mail className="h-4 w-4 text-purple-600" />
      case 'Visita':
        return <Home className="h-4 w-4 text-amber-600" />
      case 'Reunião':
        return <Video className="h-4 w-4 text-emerald-600" />
      case 'WhatsApp':
        return <MessageSquare className="h-4 w-4 text-green-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#101828]">
            Histórico de Interações
          </h2>
          <p className="text-xs sm:text-sm text-[#667085]">
            Acompanhamento de ligações, reuniões presenciais e mensagens trocadas (
            {interactions.length} registros)
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Nova Interação
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-[#E4E7EC] shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 text-xs border-[#E4E7EC]">
                  <SelectValue placeholder="Filtrar por Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Clientes</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select
                value={typeFilter}
                onValueChange={(val) => setTypeFilter(val as InteractionType | 'ALL')}
              >
                <SelectTrigger className="h-9 text-xs border-[#E4E7EC]">
                  <SelectValue placeholder="Tipo de Interação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Tipos</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="Visita">Visita</SelectItem>
                  <SelectItem value="Reunião">Reunião</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline / List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : interactions.length === 0 ? (
        <Card className="border-dashed border-2 border-[#E4E7EC] p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <MessageSquare className="h-12 w-12 text-[#667085]/60" />
            <h3 className="text-base font-semibold text-[#101828]">Nenhuma interação encontrada</h3>
            <p className="text-xs text-[#667085] max-w-sm">
              Registre a primeira conversa, visita ou telefonema com seu cliente.
            </p>
            <Button onClick={openCreateModal} className="bg-[#1B2A4A] text-white text-xs mt-2">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Registrar Interação
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {interactions.map((inter) => {
            const client = clients.find((c) => c.id === inter.client_id)
            const clientName = client?.full_name || inter.expand?.client_id?.full_name || 'Cliente'
            const dateStr = new Date(inter.interaction_date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            const followUpStr = inter.follow_up_date
              ? new Date(inter.follow_up_date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null

            return (
              <div
                key={inter.id}
                className="p-4 rounded-xl border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-1 p-2.5 rounded-lg bg-[#F5F7FA] border border-[#E4E7EC] shrink-0">
                    {getInteractionIcon(inter.type)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-[#101828]">{clientName}</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium">
                        {inter.type}
                      </Badge>
                      <span className="text-xs text-[#667085]">• {dateStr}</span>
                    </div>

                    <p className="text-xs text-[#101828] leading-relaxed whitespace-pre-line">
                      {inter.notes}
                    </p>

                    {followUpStr && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-amber-700">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Próximo retorno / Follow-up: {followUpStr}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditModal(inter)}
                    className="h-8 w-8 text-[#667085] hover:text-[#1B2A4A]"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteModal(inter)}
                    className="h-8 w-8 text-[#667085] hover:text-[#D92D20]"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#101828]">
              {isEditing ? 'Editar Interação' : 'Registrar Nova Interação'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Documente os pontos discutidos e agende o próximo contato
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
              <Label className="text-xs font-medium">Cliente Relacionado *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} ({c.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Canal de Contato</Label>
              <Select value={type} onValueChange={(val) => setType(val as InteractionType)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="Visita">Visita Presencial</SelectItem>
                  <SelectItem value="Reunião">Reunião Online</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data e Hora *</Label>
                <Input
                  type="datetime-local"
                  value={interactionDate}
                  onChange={(e) => setInteractionDate(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Follow-up (Opcional)</Label>
                <Input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Resumo da Conversa / Notas *</Label>
              <Textarea
                rows={4}
                placeholder="Detalhes tratados, impressões do cliente, objeções levantadas..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required
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
                {isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#D92D20] flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Excluir Registro
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Deseja remover este registro de interação?
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
