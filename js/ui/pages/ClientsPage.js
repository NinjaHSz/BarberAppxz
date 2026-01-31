import { state } from "../../core/state.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../core/config.js";
import {
  fetchClients,
  fetchProcedures,
  updateClientField,
  updateClientPlan,
} from "../../api/supabase.js";
import { navigate } from "../navigation.js";

export const ClientsPage = () => {
  window.switchClientView = (view) => {
    state.clientView = view;
    state.editingClient = null;
    state.editingProcedure = null;
    state.managementSearch = "";
    if (window.render) window.render();
  };

  window.handleManagementSearch = (val) => {
    state.managementSearch = val;
    if (window.render) window.render();
    setTimeout(() => {
      const input = document.getElementById("managementSearchInput");
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }, 50);
  };

  window.saveNewClient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const btn = e.target.querySelector('button[type="submit"]');
    const isEditing = !!(state.editingClient && state.editingClient.id);

    const clientData = {
      nome: formData.get("nome"),
      plano: formData.get("plano") || "Nenhum",
      plano_inicio: formData.get("plano_inicio") || null,
      plano_pagamento: formData.get("plano_pagamento") || null,
      novo_cliente: formData.get("novo_cliente") === "on",
    };

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEditing ? "Salvando..." : "Cadastrando..."}`;

    try {
      const url = isEditing
        ? `${SUPABASE_URL}/rest/v1/clientes?id=eq.${state.editingClient.id}`
        : `${SUPABASE_URL}/rest/v1/clientes`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(clientData),
      });

      if (res.ok) {
        state.editingClient = null;
        e.target.reset();
        fetchClients();
      } else {
        const errorData = await res.json();
        if (errorData.code === "23505")
          alert("⚠ ERRO: Este cliente já está cadastrado.");
        else
          alert(
            "⚠ Erro ao salvar: " +
              (errorData.message || "Falha no banco de dados."),
          );
      }
    } catch (err) {
      alert("⚠ Erro de conexão.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = isEditing ? "Salvar Alterações" : "Cadastrar Cliente";
    }
  };

  window.editClient = (client) => {
    state.clientView = "clients";
    state.editingClient = client;
    if (window.render) window.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.cancelEditClient = () => {
    state.editingClient = null;
    if (window.render) window.render();
  };

  window.deleteClient = async (id) => {
    if (
      !confirm(
        "Deseja excluir este cliente? Isso não afetará os agendamentos já feitos.",
      )
    )
      return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
        },
      });
      fetchClients();
    } catch (err) {
      alert("Erro ao excluir cliente.");
    }
  };

  window.saveProcedure = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const btn = e.target.querySelector('button[type="submit"]');
    const isEditing = !!(state.editingProcedure && state.editingProcedure.id);

    const procedureData = {
      nome: formData.get("nome"),
      preco: parseFloat(formData.get("preco")) || 0,
    };

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEditing ? "Salvando..." : "Cadastrando..."}`;

    try {
      const url = isEditing
        ? `${SUPABASE_URL}/rest/v1/procedimentos?id=eq.${state.editingProcedure.id}`
        : `${SUPABASE_URL}/rest/v1/procedimentos`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(procedureData),
      });

      if (res.ok) {
        state.editingProcedure = null;
        e.target.reset();
        fetchProcedures();
      } else {
        alert("⚠ Erro ao salvar procedimento.");
      }
    } catch (err) {
      alert("⚠ Erro de conexão.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = isEditing
        ? "Salvar Alterações"
        : "Cadastrar Procedimento";
    }
  };

  window.editProcedure = (proc) => {
    state.clientView = "procedures";
    state.editingProcedure = proc;
    if (window.render) window.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.cancelEditProcedure = () => {
    state.editingProcedure = null;
    if (window.render) window.render();
  };

  window.deleteProcedure = async (id) => {
    if (!confirm("Deseja excluir este procedimento?")) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/procedimentos?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
        },
      });
      fetchProcedures();
    } catch (err) {
      alert("Erro ao excluir procedimento.");
    }
  };

  const isClients = state.clientView === "clients";

  const isCompact = state.displayMode === "compact";

  return `
        <div class="px-4 py-6 sm:px-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-32 max-w-7xl mx-auto">
            <!-- Header Section -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div class="space-y-1">
                    <h2 class="text-3xl md:text-4xl font-display font-black tracking-tighter text-white">Central de Gestão</h2>
                    <p class="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">Controle sua base de dados e serviços</p>
                </div>
                
                <!-- Tab Control -->
                <div class="flex bg-surface-section/50 p-1 rounded-2xl w-full md:w-auto shadow-2xl">
                    <button onclick="window.switchClientView('clients')" 
                            class="flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                            ${isClients ? "bg-brand-primary text-surface-page shadow-xl" : "text-text-muted hover:text-white"}">
                        Clientes
                    </button>
                    <button onclick="window.switchClientView('procedures')" 
                            class="flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                            ${!isClients ? "bg-brand-primary text-surface-page shadow-xl" : "text-text-muted hover:text-white"}">
                        Serviços
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <!-- Action Form Card -->
                <div class="lg:col-span-4 sticky top-6">
                    <div class="bg-surface-section/30 p-8 rounded-[2.5rem] space-y-8 group hover:bg-surface-section/40 transition-all duration-500">
                        <div class="flex justify-between items-center">
                            <div class="space-y-1">
                                <h3 class="text-[11px] font-black text-brand-primary uppercase tracking-[0.2em]">
                                    ${isClients ? (state.editingClient ? "Atualizar" : "Novo") : state.editingProcedure ? "Refinar" : "Novo"}
                                </h3>
                                <p class="text-xl font-display font-black text-white">
                                    ${isClients ? "Cadastro de Cliente" : "Tabela de Preços"}
                                </p>
                            </div>
                            ${
                              (isClients && state.editingClient) ||
                              (!isClients && state.editingProcedure)
                                ? `
                                <button onclick="${isClients ? "window.cancelEditClient()" : "window.cancelEditProcedure()"}" 
                                        class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-white transition-all">
                                    <i class="fas fa-times text-xs"></i>
                                </button>
                            `
                                : ""
                            }
                        </div>

                        ${
                          isClients
                            ? `
                            <form onsubmit="window.saveNewClient(event)" class="space-y-6">
                                <div class="space-y-2 group">
                                    <label class="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1 group-focus-within:text-brand-primary transition-colors">Nome Completo</label>
                                    <input type="text" name="nome" required placeholder="NOME DO CLIENTE..." 
                                           value="${state.editingClient?.nome || ""}"
                                           class="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-white uppercase text-sm tracking-tight placeholder:text-text-muted/30 focus:bg-surface-page transition-all">
                                </div>
                                <div class="flex items-center gap-4 bg-surface-page/30 p-4 rounded-2xl cursor-pointer hover:bg-surface-page/50 transition-all relative">
                                    <div class="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in pointer-events-none">
                                        <input type="checkbox" name="novo_cliente" id="novo_cliente_toggle" 
                                               class="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-1 top-1 transition-transform checked:translate-x-5 checked:border-brand-primary" 
                                               ${state.editingClient?.novo_cliente ? "checked" : ""}/>
                                        <label for="novo_cliente_toggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-surface-section cursor-pointer border-none"></label>
                                    </div>
                                    <label for="novo_cliente_toggle" class="text-[10px] font-black text-white uppercase tracking-widest cursor-pointer flex-1">
                                        Destaque como Novo
                                    </label>
                                </div>
                                <button type="submit" class="w-full bg-brand-primary text-surface-page font-black py-5 rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-[0.98] group-hover:scale-[1.01]">
                                    ${state.editingClient ? "Salvar Alterações" : "Efetivar Cadastro"}
                                </button>
                            </form>
                        `
                            : `
                            <form onsubmit="window.saveProcedure(event)" class="space-y-6">
                                <div class="space-y-2 group">
                                    <label class="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1 group-focus-within:text-brand-primary transition-colors">Descrição do Serviço</label>
                                    <input type="text" name="nome" required placeholder="EX: CORTE DEGRADÊ..." 
                                           value="${state.editingProcedure?.nome || ""}"
                                           class="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-white uppercase text-sm tracking-tight placeholder:text-text-muted/30 focus:bg-surface-page transition-all">
                                </div>
                                <div class="space-y-2 group">
                                    <label class="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1 group-focus-within:text-brand-primary transition-colors">Preço Sugerido (R$)</label>
                                    <input type="number" step="0.01" name="preco" placeholder="0,00" 
                                           value="${state.editingProcedure?.preco || ""}"
                                           class="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-brand-primary text-lg tracking-tight placeholder:text-brand-primary/20 focus:bg-surface-page transition-all">
                                </div>
                                <button type="submit" class="w-full bg-brand-primary text-surface-page font-black py-5 rounded-2xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-2xl active:scale-[0.98] group-hover:scale-[1.01]">
                                    ${state.editingProcedure ? "Aplicar Mudanças" : "Adicionar à Lista"}
                                </button>
                            </form>
                        `
                        }
                    </div>
                </div>

                <!-- List Content -->
                <div class="lg:col-span-8 space-y-6">
                    <!-- Search & Tools -->
                    <div class="bg-surface-section/20 p-4 rounded-[2rem] flex flex-col md:flex-row items-center gap-4">
                        <div class="relative flex-1 group w-full">
                            <i class="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-text-muted text-xs group-focus-within:text-brand-primary transition-colors"></i>
                            <input type="text" id="managementSearchInput" 
                                   placeholder="BUSCAR ${isClients ? "CLIENTE..." : "SERVIÇO..."}" 
                                   oninput="window.handleManagementSearch(this.value)" value="${state.managementSearch}"
                                   class="w-full bg-surface-page/40 border-none py-4 pl-14 pr-6 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:bg-surface-page/60 transition-all text-white placeholder:opacity-30">
                        </div>
                        <button onclick="${isClients ? "fetchClients()" : "fetchProcedures()"}" 
                                class="w-12 h-12 rounded-2xl bg-surface-page/40 text-text-muted hover:text-white hover:bg-surface-page transition-all flex items-center justify-center shrink-0">
                            <i class="fas fa-sync-alt text-xs"></i>
                        </button>
                    </div>

                    <!-- Data Display -->
                    <div class="bg-surface-section/20 rounded-[2.5rem] overflow-hidden">
                        ${
                          isClients
                            ? `
                            <!-- Desktop View -->
                            <div class="hidden md:block overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead class="bg-white/[0.02] text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">
                                        <tr>
                                            <th class="px-8 py-5">Perfil do Cliente</th>
                                            <th class="px-6 py-5 text-center">Titularidade</th>
                                            <th class="px-6 py-5">Observações Privadas</th>
                                            <th class="px-8 py-5 text-right whitespace-nowrap">Gestão</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/[0.02]">
                                        ${state.clients
                                          .filter((c) =>
                                            c.nome
                                              .toLowerCase()
                                              .includes(
                                                state.managementSearch.toLowerCase(),
                                              ),
                                          )
                                          .map(
                                            (c) => `
                                            <tr class="hover:bg-white/[0.02] transition-colors group">
                                                <td class="px-8 ${isCompact ? "py-3" : "py-6"} cursor-pointer" onclick="navigate('client-profile', '${c.id}')">
                                                    <div class="flex items-center gap-4">
                                                        <div class="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-[10px] font-black text-brand-primary group-hover:scale-110 transition-transform">
                                                            ${c.nome.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p class="text-[12px] font-black text-white uppercase tracking-tight group-hover:text-brand-primary transition-colors">
                                                                ${c.nome}
                                                            </p>
                                                            ${c.novo_cliente ? '<span class="text-[7px] font-black text-brand-primary uppercase tracking-[0.2em] animate-pulse">NOVO INTEGRANTE</span>' : '<span class="text-[7px] font-black text-text-muted uppercase tracking-[0.2em]">MEMBRO ATIVO</span>'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-6 ${isCompact ? "py-3" : "py-6"} text-center">
                                                    <span class="px-3 py-1 bg-surface-page/50 rounded-lg text-[8px] font-black uppercase tracking-widest ${c.plano && c.plano !== "Nenhum" ? "text-brand-primary" : "text-text-muted opacity-40"}">
                                                        ${c.plano || "SEM PLANO"}
                                                    </span>
                                                </td>
                                                <td class="px-6 ${isCompact ? "py-3" : "py-6"}">
                                                    <div contenteditable="true" 
                                                         onblur="window.updateClientField('${c.id}', 'observacoes_cliente', this.innerText.trim())" 
                                                         onfocus="window.selectAll(this)"
                                                         class="text-[9px] text-text-muted font-bold uppercase tracking-tighter outline-none hover:text-white focus:text-white transition-all max-w-[240px] truncate cursor-text">
                                                        ${!c.observacoes_cliente || c.observacoes_cliente.includes("...") ? "ADICIONAR NOTA..." : c.observacoes_cliente}
                                                    </div>
                                                </td>
                                                <td class="px-8 ${isCompact ? "py-3" : "py-6"} text-right">
                                                    <div class="flex justify-end items-center gap-2">
                                                        <button onclick='window.editClient(${JSON.stringify(c)})' class="w-8 h-8 rounded-lg bg-surface-page/50 text-text-muted hover:text-white hover:bg-brand-primary/20 hover:text-brand-primary transition-all flex items-center justify-center">
                                                            <i class="fas fa-edit text-[10px]"></i>
                                                        </button>
                                                        <button onclick="window.deleteClient('${c.id}')" class="w-8 h-8 rounded-lg bg-surface-page/50 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center justify-center">
                                                            <i class="fas fa-trash-alt text-[10px]"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `,
                                          )
                                          .join("")}
                                    </tbody>
                                </table>
                            </div>
                            
                            <!-- Mobile View -->
                            <div class="md:hidden divide-y divide-white/[0.02]">
                                ${state.clients
                                  .filter((c) =>
                                    c.nome
                                      .toLowerCase()
                                      .includes(
                                        state.managementSearch.toLowerCase(),
                                      ),
                                  )
                                  .map(
                                    (c) => `
                                    <div class="${isCompact ? "p-3" : "p-6"} space-y-4 group">
                                        <div class="flex justify-between items-start">
                                            <div onclick="navigate('client-profile', '${c.id}')" class="flex items-center gap-3">
                                                <div class="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center font-black text-brand-primary">
                                                    ${c.nome.charAt(0)}
                                                </div>
                                                <div>
                                                    <p class="text-sm font-black text-white uppercase tracking-tight">${c.nome}</p>
                                                    <p class="text-[8px] font-black text-brand-primary uppercase tracking-widest">${c.plano || "SEM PLANO"}</p>
                                                </div>
                                            </div>
                                            <div class="flex gap-2">
                                                <button onclick='window.editClient(${JSON.stringify(c)})' class="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-text-muted"><i class="fas fa-edit text-xs"></i></button>
                                                <button onclick="window.deleteClient('${c.id}')" class="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-rose-500/50"><i class="fas fa-trash-alt text-xs"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                `,
                                  )
                                  .join("")}
                            </div>
                        `
                            : `
                            <!-- Procedures View -->
                            <div class="overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead class="bg-white/[0.02] text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">
                                        <tr>
                                            <th class="px-8 py-5">Especificação</th>
                                            <th class="px-6 py-5 text-center">Valor Base</th>
                                            <th class="px-8 py-5 text-right">Gestão</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/[0.02]">
                                        ${state.procedures
                                          .filter((p) =>
                                            p.nome
                                              .toLowerCase()
                                              .includes(
                                                state.managementSearch.toLowerCase(),
                                              ),
                                          )
                                          .map(
                                            (p) => `
                                            <tr class="hover:bg-white/[0.02] transition-colors group">
                                                <td class="px-8 ${isCompact ? "py-3" : "py-6"}">
                                                    <div class="flex items-center gap-4">
                                                        <div class="w-8 h-8 rounded-lg bg-surface-page flex items-center justify-center text-[10px] text-text-muted group-hover:text-brand-primary transition-colors">
                                                            <i class="fas fa-scissors"></i>
                                                        </div>
                                                        <p class="text-[11px] font-black text-white uppercase tracking-wider">${p.nome}</p>
                                                    </div>
                                                </td>
                                                <td class="px-6 ${isCompact ? "py-3" : "py-6"} text-center">
                                                    <span class="text-xs font-black text-brand-primary tracking-tighter">
                                                        R$ ${p.preco.toFixed(2).replace(".", ",")}
                                                    </span>
                                                </td>
                                                <td class="px-8 ${isCompact ? "py-3" : "py-6"} text-right">
                                                    <div class="flex justify-end items-center gap-2">
                                                        <button onclick='window.editProcedure(${JSON.stringify(p)})' class="w-8 h-8 rounded-lg bg-surface-page/50 text-text-muted hover:bg-brand-primary/20 hover:text-brand-primary transition-all flex items-center justify-center">
                                                            <i class="fas fa-edit text-[10px]"></i>
                                                        </button>
                                                        <button onclick="window.deleteProcedure('${p.id}')" class="w-8 h-8 rounded-lg bg-surface-page/50 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center justify-center">
                                                            <i class="fas fa-trash-alt text-[10px]"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `,
                                          )
                                          .join("")}
                                    </tbody>
                                </table>
                            </div>
                        `
                        }
                        
                        ${
                          (isClients ? state.clients : state.procedures).filter(
                            (x) =>
                              x.nome
                                .toLowerCase()
                                .includes(state.managementSearch.toLowerCase()),
                          ).length === 0
                            ? `
                            <div class="p-24 text-center space-y-4">
                                <div class="w-16 h-16 bg-surface-page rounded-full flex items-center justify-center mx-auto text-text-muted opacity-20">
                                    <i class="fas fa-database text-2xl"></i>
                                </div>
                                <p class="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] italic">Nenhum registro localizado</p>
                            </div>
                        `
                            : ""
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
};
