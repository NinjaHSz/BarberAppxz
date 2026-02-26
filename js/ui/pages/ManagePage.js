import { state } from "../../core/state.js";
import { SetupPage } from "./SetupPage.js";

export const ManagePage = () => {
  if (!state.isIntegrated) return SetupPage();
  const isEditing = !!(
    state.editingRecord &&
    (state.editingRecord.id || state.editingRecord.cliente)
  );

  const today = new Date().toISOString().split("T")[0];
  const initialValues = {
    date: today,
    time: "",
    client: "",
    service: "",
    value: "",
    paymentMethod: "PIX",
    ...(state.editingRecord || {}),
  };

  return `
        <div class="p-4 sm:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="glass-card p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-transparent">
                <div class="flex items-center space-x-4 mb-8 sm:mb-10">
                    <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                        <i class="fas ${isEditing ? "fa-edit" : "fa-calendar-plus"} text-2xl sm:text-3xl"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl sm:text-4xl font-display font-black tracking-tight">${isEditing ? "Editar Agendamento" : "Novo Agendamento"}</h2>
                        <p class="text-slate-500 text-xs sm:text-sm font-medium">${isEditing ? "Altere as informações abaixo" : "Selecione um cliente para agendar"}</p>
                    </div>
                </div>

                <form onsubmit="window.saveNewRecord(event)" class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Data</label>
                        <input type="date" name="date" required value="${initialValues.date}"
                               class="w-full bg-dark-900 border border-transparent p-4 rounded-2xl outline-none focus:border-transparent transition-all font-bold">
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Horário</label>
                        <input type="time" name="time" required value="${initialValues.time}"
                               class="w-full bg-dark-900 border border-transparent p-4 rounded-2xl outline-none focus:border-transparent transition-all font-bold">
                    </div>

                    <div class="space-y-2 col-span-1 md:col-span-2">
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Cliente</label>
                            <button type="button" onclick="window.setToBreak(false)" class="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:text-brand-hover transition-all">
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
                                   value="${state.clientSearch || ""}"
                                   onfocus="window.openClientDropdown()"
                                   oninput="window.filterClients(this.value)"
                                   onkeydown="window.handleEnterSelection(event, 'clientDropdown')"
                                   class="w-full bg-dark-900 border border-transparent py-4 pl-12 pr-4 rounded-2xl outline-none focus:border-transparent transition-all font-bold">
                            
                            <input type="hidden" name="client" value="${state.clientSearch || ""}">

                            <div id="clientDropdown" class="hidden absolute z-50 left-0 right-0 mt-2 bg-dark-900 border border-transparent rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scroll p-2">
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
                                   value="${initialValues.service || initialValues.procedimento || ""}"
                                   onfocus="window.openProcedureDropdown()"
                                   oninput="window.filterProcedures(this.value)"
                                   onkeydown="window.handleEnterSelection(event, 'procedureDropdown')"
                                   class="w-full bg-dark-900 border border-transparent p-4 rounded-2xl outline-none focus:border-transparent transition-all font-bold uppercase">
                            
                            <input type="hidden" name="service" value="${initialValues.service || initialValues.procedimento || ""}">

                            <div id="procedureDropdown" class="hidden absolute z-50 left-0 right-0 mt-2 bg-dark-900 border border-transparent rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scroll p-2">
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Valor (R$)</label>
                        <input type="number" step="0.01" name="value" placeholder="0,00" value="${initialValues.value || initialValues.valor}"
                               class="w-full bg-dark-900 border border-transparent p-4 rounded-2xl outline-none focus:border-transparent transition-all font-bold">
                    </div>

                    <div class="space-y-2 col-span-1 md:col-span-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Forma de Pagamento</label>
                        <div class="relative">
                            <select name="payment" required
                                    class="w-full bg-dark-900 border border-transparent p-4 rounded-2xl outline-none focus:border-transparent transition-all font-bold appearance-none">
                                ${[
                                  "PIX",
                                  "DINHEIRO",
                                  "CARTÃO",
                                  "PLANO",
                                  "CORTESIA",
                                ]
                                  .map(
                                    (p) => `
                                    <option value="${p}" ${(initialValues.paymentMethod || initialValues.forma_pagamento) === p ? "selected" : ""}>${p}${p === "CARTÃO" ? " DE CRÉDITO/DÉBITO" : ""}</option>
                                `,
                                  )
                                  .join("")}
                            </select>
                            <i class="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                        </div>
                    </div>

                    <div class="space-y-2 col-span-1 md:col-span-2">
                        <label class="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Observações</label>
                        <textarea name="observations" rows="3" placeholder="Escreva aqui detalhes importantes sobre o atendimento..."
                                  class="w-full bg-dark-900 border border-transparent p-4 rounded-2xl outline-none focus:border-transparent transition-all font-medium custom-scroll resize-none">${initialValues.observations || initialValues.observacoes || ""}</textarea>
                    </div>

                    <div class="col-span-1 md:col-span-2 pt-6">
                        <button type="submit" ${state.clients.length === 0 ? "disabled" : ""}
                                class="w-full bg-brand-primary disabled:bg-white/5 disabled:text-white/20 text-surface-page font-black py-5 rounded-2xl border border-transparent shadow-xl shadow-brand-primary/20 transform hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-widest">
                            ${isEditing ? "Salvar Alterações" : "Salvar Agendamento"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};
