# Product Specification Document (PSD) - BarberApp

## 1. Visão Geral do Produto

O BarberApp é um sistema de gestão completo para barbearias, focado em alta performance visual e facilidade de uso via interface web. O sistema centraliza agendamentos, base de clientes, faturamento, planos de assinatura e controle financeiro de saídas.

## 2. Personas

- Barbeiro/Administrador: Responsável por gerenciar agendamentos, clientes, pagamentos e despesas da unidade.

## 3. Funcionalidades Principais

### 3.1. Dashboard de KPIs

- Faturamento em Tempo Real: Visualização de faturamento Diário, Mensal e Anual.
- Integração de Dados: Consumo de dados via Supabase e fallback/sync via Google Sheets.

### 3.2. Gestão de Agendamentos (Records)

- CRUD de Agendamentos: Registro de data, horário, cliente, serviço, valor e forma de pagamento.
- Edição Visual Inline: Edição rápida diretamente na tabela com salvamento automático ou via modal.
- Ações de UI: Autocomplete inteligente para clientes e procedimentos ao digitar.

### 3.3. Gestão de Clientes e Planos

- Base de Clientes: Cadastro completo com histórico de serviços.
- Planos de Assinatura: Controle de ciclos e renovação de contagem de cortes.

### 3.4. Módulo Financeiro (Saídas e Cartões)

- Controle de Despesas: Registro de saídas com status "Pago" ou "Pendente".
- Gestão de Cartões: Cadastro de cartões de crédito.

## 4. Arquitetura Técnica

- Frontend: HTML5, CSS3, Vanilla JavaScript.
- Backend/Database: Supabase (PostgreSQL).
- Sincronização: Motor híbrido (Supabase + Google Sheets).
