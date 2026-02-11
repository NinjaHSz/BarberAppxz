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

  const isCompact = state.displayMode === "compact";

  return `
        <div class="flex flex-col md:grid md:grid-cols-[70px_1.5fr_1.2fr_1fr_100px_130px_100px] md:gap-4 items-center px-6 ${isCompact ? "py-1" : "py-4 md:py-3"} hover:bg-surface-subtle transition-colors group relative glass-card md:bg-transparent rounded-2xl md:rounded-none m-2 md:m-0 border-none ${isBreak ? "bg-surface-subtle" : ""} focus-within:z-[100] z-[1]">
            
            <!-- HORARIO -->
            <div class="w-full text-xs md:text-sm text-brand-primary md:text-text-secondary font-black md:font-medium flex justify-between md:block">
                <span class="md:hidden text-text-muted font-bold uppercase text-[10px] whitespace-nowrap shrink-0">Horário:</span>
                <input type="time" id="edit_time_${rowId}" data-id="${id}" data-ui-id="${rowId}" data-field="time" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" onfocus="window.clearPlaceholder(this)"
                     value="${record.time.substring(0, 5)}"
                     class="bg-surface-section border-none outline-none focus:ring-1 focus:ring-border-focus rounded px-1.5 py-0.5 w-full md:w-auto text-xs font-bold text-brand-primary md:text-text-primary/80 transition-all text-left">
            </div>
            
            <!-- CLIENTE -->
            <div class="w-full text-sm md:text-sm font-bold md:font-semibold flex justify-between md:block relative min-w-0">
                <span class="md:hidden text-text-muted font-bold uppercase text-[10px] whitespace-nowrap shrink-0">Cliente:</span>
                <div class="flex items-center justify-start gap-2 max-w-full">
                    <div contenteditable="true" id="edit_client_${rowId}" spellcheck="false" data-id="${id}" data-ui-id="${rowId}" data-field="client" data-time="${record.time}" data-date="${record.date}"
                         onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" oninput="window.showInlineAutocomplete(this)" onfocus="window.clearPlaceholder(this)"
                         placeholder="${isEmpty && !isBreak ? "Adicionar Nome..." : ""}"
                         class="outline-none rounded px-3 py-1.5 w-full md:w-auto border-none hover:bg-surface-subtle focus:bg-brand-primary/10 focus:ring-1 focus:ring-brand-primary/50 text-left truncate ${isBreak ? "text-text-muted font-black" : isEmpty ? "text-text-secondary uppercase" : "text-text-primary uppercase"}">
                        ${isBreak ? '<i class="fas fa-circle-minus mr-2"></i> PAUSA' : record.client}
                    </div>
                    ${(() => {
                      const isNew =
                        !isBreak &&
                        !isEmpty &&
                        state.clients.find((cli) => cli.nome === record.client)
                          ?.novo_cliente;
                      return isNew
                        ? '<span class="bg-brand-primary/20 text-brand-primary text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider hidden lg:inline-block">Novo</span>'
                        : "";
                    })()}
                </div>
                ${
                  !isEmpty && !isBreak
                    ? `
                    <button onclick="window.viewProfileByName('${record.client.replace(/'/g, "\\'")}')" 
                            class="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-brand-primary/50 hover:text-brand-primary transition-all z-[10]"
                            title="Ver Perfil">
                        <i class="fas fa-external-link-alt text-[10px]"></i>
                    </button>
                `
                    : ""
                }
                <div id="inlineAutocomplete_client_${rowId}" class="hidden absolute left-0 right-0 top-full mt-2 bg-surface-elevated border-none rounded-xl shadow-lg max-h-48 overflow-y-auto p-1.5 z-[500] backdrop-blur-3xl min-w-[200px]"></div>
            </div>

            <!-- SERVIÇO -->
            <div class="w-full text-xs md:text-sm flex justify-between md:block md:text-left relative min-w-0">
                <span class="md:hidden text-text-muted font-bold uppercase text-[10px] whitespace-nowrap shrink-0">Serviço:</span>
                <div contenteditable="true" id="edit_service_${rowId}" spellcheck="false" data-id="${id}" data-ui-id="${rowId}" data-field="service" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" oninput="window.showInlineAutocomplete(this)" onfocus="window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-brand-primary/10 focus:ring-1 focus:ring-brand-primary/50 text-left truncate w-full ${isBreak ? "text-text-muted italic" : isEmpty ? "text-text-secondary" : record.service === "A DEFINIR" ? "text-status-error font-black animate-pulse" : "text-text-primary font-medium"} uppercase">
                    ${isBreak ? "RESERVADO" : record.service}
                </div>
                <div id="inlineAutocomplete_service_${rowId}" class="hidden absolute left-0 right-0 top-full mt-2 bg-surface-elevated border-none rounded-xl shadow-lg max-h-48 overflow-y-auto p-1.5 z-[500] backdrop-blur-3xl min-w-[200px]"></div>
            </div>

            <!-- OBS -->
            <div class="w-full text-[10px] md:text-xs flex justify-between md:block md:text-left relative group/obs min-w-0">
                <span class="md:hidden text-text-muted font-bold uppercase text-[10px] whitespace-nowrap shrink-0">Obs:</span>
                <div contenteditable="true" id="edit_obs_${rowId}" spellcheck="false" autocomplete="off" data-id="${id}" data-ui-id="${rowId}" data-field="observations" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" onfocus="window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-surface-subtle focus:ring-1 focus:ring-border-focus text-text-secondary hover:text-text-primary transition-all italic truncate focus:whitespace-normal focus:break-words w-full cursor-text"
                     title="${record.observations || ""}">
                    ${isBreak || isEmpty ? "---" : record.observations || "Nenhuma obs..."}
                </div>
            </div>

            <!-- VALOR -->
            <div class="w-full text-sm md:text-sm font-bold md:font-bold ${isBreak ? "text-text-muted/50" : "text-text-primary md:text-brand-primary/90"} flex justify-between md:block md:text-left relative">
                <span class="md:hidden text-text-muted font-bold uppercase text-[10px] whitespace-nowrap shrink-0">Valor:</span>
                <div contenteditable="true" id="edit_value_${rowId}" spellcheck="false" autocomplete="off" data-id="${id}" data-ui-id="${rowId}" data-field="value" data-time="${record.time}" data-date="${record.date}"
                     onblur="window.saveInlineEdit(this)" onkeydown="window.handleInlineKey(event)" onfocus="window.clearPlaceholder(this)"
                     class="outline-none rounded px-1 focus:bg-brand-primary/10 focus:ring-1 focus:ring-brand-primary/50">
                    ${isEmpty || isBreak ? "---" : record.value.toFixed(2)}
                </div>
            </div>

            <!-- PAGAMENTO -->
            <div class="w-full flex justify-between md:justify-start items-center">
                <span class="md:hidden text-text-muted font-bold uppercase text-[10px] whitespace-nowrap shrink-0">Pagamento:</span>
                ${
                  isBreak
                    ? `
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-black border-transparent bg-transparent text-text-muted uppercase tracking-tighter text-left w-20">N/A</span>
                `
                    : `
                    <div class="relative w-full md:w-full ${isEmpty ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" : ""}">
                        <select id="edit_payment_${rowId}" onchange="window.saveInlineEdit(this)" data-id="${id}" data-ui-id="${rowId}" data-field="payment"
                                class="w-full appearance-none px-2 py-0.5 rounded-lg text-[10px] font-black border-none bg-surface-subtle text-text-secondary uppercase tracking-tighter cursor-pointer focus:bg-brand-primary/10 focus:ring-1 focus:ring-brand-primary/50 outline-none transition-all pr-4 text-left">
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
                                <option value="${p}" ${record.paymentMethod === p ? "selected" : ""} class="bg-surface-page">${p}</option>
                            `,
                              )
                              .join("")}
                        </select>
                        <i class="fas fa-chevron-down absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-text-muted pointer-events-none"></i>
                    </div>
                `
                }
            </div>

            <!-- AÇÕES -->
            <div class="w-full flex justify-end gap-2 pt-4 md:pt-0 border-none">
                ${
                  !isEmpty
                    ? `
                    <button onclick="window.editAppointment('${record.id}')" class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-slate-400/10 text-slate-400 hover:bg-slate-400 hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center"><i class="fas fa-edit text-xs"></i></button>
                    <button onclick="window.cancelAppointment('${record.id}')" class="w-9 h-9 md:w-8 md:h-8 rounded-xl bg-status-error/10 text-status-error hover:bg-status-error hover:text-white transition-all transform active:scale-95 shadow-sm flex items-center justify-center"><i class="fas fa-trash-can text-xs"></i></button>
                `
                    : `
                    <button onclick="window.openAddModal('${record.time}', '${record.date}')" class="w-full md:w-full px-4 py-2 md:py-1 rounded-lg bg-brand-primary text-surface-page hover:bg-white hover:text-brand-primary text-[10px] font-black uppercase transition-all shadow-lg shadow-brand-primary/10 active:scale-95 border-none text-center items-center justify-center">Agendar</button>
                `
                }
            </div>
        </div>
    `;
};
