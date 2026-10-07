migrate(
  (app) => {
    // 1. Remove old real-estate collections
    const oldCollections = [
      'pipeline_entries',
      'pipeline_stages',
      'interactions',
      'clients',
      'properties',
    ]

    for (const name of oldCollections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }

    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 2. Ensure role field exists on users collection (ADMINISTRADOR, GESTOR, VENDEDOR)
    try {
      if (!users.fields.getByName('role')) {
        users.fields.add(
          new SelectField({
            name: 'role',
            required: true,
            values: ['ADMINISTRADOR', 'GESTOR', 'VENDEDOR'],
            maxSelect: 1,
          }),
        )
        app.save(users)
      }
    } catch (_) {}

    // 3. Create products catalog collection (catálogo configurável de seguros e benefícios)
    const products = new Collection({
      name: 'products',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'category',
          type: 'select',
          required: true,
          values: [
            'Saúde PME',
            'Saúde PF',
            'Adesão',
            'Odontológico',
            'Seguro de Vida',
            'Seguro Auto',
            'Consórcio',
            'Outros',
          ],
          maxSelect: 1,
        },
        { name: 'description', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_products_name ON products (name)',
        'CREATE INDEX idx_products_category ON products (category)',
      ],
    })
    app.save(products)

    // 4. Create companies (EMPRESA / CLIENTE PJ ou titular principal)
    const companies = new Collection({
      name: 'companies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'trade_name', type: 'text', required: true },
        { name: 'legal_name', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'segment', type: 'text' },
        { name: 'notes', type: 'text' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_companies_trade_name ON companies (trade_name)',
        'CREATE INDEX idx_companies_cnpj ON companies (cnpj)',
      ],
    })
    app.save(companies)

    // 5. Create contacts (CONTATO pessoa física vinculado ou não a empresa)
    const contacts = new Collection({
      name: 'contacts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'position', type: 'text' },
        { name: 'cpf', type: 'text' },
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'notes', type: 'text' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contacts_name ON contacts (name)',
        'CREATE INDEX idx_contacts_phone ON contacts (phone)',
        'CREATE INDEX idx_contacts_company ON contacts (company_id)',
      ],
    })
    app.save(contacts)

    // 6. Create opportunities collection (OPORTUNIDADE - registro central do funil)
    const opportunities = new Collection({
      name: 'opportunities',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR' || assigned_to = @request.auth.id || created_by = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR' || assigned_to = @request.auth.id || created_by = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR' || assigned_to = @request.auth.id || created_by = @request.auth.id)",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR')",
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'pipeline_type',
          type: 'select',
          required: true,
          values: ['VENDAS', 'POS_VENDA'],
          maxSelect: 1,
        },
        {
          name: 'stage',
          type: 'text',
          required: true,
        },
        {
          name: 'temperature',
          type: 'select',
          required: true,
          values: ['Frio', 'Morno', 'Quente'],
          maxSelect: 1,
        },
        {
          name: 'contact_id',
          type: 'relation',
          collectionId: contacts.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'product_id',
          type: 'relation',
          collectionId: products.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'assigned_to',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'origin', type: 'text' },
        { name: 'tags', type: 'text' },
        { name: 'sale_value', type: 'number' },
        { name: 'commission_value', type: 'number' },
        { name: 'quotation_link', type: 'text' },
        { name: 'qualification_notes', type: 'text' },
        { name: 'lost_reason', type: 'text' },
        { name: 'health_data', type: 'json' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_opp_pipeline_stage ON opportunities (pipeline_type, stage)',
        'CREATE INDEX idx_opp_assigned ON opportunities (assigned_to)',
        'CREATE INDEX idx_opp_company ON opportunities (company_id)',
      ],
    })
    app.save(opportunities)

    // 7. Create tasks collection (TAREFAS)
    const tasks = new Collection({
      name: 'tasks',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: [
            'Ligação',
            'WhatsApp',
            'Follow-up',
            'Reunião',
            'Cotação',
            'Documentação',
            'Implantação',
            'Cobrança/Pagamento',
            'Outro',
          ],
          maxSelect: 1,
        },
        { name: 'due_date', type: 'date', required: true },
        { name: 'due_time', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Concluída', 'Cancelada'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        {
          name: 'opportunity_id',
          type: 'relation',
          collectionId: opportunities.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'assigned_to',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_tasks_opp ON tasks (opportunity_id)',
        'CREATE INDEX idx_tasks_due ON tasks (due_date ASC)',
        'CREATE INDEX idx_tasks_status ON tasks (status)',
      ],
    })
    app.save(tasks)

    // 8. Create opportunity_timeline collection (TIMELINE / HISTÓRICO cronológico)
    const timeline = new Collection({
      name: 'opportunity_timeline',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'opportunity_id',
          type: 'relation',
          collectionId: opportunities.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'action_type',
          type: 'select',
          required: true,
          values: [
            'NOTA',
            'MUDANCA_ETAPA',
            'MUDANCA_RESPONSAVEL',
            'TAREFA',
            'VENDA_CONTRATO',
            'SISTEMA',
          ],
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'metadata', type: 'json' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_timeline_opp ON opportunity_timeline (opportunity_id, created DESC)',
      ],
    })
    app.save(timeline)

    // 9. Create contracts collection (VENDA / CONTRATO gerado a partir de Venda Ganha)
    const contracts = new Collection({
      name: 'contracts',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR' || assigned_to = @request.auth.id)",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR' || assigned_to = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR')",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'ADMINISTRADOR' || @request.auth.role = 'GESTOR')",
      fields: [
        { name: 'contract_number', type: 'text' },
        {
          name: 'opportunity_id',
          type: 'relation',
          collectionId: opportunities.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'company_id',
          type: 'relation',
          collectionId: companies.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'contact_id',
          type: 'relation',
          collectionId: contacts.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'product_id',
          type: 'relation',
          collectionId: products.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'sale_value', type: 'number', required: true },
        { name: 'commission_value', type: 'number' },
        { name: 'lives_count', type: 'number' },
        { name: 'operator', type: 'text' },
        { name: 'start_date', type: 'date' },
        { name: 'renewal_date', type: 'date' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Ativo', 'Cancelado', 'Em Implantação', 'Pendente Renovação'],
          maxSelect: 1,
        },
        {
          name: 'assigned_to',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contracts_company ON contracts (company_id)',
        'CREATE INDEX idx_contracts_renewal ON contracts (renewal_date ASC)',
      ],
    })
    app.save(contracts)
  },
  (app) => {
    // down rollback
  },
)
