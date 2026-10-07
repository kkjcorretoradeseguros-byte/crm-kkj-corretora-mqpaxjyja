migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const propertiesCol = app.findCollectionByNameOrId('properties')
    const clientsCol = app.findCollectionByNameOrId('clients')
    const interactionsCol = app.findCollectionByNameOrId('interactions')
    const stagesCol = app.findCollectionByNameOrId('pipeline_stages')
    const entriesCol = app.findCollectionByNameOrId('pipeline_entries')

    // 1. Seed default user if not exists
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'kevinkjekabson@gmail.com')
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('kevinkjekabson@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Kevin Kjekabson')
      app.save(adminUser)
    }

    // 2. Seed pipeline stages (positions 1-6)
    const defaultStages = [
      { name: 'Novo', position: 1, color: '#3B82F6' },
      { name: 'Contato Feito', position: 2, color: '#8B5CF6' },
      { name: 'Visita Agendada', position: 3, color: '#F59E0B' },
      { name: 'Proposta Enviada', position: 4, color: '#EC4899' },
      { name: 'Fechado', position: 5, color: '#10B981' },
      { name: 'Perdido', position: 6, color: '#EF4444' },
    ]

    const stageRecords = {}
    for (const s of defaultStages) {
      try {
        const existing = app.findFirstRecordByData('pipeline_stages', 'name', s.name)
        stageRecords[s.name] = existing
      } catch (_) {
        const record = new Record(stagesCol)
        record.set('name', s.name)
        record.set('position', s.position)
        record.set('color', s.color)
        record.set('created_by', adminUser.id)
        app.save(record)
        stageRecords[s.name] = record
      }
    }

    // 3. Seed properties
    const sampleProperties = [
      {
        title: 'Apartamento de Alto Padrão nos Jardins',
        description:
          'Amplo apartamento com acabamento de luxo, varanda gourmet e vista panorâmica para a cidade.',
        type: 'Apartamento',
        transaction_type: 'Venda',
        price: 1850000,
        condominium_fee: 1800,
        iptu: 650,
        area_m2: 145,
        bedrooms: 3,
        bathrooms: 4,
        parking_spots: 2,
        address_street: 'Rua Oscar Freire',
        address_number: '1420',
        address_neighborhood: 'Cerqueira César',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_cep: '01426-001',
        status: 'Disponível',
      },
      {
        title: 'Casa em Condomínio Fechado com Piscina',
        description:
          'Linda residência com 4 suítes, energia solar, área de lazer privativa completa e segurança 24h.',
        type: 'Casa',
        transaction_type: 'Venda',
        price: 2400000,
        condominium_fee: 1200,
        iptu: 850,
        area_m2: 320,
        bedrooms: 4,
        bathrooms: 5,
        parking_spots: 4,
        address_street: 'Alameda dos Ipês',
        address_number: '88',
        address_neighborhood: 'Granja Viana',
        address_city: 'Cotia',
        address_state: 'SP',
        address_cep: '06711-280',
        status: 'Disponível',
      },
      {
        title: 'Studio Moderno na Vila Madalena',
        description:
          'Ideal para investimento ou moradia prática, totalmente mobiliado, próximo ao metrô e vida boêmia.',
        type: 'Apartamento',
        transaction_type: 'Aluguel',
        price: 4200,
        condominium_fee: 650,
        iptu: 180,
        area_m2: 42,
        bedrooms: 1,
        bathrooms: 1,
        parking_spots: 1,
        address_street: 'Rua Fradique Coutinho',
        address_number: '920',
        address_neighborhood: 'Vila Madalena',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_cep: '05416-001',
        status: 'Reservado',
      },
      {
        title: 'Cobertura Duplex com Piscina Privativa',
        description:
          'Exclusiva cobertura duplex, vista 360 graus, espaço gourmet e piscina aquecida no deck superior.',
        type: 'Cobertura',
        transaction_type: 'Venda',
        price: 3600000,
        condominium_fee: 3100,
        iptu: 1400,
        area_m2: 280,
        bedrooms: 4,
        bathrooms: 6,
        parking_spots: 3,
        address_street: 'Avenida Vieira Souto',
        address_number: '450',
        address_neighborhood: 'Ipanema',
        address_city: 'Rio de Janeiro',
        address_state: 'RJ',
        address_cep: '22420-006',
        status: 'Disponível',
      },
      {
        title: 'Conjunto Comercial Pronto no Itaim Bibi',
        description:
          'Sala comercial pronta para escritórios executivos ou consultórios, piso elevado, ar condicionado e recepção.',
        type: 'Comercial',
        transaction_type: 'Aluguel',
        price: 12500,
        condominium_fee: 2200,
        iptu: 900,
        area_m2: 110,
        bedrooms: 0,
        bathrooms: 2,
        parking_spots: 2,
        address_street: 'Rua Joaquim Floriano',
        address_number: '720',
        address_neighborhood: 'Itaim Bibi',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_cep: '04534-002',
        status: 'Vendido',
      },
    ]

    const propRecords = []
    for (const p of sampleProperties) {
      try {
        const existing = app.findFirstRecordByData('properties', 'title', p.title)
        propRecords.push(existing)
      } catch (_) {
        const rec = new Record(propertiesCol)
        rec.set('title', p.title)
        rec.set('description', p.description)
        rec.set('type', p.type)
        rec.set('transaction_type', p.transaction_type)
        rec.set('price', p.price)
        rec.set('condominium_fee', p.condominium_fee)
        rec.set('iptu', p.iptu)
        rec.set('area_m2', p.area_m2)
        rec.set('bedrooms', p.bedrooms)
        rec.set('bathrooms', p.bathrooms)
        rec.set('parking_spots', p.parking_spots)
        rec.set('address_street', p.address_street)
        rec.set('address_number', p.address_number)
        rec.set('address_neighborhood', p.address_neighborhood)
        rec.set('address_city', p.address_city)
        rec.set('address_state', p.address_state)
        rec.set('address_cep', p.address_cep)
        rec.set('status', p.status)
        rec.set('created_by', adminUser.id)
        app.save(rec)
        propRecords.push(rec)
      }
    }

    // 4. Seed clients
    const sampleClients = [
      {
        full_name: 'Maria Clara Oliveira',
        phone: '(11) 98765-4321',
        email: 'mariaclara.oliveira@gmail.com',
        status: 'Interessado',
        notes:
          'Busca apartamento 3 dormitórios nos Jardins ou Itaim Bibi para morar com a família.',
      },
      {
        full_name: 'Rodrigo Mendonça Rocha',
        phone: '(11) 97123-8899',
        email: 'rodrigo.rocha@techcorp.com.br',
        status: 'Ativo',
        notes:
          'Interessado em casa em condomínio na Granja Viana. Já possui financiamento pré-aprovado.',
      },
      {
        full_name: 'Camila Albuquerque Silva',
        phone: '(21) 99444-2211',
        email: 'camila.albuquerque@advocacia.com',
        status: 'Ativo',
        notes:
          'Investidora procurando cobertura de luxo para locação por temporada ou uso aos finais de semana.',
      },
      {
        full_name: 'Fernando Augusto Lima',
        phone: '(11) 96555-1234',
        email: 'fernando.lima@startup.io',
        status: 'Interessado',
        notes: 'Procura studio ou sala comercial bem localizado com vaga de garagem.',
      },
      {
        full_name: 'Beatriz Fonseca Dias',
        phone: '(11) 95222-7711',
        email: 'beatriz.dias@focodesign.com.br',
        status: 'Inativo',
        notes: 'Adiou a compra para o próximo ano.',
      },
    ]

    const clientRecords = []
    for (let i = 0; i < sampleClients.length; i++) {
      const c = sampleClients[i]
      try {
        const existing = app.findFirstRecordByData('clients', 'full_name', c.full_name)
        clientRecords.push(existing)
      } catch (_) {
        const rec = new Record(clientsCol)
        rec.set('full_name', c.full_name)
        rec.set('phone', c.phone)
        rec.set('email', c.email)
        rec.set('status', c.status)
        rec.set('notes', c.notes)
        rec.set('created_by', adminUser.id)
        if (propRecords[i % propRecords.length]) {
          rec.set('interested_properties', [propRecords[i % propRecords.length].id])
        }
        app.save(rec)
        clientRecords.push(rec)
      }
    }

    // 5. Seed interactions
    const now = new Date()
    const pastDays = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()
    const futureDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString()

    const sampleInteractions = [
      {
        client_index: 0,
        type: 'Visita',
        notes:
          'Visita presencial no Apartamento dos Jardins. Cliente gostou muito da varanda gourmet e da iluminação.',
        date: pastDays(1),
        follow_up: futureDays(2),
      },
      {
        client_index: 1,
        type: 'WhatsApp',
        notes: 'Envio das fotos detalhadas e vídeo da área de lazer da Casa na Granja Viana.',
        date: pastDays(2),
        follow_up: futureDays(3),
      },
      {
        client_index: 2,
        type: 'Reunião',
        notes: 'Reunião online para apresentar memorial descritivo da Cobertura Duplex em Ipanema.',
        date: pastDays(4),
        follow_up: futureDays(4),
      },
      {
        client_index: 3,
        type: 'Telefone',
        notes:
          'Primeiro contato telefônico. Entendidas as preferências de metragem e faixa orçamentária.',
        date: pastDays(5),
        follow_up: futureDays(1),
      },
      {
        client_index: 0,
        type: 'E-mail',
        notes:
          'Envio da minuta de proposta de compra para análise do departamento jurídico da cliente.',
        date: pastDays(0),
        follow_up: futureDays(5),
      },
    ]

    for (const item of sampleInteractions) {
      const client = clientRecords[item.client_index]
      if (!client) continue
      try {
        const rec = new Record(interactionsCol)
        rec.set('client_id', client.id)
        rec.set('type', item.type)
        rec.set('notes', item.notes)
        rec.set('interaction_date', item.date)
        rec.set('follow_up_date', item.follow_up)
        rec.set('created_by', adminUser.id)
        app.save(rec)
      } catch (_) {}
    }

    // 6. Seed pipeline entries
    const samplePipeline = [
      {
        client_index: 0,
        stage_name: 'Proposta Enviada',
        prop_index: 0,
        value: 1800000,
        notes: 'Proposta com sinal de 20% e saldo financiado via Santander',
      },
      {
        client_index: 1,
        stage_name: 'Visita Agendada',
        prop_index: 1,
        value: 2400000,
        notes: 'Visita agendada para sábado às 10h com a família',
      },
      {
        client_index: 2,
        stage_name: 'Contato Feito',
        prop_index: 3,
        value: 3600000,
        notes: 'Interessada na cobertura duplex, aguardando visita no RJ',
      },
      {
        client_index: 3,
        stage_name: 'Novo',
        prop_index: 2,
        value: 4200,
        notes: 'Lead recebido via portal imobiliário procurando studio',
      },
    ]

    for (const item of samplePipeline) {
      const client = clientRecords[item.client_index]
      const stage = stageRecords[item.stage_name]
      const prop = propRecords[item.prop_index]
      if (!client || !stage) continue
      try {
        const rec = new Record(entriesCol)
        rec.set('stage_id', stage.id)
        rec.set('client_id', client.id)
        if (prop) rec.set('property_id', prop.id)
        rec.set('value', item.value)
        rec.set('notes', item.notes)
        rec.set('created_by', adminUser.id)
        app.save(rec)
      } catch (_) {}
    }
  },
  (app) => {
    // down rollback
  },
)
