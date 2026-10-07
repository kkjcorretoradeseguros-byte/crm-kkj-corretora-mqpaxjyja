import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckSquare,
  Clock,
  Plus,
  AlertCircle,
  Calendar,
  CheckCircle2,
  List,
  CalendarDays,
  User,
  KanbanSquare,
  Search,
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
import { Skeleton } from '@/components/ui/skeleton'
import { taskService } from '@/services/taskService'
import { opportunityService } from '@/services/opportunityService'
import { useAuth } from '@/contexts/AuthContext'
import type { Task, TaskType, TaskStatus, Opportunity } from '@/types/crm'

export default function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  // Tabs: 'TODAS', 'HOJE', 'ATRASADAS', 'PROXIMAS', 'MINHAS'
  const [filterTab, setFilterTab] = useState<
    'TODAS' | 'HOJE' | 'ATRASADAS' | 'PROXIMAS' | 'MINHAS'
  >('HOJE')
  const [viewMode, setViewMode] = useState<'LISTA' | 'CALENDARIO'>('LISTA')

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('Ligação')
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [taskDueTime, setTaskDueTime] = useState('14:00')
  const [taskOppId, setTaskOppId] = useState('')
  const [taskNotes, setTaskNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, oppsRes] = await Promise.all([
        taskService.getAllTasks(),
        opportunityService.getAllOpportunities(),
      ])
      setTasks(tasksRes)
      setOpportunities(oppsRes)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const todayStr = new Date().toISOString().slice(0, 10)

  // Filter tasks based on current tab
  const filteredTasks = tasks.filter((t) => {
    if (filterTab === 'HOJE') {
      return t.due_date === todayStr
    }
    if (filterTab === 'ATRASADAS') {
      return t.status === 'Pendente' && t.due_date < todayStr
    }
    if (filterTab === 'PROXIMAS') {
      return t.due_date > todayStr
    }
    if (filterTab === 'MINHAS') {
      return t.assigned_to === user?.id
    }
    return true
  })

  const openCreateModal = () => {
    setTaskTitle('')
    setTaskType('Ligação')
    setTaskDueDate(new Date().toISOString().slice(0, 10))
    setTaskDueTime('14:00')
    setTaskOppId(opportunities[0]?.id || '')
    setTaskNotes('')
    setError(null)
    setIsModalOpen(true)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!taskTitle.trim()) {
      setError('Título da tarefa é obrigatório.')
      return
    }

    setSaving(true)
    try {
      await taskService.createTask({
        title: taskTitle.trim(),
        type: taskType,
        due_date: taskDueDate,
        due_time: taskDueTime || undefined,
        status: 'Pendente',
        notes: taskNotes.trim() || undefined,
        opportunity_id: taskOppId || undefined,
        assigned_to: user?.id,
      })
      setIsModalOpen(false)
      loadData()
    } catch (err: unknown) {
      const errObj = err as { message?: string }
      setError(errObj.message || 'Erro ao criar tarefa.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === 'Concluída' ? 'Pendente' : 'Concluída'
    try {
      await taskService.updateTask(task.id, { status: nextStatus })
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white border border-[#E4E7EC] shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#101828]">Gestão de Tarefas</h2>
          <p className="text-xs text-[#667085]">
            Acompanhamento de ligações, follow-ups de cotações, reuniões e implantação
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-[#E4E7EC] p-0.5 bg-[#F5F7FA]">
            <Button
              variant={viewMode === 'LISTA' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('LISTA')}
              className="h-7 text-xs px-2.5"
            >
              <List className="h-3.5 w-3.5 mr-1" /> Lista
            </Button>
            <Button
              variant={viewMode === 'CALENDARIO' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('CALENDARIO')}
              className="h-7 text-xs px-2.5"
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Calendário
            </Button>
          </div>

          <Button
            size="sm"
            onClick={openCreateModal}
            className="bg-[#1B2A4A] text-white text-xs hover:bg-[#2A3D6B]"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E4E7EC] pb-2 text-xs">
        {[
          {
            key: 'HOJE',
            label: 'Hoje',
            count: tasks.filter((t) => t.due_date === todayStr).length,
          },
          {
            key: 'ATRASADAS',
            label: 'Atrasadas',
            count: tasks.filter((t) => t.status === 'Pendente' && t.due_date < todayStr).length,
          },
          {
            key: 'PROXIMAS',
            label: 'Próximas',
            count: tasks.filter((t) => t.due_date > todayStr).length,
          },
          {
            key: 'MINHAS',
            label: 'Minhas Tarefas',
            count: tasks.filter((t) => t.assigned_to === user?.id).length,
          },
          { key: 'TODAS', label: 'Todas', count: tasks.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key as any)}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterTab === tab.key
                ? 'bg-[#1B2A4A] text-white font-semibold'
                : 'bg-white text-[#667085] hover:bg-slate-100 border border-[#E4E7EC]'
            }`}
          >
            <span>{tab.label}</span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${
                filterTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#667085]'
              }`}
            >
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : viewMode === 'LISTA' ? (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#667085] bg-white rounded-xl border border-[#E4E7EC]">
              Nenhuma tarefa encontrada neste filtro.
            </div>
          ) : (
            filteredTasks.map((t) => {
              const isOverdue = t.status === 'Pendente' && t.due_date < todayStr
              const isDone = t.status === 'Concluída'

              return (
                <div
                  key={t.id}
                  className={`p-3.5 rounded-xl border bg-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition ${
                    isOverdue
                      ? 'border-red-200 bg-red-50/20'
                      : isDone
                        ? 'border-[#E4E7EC] opacity-60'
                        : 'border-[#E4E7EC]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(t)}
                      className={`h-5 w-5 rounded border mt-0.5 flex items-center justify-center shrink-0 transition ${
                        isDone
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-[#1B2A4A] bg-white'
                      }`}
                    >
                      {isDone && <CheckCircle2 className="h-4 w-4" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-bold text-sm ${
                            isDone ? 'line-through text-[#667085]' : 'text-[#101828]'
                          }`}
                        >
                          {t.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {t.type}
                        </Badge>
                        {isOverdue && (
                          <Badge className="bg-red-100 text-red-800 text-[9px] border-none">
                            ATRASADA
                          </Badge>
                        )}
                      </div>

                      {t.notes && (
                        <p className="text-[11px] text-[#667085] mt-1 leading-relaxed">{t.notes}</p>
                      )}

                      {t.expand?.opportunity_id && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-[#1B2A4A] font-medium">
                          <KanbanSquare className="h-3 w-3" />
                          <span>Oportunidade: {t.expand.opportunity_id.title}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-[#667085] block">Vencimento:</span>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          isOverdue ? 'text-red-700' : 'text-[#101828]'
                        }`}
                      >
                        {t.due_date} {t.due_time ? `às ${t.due_time}` : ''}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(t)}
                      className="text-[11px] h-7 border-[#E4E7EC]"
                    >
                      {isDone ? 'Reabrir' : 'Concluir'}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* Simple Calendar View: group by date */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Hoje', 'Amanhã', 'Próximos Dias'].map((block, idx) => {
            const blockTasks =
              idx === 0
                ? tasks.filter((t) => t.due_date === todayStr)
                : idx === 1
                  ? tasks.filter((t) => {
                      const tom = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)
                      return t.due_date === tom
                    })
                  : tasks.filter((t) => t.due_date > todayStr)

            return (
              <div
                key={block}
                className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC]">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#101828]">
                    {block}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {blockTasks.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {blockTasks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#667085]">
                      Nenhuma tarefa nesta data.
                    </div>
                  ) : (
                    blockTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-lg border border-[#E4E7EC] bg-[#F5F7FA] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#101828] truncate">{t.title}</span>
                          <span className="text-[10px] font-mono text-[#667085]">
                            {t.due_time || ''}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[9px]">
                          {t.type}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">Nova Tarefa</DialogTitle>
            <DialogDescription className="text-xs text-[#667085]">
              Agende uma ação comercial ou operacional
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-3 py-2 text-xs">
            {error && (
              <div className="p-2 rounded bg-red-50 text-red-900 border border-red-200 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Título da Tarefa *</Label>
              <Input
                placeholder="Ex: Follow-up de proposta enviada"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Ação</Label>
                <Select value={taskType} onValueChange={(val) => setTaskType(val as TaskType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'Ligação',
                      'WhatsApp',
                      'Follow-up',
                      'Reunião',
                      'Cotação',
                      'Documentação',
                      'Implantação',
                      'Cobrança/Pagamento',
                      'Outro',
                    ].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de Vencimento</Label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Horário</Label>
                <Input
                  type="time"
                  value={taskDueTime}
                  onChange={(e) => setTaskDueTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Oportunidade Vinculada</Label>
                <Select value={taskOppId} onValueChange={setTaskOppId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione ou deixe avulsa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (Avulsa)</SelectItem>
                    {opportunities.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                placeholder="Detalhes adicionais ou instruções..."
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
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
                {saving ? 'Salvando...' : 'Salvar Tarefa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
