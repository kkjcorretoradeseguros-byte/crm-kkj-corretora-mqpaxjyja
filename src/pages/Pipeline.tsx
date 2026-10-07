import React, { useState, useEffect, useCallback } from 'react'
import {
  KanbanSquare,
  Plus,
  Building2,
  User,
  DollarSign,
  Pencil,
  Trash2,
  ArrowRight,
  MoveRight,
  Settings2,
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
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { pipelineService } from '@/services/pipelineService'
import { clientService } from '@/services/clientService'
import { propertyService } from '@/services/propertyService'
import { useRealtime } from '@/hooks/use-realtime'
import type { PipelineStage, PipelineEntry, Client, Property } from '@/types/crm'

export default function Pipeline() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [entries, setEntries] = useState<PipelineEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  // Drag-and-drop state
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null)

  // Modals state
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false)
  const [isStageSettingsOpen, setIsStageSettingsOpen] = useState(false)
  const [isDeleteEntryOpen, setIsDeleteEntryOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<PipelineEntry | null>(null)
  const [isEditingEntry, setIsEditingEntry] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Entry Form state
  const [entryStageId, setEntryStageId] = useState('')
  const [entryClientId, setEntryClientId] = useState('')
  const [entryPropertyId, setEntryPropertyId] = useState('')
  const [entryValue, setEntryValue] = useState('')
  const [entryNotes, setEntryNotes] = useState('')

  // New stage form state
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('#3B82F6')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [stagesRes, entriesRes, clientsRes, propsRes] = await Promise.all([
        pipelineService.getStages(),
        pipelineService.getEntries(),
        clientService.getAllClients(),
        propertyService.getAllProperties(),
      ])
      setStages(stagesRes)
      setEntries(entriesRes)
      setClients(clientsRes)
      setProperties(propsRes)
    } catch (err) {
      console.error('Failed to load pipeline:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtime('pipeline_stages', () => fetchData())
  useRealtime('pipeline_entries', () => fetchData())

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    setDraggedEntryId(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault()
    const entryId = e.dataTransfer.getData('text/plain') || draggedEntryId
    if (!entryId) return

    const currentEntry = entries.find((item) => item.id === entryId)
    if (!currentEntry || currentEntry.stage_id === targetStageId) return

    // Optimistic UI update
    setEntries((prev) =>
      prev.map((item) => (item.id === entryId ? { ...item, stage_id: targetStageId } : item)),
    )

    try {
      await pipelineService.updateEntryStage(entryId, targetStageId)
    } catch (err) {
      console.error('Failed to update stage:', err)
      fetchData()
    } finally {
      setDraggedEntryId(null)
    }
  }

  // Quick move via dropdown (mobile & touch devices)
  const handleMoveStage = async (entryId: string, targetStageId: string) => {
    try {
      setEntries((prev) =>
        prev.map((item) => (item.id === entryId ? { ...item, stage_id: targetStageId } : item)),
      )
      await pipelineService.updateEntryStage(entryId, targetStageId)
    } catch (err) {
      console.error(err)
      fetchData()
    }
  }

  const openCreateEntryModal = (initialStageId?: string) => {
    setIsEditingEntry(false)
    setSelectedEntry(null)
    setEntryStageId(initialStageId || (stages[0]?.id ?? ''))
    setEntryClientId(clients[0]?.id ?? '')
    setEntryPropertyId('NONE')
    setEntryValue('')
    setEntryNotes('')
    setErrorMsg(null)
    setIsEntryFormOpen(true)
  }

  const openEditEntryModal = (entry: PipelineEntry) => {
    setIsEditingEntry(true)
    setSelectedEntry(entry)
    setEntryStageId(entry.stage_id)
    setEntryClientId(entry.client_id)
    setEntryPropertyId(entry.property_id || 'NONE')
    setEntryValue(entry.value?.toString() || '')
    setEntryNotes(entry.notes || '')
    setErrorMsg(null)
    setIsEntryFormOpen(true)
  }

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!entryClientId) {
      setErrorMsg('Selecione um cliente para esta oportunidade.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        stage_id: entryStageId,
        client_id: entryClientId,
        property_id: entryPropertyId !== 'NONE' ? entryPropertyId : undefined,
        value: entryValue ? parseFloat(entryValue) : undefined,
        notes: entryNotes,
      }

      if (isEditingEntry && selectedEntry) {
        await pipelineService.updateEntry(selectedEntry.id, payload)
      } else {
        await pipelineService.createEntry(payload)
      }

      setIsEntryFormOpen(false)
      fetchData()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setErrorMsg(errObj.message || 'Erro ao salvar oportunidade no pipeline.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEntry = async () => {
    if (!selectedEntry) return
    setIsSaving(true)
    try {
      await pipelineService.deleteEntry(selectedEntry.id)
      setIsDeleteEntryOpen(false)
      fetchData()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      alert(errObj.message || 'Erro ao remover oportunidade.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStageName.trim()) return

    try {
      await pipelineService.createStage({
        name: newStageName.trim(),
        position: stages.length + 1,
        color: newStageColor,
      })
      setNewStageName('')
      fetchData()
    } catch (err) {
      console.error('Failed to create stage:', err)
    }
  }

  const handleDeleteStage = async (stageId: string) => {
    if (confirm('Tem certeza que deseja excluir esta etapa do funil?')) {
      try {
        await pipelineService.deleteStage(stageId)
        fetchData()
      } catch (err) {
        alert('Não é possível remover etapa com negociações ativas.')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#101828]">
            Pipeline de Vendas (Kanban)
          </h2>
          <p className="text-xs sm:text-sm text-[#667085]">
            Arraste os cards entre as colunas para atualizar a fase de cada negociação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsStageSettingsOpen(true)}
            className="border-[#E4E7EC] text-xs flex items-center gap-1.5"
          >
            <Settings2 className="h-4 w-4" /> Gerenciar Etapas
          </Button>
          <Button
            onClick={() => openCreateEntryModal()}
            className="bg-[#1B2A4A] hover:bg-[#2A3D6B] text-white flex items-center gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" /> Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-72 h-[550px] shrink-0 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 items-start min-h-[600px]">
          {stages.map((stage) => {
            const stageEntries = entries.filter((e) => e.stage_id === stage.id)
            const stageTotalValue = stageEntries.reduce((sum, e) => sum + (e.value || 0), 0)

            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
                className="w-72 shrink-0 flex flex-col rounded-xl border border-[#E4E7EC] bg-[#F5F7FA] overflow-hidden"
              >
                {/* Column Header */}
                <div className="p-3.5 bg-white border-b border-[#E4E7EC] relative">
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: stage.color || '#3B82F6' }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#101828] truncate">{stage.name}</span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100">
                      {stageEntries.length}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-semibold text-[#667085] mt-1">
                    {stageTotalValue > 0 ? `R$ ${stageTotalValue.toLocaleString('pt-BR')}` : 'R$ 0'}
                  </div>
                </div>

                {/* Column Body / Cards */}
                <div className="p-2.5 flex-1 space-y-2.5 min-h-[350px]">
                  {stageEntries.map((entry) => {
                    const client =
                      entry.expand?.client_id || clients.find((c) => c.id === entry.client_id)
                    const property =
                      entry.expand?.property_id ||
                      properties.find((p) => p.id === entry.property_id)

                    return (
                      <div
                        key={entry.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, entry.id)}
                        className="p-3 rounded-lg border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing space-y-2 text-xs"
                      >
                        {/* Client name & actions */}
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1.5 font-bold text-[#101828] truncate">
                            <User className="h-3.5 w-3.5 text-[#1B2A4A] shrink-0" />
                            <span className="truncate">{client?.full_name || 'Cliente'}</span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => openEditEntryModal(entry)}
                              className="p-1 hover:text-[#1B2A4A] text-[#667085]"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedEntry(entry)
                                setIsDeleteEntryOpen(true)
                              }}
                              className="p-1 hover:text-[#D92D20] text-[#667085]"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Property related */}
                        {property && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#667085] truncate">
                            <Building2 className="h-3 w-3 shrink-0 text-[#667085]" />
                            <span className="truncate">{property.title}</span>
                          </div>
                        )}

                        {/* Value */}
                        {entry.value !== undefined && entry.value > 0 && (
                          <div className="font-extrabold text-[#1B2A4A] text-xs">
                            R$ {entry.value.toLocaleString('pt-BR')}
                          </div>
                        )}

                        {/* Notes */}
                        {entry.notes && (
                          <p className="text-[11px] text-[#667085] line-clamp-2 leading-relaxed bg-[#F5F7FA] p-1.5 rounded">
                            {entry.notes}
                          </p>
                        )}

                        {/* Quick stage switch for mobile/touch */}
                        <div className="pt-1.5 border-t border-[#E4E7EC] flex items-center justify-between text-[10px]">
                          <span className="text-[#667085]">Mover para:</span>
                          <select
                            value={entry.stage_id}
                            onChange={(e) => handleMoveStage(entry.id, e.target.value)}
                            className="bg-transparent text-[#1B2A4A] font-semibold text-[10px] focus:outline-none"
                          >
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}

                  {stageEntries.length === 0 && (
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
                    onClick={() => openCreateEntryModal(stage.id)}
                    className="w-full text-xs text-[#667085] hover:text-[#101828] hover:bg-[#F5F7FA]"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Card
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE / EDIT PIPELINE ENTRY MODAL */}
      <Dialog open={isEntryFormOpen} onOpenChange={setIsEntryFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#101828]">
              {isEditingEntry ? 'Editar Negociação' : 'Nova Oportunidade'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Vincule um cliente, selecione o imóvel e estime o valor da negociação
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEntry} className="space-y-4 py-2">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 text-red-900 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cliente *</Label>
              <Select value={entryClientId} onValueChange={setEntryClientId}>
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
              <Label className="text-xs font-medium">Imóvel Relacionado (Opcional)</Label>
              <Select value={entryPropertyId} onValueChange={setEntryPropertyId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o imóvel ou deixe em branco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Nenhum imóvel vinculado</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} - R$ {p.price.toLocaleString('pt-BR')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Etapa do Funil</Label>
                <Select value={entryStageId} onValueChange={setEntryStageId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor Estimado (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 850000"
                  value={entryValue}
                  onChange={(e) => setEntryValue(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notas & Andamento</Label>
              <Textarea
                rows={3}
                placeholder="Observações sobre propostas, condições de pagamento ou interesse..."
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEntryFormOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-[#1B2A4A] text-white text-xs">
                {isSaving ? 'Salvando...' : isEditingEntry ? 'Salvar Alterações' : 'Criar Card'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* STAGE CONFIGURATION MODAL */}
      <Dialog open={isStageSettingsOpen} onOpenChange={setIsStageSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#101828]">
              Configuração das Etapas do Funil
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Adicione novas fases ou personalize o pipeline de vendas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* List of existing stages */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#101828] uppercase tracking-wider">
                Etapas Atuais ({stages.length})
              </h4>
              <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-lg">
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between p-2.5 text-xs bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color || '#3B82F6' }}
                      />
                      <span className="font-semibold text-[#101828]">{stage.name}</span>
                      <span className="text-[10px] text-[#667085]">(Posição {stage.position})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteStage(stage.id)}
                      className="h-7 w-7 text-[#667085] hover:text-[#D92D20]"
                      title="Excluir Etapa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add new stage form */}
            <form onSubmit={handleAddStage} className="space-y-3 pt-3 border-t border-[#E4E7EC]">
              <h4 className="text-xs font-bold text-[#101828] uppercase tracking-wider">
                Adicionar Nova Etapa
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-medium">Nome da Etapa</Label>
                  <Input
                    placeholder="Ex: Análise de Crédito"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Cor</Label>
                  <Input
                    type="color"
                    value={newStageColor}
                    onChange={(e) => setNewStageColor(e.target.value)}
                    className="h-8 p-1 cursor-pointer"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" className="bg-[#1B2A4A] text-white text-xs w-full">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Inserir Etapa
              </Button>
            </form>
          </div>

          <DialogFooter className="pt-2 border-t border-[#E4E7EC]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStageSettingsOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE ENTRY CONFIRMATION */}
      <Dialog open={isDeleteEntryOpen} onOpenChange={setIsDeleteEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#D92D20] flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Excluir Oportunidade
            </DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Deseja remover esta oportunidade do pipeline?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteEntryOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleDeleteEntry}
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
