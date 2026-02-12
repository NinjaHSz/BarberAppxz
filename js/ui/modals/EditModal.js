import { state } from "../../core/state.js";

export const EditModal = () => {
  const r = state.editingRecord;
  if (!r) return "";
  const isNew = !r.id;

  return `
        <div class="modal-container fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div class="glass-card w-[98%] sm:w-full max-w-lg max-h-[95vh] overflow-y-auto custom-scroll rounded-[2rem] sm:rounded-[2.5rem] border border-transparent shadow-2xl relative animate-in zoom-in-95 duration-300">
                <div class="sticky top-0 z-10 p-4 sm:p-5 border-b border-transparent flex justify-between items-center bg-dark-900/95 backdrop-blur-md">
                    <div class="flex items-center gap-3 sm:gap-4">
                        <div class="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                            <i class="fas ${isNew ? "fa-calendar-plus" : "fa-edit"}"></i>
                        </div>
                        <div>
                            <h3 class="text-lg sm:text-xl font-bold">${isNew ? "Novo Agendamento" : "Editar Agendamento"}</h3>
                            <p class="text-[10px] text-slate-500 font-black uppercase tracking-widest truncate max-w-[150px] sm:max-w-none">${isNew ? "Preencha os dados abaixo" : r.client || r.cliente}</p>
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
                            <button type="button" onclick="window.setToBreak(true)" class="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:text-brand-hover transition-all">
                                <i class="fas fa-coffee mr-1"></i> Marcar como Pausa
                            </button>
                        </div>
                        <div class="relative">
                            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                            <input type="text" id="clientSearchInputModal" placeholder="Digite o nome do cliente..." autocomplete="off" value="${state.clientSearch || ""}"
                                   onfocus="window.openClientDropdownModal()" oninput="window.filterClientsModal(this.value)" onkeydown="window.handleEnterSelection(event, 'clientDropdownModal')"
                                   class="w-full bg-dark-900 border border-transparent py-3 pl-11 pr-4 rounded-xl outline-none focus:border-transparent transition-all font-bold text-sm">
                            <input type="hidden" name="client" value="${state.clientSearch || ""}">
                            <div id="clientDropdownModal" class="hidden absolute z-[110] left-0 right-0 mt-2 bg-dark-900 border border-transparent rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scroll p-2"></div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Data</label>
                            <input type="date" name="date" required value="${r.date || r.data}" class="w-full bg-dark-900 border border-transparent p-3 rounded-xl outline-none focus:border-transparent transition-all font-bold text-sm">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário</label>
                            <input type="time" name="time" required value="${r.time || r.horario}" class="w-full bg-dark-900 border border-transparent p-3 rounded-xl outline-none focus:border-transparent transition-all font-bold text-sm">
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Serviço</label>
                        <div class="relative">
                            <input type="text" id="serviceSearchInputModal" placeholder="Digite o serviço..." autocomplete="off" value="${r.service || r.procedimento || ""}"
                                   onfocus="window.openProcedureDropdownModal()" oninput="window.filterProceduresModal(this.value)" onkeydown="window.handleEnterSelection(event, 'procedureDropdownModal')"
                                   class="w-full bg-dark-900 border border-transparent p-3 rounded-xl outline-none focus:border-transparent transition-all font-bold text-sm uppercase">
                            <input type="hidden" name="service" value="${r.service || r.procedimento || ""}">
                            <div id="procedureDropdownModal" class="hidden absolute z-[110] left-0 right-0 mt-2 bg-dark-900 border border-transparent rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scroll p-2"></div>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Valor (R$)</label>
                        <input type="number" step="0.01" name="value" value="${r.value || r.valor || ""}" class="w-full bg-dark-900 border border-transparent p-3 rounded-xl outline-none focus:border-transparent transition-all font-bold text-sm">
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Pagamento</label>
                        <select name="payment" required class="w-full bg-dark-900 border border-transparent p-3 rounded-xl outline-none focus:border-transparent transition-all font-bold text-sm appearance-none">
                            ${[
                              "PIX",
                              "DINHEIRO",
                              "CARTÃO",
                              "PLANO MENSAL",
                              "PLANO SEMESTRAL",
                              "PLANO ANUAL",
                              "CORTESIA",
                            ]
                              .map(
                                (p) => `
                                <option value="${p}" ${(r.paymentMethod || r.forma_pagamento) === p ? "selected" : ""}>${p}</option>
                            `,
                              )
                              .join("")}
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Observações</label>
                        <textarea name="observations" rows="2" placeholder="Alguma observação importante?"
                                  class="w-full bg-dark-900 border border-transparent p-3 rounded-xl outline-none focus:border-transparent transition-all font-medium text-sm custom-scroll resize-none">${r.observations || r.observacoes || ""}</textarea>
                    </div>

                    <div class="pt-4">
                        <button type="submit" class="w-full bg-brand-primary text-surface-page font-black py-4 rounded-xl border border-transparent shadow-lg shadow-brand-primary/10 active:scale-95 uppercase tracking-widest text-xs transition-all">
                            ${isNew ? "Salvar Agendamento" : "Salvar Alterações"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};
