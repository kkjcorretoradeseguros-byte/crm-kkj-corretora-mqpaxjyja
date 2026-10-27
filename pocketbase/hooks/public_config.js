// ==============================================================================
// POCKETBASE PB_HOOKS: CONFIGURAÇÃO PÚBLICA & INTEGRAÇÃO META WHATSAPP
// CRM KKJ CORRETORA DE SEGUROS E BENEFÍCIOS
// ==============================================================================

/**
 * 1. Rota de configuração pública do Supabase e Meta Client ID (GET /backend/v1/public-config)
 * Retorna URLs e IDs públicos necessários para inicialização do client e SDK da Meta no frontend.
 * Nenhuma chave secreta é retornada.
 */
routerAdd('GET', '/backend/v1/public-config', (e) => {
  const supabaseUrl = $os.getenv('VITE_SUPABASE_URL') || ''
  const supabaseAnonKey = $os.getenv('VITE_SUPABASE_ANON_KEY') || ''
  const metaAppId = $os.getenv('META_APP_ID') || ''
  const metaConfigId = $os.getenv('META_CONFIG_ID') || '1818783062788114'

  return e.json(200, {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
    metaAppId: metaAppId.trim(),
    metaConfigId: metaConfigId.trim() || '1818783062788114',
  })
})

/**
 * 2. Rota de Troca de Código da Meta WhatsApp Business Embedded Signup
 * POST /backend/v1/meta-whatsapp/exchange
 *
 * Recebe do frontend:
 * - code: código de autorização temporário (TTL 30s)
 * - waba_id: WhatsApp Business Account ID (Messaging Account)
 * - phone_number_id: ID do número de telefone retornado pela Meta
 * - business_id: ID do portfólio de negócios
 * - channel_name: nome opcional informado pelo corretor para o canal
 *
 * Headers obrigatórios:
 * - Authorization: Bearer <supabase_access_token>
 */
