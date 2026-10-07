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
      <div className="p-6 rounded-xl bg-white border border-[#E4E7EC] shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#101828]">Conversas & Integração WhatsApp</h2>
              <Badge
                variant="outline"
                className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                Área Estrutural Preparada
              </Badge>
            </div>
            <p className="text-xs text-[#667085]">
              Canal oficial de atendimento, triagem e comunicação de cotações com segurados e
              empresas
            </p>
          </div>
        </div>
      </div>

      {/* Clear structural message: Real integration will be connected, no fake mocks */}
      <Card className="border-blue-100 bg-blue-50/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-800 shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-2 text-xs leading-relaxed text-[#101828]">
              <h3 className="font-bold text-sm text-[#1B2A4A]">
                Conexão da API Oficial em Preparação
              </h3>
              <p className="text-[#667085]">
                Esta área está estruturada para receber a API oficial do WhatsApp Business da KK
                JEKABSON Corretora de Seguros (KKJ). Nenhuma mensagem simulada ou mock falso é
                gerado na interface.
              </p>
              <p className="text-[#667085]">
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
        <Card className="border-[#E4E7EC]">
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 w-fit mb-2">
              <Smartphone className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold text-[#101828]">Chat em Tempo Real</CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Troca de mensagens de texto, áudios e envio de tabelas de cotação em PDF
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-[#E4E7EC]">
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 w-fit mb-2">
              <Bot className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold text-[#101828]">
              Qualificação Automática
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Coleta preliminar de vidas, CNPJ e operadora desejada antes de repassar ao corretor
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-[#E4E7EC]">
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 w-fit mb-2">
              <Shield className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold text-[#101828]">
              Vínculo com Oportunidades
            </CardTitle>
            <CardDescription className="text-xs text-[#667085]">
              Histórico das conversas arquivado diretamente na timeline de cada oportunidade
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Status banner */}
      <div className="p-4 rounded-xl border border-dashed border-[#E4E7EC] bg-white text-center text-xs text-[#667085] flex flex-col items-center gap-2">
        <Lock className="h-6 w-6 text-slate-400" />
        <span className="font-semibold text-[#101828]">
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
