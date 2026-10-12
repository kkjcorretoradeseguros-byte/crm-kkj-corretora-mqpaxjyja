import React from 'react'
import {
  MessageSquare,
  Smartphone,
  Shield,
  Bot,
  Info,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  PhoneCall,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function Conversations() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header Card */}
      <div className="p-6 rounded-xl bg-card text-card-foreground border border-border shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Conversas & Integração WhatsApp</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Canal oficial de atendimento, triagem e comunicação de cotações com segurados e
              empresas
            </p>
          </div>
        </div>
      </div>

      {/* Clear structural message: Real integration will be connected, no fake mocks */}
      <Card className="border-border bg-card text-card-foreground">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-500/20">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-foreground">
              <h3 className="font-bold text-sm text-foreground">
                Conexão da API Oficial em Preparação
              </h3>
              <p className="text-muted-foreground">
                Esta área está estruturada para receber a API oficial do WhatsApp Business da KK
                JEKABSON Corretora de Seguros (KKJ). Nenhuma mensagem simulada ou mock falso é
                gerado na interface.
              </p>
              <p className="text-muted-foreground">
                Assim que as credenciais do provedor WhatsApp oficial (Meta Cloud API / Z-API /
                Evolution API) forem adicionadas ao backend, os chats reais, históricos e triagens
                automáticas estarão disponíveis diretamente vinculados aos Contatos e Oportunidades
                do CRM.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Architecture Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 w-fit mb-2">
              <Smartphone className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground">Chat em Tempo Real</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Troca de mensagens de texto, áudios e envio de tabelas de cotação em PDF
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 w-fit mb-2">
              <Bot className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground">
              Qualificação Automática
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Coleta preliminar de vidas, CNPJ e operadora desejada antes de repassar ao corretor
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 w-fit mb-2">
              <Shield className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold text-foreground">
              Vínculo com Oportunidades
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Histórico das conversas arquivado diretamente na timeline de cada oportunidade
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Status banner */}
      <div className="p-4 rounded-xl border border-dashed border-border bg-card text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
        <Lock className="h-6 w-6 text-muted-foreground/50" />
        <span className="font-semibold text-foreground">
          Módulo de Mensageria aguardando credenciais da API de WhatsApp
        </span>
        <span className="max-w-md">
          Para ativar o canal de WhatsApp da KKJ Corretora, solicite ao administrador a configuração
          do token de mensageria nas Configurações.
        </span>
      </div>
    </div>
  )
}
