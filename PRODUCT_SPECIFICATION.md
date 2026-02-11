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

### 3.5. Suporte Offline e PWA

- **Instalabilidade:** Configuração de Manifesto PWA para instalação como aplicativo nativo (Windows/Android/iOS).
- **Service Worker:** Cache de recursos estáticos e bibliotecas externas para funcionamento offline total.
- **Persistência Local:** Sincronização automática entre Supabase e `localStorage` para garantir disponibilidade imediata dos dados mesmo sem conexão.

## 4. Arquitetura Técnica

- **Frontend:** HTML5, CSS3 (Tailwind via CDN), Vanilla JavaScript.
- **Backend/Database:** Supabase (PostgreSQL) para persistência de dados em nuvem.
- **Sincronização:** Motor híbrido que sincroniza tabelas do Supabase com planilhas Google (CSV/Macros).
- **Estado Global:** Objeto `state` centralizado gerenciando o Single Source of Truth.
- **PWA Engine:** Service Worker (v3) cuidando do cacheamento e `manifest.json` para identidade visual do app.
- **Offline First:** Estratégia de leitura prioritária do `localStorage` na inicialização, com reidratação via API.

## 5. UI/UX e Design System (Obsidian Glass)

1. **Estética Monocromática:** Uso estrito de pretos e cinzas profundos (`#09090B`, `#18181B`).
2. **Zero Borders:** Interfaces baseadas em elevação por sombras e variações de fundo, eliminando bordas sólidas.
3. **Glassmorphism:** Cards com desfoque de fundo (`backdrop-blur-xl`) e opacidade reduzida.
4. **Responsividade Mobile-First:**
   - Fontes dinâmicas e `whitespace-nowrap` em KPIs.
   - Padding inferior fixo (`pb-32`) para evitar sobreposição com barra de navegação mobile.
   - Layouts de tabela que se transformam em cards verticais em telas pequenas.

## 6. Regras de Negócio Críticas

1. **Prioridade de Pagamento:** Sugestão automática do plano contratado durante o agendamento.
2. **Cálculo de Receita:** Faturamento = Agendamentos + Planos - Despesas (quando filtrado por lucro).
3. **Sincronização de Estado:** Qualquer alteração via API deve ser imediatamente replicada no `localStorage`.

## 7. Fluxos de Teste Sugeridos

- **Sincronização:** Validar `syncFromSheet` e persistência no `localStorage`.
- **Cálculo Financeiro:** Verificar `updateInternalStats` com dados cacheados vs dados novos.
- **Resiliência Offline:** Testar carregamento e navegação do app sem conexão ativa.
- **CRUD:** Testar criação/edição e deleção com atualização reativa da UI.
