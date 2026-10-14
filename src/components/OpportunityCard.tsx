import React from 'react'
import {
  Flame,
  Building2,
  Clock,
  ShieldCheck,
  MoreVertical,
  ArrowRightCircle,
  ExternalLink,
  GripVertical,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type {
  Opportunity,
  Company,
  Product,
  Carrier,
  CrmTag,
  Task,
  User as UserType,
  PipelineType,
} from '@/types/crm'

export interface PipelineStageItem {
  id: string
  nome: string
  ordem: number
  funnel_type: string
  is_fechamento?: boolean
  e_saida?: boolean
  ativo?: boolean
}

export interface OpportunityCardViewProps {
  opp: Opportunity
  companies: Company[]
  products: Product[]
  carriers: Carrier[]
  users: UserType[]
  tasks: Task[]
  crmTags: CrmTag[]
  stages: PipelineStageItem[]
  pipelineType: PipelineType
  isAdmin: boolean
  isOverlay?: boolean
  isDragging?: boolean
  onOpenDetail?: (opp: Opportunity) => void
  onMoveToStage?: (opp: Opportunity, targetStageName: string) => void
  onOpenConfirmPayment?: (opp: Opportunity) => void
}

export const OpportunityCardView = React.memo(function OpportunityCardView({
  opp,
  companies,
  products,
  users,
  tasks,
  crmTags,
  stages,
  pipelineType,
  isAdmin,
  isOverlay = false,
  isDragging = false,
  onOpenDetail,
  onMoveToStage,
  onOpenConfirmPayment,
}: OpportunityCardViewProps) {
  const company = opp.expand?.company_id || companies.find((c) => c.id === opp.company_id)
  const product = opp.expand?.product_id || products.find((p) => p.id === opp.product_id)
  const assigned = opp.expand?.assigned_to || users.find((u) => u.id === opp.assigned_to)

  const oppTask = tasks.find((t) => t.opportunity_id === opp.id && t.status === 'Pendente')
  const todayStr = new Date().toISOString().slice(0, 10)
  const isTaskOverdue = oppTask ? oppTask.due_date < todayStr : false

  const stageOptions = stages.filter((st) => st.nome.toLowerCase() !== opp.stage.toLowerCase())
  const hasLostOption =
    pipelineType === 'VENDAS' &&
    opp.stage.toLowerCase() !== 'venda perdida' &&
    opp.stage.toLowerCase() !== 'perdido'

  return (
    <div
      className={`p-3 rounded-lg border border-border bg-card shadow-sm space-y-2 text-xs relative group text-card-foreground select-none transition-shadow ${
        isOverlay
          ? 'shadow-2xl ring-2 ring-primary scale-[1.02] rotate-1 cursor-grabbing opacity-95 bg-card/95 backdrop-blur-sm'
          : isDragging
            ? 'opacity-40 ring-1 ring-primary/60 border-dashed cursor-grabbing'
            : 'hover:shadow-md cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Título, Temperatura & Menu de Ações */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span
              className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Arraste para mover de etapa"
            >
              <GripVertical className="h-3 w-3 shrink-0" />
            </span>
            <h4
              className="font-bold text-foreground text-xs truncate hover:text-primary transition-colors cursor-pointer"
              onClick={(e) => {
                if (isOverlay) return
                e.stopPropagation()
                onOpenDetail?.(opp)
              }}
              title={opp.title}
            >
              {opp.title}
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span>{company?.trade_name || 'Sem empresa'}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {opp.temperature === 'Quente' && (
            <span
              title="Temperatura Quente"
              className="p-1 rounded bg-red-500/10 text-red-500 shrink-0 border border-red-500/20"
            >
              <Flame className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            </span>
          )}
          {opp.temperature === 'Morno' && (
            <span
              title="Temperatura Morna"
              className="p-1 rounded bg-amber-500/10 text-amber-500 shrink-0 text-[10px] font-semibold border border-amber-500/20"
            >
              Morno
            </span>
          )}
          {opp.temperature === 'Frio' && (
            <span
              title="Temperatura Fria"
              className="p-1 rounded bg-blue-500/10 text-blue-500 shrink-0 text-[10px] font-semibold border border-blue-500/20"
            >
              Frio
            </span>
          )}

          {/* Menu de Ações Rápido do Card (Dropdown) */}
          {!isOverlay && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded"
                  title="Opções da oportunidade"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Opções</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-xs bg-popover border-border">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground truncate">
                  {opp.title}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onOpenDetail?.(opp)}
                  className="cursor-pointer flex items-center gap-2"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  <span>Abrir detalhes</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Submenu: Mover para etapa... */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2">
                    <ArrowRightCircle className="h-3.5 w-3.5 text-primary" />
                    <span>Mover para etapa…</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52 text-xs bg-popover border-border">
                    <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                      Etapa atual: {opp.stage}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {stageOptions.map((st) => (
                      <DropdownMenuItem
                        key={st.id}
                        onClick={() => onMoveToStage?.(opp, st.nome)}
                        className="cursor-pointer"
                      >
                        {st.nome}
                      </DropdownMenuItem>
                    ))}
                    {hasLostOption && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onMoveToStage?.(opp, 'Venda perdida')}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          ✕ Venda perdida
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {pipelineType === 'POS_VENDA' && isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onOpenConfirmPayment?.(opp)}
                      className="cursor-pointer text-emerald-600 focus:text-emerald-600 flex items-center gap-2 font-semibold"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Confirmar 1º Pagamento</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Produto & Vidas */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
        <Badge variant="outline" className="text-[10px] font-normal py-0 border-border">
          {product?.name || 'Seguro / Plano'}
        </Badge>
        {opp.health_data?.lives_count && (
          <Badge
            variant="secondary"
            className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 py-0 border border-emerald-500/20"
          >
            {opp.health_data.lives_count} vidas
          </Badge>
        )}
      </div>

      {/* Tags */}
      {Array.isArray(opp.tags) && opp.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {opp.tags.map((tName) => {
            const tagObj = crmTags.find((t) => t.name.toLowerCase() === tName.toLowerCase())
            return (
              <span
                key={tName}
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                style={{
                  backgroundColor: tagObj?.bg_color || '#F1F5F9',
                  color: tagObj?.text_color || '#334155',
                  borderColor: tagObj?.color || '#CBD5E1',
                }}
              >
                {tName}
              </span>
            )
          })}
        </div>
      )}

      {/* Mensalidade Comercial */}
      <div className="pt-1 border-t border-border flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-muted-foreground block">Mensalidade Cotação:</span>
          <span className="font-extrabold text-foreground">
            R$ {(opp.sale_value || opp.value || 0).toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground/70 block">Cotação Principal</span>
          <span className="text-[11px] font-medium text-foreground/80">
            {opp.expand?.carrier_id?.nome || 'Operadora'}
          </span>
        </div>
      </div>

      {/* Próxima Tarefa */}
      {oppTask && (
        <div
          className={`p-1.5 rounded flex items-center justify-between text-[10px] ${
            isTaskOverdue
              ? 'bg-red-500/10 text-red-500 border border-red-500/25 font-semibold'
              : 'bg-muted text-muted-foreground'
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

      {/* Ações Especiais no Pós-Venda: Botão de Confirmar 1º Pagamento exclusivo do Administrador */}
      {pipelineType === 'POS_VENDA' && isAdmin && !isOverlay && (
        <div
          className="pt-1 border-t border-border"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenConfirmPayment?.(opp)}
            className="w-full h-6 text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 flex items-center justify-center gap-1 font-semibold"
          >
            <ShieldCheck className="h-3 w-3" />
            Confirmar 1º Pagamento (Admin)
          </Button>
        </div>
      )}

      {/* Rodapé: Responsável & Seletor Rápido de Etapa */}
      <div
        className="pt-1.5 border-t border-border flex items-center justify-between text-[10px]"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-muted-foreground truncate max-w-[110px]">
          {assigned?.name || 'Corretor'}
        </span>

        <select
          value={opp.stage}
          onChange={(e) => onMoveToStage?.(opp, e.target.value)}
          className="bg-transparent text-foreground font-semibold text-[10px] focus:outline-none cursor-pointer max-w-[130px] truncate"
        >
          {stages.map((st) => (
            <option key={st.id} value={st.nome} className="bg-popover text-popover-foreground">
              {st.nome}
            </option>
          ))}
          {pipelineType === 'VENDAS' &&
            !stages.some((s) => s.nome.toLowerCase() === 'venda perdida') && (
              <option value="Venda perdida" className="bg-popover text-destructive">
                ✕ Venda perdida
              </option>
            )}
        </select>
      </div>
    </div>
  )
})

export interface DraggableOpportunityCardProps extends OpportunityCardViewProps {
  useDraggableHook: (options: { id: string; data?: Record<string, unknown> }) => {
    attributes: unknown
    listeners: unknown
    setNodeRef: (element: HTMLElement | null) => void
    transform: unknown
    isDragging: boolean
  }
}

export function DraggableOpportunityCard({
  useDraggableHook,
  ...props
}: DraggableOpportunityCardProps) {
  const { opp, stages, pipelineType, isAdmin, onOpenDetail, onMoveToStage, onOpenConfirmPayment } =
    props

  const { attributes, listeners, setNodeRef, isDragging } = useDraggableHook({
    id: opp.id,
    data: {
      type: 'opportunity',
      opportunity: opp,
    },
  })

  const stageOptions = stages.filter((st) => st.nome.toLowerCase() !== opp.stage.toLowerCase())
  const hasLostOption =
    pipelineType === 'VENDAS' &&
    opp.stage.toLowerCase() !== 'venda perdida' &&
    opp.stage.toLowerCase() !== 'perdido'

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          {...(attributes as Record<string, unknown>)}
          {...(listeners as Record<string, unknown>)}
          onClick={() => {
            // Se o usuário clicou sem arrastar, abre detalhes
            if (!isDragging) {
              onOpenDetail?.(opp)
            }
          }}
          className="touch-none select-none"
        >
          <OpportunityCardView {...props} isDragging={isDragging} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 text-xs bg-popover border-border">
        <ContextMenuLabel className="text-[11px] text-muted-foreground truncate">
          {opp.title}
        </ContextMenuLabel>
        <ContextMenuItem
          onClick={() => onOpenDetail?.(opp)}
          className="cursor-pointer flex items-center gap-2"
        >
          <ExternalLink className="h-3.5 w-3.5 text-primary" />
          <span>Abrir detalhes</span>
        </ContextMenuItem>
        <ContextMenuSeparator />

        {/* Submenu de Contexto: Mover para etapa... */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer flex items-center gap-2">
            <ArrowRightCircle className="h-3.5 w-3.5 text-primary" />
            <span>Mover para etapa…</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52 text-xs bg-popover border-border">
            <ContextMenuLabel className="text-[10px] text-muted-foreground">
              Etapa atual: {opp.stage}
            </ContextMenuLabel>
            <ContextMenuSeparator />
            {stageOptions.map((st) => (
              <ContextMenuItem
                key={st.id}
                onClick={() => onMoveToStage?.(opp, st.nome)}
                className="cursor-pointer"
              >
                {st.nome}
              </ContextMenuItem>
            ))}
            {hasLostOption && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => onMoveToStage?.(opp, 'Venda perdida')}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  ✕ Venda perdida
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {pipelineType === 'POS_VENDA' && isAdmin && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onOpenConfirmPayment?.(opp)}
              className="cursor-pointer text-emerald-600 focus:text-emerald-600 flex items-center gap-2 font-semibold"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Confirmar 1º Pagamento (Admin)</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
