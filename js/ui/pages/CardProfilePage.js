import { state } from "../../core/state.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../core/config.js";
import { fetchCards } from "../../api/supabase.js";
import { navigate } from "../navigation.js";

export const CardProfilePage = () => {
  const cardId = state.selectedCardId;
  const card = state.cards.find((c) => c.id == cardId);

  if (!card) {
    if (state.isLoading) {
      return `
                <div class="p-20 text-center animate-pulse">
                    <i class="fas fa-spinner fa-spin text-4xl text-brand-primary mb-4"></i>
                    <p class="text-[10px] font-black uppercase tracking-widest text-text-muted">Carregando dados do cartão...</p>
                </div>
            `;
    }
    return `
            <div class="px-4 pt-10 text-center space-y-6">
                <i class="fas fa-credit-card text-6xl text-white/5 mb-4"></i>
                <h2 class="text-2xl font-bold text-slate-400">Cartão não encontrado</h2>
                <button onclick="navigate('cards')" class="bg-brand-primary text-surface-page px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest">Voltar para Cartões</button>
            </div>
        `;
  }

  const allCardExpenses = state.expenses.filter(
    (e) =>
      e.cartao === card.nome ||
      (e.descricao &&
        e.descricao.toUpperCase().includes(card.nome.toUpperCase())),
  );

  const periodFilter = state.expensePeriodFilter || "mensal";
  const targetMonth = state.filters.month;
  const targetYear = state.filters.year;
  const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const selectedDate = new Date(
    state.filters.year,
    state.filters.month - 1,
    state.filters.day,
  );

  let filteredCardExpenses = allCardExpenses;

  if (periodFilter === "diario") {
    const dateStr = selectedDate.toISOString().split("T")[0];
    filteredCardExpenses = allCardExpenses.filter(
      (e) => e.vencimento === dateStr,
    );
  } else if (periodFilter === "semanal") {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    filteredCardExpenses = allCardExpenses.filter((e) => {
      if (!e.vencimento) return false;
      const ev = new Date(e.vencimento + "T12:00:00");
      return ev >= startOfWeek && ev <= endOfWeek;
    });
  } else if (periodFilter === "mensal") {
    filteredCardExpenses = allCardExpenses.filter((e) =>
      e.vencimento.startsWith(monthPrefix),
    );
  }

  const totalSpentPeriod = filteredCardExpenses.reduce(
    (acc, e) => acc + (parseFloat(e.valor) || 0),
    0,
  );

  window.saveCardEdit = async (field, value) => {
    const originalValue = card[field];
    try {
      const updateData = { [field]: value };
      Object.assign(card, updateData);
      if (window.render) window.render();

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/cartoes?id=eq.${card.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(updateData),
        },
      );
      if (res.ok) {
        fetchCards();
      } else {
        alert("Erro ao salvar alteração no banco.");
        Object.assign(card, { [field]: originalValue });
        if (window.render) window.render();
        fetchCards();
      }
    } catch (err) {
      console.error("Erro no salvamento parcial do cartão:", err);
      Object.assign(card, { [field]: originalValue });
      if (window.render) window.render();
      alert("⚠ Erro de conexão ao salvar alteração.");
      fetchCards();
    }
  };

  return `
        <div class="px-4 py-6 sm:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 max-w-6xl mx-auto">
            <!-- Header Section (Premium) -->
            <div class="flex flex-col md:flex-row items-center justify-between gap-8">
                <div class="flex flex-col md:flex-row items-center gap-6 w-full">
                    <div class="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] bg-surface-section flex items-center justify-center text-brand-primary text-3xl md:text-5xl font-black shadow-2xl flex-shrink-0 group hover:scale-105 transition-transform duration-500">
                        <i class="fas fa-credit-card group-hover:rotate-12 transition-transform duration-500"></i>
                    </div>
                    <div class="flex-1 text-center md:text-left space-y-2">
                        <div class="flex flex-wrap justify-center md:justify-start items-center gap-3">
                            <input type="text" value="${card.nome}" 
                                   onblur="window.saveCardEdit('nome', this.value.toUpperCase())"
                                   onkeydown="if(event.key==='Enter')this.blur()"
                                   class="text-3xl md:text-5xl font-display font-black text-white bg-transparent outline-none transition-all p-0 uppercase tracking-tighter hover:text-brand-primary focus:text-brand-primary w-full md:w-auto text-center md:text-left">
                            <span class="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black uppercase rounded tracking-widest border-none">ATIVA</span>
                        </div>
                        <div class="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-4 md:gap-8 pt-1">
                            <div class="flex items-center gap-2 group cursor-text">
                                <i class="fas fa-university text-text-muted text-[10px] group-hover:text-brand-primary transition-colors"></i>
                                <input type="text" value="${card.banco || ""}" placeholder="BANCO..." 
                                       onblur="window.saveCardEdit('banco', this.value.toUpperCase())"
                                       class="bg-transparent text-[10px] font-black text-text-muted uppercase tracking-widest outline-none hover:text-white focus:text-white transition-all w-32">
                            </div>
                            <div class="flex items-center gap-2 group cursor-text">
                                <i class="fas fa-user-circle text-text-muted text-[10px] group-hover:text-brand-primary transition-colors"></i>
                                <input type="text" value="${card.titular || ""}" placeholder="TITULAR..." 
                                       onblur="window.saveCardEdit('titular', this.value.toUpperCase())"
                                       class="bg-transparent text-[10px] font-black text-text-muted uppercase tracking-widest outline-none hover:text-white focus:text-white transition-all w-48">
                            </div>
                        </div>
                    </div>
                </div>
                <button onclick="navigate('cards')" class="text-[9px] font-black text-text-muted hover:text-white uppercase tracking-widest flex items-center gap-2 group shrink-0">
                    <i class="fas fa-chevron-left transition-transform group-hover:-translate-x-1"></i> Voltar aos Cartões
                </button>
            </div>
            
            <!-- Dynamic Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-surface-section/30 p-6 rounded-[2rem] space-y-3 group hover:bg-surface-section/50 transition-colors">
                    <div class="flex items-center gap-2 text-text-muted group-hover:text-brand-primary transition-colors">
                        <i class="fas fa-calendar-minus text-[10px]"></i>
                        <p class="text-[9px] font-black uppercase tracking-widest">Fechamento</p>
                    </div>
                    <input type="date" value="${card.fechamento}" onchange="window.saveCardEdit('fechamento', this.value || null)" 
                           class="w-full bg-surface-page/50 border-none p-4 rounded-xl outline-none font-black text-white text-sm cursor-pointer" style="color-scheme: dark">
                </div>
                
                <div class="bg-surface-section/30 p-6 rounded-[2rem] space-y-3 group hover:bg-surface-section/50 transition-colors">
                    <div class="flex items-center gap-2 text-text-muted group-hover:text-brand-primary transition-colors">
                        <i class="fas fa-calendar-check text-[10px]"></i>
                        <p class="text-[9px] font-black uppercase tracking-widest">Vencimento</p>
                    </div>
                    <input type="date" value="${card.vencimento}" onchange="window.saveCardEdit('vencimento', this.value || null)"
                           class="w-full bg-surface-page/50 border-none p-4 rounded-xl outline-none font-black text-brand-primary text-sm cursor-pointer" style="color-scheme: dark">
                </div>

                <div class="bg-surface-section/30 p-6 rounded-[2rem] flex flex-col justify-between group hover:bg-surface-section/50 transition-colors">
                    <div class="flex justify-between items-start gap-4">
                        <div class="space-y-1">
                            <p class="text-[9px] font-black text-text-muted uppercase tracking-widest">Faturamento</p>
                            <p class="text-[7px] font-black text-text-muted uppercase tracking-tighter opacity-50">${periodFilter === "diario" ? "Hoje" : periodFilter === "semanal" ? "Semana" : periodFilter === "mensal" ? "Mês" : "Total"}</p>
                        </div>
                        <div class="flex bg-surface-page/50 rounded-lg p-0.5">
                            ${["diario", "semanal", "mensal", "total"]
                              .map(
                                (p) => `
                                <button onclick="window.setExpenseFilter('expensePeriodFilter', '${p}')" 
                                        class="px-2 py-1 rounded text-[7px] font-black uppercase tracking-tighter transition-all
                                        ${state.expensePeriodFilter === p ? "bg-brand-primary text-surface-page shadow-lg" : "text-text-muted hover:text-white"}">
                                    ${p === "diario" ? "Dia" : p === "semanal" ? "Sem" : p === "mensal" ? "Mês" : "All"}
                                </button>
                            `,
                              )
                              .join("")}
                        </div>
                    </div>
                    <h4 class="text-3xl font-display font-black text-white mt-4 tracking-tighter">R$ ${totalSpentPeriod.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h4>
                </div>
            </div>

            <!-- Transaction History -->
            <div class="space-y-6">
                <div class="flex justify-between items-center px-4">
                    <h3 class="text-[10px] font-black text-text-muted uppercase tracking-widest">Histórico de Gastos (${filteredCardExpenses.length})</h3>
                    <div class="h-px flex-1 mx-4 bg-white/5"></div>
                    <button class="text-[9px] font-black text-brand-primary hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2">
                        Ver Tudo <i class="fas fa-arrow-right text-[8px]"></i>
                    </button>
                </div>
                
                <div class="space-y-1">
                    ${
                      filteredCardExpenses.length === 0
                        ? `<div class="p-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20">Nenhum registro encontrado</div>`
                        : filteredCardExpenses
                            .slice(0, 15)
                            .map(
                              (e) => `
                        <div class="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] rounded-2xl transition-all group cursor-pointer border-none">
                            <div class="w-10 h-10 rounded-xl bg-surface-section flex items-center justify-center text-text-muted shrink-0 group-hover:text-brand-primary transition-colors">
                                <i class="fas ${e.paga ? "fa-check-circle" : "fa-clock"} text-xs"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <h4 class="text-[11px] font-black text-white uppercase truncate group-hover:text-brand-primary transition-colors">${e.descricao}</h4>
                                    <span class="w-1 h-1 rounded-full bg-white/10"></span>
                                    <span class="text-[8px] font-black text-text-muted uppercase tracking-widest">${new Date(e.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                </div>
                                <p class="text-[9px] text-text-muted font-bold uppercase tracking-tighter mt-0.5">${e.paga ? "Compensado" : "Aguardando pagamento"}</p>
                            </div>
                            <div class="text-right shrink-0">
                                <p class="text-sm font-display font-black ${e.paga ? "text-text-muted" : "text-white"}">R$ ${(parseFloat(e.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                                <span class="text-[8px] font-black uppercase tracking-widest ${e.paga ? "text-brand-primary/40" : "text-rose-500/50"}">${e.paga ? "PAGO" : "PENDENTE"}</span>
                            </div>
                        </div>
                        `,
                            )
                            .join("")
                    }
                </div>
            </div>
        </div>
    `;
};
