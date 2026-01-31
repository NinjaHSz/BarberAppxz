import { state } from "../../core/state.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../core/config.js";
import { fetchClients, updateClientPlan } from "../../api/supabase.js";
import { syncFromSheet } from "../../api/sync.js";
import { navigate } from "../navigation.js";

export const ClientProfilePage = () => {
  const client = state.clients.find((c) => c.id == state.selectedClientId);
  if (!client) {
    if (state.isLoading) {
      return `
                <div class="p-20 text-center animate-pulse">
                    <i class="fas fa-spinner fa-spin text-4xl text-brand-primary mb-4"></i>
                    <p class="text-[10px] font-black uppercase tracking-widest text-text-muted">Carregando dados do cliente...</p>
                </div>
            `;
    }
    return `
            <div class="p-8 h-full flex flex-col items-center justify-center text-center space-y-4">
                <i class="fas fa-user-slash text-6xl text-white/5"></i>
                <h2 class="text-2xl font-bold text-slate-400">Cliente não encontrado</h2>
                <button onclick="navigate('plans')" class="bg-brand-primary text-surface-page px-6 py-2 rounded-xl font-bold">Voltar aos Planos</button>
            </div>
        `;
  }

  window.saveClientEdit = async (field, value) => {
    try {
      const updateData = { [field]: value };
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?id=eq.${client.id}`,
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
        Object.assign(client, updateData);
        fetchClients();
        if (field === "nome") {
          await syncFromSheet(state.sheetUrl);
          if (window.render) window.render();
        }
      } else {
        alert("Erro ao atualizar cliente.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clientRecords = state.records
    .filter(
      (r) =>
        (r.client || "").toLowerCase() === (client.nome || "").toLowerCase(),
    )
    .sort((a, b) => {
      const dateA = new Date(a.date + "T" + (a.time || "00:00"));
      const dateB = new Date(b.date + "T" + (b.time || "00:00"));
      return dateB - dateA;
    });

  const today = new Date().toISOString().split("T")[0];
  const pastRecords = clientRecords.filter((r) => r.date <= today);
  const totalSpent = pastRecords.reduce(
    (acc, r) => acc + (parseFloat(r.value) || 0),
    0,
  );
  const lastVisit = pastRecords.length > 0 ? pastRecords[0].date : "Nunca";

  return `
        <div class="px-4 py-6 sm:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 max-w-6xl mx-auto">
            <!-- Header Section (Compact) -->
            <div class="flex flex-col sm:flex-row items-center gap-6">
                <div class="w-20 h-20 rounded-[2rem] bg-surface-section flex items-center justify-center text-brand-primary text-3xl font-black shadow-xl shrink-0">
                    ${(client.nome || "?").charAt(0)}
                </div>
                <div class="flex-1 text-center sm:text-left space-y-1">
                    <div class="flex flex-wrap justify-center sm:justify-start items-center gap-3">
                        <input type="text" value="${client.nome}" 
                               onfocus="window.selectAll(this)" 
                               onblur="window.saveClientEdit('nome', this.value)"
                               onkeydown="if(event.key==='Enter')this.blur()"
                               class="text-2xl font-display font-black text-white bg-transparent outline-none transition-all p-0 uppercase tracking-tighter hover:text-brand-primary focus:text-brand-primary w-full sm:w-auto text-center sm:text-left">
                        ${client.plano !== "Nenhum" ? `<span class="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black uppercase rounded border border-brand-primary/20">VIP</span>` : ""}
                    </div>
                    <div contenteditable="true" id="edit_prof_obs_${client.id}" spellcheck="false" autocomplete="off"
                         onfocus="window.selectAll(this)" 
                         onblur="window.saveClientEdit('observacoes_cliente', this.innerText.trim())" 
                         onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" 
                         class="text-xs text-text-muted font-medium outline-none hover:text-white transition-all cursor-text italic truncate max-w-md mx-auto sm:mx-0">
                        ${!client.observacoes_cliente || client.observacoes_cliente.includes("...") ? "Adicionar nota..." : client.observacoes_cliente}
                    </div>
                    <div class="pt-2">
                        <button onclick="navigate('plans')" class="text-[9px] font-black text-text-muted hover:text-white uppercase tracking-widest flex items-center gap-2 group mx-auto sm:mx-0">
                            <i class="fas fa-chevron-left transition-transform group-hover:-translate-x-1"></i> Voltar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Grid (Compact & Minimalist) -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div class="bg-surface-section/50 p-4 rounded-2xl flex flex-col justify-center">
                    <p class="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Faturamento</p>
                    <h3 class="text-xl font-display font-black text-brand-primary">R$ ${totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h3>
                </div>
                <div class="bg-surface-section/50 p-4 rounded-2xl flex flex-col justify-center">
                    <p class="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Frequência</p>
                    <h3 class="text-xl font-display font-black text-white">${pastRecords.length} <span class="text-[10px] text-text-muted">IDAS</span></h3>
                </div>
                <div class="bg-surface-section/50 p-4 rounded-2xl flex flex-col justify-center">
                    <p class="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Ticket Médio</p>
                    <h3 class="text-xl font-display font-black text-white">R$ ${(pastRecords.length ? totalSpent / pastRecords.length : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h3>
                </div>
                <div class="bg-surface-section/50 p-4 rounded-2xl flex flex-col justify-center">
                    <p class="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Última Vez</p>
                    <h3 class="text-xl font-display font-black text-white">${lastVisit !== "Nunca" ? new Date(lastVisit + "T00:00:00").toLocaleDateString("pt-BR") : "--"}</h3>
                </div>
            </div>

            <!-- Plan Details -->
            ${
              client.plano !== "Nenhum"
                ? (() => {
                    const planStats = window.getClientPlanUsage
                      ? window.getClientPlanUsage(client.nome)
                      : { usageCount: 0 };
                    const limit = client.limite_cortes || 99;
                    const usagePercent = Math.min(
                      100,
                      ((planStats?.usageCount || 0) / limit) * 100,
                    );
                    const isOver = planStats?.usageCount >= limit;
                    const isPending =
                      client.plano_pagamento &&
                      (new Date() - new Date(client.plano_pagamento)) /
                        (1000 * 60 * 60 * 24) >
                        30;

                    return `
                <div class="bg-surface-section/30 p-6 rounded-[2rem] space-y-6">
                    <div class="flex justify-between items-center px-2">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-crown text-brand-primary text-xs"></i>
                            <select onchange="window.saveClientEdit('plano', this.value)" 
                                    class="bg-transparent border-none text-[10px] font-black text-white uppercase tracking-widest outline-none cursor-pointer hover:text-brand-primary transition-colors appearance-none">
                                <option value="Mensal" ${client.plano === "Mensal" ? "selected" : ""} class="bg-surface-page">Plano Mensal</option>
                                <option value="Semestral" ${client.plano === "Semestral" ? "selected" : ""} class="bg-surface-page">Plano Semestral</option>
                                <option value="Anual" ${client.plano === "Anual" ? "selected" : ""} class="bg-surface-page">Plano Anual</option>
                                <option value="Pausado" ${client.plano === "Pausado" ? "selected" : ""} class="bg-surface-page">Plano Pausado</option>
                                <option value="Nenhum" ${client.plano === "Nenhum" ? "selected" : ""} class="bg-surface-page">Nenhum Plano</option>
                            </select>
                        </div>
                        <button onclick="if(confirm('Reiniciar ciclo?')){ window.updateClientPlan('${client.id}', { plano_pagamento: new Date().toISOString().split('T')[0] }) }" 
                                class="text-[8px] font-black text-brand-primary hover:bg-brand-primary hover:text-surface-page px-3 py-1 rounded transition-all uppercase tracking-widest">
                            <i class="fas fa-rotate mr-1"></i> Reset Ciclo
                        </button>
                    </div>

                    <!-- Usage Meter -->
                    <div class="px-2 space-y-2">
                        <div class="flex justify-between items-end">
                            <div class="space-y-0.5">
                                <p class="text-[8px] font-black text-text-muted uppercase tracking-widest">Uso do Ciclo</p>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-lg font-black ${isOver ? "text-rose-500" : "text-white"}">${planStats?.usageCount || 0}</span>
                                    <span class="text-xs font-bold text-text-muted">/</span>
                                    <input type="number" value="${limit}" 
                                           onchange="window.saveClientEdit('limite_cortes', parseInt(this.value) || 99)"
                                           class="bg-transparent border-none text-lg font-black text-text-muted hover:text-white focus:text-white outline-none w-12 p-0 transition-colors">
                                </div>
                            </div>
                            <span class="text-[10px] font-black ${isOver ? "text-rose-500" : "text-white"}">${usagePercent.toFixed(0)}%</span>
                        </div>
                        <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full ${isOver ? "bg-rose-500" : usagePercent > 80 ? "bg-brand-primary" : "bg-text-muted"} transition-all duration-700" style="width: ${usagePercent}%"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-surface-page/50 p-4 rounded-xl flex items-center justify-between">
                            <div class="space-y-0.5">
                                <p class="text-[8px] font-black text-text-muted uppercase tracking-widest">Recorrência</p>
                                <div class="flex items-center gap-1">
                                    <span class="text-[10px] font-bold text-text-muted">R$</span>
                                    <input type="number" step="0.01" value="${client.valor_plano || ""}" 
                                           onblur="window.saveClientEdit('valor_plano', this.value)"
                                           class="bg-transparent border-none text-lg font-black text-white outline-none w-24 p-0">
                                </div>
                            </div>
                            <div class="text-right flex flex-col items-end">
                                <p class="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Pagamento</p>
                                <input type="date" value="${client.plano_pagamento || ""}" 
                                       onchange="window.saveClientEdit('plano_pagamento', this.value)"
                                       class="bg-transparent border-none text-[12px] font-black ${isPending ? "text-rose-500" : "text-white"} p-0 outline-none cursor-pointer text-right uppercase" style="color-scheme: dark">
                            </div>
                        </div>
                        <div class="bg-surface-page/50 p-4 rounded-xl">
                            <p class="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Notas Gestão</p>
                            <div contenteditable="true" onfocus="window.selectAll(this)" onblur="window.saveClientEdit('observacoes_plano', this.innerText.trim())" 
                                 class="text-[11px] text-text-secondary outline-none hover:text-white transition-all min-h-[1.5rem] italic">
                                ${!client.observacoes_plano || client.observacoes_plano.includes("...") ? "Sem observações..." : client.observacoes_plano}
                            </div>
                        </div>
                    </div>
                </div>
                `;
                  })()
                : ""
            }

            <!-- History Timeline (Ultra Minimal) -->
            <div class="space-y-4">
                <div class="flex justify-between items-center px-4">
                    <h3 class="text-[10px] font-black text-text-muted uppercase tracking-widest">Histórico de Visitas</h3>
                    <div class="h-px flex-1 mx-4 bg-white/5"></div>
                    <span class="text-[9px] font-black text-text-muted">${clientRecords.length} ATENDIMENTOS</span>
                </div>
                
                <div class="space-y-1">
                    ${
                      clientRecords.length === 0
                        ? `<div class="p-12 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest">Vazio</div>`
                        : clientRecords
                            .map((r) => {
                              const id = r.id;
                              const rowId = `hist_${r.id}`;
                              return `
                            <div class="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] rounded-xl transition-all group">
                                <div class="w-12 text-center shrink-0">
                                    <p class="text-[10px] font-black text-brand-primary leading-tight">${r.date.split("-")[2]}</p>
                                    <p class="text-[8px] font-black text-text-muted uppercase leading-tight">${new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR", { month: "short" })}</p>
                                </div>
                                <div class="w-16 text-center shrink-0 border-r border-white/5">
                                    <input type="time" data-id="${id}" data-ui-id="${rowId}" data-field="time" value="${r.time.substring(0, 5)}" 
                                           onchange="window.saveInlineEdit(this)" class="bg-transparent border-none text-[11px] text-text-muted font-bold outline-none p-0 w-full text-center cursor-pointer">
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <div contenteditable="true" data-id="${id}" data-ui-id="${rowId}" data-field="service" 
                                             onblur="window.saveInlineEdit(this)" class="text-[11px] font-black text-white uppercase outline-none truncate hover:text-brand-primary focus:text-brand-primary">
                                            ${r.service}
                                        </div>
                                        <span class="w-1 h-1 rounded-full bg-white/10"></span>
                                        <span class="text-[9px] font-bold text-text-muted uppercase truncate w-20">${r.paymentMethod}</span>
                                    </div>
                                    <div contenteditable="true" data-id="${id}" data-ui-id="${rowId}" data-field="observations" 
                                         onblur="window.saveInlineEdit(this)" class="text-[10px] text-text-muted outline-none hover:text-white transition-all italic truncate max-w-sm">
                                        ${r.observations || "..."}
                                    </div>
                                </div>
                                <div class="text-right flex items-center gap-4 shrink-0">
                                    <div class="flex items-center gap-0.5">
                                        <span class="text-[9px] font-bold text-text-muted">R$</span>
                                        <div contenteditable="true" data-id="${id}" data-ui-id="${rowId}" data-field="value" 
                                             onblur="window.saveInlineEdit(this)" class="text-xs font-black text-white outline-none w-10">${(parseFloat(r.value) || 0).toFixed(0)}</div>
                                    </div>
                                    <button onclick="window.cancelAppointment('${r.id}')" 
                                            class="opacity-0 group-hover:opacity-100 transition-all text-text-muted hover:text-rose-500">
                                        <i class="fas fa-trash-can text-[10px]"></i>
                                    </button>
                                </div>
                            </div>
                            `;
                            })
                            .join("")
                    }
                </div>
            </div>
        </div>
    `;
};
