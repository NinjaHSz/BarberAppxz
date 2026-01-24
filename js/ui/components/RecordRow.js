import { state } from "../../core/state.js";
import { navigate } from "../navigation.js";

export const viewProfileByName = (name) => {
  const client = state.clients.find(
    (c) => (c.nome || "").toLowerCase() === name.toLowerCase(),
  );
  if (client) {
    navigate("client-profile", client.id);
  } else {
    alert("Cliente não encontrado.");
  }
};

window.viewProfileByName = viewProfileByName;

export const RecordRow = (record) => {
  const isEmpty = !!record.isEmpty;
  const isBreak = record.client === "PAUSA";
  const isDayZero = state.filters.day === 0;
  const id = record.id || "new";
  const rowId = record.id
    ? `rec_${record.id}`
    : `new_${record.time.replace(/:/g, "")}`;

  return `
        <div class="flex flex-col md:grid md:grid-cols-[70px_1.5fr_1.2fr_1fr_100px_130px_100px] md:gap-4 items-center px-6 py-4 md:py-3 hover:bg-white/[0.01] transition-colors group relative glass-card md:bg-transparent rounded-2xl md:rounded-none m-2 md:m-0 border md:border-0 border-white/5 ${isBreak ? "bg-white/[0.02] border-white/10" : ""}" style="z-index: 1;" onfocusin="this.style.zIndex = '100'" onfocusout="this.style.zIndex = '1'">
            
            <!-- HORARIO -->
            <div class="w-full text-xs md:text-sm text-amber-500 md:text-slate-400 font-black md:font-medium flex justify-between md:block">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Horário:</span>
                <input type="time" id="edit_time_${rowId}" data-id="${id}" data-ui-id="${rowId}" data-field="time" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" onfocus="window.clearPlaceholder(this)"
                     value="${record.time.substring(0, 5)}"
                     class="bg-dark-900 border border-white/5 outline-none focus:border-amber-500/50 rounded px-1.5 py-0.5 w-full md:w-auto text-xs font-bold text-amber-500 md:text-white/80 transition-all text-left">
            </div>
            
            <!-- CLIENTE -->
            <div class="w-full text-sm md:text-sm font-bold md:font-semibold flex justify-between md:block relative min-w-0">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Cliente:</span>
                <div class="flex items-center justify-start gap-2 max-w-full">
                    <div contenteditable="true" id="edit_client_${rowId}" spellcheck="false" data-id="${id}" data-ui-id="${rowId}" data-field="client" data-time="${record.time}" data-date="${record.date}"
                         onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" oninput="window.showInlineAutocomplete(this)" onfocus="window.clearPlaceholder(this)"
                         placeholder="${isEmpty && !isBreak ? "Adicionar Nome..." : ""}"
                         class="outline-none rounded px-3 py-1.5 w-full md:w-auto border border-white/5 hover:bg-white/5 focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50 text-left truncate ${isBreak ? "text-slate-500 font-black" : isEmpty ? "text-slate-400 uppercase" : "text-white uppercase"}">
                        ${isBreak ? '<i class="fas fa-circle-minus mr-2"></i> PAUSA' : record.client}
                    </div>
                    ${(() => {
                      const isNew =
                        !isBreak &&
                        !isEmpty &&
                        state.clients.find((cli) => cli.nome === record.client)
                          ?.novo_cliente;
                      return isNew
                        ? '<span class="bg-amber-500/20 text-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider hidden lg:inline-block">Novo</span>'
                        : "";
                    })()}
                </div>
                ${
                  !isEmpty && !isBreak
                    ? `
                    <button onclick="window.viewProfileByName('${record.client.replace(/'/g, "\\'")}')" 
                            class="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-amber-500/50 hover:text-amber-500 transition-all z-[10]"
                            title="Ver Perfil">
                        <i class="fas fa-external-link-alt text-[10px]"></i>
                    </button>
                `
                    : ""
                }
                <div id="inlineAutocomplete_client_${rowId}" class="hidden absolute left-0 right-0 top-full mt-2 bg-dark-800 border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] max-h-48 overflow-y-auto p-1.5 z-[500] backdrop-blur-3xl min-w-[200px]"></div>
            </div>

            <!-- SERVIÇO -->
            <div class="w-full text-xs md:text-sm flex justify-between md:block md:text-left relative min-w-0">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Serviço:</span>
                <div contenteditable="true" id="edit_service_${rowId}" spellcheck="false" data-id="${id}" data-ui-id="${rowId}" data-field="service" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" oninput="window.showInlineAutocomplete(this)" onfocus="window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50 text-left truncate w-full ${isBreak ? "text-slate-600 italic" : isEmpty ? "text-slate-500" : record.service === "A DEFINIR" ? "text-red-500 font-black animate-pulse" : "text-white font-medium"} uppercase">
                    ${isBreak ? "RESERVADO" : record.service}
                </div>
                <div id="inlineAutocomplete_service_${rowId}" class="hidden absolute left-0 right-0 top-full mt-2 bg-dark-800 border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] max-h-48 overflow-y-auto p-1.5 z-[500] backdrop-blur-3xl min-w-[200px]"></div>
            </div>

            <!-- OBS -->
            <div class="w-full text-[10px] md:text-xs flex justify-between md:block md:text-left relative group/obs min-w-0">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Obs:</span>
                <div contenteditable="true" id="edit_obs_${rowId}" spellcheck="false" autocomplete="off" data-id="${id}" data-ui-id="${rowId}" data-field="observations" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" onfocus="window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-white/5 focus:ring-1 focus:ring-white/20 text-slate-500 hover:text-slate-300 transition-all italic truncate focus:whitespace-normal focus:break-words w-full cursor-text"
                     title="${record.observations || ""}">
                    ${isBreak || isEmpty ? "---" : record.observations || "Nenhuma obs..."}
                </div>
            </div>

            <!-- VALOR -->
            <div class="w-full text-sm md:text-sm font-bold md:font-bold ${isBreak ? "text-slate-600/50" : "text-white md:text-amber-500/90"} flex justify-between md:block md:text-left relative">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Valor:</span>
                <div contenteditable="true" id="edit_value_${rowId}" spellcheck="false" autocomplete="off" data-id="${id}" data-ui-id="${rowId}" data-field="value" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" onfocus="window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50">
                    ${isEmpty || isBreak ? "---" : record.value.toFixed(2)}
                </div>
            </div>

            <!-- PAGAMENTO -->
            <div class="w-full flex justify-between md:justify-start items-center">
                <span class="md:hidden text-slate-500 font-bold uppercase text-[10px]">Pagamento:</span>
                ${
                  isBreak
                    ? `
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-black border-transparent bg-transparent text-slate-400 uppercase tracking-tighter text-left w-20">N/A</span>
                `
                    : `
                    <div class="relative w-full md:w-full ${isEmpty ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" : ""}">
                        <select id="edit_payment_${rowId}" onchange="window.saveInlineEdit(this)" data-id="${id}" data-ui-id="${rowId}" data-field="payment"
                                class="w-full appearance-none px-2 py-0.5 rounded-lg text-[10px] font-black border border-white/5 bg-white/[0.03] text-slate-500 uppercase tracking-tighter cursor-pointer focus:bg-amber-500/10 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all pr-4 text-left">
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
                                <option value="${p}" ${record.paymentMethod === p ? "selected" : ""} class="bg-dark-900">${p}</option>
                            `,
                              )
                              .join("")}
                        </select>
                        <i class="fas fa-chevron-down absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-slate-600 pointer-events-none"></i>
                    </div>
                `
                }
            </div>

            <!-- AÇÕES -->
            <div class="w-full flex justify-end gap-2 pt-4 md:pt-0 border-t md:border-0 border-white/5">
                ${
                  !isEmpty
                    ? `
                    <button onclick="window.editAppointment('${record.id}')" class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center"><i class="fas fa-edit text-xs"></i></button>
                    <button onclick="window.cancelAppointment('${record.id}')" class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center"><i class="fas fa-trash-can text-xs"></i></button>
                `
                    : `
                    <button onclick="window.openAddModal('${record.time}', '${record.date}')" class="w-full md:w-full px-4 py-2 md:py-1 rounded-lg bg-amber-500 text-dark-950 hover:bg-white hover:text-amber-600 text-[10px] font-black uppercase transition-all shadow-lg shadow-amber-500/10 active:scale-95 border border-transparent text-center items-center justify-center">Agendar</button>
                `
                }
            </div>
        </div>
    `;
};
