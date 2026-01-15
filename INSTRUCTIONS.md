# Registro de Instruções e Ajustes - BarberApp

Este documento registra as diretrizes de design, funcionalidades e comportamentos solicitados para o sistema.

## 📝 Histórico de Instruções

### 1. Gestão de Saídas (Financeiro)

- Redesenho da página de Saídas para um modelo gerencial focado em vencimentos e pagamentos.
- **Dashboard de Filtros:** Implementada barra de busca por descrição/cartão e filtro por status (Todos, Pagos, Pendentes) para localização rápida de lançamentos.
- **Nova Coluna "Cartão/Outro":** Adicionada antes da descrição, permitindo identificar a origem do pagamento com autocomplete inteligente dos cartões cadastrados.
- **Descrição Compacta:** A descrição agora é truncada por padrão para economizar espaço e expande automaticamente ao passar o mouse (hover) sobre a célula.
- **Status via Menu (Select):** O campo de status agora é um menu de seleção (Pendente/Pago), removendo a necessidade de uma coluna separada de checkmark.
- **Ações Expandidas:** Adicionado botão de edição (ícone de lápis) para abrir o modal completo da despesa, mantendo o botão de exclusão.
- Inclusão de campos: Cartão/Origem, Data da Compra, Valor Total, Parcela, Valor Parcela e Valor Pago.
- Visual simplificado com 7 colunas principais (Vencimento, Cartão/Outro, Descrição, Valor, Status, Pagamento e Ações).
- **Cartões de Crédito:** O nome do banco deve aparecer na parte superior do card, alinhado horizontalmente ao lado do ícone de cartão, para um visual mais moderno e equilibrado.

### 2. Comportamento de Edição Visual (Inline)

- Todas as células editáveis devem permitir edição rápida clicando diretamente nelas.
- **Regra de Foco:** Ao clicar em uma célula ou focar nela, o texto deve ser selecionado automaticamente.
- **Autocomplete com Enter:** Se houver sugestões de autocomplete visíveis (clientes, procedimentos ou cartões), pressionar `Enter` deve selecionar automaticamente a primeira opção da lista.

### 3. Responsividade e UI

- **Responsividade de Cards:** Todos os cards do sistema devem ser responsivos. Em telas muito pequenas, o conteúdo interno deve se organizar em uma grade ou coluna para evitar sobreposição ou corte de informações. Fontes e espaçamentos internos devem ser otimizados para leitura em dispositivos móveis.

### 4. Gestão de Cartões

- Campos: Nome do Cartão, Banco, Titular, Fechamento e Vencimento.
- Datas de fechamento e vencimento devem usar seletores de calendário (input type date) e ser opcionais (podem ser nulas).

---

_Este arquivo será atualizado a cada nova instrução aprovada._
