migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const productsCol = app.findCollectionByNameOrId('products')
    const companiesCol = app.findCollectionByNameOrId('companies')
    const contactsCol = app.findCollectionByNameOrId('contacts')
    const oppCol = app.findCollectionByNameOrId('opportunities')
    const tasksCol = app.findCollectionByNameOrId('tasks')
    const timelineCol = app.findCollectionByNameOrId('opportunity_timeline')
    const contractsCol = app.findCollectionByNameOrId('contracts')

    // 1. Ensure admin user exists and has role 'ADMINISTRADOR'
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'kevinkjekabson@gmail.com')
      adminUser.set('role', 'ADMINISTRADOR')
      adminUser.set('name', 'Kevin Kjekabson')
      app.save(adminUser)
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('kevinkjekabson@gmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Kevin Kjekabson')
      adminUser.set('role', 'ADMINISTRADOR')
      app.save(adminUser)
    }

    // 2. Seed catalog products
    const initialProducts = [
      {
        name: 'Saúde PME',
        category: 'Saúde PME',
        description: 'Planos de saúde empresariais de 2 a 99 vidas',
        active: true,
      },
      {
        name: 'Saúde PF / Individual',
        category: 'Saúde PF',
        description: 'Planos individuais e familiares pessoa física',
        active: true,
      },
      {
        name: 'Saúde Coletivo por Adesão',
        category: 'Adesão',
        description: 'Entidades de classe, conselhos e associações',
        active: true,
      },
      {
        name: 'Odontológico PME e PF',
        category: 'Odontológico',
        description: 'Planos odontológicos corporativos e individuais',
        active: true,
      },
      {
        name: 'Seguro de Vida em Grupo',
        category: 'Seguro de Vida',
        description: 'Seguro de vida corporativo e convenções coletivas',
        active: true,
      },
      {
        name: 'Seguro Auto Frota e Individual',
        category: 'Seguro Auto',
        description: 'Coberturas para frotas empresariais e veículos particulares',
        active: true,
      },
      {
        name: 'Consórcio Imobiliário & Auto',
        category: 'Consórcio',
        description: 'Cartas de crédito para imóveis e veículos',
        active: true,
      },
    ]

    const productMap = {}
    for (const p of initialProducts) {
      try {
        const existing = app.findFirstRecordByData('products', 'name', p.name)
        productMap[p.name] = existing
      } catch (_) {
        const rec = new Record(productsCol)
        rec.set('name', p.name)
        rec.set('category', p.category)
        rec.set('description', p.description)
        rec.set('active', p.active)
        app.save(rec)
        productMap[p.name] = rec
      }
    }

    // 3. Seed DEMO Companies (clearly labeled as [DEMO])
    const demoCompanies = [
      {
        trade_name: '[DEMO] Lumina Tecnologia Ltda',
        legal_name: 'Lumina Desenvolvimento de Software Ltda',
        cnpj: '34.891.204/0001-92',
        city: 'São Paulo',
        state: 'SP',
        segment: 'Tecnologia / TI',
        notes:
          'Empresa em crescimento com 32 colaboradores. Busca redução de custos e melhor rede de hospitais.',
      },
      {
        trade_name: '[DEMO] Andrade & Filhos Logística',
        legal_name: 'Andrade Transportes e Cargas Eireli',
        cnpj: '18.442.890/0001-55',
        city: 'Campinas',
        state: 'SP',
        segment: 'Transporte e Logística',
        notes: 'PME com 14 colaboradores. Atual contrato na NotreDame com reajuste elevado.',
      },
      {
        trade_name: '[DEMO] Clínica Odonto Sorriso',
        legal_name: 'Odonto Sorriso Serviços Médicos Ltda',
        cnpj: '45.109.330/0001-18',
        city: 'Curitiba',
        state: 'PR',
        segment: 'Saúde / Clínicas',
        notes:
          '8 vidas. Contratação de primeiro plano de saúde para equipe médica e administrativa.',
      },
      {
        trade_name: '[DEMO] Bella Vita Alimentos',
        legal_name: 'Bella Vita Indústria Alimentícia Ltda',
        cnpj: '09.876.543/0001-21',
        city: 'Ribeirão Preto',
        state: 'SP',
        segment: 'Indústria Alimentícia',
        notes: 'Contrato ativo com 48 vidas. Em processo de implantação do novo benefício.',
      },
    ]

    const companyMap = {}
    for (const c of demoCompanies) {
      try {
        const existing = app.findFirstRecordByData('companies', 'trade_name', c.trade_name)
        companyMap[c.trade_name] = existing
      } catch (_) {
        const rec = new Record(companiesCol)
        rec.set('trade_name', c.trade_name)
        rec.set('legal_name', c.legal_name)
        rec.set('cnpj', c.cnpj)
        rec.set('city', c.city)
        rec.set('state', c.state)
        rec.set('segment', c.segment)
        rec.set('notes', c.notes)
        rec.set('created_by', adminUser.id)
        app.save(rec)
        companyMap[c.trade_name] = rec
      }
    }

    // 4. Seed DEMO Contacts
    const demoContacts = [
      {
        name: '[DEMO] Juliana Marques',
        phone: '(11) 98765-1122',
        email: 'juliana.marques@lumina.demo',
        position: 'Diretora de RH',
        cpf: '123.456.789-00',
        company_name: '[DEMO] Lumina Tecnologia Ltda',
        notes: 'Decisora final sobre benefícios e seguros corporativos.',
      },
      {
        name: '[DEMO] Carlos Eduardo Andrade',
        phone: '(19) 99123-4455',
        email: 'carlos@andradelog.demo',
        position: 'Sócio-Proprietário',
        cpf: '234.567.890-11',
        company_name: '[DEMO] Andrade & Filhos Logística',
        notes: 'Foco estrito em custo mensal e inclusão de dependentes.',
      },
      {
        name: '[DEMO] Dra. Patrícia Fontes',
        phone: '(41) 99888-7766',
        email: 'patricia@odontosorriso.demo',
        position: 'Sócia Administradora',
        cpf: '345.678.901-22',
        company_name: '[DEMO] Clínica Odonto Sorriso',
        notes: 'Deseja acomodação apartamento e hospitais de ponta em Curitiba.',
      },
      {
        name: '[DEMO] Marcelo Betti',
        phone: '(16) 99777-3322',
        email: 'marcelo.betti@bellavita.demo',
        position: 'Gerente Financeiro',
        cpf: '456.789.012-33',
        company_name: '[DEMO] Bella Vita Alimentos',
        notes: 'Acompanha a implantação e emissão dos cartões de benefício.',
      },
    ]

    const contactMap = {}
    for (const ct of demoContacts) {
      try {
        const existing = app.findFirstRecordByData('contacts', 'name', ct.name)
        contactMap[ct.name] = existing
      } catch (_) {
        const rec = new Record(contactsCol)
        rec.set('name', ct.name)
        rec.set('phone', ct.phone)
        rec.set('email', ct.email)
        rec.set('position', ct.position)
        rec.set('cpf', ct.cpf)
        if (companyMap[ct.company_name]) {
          rec.set('company_id', companyMap[ct.company_name].id)
        }
        rec.set('notes', ct.notes)
        rec.set('created_by', adminUser.id)
        app.save(rec)
        contactMap[ct.name] = rec
      }
    }

    // 5. Seed DEMO Opportunities (Sales Funnel & Post-Sales Funnel)
    const demoOpportunities = [
      {
        title: '[DEMO] Cotação PME 32 Vidas - Lumina Tech',
        pipeline_type: 'VENDAS',
        stage: 'Negociação',
        temperature: 'Quente',
        company: '[DEMO] Lumina Tecnologia Ltda',
        contact: '[DEMO] Juliana Marques',
        product: 'Saúde PME',
        origin: 'Indicação parceiro',
        tags: 'PME, TI, Bradesco Saúde, Amil',
        sale_value: 19800.0, // Mensalidade estimada
        commission_value: 3960.0, // Faturamento KKJ estimado (~20% primeira parcela)
        quotation_link: 'https://cotador.kkj.com.br/demo/lumina-tech',
        qualification_notes:
          'Cotação apresentada com Bradesco Saúde Top Nacional e Amil S750. Decisão na próxima terça.',
        health_data: {
          has_current_plan: true,
          current_operator: 'SulAmérica',
          quoted_operator: 'Bradesco Saúde / Amil',
          lives_count: 32,
          ages_summary: '22 a 48 anos (média 31 anos)',
          city: 'São Paulo',
          state: 'SP',
          current_value: 24500.0,
          contract_type: 'PME Coparticipativo',
          accommodation: 'Apartamento',
          desired_network: 'Hospital Sírio-Libanês, Albert Einstein e Oswaldo Cruz',
          objective: 'Reduzir custo',
          hiring_date: '2026-10-15',
          renewal_date: '2027-10-15',
        },
      },
      {
        title: '[DEMO] Troca de Operadora 14 Vidas - Andrade Log',
        pipeline_type: 'VENDAS',
        stage: 'Cotação',
        temperature: 'Morno',
        company: '[DEMO] Andrade & Filhos Logística',
        contact: '[DEMO] Carlos Eduardo Andrade',
        product: 'Saúde PME',
        origin: 'Google Ads',
        tags: 'Campinas, Notredame, GNDI, Porto',
        sale_value: 8400.0,
        commission_value: 1680.0,
        quotation_link: 'https://cotador.kkj.com.br/demo/andrade-log',
        qualification_notes:
          'Aguardando envio da lista com datas de nascimento dos 14 funcionários.',
        health_data: {
          has_current_plan: true,
          current_operator: 'NotreDame Intermédica',
          quoted_operator: 'Porto Saúde / SulAmérica',
          lives_count: 14,
          ages_summary: '28 a 55 anos',
          city: 'Campinas',
          state: 'SP',
          current_value: 11200.0,
          contract_type: 'PME Sem Coparticipação',
          accommodation: 'Enfermaria',
          desired_network: 'Hospital Vera Cruz, Centro Médico de Campinas',
          objective: 'Trocar operadora',
        },
      },
      {
        title: '[DEMO] Primeiro Plano Odonto Sorriso 8 Vidas',
        pipeline_type: 'VENDAS',
        stage: 'Contato realizado',
        temperature: 'Frio',
        company: '[DEMO] Clínica Odonto Sorriso',
        contact: '[DEMO] Dra. Patrícia Fontes',
        product: 'Saúde PME',
        origin: 'WhatsApp KKJ',
        tags: 'Primeiro Plano, Curitiba, Unimed',
        sale_value: 4800.0,
        commission_value: 960.0,
        quotation_link: '',
        qualification_notes:
          'Primeiro contato realizado. Dra. Patrícia pediu envio da cotação comparativa Unimed Curitiba vs Amil.',
        health_data: {
          has_current_plan: false,
          current_operator: '',
          quoted_operator: 'Unimed Curitiba',
          lives_count: 8,
          ages_summary: '24 a 42 anos',
          city: 'Curitiba',
          state: 'PR',
          current_value: 0,
          contract_type: 'PME Ambulatorial + Hospitalar',
          accommodation: 'Apartamento',
          desired_network: 'Hospital Marcelino Champagnat, Hospital Sugisawa',
          objective: 'Primeiro plano',
        },
      },
      {
        title: '[DEMO] Implantação 48 Vidas - Bella Vita Alimentos',
        pipeline_type: 'POS_VENDA',
        stage: 'Implantação',
        temperature: 'Quente',
        company: '[DEMO] Bella Vita Alimentos',
        contact: '[DEMO] Marcelo Betti',
        product: 'Saúde PME',
        origin: 'Prospecção Ativa',
        tags: 'Pós-Venda, Implantação, SulAmérica',
        sale_value: 31200.0,
        commission_value: 6240.0,
        quotation_link: 'https://cotador.kkj.com.br/demo/bella-vita',
        qualification_notes:
          'Proposta aceita e assinada. Em fase de envio de fichas cadastrais e layout da operadora.',
        health_data: {
          has_current_plan: true,
          current_operator: 'Unimed Regional',
          quoted_operator: 'SulAmérica Saúde Especial 100',
          lives_count: 48,
          ages_summary: '20 a 59 anos',
          city: 'Ribeirão Preto',
          state: 'SP',
          current_value: 36000.0,
          contract_type: 'PME Coparticipativo 30%',
          accommodation: 'Apartamento',
          desired_network: 'Hospital São Lucas, Hospital Ribeirânia',
          objective: 'Melhorar rede',
          hiring_date: '2026-10-01',
          renewal_date: '2027-10-01',
        },
      },
    ]

    const oppMap = {}
    for (const op of demoOpportunities) {
      try {
        const existing = app.findFirstRecordByData('opportunities', 'title', op.title)
        oppMap[op.title] = existing
      } catch (_) {
        const rec = new Record(oppCol)
        rec.set('title', op.title)
        rec.set('pipeline_type', op.pipeline_type)
        rec.set('stage', op.stage)
        rec.set('temperature', op.temperature)
        if (contactMap[op.contact]) rec.set('contact_id', contactMap[op.contact].id)
        if (companyMap[op.company]) rec.set('company_id', companyMap[op.company].id)
        if (productMap[op.product]) rec.set('product_id', productMap[op.product].id)
        rec.set('assigned_to', adminUser.id)
        rec.set('origin', op.origin)
        rec.set('tags', op.tags)
        rec.set('sale_value', op.sale_value)
        rec.set('commission_value', op.commission_value)
        rec.set('quotation_link', op.quotation_link)
        rec.set('qualification_notes', op.qualification_notes)
        rec.set('health_data', op.health_data)
        rec.set('created_by', adminUser.id)
        app.save(rec)
        oppMap[op.title] = rec
      }
    }

    // 6. Seed DEMO Tasks
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const demoTasks = [
      {
        title: '[DEMO] Apresentar comparativo Bradesco vs Amil para diretoria',
        type: 'Reunião',
        due_date: today,
        due_time: '14:30',
        status: 'Pendente',
        notes: 'Reunião virtual via Google Meet com Juliana Marques e CFO.',
        opp_title: '[DEMO] Cotação PME 32 Vidas - Lumina Tech',
      },
      {
        title: '[DEMO] Cobrar envio da relação de vidas e certidão do CNPJ',
        type: 'Follow-up',
        due_date: yesterday,
        due_time: '11:00',
        status: 'Pendente', // Atrasada de propósito para demo de indicadores
        notes: 'Ligar para Carlos da Andrade Logística para liberar a cotação oficial.',
        opp_title: '[DEMO] Troca de Operadora 14 Vidas - Andrade Log',
      },
      {
        title: '[DEMO] Conferir documentos admissionais e fichas de adesão',
        type: 'Documentação',
        due_date: tomorrow,
        due_time: '10:00',
        status: 'Pendente',
        notes: 'Validação de CPF e certidões de casamento dos dependentes.',
        opp_title: '[DEMO] Implantação 48 Vidas - Bella Vita Alimentos',
      },
    ]

    for (const t of demoTasks) {
      try {
        const existing = app.findFirstRecordByData('tasks', 'title', t.title)
      } catch (_) {
        const rec = new Record(tasksCol)
        rec.set('title', t.title)
        rec.set('type', t.type)
        rec.set('due_date', t.due_date)
        rec.set('due_time', t.due_time)
        rec.set('status', t.status)
        rec.set('notes', t.notes)
        if (oppMap[t.opp_title]) rec.set('opportunity_id', oppMap[t.opp_title].id)
        rec.set('assigned_to', adminUser.id)
        rec.set('created_by', adminUser.id)
        app.save(rec)
      }
    }

    // 7. Seed DEMO Timeline history for opportunities
    for (const [title, oppRec] of Object.entries(oppMap)) {
      try {
        const existing = app.findFirstRecordByData(
          'opportunity_timeline',
          'opportunity_id',
          oppRec.id,
        )
      } catch (_) {
        const rec = new Record(timelineCol)
        rec.set('opportunity_id', oppRec.id)
        rec.set('action_type', 'SISTEMA')
        rec.set('title', 'Oportunidade Criada')
        rec.set(
          'description',
          'Oportunidade inserida no CRM KKJ Corretora com estágio inicial definido.',
        )
        rec.set('created_by', adminUser.id)
        app.save(rec)

        const recNote = new Record(timelineCol)
        recNote.set('opportunity_id', oppRec.id)
        recNote.set('action_type', 'NOTA')
        recNote.set('title', 'Qualificação Inicial')
        recNote.set(
          'description',
          'Cliente atendeu pelo canal direto, dados de saúde e plano coletados com sucesso.',
        )
        recNote.set('created_by', adminUser.id)
        app.save(recNote)
      }
    }

    // 8. Seed DEMO Contract for Bella Vita (Venda Ganha / Pós-Venda)
    const bellaOpp = oppMap['[DEMO] Implantação 48 Vidas - Bella Vita Alimentos']
    if (bellaOpp) {
      try {
        const existing = app.findFirstRecordByData('contracts', 'contract_number', 'KKJ-2026-0048')
      } catch (_) {
        const rec = new Record(contractsCol)
        rec.set('contract_number', 'KKJ-2026-0048')
        rec.set('opportunity_id', bellaOpp.id)
        if (companyMap['[DEMO] Bella Vita Alimentos']) {
          rec.set('company_id', companyMap['[DEMO] Bella Vita Alimentos'].id)
        }
        if (contactMap['[DEMO] Marcelo Betti']) {
          rec.set('contact_id', contactMap['[DEMO] Marcelo Betti'].id)
        }
        if (productMap['Saúde PME']) {
          rec.set('product_id', productMap['Saúde PME'].id)
        }
        rec.set('sale_value', 31200.0)
        rec.set('commission_value', 6240.0)
        rec.set('lives_count', 48)
        rec.set('operator', 'SulAmérica')
        rec.set('start_date', '2026-10-01')
        rec.set('renewal_date', '2027-10-01')
        rec.set('status', 'Em Implantação')
        rec.set('assigned_to', adminUser.id)
        rec.set('created_by', adminUser.id)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down rollback
  },
)
