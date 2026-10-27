/**
 * Serviço Oficial Meta WhatsApp Business Embedded Signup com Coexistência
 * CRM KKJ Corretora de Seguros e Benefícios
 *
 * Configuração fornecida pela KKJ:
 * - Config ID: 1818783062788114
 * - Permissões: whatsapp_business_management, whatsapp_business_messaging
 * - Modo: Coexistência ativa (número continua no app móvel e WhatsApp Web)
 * - Proibido: fluxo tradicional de migração ou desconexão
 */

import pb from '@/lib/pocketbase/client'
import { supabase } from '@/lib/supabase/client'

export const META_WHATSAPP_CONFIG = {
  CONFIG_ID: '1818783062788114',
  SDK_URL: 'https://connect.facebook.net/en_US/sdk.js',
  GRAPH_VERSION: 'v21.0',
  PERMISSIONS: ['whatsapp_business_management', 'whatsapp_business_messaging'],
  FEATURE_TYPE: 'whatsapp_business_app_onboarding',
}

declare global {
  interface Window {
    FB?: any
    fbAsyncInit?: () => void
  }
}

export interface MetaSignupSessionData {
  phone_number_id?: string
  waba_id?: string
  business_id?: string
  ad_account_ids?: string[]
  page_ids?: string[]
  dataset_ids?: string[]
  catalog_ids?: string[]
  instagram_account_ids?: string[]
  waba_ids?: string[]
  current_step?: string
  error_message?: string
  error_code?: string | number
  session_id?: string
}

export interface MetaSignupEvent {
  type: 'WA_EMBEDDED_SIGNUP'
  event:
    | 'FINISH'
    | 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
    | 'FINISH_ONLY_WABA'
    | 'CANCEL'
    | 'ERROR'
    | string
  data?: MetaSignupSessionData
}

export interface MetaExchangeResponse {
  success: boolean
  message: string
  code?: string
  data?: {
    channel_id: string
    channel_name: string
    numero_telefone: string
    waba_id: string
    phone_number_id: string
    business_id: string
    coexistence_status: string
    verified_name?: string
    user_id?: string
    warning?: string | null
  }
  meta_error?: any
}

export interface MetaBackendStatus {
  ready: boolean
  meta: {
    has_app_id: boolean
    has_app_secret: boolean
    config_id: string
    coexistence_mode: string
    permissions: string[]
  }
  supabase: {
    has_url: boolean
    has_service_role_key: boolean
  }
}

let sdkLoadingPromise: Promise<boolean> | null = null

