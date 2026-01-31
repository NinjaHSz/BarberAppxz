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
};
