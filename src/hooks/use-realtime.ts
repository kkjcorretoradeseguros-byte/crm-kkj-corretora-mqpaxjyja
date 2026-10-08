import { useEffect, useRef } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

/**
 * Assinatura compatível para eventos de realtime no CRM KKJ.
 * Adapta o payload do Supabase Realtime (INSERT, UPDATE, DELETE)
 * mantendo interoperabilidade e conveniência para componentes React.
 */
export interface RealtimeSubscriptionEvent<
  TRecord extends Record<string, unknown> = Record<string, unknown>,
> {
  action: 'create' | 'update' | 'delete'
  record: TRecord
  rawPayload: RealtimePostgresChangesPayload<TRecord>
}

/**
 * Hook para subscrições em tempo real nativas do Supabase Realtime (Postgres Changes).
 * Substitui o antigo cliente PocketBase, isolando a conexão no Supabase oficial da KKJ.
 *
 * @param tableName Nome da tabela no esquema public (ex: 'tasks', 'opportunities', 'conversations')
 * @param callback Callback invocado a cada mutação (INSERT, UPDATE, DELETE)
 * @param enabled Flag booleano para habilitar/desabilitar a subscrição condicionalmente
 */
export function useRealtime<TRecord extends Record<string, unknown> = Record<string, unknown>>(
  tableName: string,
  callback: (data: RealtimeSubscriptionEvent<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return

    const channelName = `realtime:${tableName}:${Math.random().toString(36).slice(2, 9)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        (payload: RealtimePostgresChangesPayload<TRecord>) => {
          let action: 'create' | 'update' | 'delete' = 'update'
          if (payload.eventType === 'INSERT') action = 'create'
          else if (payload.eventType === 'DELETE') action = 'delete'
          else if (payload.eventType === 'UPDATE') action = 'update'

          const record = ((payload.new && Object.keys(payload.new).length > 0
            ? payload.new
            : payload.old) || {}) as TRecord

          callbackRef.current({
            action,
            record,
            rawPayload: payload,
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [tableName, enabled])
}

export default useRealtime
