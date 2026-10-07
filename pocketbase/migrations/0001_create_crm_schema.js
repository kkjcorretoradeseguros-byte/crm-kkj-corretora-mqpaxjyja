migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. properties collection
    const properties = new Collection({
      name: 'properties',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['Apartamento', 'Casa', 'Terreno', 'Comercial', 'Cobertura'],
          maxSelect: 1,
        },
        {
          name: 'transaction_type',
          type: 'select',
          required: true,
          values: ['Venda', 'Aluguel'],
          maxSelect: 1,
        },
        { name: 'price', type: 'number', required: true },
        { name: 'condominium_fee', type: 'number' },
        { name: 'iptu', type: 'number' },
        { name: 'area_m2', type: 'number' },
        { name: 'bedrooms', type: 'number' },
        { name: 'bathrooms', type: 'number' },
        { name: 'parking_spots', type: 'number' },
        { name: 'address_street', type: 'text' },
        { name: 'address_number', type: 'text' },
        { name: 'address_neighborhood', type: 'text' },
        { name: 'address_city', type: 'text' },
        { name: 'address_state', type: 'text' },
        { name: 'address_cep', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Disponível', 'Vendido', 'Alugado', 'Reservado'],
          maxSelect: 1,
        },
        {
          name: 'photos',
          type: 'file',
          maxSelect: 10,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
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
        'CREATE INDEX idx_props_status ON properties (status)',
        'CREATE INDEX idx_props_type ON properties (type)',
        'CREATE INDEX idx_props_created ON properties (created DESC)',
      ],
    })
    app.save(properties)

    // 2. clients collection
    const clients = new Collection({
      name: 'clients',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'full_name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'email', type: 'email' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Ativo', 'Inativo', 'Interessado'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        {
          name: 'interested_properties',
          type: 'relation',
          collectionId: properties.id,
          maxSelect: 10,
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
        'CREATE INDEX idx_clients_status ON clients (status)',
        'CREATE INDEX idx_clients_created ON clients (created DESC)',
      ],
    })
    app.save(clients)

    // 3. interactions collection
    const interactions = new Collection({
      name: 'interactions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clients.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['E-mail', 'Telefone', 'Visita', 'Reunião', 'WhatsApp'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text', required: true },
        { name: 'interaction_date', type: 'date', required: true },
        { name: 'follow_up_date', type: 'date' },
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
        'CREATE INDEX idx_interact_client ON interactions (client_id)',
        'CREATE INDEX idx_interact_date ON interactions (interaction_date DESC)',
      ],
    })
    app.save(interactions)

    // 4. pipeline_stages collection
    const stages = new Collection({
      name: 'pipeline_stages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'position', type: 'number', required: true },
        { name: 'color', type: 'text' },
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
      indexes: ['CREATE INDEX idx_stages_pos ON pipeline_stages (position ASC)'],
    })
    app.save(stages)

    // 5. pipeline_entries collection
    const entries = new Collection({
      name: 'pipeline_entries',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'stage_id',
          type: 'relation',
          collectionId: stages.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clients.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'property_id',
          type: 'relation',
          collectionId: properties.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'value', type: 'number' },
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
        'CREATE INDEX idx_entries_stage ON pipeline_entries (stage_id)',
        'CREATE INDEX idx_entries_client ON pipeline_entries (client_id)',
      ],
    })
    app.save(entries)
  },
  (app) => {
    const toDelete = [
      'pipeline_entries',
      'pipeline_stages',
      'interactions',
      'clients',
      'properties',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
