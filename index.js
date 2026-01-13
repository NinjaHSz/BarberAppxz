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
    managementSearch: ''
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
                        const key = `${r.data}_${r.horario}_${r.cliente}`.toLowerCase();
                        recordMap.set(key, {
                            id: r.id,
                            date: r.data,
                            time: r.horario,
                            client: r.cliente,
                            service: r.procedimento || 'Geral',
                            value: parseFloat(r.valor) || 0,
                            paymentMethod: r.forma_pagamento || 'N/A'
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
                        service: r.service || 'Geral',
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
                        const serviceName = cols[mapping.service] || 'Geral';

                        if (clientName && clientName.length > 1) {
                            const key = `${dateStr}_${timeStr}_${clientName}_${serviceName}`.toLowerCase();
                            if (!recordMap.has(key)) {
                                recordMap.set(key, {
                                    date: dateStr,
                                    time: timeStr,
                                    client: clientName,
                                    service: serviceName,
                                    value: isNaN(cleanVal) ? 0 : cleanVal,
                                    paymentMethod: cols[mapping.method] || 'N/A'
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
    if (state.records.length === 0) return;

    // Filtro baseado na seleção do usuário
    const targetDay = state.filters.day;
    const targetMonth = String(state.filters.month).padStart(2, '0');
    const targetYear = String(state.filters.year);
    const monthPrefix = `${targetYear}-${targetMonth}`;
    const dayPrefix = `${monthPrefix}-${String(targetDay).padStart(2, '0')}`;

    const calcTotal = (filterFn) => state.records.filter(filterFn).reduce((acc, r) => acc + r.value, 0);

    // Diário: Se 'Todos' (0) estiver selecionado, mostra o dia atual real, senão mostra o dia filtrado
    const displayDay = targetDay === 0 ? new Date().toISOString().split('T')[0] : dayPrefix;
    
    const daily = calcTotal(r => r.date === displayDay);
    const monthly = calcTotal(r => r.date.startsWith(monthPrefix));
    const annual = calcTotal(r => r.date.startsWith(targetYear));
    
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
function navigate(page) {
    state.currentPage = page;
    state.clientSearch = ''; // Limpa a busca ao navegar
    state.isClientDropdownOpen = false;
    if (page !== 'manage') state.editingRecord = null;
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
            ${NavLink('manage', 'fa-calendar-plus', 'Agendar')}
            ${NavLink('clients', 'fa-sliders', 'Gestão')}
            ${NavLink('setup', 'fa-gears', 'Configuração')}
        </nav>
        <div class="p-4 border-t border-white/5">
            <div class="flex items-center space-x-3 p-2 rounded-xl bg-dark-950/50">
                <div class="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-dark-900 shadow-lg shadow-black/20">
                    <img src="assets/logo.png" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=Lucas+do+Corte&background=F59E0B&color=000'">
                </div>
                <div class="flex-1 min-w-0">
                    <!-- Nome do Barbeiro/Perfil -->
                    <p class="text-sm font-semibold truncate text-white">Lucas do Corte</p>
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
                class="flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200 group 
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
        ${MobileNavLink('manage', 'fa-calendar-plus', 'Agendar')}
        ${MobileNavLink('clients', 'fa-sliders', 'Gestão')}
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
        <header class="h-16 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-dark-950/80 backdrop-blur-xl sticky top-0 z-20">
            <div class="flex items-center space-x-2 md:space-x-4">
                <!-- Filtro de Dia -->
                <select onchange="window.updateFilter('day', this.value)" class="bg-dark-900 border border-white/10 text-[10px] md:text-xs font-bold rounded-lg px-2 md:px-3 py-1.5 outline-none focus:border-amber-500 w-16 md:w-auto">
                    ${days.map(d => `<option value="${d}" ${state.filters.day === d ? 'selected' : ''}>${String(d).padStart(2, '0')}</option>`).join('')}
                </select>
                <!-- Filtro de Mês -->
                <select onchange="window.updateFilter('month', this.value)" class="bg-dark-900 border border-white/10 text-[10px] md:text-xs font-bold rounded-lg px-2 md:px-3 py-1.5 outline-none focus:border-amber-500 w-24 md:w-auto">
                    ${months.map((m, i) => `<option value="${i+1}" ${state.filters.month === i+1 ? 'selected' : ''}>${m.substring(0, 3)}</option>`).join('')}
                </select>
                <!-- Filtro de Ano -->
                <select onchange="window.updateFilter('year', this.value)" class="bg-dark-900 border border-white/10 text-[10px] md:text-xs font-bold rounded-lg px-2 md:px-3 py-1.5 outline-none focus:border-amber-500">
                    <option value="2025" ${state.filters.year === 2025 ? 'selected' : ''}>25</option>
                    <option value="2026" ${state.filters.year === 2026 ? 'selected' : ''}>26</option>
                </select>
            </div>

            <div class="flex items-center space-x-4">
                <div class="hidden sm:flex items-center space-x-2 text-xs md:text-sm text-slate-400">
                    <i class="fas fa-calendar"></i>
                    <span class="font-medium">${formattedDate}</span>
                </div>
                
                <!-- Logo Mobile -->
                <div class="md:hidden flex items-center">
                    <h1 class="text-base font-display font-extrabold text-amber-500 italic whitespace-nowrap">LUCAS <span class="text-white">DO CORTE</span></h1>
                </div>

                <button onclick="window.syncAll()" class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/5 hover:bg-amber-500/10 hover:text-amber-500 transition-all flex items-center justify-center border border-white/5">
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
                    <button onclick="navigate('setup')" class="bg-amber-500 text-dark-950 px-6 py-2 rounded-xl font-bold">Configurar Agora</button>
                </div>
            </div>
        `;
    }

    window.renderCharts = () => {
        if (state.charts.payment) state.charts.payment.destroy();
        if (state.charts.profit) state.charts.profit.destroy();

        const targetDay = parseInt(state.filters.day);
        const targetMonth = String(state.filters.month).padStart(2, '0');
        const targetYear = String(state.filters.year);
        const monthPrefix = `${targetYear}-${targetMonth}`;
        const dayPrefix = `${monthPrefix}-${String(targetDay).padStart(2, '0')}`;

        // Filtro para o gráfico de pizza (respeita os filtros globais da página)
        const paymentRecords = state.records.filter(r => {
            return targetDay === 0 ? r.date.startsWith(monthPrefix) : r.date === dayPrefix;
        });

        const paymentStats = paymentRecords.reduce((acc, r) => {
            const method = (r.paymentMethod || 'N/A').toUpperCase().trim();
            acc[method] = (acc[method] || 0) + r.value;
            return acc;
        }, {});

        const ctx1 = document.getElementById('paymentChart')?.getContext('2d');
        if (ctx1) {
            state.charts.payment = new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(paymentStats),
                    datasets: [{
                        data: Object.values(paymentStats),
                        backgroundColor: [
                            state.theme.accent, // Destaque Principal
                            '#38bdf8', // Blue 400
                            '#818cf8', // Indigo 400
                            '#fb7185', // Rose 400
                            '#34d399', // Emerald 400
                            '#94a3b8', // Slate 400
                            '#475569'  // Slate 600
                        ],
                        borderWidth: 0,
                        hoverOffset: 20
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: { legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 10, weight: 'bold' }, padding: 20, usePointStyle: true } } }
                }
            });
        }

        // --- Gráfico de Lucro com Filtro Próprio ---
        let profitRecords = [];
        let groupKeyFn;
        let labelFn = (k) => k;

        if (state.profitFilter === 'diario') {
            profitRecords = state.records.filter(r => r.date === (targetDay === 0 ? new Date().toISOString().split('T')[0] : dayPrefix));
            groupKeyFn = (r) => r.time.split(':')[0] + ':00';
        } else if (state.profitFilter === 'mensal') {
            profitRecords = state.records.filter(r => r.date.startsWith(monthPrefix));
            groupKeyFn = (r) => r.date.split('-')[2];
            labelFn = (k) => `Dia ${k}`;
        } else if (state.profitFilter === 'anual') {
            profitRecords = state.records.filter(r => r.date.startsWith(targetYear));
            groupKeyFn = (r) => r.date.split('-')[1];
            const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            labelFn = (k) => monthNames[parseInt(k) - 1];
        } else { // total
            profitRecords = state.records;
            groupKeyFn = (r) => r.date.split('-')[0];
        }

        const profitStats = profitRecords.reduce((acc, r) => {
            const key = groupKeyFn(r);
            acc[key] = (acc[key] || 0) + r.value;
            return acc;
        }, {});

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
        <div class="p-4 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex justify-between items-end">
                <div>
                    <!-- Título Principal Dashboard -->
                    <h2 class="text-2xl sm:text-3xl font-display font-bold">Lucas do Corte - BI</h2>
                    <!-- Subtítulo ou Descrição -->
                    <p class="text-slate-500 text-xs sm:text-sm mt-1">Gestão financeira e performance estratégica</p>
                </div>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                ${KPICard('Faturamento do Dia', state.kpis.diario, 'fa-calendar-day')}
                ${KPICard('Faturamento do Mês', state.kpis.mensal, 'fa-calendar-days')}
                ${KPICard('Faturamento do Ano', state.kpis.anual, 'fa-calendar-check')}
            </div>

            <!-- Charts -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 pb-8">
                <div class="glass-card p-6 sm:p-8 rounded-[2rem] h-[400px] sm:h-[450px] flex flex-col">
                    <h3 class="text-lg font-bold mb-6 sm:mb-8">Formas de Pagamento</h3>
                    <div class="flex-1 min-h-0 flex items-center justify-center">
                        <canvas id="paymentChart"></canvas>
                    </div>
                </div>
                <div class="glass-card p-6 sm:p-8 rounded-[2rem] h-[400px] sm:h-[450px] flex flex-col">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                        <h3 class="text-lg font-bold">Lucro Bruto</h3>
                        <div class="flex bg-dark-950 p-1 rounded-xl border border-white/5 space-x-1 overflow-x-auto max-w-full no-scrollbar">
                            ${['diario', 'mensal', 'anual', 'total'].map(f => `
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
                    <button onclick="navigate('setup')" class="bg-amber-500 text-dark-950 px-6 py-2 rounded-xl font-bold">Conectar Planilha</button>
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
            .filter(r => r.client.toLowerCase().includes(state.searchTerm.toLowerCase()) || 
                         r.service.toLowerCase().includes(state.searchTerm.toLowerCase()));
    } else {
        // Se for um dia específico, usamos a lógica de planilha
        const existingForDay = state.records.filter(r => r.date === dayPrefix);
        
        // Se houver busca, filtramos apenas os existentes
        if (state.searchTerm) {
            recordsToDisplay = existingForDay.filter(r => 
                r.client.toLowerCase().includes(state.searchTerm.toLowerCase()) || 
                r.service.toLowerCase().includes(state.searchTerm.toLowerCase())
            );
        } else {
            // Criamos um set de IDs já exibidos para não duplicar
            const displayedIds = new Set();
            recordsToDisplay = [];

            // Primeiro, iteramos pelos horários padrão
            standardTimes.forEach(time => {
                const matches = existingForDay.filter(r => r.time.startsWith(time.substring(0, 5)));
                if (matches.length > 0) {
                    matches.forEach(m => {
                        recordsToDisplay.push(m);
                        displayedIds.add(m.id);
                    });
                } else {
                    recordsToDisplay.push({ time, client: '---', service: '---', value: 0, paymentMethod: '---', isEmpty: true });
                }
            });

            // Depois, adicionamos qualquer registro que sobrou (horários fora do padrão)
            existingForDay.forEach(r => {
                if (!displayedIds.has(r.id)) {
                    recordsToDisplay.push(r);
                }
            });

            // Ordena por horário final
            recordsToDisplay.sort((a, b) => a.time.localeCompare(b.time));

            // Filtra espaços vazios se o usuário desejar
            if (!state.showEmptySlots) {
                recordsToDisplay = recordsToDisplay.filter(r => !r.isEmpty);
            }
        }
    }

    window.editAppointment = (id) => {
        const record = state.records.find(r => r.id === id);
        if (record) {
            state.editingRecord = record;
            state.currentPage = 'manage';
            render();
        }
    };

    window.cancelAppointment = async (id) => {
        if (!confirm('Deseja realmente cancelar este agendamento? Esta ação não pode ser desfeita.')) return;

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                }
            });

            if (res.ok) {
                syncFromSheet(state.sheetUrl); // Recarrega os dados
            } else {
                alert('❌ Erro ao cancelar agendamento.');
            }
        } catch (err) {
            alert('❌ Erro de conexão.');
        }
    };

    window.handleSearch = (e) => {
        state.searchTerm = e.value;
        render(); // Re-renderiza para aplicar a lógica de planilha/lista
    };

    window.toggleEmptySlots = () => {
        state.showEmptySlots = !state.showEmptySlots;
        render();
    };

    return `
        <div class="p-4 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
             <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 class="text-2xl sm:text-3xl font-display font-bold">Histórico de Agendamentos</h2>
                    <p class="text-slate-500 text-xs sm:text-sm mt-1">Sincronização via Google Sheets</p>
                </div>
                <div class="relative w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                    <button onclick="window.toggleEmptySlots()" 
                            class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 bg-dark-900/50 hover:bg-amber-500/10 transition-all text-[10px] font-black uppercase tracking-widest ${state.showEmptySlots ? 'text-amber-500' : 'text-slate-500'}">
                        <i class="fas ${state.showEmptySlots ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        ${state.showEmptySlots ? 'Ocultar Vazios' : 'Mostrar Vazios'}
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
            <div class="space-y-4 md:space-y-0 md:bg-dark-900/30 md:rounded-[2rem] border border-white/5 overflow-hidden">
                <!-- Header (Apenas Desktop) -->
                <div class="hidden md:flex bg-white/[0.02] border-b border-white/5 px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                    <div class="w-20 text-left">Horário</div>
                    <div class="flex-1 text-left px-4">Cliente</div>
                    <div class="flex-1 text-left px-4">Procedimentos</div>
                    <div class="w-28">Valor</div>
                    <div class="w-32">Pagamento</div>
                    <div class="w-24 text-right">Ações</div>
                </div>

                <div id="tableBody" class="divide-y divide-white/5">
                    ${recordsToDisplay.map(r => RecordRow(r)).join('')}
                </div>
            </div>
        </div>
    `;
};

const RecordRow = (record) => {
    const isEmpty = !!record.isEmpty;
    const isDayZero = state.filters.day === 0;

    return `
        <div class="flex flex-col md:flex-row items-center md:items-center px-6 md:px-8 py-4 md:py-4 gap-4 md:gap-0 hover:bg-white/[0.01] transition-colors group relative md:static glass-card md:bg-transparent rounded-2xl md:rounded-none m-2 md:m-0 border md:border-0 border-white/5 ${isEmpty ? 'opacity-40' : ''}">
            <div class="w-full md:w-20 text-xs md:text-sm ${isEmpty ? 'text-slate-500' : 'text-amber-500 md:text-slate-400'} font-black md:font-medium flex justify-between md:block">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Horário:</span>
                ${record.time.substring(0, 5)}
            </div>
            
            <div class="w-full md:flex-1 md:px-4 text-sm md:text-sm font-bold md:font-semibold flex justify-between md:block">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Cliente:</span>
                <div class="truncate transition-colors ${!isEmpty ? 'group-hover:text-amber-500' : 'text-slate-600'}">${record.client}</div>
            </div>

            <div class="w-full md:flex-1 md:px-4 text-xs md:text-sm text-slate-400 flex justify-between md:block">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Serviço:</span>
                <div class="truncate ${isEmpty ? 'text-slate-600' : ''}">${record.service}</div>
            </div>

            <div class="w-full md:w-28 text-sm md:text-sm font-bold md:font-bold ${isEmpty ? 'text-slate-600' : 'text-white md:text-amber-500/90'} flex justify-between md:block md:text-center">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Valor:</span>
                ${isEmpty ? '---' : `R$ ${record.value.toFixed(2)}`}
            </div>

            <div class="w-full md:w-32 flex justify-between md:justify-center items-center">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Pagamento:</span>
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-black border border-white/5 bg-white/[0.03] text-slate-500 uppercase tracking-tighter ${isEmpty ? 'opacity-30' : ''}">
                    ${record.paymentMethod}
                </span>
            </div>

            <div class="w-full md:w-24 flex justify-end gap-2 pt-4 md:pt-0 border-t md:border-0 border-white/5">
                ${!isEmpty ? `
                    <button onclick="window.editAppointment(${record.id})" 
                            class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                    <button onclick="window.cancelAppointment(${record.id})" 
                            class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center">
                        <i class="fas fa-trash-can text-xs"></i>
                    </button>
                ` : `
                    <button onclick="window.navigate('manage')" 
                            class="w-full md:w-auto px-4 py-2 md:py-1 rounded-lg bg-white/5 text-slate-500 hover:bg-amber-500/10 hover:text-amber-500 text-[10px] font-bold uppercase transition-all">
                        Agendar
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

    const isEditing = !!state.editingRecord;

    // Inicializa a busca se estiver editando
    if (isEditing && !state.clientSearch) {
        state.clientSearch = state.editingRecord.client || state.editingRecord.cliente;
    }

// --- Helper para Pesquisa de Clientes ---
window.openClientDropdown = () => {
    const dropdown = document.getElementById('clientDropdown');
    const input = document.getElementById('clientSearchInput');
    if (dropdown && input) {
        const val = input.value;
        const filtered = state.clients.filter(c => c.nome.toLowerCase().includes(val.toLowerCase()));
        
        dropdown.innerHTML = filtered.map(c => `
            <div onclick="window.selectClient('${c.nome.replace(/'/g, "\\'")}')" 
                 class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                <span class="font-bold text-slate-300 group-hover:text-white">${c.nome}</span>
                ${c.plano && c.plano !== 'Nenhum' ? `<span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">${c.plano}</span>` : ''}
            </div>
        `).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
        
        dropdown.classList.remove('hidden');
        state.isClientDropdownOpen = true;
    }
};

window.filterClients = (val) => {
    state.clientSearch = val;
    const dropdown = document.getElementById('clientDropdown');
    const hiddenInput = document.querySelector('input[name="client"]');
    if (hiddenInput) hiddenInput.value = val;
    
    if (dropdown) {
        const filtered = state.clients.filter(c => c.nome.toLowerCase().includes(val.toLowerCase()));
        dropdown.innerHTML = filtered.map(c => `
            <div onclick="window.selectClient('${c.nome.replace(/'/g, "\\'")}')" 
                 class="p-3 hover:bg-amber-500/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
                <span class="font-bold text-slate-300 group-hover:text-white">${c.nome}</span>
                ${c.plano && c.plano !== 'Nenhum' ? `<span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">${c.plano}</span>` : ''}
            </div>
        `).join('') || `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
        dropdown.classList.remove('hidden');
    }
};

window.selectClient = (name) => {
    state.clientSearch = name;
    state.isClientDropdownOpen = false;
    
    const input = document.getElementById('clientSearchInput');
    const hiddenInput = document.querySelector('input[name="client"]');
    const dropdown = document.getElementById('clientDropdown');
    
    if (input) input.value = name;
    if (hiddenInput) hiddenInput.value = name;
    if (dropdown) dropdown.classList.add('hidden');
};

// Global mousedown once
if (!window.hasGlobalClientPickerListener) {
    document.addEventListener('mousedown', (e) => {
        const dropdown = document.getElementById('clientDropdown');
        if (dropdown && !dropdown.classList.contains('hidden')) {
            if (!e.target.closest('#clientSearchInput') && !e.target.closest('#clientDropdown')) {
                dropdown.classList.add('hidden');
                state.isClientDropdownOpen = false;
            }
        }
    });
    window.hasGlobalClientPickerListener = true;
}

    window.updatePriceByService = (serviceName) => {
        const proc = state.procedures.find(p => p.nome === serviceName);
        if (proc) {
            const priceInput = document.querySelector('input[name="value"]');
            if (priceInput) priceInput.value = proc.preco;
        }
    };

    window.saveNewRecord = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button[type="submit"]');
        
        const recordData = {
            data: formData.get('date'),
            horario: formData.get('time'),
            cliente: formData.get('client'),
            procedimento: formData.get('service'),
            valor: parseFloat(formData.get('value')) || 0,
            forma_pagamento: formData.get('payment')
        };

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const url = isEditing && state.editingRecord.id 
                ? `${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${state.editingRecord.id}`
                : `${SUPABASE_URL}/rest/v1/agendamentos`;
            
            const res = await fetch(url, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(recordData)
            });

            if (res.ok) {
                if (isEditing) {
                    state.editingRecord = null;
                    state.currentPage = 'records';
                } else {
                    e.target.reset();
                }
                syncFromSheet(state.sheetUrl); // Atualiza os dados locais
            } else {
                alert('❌ Erro ao salvar no banco de dados.');
            }
        } catch (err) {
            console.error(err);
            alert('❌ Erro de conexão.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = isEditing ? 'Salvar Alterações' : 'Salvar Agendamento';
        }
    };

    const today = new Date().toISOString().split('T')[0];
    const initialValues = state.editingRecord || {
        date: today,
        time: '',
        client: '',
        service: '',
        value: '',
        paymentMethod: 'PIX'
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
                        <input type="date" name="date" required value="${initialValues.date || initialValues.data}"
                               class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold">
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Horário</label>
                        <input type="time" name="time" required value="${initialValues.time || initialValues.horario}"
                               class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold">
                    </div>

                    <div class="space-y-2 col-span-1 md:col-span-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Cliente</label>
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
                                   onkeydown="if(event.key === 'Enter') event.preventDefault()"
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
                            <select name="service" required onchange="window.updatePriceByService(this.value)"
                                    class="w-full bg-dark-900 border border-white/5 p-4 rounded-2xl outline-none focus:border-amber-500/50 transition-all font-bold appearance-none">
                                <option value="">Selecione...</option>
                                ${state.procedures.map(p => `
                                    <option value="${p.nome}" data-price="${p.preco}" ${(initialValues.service || initialValues.procedimento) === p.nome ? 'selected' : ''}>${p.nome}</option>
                                `).join('')}
                                <option value="Outro" ${(initialValues.service || initialValues.procedimento) && !state.procedures.find(p => p.nome === (initialValues.service || initialValues.procedimento)) ? 'selected' : ''}>Outro / Personalizado</option>
                            </select>
                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
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

                    <div class="col-span-1 md:col-span-2 pt-6">
                        <button type="submit" ${state.clients.length === 0 ? 'disabled' : ''}
                                class="w-full bg-amber-500 disabled:bg-white/5 disabled:text-white/20 hover:bg-amber-400 text-dark-950 font-black py-5 rounded-2xl shadow-xl shadow-amber-500/20 transform hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-widest">
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
    };

    // --- Client Logic ---
    window.saveNewClient = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = e.target.querySelector('button[type="submit"]');
        const isEditing = !!state.editingClient;
        
        const clientData = {
            nome: formData.get('nome'),
            telefone: formData.get('telefone') || null,
            plano: formData.get('plano') || 'Nenhum'
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
        const isEditing = !!state.editingProcedure;
        
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
        <div class="p-4 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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
                    <div class="glass-card p-8 rounded-[2rem] border border-white/5 sticky top-24">
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
                                    <select name="plano" 
                                            class="w-full bg-dark-900 border border-white/5 p-4 rounded-xl outline-none focus:border-amber-500/50 transition-all font-bold appearance-none">
                                        <option value="Nenhum" ${state.editingClient?.plano === 'Nenhum' ? 'selected' : ''}>Nenhum Plano</option>
                                        <option value="Mensal" ${state.editingClient?.plano === 'Mensal' ? 'selected' : ''}>Plano Mensal</option>
                                        <option value="Anual" ${state.editingClient?.plano === 'Anual' ? 'selected' : ''}>Plano Anual</option>
                                    </select>
                                </div>
                                <!-- Botão Final de Cadastro -->
                                <button type="submit" class="w-full bg-amber-500 text-dark-950 font-black py-4 rounded-xl hover:bg-amber-400 transition-all uppercase tracking-widest text-sm shadow-xl shadow-amber-500/10 active:scale-95">
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
                                                <th class="px-8 py-4 border-b border-white/5 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/5 text-sm">
                                            ${state.clients
                                                .filter(c => c.nome.toLowerCase().includes(state.managementSearch.toLowerCase()))
                                                .map(c => `
                                                <tr class="hover:bg-white/[0.01] transition-colors group">
                                                    <td class="px-8 py-4 font-bold text-white">${c.nome}</td>
                                                    <td class="px-8 py-4">
                                                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                                                            ${c.plano === 'Mensal' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                                                              c.plano === 'Anual' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 
                                                              'text-slate-500 border border-white/5'}">
                                                            ${c.plano || 'Nenhum'}
                                                        </span>
                                                    </td>
                                                    <td class="px-8 py-4 text-slate-400 font-medium">${c.telefone || '---'}</td>
                                                    <td class="px-8 py-4 text-right">
                                                        <div class="flex justify-end space-x-2">
                                                            <button onclick='window.editClient(${JSON.stringify(c)})' 
                                                                    class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-90">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                            <button onclick="window.deleteClient(${c.id})" 
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
                                                <div><p class="text-lg font-bold text-white">${c.nome}</p></div>
                                                <div class="flex space-x-2">
                                                    <button onclick='window.editClient(${JSON.stringify(c)})' class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><i class="fas fa-edit"></i></button>
                                                    <button onclick="window.deleteClient(${c.id})" class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button>
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
                                                    <td class="px-8 py-4 font-bold text-white">${p.nome}</td>
                                                    <td class="px-8 py-4 text-emerald-400 font-black">R$ ${p.preco.toFixed(2).replace('.', ',')}</td>
                                                    <td class="px-8 py-4 text-right">
                                                        <div class="flex justify-end space-x-2">
                                                            <button onclick='window.editProcedure(${JSON.stringify(p)})' 
                                                                    class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-90">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                            <button onclick="window.deleteProcedure(${p.id})" 
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
                                                <p class="text-lg font-bold text-white">${p.nome}</p>
                                                <p class="text-emerald-400 font-black">R$ ${p.preco.toFixed(2).replace('.', ',')}</p>
                                            </div>
                                            <div class="flex space-x-2">
                                                <button onclick='window.editProcedure(${JSON.stringify(p)})' class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><i class="fas fa-edit"></i></button>
                                                <button onclick="window.deleteProcedure(${p.id})" class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button>
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
                                    class="flex-1 bg-amber-500 text-dark-950 p-5 rounded-2xl font-bold text-lg hover:bg-amber-400 transition-colors">
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
    setup: SetupPage
};

// ==========================================
// 8. MOTOR DE RENDERIZAÇÃO E INICIALIZAÇÃO
// ==========================================
function render() {
    const app = document.getElementById('app');
    
    // Captura o foco e seleção antes de renderizar
    const activeId = document.activeElement ? document.activeElement.id : null;
    const selection = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') 
        ? { start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd } 
        : null;

    const contentFn = pages[state.currentPage] || (() => '404');
    const content = contentFn();

    app.innerHTML = `
        <div class="flex h-full w-full bg-dark-950 text-white overflow-hidden">
            ${Sidebar()}
            <div class="flex-1 flex flex-col min-w-0 h-full relative">
                ${Header()}
                <main class="flex-1 overflow-y-auto custom-scroll pb-24 md:pb-0">
                    ${content}
                </main>
                ${MobileNav()}
            </div>
        </div>
    `;

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

// Global exposure
window.navigate = navigate;

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    fetchClients();
    fetchProcedures();
    render();
    if (state.sheetUrl) {
        syncFromSheet(state.sheetUrl);
    }
});