routerAdd('POST', '/backend/v1/meta-whatsapp/exchange', (e) => {
  const supabaseUrl = ($os.getenv('VITE_SUPABASE_URL') || '').trim()
  const supabaseAnonKey = ($os.getenv('VITE_SUPABASE_ANON_KEY') || '').trim()
  const supabaseServiceKey = ($os.getenv('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const metaAppId = ($os.getenv('META_APP_ID') || '').trim()
  const metaAppSecret = ($os.getenv('META_APP_SECRET') || '').trim()

  // 1. Validar autenticação do usuário via Supabase JWT (inline dentro do handler para escopo do PocketBase JSVM)
  const authHeader = e.request.header.get('Authorization') || ''
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return e.json(401, {
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Token de autorização não fornecido ou em formato inválido.',
    })
  }

  const userToken = authHeader.substring(7).trim()
  if (!userToken) {
    return e.json(401, {
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Token de autorização vazio.',
    })
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return e.json(500, {
      success: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Supabase URL ou chave pública não configurados no servidor.',
    })
  }

  let authenticatedUserId = null
  try {
    const userRes = $http.send({
      url: supabaseUrl.replace(/\/+$/, '') + '/auth/v1/user',
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: 'Bearer ' + userToken,
      },
      timeout: 15,
    })

    if (userRes.statusCode !== 200) {
      return e.json(401, {
        success: false,
        code: 'INVALID_SESSION',
        message:
          'Sessão do Supabase inválida ou expirada (HTTP ' +
          userRes.statusCode +
          '). Faça login novamente.',
      })
    }

    const userData = userRes.json || {}
    if (!userData.id) {
      return e.json(401, {
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Identificador do usuário não encontrado no Supabase.',
      })
    }

    authenticatedUserId = userData.id
  } catch (err) {
    return e.json(502, {
      success: false,
      code: 'SUPABASE_AUTH_ERROR',
      message:
        'Falha ao validar sessão junto ao Supabase: ' +
        (err && err.message ? err.message : String(err)),
    })
  }

  // 2. Extrair dados da requisição
  let body = {}
  try {
    const rawInfo = e.requestInfo()
    body = (rawInfo && rawInfo.body) || {}
  } catch (_) {
    body = {}
  }

  const code = (body.code || '').trim()
  const wabaId = (body.waba_id || '').trim()
  const phoneNumberId = (body.phone_number_id || '').trim()
  const businessId = (body.business_id || '').trim()
  const customChannelName = (body.channel_name || '').trim()

  if (!code) {
    return e.json(400, {
      success: false,
      code: 'MISSING_AUTH_CODE',
      message: 'Código de autorização da Meta não informado. Reinicie o fluxo de login.',
    })
  }

  // 3. Validar se as credenciais da aplicação Meta estão cadastradas no backend
  if (!metaAppId || !metaAppSecret) {
    return e.json(503, {
      success: false,
      code: 'META_CONFIG_MISSING',
      message:
        'Configurações da Meta incompletas no servidor: META_APP_ID e META_APP_SECRET ainda não foram cadastrados nos segredos do Skip Cloud. Cadastre as variáveis no painel administrativo para concluir a troca de código.',
      details: {
        hasMetaAppId: Boolean(metaAppId),
        hasMetaAppSecret: Boolean(metaAppSecret),
      },
    })
  }

  // 4. Troca do código de autorização por Access Token via Graph API v21+
  let tokenData = null
  try {
    const tokenExchangeUrl =
      'https://graph.facebook.com/v21.0/oauth/access_token?' +
      'client_id=' +
      encodeURIComponent(metaAppId) +
      '&client_secret=' +
      encodeURIComponent(metaAppSecret) +
      '&code=' +
      encodeURIComponent(code) +
      '&grant_type=authorization_code'

    const tokenRes = $http.send({
      url: tokenExchangeUrl,
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      timeout: 30,
    })

    const tokenPayload = tokenRes.json || {}

    if (tokenRes.statusCode !== 200 || !tokenPayload.access_token) {
      const metaErr = tokenPayload.error || {}
      return e.json(400, {
        success: false,
        code: 'TOKEN_EXCHANGE_FAILED',
        message:
          'Falha na troca do código de autorização da Meta: ' +
          (metaErr.message ||
            'Código expirado ou inválido (TTL de 30 segundos expirou). Tente novamente.'),
        meta_error: metaErr,
      })
    }

    tokenData = tokenPayload
  } catch (err) {
    return e.json(502, {
      success: false,
      code: 'META_GRAPH_UNREACHABLE',
      message:
        'Não foi possível comunicar com a Graph API da Meta: ' +
        (err && err.message ? err.message : String(err)),
    })
  }

  const accessToken = tokenData.access_token
  const expiresIn = tokenData.expires_in || null
  const tokenType = tokenData.token_type || 'bearer'

  // 5. Verificação da elegibilidade de coexistência na Graph API
  let phoneDetails = null
  let displayPhoneNumber = ''
  let verifiedName = ''
  let isCoexistenceEligible = false

  if (phoneNumberId) {
    try {
      const phoneCheckRes = $http.send({
        url:
          'https://graph.facebook.com/v21.0/' +
          encodeURIComponent(phoneNumberId) +
          '?fields=id,display_phone_number,verified_name,is_on_biz_app,platform_type,quality_rating,code_verification_status',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 20,
      })

      if (phoneCheckRes.statusCode === 200 && phoneCheckRes.json) {
        phoneDetails = phoneCheckRes.json
        displayPhoneNumber = phoneDetails.display_phone_number || ''
        verifiedName = phoneDetails.verified_name || ''
        if (phoneDetails.is_on_biz_app === true) {
          isCoexistenceEligible = true
        }
      }
    } catch (checkErr) {
      console.log('Aviso: consulta de detalhes do telefone:', checkErr)
    }
  }

  if (!phoneNumberId || !wabaId || !isCoexistenceEligible) {
    return e.json(422, {
      success: false,
      code: 'COEXISTENCE_NOT_VERIFIED',
      message:
        'Não foi possível comprovar a coexistência do número com o WhatsApp Business. Nenhum canal foi ativado.',
    })
  }

  // 6. Consultar dados da WABA
  let wabaDetails = null
  if (wabaId) {
    try {
      const wabaRes = $http.send({
        url:
          'https://graph.facebook.com/v21.0/' +
          encodeURIComponent(wabaId) +
          '?fields=id,name,currency,timezone_id,message_template_namespace',
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
        timeout: 20,
      })
      if (wabaRes.statusCode === 200 && wabaRes.json) {
        wabaDetails = wabaRes.json
      }
    } catch (_) {}
  }

  if (!supabaseServiceKey) {
    return e.json(503, {
      success: false,
      code: 'SERVICE_ROLE_MISSING',
      message: 'Chave segura do Supabase não configurada. Nenhum canal foi conectado.',
    })
  }

  // 7. Gravação segura no Supabase
  const effectiveSupabaseKey = supabaseServiceKey
  const targetNumber = displayPhoneNumber || '+' + (phoneNumberId || 'canal_' + Date.now())
  const channelName =
    customChannelName ||
    verifiedName ||
    (wabaDetails && wabaDetails.name) ||
    'WhatsApp - ' + targetNumber

  let channelId = null
  let channelSaveError = null

  if (supabaseUrl && effectiveSupabaseKey) {
    try {
      const queryUrl =
        supabaseUrl.replace(/\/+$/, '') +
        '/rest/v1/whatsapp_channels?select=id,owner_user_id,numero_telefone&or=(numero_telefone.eq.' +
        encodeURIComponent(targetNumber) +
        ',waba_id.eq.' +
        encodeURIComponent(wabaId || 'none') +
        ')'

      const existingCheckRes = $http.send({
        url: queryUrl,
        method: 'GET',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: 'Bearer ' + effectiveSupabaseKey,
          'Content-Type': 'application/json',
        },
        timeout: 15,
      })

      if (existingCheckRes.statusCode !== 200)
        return e.json(502, { success: false, code: 'CHANNEL_LOOKUP_FAILED' })
      const existingRecords = existingCheckRes.json || []
      const existingChannel =
        Array.isArray(existingRecords) && existingRecords.length > 0 ? existingRecords[0] : null

      if (existingChannel && existingChannel.owner_user_id !== authenticatedUserId)
        return e.json(409, { success: false, code: 'CHANNEL_ALREADY_ASSIGNED' })
      const channelPayload = {
        nome: channelName,
        numero_telefone: targetNumber,
        provedor: 'oficial',
        ativo: true,
        owner_user_id: authenticatedUserId,
        waba_id: wabaId || null,
        provider_phone_number_id: phoneNumberId || null,
        business_id: businessId || null,
        connection_status: 'conectado',
        status_coexistencia: 'verified',
        metadata: {
          verified_name: verifiedName,
          platform_type: (phoneDetails && phoneDetails.platform_type) || 'CLOUD_API',
          is_on_biz_app: phoneDetails ? phoneDetails.is_on_biz_app : false,
          waba_name: wabaDetails ? wabaDetails.name : null,
          coexistence_mode: 'active',
          connected_at: new Date().toISOString(),
        },
      }

      if (existingChannel && existingChannel.id) {
        channelId = existingChannel.id
        const updateRes = $http.send({
          url:
            supabaseUrl.replace(/\/+$/, '') +
            '/rest/v1/whatsapp_channels?id=eq.' +
            existingChannel.id,
          method: 'PATCH',
          body: JSON.stringify(channelPayload),
          headers: {
            apikey: supabaseAnonKey,
            Authorization: 'Bearer ' + effectiveSupabaseKey,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          timeout: 15,
        })
        if (updateRes.statusCode >= 400) {
          channelSaveError =
            'Falha ao atualizar whatsapp_channels no Supabase: HTTP ' + updateRes.statusCode
        }
      } else {
        const insertRes = $http.send({
          url: supabaseUrl.replace(/\/+$/, '') + '/rest/v1/whatsapp_channels',
          method: 'POST',
          body: JSON.stringify(channelPayload),
          headers: {
            apikey: supabaseAnonKey,
            Authorization: 'Bearer ' + effectiveSupabaseKey,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          timeout: 15,
        })

        if (insertRes.statusCode === 201 && Array.isArray(insertRes.json) && insertRes.json[0]) {
          channelId = insertRes.json[0].id
        } else if (insertRes.statusCode >= 400) {
          channelSaveError =
            'Falha ao inserir whatsapp_channels no Supabase: HTTP ' + insertRes.statusCode
        }
      }

      // Se tivermos a service_role e migration 0007 aplicada, persistir na tabela privada
      if (channelId && supabaseServiceKey) {
        try {
          const credsPayload = {
            channel_id: channelId,
            user_id: authenticatedUserId,
            access_token: accessToken,
            token_type: tokenType,
            expires_in: expiresIn,
            token_expires_at: expiresIn
              ? new Date(Date.now() + expiresIn * 1000).toISOString()
              : null,
            raw_payload: {
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
              business_id: businessId,
            },
          }

          const savedCredentials = $http.send({
            url:
              supabaseUrl.replace(/\/+$/, '') +
              '/rest/v1/whatsapp_integration_credentials?on_conflict=channel_id',
            method: 'POST',
            body: JSON.stringify(credsPayload),
            headers: {
              apikey: supabaseServiceKey,
              Authorization: 'Bearer ' + supabaseServiceKey,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            timeout: 15,
          })
          if (savedCredentials.statusCode >= 400) channelSaveError = 'CREDENTIAL_WRITE_FAILED'
        } catch (credErr) {
          channelSaveError = 'CREDENTIAL_WRITE_EXCEPTION'
        }
      }
    } catch (dbErr) {
      channelSaveError = (dbErr && dbErr.message) || String(dbErr)
    }
  }

  if (!channelId || channelSaveError) {
    return e.json(502, {
      success: false,
      code: 'CHANNEL_SAVE_FAILED',
      message: channelSaveError || 'Canal não foi salvo no Supabase.',
    })
  }

  // 8. Resposta de sucesso segura (NENHUM TOKEN É EXPOSTO AO FRONTEND)
  return e.json(200, {
    success: true,
    message: 'WhatsApp Business conectado com sucesso em modo de coexistência.',
    data: {
      channel_id: channelId,
      channel_name: channelName,
      numero_telefone: targetNumber,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      business_id: businessId,
      coexistence_status: 'verified',
      verified_name: verifiedName,
      user_id: authenticatedUserId,
      warning: channelSaveError
        ? 'Canal preparado. Detalhe de sincronização com Supabase: ' + channelSaveError
        : null,
    },
  })
})

/**
 * 3. Rota de diagnóstico / status da integração Meta
 * GET /backend/v1/meta-whatsapp/status
 */
routerAdd('GET', '/backend/v1/meta-whatsapp/status', (e) => {
  const metaAppId = ($os.getenv('META_APP_ID') || '').trim()
  const metaAppSecret = ($os.getenv('META_APP_SECRET') || '').trim()
  const metaConfigId = ($os.getenv('META_CONFIG_ID') || '1818783062788114').trim()
  const supabaseUrl = ($os.getenv('VITE_SUPABASE_URL') || '').trim()
  const supabaseServiceKey = ($os.getenv('SUPABASE_SERVICE_ROLE_KEY') || '').trim()

  return e.json(200, {
    ready: Boolean(metaAppId && metaAppSecret && metaConfigId),
    meta: {
      has_app_id: Boolean(metaAppId),
      has_app_secret: Boolean(metaAppSecret),
      config_id: metaConfigId,
      coexistence_mode: 'enabled',
      permissions: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    },
    supabase: {
      has_url: Boolean(supabaseUrl),
      has_service_role_key: Boolean(supabaseServiceKey),
    },
  })
})
