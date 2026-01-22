# Product Specification Document (PSD) - BarberApp

## 1. Visão Geral do Produto

O **BarberApp** é um sistema de gestão completo para barbearias, focado em alta performance visual e facilidade de uso via interface web. O sistema centraliza agendamentos, base de clientes, faturamento, planos de assinatura e controle financeiro de saídas.

## 2. Personas

- **Barbeiro/Administrador:** Responsável por gerenciar agendamentos, clientes, pagamentos e despesas da unidade.

## 3. Funcionalidades Principais

### 3.1. Dashboard de KPIs

- **Faturamento em Tempo Real:** Visualização de faturamento Diário, Mensal e Anual.
- **Integração de Dados:** Consumo de dados via Supabase e fallback/sync via Google Sheets.

### 3.2. Gestão de Agendamentos (Records)

- **CRUD de Agendamentos:** Registro de data, horário, cliente, serviço, valor e forma de pagamento.
- **Edição Visual Inline:** Edição rápida diretamente na tabela com salvamento automático ou via modal.
- **Ações de UI:** Autocomplete inteligente para clientes e procedimentos ao digitar.

### 3.3. Gestão de Clientes e Planos

- **Base de Clientes:** Cadastro completo com histórico de serviços.
- **Planos de Assinatura:**
  - Controle de "Plano Mensal", "Semestral" ou "Anual".
  - Lógica de renovação de ciclo (Reset de contagem de cortes).
  - Histórico de pagamentos de planos vinculado ao cliente.

### 3.4. Módulo Financeiro (Saídas e Cartões)

- **Controle de Despesas:** Registro de saídas com status "Pago" ou "Pendente".
- **Gestão de Cartões:** Cadastro de cartões de crédito (Banco, Titular, Vencimento, Fechamento).
- **Lógica de Parcelamento:** Identificação de parcelas e origem dos pagamentos.

## 4. Arquitetura Técnica

- **Frontend:** HTML5, CSS3 (Tailwind via CDN), Vanilla JavaScript.
- **Backend/Database:** Supabase (PostgreSQL) para persistência de dados.
- **Sincronização:** Motor híbrido que sincroniza tabelas do Supabase com planilhas Google (CSV/Macros).
- **Estado Global:** Objeto `state` centralizado no `index.js` atuando como Single Source of Truth.

## 5. Regras de Negócio Críticas

1. **Prioridade de Pagamento:** Ao criar um agendamento para um cliente com plano ativo, o sistema deve sugerir automaticamente o método de pagamento vinculado ao plano.
2. **Cálculo de Receita:** O faturamento total deve somar agendamentos realizados + pagamentos de planos de clientes.
3. **Validação de Datas:** Bloqueio de agendamentos em datas inválidas ou conflitos de horários conforme configuração.

## 6. Fluxos de Teste Sugeridos (Backend/Lógica)

- **Sincronização:** Validar se a função `syncFromSheet` popula corretamente o estado global.
- **Cálculo Financeiro:** Verificar se `updateInternalStats` reflete a soma correta de agendamentos e planos.
- **CRUD Clientes:** Testar a persistência de novos clientes e atualização de datas de início de plano.
