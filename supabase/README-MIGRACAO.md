# Guia de Migração Supabase — CRM KK JEKABSON Corretora (KKJ)

Este guia orienta o administrador da **KK JEKABSON Corretora de Seguros (KKJ)** no processo de execução manual da migration SQL no painel Supabase do cliente.

---

## 1. Visão Geral e Arquitetura

O schema foi projetado especificamente para as operações da **KKJ Corretora de Seguros e Benefícios**, especializada em planos de saúde (PME, PF, Adesão, Odonto) e seguros em geral (Vida, Auto, Consórcio e Patrimonial).

### Destaques da Estrutura:

- **Tabelas do Domínio:** `profiles`, `products`, `companies`, `contacts`, `pipeline_stages`, `loss_reasons`, `task_types`, `opportunities`, `tasks`, `opportunity_timeline`, `contracts`, `contract_financials`, `audit_log`, `message_templates`, `conversations`, `messages`.
- **Enums PostgreSQL:** `user_role`, `funnel_type`, `temperature`, `task_status`, `task_type`, `opp_status`, `doc_status`, `contract_status`, `timeline_action_type`, `message_direction`, `message_delivery_status`.
- **Proteção Financeira Real:** A tabela `contract_financials` é **fisicamente separada** de `contracts`. Por padrão, **somente administradores (`public.is_admin()`)** têm acesso a ela (SELECT, INSERT, UPDATE, DELETE). Gestores NÃO recebem acesso default a faturamento bruto, impostos e margem global. Vendedores consultam suas próprias vendas e repasses através da visão segura `public.v_vendedor_financeiro` (SECURITY BARRIER).
- **Timeline Imutável:** A tabela `opportunity_timeline` é _append-only_. Nenhuma política concede `UPDATE` ou `DELETE`, garantindo histórico inalterável de notas e movimentações de etapa.
- **Auditoria Contínua e Abrangente:** Triggers de auditoria cobrem `opportunities`, `contracts`, `contract_financials`, `profiles`, `products`, `pipeline_stages`, `loss_reasons` e `task_types`. A tabela `audit_log` é append-only e restrita exclusivamente ao Administrador.

---

## 2. Passo a Passo para Execução no Supabase SQL Editor

1. Acesse o console do seu projeto no Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. No menu lateral esquerdo, clique no ícone **SQL Editor** (ou pressione as teclas de atalho de busca e digite "SQL").
3. Clique em **+ New query** (ou "Nova Consulta").
4. Abra o arquivo localizado no repositório:
   ```
   supabase/migrations/0001_kkj_initial_schema.sql
   ```
5. Copie **todo o conteúdo** do arquivo e cole no editor do Supabase.
6. Clique no botão verde **Run** (ou pressione `Ctrl + Enter` / `Cmd + Enter`).
7. Ao término, a mensagem `Success. No rows returned` será exibida.
8. Verifique as tabelas criadas clicando em **Table Editor** no menu lateral.

> **Nota de Idempotência:** O script foi construído com verificações `IF NOT EXISTS`, blocos `DO $$` condicionais e cláusulas `ON CONFLICT (...) DO UPDATE`. Caso precise reexecutá-lo, nenhuma informação de configuração será duplicada.

---

## 3. Como Promover o Primeiro Usuário a Administrador (Bootstrap Inicial)

Por padrão e por motivos estritos de segurança, a trigger `on_auth_user_created` define:

- **TODO novo cadastro (signup) nasce obrigatoriamente como `'vendedor'`.**
- **NÃO existe auto-promoção** a administrador (nem mesmo para o primeiro usuário criado). Isso elimina qualquer janela de vulnerabilidade ou risco caso em algum momento não exista um perfil administrador.
- Uma trigger `trg_protect_profile_role` impede que qualquer usuário altere sua própria coluna `role`. Somente administradores (ou processos com privilégio de servidor `service_role`) podem alterar a role de um perfil.

### Instrução de Bootstrap Inicial:

Após criar sua conta de usuário no Supabase (seja via painel de autenticação ou via signup no frontend), execute a instrução SQL separada abaixo no **SQL Editor** substituindo pelo seu e-mail:

```sql
-- ==============================================================================
-- BOOTSTRAP: PROMOVER USUÁRIO ESPECÍFICO PARA ADMINISTRADOR
-- (Execute no SQL Editor após realizar o primeiro signup)
-- ==============================================================================
UPDATE public.profiles
SET role = 'administrador',
    updated_at = timezone('utc'::text, now())
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = lower('seu-email@kkjekabson.com.br')
  LIMIT 1
);

-- Verificar se a promoção foi aplicada com sucesso:
SELECT id, nome, email, role, ativo
FROM public.profiles
WHERE lower(email) = lower('seu-email@kkjekabson.com.br');
```

Caso queira promover um usuário para `'gestor'`, basta executar:

```sql
-- Promover usuário para Gestor Comercial
UPDATE public.profiles
SET role = 'gestor',
    updated_at = timezone('utc'::text, now())
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = lower('gestor@kkjekabson.com.br')
  LIMIT 1
);
```

