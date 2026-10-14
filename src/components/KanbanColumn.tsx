import React from 'react'
import { Plus, ExternalLink, ArrowRightCircle, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { OpportunityCardViewProps, PipelineStageItem, OpportunityCardView } from './OpportunityCard'
import type { Opportunity } from '@/types/crm'

export interface KanbanColumnProps extends Omit<
  OpportunityCardViewProps,
  'opp' | 'isOverlay' | 'isDragging'
> {
  stageItem: PipelineStageItem
  stageIndex: number
  opportunities: Opportunity[]
  useDroppableHook: (options: { id: string; data?: Record<string, unknown> }) => {
    isOver: boolean
    setNodeRef: (element: HTMLElement | null) => void
  }
  useDraggableHook: (options: { id: string; data?: Record<string, unknown> }) => {
    attributes: unknown
    listeners: unknown
    setNodeRef: (element: HTMLElement | null) => void
    transform: unknown
    isDragging: boolean
  }
  onAddOpportunity?: (stageName: string) => void
}

const STAGE_COLORS = [
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#059669',
  '#D97706',
  '#EF4444',
]

function DraggableCardItem({
  opp,
  useDraggableHook,
  cardProps,
}: {
  opp: Opportunity
  useDraggableHook: KanbanColumnProps['useDraggableHook']
  cardProps: Omit<OpportunityCardViewProps, 'opp' | 'isOverlay' | 'isDragging'>
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggableHook({
    id: opp.id,
    data: {
      type: 'opportunity',
      opportunity: opp,
    },
  })

  const { stages, pipelineType, isAdmin, onOpenDetail, onMoveToStage, onOpenConfirmPayment } =
    cardProps

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
          className="touch-none select-none"
        >
          <OpportunityCardView {...cardProps} opp={opp} isDragging={isDragging} />
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

export const KanbanColumn = React.memo(function KanbanColumn({
  stageItem,
  stageIndex,
  opportunities,
  useDroppableHook,
  useDraggableHook,
  onAddOpportunity,
  ...cardProps
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppableHook({
    id: stageItem.id || stageItem.nome,
    data: {
      type: 'stage',
      stage: stageItem,
    },
  })

  const stageName = stageItem.nome
  const accentColor = STAGE_COLORS[stageIndex % STAGE_COLORS.length]
  const stageSaleTotal = opportunities.reduce((sum, o) => sum + (o.sale_value || 0), 0)

  return (
    <div
      ref={setNodeRef}
      className={`w-80 shrink-0 flex flex-col rounded-xl border transition-all duration-150 bg-muted/30 overflow-hidden ${
        isOver
          ? 'ring-2 ring-primary border-primary bg-primary/10 scale-[1.01] shadow-lg'
          : 'border-border'
      }`}
    >
      {/* Cabeçalho da Coluna */}
      <div className="p-3.5 bg-card border-b border-border relative">
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: accentColor }}
        />
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-foreground truncate">{stageName}</span>
          <Badge variant="secondary" className="text-[10px] font-bold">
            {opportunities.length}
          </Badge>
        </div>
        <div className="text-[11px] font-semibold text-muted-foreground mt-1 flex items-center justify-between">
          <span>
            {stageSaleTotal > 0 ? `R$ ${stageSaleTotal.toLocaleString('pt-BR')}` : 'R$ 0'}
          </span>
          <span className="text-[10px] text-muted-foreground">mensal</span>
        </div>
      </div>

      {/* Corpo da Coluna / Lista de Cards */}
      <div className="p-2.5 flex-1 space-y-2.5 min-h-[380px]">
        {opportunities.map((opp) => (
          <DraggableCardItem
            key={opp.id}
            opp={opp}
            useDraggableHook={useDraggableHook}
            cardProps={cardProps}
          />
        ))}

        {opportunities.length === 0 && (
          <div
            className={`h-28 border-2 border-dashed rounded-lg flex items-center justify-center text-[11px] transition-colors ${
              isOver
                ? 'border-primary text-primary font-semibold bg-primary/5'
                : 'border-border text-muted-foreground'
            }`}
          >
            {isOver ? 'Solte aqui para mover' : 'Arraste cards para cá'}
          </div>
        )}
      </div>

      {/* Rodapé da Coluna */}
      <div className="p-2 border-t border-border bg-card">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddOpportunity?.(stageName)}
          className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Oportunidade
        </Button>
      </div>
    </div>
  )
})