export const metaWhatsAppService = {
  /**
   * Consulta a rota de status do backend para verificar se META_APP_ID e META_APP_SECRET estão configurados
   */
  async getBackendStatus(): Promise<MetaBackendStatus> {
    try {
      const res = await pb.send<MetaBackendStatus>('/backend/v1/meta-whatsapp/status', {
        method: 'GET',
        requestKey: null,
      })
      return res
    } catch {
      return {
        ready: false,
        meta: {
          has_app_id: false,
          has_app_secret: false,
          config_id: META_WHATSAPP_CONFIG.CONFIG_ID,
          coexistence_mode: 'enabled',
          permissions: META_WHATSAPP_CONFIG.PERMISSIONS,
        },
        supabase: {
          has_url: false,
          has_service_role_key: false,
        },
      }
    }
  },

  /**
   * Obtém a configuração pública do backend (appId e configId)
   */
  async getPublicConfig(): Promise<{ metaAppId: string; metaConfigId: string }> {
    try {
      const res = await pb.send<{ metaAppId?: string; metaConfigId?: string }>(
        '/backend/v1/public-config',
        {
          method: 'GET',
          requestKey: null,
        },
      )
      return {
        metaAppId: (res?.metaAppId || '').trim(),
        metaConfigId: (res?.metaConfigId || '').trim() || META_WHATSAPP_CONFIG.CONFIG_ID,
      }
    } catch {
      return {
        metaAppId: '',
        metaConfigId: META_WHATSAPP_CONFIG.CONFIG_ID,
      }
    }
  },

  /**
   * Carrega e inicializa o SDK oficial da Meta (https://connect.facebook.net/en_US/sdk.js)
   */
  async loadSdk(): Promise<boolean> {
    if (typeof window === 'undefined') return false

    if (window.FB && typeof window.FB.login === 'function') {
      return true
    }

    if (sdkLoadingPromise) {
      return sdkLoadingPromise
    }

    sdkLoadingPromise = (async () => {
      const { metaAppId } = await this.getPublicConfig()

      return new Promise<boolean>((resolve) => {
        // Callback padrão de inicialização assíncrona do Facebook SDK
        window.fbAsyncInit = function () {
          try {
            window.FB.init({
              appId: metaAppId || undefined,
              autoLogAppEvents: true,
              xfbml: true,
              version: META_WHATSAPP_CONFIG.GRAPH_VERSION,
            })
            resolve(true)
          } catch (initErr) {
            console.warn('Erro ao inicializar Meta FB.init:', initErr)
            resolve(true) // FB objeto ainda pode existir
          }
        }

        // Verifica se a tag script já foi injetada no DOM
        const existingScript = document.getElementById('facebook-jssdk')
        if (existingScript) {
          if (window.FB) {
            resolve(true)
          }
          return
        }

        const script = document.createElement('script')
        script.id = 'facebook-jssdk'
        script.src = META_WHATSAPP_CONFIG.SDK_URL
        script.async = true
        script.defer = true
        script.crossOrigin = 'anonymous'

        script.onerror = () => {
          console.warn('Falha ao carregar script do SDK da Meta.')
          resolve(false)
        }

        document.body.appendChild(script)

        // Timeout preventivo de segurança (8 segundos)
        setTimeout(() => {
          if (window.FB) resolve(true)
        }, 8000)
      })
    })()

    return sdkLoadingPromise
  },

  /**
   * Inicia o fluxo oficial de login Embedded Signup com COEXISTÊNCIA
   *
   * Configuração exigida pela Meta para coexistência:
   * - config_id: 1818783062788114
   * - response_type: 'code'
   * - override_default_response_type: true
   * - extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' }
   * - Escuta window.addEventListener('message') para capturar eventos de origem facebook.com
   */
  async launchEmbeddedSignup(options?: {
    channelName?: string
    onProgress?: (step: string) => void
  }): Promise<MetaExchangeResponse> {
    const isSdkLoaded = await this.loadSdk()
    if (!isSdkLoaded || !window.FB || typeof window.FB.login !== 'function') {
      throw new Error(
        'SDK da Meta não pôde ser carregado no navegador. Verifique sua conexão com a internet ou bloqueadores de rastreador.',
      )
    }

    // 1. Obter token JWT do usuário no Supabase para autenticação no backend
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error(
        'Sessão do usuário expirada no CRM KKJ. Faça login novamente antes de conectar o WhatsApp.',
      )
    }

    const userToken = session.access_token
    const { metaConfigId } = await this.getPublicConfig()
    const activeConfigId = metaConfigId || META_WHATSAPP_CONFIG.CONFIG_ID

    return new Promise<MetaExchangeResponse>((resolve, reject) => {
      let sessionData: MetaSignupSessionData = {}
      let authCode: string | null = null
      let isSettled = false

      // Timeout preventivo de 10 minutos para desistência/fechamento do popup
      const cleanupTimer = setTimeout(
        () => {
          if (!isSettled) {
            cleanUp()
            reject(new Error('Tempo limite excedido na janela da Meta. Tente novamente.'))
          }
        },
        10 * 60 * 1000,
      )

      // Listener de mensagens postMessage originadas do fluxo oficial da Meta
      const messageHandler = (event: MessageEvent) => {
        // Aceita apenas origens oficiais da Meta
        const origin = event.origin || ''
        const isOfficialOrigin =
          origin.endsWith('facebook.com') ||
          origin === 'https://www.facebook.com' ||
          origin === 'https://web.facebook.com'

        if (!isOfficialOrigin) return

        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
          if (raw && raw.type === 'WA_EMBEDDED_SIGNUP') {
            const signupEvent = raw as MetaSignupEvent

            // Captura metadados da sessão retornados
            if (signupEvent.data) {
              sessionData = {
                ...sessionData,
                ...signupEvent.data,
              }
            }

            options?.onProgress?.(`Evento Meta: ${signupEvent.event}`)

            // Se o usuário cancelou explicitamente o fluxo
            if (signupEvent.event === 'CANCEL') {
              isSettled = true
              cleanUp()
              reject(
                new Error(
                  'Conexão cancelada pelo usuário na tela da Meta' +
                    (sessionData.current_step ? ` (${sessionData.current_step})` : '') +
                    '. Nenhum número foi desconectado.',
                ),
              )
              return
            }

            // Se a Meta retornou erro explícito durante o onboarding
            if (signupEvent.event === 'ERROR') {
              isSettled = true
              cleanUp()
              reject(
                new Error(
                  sessionData.error_message ||
                    'A Meta reportou um erro durante a validação da conta. O número móvel foi preservado.',
                ),
              )
              return
            }

            // Se já tínhamos o código de autenticação da callback e agora recebemos o evento de finalização
            if (
              authCode &&
              (signupEvent.event === 'FINISH' ||
                signupEvent.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ||
                signupEvent.event === 'FINISH_ONLY_WABA')
            ) {
              executeBackendExchange(authCode, sessionData)
            }
          }
        } catch {
          // Mensagem não-JSON ignorada
        }
      }

      window.addEventListener('message', messageHandler)

      const cleanUp = () => {
        clearTimeout(cleanupTimer)
        window.removeEventListener('message', messageHandler)
      }

      // Função de disparo da troca segura de código pelo backend
      const executeBackendExchange = async (
        code: string,
        finalSessionData: MetaSignupSessionData,
      ) => {
        if (isSettled) return
        isSettled = true
        cleanUp()

        options?.onProgress?.('Validando coexistência e credenciais junto ao servidor...')

        try {
          const exchangeRes = await pb.send<MetaExchangeResponse>(
            '/backend/v1/meta-whatsapp/exchange',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${userToken}`,
                'Content-Type': 'application/json',
              },
              body: {
                code,
                waba_id: finalSessionData.waba_id || '',
                phone_number_id: finalSessionData.phone_number_id || '',
                business_id: finalSessionData.business_id || '',
                channel_name: options?.channelName || '',
              },
              requestKey: null,
            },
          )

          if (!exchangeRes.success) {
            reject(
              new Error(
                exchangeRes.message || 'Falha ao processar a troca de credenciais com a Meta.',
              ),
            )
            return
          }

          resolve(exchangeRes)
        } catch (err: any) {
          // Trata erros de status HTTP retornados pelo pb_hooks
          const msg =
            err?.data?.message ||
            err?.message ||
            'Não foi possível concluir a troca de código no backend.'
          reject(new Error(msg))
        }
      }

      // Callback acionada pelo FB.login quando o popup fecha / retorna autorização
      const fbLoginCallback = (response: any) => {
        if (response.authResponse && response.authResponse.code) {
          authCode = response.authResponse.code
          options?.onProgress?.('Código de autorização obtido. Finalizando validação...')

          // Se a sessão já capturou os dados via postMessage, executa imediatamente a troca
          // O token da Meta expira em 30 segundos, disparar sem demora
          setTimeout(() => {
            if (!isSettled && authCode) {
              executeBackendExchange(authCode, sessionData)
            }
          }, 350)
        } else {
          // O usuário fechou a janela sem autorizar
          if (!isSettled) {
            isSettled = true
            cleanUp()
            reject(
              new Error(
                'A autorização da Meta foi encerrada sem concessão de código. Nenhum número foi alterado.',
              ),
            )
          }
        }
      }

      options?.onProgress?.('Abrindo tela oficial da Meta para login...')

      try {
        window.FB.login(fbLoginCallback, {
          config_id: activeConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: META_WHATSAPP_CONFIG.FEATURE_TYPE,
            sessionInfoVersion: '3',
          },
        })
      } catch (loginErr: any) {
        cleanUp()
        reject(
          new Error(
            loginErr?.message ||
              'Falha ao acionar FB.login da Meta. Verifique se o bloqueador de popups do navegador está desativado.',
          ),
        )
      }
    })
  },
}
