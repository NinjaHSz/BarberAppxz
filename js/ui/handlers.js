import { state } from "../core/state.js";
import { setupAutocomplete } from "./components/Autocomplete.js";
import { setupInlineAutocomplete } from "./components/InlineAutocomplete.js";
import { setupExpenseAutocomplete } from "./components/ExpenseAutocomplete.js";
import { navigate } from "./navigation.js";

export const setupGlobalHandlers = () => {
  if (window.hasGlobalHandlers) return;

  setupAutocomplete();
  setupInlineAutocomplete();
  setupExpenseAutocomplete();

  window.openAddModal = (time = "", date = "") => {
    state.editingRecord = { time, date };
    state.clientSearch = "";
    state.isEditModalOpen = true;
    if (window.render) window.render();
  };

  window.editAppointment = (id) => {
    const record = state.records.find((r) => String(r.id) === String(id));
    if (record) {
      state.editingRecord = record;
      state.clientSearch = record.client;
      state.isEditModalOpen = true;
      if (window.render) window.render();
    }
  };

  window.closeEditModal = () => {
    state.isEditModalOpen = false;
    state.editingRecord = null;
    if (window.render) window.render();
  };

  window.handleSearch = (e) => {
    state.searchTerm = (e.target || e).value;
    if (window.render) window.render();
  };

  window.toggleEmptySlots = () => {
    state.showEmptySlots = !state.showEmptySlots;
    if (window.render) window.render();
  };

  window.handleEnterSelection = (e, dropdownId) => {
    if (e.key === "Enter") {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown && !dropdown.classList.contains("hidden")) {
        const firstOption = dropdown.querySelector("div");
        if (firstOption) {
          e.preventDefault();
          const mousedownEvent = new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
          });
          firstOption.dispatchEvent(mousedownEvent);
          dropdown.classList.add("hidden");
          return true;
        }
      }
    }
    return false;
  };

  window.handleInlineKey = (e) => {
    const id = e.target.dataset.id;
    const uiId = e.target.dataset.uiId;
    const field = e.target.dataset.field;
    if (e.key === "Enter") {
      e.preventDefault();
      const dropdown =
        document.getElementById(`inlineAutocomplete_${field}_${uiId}`) ||
        document.getElementById(`expenseAutocomplete_${id}`);
      if (dropdown && !dropdown.classList.contains("hidden")) {
        const firstOption = dropdown.querySelector("div");
        if (firstOption) {
          const mousedownEvent = new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
          });
          firstOption.dispatchEvent(mousedownEvent);
          return;
        }
      }
      e.target.blur();
    }
  };

  window.clearPlaceholder = (el) => {
    const currentText = el.innerText.trim();
    if (currentText === "---" || currentText === "Adicionar Nome...") {
      el.innerText = "";
    } else {
      if (window.selectAll) window.selectAll(el);
    }
  };

  window.setToBreak = (isModal = true) => {
    const suffix = isModal ? "Modal" : "";
    const clientInput = document.getElementById(`clientSearchInput${suffix}`);
    const clientHidden = document
      .querySelector(isModal ? "#clientSearchInputModal" : "#clientSearchInput")
      ?.parentElement?.querySelector('input[name="client"]');
    const serviceSearchInput = document.getElementById(
      `serviceSearchInput${suffix}`,
    );
    const serviceHidden = document
      .querySelector(
        isModal ? "#serviceSearchInputModal" : "#serviceSearchInput",
      )
      ?.parentElement?.querySelector('input[name="service"]');
    const form = clientInput?.closest("form");
    const valueInput = form?.querySelector('input[name="value"]');
    const paymentSelect = form?.querySelector('select[name="payment"]');
    if (clientInput) clientInput.value = "PAUSA";
    if (clientHidden) clientHidden.value = "PAUSA";
    if (serviceSearchInput) serviceSearchInput.value = "BLOQUEADO";
    if (serviceHidden) serviceHidden.value = "BLOQUEADO";
    if (valueInput) valueInput.value = "0";
    if (paymentSelect) paymentSelect.value = "CORTESIA";
  };

  document.addEventListener("mousedown", (e) => {
    const dropdowns = [
      "clientDropdown",
      "clientDropdownModal",
      "procedureDropdown",
      "procedureDropdownModal",
    ];
    dropdowns.forEach((id) => {
      const dropdown = document.getElementById(id);
      const input = document.getElementById(
        id.replace("Dropdown", "SearchInput"),
      );
      if (
        dropdown &&
        !dropdown.classList.contains("hidden") &&
        !dropdown.contains(e.target) &&
        (!input || !input.contains(e.target))
      ) {
        dropdown.classList.add("hidden");
      }
    });

    document.querySelectorAll('[id^="inlineAutocomplete_"]').forEach((d) => {
      if (!d.contains(e.target)) d.classList.add("hidden");
    });
  });

  window.setExpenseFilter = (field, val) => {
    state[field] = val;
    if (field === "expenseSearchTerm") {
      const inputId = "expenseSearchInput";
      const cursorPosition = document.getElementById(inputId)?.selectionStart;
      if (window.render) window.render();
      const input = document.getElementById(inputId);
      if (input) {
        input.focus();
        if (cursorPosition !== undefined)
          input.setSelectionRange(cursorPosition, cursorPosition);
      }
    } else {
      if (window.render) window.render();
    }
  };

  window.navigate = navigate;
  window.hasGlobalHandlers = true;

  // NOVAS FUNÇÕES: Sugestão de Horários e Máscara de Moeda
  window.formatCurrencyInput = (el) => {
    let value = el.value.replace(/\D/g, "");
    if (value === "") {
      el.value = "";
      return;
    }
    value = (parseInt(value) / 100).toFixed(2);
    el.value = value;
  };

  window.getAvailableTimesList = (date) => {
    if (!date) return [];

    const currentId = state.editingRecord?.id;
    const realAppointments = state.records
      .filter(
        (r) =>
          r.date === date && (!currentId || String(r.id) !== String(currentId)),
      )
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    const dayStartMin = 7 * 60 + 20; // 07:20
    const dayEndMin = 20 * 60 + 40; // 20:40
    const lunchStartMin = 12 * 60; // 12:00
    const lunchEndMin = 13 * 60; // 13:00
    const slotDuration = 40;

    const toMin = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const fromMin = (m) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    };

    const suggestions = [];
    let currentMin = dayStartMin;

    while (currentMin <= dayEndMin) {
      if (currentMin >= lunchStartMin && currentMin < lunchEndMin) {
        currentMin = lunchEndMin;
        continue;
      }

      const isOccupied = realAppointments.some((r) => {
        const m = toMin(r.time);
        return m >= currentMin - 10 && m < currentMin + 30;
      });

      if (!isOccupied) {
        suggestions.push(fromMin(currentMin));
      }
      currentMin += slotDuration;
      if (suggestions.length > 50) break;
    }
    return suggestions;
  };

  window.suggestTimes = (date) => {
    const suggestions = window.getAvailableTimesList(date);
    const container = document.getElementById("timeSuggestionsModal");
    if (container) {
      if (suggestions.length === 0) {
        container.innerHTML = `<p class="text-[10px] text-slate-600 italic">Nenhum horário disponível.</p>`;
      } else {
        container.innerHTML = suggestions
          .map(
            (t) => `
                  <button type="button" onclick="window.selectSuggestedTime('${t}')" 
                          class="px-2 py-1.5 bg-white/5 hover:bg-brand-primary hover:text-surface-page rounded-lg text-[10px] font-black transition-all">
                      ${t}
                  </button>
              `,
          )
          .join("");
      }
    }
  };

  window.handleCopyTimes = (e, date) => {
    let targetDate = date;
    if (!targetDate) {
      const targetDay = parseInt(state.filters.day);
      const targetMonth = String(state.filters.month).padStart(2, "0");
      const targetYear = String(state.filters.year);
      targetDate = `${targetYear}-${targetMonth}-${String(targetDay).padStart(
        2,
        "0",
      )}`;
    }

    // Remover menu anterior se existir
    const oldMenu = document.getElementById("copyTimesMenu");
    if (oldMenu) oldMenu.remove();

    const suggestions = window.getAvailableTimesList(targetDate);
    if (suggestions.length === 0) {
      alert("Nenhum horário disponível para copiar.");
      return;
    }

    const menu = document.createElement("div");
    menu.id = "copyTimesMenu";
    menu.className =
      "fixed bg-surface-section border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden animate-in fade-in zoom-in duration-200";

    // Posicionamento
    const rect = e.currentTarget.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;
    menu.style.width = "150px";

    window.showCopyNotification = (label, content) => {
      const oldNotify = document.getElementById("copyNotification");
      if (oldNotify) oldNotify.remove();

      // Ensure animation style exists
      if (!document.getElementById("notificationAnimationStyle")) {
        const style = document.createElement("style");
        style.id = "notificationAnimationStyle";
        style.innerHTML = `
          @keyframes slide-in-out {
            0% { transform: translate(-50%, 30px); opacity: 0; }
            15% { transform: translate(-50%, 0); opacity: 1; }
            85% { transform: translate(-50%, 0); opacity: 1; }
            100% { transform: translate(-50%, 30px); opacity: 0; }
          }
          .animate-slide-notify {
            animation: slide-in-out 1.5s ease-in-out forwards;
          }
        `;
        document.head.appendChild(style);
      }

      const notify = document.createElement("div");
      notify.id = "copyNotification";
      notify.className =
        "fixed bottom-24 left-1/2 -translate-x-1/2 bg-surface-section/95 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[10000] flex flex-col gap-3 min-w-[300px] max-w-[90vw] animate-slide-notify";

      notify.innerHTML = `
          <div class="flex items-center gap-3 border-b border-white/5 pb-3">
              <div class="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/20">
                  <i class="fas fa-check text-surface-page text-sm"></i>
              </div>
              <div>
                  <p class="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Sucesso</p>
                  <p class="text-sm font-bold text-text-primary capitalize">${label}</p>
              </div>
          </div>
          <div class="bg-black/40 p-3 rounded-xl border border-white/5">
              <p class="text-[11px] text-text-secondary font-medium leading-relaxed tracking-tight break-words">${content}</p>
          </div>
      `;

      document.body.appendChild(notify);
      notify.onclick = () => notify.remove();
      setTimeout(() => {
        if (notify) notify.remove();
      }, 1600);
    };

    const createOption = (label, iconClass, filterFn) => {
      const btn = document.createElement("button");
      btn.className =
        "w-full text-left px-4 py-3 text-xs font-bold text-text-secondary hover:bg-brand-primary hover:text-surface-page transition-all border-none flex items-center gap-2";
      btn.innerHTML = `<i class="fas ${iconClass} w-4 text-center"></i> <span>${label}</span>`;
      btn.onclick = () => {
        const filtered = suggestions.filter(filterFn);
        if (filtered.length === 0) {
          window.showCopyNotification(
            label,
            "Nenhum horário disponível para este período.",
          );
        } else {
          const textToCopy = filtered.join(" - ");
          navigator.clipboard.writeText(textToCopy).then(() => {
            window.showCopyNotification(label, textToCopy);
          });
        }
        menu.remove();
      };
      return btn;
    };

    menu.appendChild(
      createOption("Manhã", "fa-sun", (t) => parseInt(t.split(":")[0]) < 12),
    );
    menu.appendChild(
      createOption(
        "Tarde",
        "fa-cloud-sun",
        (t) => parseInt(t.split(":")[0]) >= 13,
      ),
    );
    menu.appendChild(createOption("Todos", "fa-list", () => true));

    document.body.appendChild(menu);

    // Fechar ao clicar fora
    const closeMenu = (event) => {
      if (!menu.contains(event.target) && event.target !== e.currentTarget) {
        menu.remove();
        document.removeEventListener("mousedown", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closeMenu), 10);
  };

  window.selectSuggestedTime = (time) => {
    const timeInput = document.querySelector('input[name="time"]');
    if (timeInput) {
      timeInput.value = time;
      // Trigger any UI updates if needed
    }
  };
};
