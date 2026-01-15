/**
 * BARBERAPP - SISTEMA DE GESTÃO PARA BARBEARIAS
 * Arquivo: index.js
 * Desenvolvido por Antigravity (Google DeepMind)
 */

// ==========================================
// 1. CONFIGURAÇÕES E CREDENCIAIS
// ==========================================
const SUPABASE_URL = 'https://wglnszbmwmddwefzqtln.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnbG5zemJtd21kZHdlZnpxdGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyODA0NDQsImV4cCI6MjA4Mzg1NjQ0NH0.9NHyJStWvF3nxx31y_f_I65MZEDXZlKLvY318EJb43w';

// ==========================================
// 2. ESTADO GLOBAL DA APLICAÇÃO (Single Source of Truth)
// ==========================================
const state = {
    currentPage: 'dashboard',
    isIntegrated: localStorage.getItem('isIntegrated') === 'true',
    syncStatus: 'idle', 
    searchTerm: '',
    sheetUrl: localStorage.getItem('sheetUrl') || SUPABASE_URL,
    isValidating: false,
    barbers: [], 
    records: [], 
    clients: [], // Nova base de clientes
    filters: {
        day: new Date().getDate(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    },
    kpis: {
        diario: 'R$ 0,00',
        mensal: 'R$ 0,00',
        anual: 'R$ 0,00'
    },
    charts: {},
    theme: {
        accent: localStorage.getItem('themeAccent') || '#F59E0B',
        accentRgb: localStorage.getItem('themeAccentRgb') || '245 158 11'
    },
    profitFilter: 'diario',
    editingRecord: null,
    editingClient: null,
    editingProcedure: null,
    clientView: 'clients', // 'clients' ou 'procedures'
    procedures: [],
    clientSearch: '',
    isClientDropdownOpen: false,
    showEmptySlots: true,
    managementSearch: '',
    isEditModalOpen: false,
    planSearchTerm: '',
    selectedClientId: null,
    paymentHistory: [], // Histórico de pagamentos de planos
    paymentsFetchedForClientId: null, // Controle de cache para evitar loops
    isAddPlanModalOpen: false, // Estado do modal de adicionar plano
    allPlanPayments: [], // Cache global de pagamentos de planos para dashboard
    expenses: [], // Nova base de saídas/contas a pagar
    cards: [], // Base de cartões de crédito
    editingExpense: null,
    isExpenseModalOpen: false,
    editingCard: null,
    isCardModalOpen: false,
    selectedCardId: null,
    expenseSearchTerm: '',
    expenseStatusFilter: 'TODOS',
    expenseSort: 'vencimento_asc',
    expensePeriodFilter: 'mensal'
};

// ==========================================
// 3. FUNÇÕES AUXILIARES (Helpers & UI)
// ==========================================


/**
 * Converte Hex para RGB para uso nas variáveis CSS
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '245 158 11';
}

/**
 * Aplica o tema atual no documento
 */
function applyTheme() {
    document.documentElement.style.setProperty('--accent-rgb', state.theme.accentRgb);
    localStorage.setItem('themeAccent', state.theme.accent);
    localStorage.setItem('themeAccentRgb', state.theme.accentRgb);
}

/**
 * Seleciona todo o texto de um elemento editável quando focado
 * Isso permite que ao digitar qualquer caractere, o valor antigo seja substituído
 */
window.selectAll = (el) => {
    // Pequeno delay para garantir que o navegador completou o foco
    setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }, 10);
};

// ==========================================
// 4. COMUNICAÇÃO COM API (Supabase & Google Sheets)
// ==========================================
/**
 * Busca clientes cadastrados no Supabase
 */
async function fetchClients() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=nome.asc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            }
        });
        if (res.ok) {
            state.clients = await res.json();
            render();
        }
    } catch (err) {
        console.error("Erro ao buscar clientes:", err);
    }
    // Carrega pagamentos de planos para a dashboard
    await fetchAllPlanPayments();
    updateInternalStats();
    render();
}

/**
 * Busca procedimentos cadastrados no Supabase
 */
async function fetchProcedures() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/procedimentos?select=*&order=nome.asc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            }
        });
        if (res.ok) {
            state.procedures = await res.json();
            render();
        }
    } catch (err) {
        console.error("Erro ao buscar procedimentos:", err);
    }
}

/**
 * Busca o histórico de pagamentos de planos de um cliente específico
 */