---

## 4. Estrutura de `health_data` (JSONB de Planos de Saúde)

A coluna `opportunities.health_data` armazena de forma estruturada e flexível todos os dados específicos de saúde, sem a necessidade de criar dezenas de colunas esparsas para outros produtos:

```json
{
  "possui_plano_atual": true,
  "operadora_atual": "Bradesco Saúde",
  "operadora_cotada": "Amil S750 / SulAmérica Especial 100",
  "cnpj": "12.345.678/0001-90",
  "razao_social": "Exemplo Serviços e Tecnologia Ltda",
  "qtd_vidas": 14,
  "idades": "0-18: 2, 19-23: 4, 24-28: 5, 29-33: 3",
  "cidade": "São Paulo",
  "estado": "SP",
  "valor_plano_atual": 18450.0,
  "tipo_contratacao": "PME Coparticipativo",
  "acomodacao": "Apartamento",
  "rede_desejada": "Hospital Sírio-Libanês, Albert Einstein e Laboratório Fleury",
  "objetivo": "Reduzir custo mantendo hospitais de ponta",
  "data_contratacao": "2021-04-10",
  "data_renovacao": "2025-04-10"
}
```

Esta abordagem foi indexada com **GIN (`idx_opp_health_data_gin`)**, permitindo consultas rápidas por qualquer campo interno via operador `@>` do PostgreSQL.

---

## 5. Variáveis de Ambiente Necessárias para a Aplicação Futura

Quando a aplicação for conectada diretamente ao Supabase na fase seguinte de migração da camada de dados (`src/services/`), configure no seu ambiente as seguintes variáveis:

### Variáveis Públicas do Frontend (Vite):

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **REGRAS ESTRITAS DE SEGURANÇA:**

1. **NUNCA** inclua a chave `service_role` (service key) no frontend (`src/` ou no bundle do Vite). Ela ignora totalmente as políticas de Row Level Security (RLS) e dá acesso de superusuário ao banco.
2. Apenas a `VITE_SUPABASE_ANON_KEY` deve ser disponibilizada ao navegador. Todas as permissões de acesso e restrições de vendedores são geridas pelas políticas RLS no PostgreSQL.
3. Caso sejam criadas Edge Functions ou automações de backend que exijam privilégios elevados (ex.: sincronização de faturas bancárias ou webhooks da Meta para WhatsApp), a chave `service_role` deve permanecer estritamente como **Secret de Servidor** no painel do Supabase (`Project Settings -> API -> service_role key`).

---

## 6. Como Validar e Testar o Row Level Security (RLS)

Para testar no **SQL Editor** como o Supabase e as políticas RLS se comportam para cada perfil, use a instrução `SET LOCAL ROLE` e `SET LOCAL "request.jwt.claims"` para simular a sessão de um usuário específico.

### Teste 1: Administrador Lendo o Financeiro Global

```sql
-- 1. Simular login de um Administrador
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_ADMIN", "role": "authenticated"}';

-- O Administrador deve conseguir ler contratos e financeiro consolidado
SELECT c.numero_contrato, c.valor_venda, f.faturamento_bruto, f.repasse_vendedor, f.resultado_kkj
FROM public.contracts c
JOIN public.contract_financials f ON f.contract_id = c.id;
-- Resultado esperado: Retorna todas as linhas com sucesso.
```

### Teste 2: Vendedor Tentando Acessar o Financeiro Sensível (DEVE FALHAR)

```sql
-- 2. Simular login de um Vendedor
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "UUID_DO_VENDEDOR", "role": "authenticated"}';

-- O Vendedor tenta ler a tabela de finanças
SELECT * FROM public.contract_financials;
-- Resultado esperado: Retorna 0 linhas (ou erro de permissão conforme o client). Nenhum dado vaza.

-- O Vendedor consulta oportunidades
SELECT id, titulo, owner_id FROM public.opportunities;
-- Resultado esperado: Retorna apenas oportunidades onde owner_id = UUID_DO_VENDEDOR.
```

### Teste 3: Tentativa de Alteração na Timeline (DEVE FALHAR)

```sql
-- Tentativa de alterar um evento na timeline
UPDATE public.opportunity_timeline
SET conteudo = 'Tentativa de adulteração de histórico'
WHERE id = 'UUID_QUALQUER';
-- Resultado esperado: Erro - "new row violates row-level security policy for table opportunity_timeline".
```

---

## 7. Dados de Produção e Demonstração

- A migration inclui **apenas dados de configuração estrutural** (seeds de produtos, etapas dos 2 funis, motivos de perda e tipos de tarefas).
- **NENHUM dado falso ou de demonstração** (como clientes fictícios, contatos inventados ou oportunidades de teste) foi inserido no Supabase. O banco estará limpo, seguro e pronto para receber a operação real da corretora.

---

## 8. Contato e Suporte

Em caso de dúvidas na execução do SQL ou configuração de novos produtos na KKJ Corretora, consulte a documentação técnica ou o time de engenharia responsável pela implantação.