async function fetchPaymentHistory(clientId) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/pagamentos_planos?cliente_id=eq.${clientId}&select=*&order=data_pagamento.desc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            }
        });
        if (res.ok) {
            state.paymentHistory = await res.json();
            state.paymentsFetchedForClientId = clientId;
            
            // Lógica: Sincronizar início do plano com o primeiro pagamento
            if (state.paymentHistory.length > 0) {
                 const sortedAsc = [...state.paymentHistory].sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));
                 const firstPaymentDate = sortedAsc[0].data_pagamento;
                 
                 const client = state.clients.find(c => c.id == clientId);
                 if (client && client.plano_inicio !== firstPaymentDate) {
                     // Atualiza data silently
                     fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${clientId}`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': 'Bearer ' + SUPABASE_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ plano_inicio: firstPaymentDate })
                     }).then(r => {
                         if(r.ok) {
                             client.plano_inicio = firstPaymentDate;
                             // Opcional: render() se estivesse na view, mas fetchPaymentHistory roda antes do render ou paralelo
                         }
                     });
                 }
            }
        }
        // Atualiza cache global também
        if(typeof fetchAllPlanPayments === 'function') fetchAllPlanPayments();
    } catch (err) {
        console.error("Erro ao buscar histórico de pagamentos:", err);
        state.paymentHistory = [];
        state.paymentsFetchedForClientId = clientId; 
    }
}

async function fetchAllPlanPayments() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/pagamentos_planos?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY
            }
        });
        if (res.ok) {
            state.allPlanPayments = await res.json();
            updateInternalStats();
        }
    } catch (e) { console.error('Erro ao buscar todos pagamentos:', e); }
}

/**
 * Busca saídas/contas a pagar do Supabase
 */
async function fetchExpenses() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/saidas?select=*&order=vencimento.asc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
        if (res.ok) {
            state.expenses = await res.json();
            render();
        }
    } catch (err) {
        console.error('Erro ao buscar saídas:', err);
    }
}

/**
 * Busca cartões cadastrados no Supabase
 */
async function fetchCards() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cartoes?select=*&order=nome.asc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
        if (res.ok) {
            state.cards = await res.json();
            render();
        }
    } catch (err) {
        console.error('Erro ao buscar cartões:', err);
    }
}

window.renewPlan = async (clientId) => {
    if(!confirm('Deseja renovar o ciclo do plano para hoje? Isso resetará a contagem de cortes/dias.')) return;
    const today = new Date().toISOString().split('T')[0];
    // Atualiza apenas o início do plano para hoje, mantendo histórico de pagamentos intacto
    await window.updateClientPlan(clientId, { plano_inicio: today });
};

/**
 * Motor de Sincronização Híbrido (Multi-Sheet com Fallback)
 */
async function syncFromSheet(url) {
    if (!url) return false;
    
    try {
        state.syncStatus = 'syncing';
        const recordMap = new Map();

        // MÉTODO 3: SUPABASE (Real-time & Clean)
        if (url.includes('supabase.co')) {
            console.log("Iniciando Sincronização via Supabase...");
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos?select=*`, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_KEY
                    }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    console.log(`[Sync] Recebidos ${data.length} registros via Supabase.`);
                    
                    data.forEach(r => {
                        const key = r.id; // Usar ID como chave para evitar colisões e duplicatas
                        recordMap.set(key, {
                            id: r.id,
                            date: r.data,
                            time: r.horario,
                            client: r.cliente,
                            service: r.procedimento || 'A DEFINIR',
                            value: parseFloat(r.valor) || 0,
                            paymentMethod: r.forma_pagamento || 'N/A',
                            observations: r.observacoes || ''
                        });
                    });
                }
            } catch (err) {
                console.error("[Sync] Supabase erro:", err);
            }
        }

        // MÉTODO 2: APPS SCRIPT JSON (Fallback)
        else if (url.includes('/macros/s/')) {
            console.log("Iniciando Sincronização via Script Pro...");
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.error(`[Sync] Falha no Script: Status ${res.status}`);
                    return false;
                }
                const data = await res.json();
                
                // Se o script retornou um erro ou diagnóstico
                if (!Array.isArray(data)) {
                    if (data.erro) {
                        console.error("[Sync] Erro do Script:", data.erro, data.status_do_robo || "");
                        alert(`Atenção: ${data.erro}. O robô não encontrou dados formatados na sua planilha.`);
                    }
                    return false;
                }

                console.log(`[Sync] Recebidos ${data.length} registros via Script.`);
                data.forEach(r => {
                    if (!r.client || r.client.toLowerCase() === 'cliente') return;
                    
                    const rawVal = String(r.value || '0').replace(/[^\d,.-]/g, '').replace(',', '.');
                    const cleanVal = parseFloat(rawVal);
                    
                    const key = `${r.date}_${r.time}_${r.client}_${r.service}`.toLowerCase();
                    recordMap.set(key, {
                        date: r.date,
                        time: r.time,
                        client: r.client,
                        service: r.service || 'A DEFINIR',
                        value: isNaN(cleanVal) ? 0 : cleanVal,
                        paymentMethod: r.paymentMethod || 'N/A'
                    });
                });
            } catch (fetchErr) {
                console.error("[Sync] Erro ao buscar dados do Script:", fetchErr);
                return false;
            }
        } 
        // MÉTODO 1: CSV (Fallback)
        else {
            const idMatch = url.match(/[-\w]{25,}/);
            if (!idMatch) return false;
            const spreadsheetId = idMatch[0];

            const months = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            const processedHashes = new Set();

            const processSheetText = (text, monthIdx) => {
                const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
                if (lines.length < 2) return;

                // 1. Detector de Separador (Busca nas primeiras 100 linhas)
                let sep = ',';
                for (let i = 0; i < Math.min(lines.length, 100); i++) {
                    const l = lines[i].toLowerCase();
                    if (l.includes('cliente') || l.includes('horário')) {
                        sep = l.split(';').length > l.split(',').length ? ';' : ',';
                        break;
                    }
                }

                const parseCSVRow = (line, separator) => {
                    const parts = [];
                    let current = "";
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            if (inQuotes && line[i+1] === '"') {
                                current += '"'; i++;
                            } else { inQuotes = !inQuotes; }
                        } else if (char === separator && !inQuotes) {
                            parts.push(current.trim()); current = "";
                        } else { current += char; }
                    }
                    parts.push(current.trim());
                    return parts;
                };

                let mapping = null;
                let currentDay = 1;

                lines.forEach((line, lineIdx) => {
                    const cols = parseCSVRow(line, sep);
                    if (cols.length === 0) return;

                    const lineStr = line.replace(/[";]/g, ' ').trim();
                    const lineLower = lineStr.toLowerCase();

                    // 1. Detecção de Marcador de Dia (Ex: "Dia 01", "Dia 02_2", "Dia 2")
                    // Ajustado para ser mais agressivo e ignorar sufixos como _2
                    const dMatch = lineStr.match(/Dia\s*(\d+)/i);
                    if (dMatch && !lineStr.includes(':') && lineStr.length < 30) {
                        currentDay = parseInt(dMatch[1]);
                        mapping = null; 
                        return;
                    }

                    // 2. Detecção de Cabeçalho (Header)
                    if (lineLower.includes('horário') || lineLower.includes('cliente')) {
                        mapping = {};
                        cols.forEach((name, i) => {
                            const n = name.toLowerCase();
                            if (n.includes('horário')) mapping.time = i;
                            if (n.includes('cliente')) mapping.client = i;
                            if (n.includes('procedimento')) mapping.service = i;
                            if (n.includes('valor')) mapping.value = i;
                            if (n.includes('pagamento')) mapping.method = i;
                            if (n.includes('observ') || n.includes('anot')) mapping.obs = i;
                        });
                        return;
                    }

                    // 3. Extração e Limpeza de Dados
                    if (mapping && cols[mapping.client] && !lineLower.includes('cliente') && !lineLower.includes('total')) {
                        let valStr = String(cols[mapping.value] || '0').trim();
                        let rawVal = valStr.replace(/[^\d,.-]/g, '');
                        let cleanVal = 0;
                        
                        if (rawVal) {
                            if (rawVal.includes(',') && rawVal.includes('.')) {
                                cleanVal = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
                            } else if (rawVal.includes(',')) {
                                cleanVal = parseFloat(rawVal.replace(',', '.'));
                            } else {
                                cleanVal = parseFloat(rawVal);
                            }
                        }

                        const year = state.filters.year;
                        const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
                        const timeStr = (cols[mapping.time] || '00:00').substring(0, 5);
                        const clientName = cols[mapping.client];
                        const serviceName = cols[mapping.service] || 'A DEFINIR';

                        if (clientName && clientName.length > 1) {
                            const key = `${dateStr}_${timeStr}_${clientName}_${serviceName}`.toLowerCase();
                            if (!recordMap.has(key)) {
                                recordMap.set(key, {
                                    date: dateStr,
                                    time: timeStr,
                                    client: clientName,
                                    service: serviceName,
                                    value: isNaN(cleanVal) ? 0 : cleanVal,
                                    paymentMethod: cols[mapping.method] || 'N/A',
                                    observations: mapping.obs !== undefined ? cols[mapping.obs] : ''
                                });
                            }
                        }
                    }
                });
            };

            // 1. Obter planilha principal para referência (Aba Ativa)
            const mainRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`);
            const mainText = mainRes.ok ? await mainRes.text() : "";
            const mainHash = mainText.trim().substring(0, 500);

            // 2. Percorrer meses
            for (let i = 0; i < months.length; i++) {
                const name = months[i];
                const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
                try {
                    const res = await fetch(gvizUrl);
                    if (res.ok) {
                        const text = await res.text();
                        const hash = text.trim().substring(0, 500);
                        
                        // Se o Google devolveu o fallback da aba 1, ignoramos para não sujar outros meses
                        if (hash === mainHash && i !== 0 && mainHash !== "") continue;
                        
                        if (!processedHashes.has(hash)) {
                            console.log(`Lendo aba: ${name}`);
                            processSheetText(text, i);
                            processedHashes.add(hash);
                        }
                    }
                } catch (e) {}
            }

            // 3. Se nada foi carregado via abas específicas, usa a planilha principal no mês atual
            if (recordMap.size === 0 && mainText) {
                console.log("Usando aba principal para o mês atual...");
                processSheetText(mainText, new Date().getMonth());
            }
        }

        if (recordMap.size === 0) {
            console.log("[Sync] Aviso: Conexão estabelecida, mas nenhum dado encontrado.");
        }

        state.records = Array.from(recordMap.values()).sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
        state.isIntegrated = true;
        state.sheetUrl = url;
        
        localStorage.setItem('sheetUrl', url);
        localStorage.setItem('isIntegrated', 'true');

        updateInternalStats();
        state.syncStatus = 'idle';
        render();
        return true;
    } catch (err) {
        console.error('Erro crítico no Sync:', err);
        state.syncStatus = 'error';
        return false;
    }
}

function updateInternalStats() {
    // Removida a guarda de records.length para permitir mostrar faturamento só de planos se houver
    
    // Filtro baseado na seleção do usuário
    const targetDay = state.filters.day;
    const targetMonth = String(state.filters.month).padStart(2, '0');
    const targetYear = String(state.filters.year);
    const monthPrefix = `${targetYear}-${targetMonth}`;
    const dayPrefix = `${monthPrefix}-${String(targetDay).padStart(2, '0')}`;
    const displayDay = targetDay === 0 ? new Date().toISOString().split('T')[0] : dayPrefix;

    const calculateCombinedTotal = (datePredicate) => {
        const recTotal = (state.records || []).filter(r => datePredicate(r.date)).reduce((acc, r) => acc + (r.value || 0), 0);
        const planTotal = (state.allPlanPayments || []).filter(p => datePredicate(p.data_pagamento)).reduce((acc, p) => acc + parseFloat(p.valor || 0), 0);
        return recTotal + planTotal;
    };

    const daily = calculateCombinedTotal(d => d === displayDay);
    const monthly = calculateCombinedTotal(d => d.startsWith(monthPrefix));
    const annual = calculateCombinedTotal(d => d.startsWith(targetYear));
    
    state.kpis.diario = `R$ ${daily.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    state.kpis.mensal = `R$ ${monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    state.kpis.anual = `R$ ${annual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    
    state.barbers = [{ name: 'Faturamento Período', revenue: monthly, score: 100 }];
}

// ==========================================
// 5. ROTEAMENTO E NAVEGAÇÃO
// ==========================================

/**
 * Altera a página atual e re-renderiza a UI
 * @param {string} page - Nome da página (dashboard, records, manage, etc)
 */
function navigate(page, data = null) {
    if (page === 'manage') {
        window.openAddModal(data || '', `${state.filters.year}-${String(state.filters.month).padStart(2, '0')}-${String(state.filters.day).padStart(2, '0')}`);
        return;
    }
    if (page === 'expenses') {
        fetchExpenses();
        fetchCards();
    }
    if (page === 'cards') {
        fetchCards();
    }
    if (page === 'card-profile') {
        state.selectedCardId = data;
    }
    if (page === 'client-profile') {
        state.selectedClientId = data;
    }
    state.currentPage = page;
    state.clientSearch = ''; // Limpa a busca ao navegar
    state.isClientDropdownOpen = false;
    state.editingRecord = null;
    render();
}
// ==========================================
// 6. COMPONENTES DE INTERFACE (UI)
// ==========================================

const Sidebar = () => `
    <aside class="hidden md:flex w-64 bg-dark-900 border-r border-white/5 flex flex-col h-full transition-all duration-300">
        <div class="p-6 overflow-hidden">
            <h1 class="text-xl font-display font-extrabold text-amber-500 tracking-tighter italic whitespace-nowrap">
                LUCAS <span class="text-white"> DO CORTE</span>
            </h1>
        </div>
        <nav class="flex-1 px-4 space-y-2 mt-4">
            <!-- Itens do Menu Lateral -->
            ${NavLink('dashboard', 'fa-chart-line', 'Dashboard')}
            ${NavLink('records', 'fa-table', 'Agendamentos')}
            ${NavLink('clients', 'fa-sliders', 'Gestão')}
            ${NavLink('plans', 'fa-id-card', 'Planos')}
            ${NavLink('expenses', 'fa-arrow-trend-down', 'Saídas')}
            ${NavLink('cards', 'fa-credit-card', 'Cartões')}
            ${NavLink('setup', 'fa-gears', 'Configuração')}
        </nav>
        <div class="p-4 border-t border-white/5">
            <div class="flex items-center space-x-3 p-2 rounded-xl bg-dark-950/50">
                <div class="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-dark-900 shadow-lg shadow-black/20">
                    <img src="assets/logo.png" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=Lucas+do+Corte&background=F59E0B&color=000'">
                </div>
                <div class="flex-1 min-w-0">
                    <!-- Nome do Barbeiro/Perfil -->
                    <p class="text-sm font-semibold truncate text-white uppercase">Lucas do Corte</p>
                    <!-- Label de Status da Conta -->
                    <p class="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Premium Plan</p>
                </div>
            </div>
        </div>
    </aside>
`;

const NavLink = (page, icon, label) => {
    const isActive = state.currentPage === page;
    return `
        <button onclick="window.navigate('${page}')" 
                class="flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 group border border-transparent
                ${isActive ? 'bg-amber-500 text-dark-950 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}">
            <i class="fas ${icon} w-6 text-lg ${isActive ? '' : 'group-hover:text-amber-500'}"></i>
            <span class="ml-3 font-semibold">${label}</span>
        </button>
    `;
};

const MobileNav = () => `
    <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-dark-900/90 backdrop-blur-xl border-t border-white/5 px-6 py-3 flex justify-between items-center z-50">
        ${MobileNavLink('dashboard', 'fa-chart-line', 'Início')}
        ${MobileNavLink('records', 'fa-table', 'Lista')}
        ${MobileNavLink('clients', 'fa-sliders', 'Gestão')}
        ${MobileNavLink('plans', 'fa-id-card', 'Planos')}
        ${MobileNavLink('expenses', 'fa-arrow-trend-down', 'Saídas')}
        ${MobileNavLink('setup', 'fa-gears', 'Ajustes')}
    </nav>
`;

const MobileNavLink = (page, icon, label) => {
    const isActive = state.currentPage === page;
    return `
        <button onclick="window.navigate('${page}')" 
                class="flex flex-col items-center space-y-1 transition-all
                ${isActive ? 'text-amber-500' : 'text-slate-500'}">
            <i class="fas ${icon} text-lg"></i>
            <!-- Label do Menu Mobile -->
            <span class="text-[9px] font-black uppercase tracking-tighter">${label}</span>
        </button>
    `;
};

const Header = () => {
    window.updateFilter = (type, val) => {
        state.filters[type] = parseInt(val);
        updateInternalStats();
        render();
    };

    window.syncAll = async () => {
        const btn = document.getElementById('globalSyncBtn');
        if (btn) btn.classList.add('fa-spin');
        
        await Promise.all([
            syncFromSheet(state.sheetUrl),
            fetchClients(),
            fetchProcedures()
        ]);
        
        if (btn) btn.classList.remove('fa-spin');
    };

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const days = Array.from({length: 31}, (_, i) => i + 1);

    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('pt-BR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    }).format(today);

    return `
        <header class="h-14 md:h-14 border-b border-white/5 flex items-center justify-between px-3 md:px-8 bg-dark-950/80 backdrop-blur-xl sticky top-0 z-20">
            <div class="flex items-center space-x-1.5 md:space-x-4">
                <!-- Filtro de Dia -->
                <select onchange="window.updateFilter('day', this.value)" class="bg-dark-900 border border-white/10 text-[10px] md:text-xs font-bold rounded-lg px-2 md:px-3 py-1.5 outline-none focus:border-amber-500 w-20 md:w-auto">
                    ${days.map(d => {
                        const dayDate = new Date(state.filters.year, state.filters.month - 1, d);
                        const weekday = dayDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase().substring(0, 3);
                        return `<option value="${d}" ${state.filters.day === d ? 'selected' : ''}>${weekday} ${String(d).padStart(2, '0')}</option>`;
                    }).join('')}
                </select>
                <!-- Filtro de Mês -->
                <select onchange="window.updateFilter('month', this.value)" class="bg-dark-900 border border-white/10 text-[10px] md:text-xs font-bold rounded-lg px-1.5 md:px-3 py-1.5 outline-none focus:border-amber-500 w-16 md:w-auto">
                    ${months.map((m, i) => `<option value="${i+1}" ${state.filters.month === i+1 ? 'selected' : ''}>${m.substring(0, 3).toUpperCase()}</option>`).join('')}
                </select>
                <!-- Filtro de Ano -->
                <select onchange="window.updateFilter('year', this.value)" class="bg-dark-900 border border-white/10 text-[10px] md:text-xs font-bold rounded-lg px-1.5 md:px-3 py-1.5 outline-none focus:border-amber-500 w-14 md:w-auto">
                    <option value="2025" ${state.filters.year === 2025 ? 'selected' : ''}>'25</option>
                    <option value="2026" ${state.filters.year === 2026 ? 'selected' : ''}>'26</option>
                </select>
            </div>

            <div class="flex items-center space-x-2 md:space-x-4">
                <div class="hidden sm:flex items-center space-x-2 text-xs md:text-sm text-slate-400">
                    <i class="fas fa-calendar"></i>
                    <span class="font-medium">${formattedDate}</span>
                </div>
                
                <!-- Logo Mobile -->
                <div class="md:hidden flex items-center mr-2">
                    <h1 class="text-sm font-display font-black text-amber-500 italic tracking-tighter">BARBER</h1>
                </div>

                <button onclick="window.syncAll()" class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/5 hover:bg-amber-500/10 hover:text-amber-500 transition-all flex items-center justify-center border border-white/5 uppercase">
                    <i id="globalSyncBtn" class="fas fa-sync-alt text-xs md:text-sm"></i>
                </button>
            </div>
        </header>
    `;
};

const Dashboard = () => {
    if (!state.isIntegrated) {
        return `
            <div class="p-8 h-full flex items-center justify-center">
                <div class="text-center space-y-4">
                    <i class="fas fa-database text-6xl text-white/5 mb-4"></i>
                    <h2 class="text-2xl font-bold">Nenhum dado conectado</h2>
                    <button onclick="navigate('setup')" class="bg-amber-500 text-dark-950 px-6 py-2 rounded-xl font-bold border border-transparent transition-all">Configurar Agora</button>
                </div>
            </div>
        `;
    }

    window.renderCharts = () => {
        if (state.charts.profit) state.charts.profit.destroy();

        const targetDay = parseInt(state.filters.day);
        const targetMonth = String(state.filters.month).padStart(2, '0');
        const targetYear = String(state.filters.year);
        const monthPrefix = `${targetYear}-${targetMonth}`;
        const dayPrefix = `${monthPrefix}-${String(targetDay).padStart(2, '0')}`;

        // --- Gráfico de Lucro com Filtro Próprio ---
        let profitRecords = [];
        let groupKeyFn;
        let labelFn = (k) => k;

        if (state.profitFilter === 'diario') {
            profitRecords = state.records.filter(r => r.date === (targetDay === 0 ? new Date().toISOString().split('T')[0] : dayPrefix));
            groupKeyFn = (r) => r.time.split(':')[0] + ':00';
        } else if (state.profitFilter === 'semanal') {
            const targetDate = targetDay === 0 ? new Date() : new Date(state.filters.year, state.filters.month - 1, state.filters.day);
            const currentWeekDay = targetDate.getDay(); 
            const startOfWeek = new Date(targetDate);
            startOfWeek.setDate(targetDate.getDate() - currentWeekDay);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            
            const startStr = startOfWeek.toISOString().split('T')[0];
            const endStr = endOfWeek.toISOString().split('T')[0];

            profitRecords = state.records.filter(r => r.date >= startStr && r.date <= endStr);
            groupKeyFn = (r) => { 
                const parts = r.date.split('-');
                return new Date(parts[0], parts[1]-1, parts[2]).getDay(); 
            };
            const wDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            labelFn = (k) => wDays[parseInt(k)];
        } else if (state.profitFilter === 'mensal') {
            profitRecords = state.records.filter(r => r.date.startsWith(monthPrefix));
            groupKeyFn = (r) => r.date.split('-')[2];
            labelFn = (k) => `Dia ${k}`;
        } else { // anual (fallback do else que era total agora é anual ou deve ser vazio?)
            // Se total não existe mais, assumimos anual ou mensal default? O array map tem 'anual'.
            // Vamos cobrir 'anual' explicitamente e 'total' vira fallback ou removemos
            if (state.profitFilter === 'anual') {
                profitRecords = state.records.filter(r => r.date.startsWith(targetYear));
                groupKeyFn = (r) => r.date.split('-')[1];
                const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                labelFn = (k) => monthNames[parseInt(k) - 1];
            }
        }

        const profitStats = profitRecords.reduce((acc, r) => {
            const key = groupKeyFn(r);
            acc[key] = (acc[key] || 0) + r.value;
            return acc;
        }, {});

        // --- INCLUIR PAGAMENTOS DE PLANOS NO TOTAL ---
        const targetDateStr = (targetDay === 0 ? new Date().toISOString().split('T')[0] : dayPrefix);
        
        const relevantPlanPayments = (state.allPlanPayments || []).filter(p => {
             if (state.profitFilter === 'diario') return p.data_pagamento === targetDateStr;
             if (state.profitFilter === 'semanal') {
                 const targetDate = targetDay === 0 ? new Date() : new Date(state.filters.year, state.filters.month - 1, state.filters.day);
                 const currentWeekDay = targetDate.getDay(); 
                 const startOfWeek = new Date(targetDate);
                 startOfWeek.setDate(targetDate.getDate() - currentWeekDay);
                 startOfWeek.setHours(0,0,0,0);
                 const endOfWeek = new Date(startOfWeek);
                 endOfWeek.setDate(startOfWeek.getDate() + 6);
                 endOfWeek.setHours(23,59,59,999);
                 
                 const pDate = new Date(p.data_pagamento + 'T12:00:00'); // Safe mid-day
                 return pDate >= startOfWeek && pDate <= endOfWeek;
             }
             if (state.profitFilter === 'mensal') return p.data_pagamento.startsWith(monthPrefix);
             if (state.profitFilter === 'anual') return p.data_pagamento.startsWith(targetYear);
             return false;
        });
        
        relevantPlanPayments.forEach(p => {
             let key;
             if (state.profitFilter === 'diario') key = '12:00'; 
             else if (state.profitFilter === 'semanal') {
                 // Usa Data com Timezone local simulada para pegar dia correto
                 const parts = p.data_pagamento.split('-');
                 const d = new Date(parts[0], parts[1]-1, parts[2]);
                 key = d.getDay();
             }
             else if (state.profitFilter === 'mensal') key = p.data_pagamento.split('-')[2];
             else if (state.profitFilter === 'anual') key = p.data_pagamento.split('-')[1];
             else key = p.data_pagamento.split('-')[0];

             if(key !== undefined) profitStats[key] = (profitStats[key] || 0) + parseFloat(p.valor);
        });

        const sortedKeys = Object.keys(profitStats).sort();

        const ctx2 = document.getElementById('profitChart')?.getContext('2d');
        if (ctx2) {
            state.charts.profit = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: sortedKeys.map(labelFn),
                    datasets: [{
                        label: 'Faturamento R$',
                        data: sortedKeys.map(k => profitStats[k]),
                        borderColor: state.theme.accent,
                        backgroundColor: `rgba(${state.theme.accentRgb}, 0.1)`,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: state.theme.accent
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
                    }
                }
            });
        }
    };

    window.updateProfitFilter = (val) => {
        state.profitFilter = val;
        render();
    };

    setTimeout(() => window.renderCharts(), 0);

    return `
        <div class="px-4 pt-6 sm:px-6 sm:pt-6 lg:px-8 lg:pt-6 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex justify-between items-end">
                <div>
                    <!-- Título Principal Dashboard -->
                    <h2 class="text-2xl sm:text-3xl font-display font-bold">Lucas do Corte - BI</h2>
                    <!-- Subtítulo ou Descrição -->
                    <p class="text-slate-500 text-xs sm:text-sm mt-1">Gestão financeira e performance estratégica</p>
                </div>
                <!-- Botão SAÍDAS -->
                <button onclick="window.navigate('expenses')" 
                        class="bg-rose-500/10 text-rose-500 px-6 py-2.5 rounded-xl font-bold border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2 shadow-lg shadow-rose-500/5 group">
                    <i class="fas fa-arrow-trend-down group-hover:-translate-y-0.5 transition-transform"></i>
                    SAÍDAS
                </button>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                ${KPICard('Faturamento do Dia', state.kpis.diario, 'fa-calendar-day')}
                ${KPICard('Faturamento do Mês', state.kpis.mensal, 'fa-calendar-days')}
                ${KPICard('Faturamento do Ano', state.kpis.anual, 'fa-calendar-check')}
            </div>

            <!-- Chart -->
            <div class="grid grid-cols-1 gap-6 sm:gap-8 pb-8">
                <div class="glass-card p-6 sm:p-8 rounded-[2rem] h-[400px] sm:h-[450px] flex flex-col">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                        <h3 class="text-lg font-bold">Lucro Bruto</h3>
                        <div class="flex bg-dark-950 p-1 rounded-xl border border-white/5 space-x-1 overflow-x-auto max-w-full no-scrollbar">
                            ${['diario', 'semanal', 'mensal', 'anual'].map(f => `
                                <button onclick="window.updateProfitFilter('${f}')" 
                                        class="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all
                                        ${state.profitFilter === f ? 'bg-amber-500 text-dark-950 shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-white'}">
                                    ${f}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="flex-1 min-h-0"><canvas id="profitChart"></canvas></div>
                </div>
            </div>
        </div>
    `;
};

const KPICard = (title, value, icon) => `
    <div class="glass-card p-5 sm:p-7 rounded-[2rem] group hover:border-amber-500/30 transition-all duration-500 relative overflow-hidden">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all"></div>
        <div class="flex justify-between items-start mb-4 sm:mb-6">
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                <i class="fas ${icon} text-xl sm:text-2xl"></i>
            </div>
        </div>
        <p class="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest">${title}</p>
        <h2 class="text-2xl sm:text-4xl font-display font-extrabold mt-1 sm:mt-2 tracking-tight">${value}</h2>
    </div>
`;
// ==========================================
// 7. PÁGINAS DA APLICAÇÃO
// ==========================================

/**
 * PÁGINA: Histórico de Agendamentos (Tabela/Planilha)
 */
const RecordsPage = () => {
    if (!state.isIntegrated) {
        return `
            <div class="p-8 h-full flex items-center justify-center">
                <div class="text-center space-y-4">
                    <i class="fas fa-table text-6xl text-white/5 mb-4"></i>
                    <h2 class="text-2xl font-bold">Sem dados sincronizados</h2>
                    <button onclick="navigate('setup')" class="bg-amber-500 text-dark-950 px-6 py-2 rounded-xl font-bold border border-transparent transition-all">Conectar Planilha</button>
                </div>
            </div>
        `;
    }

    const targetDay = parseInt(state.filters.day);
    const targetMonth = String(state.filters.month).padStart(2, '0');
    const targetYear = String(state.filters.year);
    const monthPrefix = `${targetYear}-${targetMonth}`;
    const dayPrefix = `${monthPrefix}-${String(targetDay).padStart(2, '0')}`;

    // Lista de horários padrão para visualização em "planilha"
    const standardTimes = [];
    let currentMinutes = 7 * 60 + 20; // 07:20 em minutos
    const endMinutes = 22 * 60;       // 22:00 em minutos

    while (currentMinutes <= endMinutes) {
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        standardTimes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        currentMinutes += 40; // Intervalo de 40 minutos
    }

    let recordsToDisplay = [];
    
    if (targetDay === 0) {
        // Se for "Mês Inteiro", mostramos apenas o que existe (comportamento original)
        recordsToDisplay = state.records.filter(r => r.date.startsWith(monthPrefix))
            .filter(r => (r.client || '').toLowerCase().includes(state.searchTerm.toLowerCase()) || 
                         (r.service || '').toLowerCase().includes(state.searchTerm.toLowerCase()));
    } else {
        // Se for um dia específico, usamos a lógica de planilha
        const existingForDay = state.records.filter(r => r.date === dayPrefix);
        
        // Se houver busca, filtramos apenas os existentes
        if (state.searchTerm) {
            recordsToDisplay = existingForDay.filter(r => 
                (r.client || '').toLowerCase().includes(state.searchTerm.toLowerCase()) || 
                (r.service || '').toLowerCase().includes(state.searchTerm.toLowerCase())
            );
        } else {
            // Criamos um set de chaves para evitar duplicações
            // Chaves priorizadas: ID do banco > Data+Hora+Cliente (para novos)
            const displayedKeys = new Set();
            recordsToDisplay = [];

            // Primeiro, iteramos pelos horários padrão
            standardTimes.forEach(time => {
                // Filtramos os registros do banco que batem com esse horário (formato HH:mm)
                const matches = existingForDay.filter(r => r.time.startsWith(time.substring(0, 5)));
                
                if (matches.length > 0) {
                    matches.forEach(m => {
                        const key = m.id || `${m.date}_${m.time}_${m.client}`.toLowerCase();
                        if (!displayedKeys.has(key)) {
                            recordsToDisplay.push(m);
                            displayedKeys.add(key);
                        }
                    });
                } else {
                    // Se não há nada no banco para esse horário padrão, mostramos vazio
                    recordsToDisplay.push({ time, client: '---', service: 'A DEFINIR', value: 0, paymentMethod: 'PIX', isEmpty: true, date: dayPrefix });
                }
            });

            // Depois, adicionamos qualquer registro que sobrou (horários personalizados/fora do padrão)
            existingForDay.forEach(r => {
                const key = r.id || `${r.date}_${r.time}_${r.client}`.toLowerCase();
                if (!displayedKeys.has(key)) {
                    recordsToDisplay.push(r);
                    displayedKeys.add(key);
                }
            });

            // Ordena por horário final
            recordsToDisplay.sort((a, b) => a.time.localeCompare(b.time));

            // Filtro de Proximidade: Remove horários vazios se houver um real a menos de 20min
            const realAppointments = recordsToDisplay.filter(r => !r.isEmpty);
            recordsToDisplay = recordsToDisplay.filter(r => {
                if (!r.isEmpty) return true;
                
                const [h, m] = r.time.split(':').map(Number);
                const rMin = h * 60 + m;

                const tooClose = realAppointments.some(real => {
                    const [rh, rm] = real.time.split(':').map(Number);
                    const realMin = rh * 60 + rm;
                    const diff = Math.abs(rMin - realMin);
                    return diff >= 1 && diff <= 20; // 1-20 minutos de distância
                });

                return !tooClose;
            });

            // Filtra espaços vazios se o usuário desejar (após o filtro de proximidade)
            if (!state.showEmptySlots) {
                recordsToDisplay = recordsToDisplay.filter(r => !r.isEmpty);
            }
        }
    }

    return `
        <div class="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
             <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 class="text-2xl sm:text-3xl font-display font-bold">Histórico</h2>
                    <p class="text-slate-500 text-xs sm:text-sm mt-1">Sincronização Ativa</p>
                </div>
                <div class="relative w-full sm:w-auto flex flex-col sm:flex-row gap-2 items-center">
                    <button onclick="navigate('manage')" 
                            class="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 text-dark-950 hover:bg-amber-400 hover:scale-110 transition-all shadow-lg shadow-amber-500/50 shrink-0 border border-amber-400"
                            title="Novo Agendamento">
                        <i class="fas fa-plus text-lg"></i>
                    </button>
                    <button onclick="window.toggleEmptySlots()" 
                            class="flex items-center justify-center w-10 h-10 rounded-xl border border-white/5 bg-dark-900/50 hover:bg-white/10 transition-all shrink-0 ${state.showEmptySlots ? 'text-amber-500 border-amber-500/30' : 'text-slate-500 hover:text-white'}"
                            title="${state.showEmptySlots ? 'Ocultar Vazios' : 'Mostrar Vazios'}">
                        <i class="fas ${state.showEmptySlots ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <div class="relative flex-1 sm:w-80">
                        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                        <input type="text" 
                               id="recordsSearchInput"
                               placeholder="Buscar agendamento..." 
                               oninput="window.handleSearch(this)"
                               value="${state.searchTerm}"
                               class="bg-dark-900 border border-white/5 py-2.5 pl-11 pr-4 rounded-xl text-sm outline-none focus:border-amber-500/50 w-full transition-all font-medium">
                    </div>
                </div>
            </div>

            <!-- Tabela via Flexbox -->
            <div class="space-y-4 md:space-y-0 md:bg-dark-900/30 md:rounded-[2rem] border border-white/5">
                <!-- Header (Apenas Desktop) -->
                <div class="hidden md:flex bg-white/[0.02] border-b border-white/5 px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                    <div class="w-16 text-left">Horário</div>
                    <div class="flex-1 text-left px-4">Cliente</div>
                    <div class="flex-1 text-center px-4">Procedimentos</div>
                    <div class="flex-1 text-center px-4">Observações</div>
                    <div class="w-24">Valor</div>
                    <div class="w-28">Pagamento</div>
                    <div class="w-24 text-right">Ações</div>
                </div>

                <div id="tableBody" class="divide-y divide-white/5">
                    ${recordsToDisplay.map(r => RecordRow(r)).join('')}
                </div>
            </div>
        </div>
    `;
};

const EditModal = () => {
    const r = state.editingRecord;
    if (!r) return '';
    const isNew = !r.id;

    return `
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div class="glass-card w-[98%] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto custom-scroll rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-300">
                <div class="sticky top-0 z-10 p-4 sm:p-5 border-b border-white/5 flex justify-between items-center bg-dark-900/95 backdrop-blur-md">
                    <div class="flex items-center gap-3 sm:gap-4">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                            <i class="fas ${isNew ? 'fa-calendar-plus' : 'fa-edit'}"></i>
                        </div>
                        <div>
                            <h3 class="text-lg sm:text-xl font-bold">${isNew ? 'Novo Agendamento' : 'Editar Agendamento'}</h3>
                            <p class="text-[10px] text-slate-500 font-black uppercase tracking-widest truncate max-w-[150px] sm:max-w-none">${isNew ? 'Preencha os dados abaixo' : (r.client || r.cliente)}</p>
                        </div>
                    </div>
                    <button onclick="window.closeEditModal()" class="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all shrink-0">
                        <i class="fas fa-times text-slate-500"></i>
                    </button>
                </div>
                
                <form onsubmit="window.saveNewRecord(event)" class="p-4 sm:p-5 space-y-5">
                    <div class="space-y-1">
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Cliente</label>
                            <button type="button" onclick="window.setToBreak(true)" class="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-all">
                                <i class="fas fa-coffee mr-1"></i> Marcar como Pausa
                            </button>
                        </div>
                        <div class="relative">
                            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                            <input type="text" 
                                   id="clientSearchInputModal"
                                   placeholder="Digite o nome do cliente..."
                                   autocomplete="off"
                                   value="${state.clientSearch || ''}"
                                   onfocus="window.openClientDropdownModal()"
                                   oninput="window.filterClientsModal(this.value)"
                                   onkeydown="window.handleEnterSelection(event, 'clientDropdownModal')"
                                   class="w-full bg-dark-900 border border-white/5 py-3 pl-11 pr-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm">
                            
                            <input type="hidden" name="client" value="${state.clientSearch || ''}">

                            <div id="clientDropdownModal" class="hidden absolute z-[110] left-0 right-0 mt-2 bg-dark-900 border border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scroll p-2">
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Data</label>
                            <input type="date" name="date" required value="${r.date || r.data}"
                                   class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário</label>
                            <input type="time" name="time" required value="${r.time || r.horario}"
                                   class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm">
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Serviço</label>
                        <div class="relative">
                            <input type="text" 
                                   id="serviceSearchInputModal"
                                   placeholder="Digite o serviço..."
                                   autocomplete="off"
                                   value="${(r.service || r.procedimento) || ''}"
                                   onfocus="window.openProcedureDropdownModal()"
                                   oninput="window.filterProceduresModal(this.value)"
                                   onkeydown="window.handleEnterSelection(event, 'procedureDropdownModal')"
                                   class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm uppercase">
                            
                            <input type="hidden" name="service" value="${(r.service || r.procedimento) || ''}">

                            <div id="procedureDropdownModal" class="hidden absolute z-[110] left-0 right-0 mt-2 bg-dark-900 border border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scroll p-2">
                            </div>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Valor (R$)</label>
                        <input type="number" step="0.01" name="value" value="${r.value || r.valor || ''}"
                               class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm">
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Pagamento</label>
                        <select name="payment" required
                                class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm appearance-none">
                            ${['PIX', 'DINHEIRO', 'CARTÃO', 'PLANO MENSAL', 'CORTESIA'].map(p => `
                                <option value="${p}" ${(r.paymentMethod || r.forma_pagamento) === p ? 'selected' : ''}>${p}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Observações</label>
                        <textarea name="observations" rows="2" placeholder="Alguma observação importante?"
                                  class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-medium text-sm custom-scroll resize-none">${r.observations || r.observacoes || ''}</textarea>
                    </div>

                    <div class="pt-4">
                        <button type="submit" class="w-full bg-amber-500 text-dark-950 font-black py-4 rounded-xl border border-transparent shadow-lg shadow-amber-500/10 active:scale-95 uppercase tracking-widest text-xs transition-all">
                            ${isNew ? 'Salvar Agendamento' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

    window.viewProfileByName = (name) => {
        if (event) event.stopPropagation();
        if (!name) return;
        // Tenta encontrar match exato ou parcial insensível a case
        const client = state.clients.find(c => c.nome.trim().toLowerCase() === name.trim().toLowerCase());
        
        if (client) {
            navigate('client-profile', client.id);
        } else {
            // Fallback: Tenta encontrar nome similar se não achou exato
             const similar = state.clients.find(c => c.nome.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.nome.toLowerCase()));
             if (similar) {
                if(confirm(`Perfil exato não encontrado. Deseja ver o perfil de "${similar.nome}"?`)) {
                    navigate('client-profile', similar.id);
                }
             } else {
                alert('Perfil de cliente não encontrado na base de dados.');
             }
        }
    };

const RecordRow = (record) => {
    const isEmpty = !!record.isEmpty;
    const isBreak = record.client === 'PAUSA';
    const isDayZero = state.filters.day === 0;
    const id = record.id || 'new';
    const rowId = record.id ? `rec_${record.id}` : `new_${record.time.replace(/:/g, '')}`;

    return `
        <div class="flex flex-col md:flex-row items-center md:items-center px-6 md:px-8 py-4 md:py-4 gap-4 md:gap-0 hover:bg-white/[0.01] transition-colors group relative glass-card md:bg-transparent rounded-2xl md:rounded-none m-2 md:m-0 border md:border-0 border-white/5 ${isBreak ? 'bg-white/[0.02] border-white/10' : ''}" style="z-index: 1;">
            <div class="w-full md:w-16 text-xs md:text-sm text-amber-500 md:text-slate-400 font-black md:font-medium flex justify-between md:block">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Horário:</span>
                <input type="time" 
                     data-id="${id}" data-ui-id="${rowId}" data-field="time" data-time="${record.time}" data-date="${record.date}"
                     onblur="this.parentElement.parentElement.style.zIndex='1'; window.saveInlineEdit(this)"
                     onkeydown="window.handleInlineKey(event)"
                     onfocus="this.parentElement.parentElement.style.zIndex='100'; window.clearPlaceholder(this)"
                     value="${record.time.substring(0, 5)}"
                     class="bg-dark-900 border border-white/5 outline-none focus:border-amber-500/50 rounded px-1.5 py-0.5 w-full md:w-auto text-xs font-bold text-amber-500 md:text-white/80 transition-all">
            </div>
            
            <div class="w-full md:flex-1 md:px-4 text-sm md:text-sm font-bold md:font-semibold flex justify-between md:block relative">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Cliente:</span>
                <div contenteditable="true" 
                     data-id="${id}" data-ui-id="${rowId}" data-field="client" data-time="${record.time}" data-date="${record.date}"
                     onblur="this.parentElement.parentElement.style.zIndex='1'; window.saveInlineEdit(this)"
                     onkeydown="window.handleInlineKey(event)"
                     oninput="window.showInlineAutocomplete(this)"
                     onfocus="this.parentElement.parentElement.style.zIndex='100'; window.clearPlaceholder(this)"
                     class="truncate transition-all outline-none rounded px-1 focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50 ${isBreak ? 'text-slate-500 font-black' : (isEmpty ? 'text-slate-500 group-hover:text-amber-500 uppercase' : 'group-hover:text-amber-500 uppercase')}">
                    ${isBreak ? '<i class="fas fa-circle-minus mr-2"></i> PAUSA / BLOQUEIO' : (() => {
                        const isNew = state.clients.find(cli => cli.nome === record.client)?.novo_cliente;
                        return `<span>${record.client}</span>${isNew ? '<span class="ml-2 bg-amber-500/20 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Novo</span>' : ''}`;
                    })()}
                </div>
                ${!isEmpty && !isBreak ? `
                    <button onclick="window.viewProfileByName('${record.client.replace(/'/g, "\\'")}')" 
                            class="hidden md:flex absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-amber-500/50 hover:text-amber-500 transition-all z-[10]"
                            title="Ver Perfil">
                        <i class="fas fa-external-link-alt text-[10px]"></i>
                    </button>
                ` : ''}
                <!-- Dropdown Autocomplete Inline (Client) -->
                <div id="inlineAutocomplete_client_${rowId}" class="hidden absolute left-0 right-0 top-full mt-2 bg-dark-800 border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] max-h-48 overflow-y-auto p-1.5 z-[500] backdrop-blur-3xl lg:min-w-[200px]"></div>
            </div>

            <div class="w-full md:flex-1 md:px-4 text-xs md:text-sm flex justify-between md:block md:text-center relative">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Serviço:</span>
                <div contenteditable="true"
                     data-id="${id}" data-ui-id="${rowId}" data-field="service" data-time="${record.time}" data-date="${record.date}"
                     onblur="this.parentElement.parentElement.style.zIndex='1'; window.saveInlineEdit(this)"
                     onkeydown="window.handleInlineKey(event)"
                     oninput="window.showInlineAutocomplete(this)"
                     onfocus="this.parentElement.parentElement.style.zIndex='100'; window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50 ${isBreak ? 'text-slate-600 italic' : (isEmpty ? 'text-slate-500' : (record.service === 'A DEFINIR' ? 'text-red-500 font-black animate-pulse' : 'text-white font-medium'))} uppercase break-words md:truncate">
                    ${isBreak ? 'HORÁRIO RESERVADO' : record.service}
                </div>
                <!-- Dropdown Autocomplete Inline (Service) -->
                <div id="inlineAutocomplete_service_${rowId}" class="hidden absolute left-0 right-0 top-full mt-2 bg-dark-800 border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] max-h-48 overflow-y-auto p-1.5 z-[500] backdrop-blur-3xl lg:min-w-[200px]"></div>
            </div>

            <div class="w-full md:flex-1 md:px-4 text-[10px] md:text-xs flex justify-between md:block md:text-center relative group/obs">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Obs:</span>
                <div contenteditable="true"
                     data-id="${id}" data-ui-id="${rowId}" data-field="observations" data-time="${record.time}" data-date="${record.date}"
                     onblur="this.parentElement.parentElement.style.zIndex='1'; window.saveInlineEdit(this)"
                     onkeydown="window.handleInlineKey(event)"
                     onfocus="this.parentElement.parentElement.style.zIndex='100'; window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-white/5 focus:ring-1 focus:ring-white/20 text-slate-500 hover:text-slate-300 transition-all italic truncate focus:whitespace-normal focus:break-words max-w-[120px] md:max-w-[180px] mx-auto cursor-text"
                     title="${record.observations || ''}">
                    ${isBreak || isEmpty ? '---' : (record.observations || 'Nenhuma obs...')}
                </div>
            </div>

            <div class="w-full md:w-24 text-sm md:text-sm font-bold md:font-bold ${isBreak ? 'text-slate-600/50' : 'text-white md:text-amber-500/90'} flex justify-between md:block md:text-center relative">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Valor:</span>
                <div contenteditable="true"
                     data-id="${id}" data-ui-id="${rowId}" data-field="value" data-time="${record.time}" data-date="${record.date}"
                     onblur="this.parentElement.parentElement.style.zIndex='1'; window.saveInlineEdit(this)"
                     onkeydown="window.handleInlineKey(event)"
                     onfocus="this.parentElement.parentElement.style.zIndex='100'; window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50">
                    ${isEmpty || isBreak ? '---' : record.value.toFixed(2)}
                </div>
            </div>

            <div class="w-full md:w-28 flex justify-between md:justify-center items-center">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Pagamento:</span>
                ${isBreak ? `
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-black border-transparent bg-transparent text-slate-400 uppercase tracking-tighter text-center w-20">
                        N/A
                    </span>
                ` : `
                    <div class="relative ${isEmpty ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity' : ''}">
                        <select onchange="window.saveInlineEdit(this)" 
                                data-id="${id}" data-ui-id="${rowId}" data-field="payment"
                                class="appearance-none px-2 py-0.5 rounded-lg text-[10px] font-black border border-white/5 bg-white/[0.03] text-slate-500 uppercase tracking-tighter cursor-pointer focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all pr-4 text-center w-24">
                            ${['PIX', 'DINHEIRO', 'CARTÃO', 'PLANO MENSAL', 'CORTESIA'].map(p => `
                                <option value="${p}" ${record.paymentMethod === p ? 'selected' : ''} class="bg-dark-900">${p}</option>
                            `).join('')}
                        </select>
                        <i class="fas fa-chevron-down absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-slate-600 pointer-events-none"></i>
                    </div>
                `}
            </div>

            <div class="w-full md:w-24 flex justify-end gap-2 pt-4 md:pt-0 border-t md:border-0 border-white/5">
                ${!isEmpty ? `
                    <button onclick="window.editAppointment('${record.id}')" 
                            class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                    <button onclick="window.cancelAppointment('${record.id}')" 
                            class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center">
                        <i class="fas fa-trash-can text-xs"></i>
                    </button>
                ` : `
                    <button onclick="window.openAddModal('${record.time}', '${record.date}')" 
                            class="w-full md:w-auto px-4 py-2 md:py-1 rounded-lg bg-amber-500 text-dark-950 hover:bg-white hover:text-amber-600 text-[10px] font-black uppercase transition-all shadow-lg shadow-amber-500/10 active:scale-95 border border-transparent">
                        Agendar Horário
                    </button>
                `}
            </div>
        </div>
    `;
};

/**
 * PÁGINA: Gerenciar Agendamento (Novo ou Editar)
 */
const ManagePage = () => {
    if (!state.isIntegrated) return SetupPage();
    const isEditing = !!(state.editingRecord && (state.editingRecord.id || state.editingRecord.cliente));

    const today = new Date().toISOString().split('T')[0];
    const initialValues = {
        date: today,
        time: '',
        client: '',
        service: '',
        value: '',
        paymentMethod: 'PIX',
        ...(state.editingRecord || {})
    };

    return `
        <div class="p-4 sm:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="glass-card p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-white/5">
                <div class="flex items-center space-x-4 mb-8 sm:mb-10">
                    <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                        <i class="fas ${isEditing ? 'fa-edit' : 'fa-calendar-plus'} text-2xl sm:text-3xl"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl sm:text-4xl font-display font-black tracking-tight">${isEditing ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
                        <p class="text-slate-500 text-xs sm:text-sm font-medium">${isEditing ? 'Altere as informações abaixo' : 'Selecione um cliente para agendar'}</p>
                    </div>
                </div>

                <form onsubmit="window.saveNewRecord(event)" class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Data</label>
                        <input type="date" name="date" required value="${initialValues.date}"
                               class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold">
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Horário</label>
                        <input type="time" name="time" required value="${initialValues.time}"
                               class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold">
                    </div>

                    <div class="space-y-2 col-span-1 md:col-span-2">
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Cliente</label>
                            <button type="button" onclick="window.setToBreak(false)" class="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-all">
                                <i class="fas fa-coffee mr-1"></i> Marcar como Pausa do Barbeiro
                            </button>
                        </div>
                        <div class="relative">
                            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                            <input type="text" 
                                   id="clientSearchInput"
                                   placeholder="Digite para pesquisar..."
                                   autocomplete="off"
                                   required
                                   value="${state.clientSearch || ''}"
                                   onfocus="window.openClientDropdown()"
                                   oninput="window.filterClients(this.value)"
                                   onkeydown="window.handleEnterSelection(event, 'clientDropdown')"
                                   class="w-full bg-dark-900 border border-white/5 py-4 pl-12 pr-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold">
                            
                            <!-- Hidden input to store the final selected value for the form -->
                            <input type="hidden" name="client" value="${state.clientSearch || ''}">

                             <!-- Dropdown de Sugestões -->
                            <div id="clientDropdown" class="hidden absolute z-50 left-0 right-0 mt-2 bg-dark-900 border border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scroll p-2">
                                <!-- Conteúdo gerado via JS em filterClients ou openClientDropdown -->
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Serviço/Procedimento</label>
                        <div class="relative">
                            <input type="text" 
                                   id="serviceSearchInput"
                                   placeholder="Qual será o serviço?"
                                   autocomplete="off"
                                   value="${(initialValues.service || initialValues.procedimento) || ''}"
                                   onfocus="window.openProcedureDropdown()"
                                   oninput="window.filterProcedures(this.value)"
                                   onkeydown="window.handleEnterSelection(event, 'procedureDropdown')"
                                   class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold uppercase">
                            
                            <input type="hidden" name="service" value="${(initialValues.service || initialValues.procedimento) || ''}">

                            <div id="procedureDropdown" class="hidden absolute z-50 left-0 right-0 mt-2 bg-dark-900 border border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scroll p-2">
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Valor (R$)</label>
                        <input type="number" step="0.01" name="value" placeholder="0,00" value="${initialValues.value || initialValues.valor}"
                               class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold">
                    </div>

                    <div class="space-y-2 col-span-1 md:col-span-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Forma de Pagamento</label>
                        <div class="relative">
                            <select name="payment" required
                                    class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold appearance-none">
                                ${['PIX', 'DINHEIRO', 'CARTÃO', 'PLANO MENSAL', 'CORTESIA'].map(p => `
                                    <option value="${p}" ${(initialValues.paymentMethod || initialValues.forma_pagamento) === p ? 'selected' : ''}>${p}${p === 'CARTÃO' ? ' DE CRÉDITO/DÉBITO' : ''}</option>
                                `).join('')}
                            </select>
                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                        </div>
                    </div>

                    <div class="space-y-2 col-span-1 md:col-span-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Observações</label>
                        <textarea name="observations" rows="3" placeholder="Escreva aqui detalhes importantes sobre o atendimento..."
                                  class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-medium custom-scroll resize-none">${initialValues.observations || initialValues.observacoes || ''}</textarea>
                    </div>

                    <div class="col-span-1 md:col-span-2 pt-6">
                        <button type="submit" ${state.clients.length === 0 ? 'disabled' : ''}
                                class="w-full bg-amber-500 disabled:bg-white/5 disabled:text-white/20 text-dark-950 font-black py-5 rounded-2xl border border-transparent shadow-xl shadow-amber-500/20 transform hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-widest">
                            ${isEditing ? 'Salvar Alterações' : 'Salvar Agendamento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

/**
 * PÁGINA: Gestão Local (Clientes e Procedimentos)
 */
const ClientsPage = () => {
    // --- View Toggle ---
    window.switchClientView = (view) => {
        state.clientView = view;
        state.editingClient = null;
        state.editingProcedure = null;
        state.managementSearch = '';
        render();
    };

    window.handleManagementSearch = (val) => {
        state.managementSearch = val;
        render();
        // Restaurar foco
        setTimeout(() => {
            const input = document.getElementById('managementSearchInput');
            if (input) {
                input.focus();
                const len = input.value.length;
                input.setSelectionRange(len, len);
            }
        }, 50);
    };

    // --- Client Logic ---
    window.saveNewClient = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button[type="submit"]');
        const isEditing = !!(state.editingClient && state.editingClient.id);
        
        const clientData = {
            nome: formData.get('nome'),
            telefone: formData.get('telefone') || null,
            plano: formData.get('plano') || 'Nenhum',
            plano_inicio: formData.get('plano_inicio') || null,
            plano_pagamento: formData.get('plano_pagamento') || null,
            plano_pagamento: formData.get('plano_pagamento') || null,
            novo_cliente: formData.get('novo_cliente') === 'on',
            observacoes: formData.get('observacoes') || ''
        };

        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEditing ? 'Salvando...' : 'Cadastrando...'}`;

        try {
            const url = isEditing 
                ? `${SUPABASE_URL}/rest/v1/clientes?id=eq.${state.editingClient.id}`
                : `${SUPABASE_URL}/rest/v1/clientes`;
            
            const res = await fetch(url, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(clientData)
            });

            if (res.ok) {
                state.editingClient = null;
                e.target.reset();
                fetchClients();
            } else {
                const errorData = await res.json();
                if (errorData.code === '23505') alert('❌ ERRO: Este cliente já está cadastrado.');
                else alert('❌ Erro ao salvar: ' + (errorData.message || 'Falha no banco de dados.'));
            }
        } catch (err) {
            alert('❌ Erro de conexão.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente';
        }
    };

    window.editClient = (client) => {
        state.clientView = 'clients';
        state.editingClient = client;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.cancelEditClient = () => {
        state.editingClient = null;
        render();
    };

    window.deleteClient = async (id) => {
        if (!confirm('Deseja excluir este cliente? Isso não afetará os agendamentos já feitos.')) return;
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
            });
            fetchClients();
        } catch (err) { alert('Erro ao excluir cliente.'); }
    };

    // --- Procedure Logic ---
    window.saveProcedure = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button[type="submit"]');
        const isEditing = !!(state.editingProcedure && state.editingProcedure.id);
        
        const procedureData = {
            nome: formData.get('nome'),
            preco: parseFloat(formData.get('preco')) || 0
        };

        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEditing ? 'Salvando...' : 'Cadastrando...'}`;

        try {
            const url = isEditing 
                ? `${SUPABASE_URL}/rest/v1/procedimentos?id=eq.${state.editingProcedure.id}`
                : `${SUPABASE_URL}/rest/v1/procedimentos`;
            
            const res = await fetch(url, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(procedureData)
            });

            if (res.ok) {
                state.editingProcedure = null;
                e.target.reset();
                fetchProcedures();
            } else {
                alert('❌ Erro ao salvar procedimento.');
            }
        } catch (err) {
            alert('❌ Erro de conexão.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = isEditing ? 'Salvar Alterações' : 'Cadastrar Procedimento';
        }
    };

    window.editProcedure = (proc) => {
        state.clientView = 'procedures';
        state.editingProcedure = proc;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.cancelEditProcedure = () => {
        state.editingProcedure = null;
        render();
    };

    window.deleteProcedure = async (id) => {
        if (!confirm('Deseja excluir este procedimento?')) return;
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/procedimentos?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
            });
            fetchProcedures();
        } catch (err) { alert('Erro ao excluir procedimento.'); }
    };

    const isClients = state.clientView === 'clients';

    return `
        <div class="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-2xl sm:text-3xl font-display font-bold">Gestão Local</h2>
                    <p class="text-slate-500 text-xs sm:text-sm mt-1">Gerencie sua base de clientes e tabela de preços</p>
                </div>

                <!-- Toggle Switch -->
                <div class="flex bg-dark-900 border border-white/5 p-1 rounded-2xl w-full sm:w-auto">
                    <button onclick="window.switchClientView('clients')" 
                            class="flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isClients ? 'bg-amber-500 text-dark-950 shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-white'}">
                        Clientes
                    </button>
                    <button onclick="window.switchClientView('procedures')" 
                            class="flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!isClients ? 'bg-amber-500 text-dark-950 shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-white'}">
                        Procedimentos
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Cadastro / Edição -->
                <div class="lg:col-span-1">
                    <div class="glass-card p-8 rounded-[2rem] border border-white/5">
                        ${isClients ? `
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="text-lg font-bold text-amber-500 uppercase tracking-widest text-sm">
                                    ${state.editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                                </h3>
                                ${state.editingClient ? `
                                    <button onclick="window.cancelEditClient()" class="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest">
                                        Cancelar
                                    </button>
                                ` : ''}
                            </div>
                            <form onsubmit="window.saveNewClient(event)" class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Nome Completo</label>
                                    <input type="text" name="nome" required placeholder="Ex: Lucas Ferreira" 
                                           value="${state.editingClient?.nome || ''}"
                                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Telefone (Opcional)</label>
                                    <input type="text" name="telefone" placeholder="(00) 00000-0000"
                                           value="${state.editingClient?.telefone || ''}"
                                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Tipo de Plano</label>
                                    <select name="plano" onchange="document.getElementById('plan-dates-container').classList.toggle('hidden', this.value === 'Nenhum')"
                                            class="w-full bg-dark-900 border border-white/5 p-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold appearance-none">
                                        <option value="Nenhum" ${state.editingClient?.plano === 'Nenhum' ? 'selected' : ''}>Nenhum Plano</option>
                                        <option value="Mensal" ${state.editingClient?.plano === 'Mensal' ? 'selected' : ''}>Plano Mensal</option>
                                        <option value="Anual" ${state.editingClient?.plano === 'Anual' ? 'selected' : ''}>Plano Anual</option>
                                    </select>
                                </div>
                                <div id="plan-dates-container" class="grid grid-cols-2 gap-4 ${(!state.editingClient?.plano || state.editingClient?.plano === 'Nenhum') ? 'hidden' : ''}">
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Início do Plano</label>
                                        <input type="date" name="plano_inicio" 
                                               style="color-scheme: dark"
                                               value="${state.editingClient?.plano_inicio || ''}"
                                               class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold text-xs">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Último Pagamento</label>
                                        <input type="date" name="plano_pagamento" 
                                               style="color-scheme: dark"
                                               value="${state.editingClient?.plano_pagamento || ''}"
                                               class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold text-xs">
                                    </div>
                                </div>
                                
                                <!-- Toggle Novo Cliente -->
                                <div class="flex items-center gap-3 bg-dark-900 border border-white/5 p-4 rounded-xl mb-4">
                                    <div class="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                        <input type="checkbox" name="novo_cliente" id="novo_cliente_toggle" class="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-1 top-1 transition-transform checked:translate-x-5 checked:border-amber-500" ${state.editingClient?.novo_cliente ? 'checked' : ''}/>
                                        <label for="novo_cliente_toggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-slate-800 cursor-pointer border border-white/5"></label>
                                    </div>
                                    <label for="novo_cliente_toggle" class="text-xs font-bold text-white uppercase tracking-widest cursor-pointer">Marcar como Novo Cliente</label>
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Observações Geras</label>
                                    <textarea name="observacoes" rows="2" placeholder="Ex: Gosta de café, Alérgico a lâmina..."
                                              class="w-full bg-dark-900 border border-white/5 p-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-medium text-sm resize-none custom-scroll">${state.editingClient?.observacoes || ''}</textarea>
                                </div>

                                <!-- Botão Final de Cadastro -->
                                <button type="submit" class="w-full bg-amber-500 text-dark-950 font-black py-4 rounded-xl border border-transparent transition-all uppercase tracking-widest text-sm shadow-xl shadow-amber-500/10 active:scale-95">
                                    ${state.editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                                </button>
                            </form>
                        ` : `
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="text-lg font-bold text-amber-500 uppercase tracking-widest text-sm">
                                    ${state.editingProcedure ? 'Editar Serviço' : 'Novo Serviço'}
                                </h3>
                                ${state.editingProcedure ? `
                                    <button onclick="window.cancelEditProcedure()" class="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest">
                                        Cancelar
                                    </button>
                                ` : ''}
                            </div>
                            <form onsubmit="window.saveProcedure(event)" class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Nome do Serviço</label>
                                    <input type="text" name="nome" required placeholder="Ex: Corte Degradê" 
                                           value="${state.editingProcedure?.nome || ''}"
                                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Preço Sugerido (R$ - Opcional)</label>
                                    <input type="number" step="0.01" name="preco" placeholder="0,00"
                                           value="${state.editingProcedure?.preco || ''}"
                                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold">
                                </div>
                                <button type="submit" class="w-full bg-amber-500 text-dark-950 font-black py-4 rounded-xl hover:bg-amber-400 transition-all uppercase tracking-widest text-sm shadow-xl shadow-amber-500/10 active:scale-95">
                                    ${state.editingProcedure ? 'Salvar Alterações' : 'Adicionar Serviço'}
                                </button>
                            </form>
                        `}
                    </div>
                </div>

                <!-- Lista -->
                <div class="lg:col-span-2">
                    <div class="glass-card rounded-[2rem] overflow-hidden border border-white/5">
                        <div class="p-6 bg-white/[0.02] border-b border-white/5 space-y-4">
                            <div class="flex justify-between items-center">
                                <h3 class="font-bold flex items-center">
                                    <i class="fas ${isClients ? 'fa-users-viewfinder' : 'fa-list-check'} mr-3 text-amber-500"></i>
                                    ${isClients ? `Clientes Registrados (${state.clients.length})` : `Procedimentos Ativos (${state.procedures.length})`}
                                </h3>
                                <button onclick="${isClients ? 'fetchClients()' : 'fetchProcedures()'}" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-amber-500/10 hover:text-amber-500 transition-all flex items-center justify-center">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                            <div class="relative">
                                <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                                <input type="text" 
                                       id="managementSearchInput"
                                       placeholder="Pesquisar ${isClients ? 'cliente' : 'procedimento'}..." 
                                       oninput="window.handleManagementSearch(this.value)"
                                       value="${state.managementSearch}"
                                       class="w-full bg-dark-900 border border-white/5 py-3 pl-12 pr-4 rounded-xl text-sm outline-none focus:border-amber-500/50 transition-all font-medium">
                            </div>
                        </div>
                        
                        <div class="max-h-[600px] overflow-y-auto custom-scroll">
                            ${isClients ? `
                                <!-- Table Clients -->
                                <div class="hidden sm:block">
                                    <table class="w-full text-left">
                                        <thead class="bg-white/[0.01] text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <tr>
                                                <th class="px-8 py-4 border-b border-white/5">Nome</th>
                                                <th class="px-8 py-4 border-b border-white/5">Plano</th>
                                                <th class="px-8 py-4 border-b border-white/5">Telefone</th>
                                                <th class="px-8 py-4 border-b border-white/5">Observações</th>
                                                <th class="px-8 py-4 border-b border-white/5 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/5 text-sm">
                                            ${state.clients
                                                .filter(c => c.nome.toLowerCase().includes(state.managementSearch.toLowerCase()))
                                                .map(c => `
                                                <tr class="hover:bg-white/[0.01] transition-colors group">
                                                    <td class="px-8 py-4 font-bold text-white uppercase cursor-pointer hover:text-amber-500 transition-colors" onclick="navigate('client-profile', '${c.id}')">
                                                        ${c.nome} ${c.novo_cliente ? '<span class="ml-2 bg-amber-500/20 text-amber-500 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Novo</span>' : ''}
                                                    </td>
                                                    <td class="px-8 py-4">
                                                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                                                            ${c.plano === 'Mensal' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                                                              c.plano === 'Anual' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 
                                                              'text-slate-500 border border-white/5'}">
                                                            ${c.plano || 'Nenhum'}
                                                        </span>
                                                    </td>
                                                    <td class="px-8 py-4 text-slate-400 font-medium">${c.telefone || '---'}</td>
                                                    <td class="px-8 py-4 relative">
                                                        <div contenteditable="true"
                                                             onblur="window.saveClientInline('${c.id}', 'observacoes', this.innerText)"
                                                             onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                                             class="text-[10px] text-slate-500 italic outline-none hover:text-slate-300 transition-all truncate focus:whitespace-normal focus:break-words max-w-[150px] cursor-text">
                                                            ${c.observacoes || 'Sem obs...'}
                                                        </div>
                                                    </td>
                                                    <td class="px-8 py-4 text-right">
                                                        <div class="flex justify-end space-x-2">
                                                            <button onclick='window.editClient(${JSON.stringify(c)})' 
                                                                    class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-90">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                            <button onclick="window.deleteClient('${c.id}')" 
                                                                    class="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-90">
                                                                <i class="fas fa-trash-alt"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                <!-- Mobile Client Cards -->
                                <div class="sm:hidden divide-y divide-white/5">
                                    ${state.clients
                                        .filter(c => c.nome.toLowerCase().includes(state.managementSearch.toLowerCase()))
                                        .map(c => `
                                        <div class="p-6 space-y-4">
                                            <div class="flex justify-between items-start">
                                                <div onclick="navigate('client-profile', '${c.id}')" class="cursor-pointer group/name">
                                                    <p class="text-lg font-bold text-white uppercase group-hover/name:text-amber-500 transition-colors">${c.nome}</p>
                                                </div>
                                                <div class="flex space-x-2">
                                                    <button onclick='window.editClient(${JSON.stringify(c)})' class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><i class="fas fa-edit"></i></button>
                                                    <button onclick="window.deleteClient('${c.id}')" class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button>
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-4">
                                                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${c.plano === 'Mensal' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-500 border border-white/5'}">${c.plano || 'Nenhum'}</span>
                                                <span class="text-xs text-slate-500">${c.telefone || ''}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <!-- Table Procedures -->
                                <div class="hidden sm:block">
                                    <table class="w-full text-left">
                                        <thead class="bg-white/[0.01] text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <tr>
                                                <th class="px-8 py-4 border-b border-white/5">Serviço</th>
                                                <th class="px-8 py-4 border-b border-white/5">Preço Base</th>
                                                <th class="px-8 py-4 border-b border-white/5 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/5 text-sm">
                                            ${state.procedures
                                                .filter(p => p.nome.toLowerCase().includes(state.managementSearch.toLowerCase()))
                                                .map(p => `
                                                <tr class="hover:bg-white/[0.01] transition-colors group">
                                                    <td class="px-8 py-4 font-bold text-white uppercase">${p.nome}</td>
                                                    <td class="px-8 py-4 text-emerald-400 font-black">R$ ${p.preco.toFixed(2).replace('.', ',')}</td>
                                                    <td class="px-8 py-4 text-right">
                                                        <div class="flex justify-end space-x-2">
                                                            <button onclick='window.editProcedure(${JSON.stringify(p)})' 
                                                                    class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-90">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                            <button onclick="window.deleteProcedure('${p.id}')" 
                                                                    class="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-90">
                                                                <i class="fas fa-trash-alt"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                <!-- Mobile Procedure Cards -->
                                <div class="sm:hidden divide-y divide-white/5">
                                    ${state.procedures
                                        .filter(p => p.nome.toLowerCase().includes(state.managementSearch.toLowerCase()))
                                        .map(p => `
                                        <div class="p-6 flex justify-between items-center">
                                            <div>
                                                <p class="text-lg font-bold text-white uppercase">${p.nome}</p>
                                                <p class="text-emerald-400 font-black">R$ ${p.preco.toFixed(2).replace('.', ',')}</p>
                                            </div>
                                            <div class="flex space-x-2">
                                                <button onclick='window.editProcedure(${JSON.stringify(p)})' class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><i class="fas fa-edit"></i></button>
                                                <button onclick="window.deleteProcedure('${p.id}')" class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                            ${(isClients ? state.clients : state.procedures).filter(x => x.nome.toLowerCase().includes(state.managementSearch.toLowerCase())).length === 0 ? '<div class="p-20 text-center text-slate-500 font-bold italic">Nenhum registro encontrado.</div>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// Mover funções para fora para estabilidade
window.updateClientPlan = async (clientId, data) => {
    const payload = typeof data === 'string' ? { plano: data } : data;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${clientId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const client = state.clients.find(c => c.id == clientId);
            if (client) Object.assign(client, payload);
            render();
            fetchClients();
        } else {
            const errBody = await res.json().catch(() => ({}));
            console.error('Erro Supabase:', errBody);
            alert('Erro ao atualizar dados do plano. Verifique se a coluna "limite_cortes" existe no seu banco de dados.');
        }
    } catch (err) {
        console.error('Erro de conexão:', err);
        alert('Erro de conexão ao atualizar plano.');
    }
};

window.handlePlanSearch = (val) => {
    state.planSearchTerm = val;
    render();
    // Restaurar o foco imediatamente após o render
    setTimeout(() => {
        const input = document.getElementById('planSearchInput');
        if (input) {
            input.focus();
            const len = input.value.length;
            input.setSelectionRange(len, len);
        }
    }, 50);
};

window.renewPlan = async (clientId) => {
    const today = new Date().toISOString().split('T')[0];
    await window.updateClientPlan(clientId, { plano_inicio: today, plano_pagamento: today });
};

/**
 * PÁGINA: Gestão de Planos
 */
const PlansPage = () => {
    window.toggleAddPlanModal = (show) => {
        state.isAddPlanModalOpen = show;
        render();
    };

    window.saveNewPlanClient = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        const name = formData.get('nome');
        const existingClient = state.clients.find(c => c.nome.toLowerCase() === name.trim().toLowerCase());

        const payload = {
            nome: name,
            telefone: formData.get('telefone'),
            plano: formData.get('plano'),
            plano_inicio: formData.get('plano_inicio'),
            limite_cortes: parseInt(formData.get('limite_cortes')) || 4,
            observacoes: formData.get('observacoes') || ''
        };

        try {
            let url = `${SUPABASE_URL}/rest/v1/clientes`;
            let method = 'POST';
            
            if (existingClient) {
                url += `?id=eq.${existingClient.id}`;
                method = 'PATCH';
                // Preservar ID e dados antigos se necessário, mas neste fluxo estamos definindo o plano
                // Se o telefone estiver vazio no form e o cliente já tiver, podemos manter o antigo?
                // Vamos assumir que o form é a verdade, mas se vazio, usa o antigo
                if (!payload.telefone && existingClient.telefone) payload.telefone = existingClient.telefone;
            }

            const res = await fetch(url, {
                method: method,
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                state.isAddPlanModalOpen = false;
                fetchClients(); // Recarrega a lista
            } else {
                alert('Erro ao salvar dados do cliente.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro de conexão.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };

    window.filterPlanModalSuggestions = (val) => {
        const list = document.getElementById('plan-modal-suggestions');
        if (!list) return;
        
        if (!val) {
            list.classList.add('hidden');
            return;
        }
        
        const matches = state.clients
            .filter(c => c.nome.toLowerCase().includes(val.toLowerCase()))
            .slice(0, 5); // Limita a 5 sugestões
        
        if (matches.length === 0) {
            list.classList.add('hidden');
            return;
        }
        
        list.innerHTML = matches.map(c => `
            <div onclick="window.selectPlanModalClient('${c.nome}', '${c.telefone || ''}')" 
                 class="p-4 hover:bg-white/5 cursor-pointer transition-colors flex justify-between items-center group/item border-b border-white/5 last:border-0">
                <span class="font-bold text-white text-sm group-hover/item:text-amber-500 transition-colors">${c.nome}</span>
                <span class="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-1 rounded-lg">${c.telefone || 'Sem tel'}</span>
            </div>
        `).join('');
        list.classList.remove('hidden');
    };

    window.selectPlanModalClient = (nome, telefone) => {
        const form = document.querySelector('#plan-modal-form');
        if (form) {
            form.nome.value = nome;
            form.telefone.value = telefone;
        }
        document.getElementById('plan-modal-suggestions').classList.add('hidden');
    };

    const clientsWithPlans = state.clients.filter(c => c.plano && c.plano !== 'Nenhum');
    const filteredPlans = clientsWithPlans.filter(c => {
        if (!state.planSearchTerm) return true;
        const search = state.planSearchTerm.toLowerCase();
        const name = (c.nome || '').toLowerCase();
        const tel = (c.telefone || '').toLowerCase();
        return name.includes(search) || tel.includes(search);
    });

    return `
        <div class="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-2xl sm:text-3xl font-display font-bold">Planos</h2>
                    <p class="text-slate-500 text-xs sm:text-sm mt-1">Gestão de Assinaturas</p>
                </div>
                <div class="hidden sm:flex items-center gap-4">
                    <button onclick="window.toggleAddPlanModal(true)" class="bg-amber-500 text-dark-950 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-amber-500/20">
                        <i class="fas fa-plus mr-2"></i> Novo Plano
                    </button>
                    <div class="bg-amber-500/10 text-amber-500 px-4 py-2 rounded-2xl border border-amber-500/20 flex items-center gap-3">
                        <i class="fas fa-chart-pie"></i>
                        <span class="text-xs font-black uppercase tracking-widest">${clientsWithPlans.length} Clientes Ativos</span>
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 class="text-lg font-bold text-amber-500 uppercase tracking-widest text-sm flex items-center gap-2 ml-2">
                        <i class="fas fa-crown"></i> Assinantes Ativos
                    </h3>
                    <div class="relative w-full sm:w-80">
                        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                        <input type="text" 
                               id="planSearchInput"
                               placeholder="Filtrar assinantes..." 
                               oninput="window.handlePlanSearch(this.value)"
                               value="${state.planSearchTerm}"
                               class="w-full bg-dark-900 border border-white/5 py-2.5 pl-11 pr-4 rounded-xl text-xs outline-none focus:border-amber-500 transition-all font-medium">
                    </div>
                </div>
                
                <div class="hidden md:grid grid-cols-12 gap-4 px-8 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 bg-white/[0.01]">
                    <div class="col-span-2">Início Plan</div>
                    <div class="col-span-2">Ult. Pagamento</div>
                    <div class="col-span-2">Observações</div>
                    <div class="col-span-2">Status</div>
                    <div class="col-span-1 text-right pr-2">Ações</div>
+                </div>
                </div>

                <div class="bg-dark-900/30 rounded-b-[2rem] rounded-t-none border border-white/5 border-t-0 overflow-hidden min-h-[400px]">
                    ${filteredPlans.length === 0 ? `
                        <div class="h-[400px] flex flex-col items-center justify-center text-slate-500 space-y-4">
                            <i class="fas fa-user-slash text-4xl opacity-20"></i>
                            <p class="italic text-sm">Nenhum assinante encontrado para "${state.planSearchTerm}".</p>
                        </div>
                    ` : `
                        <div class="divide-y divide-white/5 max-h-[700px] overflow-y-auto custom-scroll">
                            ${filteredPlans.map(c => {
                                    const planStats = window.getClientPlanUsage(c.nome);

                                    return `
                                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-6 hover:bg-white/[0.02] transition-colors group plan-client-card" data-name="${c.nome}">
                                    <!-- Cliente Info (Col 3) -->
                                    <div class="md:col-span-3 flex items-center gap-3 cursor-pointer group/name" onclick="navigate('client-profile', '${c.id}')">
                                        <div class="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold shrink-0 group-hover/name:bg-amber-500 group-hover/name:text-dark-950 transition-all relative">
                                            ${c.nome.charAt(0)}
                                            ${c.novo_cliente ? `<div class="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-dark-900 animate-pulse"></div>` : ''}
                                        </div>
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2">
                                                <p class="font-bold text-white group-hover/name:text-amber-500 transition-colors truncate">${c.nome}</p>
                                                ${c.novo_cliente ? `<span class="bg-amber-500 text-dark-950 text-[8px] font-black px-1.5 rounded uppercase tracking-wider">Novo</span>` : ''}
                                            </div>
                                            <div class="flex items-center gap-2 text-[10px]">
                                                <p class="text-slate-500 font-bold uppercase tracking-widest truncate">${c.telefone || 'Sem telefone'}</p>
                                                ${planStats ? `
                                                    <span class="text-slate-600 hidden md:inline">•</span>
                                                    <span class="${planStats.usageCount >= (c.limite_cortes || 4) ? 'text-red-500' : 'text-emerald-500'} font-black hidden md:inline uppercase tracking-widest">${planStats.usageCount}/${c.limite_cortes || 4} CORTES</span>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Início Plano (Col 2) -->
                                    <div class="md:col-span-2">
                                        <input type="date" value="${c.plano_inicio || ''}" 
                                               onchange="window.updateClientPlan('${c.id}', { plano_inicio: this.value })"
                                               style="color-scheme: dark"
                                               class="w-full bg-dark-900 border border-white/5 text-[10px] font-bold rounded-2xl px-3 py-2.5 outline-none focus:border-amber-500/50 transition-all text-white cursor-pointer hover:bg-white/5">
                                    </div>

                                    <!-- Pagamento (Col 2) -->
                                    <div class="md:col-span-2">
                                        <input type="date" value="${c.plano_pagamento || ''}" 
                                               onchange="window.updateClientPlan('${c.id}', { plano_pagamento: this.value })"
                                               style="color-scheme: dark"
                                               class="w-full bg-dark-900 border border-white/5 text-[10px] font-bold rounded-2xl px-3 py-2.5 outline-none focus:border-amber-500/50 transition-all text-white cursor-pointer hover:bg-white/5">
                                    </div>

                                    <!-- Observações (Col 2) -->
                                    <div class="md:col-span-2 px-2">
                                        <div contenteditable="true"
                                             onblur="window.saveClientInline('${c.id}', 'observacoes', this.innerText)"
                                             onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                             class="text-[10px] text-slate-500 italic outline-none hover:text-slate-300 transition-all truncate focus:whitespace-normal focus:break-words max-w-[120px] mx-auto cursor-text text-center">
                                            ${c.observacoes || 'Sem obs...'}
                                        </div>
                                    </div>

                                    <!-- Status (Col 2) -->
                                    <div class="md:col-span-2">
                                        <select onchange="window.updateClientPlan('${c.id}', { plano: this.value })" 
                                                class="w-full bg-dark-950 border border-white/5 text-[10px] font-bold rounded-lg px-2 py-2 outline-none focus:border-amber-500 transition-all cursor-pointer appearance-none text-center hover:border-white/10 ${c.plano === 'Pausado' ? 'text-yellow-500' : 'text-white'}">
                                            <option value="Mensal" ${c.plano === 'Mensal' ? 'selected' : ''}>Mensal</option>
                                            <option value="Anual" ${c.plano === 'Anual' ? 'selected' : ''}>Anual</option>
                                            <option value="Pausado" ${c.plano === 'Pausado' ? 'selected' : ''}>Pausado</option>
                                        </select>
                                    </div>

                                    <!-- Actions (Col 1) -->
                                    <div class="md:col-span-1 flex justify-end gap-2">
                                        <button onclick="window.updateClientPlan('${c.id}', { plano: 'Pausado' })" 
                                                class="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-dark-950 transition-all flex items-center justify-center border border-yellow-500/20 active:scale-95 shadow-lg shadow-yellow-500/5"
                                                title="Pausar Plano">
                                            <i class="fas fa-pause text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            `;}).join('')}
                        </div>
                    `}
                </div>
            </div>

            <!-- Modal de Adicionar Novo Assinante -->
            ${state.isAddPlanModalOpen ? `
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div class="bg-dark-900 border border-white/10 rounded-[2rem] w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button onclick="window.toggleAddPlanModal(false)" class="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                        
                        <h3 class="text-2xl font-display font-bold text-white mb-2">Novo Assinante</h3>
                        <p class="text-slate-500 text-sm mb-6">Cadastre um novo cliente já com o plano ativo.</p>
                        
                        <form id="plan-modal-form" onsubmit="window.saveNewPlanClient(event)" class="space-y-4" autocomplete="off">
                            <div class="space-y-1 relative">
                                <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nome do Cliente</label>
                                <input type="text" name="nome" required placeholder="Digite para buscar..." 
                                       oninput="window.filterPlanModalSuggestions(this.value)"
                                       onfocus="window.filterPlanModalSuggestions(this.value)"
                                       class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-white">
                                
                                <!-- Lista de Sugestões Customizada -->
                                <div id="plan-modal-suggestions" class="hidden absolute left-0 right-0 top-full mt-2 bg-dark-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                </div>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Telefone / WhatsApp</label>
                                <input type="text" name="telefone" placeholder="(00) 00000-0000"
                                       class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-white">
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-1">
                                    <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Plano</label>
                                    <select name="plano" required
                                            class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-white cursor-pointer appearance-none">
                                        <option value="Mensal">Mensal</option>
                                        <option value="Anual">Anual</option>
                                    </select>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Início do Plano</label>
                                    <input type="date" name="plano_inicio" required 
                                           value="${new Date().toISOString().split('T')[0]}"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-white">
                                </div>
                                <div class="space-y-1 col-span-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Limite de Cortes no Ciclo</label>
                                    <div class="relative">
                                        <input type="number" name="limite_cortes" value="4" min="1" max="99"
                                               class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-white pl-10">
                                        <i class="fas fa-scissors absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs"></i>
                                    </div>
                                </div>
                                <div class="space-y-1 col-span-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Observações</label>
                                    <textarea name="observacoes" rows="2" placeholder="Notas sobre o assinante..."
                                              class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-medium text-xs resize-none"></textarea>
                                </div>
                            </div>
                            
                            <div class="pt-4">
                                <button type="submit" class="w-full bg-amber-500 text-dark-950 font-black py-4 rounded-xl hover:shadow-lg hover:shadow-amber-500/20 transition-all uppercase tracking-widest text-xs">
                                    Cadastrar Assinante
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
};

/**
 * PÁGINA: Perfil Detalhado do Cliente
 */
const ClientProfilePage = () => {
    const client = state.clients.find(c => c.id == state.selectedClientId);
    if (!client) {
        return `
            <div class="p-8 h-full flex flex-col items-center justify-center text-center space-y-4">
                <i class="fas fa-user-slash text-6xl text-white/5"></i>
                <h2 class="text-2xl font-bold text-slate-400">Cliente não encontrado</h2>
                <button onclick="navigate('plans')" class="bg-amber-500 text-dark-950 px-6 py-2 rounded-xl font-bold">Voltar aos Planos</button>
            </div>
        `;
    }

    // Carregar histórico de pagamentos ao abrir o perfil (apenas uma vez)
    // Agora verifica se JÁ buscou para este cliente específico, independente se voltou vazio ou não
    if (state.paymentsFetchedForClientId !== client.id) {
        fetchPaymentHistory(client.id).then(() => render());
        return `
            <div class="p-8 h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
                <div class="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                <p class="text-slate-400 font-bold animate-pulse">Carregando perfil...</p>
            </div>
        `;
    }

    // Função para salvar edição inline do cliente
    window.saveClientEdit = async (field, value) => {
        try {
            const updateData = { [field]: value };
            const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${client.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(updateData)
            });
            if (res.ok) {
                Object.assign(client, updateData);
                fetchClients();
            } else {
                alert('Erro ao atualizar cliente.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Função para adicionar novo pagamento
    window.addPayment = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button[type="submit"]');
        
        // Arredondamento seguro para 2 casas
        const rawValor = parseFloat(formData.get('valor'));
        const valorFinal = rawValor ? Math.round(rawValor * 100) / 100 : 0;

        const paymentData = {
            cliente_id: client.id,
            data_pagamento: formData.get('data_pagamento'),
            valor: valorFinal,
            tipo_plano: formData.get('tipo_plano'),
            forma_pagamento: formData.get('forma_pagamento'),
            observacao: formData.get('observacao') || null
        };

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/pagamentos_planos`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(paymentData)
            });

            if (res.ok) {
                e.target.reset();
                fetchPaymentHistory(client.id);
                // Atualizar o último pagamento e resetar o início do plano (contador de cortes)
                await window.updateClientPlan(client.id, { 
                    plano_pagamento: paymentData.data_pagamento,
                    plano_inicio: paymentData.data_pagamento 
                });
            } else {
                alert('Erro ao registrar pagamento.');
            }
        } catch (err) {
            alert('Erro de conexão.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Registrar Pagamento';
        }
    };

    window.deletePayment = async (e, paymentId) => {
        if(e) e.stopPropagation();
        
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/pagamentos_planos?id=eq.${paymentId}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
            });
            
            // Atualiza estado local imediatamente
            state.paymentHistory = state.paymentHistory.filter(p => p.id !== paymentId);
            
            // Verifica se ficou vazio e limpa datas do cliente
            if (state.paymentHistory.length === 0) {
                 await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${client.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ plano_inicio: null, plano_pagamento: null })
                 });
                 client.plano_inicio = null;
                 client.plano_pagamento = null;
            } else {
                // Se ainda tem pagamentos, re-sincroniza o início com o mais antigo restante
                const sortedAsc = [...state.paymentHistory].sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));
                const firstPayment = sortedAsc[0].data_pagamento;
                if (client.plano_inicio !== firstPayment) {
                     await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${client.id}`, {
                        method: 'PATCH',
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plano_inicio: firstPayment })
                     });
                     client.plano_inicio = firstPayment;
                }
            }
            
            render();
            fetchPaymentHistory(client.id); // Sincroniza background para garantir
        } catch (err) { alert('Erro ao excluir pagamento.'); }
    };

    // Filtrar agendamentos desse cliente
    const clientRecords = state.records.filter(r => 
        (r.client || '').toLowerCase() === (client.nome || '').toLowerCase()
    ).sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));

    // Filtra apenas agendamentos passados ou de hoje para estatísticas
    const today = new Date().toISOString().split('T')[0];
    const pastRecords = clientRecords.filter(r => r.date <= today);
    
    // Calcula total investido: Agendamentos + Planos
    const totalAppointmentsSpent = pastRecords.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);
    const totalPlansSpent = (state.paymentHistory || []).reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    const totalSpent = totalAppointmentsSpent + totalPlansSpent;
    
    const lastVisit = pastRecords.length > 0 ? pastRecords[0].date : 'Nunca';
    
    // Pega a data mais recente do histórico de pagamentos para exibição precisa
    const displayLastPaymentDate = state.paymentHistory.length > 0 
        ? state.paymentHistory[0].data_pagamento 
        : client.plano_pagamento;

    return `
        <div class="p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <!-- Header do Perfil -->
            <div class="flex flex-col md:flex-row items-center md:items-start gap-8">
                <div class="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] bg-amber-500/10 flex items-center justify-center text-amber-500 text-3xl md:text-5xl font-black border-2 border-amber-500/20 shadow-2xl shadow-amber-500/5">
                    ${(client.nome || '?').charAt(0)}
                </div>
                <div class="flex-1 text-center md:text-left space-y-4">
                    <div>
                        <div class="flex flex-wrap justify-center md:justify-start items-center gap-3">
                            <input type="text" 
                                   value="${client.nome}" 
                                   onblur="window.saveClientEdit('nome', this.value)"
                                   class="text-3xl md:text-4xl font-display font-black text-white bg-transparent border-b-2 border-transparent hover:border-amber-500/30 focus:border-amber-500 outline-none transition-all px-2 -mx-2">
                            ${client.plano !== 'Nenhum' ? `
                                <span class="px-3 py-1 bg-amber-500 text-dark-950 text-[10px] font-black uppercase rounded-lg shadow-lg shadow-amber-500/20">
                                    CLIENTE PREMIUM
                                </span>
                            ` : ''}
                        </div>
                        <div class="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1 flex items-center justify-center md:justify-start gap-2">
                            <i class="fas fa-phone"></i>
                            <input type="text" 
                                   value="${client.telefone || ''}" 
                                   placeholder="Adicionar telefone"
                                   onblur="window.saveClientEdit('telefone', this.value)"
                                   class="bg-transparent border-b border-transparent hover:border-amber-500/30 focus:border-amber-500 outline-none transition-all px-1">
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                        <button onclick="navigate('plans')" class="px-6 py-2 bg-dark-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5 uppercase tracking-widest">
                            <i class="fas fa-arrow-left mr-2"></i> Voltar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Dados do Plano (se houver) -->
            ${client.plano !== 'Nenhum' ? `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="glass-card p-6 rounded-[2rem] border border-amber-500/10 relative overflow-hidden group">
                        <div class="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/5 rounded-full blur-xl"></div>
                        <p class="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">Tipo de Plano</p>
                        <h4 class="text-2xl font-black text-white">${client.plano}</h4>
                    </div>
                    <div class="glass-card p-6 rounded-[2rem] border border-white/5">
                        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Início da Assinatura</p>
                        <h4 class="text-2xl font-black text-white">${client.plano_inicio ? new Date(client.plano_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '---'}</h4>
                    </div>
                    <div class="glass-card p-6 rounded-[2rem] border border-white/5">
                        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Último Pagamento</p>
                        <h4 class="text-2xl font-black text-white">${displayLastPaymentDate ? new Date(displayLastPaymentDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não registrado'}</h4>
                    </div>
                </div>
            ` : ''}

            <!-- KPIs do Cliente -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div class="bg-dark-900/50 p-6 rounded-[2rem] border border-white/5">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Investido</p>
                    <h3 class="text-2xl md:text-3xl font-display font-black text-amber-500">R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div class="bg-dark-900/50 p-6 rounded-[2rem] border border-white/5">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Visitas Realizadas</p>
                    <h3 class="text-2xl md:text-3xl font-display font-black text-white">${pastRecords.length}</h3>
                </div>
                <div class="bg-dark-900/50 p-6 rounded-[2rem] border border-white/5">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ticket Médio</p>
                    <h3 class="text-2xl md:text-3xl font-display font-black text-white">R$ ${(pastRecords.length ? totalSpent / pastRecords.length : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div class="bg-dark-900/50 p-6 rounded-[2rem] border border-white/5">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Última Visita</p>
                    <h3 class="text-2xl md:text-3xl font-display font-black text-white">${lastVisit !== 'Nunca' ? new Date(lastVisit + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem registros'}</h3>
                </div>
            </div>

            <!-- Histórico de Pagamentos (apenas para clientes com plano) -->
            ${client.plano !== 'Nenhum' ? `
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Formulário para Novo Pagamento -->
                    <div class="lg:col-span-1">
                        <div class="glass-card p-6 rounded-[2rem] border border-white/5">
                            <h3 class="text-lg font-bold text-amber-500 uppercase tracking-widest text-sm mb-6">Registrar Pagamento</h3>
                            <form onsubmit="window.addPayment(event)" class="space-y-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Data do Pagamento</label>
                                    <input type="date" name="data_pagamento" required 
                                           style="color-scheme: dark"
                                           value="${new Date().toISOString().split('T')[0]}"
                                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold text-xs">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Valor Pago</label>
                                    <input type="number" name="valor" required step="0.01" min="0" placeholder="0.00"
                                           class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Tipo de Plano</label>
                                    <select name="tipo_plano" required
                                            class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold appearance-none">
                                        <option value="Mensal" ${client.plano === 'Mensal' ? 'selected' : ''}>Mensal</option>
                                        <option value="Anual" ${client.plano === 'Anual' ? 'selected' : ''}>Anual</option>
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Forma de Pagamento</label>
                                    <select name="forma_pagamento" required
                                            class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold appearance-none">
                                        <option value="Pix">Pix</option>
                                        <option value="Dinheiro">Dinheiro</option>
                                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                                        <option value="Cartão de Débito">Cartão de Débito</option>
                                    </select>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Observação (Opcional)</label>
                                    <textarea name="observacao" rows="2" placeholder="Ex: Pagamento referente ao mês de Janeiro"
                                              class="w-full bg-dark-900 border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500/50 transition-all font-medium text-sm resize-none"></textarea>
                                </div>
                                <button type="submit" class="w-full bg-amber-500 text-dark-950 font-black py-3 rounded-xl transition-all uppercase tracking-widest text-xs shadow-xl shadow-amber-500/10 active:scale-95">
                                    Registrar Pagamento
                                </button>
                            </form>
                        </div>
                    </div>

                    <!-- Lista de Pagamentos -->
                    <div class="lg:col-span-2 space-y-4">
                        <h3 class="text-lg font-bold text-white uppercase tracking-widest text-sm ml-2">Histórico de Pagamentos</h3>
                        <div class="bg-dark-900/30 rounded-[2rem] border border-white/5 overflow-hidden">
                            ${state.paymentHistory.length === 0 ? `
                                <div class="p-12 text-center text-slate-500 italic">Nenhum pagamento registrado ainda.</div>
                            ` : `
                                <div class="divide-y divide-white/5">
                                    ${state.paymentHistory.map(p => `
                                        <div class="px-8 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                                            <div class="flex items-center gap-6">
                                                <div class="text-amber-500 font-black text-sm w-28">${new Date(p.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                                                <div>
                                                    <p class="text-white font-bold text-sm uppercase">${p.tipo_plano} • <span class="text-amber-500">${p.forma_pagamento || '-'}</span></p>
                                                    ${p.observacao ? `<p class="text-[10px] text-slate-500 font-medium mt-1">${p.observacao}</p>` : ''}
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-4">
                                                <div class="text-lg font-black text-emerald-400">R$ ${parseFloat(p.valor).toFixed(2)}</div>
                                                <button onclick="window.deletePayment(event, '${p.id}')" 
                                                        class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                                                        title="Excluir Pagamento">
                                                    <i class="fas fa-trash-can text-xs"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Histórico de Serviços -->
            <div class="space-y-4">
                <h3 class="text-lg font-bold text-white uppercase tracking-widest text-sm ml-2">Histórico de Visitas</h3>
                <div class="bg-dark-900/30 rounded-[2rem] border border-white/5 overflow-hidden">
                    ${clientRecords.length === 0 ? `
                        <div class="p-12 text-center text-slate-500 italic">Este cliente ainda não possui agendamentos registrados.</div>
                    ` : `
                        <div class="divide-y divide-white/5 overflow-x-auto">
                            ${clientRecords.map(r => {
                                const id = r.id;
                                const rowId = `hist_${r.id}`;
                                return `
                                 <div class="px-8 py-5 flex flex-col md:flex-row items-center md:items-start justify-between hover:bg-white/[0.02] min-w-[600px] gap-6 group relative" style="z-index: 1;">
                                    <div class="flex items-start gap-6 flex-1 h-full">
                                        <!-- Data (Fixado) -->
                                        <div class="flex flex-col w-28 shrink-0">
                                            <div class="flex items-center gap-1.5 text-slate-500 mb-1">
                                                <i class="far fa-calendar-alt text-[10px]"></i>
                                                <span class="text-[10px] font-black uppercase tracking-tighter">Data</span>
                                            </div>
                                            <input type="date" 
                                                   data-id="${id}" data-ui-id="${rowId}" data-field="date"
                                                   value="${r.date}"
                                                   onchange="window.saveInlineEdit(this)"
                                                   style="color-scheme: dark"
                                                   class="bg-transparent border-none text-[12px] font-bold text-amber-500 outline-none cursor-pointer hover:bg-white/5 rounded px-1 transition-all">
                                        </div>

                                        <!-- Serviço e Detalhes -->
                                        <div class="flex flex-col w-48 shrink-0">
                                            <div class="flex items-center gap-1.5 text-slate-500 mb-1">
                                                <i class="fas fa-cut text-[10px]"></i>
                                                <span class="text-[10px] font-black uppercase tracking-tighter">Procedimento</span>
                                            </div>
                                            <div contenteditable="true"
                                                 data-id="${id}" data-ui-id="${rowId}" data-field="service"
                                                 onfocus="this.parentElement.parentElement.parentElement.style.zIndex='100'; window.selectAll(this)"
                                                 onblur="this.parentElement.parentElement.parentElement.style.zIndex='1'; window.saveInlineEdit(this)"
                                                 onkeydown="window.handleInlineKey(event)"
                                                 oninput="window.showInlineAutocomplete(this)"
                                                 class="text-white font-black text-sm uppercase outline-none focus:bg-amber-500/10 rounded px-1 transition-all truncate">
                                                ${r.service}
                                            </div>
                                            <!-- Dropdown Autocomplete -->
                                            <div id="inlineAutocomplete_service_${rowId}" class="hidden absolute left-0 right-0 top-full mt-1 bg-dark-800 border border-white/10 rounded-xl shadow-2xl z-50 p-1"></div>
                                            
                                            <div class="flex items-center gap-2 mt-1">
                                                <input type="time" 
                                                       data-id="${id}" data-ui-id="${rowId}" data-field="time"
                                                       value="${r.time.substring(0, 5)}"
                                                       onchange="window.saveInlineEdit(this)"
                                                       style="color-scheme: dark"
                                                       class="bg-transparent border-none text-[10px] text-slate-500 font-bold outline-none cursor-pointer hover:bg-white/5 rounded px-1 transition-all">
                                                <span class="text-[10px] text-slate-700">•</span>
                                                <select onchange="window.saveInlineEdit(this)" 
                                                        data-id="${id}" data-ui-id="${rowId}" data-field="payment"
                                                        class="appearance-none bg-transparent border-none text-[10px] text-slate-500 font-bold uppercase tracking-widest outline-none cursor-pointer hover:bg-white/5 rounded px-1 transition-all">
                                                    ${['PIX', 'DINHEIRO', 'CARTÃO', 'PLANO MENSAL', 'CORTESIA'].map(p => `
                                                        <option value="${p}" ${r.paymentMethod === p ? 'selected' : ''} class="bg-dark-950">${p}</option>
                                                     `).join('')}
                                                </select>
                                            </div>
                                        </div>

                                        <!-- Observações (Área Ampliada) -->
                                        <div class="flex-1 flex flex-col min-h-[45px]">
                                            <div class="flex items-center gap-1.5 text-slate-500 mb-1">
                                                <i class="far fa-comment-alt text-[10px]"></i>
                                                <span class="text-[10px] font-black uppercase tracking-tighter">Observações</span>
                                            </div>
                                            <div contenteditable="true"
                                                 data-id="${id}" data-ui-id="${rowId}" data-field="observations"
                                                 onblur="window.saveInlineEdit(this)"
                                                 onkeydown="window.handleInlineKey(event)"
                                                 onfocus="window.selectAll(this)"
                                                 class="text-[11px] text-slate-400 italic outline-none hover:text-slate-200 transition-all cursor-text min-h-[20px] px-1 rounded hover:bg-white/5 truncate focus:whitespace-normal focus:break-words focus:max-w-none max-w-[250px] lg:max-w-[400px]"
                                                 title="${r.observations || ''}">
                                                ${r.observations || 'Nenhuma observação...'}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Valor e Ações -->
                                    <div class="flex flex-col items-end gap-2 pr-2">
                                        <div class="flex items-center gap-1.5 text-slate-500 mb-0.5">
                                            <span class="text-[10px] font-black uppercase tracking-tighter">Valor</span>
                                        </div>
                                        <div class="flex items-center gap-6">
                                            <div class="flex items-center gap-1">
                                                <span class="text-xs font-black text-slate-500">R$</span>
                                                <div contenteditable="true"
                                                     data-id="${id}" data-ui-id="${rowId}" data-field="value"
                                                     onfocus="window.selectAll(this)"
                                                     onblur="window.saveInlineEdit(this)"
                                                     onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                                     class="text-lg font-black text-white outline-none focus:bg-amber-500/10 rounded px-1 transition-all">
                                                    ${(parseFloat(r.value) || 0).toFixed(2)}
                                                </div>
                                            </div>
                                            
                                            <button onclick="window.cancelAppointment('${r.id}')" 
                                                    class="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-95 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <i class="fas fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
};

/**
 * PÁGINA: Perfil do Cartão (Visualização Detalhada)
 */
const CardProfilePage = () => {
    const cardId = state.selectedCardId;
    const card = state.cards.find(c => c.id === cardId);

    if (!card) return `
        <div class="px-4 pt-10 text-center">
            <h2 class="text-2xl font-bold">Cartão não encontrado</h2>
            <button onclick="navigate('cards')" class="mt-4 bg-amber-500 text-dark-950 px-6 py-2 rounded-xl">Voltar para Cartões</button>
        </div>
    `;

    // Filtra gastos associados a este cartão (Campo cartão ou na descrição como fallback)
    const allCardExpenses = state.expenses.filter(e => 
        e.cartao === card.nome || (e.descricao && e.descricao.toUpperCase().includes(card.nome.toUpperCase()))
    );

    const periodFilter = state.expensePeriodFilter || 'mensal';
    const targetMonth = state.filters.month;
    const targetYear = state.filters.year;
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const selectedDate = new Date(state.filters.year, state.filters.month - 1, state.filters.day);

    let filteredCardExpenses = allCardExpenses;

    if (periodFilter === 'diario') {
        const dateStr = selectedDate.toISOString().split('T')[0];
        filteredCardExpenses = allCardExpenses.filter(e => e.vencimento === dateStr);
    } else if (periodFilter === 'semanal') {
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        filteredCardExpenses = allCardExpenses.filter(e => {
            if (!e.vencimento) return false;
            const ev = new Date(e.vencimento + 'T12:00:00'); // T12 para evitar problemas de fuso
            return ev >= startOfWeek && ev <= endOfWeek;
        });
    } else if (periodFilter === 'mensal') {
        filteredCardExpenses = allCardExpenses.filter(e => e.vencimento.startsWith(monthPrefix));
    }

    const totalSpentPeriod = filteredCardExpenses.reduce((acc, e) => acc + (parseFloat(e.valor) || 0), 0);

    window.saveCardEdit = async (field, value) => {
        const originalValue = card[field]; // Store original value for rollback
        try {
            const updateData = { [field]: value };
            // Atualização Otimista
            Object.assign(card, updateData);
            render(); // Re-render immediately with the new value

            const res = await fetch(`${SUPABASE_URL}/rest/v1/cartoes?id=eq.${card.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal' // Add this header
                },
                body: JSON.stringify(updateData)
            });
            if (res.ok) {
                fetchCards(); // Re-fetch to ensure state is fully consistent
            } else {
                alert('Erro ao salvar alteração no banco.');
                // Rollback optimistic update
                Object.assign(card, { [field]: originalValue });
                render();
                fetchCards(); // Reverte para o estado do banco
            }
        } catch (err) { 
            console.error('Erro no salvamento parcial do cartão:', err);
            // Rollback em caso de erro de rede
            Object.assign(card, { [field]: originalValue });
            render();
            alert('❌ Erro de conexão ao salvar alteração.');
            fetchCards(); // Reverte para o estado do banco
        }
    };

    return `
        <div class="px-4 pt-6 sm:px-8 sm:pt-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <!-- Header do Cartão -->
            <div class="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                <div class="flex flex-col md:flex-row items-center md:items-start gap-6 w-full">
                    <div class="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] bg-amber-500/10 flex items-center justify-center text-amber-500 text-3xl md:text-5xl font-black border-2 border-amber-500/20 shadow-2xl shadow-amber-500/5 flex-shrink-0">
                        <i class="fas fa-credit-card"></i>
                    </div>
                    <div class="flex-1 text-center md:text-left">
                        <div class="flex flex-wrap justify-center md:justify-start items-center gap-2">
                            <input type="text" 
                                   value="${card.nome}" 
                                   onblur="window.saveCardEdit('nome', this.value.toUpperCase())"
                                   class="text-3xl md:text-5xl font-display font-black text-white bg-transparent border-b-2 border-transparent hover:border-amber-500/30 focus:border-amber-500 outline-none transition-all px-1 uppercase w-full md:w-auto">
                        </div>
                        <div class="text-slate-500 font-bold uppercase tracking-widest text-xs md:text-sm mt-1 flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-1 md:gap-6">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-university text-amber-500/50"></i>
                                <input type="text" 
                                       value="${card.banco || ''}" 
                                       placeholder="Adicionar Banco"
                                       onblur="window.saveCardEdit('banco', this.value.toUpperCase())"
                                       class="bg-transparent border-b border-transparent hover:border-amber-500/30 focus:border-amber-500 outline-none transition-all px-1 uppercase w-40 font-black">
                            </div>
                            <div class="flex items-center gap-2">
                                <i class="fas fa-user-circle text-amber-500/50"></i>
                                <input type="text" 
                                       value="${card.titular || ''}" 
                                       placeholder="Adicionar Titular"
                                       onblur="window.saveCardEdit('titular', this.value.toUpperCase())"
                                       class="bg-transparent border-b border-transparent hover:border-amber-500/30 focus:border-amber-500 outline-none transition-all px-1 uppercase w-56 font-black">
                            </div>
                        </div>
                    </div>
                </div>
                
                <button onclick="navigate('cards')" class="w-full md:w-auto px-6 py-3 bg-dark-900 text-slate-400 hover:text-white rounded-2xl text-[10px] font-black transition-all border border-white/5 uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl">
                    <i class="fas fa-arrow-left"></i> Voltar
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="glass-card p-6 rounded-[2rem] border border-white/5 space-y-2">
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Fechamento</p>
                    <input type="date" 
                           value="${card.fechamento}" 
                           onchange="window.saveCardEdit('fechamento', this.value || null)"
                           style="color-scheme: dark"
                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold text-white">
                </div>
                <div class="glass-card p-6 rounded-[2rem] border border-white/5 space-y-2">
                    <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vencimento</p>
                    <input type="date" 
                           value="${card.vencimento}" 
                           onchange="window.saveCardEdit('vencimento', this.value || null)"
                           style="color-scheme: dark"
                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold text-amber-500">
                </div>
                <div class="glass-card p-6 rounded-[2rem] border border-white/5 flex flex-col justify-between min-h-[120px]">
                    <div class="flex flex-col sm:flex-row justify-between items-start gap-3">
                        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">
                            Gasto no ${periodFilter === 'diario' ? 'Dia' : periodFilter === 'semanal' ? 'Período' : periodFilter === 'mensal' ? 'Mês' : 'Total'}
                        </p>
                        <div class="flex bg-dark-900 border border-white/5 rounded-xl p-0.5 shadow-inner self-end sm:self-auto overflow-x-auto max-w-full">
                            ${['diario', 'semanal', 'mensal', 'total'].map(p => `
                                <button onclick="window.setExpenseFilter('expensePeriodFilter', '${p}')" 
                                        class="whitespace-nowrap px-2 md:px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all flex-shrink-0
                                        ${state.expensePeriodFilter === p ? 'bg-amber-500 text-dark-950 shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-white'}">
                                    ${p === 'diario' ? 'Dia' : p === 'semanal' ? 'Semana' : p === 'mensal' ? 'Mês' : 'Total'}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <h4 class="text-2xl md:text-3xl font-black text-rose-500 mt-2">R$ ${totalSpentPeriod.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h4>
                </div>
            </div>

            <!-- Listagem de Gastos Recentes -->
            <div class="space-y-4">
                <h3 class="text-lg font-bold text-slate-300 uppercase tracking-widest text-sm flex items-center gap-2 ml-2">
                    <i class="fas fa-list-ul"></i> Gastos do Período (${filteredCardExpenses.length})
                </h3>
                
                <div class="bg-dark-900/30 rounded-[2rem] border border-white/5">
                    <div class="divide-y divide-white/5">
                        ${filteredCardExpenses.length === 0 ? `
                            <div class="p-10 text-center text-slate-500 italic">Nenhum gasto encontrado para este período.</div>
                        ` : filteredCardExpenses.slice(0, 10).map(e => `
                            <div class="flex items-center justify-between px-4 md:px-8 py-4 hover:bg-white/[0.02] transition-all gap-4">
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs md:text-sm font-bold text-white uppercase truncate">${e.descricao}</p>
                                    <p class="text-[9px] md:text-[10px] text-slate-500 font-bold">${new Date(e.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div class="text-right flex-shrink-0">
                                    <p class="text-xs md:text-sm font-black ${e.paga ? 'text-emerald-500' : 'text-rose-500'}">R$ ${(parseFloat(e.valor) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                    <span class="text-[8px] md:text-[9px] font-black uppercase tracking-widest ${e.paga ? 'text-emerald-500/50' : 'text-rose-500/50'}">${e.paga ? 'PAGO' : 'PENDENTE'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
};

const ExpensesPage = () => {
    const targetMonth = state.filters.month;
    const targetYear = state.filters.year;
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    const searchTerm = (state.expenseSearchTerm || '').toLowerCase();
    const statusFilter = state.expenseStatusFilter || 'TODOS';
    const periodFilter = state.expensePeriodFilter || 'mensal';

    // Base de filtragem por período
    let filteredExpenses = state.expenses;
    const selectedDate = new Date(state.filters.year, state.filters.month - 1, state.filters.day);

    if (periodFilter === 'diario') {
        const dateStr = selectedDate.toISOString().split('T')[0];
        filteredExpenses = filteredExpenses.filter(e => e.vencimento === dateStr);
    } else if (periodFilter === 'semanal') {
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        filteredExpenses = filteredExpenses.filter(e => {
            const ev = new Date(e.vencimento + 'T00:00:00');
            return ev >= startOfWeek && ev <= endOfWeek;
        });
    } else if (periodFilter === 'mensal') {
        filteredExpenses = filteredExpenses.filter(e => e.vencimento.startsWith(monthPrefix));
    }
    // No caso de 'total', não aplica filtro de data

    // Filtros de busca e status sobre o período selecionado
    if (searchTerm) {
        filteredExpenses = filteredExpenses.filter(e => 
            e.descricao.toLowerCase().includes(searchTerm) || 
            (e.cartao && e.cartao.toLowerCase().includes(searchTerm))
        );
    }

    if (statusFilter !== 'TODOS') {
        const isPaid = statusFilter === 'PAGO';
        filteredExpenses = filteredExpenses.filter(e => e.paga === isPaid);
    }

    // Ordenação
    const sort = state.expenseSort || 'vencimento_asc';
    filteredExpenses.sort((a, b) => {
        if (sort === 'vencimento_asc') return new Date(a.vencimento) - new Date(b.vencimento);
        if (sort === 'vencimento_desc') return new Date(b.vencimento) - new Date(a.vencimento);
        if (sort === 'valor_asc') return (parseFloat(a.valor) || 0) - (parseFloat(b.valor) || 0);
        if (sort === 'valor_desc') return (parseFloat(b.valor) || 0) - (parseFloat(a.valor) || 0);
        if (sort === 'descricao_asc') return (a.descricao || '').localeCompare(b.descricao || '');
        return 0;
    });
    
    const totalPago = filteredExpenses.filter(e => e.paga).reduce((acc, e) => acc + (parseFloat(e.valor) || 0), 0);
    const totalAPagar = filteredExpenses.filter(e => !e.paga).reduce((acc, e) => acc + (parseFloat(e.valor) || 0), 0);
    const totalGeral = totalPago + totalAPagar;

    window.toggleExpenseStatus = async (id, status) => {
        const isPaid = status === 'PAGO';
        const today = new Date().toISOString().split('T')[0];
        
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/saidas?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': 'Bearer ' + SUPABASE_KEY, 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    paga: isPaid,
                    data_pagamento: isPaid ? today : null
                })
            });
            if (res.ok) fetchExpenses();
        } catch (err) { console.error(err); }
    };

    window.deleteExpense = async (id) => {
        if (!confirm('Excluir esta conta permanentemente?')) return;
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/saidas?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
            });
            if (res.ok) fetchExpenses();
        } catch (err) { console.error(err); }
    };

    window.openExpenseModal = (expense = null) => {
        state.editingExpense = expense || { vencimento: monthPrefix + '-01', descricao: '', valor: 0, paga: false };
        state.isExpenseModalOpen = true;
        render();
    };

    window.closeExpenseModal = () => {
        state.isExpenseModalOpen = false;
        state.editingExpense = null;
        render();
    };

    window.saveExpense = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            vencimento: formData.get('vencimento'),
            descricao: formData.get('descricao').toUpperCase(),
            valor: parseFloat(formData.get('valor')) || 0,
            paga: formData.get('paga') === 'on',
            cartao: (formData.get('cartao') || '').trim().toUpperCase() || 'OUTROS',
            data_compra: formData.get('data_compra'),
            valor_total: parseFloat(formData.get('valor_total')) || 0,
            parcela: formData.get('parcela'),
            valor_pago: parseFloat(formData.get('valor_pago')) || 0
        };
        if (data.paga) {
            data.data_pagamento = new Date().toISOString().split('T')[0];
            if (!data.valor_pago) data.valor_pago = data.valor;
        }

        const id = state.editingExpense.id;
        const method = id ? 'PATCH' : 'POST';
        const url = id ? `${SUPABASE_URL}/rest/v1/saidas?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/saidas`;

        try {
            const res = await fetch(url, {
                method,
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': 'Bearer ' + SUPABASE_KEY, 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                window.closeExpenseModal();
                fetchExpenses();
            }
        } catch (err) { console.error(err); }
    };

    window.saveExpenseInline = async (el) => {
        const id = el.dataset.id;
        const field = el.dataset.field;
        let value = el.innerText.trim();

        if (field === 'valor' || field === 'valor_pago' || field === 'valor_total') {
            value = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        } else if (field === 'descricao') {
            value = value.toUpperCase();
        } else if (field === 'cartao') {
            value = value.toUpperCase() || 'OUTROS';
        } else if (field === 'vencimento' || field === 'data_pagamento') {
            value = el.value || null;
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/saidas?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': 'Bearer ' + SUPABASE_KEY, 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [field]: value })
            });
            if (res.ok) {
                fetchExpenses();
            }
        } catch (err) { console.error('Erro no salvamento inline de saída:', err); }
    };

    window.clearExpenseFilters = () => {
        state.expenseSearchTerm = '';
        state.expenseStatusFilter = 'TODOS';
        state.expenseSort = 'vencimento_asc';
        render();
    };

    window.setExpenseFilter = (field, val) => {
        state[field] = val;
        
        // Se estiver Editando a busca, renderizamos preservando o foco
        if (field === 'expenseSearchTerm') {
            const inputId = 'expenseSearchInput';
            const cursorPosition = document.getElementById(inputId)?.selectionStart;
            render();
            const input = document.getElementById(inputId);
            if (input) {
                input.focus();
                if (cursorPosition) input.setSelectionRange(cursorPosition, cursorPosition);
            }
        } else {
            render();
        }
    };

    const monthsLong = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    return `
        <div class="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 animate-in fade-in duration-500 pb-32">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-sm">
                <div>
                    <h2 class="text-3xl font-display font-black">Saídas <span class="text-rose-500">${
                        periodFilter === 'total' ? 'Totais' : 
                        periodFilter === 'diario' ? `${state.filters.day} de ${monthsLong[targetMonth-1]}` : 
                        periodFilter === 'semanal' ? 'da Semana' : 
                        `${monthsLong[targetMonth-1]}${targetYear !== new Date().getFullYear() ? ' ' + targetYear : ''}`
                    }</span></h2>
                    <div class="flex items-center gap-2 mt-2">
                        <div class="flex bg-dark-900 border border-white/5 rounded-xl p-0.5">
                            ${['diario', 'semanal', 'mensal', 'total'].map(p => `
                                <button onclick="window.setExpenseFilter('expensePeriodFilter', '${p}')" 
                                        class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                                        ${state.expensePeriodFilter === p ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-white'}">
                                    ${p === 'diario' ? 'Dia' : p === 'semanal' ? 'Semana' : p === 'mensal' ? 'Mês' : 'Total'}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="flex flex-wrap gap-4 w-full md:w-auto">
                    <div class="bg-rose-500/10 border border-rose-500/20 px-6 py-3 rounded-2xl flex flex-col justify-center">
                        <span class="text-[9px] font-black uppercase text-rose-500/60 tracking-tighter">Total Pago</span>
                        <span class="text-lg font-black text-rose-500">R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="bg-amber-500/10 border border-amber-500/20 px-6 py-3 rounded-2xl flex flex-col justify-center">
                        <span class="text-[9px] font-black uppercase text-amber-500/60 tracking-tighter">Total a Pagar</span>
                        <span class="text-lg font-black text-amber-500">R$ ${totalAPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    <button onclick="window.openExpenseModal()" class="bg-rose-500 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20 border border-rose-400/50 flex items-center gap-2">
                        <i class="fas fa-plus"></i> Nova Conta
                    </button>
                </div>
            </div>

            <!-- Dashboard de Filtros -->
            <div class="flex flex-wrap gap-4 items-center bg-dark-900/50 p-4 rounded-[1.5rem] border border-white/5 shadow-2xl">
                <div class="flex-1 min-w-[240px] relative group">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs group-focus-within:text-rose-500 transition-colors"></i>
                    <input type="text" 
                           id="expenseSearchInput"
                           placeholder="Buscar por descrição ou cartão..." 
                           value="${state.expenseSearchTerm || ''}"
                           oninput="window.setExpenseFilter('expenseSearchTerm', this.value)"
                           class="w-full bg-dark-950 border border-white/10 pl-10 pr-4 py-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-xs uppercase text-white shadow-inner">
                </div>
                
                <div class="flex gap-2 flex-wrap sm:flex-nowrap">
                    <select onchange="window.setExpenseFilter('expenseStatusFilter', this.value)"
                            class="bg-dark-950 border border-white/10 px-4 py-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-xs uppercase text-white cursor-pointer min-w-[160px]">
                        <option value="TODOS" ${state.expenseStatusFilter === 'TODOS' ? 'selected' : ''}>Todos os Status</option>
                        <option value="PAGO" ${state.expenseStatusFilter === 'PAGO' ? 'selected' : ''}>Somente Pagos</option>
                        <option value="PENDENTE" ${state.expenseStatusFilter === 'PENDENTE' ? 'selected' : ''}>Somente Pendentes</option>
                    </select>

                    <select onchange="window.setExpenseFilter('expenseSort', this.value)"
                            class="bg-dark-950 border border-white/10 px-4 py-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-xs uppercase text-white cursor-pointer min-w-[170px]">
                        <option value="vencimento_asc" ${state.expenseSort === 'vencimento_asc' ? 'selected' : ''}>Data (Mais Antiga)</option>
                        <option value="vencimento_desc" ${state.expenseSort === 'vencimento_desc' ? 'selected' : ''}>Data (Mais Recente)</option>
                        <option value="valor_asc" ${state.expenseSort === 'valor_asc' ? 'selected' : ''}>Valor (Menor Primeiro)</option>
                        <option value="valor_desc" ${state.expenseSort === 'valor_desc' ? 'selected' : ''}>Valor (Maior Primeiro)</option>
                        <option value="descricao_asc" ${state.expenseSort === 'descricao_asc' ? 'selected' : ''}>Descrição (A-Z)</option>
                    </select>
                </div>

                ${(state.expenseSearchTerm || state.expenseStatusFilter !== 'TODOS' || state.expenseSort !== 'vencimento_asc') ? `
                    <button onclick="window.clearExpenseFilters()" 
                            class="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400 transition-colors flex items-center gap-2 px-2 animate-in fade-in slide-in-from-right-2">
                        <i class="fas fa-times-circle"></i> Limpar Tudo
                    </button>
                ` : ''}
            </div>

            <!-- Tabela de Saídas Responsiva -->
            <div class="space-y-4 md:space-y-0 md:bg-dark-900/30 md:rounded-[2rem] border border-white/5">
                <!-- Header (Apenas Desktop) -->
                <div class="hidden md:grid grid-cols-[120px_130px_1fr_100px_110px_120px_80px] bg-white/[0.02] border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest px-6 py-4 items-center">
                    <div class="text-left px-2">Vencimento</div>
                    <div class="text-left px-2">Cartão/Outro</div>
                    <div class="text-left px-4">Descrição</div>
                    <div class="text-center">Valor</div>
                    <div class="text-center">Status</div>
                    <div class="text-center">Pagamento</div>
                    <div class="text-center">Ações</div>
                </div>

                <div class="divide-y divide-white/5">
                    ${filteredExpenses.length === 0 ? `
                        <div class="px-8 py-20 text-center text-slate-500 italic">Nenhuma conta registrada para este mês.</div>
                    ` : filteredExpenses.map(e => {
                        const today = new Date().toISOString().split('T')[0];
                        const diffDays = Math.ceil((new Date(e.vencimento + 'T00:00:00') - new Date(today + 'T00:00:00')) / (1000 * 60 * 60 * 24));
                        
                        let statusHtml = '';
                        if (e.paga) {
                            statusHtml = `<span class="text-emerald-500 font-bold text-[9px] uppercase">Pago</span>`;
                        } else if (diffDays < 0) {
                            statusHtml = `<span class="text-rose-500 font-bold text-[9px] uppercase animate-pulse">Vencido</span>`;
                        } else if (diffDays === 0) {
                            statusHtml = `<span class="text-amber-500 font-bold text-[9px] uppercase">Vence Hoje</span>`;
                        } else {
                            statusHtml = `<span class="text-amber-500 font-bold text-[9px] uppercase">Pendente</span>`;
                        }

                        return `
                        <div class="flex flex-col md:grid md:grid-cols-[120px_130px_1fr_100px_110px_120px_80px] items-center px-6 py-2.5 hover:bg-white/[0.02] transition-colors group relative border-b border-white/5">
                            <!-- Vencimento -->
                            <div class="w-full md:w-auto flex items-center gap-3">
                                <span class="md:hidden text-[9px] font-black text-slate-500 uppercase">Vencimento</span>
                                <div class="flex items-center gap-1.5">
                                    <div class="w-1.5 h-1.5 rounded-full ${e.paga ? 'bg-emerald-500' : diffDays < 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}"></div>
                                    <div class="flex items-center -ml-1 gap-1">
                                        <i class="far fa-calendar-alt text-[9px] text-slate-500 mt-0.5"></i>
                                        <input type="date" 
                                               data-id="${e.id}" 
                                               data-field="vencimento"
                                               value="${e.vencimento}"
                                               onchange="window.saveExpenseInline(this)"
                                               style="color-scheme: dark"
                                               class="bg-transparent border-none text-[12px] font-bold text-white outline-none cursor-pointer hover:bg-white/5 rounded pl-0.5 pr-1 transition-all">
                                    </div>
                                </div>
                            </div>

                            <!-- Cartão/Outro -->
                            <div class="w-full md:w-auto px-2 mt-2 md:mt-0 relative min-w-0">
                                <span class="md:hidden text-[9px] font-black text-slate-500 uppercase block mb-1">Cartão/Outro</span>
                                <div class="flex flex-col gap-0.5">
                                    <div class="flex items-center gap-1.5">
                                        <i class="fas fa-credit-card text-[10px] text-slate-500/50"></i>
                                        <div contenteditable="true" 
                                             data-id="${e.id}" 
                                             data-field="cartao"
                                             onfocus="window.selectAll(this)"
                                             onblur="window.saveExpenseInline(this)"
                                             onkeydown="window.handleInlineKey(event)"
                                             oninput="window.showExpenseAutocomplete(this)"
                                             class="text-[10px] font-black text-amber-500 uppercase tracking-tight outline-none focus:bg-white/5 hover:bg-white/5 px-1 rounded transition-all truncate cursor-text">
                                            ${e.cartao || 'OUTROS'}
                                        </div>
                                    </div>
                                    ${(() => {
                                        const card = state.cards.find(c => c.nome === e.cartao);
                                        if (card && card.titular) {
                                            return `
                                                <div class="flex items-center gap-1.5 ml-0.5 opacity-60">
                                                    <i class="fas fa-user-circle text-[9px] text-slate-500/80"></i>
                                                    <span class="text-[9px] font-bold text-slate-400 uppercase truncate">${card.titular}</span>
                                                </div>
                                            `;
                                        }
                                        return '';
                                    })()}
                                </div>
                                <div id="expenseAutocomplete_${e.id}" class="hidden absolute left-0 right-0 top-full mt-1 bg-dark-800 border border-white/10 rounded-xl shadow-2xl z-50 p-1"></div>
                            </div>

                            <!-- Descrição -->
                            <div class="w-full md:w-auto px-4 mt-2 md:mt-0 min-w-0">
                                <span class="md:hidden text-[9px] font-black text-slate-500 uppercase block mb-1">Descrição</span>
                                <div contenteditable="true" 
                                     data-id="${e.id}" 
                                     data-field="descricao"
                                     onfocus="window.selectAll(this)"
                                     onblur="window.saveExpenseInline(this)"
                                     onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                     class="font-black text-xs text-white uppercase tracking-wider outline-none focus:bg-white/5 hover:bg-white/5 px-1 rounded transition-all truncate hover:whitespace-normal cursor-text w-full">
                                    ${e.descricao}
                                </div>
                            </div>

                            <!-- Valor -->
                            <div class="text-center mt-2 md:mt-0">
                                <span class="md:hidden text-[9px] font-black text-slate-500 uppercase">Valor</span>
                                <div contenteditable="true" 
                                     data-id="${e.id}" 
                                     data-field="valor"
                                     onfocus="window.selectAll(this)"
                                     onblur="window.saveExpenseInline(this)"
                                     onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                     class="font-black text-[12px] text-white outline-none focus:bg-white/5 hover:bg-white/5 px-1 rounded transition-all cursor-text inline-block">
                                    ${(parseFloat(e.valor) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </div>
                            </div>

                            <!-- Status (Select) -->
                            <div class="text-center mt-2 md:mt-0 px-2">
                                <span class="md:hidden text-[9px] font-black text-slate-500 uppercase">Status</span>
                                <select onchange="window.toggleExpenseStatus('${e.id}', this.value)" 
                                        class="bg-white/5 border border-white/10 text-[10px] font-black uppercase rounded-lg px-2 py-1 outline-none transition-all w-full
                                        ${e.paga ? 'text-emerald-500' : diffDays < 0 ? 'text-rose-500' : 'text-amber-500'}">
                                    <option value="PAGO" ${e.paga ? 'selected' : ''}>PAGO</option>
                                    <option value="A VENCER" ${!e.paga && diffDays >= 0 ? 'selected' : ''}>A VENCER</option>
                                    <option value="VENCIDO" ${!e.paga && diffDays < 0 ? 'selected' : ''}>VENCIDO</option>
                                </select>
                            </div>

                            <!-- Pagamento -->
                            <div class="text-center mt-2 md:mt-0">
                                <span class="md:hidden text-[9px] font-black text-slate-500 uppercase">Pagamento</span>
                                <input type="date" 
                                       data-id="${e.id}" 
                                       data-field="data_pagamento"
                                       value="${e.data_pagamento || ''}"
                                       onchange="window.saveExpenseInline(this)"
                                       style="color-scheme: dark"
                                       class="bg-transparent border-none text-[11px] font-bold text-slate-400 w-full text-center outline-none cursor-pointer hover:bg-white/5 rounded px-1 transition-all">
                            </div>

                            <!-- Ações -->
                            <div class="flex justify-center gap-2 mt-2 md:mt-0">
                                <button onclick="window.openExpenseModal(${JSON.stringify(e).replace(/"/g, '&quot;')})" 
                                        class="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-dark-950 transition-all flex items-center justify-center">
                                    <i class="fas fa-edit text-[10px]"></i>
                                </button>
                                <button onclick="window.deleteExpense(${e.id})" 
                                        class="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                                    <i class="fas fa-trash text-[10px]"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    }).join('')}
                    
                    ${filteredExpenses.length > 0 ? `
                    <div class="bg-white/[0.01] px-8 py-6 flex justify-between items-center border-t border-white/5">
                        <span class="text-xs font-black uppercase tracking-widest text-slate-500">Total do Período</span>
                        <span class="text-xl font-black text-white">R$ ${totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Modal de Saída -->
            ${state.isExpenseModalOpen ? `
                <div class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div class="glass-card w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
                        <div class="py-4 px-6 border-b border-white/5 flex justify-between items-center bg-dark-900/50">
                            <h3 class="text-xl font-bold">${state.editingExpense?.id ? 'Editar Conta' : 'Nova Conta'}</h3>
                            <button onclick="window.closeExpenseModal()" class="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <form onsubmit="window.saveExpense(event)" id="expenseModal" class="p-5 space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-1 relative">
                                    <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Cartão/Origem</label>
                                    <input type="text" name="cartao" value="${state.editingExpense?.cartao || ''}" 
                                           placeholder="DINHEIRO / CARTÃO..."
                                           autocomplete="off"
                                           oninput="window.showExpenseAutocomplete(this, true, 'card')"
                                           onkeydown="window.handleEnterSelection(event, 'expenseAutocomplete_card_modal')"
                                           onblur="setTimeout(() => document.getElementById('expenseAutocomplete_card_modal')?.classList.add('hidden'), 200)"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-xs uppercase text-white">
                                    <div id="expenseAutocomplete_card_modal" class="hidden absolute z-[120] left-0 right-0 mt-2 bg-dark-900 border border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scroll p-2"></div>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Data da Compra</label>
                                    <input type="date" name="data_compra" value="${state.editingExpense?.data_compra || new Date().toISOString().split('T')[0]}"
                                           style="color-scheme: dark"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-xs">
                                </div>
                            </div>

                            <div class="space-y-1 relative">
                                <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Descrição</label>
                                <input type="text" name="descricao" required id="expenseModalDesc"
                                       value="${state.editingExpense?.descricao || ''}" 
                                       placeholder="EX: COMPRA 1, ALUGUEL..."
                                       autocomplete="off"
                                       oninput="window.showExpenseAutocomplete(this, true, 'desc')"
                                       onkeydown="window.handleEnterSelection(event, 'expenseAutocomplete_desc_modal')"
                                       onblur="setTimeout(() => document.getElementById('expenseAutocomplete_desc_modal')?.classList.add('hidden'), 200)"
                                       class="w-full bg-dark-950 border border-white/5 p-3.5 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold uppercase text-sm">
                                <div id="expenseAutocomplete_desc_modal" class="hidden absolute z-[120] left-0 right-0 mt-2 bg-dark-900 border border-white/10 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scroll p-2"></div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Valor Total (R$)</label>
                                    <input type="number" step="0.01" name="valor_total" value="${state.editingExpense?.valor_total || state.editingExpense?.valor || ''}"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-sm">
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Parcela</label>
                                    <input type="text" name="parcela" value="${state.editingExpense?.parcela || '1/1'}"
                                           oninput="window.maskParcela(this)"
                                           placeholder="1/1"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-xs text-center">
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Vencimento</label>
                                    <input type="date" name="vencimento" required value="${state.editingExpense?.vencimento || ''}"
                                           style="color-scheme: dark"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-xs">
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Valor Parcela (R$)</label>
                                    <input type="number" step="0.01" name="valor" value="${state.editingExpense?.valor || ''}"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-sm">
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Valor Pago (R$)</label>
                                    <input type="number" step="0.01" name="valor_pago" value="${state.editingExpense?.valor_pago || ''}"
                                           class="w-full bg-dark-950 border border-white/5 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all font-bold text-sm text-emerald-500">
                                </div>
                            </div>

                            <div class="flex items-center space-x-3 p-3 bg-dark-950 rounded-xl border border-white/5">
                                <input type="checkbox" name="paga" id="expensePaga" ${state.editingExpense?.paga ? 'checked' : ''} class="w-5 h-5 rounded border-white/10 bg-dark-900 text-emerald-500 focus:ring-0">
                                <label for="expensePaga" class="text-xs font-bold text-slate-400">Marcar como JÁ PAGA</label>
                            </div>
                            
                            <button type="submit" class="w-full bg-rose-500 text-white font-black py-4 rounded-xl border border-transparent shadow-lg shadow-rose-500/20 active:scale-95 uppercase tracking-widest text-xs transition-all mt-2">
                                ${state.editingExpense?.id ? 'Salvar Alterações' : 'Salvar Conta'}
                            </button>
                        </form>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
};

/**
 * PÁGINA: Gestão de Cartões
 */
const CardsPage = () => {
    window.openCardModal = (card = null) => {
        state.editingCard = card || { nome: '', banco: '', titular: '', fechamento: '', vencimento: '' };
        state.isCardModalOpen = true;
        render();
    };

    window.closeCardModal = () => {
        state.isCardModalOpen = false;
        state.editingCard = null;
        render();
    };

    window.saveCard = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            nome: formData.get('nome').toUpperCase(),
            banco: formData.get('banco').toUpperCase(),
            titular: formData.get('titular').toUpperCase(),
            fechamento: formData.get('fechamento') || null,
            vencimento: formData.get('vencimento') || null
        };

        const id = state.editingCard.id;
        const method = id ? 'PATCH' : 'POST';
        const url = id ? `${SUPABASE_URL}/rest/v1/cartoes?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/cartoes`;

        try {
            const res = await fetch(url, {
                method,
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': 'Bearer ' + SUPABASE_KEY, 
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                window.closeCardModal();
                fetchCards();
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('Erro Supabase:', errorData);
                if (errorData.code === '23505') alert('❌ ERRO: Já existe um cartão com este nome.');
                else alert('❌ Erro ao salvar: ' + (errorData.message || 'Falha no banco de dados.'));
            }
        } catch (err) { 
            console.error(err); 
            alert('❌ Erro de conexão ao salvar cartão.');
        }
    };

    window.deleteCard = async (id) => {
        if (!confirm('Excluir este cartão?')) return;
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/cartoes?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
            });
            if (res.ok) fetchCards();
        } catch (err) { console.error(err); }
    };

    window.saveCardInline = async (el) => {
        const id = el.dataset.id;
        const field = el.dataset.field;
        let value = el.innerText.trim();

        if (field === 'nome' || field === 'banco' || field === 'titular') {
            value = value.toUpperCase();
        } else if (field === 'fechamento' || field === 'vencimento') {
            value = el.value || null; // Pega value do input date
        }

        try {
            // Atualização Otimista
            const card = state.cards.find(c => c.id == id);
            if (card) card[field] = value;
            render();

            const res = await fetch(`${SUPABASE_URL}/rest/v1/cartoes?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': 'Bearer ' + SUPABASE_KEY, 
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ [field]: value })
            });
            if (res.ok) {
                fetchCards();
            } else {
                alert('Erro ao salvar alteração.');
                fetchCards();
            }
        } catch (err) { console.error('Erro no salvamento inline de cartão:', err); }
    };

    return `
        <div class="px-4 pt-6 sm:px-6 sm:pt-6 lg:px-8 lg:pt-6 space-y-6 animate-in fade-in duration-500 pb-32">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-sm">
                <div>
                    <h2 class="text-3xl font-display font-black">Meus Cartões</h2>
                    <p class="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Datas de Fechamento e Vencimento</p>
                </div>
                <button onclick="window.openCardModal()" class="bg-amber-500 text-dark-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 border border-amber-400 flex items-center gap-2">
                    <i class="fas fa-plus"></i> Cadastrar Cartão
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${state.cards.length === 0 ? `
                    <div class="col-span-full py-12 text-center text-slate-500 italic font-bold">Nenhum cartão cadastrado. Clique no botão acima para adicionar.</div>
                ` : state.cards.map(c => `
                    <div onclick="navigate('card-profile', ${c.id})" class="glass-card p-6 rounded-[2rem] border border-white/10 relative group overflow-hidden flex flex-col justify-between cursor-pointer hover:border-amber-500/50 transition-all" style="border-image: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%) 1;">
                        <div class="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all"></div>
                        
                        <div class="flex justify-between items-start relative z-10">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-amber-500 flex-shrink-0">
                                    <i class="fas fa-credit-card text-xl"></i>
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <h3 contenteditable="true" 
                                        onclick="event.stopPropagation()"
                                        onfocus="window.selectAll(this)"
                                        data-id="${c.id}" 
                                        data-field="banco"
                                        onblur="window.saveCardInline(this)"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                        class="text-sm font-black text-slate-500 uppercase tracking-widest outline-none px-1 rounded hover:bg-white/5 truncate">${c.banco || 'BANCO'}</h3>
                                    <h4 contenteditable="true" 
                                        onclick="event.stopPropagation()"
                                        onfocus="window.selectAll(this)"
                                        data-id="${c.id}" 
                                        data-field="titular"
                                        onblur="window.saveCardInline(this)"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                        class="text-xs font-bold text-slate-400 uppercase tracking-tighter outline-none px-1 rounded hover:bg-white/5 truncate -mt-1">${c.titular || 'TITULAR'}</h4>
                                </div>
                            </div>
                            <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                <button onclick="event.stopPropagation(); window.openCardModal(${JSON.stringify(c).replace(/"/g, '&quot;')})" class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-dark-950 transition-all flex items-center justify-center border border-amber-500/20">
                                    <i class="fas fa-edit text-xs"></i>
                                </button>
                                <button onclick="event.stopPropagation(); window.deleteCard(${c.id})" class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-500/20">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>

                        <div class="relative z-10 mt-4">
                            <h2 contenteditable="true" 
                                onclick="event.stopPropagation()"
                                onfocus="window.selectAll(this)"
                                data-id="${c.id}" 
                                data-field="nome"
                                onblur="window.saveCardInline(this)"
                                onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
                                class="text-2xl font-black text-white uppercase outline-none px-1 rounded hover:bg-white/5">${c.nome}</h2>
                        </div>

                        <div class="grid grid-cols-1 xs:grid-cols-2 gap-3 relative z-10 border-t border-white/5 pt-4 mt-2">
                            <div onclick="event.stopPropagation()" class="flex flex-col">
                                <p class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Fechamento</p>
                                <input type="date" 
                                       data-id="${c.id}" 
                                       data-field="fechamento"
                                       style="color-scheme: dark"
                                       value="${String(c.fechamento || '').includes('-') ? c.fechamento : ''}"
                                       onchange="window.saveCardInline(this)"
                                       class="w-full bg-dark-950/50 border border-white/5 p-2 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-[10px] text-white cursor-pointer hover:bg-white/5">
                            </div>
                            <div onclick="event.stopPropagation()" class="flex flex-col">
                                <p class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1 xs:text-right">Vencimento</p>
                                <input type="date" 
                                       data-id="${c.id}" 
                                       data-field="vencimento"
                                       style="color-scheme: dark"
                                       value="${String(c.vencimento || '').includes('-') ? c.vencimento : ''}"
                                       onchange="window.saveCardInline(this)"
                                       class="w-full bg-dark-950/50 border border-white/5 p-2 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold text-[10px] text-amber-500 cursor-pointer hover:bg-white/5 text-center xs:text-right">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Modal de Cartão -->
            ${state.isCardModalOpen ? `
                <div class="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
                    <div class="glass-card w-[98%] sm:w-full max-w-md rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[95vh] custom-scroll">
                        <div class="py-4 px-6 border-b border-white/5 flex justify-between items-center bg-dark-900/50 sticky top-0 z-10 backdrop-blur-md">
                            <h3 class="text-xl font-bold">${state.editingCard?.id ? 'Editar Cartão' : 'Novo Cartão'}</h3>
                            <button onclick="window.closeCardModal()" class="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <form onsubmit="window.saveCard(event)" class="p-5 space-y-5">
                            <div class="space-y-2">
                                <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nome do Cartão (Apelido)</label>
                                <input type="text" name="nome" required value="${state.editingCard?.nome || ''}" placeholder="EX: NUBANK PF, INTER..."
                                       class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold uppercase text-sm">
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Banco / Emissor</label>
                                <input type="text" name="banco" value="${state.editingCard?.banco || ''}" placeholder="EX: ITAÚ, BRADESCO..."
                                       class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold uppercase text-sm">
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Titular do Cartão</label>
                                <input type="text" name="titular" value="${state.editingCard?.titular || ''}" placeholder="EX: MEU NOME, ESPOSA..."
                                       class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold uppercase text-sm">
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Data Fechamento</label>
                                    <input type="date" name="fechamento" 
                                           style="color-scheme: dark"
                                           value="${String(state.editingCard?.fechamento || '').includes('-') ? state.editingCard.fechamento : ''}"
                                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Data Vencimento</label>
                                    <input type="date" name="vencimento" 
                                           style="color-scheme: dark"
                                           value="${String(state.editingCard?.vencimento || '').includes('-') ? state.editingCard.vencimento : ''}"
                                           class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold text-sm">
                                </div>
                            </div>
                        <button type="submit" class="w-full bg-amber-500 text-dark-950 font-black py-4 rounded-xl border border-transparent shadow-lg shadow-amber-500/20 active:scale-95 uppercase tracking-widest text-xs transition-all mt-2">
                            ${state.editingCard?.id ? 'Salvar Alterações' : 'Cadastrar Cartão'}
                        </button>
                    </form>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
};

/**
 * PÁGINA: Configurações e Tema
 */
const SetupPage = () => {
    window.updateColor = (hex) => {
        state.theme.accent = hex;
        state.theme.accentRgb = hexToRgb(hex);
        applyTheme();
        render();
    };

    window.validateConnection = async () => {
        const url = document.getElementById('sheetUrl').value.trim();
        if (!url) return alert('Por favor, insira a URL da planilha ou do script.');
        
        state.isValidating = true;
        render();

        const success = await syncFromSheet(url);
        
        state.isValidating = false;
        if (success) {
            alert('Conectado com sucesso!');
        } else {
            alert('Não foi possível ler dados neste link. Verifique se o link está correto e público.');
        }
        render();
    };

    window.disconnectSheet = () => {
        if (confirm('Deseja realmente desconectar a planilha? Todos os dados locais serão limpos.')) {
            localStorage.removeItem('sheetUrl');
            localStorage.removeItem('isIntegrated');
            state.sheetUrl = '';
            state.isIntegrated = false;
            state.records = [];
            state.kpis = { diario: 'R$ 0,00', mensal: 'R$ 0,00', anual: 'R$ 0,00' };
            render();
        }
    };

    return `
        <div class="p-4 sm:p-8 flex items-center justify-center min-h-[80vh] animate-in fade-in duration-500">
            <div class="max-w-2xl w-full glass-card p-6 sm:p-12 rounded-[2rem] sm:rounded-[3rem] border border-white/5 shadow-2xl">
                <div class="text-center space-y-6">
                    <h2 class="text-4xl font-display font-black">Configuração de Dados</h2>
                    <p class="text-slate-400">Cole a URL do Google Sheets ou do seu Apps Script Pro.</p>
                    
                    <div class="space-y-4 pt-8 text-left">
                        <label class="text-xs font-bold text-slate-500 uppercase">Link de Integração</label>
                        <input type="text" id="sheetUrl" 
                               value="${state.sheetUrl || ''}" 
                               placeholder="https://script.google.com/macros/s/..." 
                               class="w-full bg-dark-900 border border-white/10 p-5 rounded-2xl outline-none focus:border-amber-500 transition-all font-mono text-xs">
                        
                        <div class="flex gap-4">
                            <button onclick="window.validateConnection()" 
                                    class="flex-1 bg-amber-500 text-dark-950 p-5 rounded-2xl font-bold text-lg border border-transparent transition-all">
                                ${state.isValidating ? 'Sincronizando...' : 'Conectar e Carregar'}
                            </button>
                            
                            ${state.isIntegrated ? `
                                <button onclick="window.disconnectSheet()" 
                                        class="px-6 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-bold hover:bg-rose-500 hover:text-white transition-all">
                                    <i class="fas fa-unlink"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="text-xs text-slate-600 mt-8 space-y-2">
                        <p>💡 <b>Dica:</b> Para o Método 2, use o link que termina em <span class="text-amber-500">/exec</span>.</p>
                        <p>O app salvará automaticamente este link no seu navegador.</p>
                    </div>
                </div>

                <!-- Configuração de Tema -->
                <div class="mt-12 pt-12 border-t border-white/5 text-left">
                    <h3 class="text-xl font-bold mb-2">Personalização</h3>
                    <p class="text-slate-500 text-sm mb-8">Escolha a cor de destaque do seu dashboard.</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="space-y-4">
                            <label class="text-xs font-bold text-slate-500 uppercase">Cor de Destaque</label>
                            <div class="flex items-center space-x-4 bg-dark-900 border border-white/10 p-4 rounded-2xl">
                                <input type="color" 
                                       id="colorPicker" 
                                       value="${state.theme.accent}"
                                       oninput="window.updateColor(this.value)"
                                       class="w-12 h-12 rounded-lg bg-transparent border-none cursor-pointer">
                                <span class="font-mono text-sm font-bold uppercase">${state.theme.accent}</span>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <label class="text-xs font-bold text-slate-500 uppercase">Sugestões (Premium)</label>
                            <div class="flex flex-wrap gap-3">
                                ${['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F43F5E', '#737373'].map(color => `
                                    <button onclick="window.updateColor('${color}')" 
                                            class="w-8 h-8 rounded-full border-2 ${state.theme.accent === color ? 'border-white' : 'border-transparent'}"
                                            style="background-color: ${color}"></button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const pages = {
    dashboard: Dashboard,
    records: RecordsPage,
    manage: ManagePage,
    clients: ClientsPage,
    plans: PlansPage,
    'client-profile': ClientProfilePage,
    setup: SetupPage,
    expenses: ExpensesPage,
    cards: CardsPage,
    'card-profile': CardProfilePage
};

// ==========================================
// 8. MOTOR DE RENDERIZAÇÃO E INICIALIZAÇÃO
// ==========================================
function render() {
    const app = document.getElementById('app');
    
    // Preserva a posição do scroll antes de limpar o HTML
    const mainEl = app ? app.querySelector('main') : null;
    const scrollPos = mainEl ? mainEl.scrollTop : 0;

    // Captura o foco e seleção antes de renderizar
    const activeId = document.activeElement ? document.activeElement.id : null;
    const selection = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') 
        ? { start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd } 
        : null;

    const contentFn = pages[state.currentPage] || (() => '404');
    const content = contentFn();

    app.innerHTML = `
        <div class="flex h-full w-full bg-pattern text-white">
            ${Sidebar()}
            <div class="flex-1 flex flex-col min-w-0 h-full relative">
                ${Header()}
                <main id="mainContent" class="flex-1 overflow-y-auto custom-scroll pb-24 md:pb-0">
                    ${content}
                </main>
                ${MobileNav()}
            </div>
            <!-- Overlay de Edição (Global) -->
            ${state.isEditModalOpen ? EditModal() : ''}
        </div>
    `;

    // Restaura a posição do scroll (importante para edições inline)
    const newMain = document.getElementById('mainContent');
    if (newMain) {
        newMain.scrollTop = scrollPos;
    }

    // Restaura o foco e posição do cursor
    if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
            el.focus();
            if (selection && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                el.setSelectionRange(selection.start, selection.end);
            }
        }
    }
}

// --- Handlers Globais de Edição de Clientes ---
window.saveClientInline = async (id, field, value) => {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value.trim() })
        });
        if (res.ok) {
            const client = state.clients.find(c => c.id == id);
            if (client) client[field] = value.trim();
            // Evitamos render() aqui para não perder o foco se o usuário ainda estiver editando outros campos, 
            // mas como é blur, tudo bem.
        }
    } catch (err) { console.error(err); }
};

if (!window.hasGlobalHandlers) {
    window.navigate = navigate;

    window.openAddModal = (time = '', date = '') => {
        state.editingRecord = { time, date };
        state.clientSearch = '';
        state.isEditModalOpen = true;
        render();
    };

    window.editAppointment = (id) => {
        const record = state.records.find(r => String(r.id) === String(id));
        if (record) {
            state.editingRecord = record;
            state.clientSearch = record.client;
            state.isEditModalOpen = true;
            render();
        }
    };

    window.closeEditModal = () => {
        state.isEditModalOpen = false;
        state.editingRecord = null;
        render();
    };

    window.cancelAppointment = async (id) => {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
            });
            if (res.ok) syncFromSheet(state.sheetUrl);
            else alert('Erro ao cancelar.');
        } catch (err) { alert('Erro de conexão.'); }
    };

    window.handleSearch = (e) => {
        state.searchTerm = (e.target || e).value;
        render();
    };

    window.toggleEmptySlots = () => {
        state.showEmptySlots = !state.showEmptySlots;
        render();
    };

    // Helper para detectar ciclo e uso do plano
    window.getClientPlanUsage = (clientName) => {
    if (!clientName) return null;
    const client = state.clients.find(c => (c.nome || '').trim().toLowerCase() === clientName.trim().toLowerCase());
    if (!client || client.plano === 'Nenhum' || client.plano === 'Pausado') return null;
    
    // Início padrão
    let cycleStartDate = client.plano_inicio || client.plano_pagamento;
    
    // Pega o pagamento mais recente (inclusive futuro, pois indica uma renovação/reset)
    if (state.allPlanPayments && state.allPlanPayments.length > 0) {
        const clientPayments = state.allPlanPayments
            .filter(p => p.cliente_id == client.id)
            .sort((a, b) => b.data_pagamento.localeCompare(a.data_pagamento));
        
        if (clientPayments.length > 0) {
            cycleStartDate = clientPayments[0].data_pagamento;
        }
    }

    if (!cycleStartDate) return null;

    const visits = state.records.filter(r => {
        const clientNameInRecord = (r.client || r.cliente || '').trim().toLowerCase();
        const targetClientName = client.nome.trim().toLowerCase();
        if (clientNameInRecord !== targetClientName) return false;
        
        // Normalização de data para comparação segura
        const rDate = r.date || r.data;
        if (!rDate) return false;
        
        const isFromCycle = rDate >= cycleStartDate;
        
        // CRITÉRIO RESTRITO: Aceita símbolos ordinais variados ou nenhum símbolo
        const planServicePattern = /\d+\s*[º°]?\s*DIA/i;
        const isPlanService = planServicePattern.test(r.service || r.procedimento || '');
        
        return isFromCycle && isPlanService;
    }).length;

    const limit = parseInt(client.limite_cortes) || 4;
    
    return {
        usageCount: visits,
        nextVisit: visits + 1,
        isWithinLimit: visits < limit,
        startDate: cycleStartDate,
        limit: limit
    };
};

    // --- Helpers de Busca de Clientes (Global) ---
    window.openClientDropdown = () => {
        const dropdown = document.getElementById('clientDropdown');
        const input = document.getElementById('clientSearchInput');
        if (dropdown && input) {
            const val = input.value;
            const filtered = state.clients.filter(c => c.nome.toLowerCase().includes(val.toLowerCase()));
            dropdown.innerHTML = filtered.map(c => {
                const planStats = window.getClientPlanUsage(c.nome);
                const hasPlan = planStats !== null;
                
                return `
                    <div onmousedown="window.selectClient('${c.nome.replace(/'/g, "\\'")}')" 
                         class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${c.nome}</span>
                            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">${c.telefone || 'SEM TELEFONE...'}</span>
                        </div>
                        ${hasPlan ? `
                            <div class="text-right">
                                <span class="${planStats.usageCount >= planStats.limit ? 'text-rose-500' : 'text-emerald-500'} font-black text-[10px] block">
                                    ${planStats.usageCount}/${planStats.limit}
                                </span>
                                <span class="text-[8px] text-slate-600 font-black uppercase tracking-tighter block">CORTES</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.filterClients = (val) => {
        state.clientSearch = val;
        const dropdown = document.getElementById('clientDropdown');
        const hidden = document.querySelector('input[name="client"]');
        if (hidden) hidden.value = val;
        if (dropdown) {
            const filtered = state.clients.filter(c => c.nome.toLowerCase().includes(val.toLowerCase()));
            dropdown.innerHTML = filtered.map(c => {
                const planStats = window.getClientPlanUsage(c.nome);
                const hasPlan = planStats !== null;
                
                return `
                    <div onmousedown="window.selectClient('${c.nome.replace(/'/g, "\\'")}')" 
                         class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${c.nome}</span>
                            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">${c.telefone || 'SEM TELEFONE...'}</span>
                        </div>
                        ${hasPlan ? `
                            <div class="text-right">
                                <span class="${planStats.usageCount >= planStats.limit ? 'text-rose-500' : 'text-emerald-500'} font-black text-[10px] block">
                                    ${planStats.usageCount}/${planStats.limit}
                                </span>
                                <span class="text-[8px] text-slate-600 font-black uppercase tracking-tighter block">CORTES</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.selectClient = (name) => {
        state.clientSearch = name;
        const input = document.getElementById('clientSearchInput');
        const hidden = document.querySelector('input[name="client"]');
        if (input) input.value = name;
        if (hidden) hidden.value = name;
        document.getElementById('clientDropdown')?.classList.add('hidden');

        // Auto-fill logic para Plano
        const usage = window.getClientPlanUsage(name);
        if (usage && usage.isWithinLimit) {
            const form = document.querySelector('form[onsubmit="window.saveNewRecord(event)"]');
            if (form) {
                const serviceInput = form.querySelector('#serviceSearchInput');
                const serviceHidden = form.querySelector('input[name="service"]');
                const valueInput = form.querySelector('input[name="value"]');
                const paymentSelect = form.querySelector('select[name="payment"]');
                
                const planServiceName = `${usage.nextVisit}º DIA`;
                if (serviceInput) serviceInput.value = planServiceName;
                if (serviceHidden) serviceHidden.value = planServiceName;
                if (valueInput) valueInput.value = "0";
                if (paymentSelect) paymentSelect.value = "PLANO MENSAL";
            }
        }
    };

    // --- Helpers para o Modal de Edição ---
    window.openClientDropdownModal = () => {
        const dropdown = document.getElementById('clientDropdownModal');
        const input = document.getElementById('clientSearchInputModal');
        if (dropdown && input) {
            const val = input.value;
            const filtered = state.clients.filter(c => c.nome.toLowerCase().includes(val.toLowerCase()));
            dropdown.innerHTML = filtered.map(c => {
                const planStats = window.getClientPlanUsage(c.nome);
                const hasPlan = planStats !== null;
                
                return `
                    <div onmousedown="window.selectClientModal('${c.nome.replace(/'/g, "\\'")}')" 
                         class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${c.nome}</span>
                            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">${c.telefone || 'SEM TELEFONE...'}</span>
                        </div>
                        ${hasPlan ? `
                            <div class="text-right">
                                <span class="${planStats.usageCount >= planStats.limit ? 'text-rose-500' : 'text-emerald-500'} font-black text-[10px] block">
                                    ${planStats.usageCount}/${planStats.limit}
                                </span>
                                <span class="text-[8px] text-slate-600 font-black uppercase tracking-tighter block">CORTES</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.filterClientsModal = (val) => {
        state.clientSearch = val;
        const dropdown = document.getElementById('clientDropdownModal');
        const hidden = document.querySelector('#clientSearchInputModal')?.parentElement?.querySelector('input[name="client"]');
        if (hidden) hidden.value = val;
        if (dropdown) {
            const filtered = state.clients.filter(c => c.nome.toLowerCase().includes(val.toLowerCase()));
            dropdown.innerHTML = filtered.map(c => {
                const planStats = window.getClientPlanUsage(c.nome);
                const hasPlan = planStats !== null;

                return `
                    <div onmousedown="window.selectClientModal('${c.nome.replace(/'/g, "\\'")}')" 
                         class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                        <div class="flex flex-col">
                            <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${c.nome}</span>
                            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">${c.telefone || 'SEM TELEFONE...'}</span>
                        </div>
                        ${hasPlan ? `
                            <div class="text-right">
                                <span class="${planStats.usageCount >= planStats.limit ? 'text-rose-500' : 'text-emerald-500'} font-black text-[10px] block">
                                    ${planStats.usageCount}/${planStats.limit}
                                </span>
                                <span class="text-[8px] text-slate-600 font-black uppercase tracking-tighter block">CORTES</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.selectClientModal = (name) => {
        state.clientSearch = name;
        const input = document.getElementById('clientSearchInputModal');
        const hidden = document.querySelector('#clientSearchInputModal')?.parentElement?.querySelector('input[name="client"]');
        if (input) input.value = name;
        if (hidden) hidden.value = name;
        document.getElementById('clientDropdownModal')?.classList.add('hidden');

        // Auto-fill logic para Plano (Modal)
        const usage = window.getClientPlanUsage(name);
        if (usage && usage.isWithinLimit) {
            const form = document.querySelector('.glass-card form[onsubmit="window.saveNewRecord(event)"]');
            if (form) {
                const serviceInput = form.querySelector('#serviceSearchInputModal');
                const serviceHidden = form.querySelector('input[name="service"]');
                const valueInput = form.querySelector('input[name="value"]');
                const paymentSelect = form.querySelector('select[name="payment"]');
                
                const planServiceName = `${usage.nextVisit}º DIA`;
                if (serviceInput) serviceInput.value = planServiceName;
                if (serviceHidden) serviceHidden.value = planServiceName;
                if (valueInput) valueInput.value = "0";
                if (paymentSelect) paymentSelect.value = "PLANO MENSAL";
            }
        }
    };

    // --- Helpers de Busca de Procedimentos (Global/Manage) ---
    window.openProcedureDropdown = () => {
        const dropdown = document.getElementById('procedureDropdown');
        const input = document.getElementById('serviceSearchInput');
        if (dropdown && input) {
            const val = input.value.toLowerCase();
            const filtered = state.procedures.filter(p => p.nome.toLowerCase().includes(val));
            dropdown.innerHTML = filtered.map(p => `
                <div onmousedown="window.selectProcedure('${p.nome.replace(/'/g, "\\'")}', ${p.preco})" 
                     class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                    <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${p.nome}</span>
                    <span class="text-[10px] font-black text-amber-500/50 group-hover:text-amber-500">R$ ${p.preco.toFixed(2)}</span>
                </div>
            `).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum serviço encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.filterProcedures = (val) => {
        const dropdown = document.getElementById('procedureDropdown');
        const hidden = document.querySelector('input[name="service"]');
        if (hidden) hidden.value = val;
        if (dropdown) {
            const filtered = state.procedures.filter(p => p.nome.toLowerCase().includes(val.toLowerCase()));
            dropdown.innerHTML = filtered.map(p => `
                <div onmousedown="window.selectProcedure('${p.nome.replace(/'/g, "\\'")}', ${p.preco})" 
                     class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                    <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${p.nome}</span>
                    <span class="text-[10px] font-black text-amber-500/50 group-hover:text-amber-500">R$ ${p.preco.toFixed(2)}</span>
                </div>
            `).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum serviço encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.selectProcedure = (name, price) => {
        const input = document.getElementById('serviceSearchInput');
        const hidden = document.querySelector('input[name="service"]');
        const priceInput = document.querySelector('input[name="value"]');
        if (input) input.value = name;
        if (hidden) hidden.value = name;
        if (priceInput && price) priceInput.value = price;
        document.getElementById('procedureDropdown')?.classList.add('hidden');
    };

    // --- Helpers de Busca de Procedimentos (Modal) ---
    window.openProcedureDropdownModal = () => {
        const dropdown = document.getElementById('procedureDropdownModal');
        const input = document.getElementById('serviceSearchInputModal');
        if (dropdown && input) {
            const val = input.value.toLowerCase();
            const filtered = state.procedures.filter(p => p.nome.toLowerCase().includes(val));
            dropdown.innerHTML = filtered.map(p => `
                <div onmousedown="window.selectProcedureModal('${p.nome.replace(/'/g, "\\'")}', ${p.preco})" 
                     class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                    <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${p.nome}</span>
                    <span class="text-[10px] font-black text-amber-500/50 group-hover:text-amber-500">R$ ${p.preco.toFixed(2)}</span>
                </div>
            `).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum serviço encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.filterProceduresModal = (val) => {
        const dropdown = document.getElementById('procedureDropdownModal');
        const hidden = document.querySelector('#serviceSearchInputModal')?.parentElement?.querySelector('input[name="service"]');
        if (hidden) hidden.value = val;
        if (dropdown) {
            const filtered = state.procedures.filter(p => p.nome.toLowerCase().includes(val.toLowerCase()));
            dropdown.innerHTML = filtered.map(p => `
                <div onmousedown="window.selectProcedureModal('${p.nome.replace(/'/g, "\\'")}', ${p.preco})" 
                     class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                    <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${p.nome}</span>
                    <span class="text-[10px] font-black text-amber-500/50 group-hover:text-amber-500">R$ ${p.preco.toFixed(2)}</span>
                </div>
            `).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum serviço encontrado.</div>`;
            dropdown.classList.remove('hidden');
        }
    };

    window.selectProcedureModal = (name, price) => {
        const input = document.getElementById('serviceSearchInputModal');
        const hidden = document.querySelector('#serviceSearchInputModal')?.parentElement?.querySelector('input[name="service"]');
        const priceInput = document.querySelector('.glass-card input[name="value"]');
        if (input) input.value = name;
        if (hidden) hidden.value = name;
        if (priceInput && price) priceInput.value = price;
        document.getElementById('procedureDropdownModal')?.classList.add('hidden');
    };

    window.updatePriceByService = (serviceName) => {
        const proc = state.procedures.find(p => p.nome === serviceName);
        if (proc) {
            const input = document.querySelector('input[name="value"]');
            if (input) input.value = proc.preco;
        }
    };

    window.handleEnterSelection = (e, dropdownId) => {
        if (e.key === 'Enter') {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown && !dropdown.classList.contains('hidden')) {
                const firstOption = dropdown.querySelector('div');
                if (firstOption) {
                    e.preventDefault();
                    // Dispara o mousedown para acionar a lógica de seleção
                    const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
                    firstOption.dispatchEvent(mousedownEvent);
                    
                    // Esconde o dropdown manualmente para garantir
                    dropdown.classList.add('hidden');
                    return true;
                }
            }
        }
        return false;
    };

    window.saveNewRecord = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button[type="submit"]');
        const isEditing = !!(state.editingRecord && state.editingRecord.id);
        
        const recordData = {
            data: formData.get('date'),
            horario: formData.get('time'),
            cliente: formData.get('client'),
            procedimento: formData.get('service'),
            valor: parseFloat(formData.get('value')) || 0,
            forma_pagamento: formData.get('payment'),
            observacoes: formData.get('observations')
        };

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const url = isEditing ? `${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${state.editingRecord.id}` : `${SUPABASE_URL}/rest/v1/agendamentos`;
            const res = await fetch(url, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify(recordData)
            });

            if (res.ok) {
                alert('✅ Sucesso!');
                state.editingRecord = null;
                state.isEditModalOpen = false;
                state.currentPage === 'manage' ? navigate('records') : render();
                syncFromSheet(state.sheetUrl);
            } else {
                const err = await res.json();
                alert(`Erro: ${err.message}`);
            }
        } catch (err) { alert('Erro de conexão.'); }
        finally { 
            btn.disabled = false; 
            btn.innerHTML = isEditing ? 'Salvar Alterações' : 'Salvar Agendamento'; 
        }
    };

    window.saveInlineEdit = async (el) => {
        const id = el.dataset.id;
        const uiId = el.dataset.uiId;
        const field = el.dataset.field;
        let value = (el.tagName === 'SELECT' || el.tagName === 'INPUT' ? el.value : el.innerText).trim();
        const time = el.dataset.time;
        const date = el.dataset.date;


        // Se mudou data ou hora e for um registro novo, atualiza a "intenção" nos irmãos para o próximo campo
        if (id === 'new' && (field === 'time' || field === 'date')) {
            document.querySelectorAll(`[data-ui-id="${uiId}"]`).forEach(sibling => {
                if (field === 'time') sibling.dataset.time = value;
                if (field === 'date') sibling.dataset.date = value;
            });
        }

        // Mapeamento de campos para o Supabase
        const fieldMap = {
            client: 'cliente',
            service: 'procedimento',
            value: 'valor',
            payment: 'forma_pagamento',
            time: 'horario',
            date: 'data',
            observations: 'observacoes'
        };

        const dbField = fieldMap[field];
        if (!dbField) return;

        // Se for valor, converter para número
        let finalValue = value;
        if (field === 'value') finalValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

        // Detectar se o cliente tem plano
        const planUsage = field === 'client' ? window.getClientPlanUsage(value) : null;
        if (planUsage && planUsage.isWithinLimit) {
            const serviceEl = document.querySelector(`[data-ui-id="${uiId}"][data-field="service"]`);
            const valueEl = document.querySelector(`[data-ui-id="${uiId}"][data-field="value"]`);
            const paymentEl = document.querySelector(`[data-ui-id="${uiId}"][data-field="payment"]`);
            
            if (serviceEl) serviceEl.innerText = `${planUsage.nextVisit}º DIA`;
            if (valueEl) valueEl.innerText = "0.00";
            if (paymentEl) paymentEl.value = "PLANO MENSAL";
        }

        // Prevenir salvamentos múltiplos enquanto um está em andamento
        if (el.dataset.isSaving === "true") return;

        try {
            if (id === 'new') {
                if (field === 'client' && value !== '' && value !== '---') {
                    el.dataset.isSaving = "true";
                    
                    const serviceVal = document.querySelector(`[data-ui-id="${uiId}"][data-field="service"]`)?.innerText.trim() || 'A DEFINIR';
                    const priceVal = parseFloat(document.querySelector(`[data-ui-id="${uiId}"][data-field="value"]`)?.innerText.trim()) || 0;
                    const paymentVal = document.querySelector(`[data-ui-id="${uiId}"][data-field="payment"]`)?.value || 'PIX';

                    const recordData = {
                        data: date,
                        horario: time,
                        cliente: value,
                        procedimento: serviceVal,
                        valor: priceVal,
                        forma_pagamento: paymentVal,
                        observacoes: document.querySelector(`[data-ui-id="${uiId}"][data-field="observations"]`)?.innerText.trim() === 'Nenhuma obs...' ? '' : document.querySelector(`[data-ui-id="${uiId}"][data-field="observations"]`)?.innerText.trim()
                    };
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos`, {
                        method: 'POST',
                        headers: { 
                            'apikey': SUPABASE_KEY, 
                            'Authorization': 'Bearer ' + SUPABASE_KEY, 
                            'Content-Type': 'application/json', 
                            'Prefer': 'return=representation' 
                        },
                        body: JSON.stringify(recordData)
                    });
                    if (res.ok) {
                        const savedData = await res.json();
                        if (savedData && savedData[0]) {
                            const newId = savedData[0].id;
                            // Atualizar IDs dos irmãos para que próximos edits sejam PATCH
                            document.querySelectorAll(`[data-ui-id="${uiId}"]`).forEach(s => {
                                s.dataset.id = newId;
                            });
                            syncFromSheet(state.sheetUrl);
                        }
                    }
                    delete el.dataset.isSaving;
                }
            } else {
                let recordData = { [dbField]: finalValue };
                // Se o serviço mudou para algo tipo "1º DIA", garantir que valor e pagamento subam junto
                if (field === 'service' && /\d+º\s*DIA/i.test(value)) {
                    recordData.forma_pagamento = 'PLANO MENSAL';
                    recordData.valor = 0;
                }
                const res = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${id}`, {
                    method: 'PATCH',
                    headers: { 
                        'apikey': SUPABASE_KEY, 
                        'Authorization': 'Bearer ' + SUPABASE_KEY, 
                        'Content-Type': 'application/json', 
                        'Prefer': 'return=representation' 
                    },
                    body: JSON.stringify(recordData)
                });
                if (res.ok) {
                    syncFromSheet(state.sheetUrl);
                }
            }
        } catch (err) { 
            console.error('Erro no salvamento inline:', err); 
        }
    };

    window.handleInlineKey = (e) => {
        const id = e.target.dataset.id;
        const uiId = e.target.dataset.uiId;
        const field = e.target.dataset.field;

        if (e.key === 'Enter') {
            e.preventDefault();
            
            // Se houver autocomplete aberto, seleciona a primeira opção
            // Tenta encontrar o dropdown (seja de agendamento ou de despesas)
            const dropdown = document.getElementById(`inlineAutocomplete_${field}_${uiId}`) || 
                             document.getElementById(`expenseAutocomplete_${id}`);

            if (dropdown && !dropdown.classList.contains('hidden')) {
                const firstOption = dropdown.querySelector('div');
                if (firstOption) {
                    // Simular mousedown para disparar o handler de seleção (selectInlineData ou selectExpenseCard)
                    const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
                    firstOption.dispatchEvent(mousedownEvent);
                    return;
                }
            }
            
            e.target.blur();
            return;
        }
    };

    window.showExpenseAutocomplete = (el, isModal = false, type = 'card') => {
        const id = isModal ? `${type}_modal` : el.dataset.id;
        const val = (isModal ? el.value : el.innerText).trim().toLowerCase();
        const dropdown = document.getElementById(`expenseAutocomplete_${id}`);
        if (!dropdown) return;

        if (val.length < 1) { dropdown.classList.add('hidden'); return; }

        let matches = [];
        if (type === 'card') {
            matches = state.cards.filter(c => c.nome.toLowerCase().includes(val)).slice(0, 5);
        } else if (type === 'desc') {
            const commonDescs = [...new Set(state.expenses.map(e => e.descricao))];
            matches = commonDescs.filter(d => d && d.toLowerCase().includes(val)).slice(0, 5).map(d => ({ nome: d }));
        }

        if (matches.length === 0) { dropdown.classList.add('hidden'); return; }

        dropdown.innerHTML = matches.map(match => `
            <div class="px-3 py-2 hover:bg-amber-500 hover:text-dark-950 cursor-pointer rounded-lg transition-colors font-bold uppercase truncate text-[11px]"
                 onmousedown="window.selectExpenseData('${id}', '${match.nome}', ${isModal}, '${type}')">
                <i class="fas ${type === 'card' ? 'fa-credit-card' : 'fa-tag'} mr-2 text-[10px] text-amber-500/50"></i>
                ${match.nome}
            </div>
        `).join('');
        dropdown.classList.remove('hidden');
    };

    window.selectExpenseData = (id, value, isModal = false, type = 'card') => {
        if (isModal) {
            const fieldName = type === 'card' ? 'cartao' : 'descricao';
            const el = document.querySelector(`#expenseModal input[name="${fieldName}"]`);
            if (el) el.value = value.toUpperCase();
            const dropdown = document.getElementById(`expenseAutocomplete_${id}`);
            if (dropdown) dropdown.classList.add('hidden');
        } else {
            const el = document.querySelector(`[data-field="cartao"][data-id="${id}"]`);
            if (el) {
                el.innerText = value.toUpperCase();
                el.dataset.beganTyping = "false";
                const dropdown = document.getElementById(`expenseAutocomplete_${id}`);
                if (dropdown) dropdown.classList.add('hidden');
                window.saveExpenseInline(el);
            }
        }
    };

    window.maskParcela = (el) => {
        let value = el.value.replace(/[^\d/]/g, ""); 
        const parts = value.split("/");
        if (parts.length > 2) value = parts[0] + "/" + parts[1];
        if (parts[0] && parts[0].length > 2) value = parts[0].substring(0, 2) + (parts[1] !== undefined ? "/" + parts[1] : "");
        if (parts[1] && parts[1].length > 2) value = (parts[0] || "") + "/" + parts[1].substring(0, 2);
        el.value = value;
    };

    window.showInlineAutocomplete = (el) => {
        const id = el.dataset.id;
        const uiId = el.dataset.uiId;
        const field = el.dataset.field;
        if (field !== 'client' && field !== 'service') return;

        const val = el.innerText.trim().toLowerCase();
        const dropdown = document.getElementById(`inlineAutocomplete_${field}_${uiId}`);
        if (!dropdown) return;

        if (val.length < 1) {
            dropdown.classList.add('hidden');
            return;
        }

        let matches = [];
        if (field === 'client') {
            matches = state.clients.filter(c => c.nome.toLowerCase().includes(val)).slice(0, 5).map(c => c.nome);
        } else {
            matches = state.procedures.filter(p => p.nome.toLowerCase().includes(val)).slice(0, 5).map(p => p.nome);
        }

        if (matches.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }

        dropdown.innerHTML = matches.map(name => `
            <div class="px-3 py-2 hover:bg-amber-500 hover:text-dark-950 cursor-pointer rounded-lg transition-colors font-bold uppercase truncate text-[11px]"
                 onmousedown="window.selectInlineData(this, '${uiId}', '${field}', '${name}')">
                <i class="fas ${field === 'service' ? 'fa-cut' : 'fa-user text-slate-400'} mr-2 text-[10px]"></i>
                ${name}
            </div>
        `).join('');
        dropdown.classList.remove('hidden');
    };

    window.selectInlineData = (dropdownEl, uiId, field, value) => {
        const el = document.querySelector(`[data-ui-id="${uiId}"][data-field="${field}"]`);
        if (el) {
            el.innerText = value;
            el.dataset.beganTyping = "false";
            dropdownEl.parentElement.classList.add('hidden');
            
            const isNew = el.dataset.id === 'new';

            if (field === 'client') {
                const usage = window.getClientPlanUsage(value);
                if (usage && usage.isWithinLimit) {
                    const serviceEl = document.querySelector(`[data-ui-id="${uiId}"][data-field="service"]`);
                    const valueEl = document.querySelector(`[data-ui-id="${uiId}"][data-field="value"]`);
                    const paymentSelect = document.querySelector(`[data-ui-id="${uiId}"][data-field="payment"]`);
                    
                    if (serviceEl) serviceEl.innerText = `${usage.nextVisit}º DIA`;
                    if (valueEl) valueEl.innerText = "0.00";
                    if (paymentSelect) paymentSelect.value = "PLANO MENSAL";

                    // Se não for novo, dispara o save para cada campo. 
                    if (!isNew) {
                        if (serviceEl) window.saveInlineEdit(serviceEl);
                        if (valueEl) window.saveInlineEdit(valueEl);
                        if (paymentSelect) window.saveInlineEdit(paymentSelect);
                    }
                }
            }
            
            if (field === 'service') {
                const proc = state.procedures.find(p => p.nome === value);
                if (proc) {
                    const priceEl = document.querySelector(`[data-ui-id="${uiId}"][data-field="value"]`);
                    if (priceEl) {
                        priceEl.innerText = proc.preco.toFixed(2);
                        if (!isNew) window.saveInlineEdit(priceEl);
                    }
                }
            }
            
            window.saveInlineEdit(el);
        }
    };

    window.handleInlineTyping = null; // Removido, usando handleInlineKey agora

    window.clearPlaceholder = (el) => {
        el.dataset.beganTyping = "false";
        // Ocultar outros autocompletes
        document.querySelectorAll('[id^="inlineAutocomplete_"]').forEach(d => d.classList.add('hidden'));
        if (el.innerText === '---') {
            el.innerText = '';
            el.dataset.beganTyping = "true";
        } else {
            // Selecionar tudo para permitir substituição instantânea
            window.selectAll(el);
        }
    };

    window.setToBreak = (isModal = true) => {
        const suffix = isModal ? 'Modal' : '';
        const clientInput = document.getElementById(`clientSearchInput${suffix}`);
        const clientHidden = document.querySelector(isModal ? '#clientSearchInputModal' : '#clientSearchInput')?.parentElement?.querySelector('input[name="client"]');
        
        const serviceSearchInput = document.getElementById(`serviceSearchInput${suffix}`);
        const serviceHidden = document.querySelector(isModal ? '#serviceSearchInputModal' : '#serviceSearchInput')?.parentElement?.querySelector('input[name="service"]');
        
        const form = clientInput.closest('form');
        const valueInput = form?.querySelector('input[name="value"]');
        const paymentSelect = form?.querySelector('select[name="payment"]');

        if (clientInput) clientInput.value = 'PAUSA';
        if (clientHidden) clientHidden.value = 'PAUSA';
        if (serviceSearchInput) serviceSearchInput.value = 'BLOQUEADO';
        if (serviceHidden) serviceHidden.value = 'BLOQUEADO';
        if (valueInput) valueInput.value = '0';
        if (paymentSelect) paymentSelect.value = 'CORTESIA';
    };

    // Click global para fechar dropdowns
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#clientSearchInput') && !e.target.closest('#clientDropdown')) {
            document.getElementById('clientDropdown')?.classList.add('hidden');
        }
        if (!e.target.closest('#clientSearchInputModal') && !e.target.closest('#clientDropdownModal')) {
            document.getElementById('clientDropdownModal')?.classList.add('hidden');
        }
        if (!e.target.closest('#serviceSearchInput') && !e.target.closest('#procedureDropdown')) {
            document.getElementById('procedureDropdown')?.classList.add('hidden');
        }
        if (!e.target.closest('#serviceSearchInputModal') && !e.target.closest('#procedureDropdownModal')) {
            document.getElementById('procedureDropdownModal')?.classList.add('hidden');
        }
        if (!e.target.closest('[id^="inlineAutocomplete_"]')) {
            document.querySelectorAll('[id^="inlineAutocomplete_"]').forEach(d => d.classList.add('hidden'));
        }
    });

    window.hasGlobalHandlers = true;
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    fetchClients();
    fetchProcedures();
    fetchAllPlanPayments(); // Carrega cache global de pagamentos para estatísticas e planos
    render();
    if (state.sheetUrl) {
        syncFromSheet(state.sheetUrl);
    }
});
