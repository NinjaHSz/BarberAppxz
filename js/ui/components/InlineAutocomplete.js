import { state } from "../../core/state.js";
import { getClientPlanUsage } from "../../services/clients.js";
import { saveInlineEdit } from "../../services/appointments.js";

export const setupInlineAutocomplete = () => {
  window.showInlineAutocomplete = (el) => {
    const id = el.dataset.id;
    const uiId = el.dataset.uiId;
    const field = el.dataset.field;
    if (field !== "client" && field !== "service") return;

    const val = el.innerText.trim().toLowerCase();
    const dropdown = document.getElementById(
      `inlineAutocomplete_${field}_${uiId}`,
    );
    if (!dropdown) return;

    if (val.length < 1) {
      dropdown.classList.add("hidden");
      return;
    }

    let matches = [];
    if (field === "client") {
      matches = state.clients
        .filter((c) => c.nome.toLowerCase().includes(val))
        .slice(0, 5)
        .map((c) => c.nome);
    } else {
      matches = state.procedures
        .filter((p) => p.nome.toLowerCase().includes(val))
        .slice(0, 5)
        .map((p) => p.nome);
    }

    if (matches.length === 0) {
      dropdown.classList.add("hidden");
      return;
    }

    dropdown.innerHTML = matches
      .map(
        (name) => `
        <div class="px-3 py-2 hover:bg-brand-primary hover:text-surface-page cursor-pointer rounded-lg transition-colors font-bold uppercase truncate text-[11px]"
             onmousedown="window.selectInlineData(this, '${uiId}', '${field}', '${name}')">
            <i class="fas ${field === "service" ? "fa-cut" : "fa-user text-slate-400"} mr-2 text-[10px]"></i>
            ${name}
        </div>
    `,
      )
      .join("");
    dropdown.classList.remove("hidden");
  };

  window.selectInlineData = (dropdownEl, uiId, field, value) => {
    const el = document.querySelector(
      `[data-ui-id="${uiId}"][data-field="${field}"]`,
    );
    if (el) {
      el.innerText = value;
      el.dataset.beganTyping = "false";
      dropdownEl.parentElement.classList.add("hidden");
      const isNew = el.dataset.id === "new";

      if (field === "client") {
        const valueEl = document.querySelector(
          `[data-ui-id="${uiId}"][data-field="value"]`,
        );
        const serviceEl = document.querySelector(
          `[data-ui-id="${uiId}"][data-field="service"]`,
        );
        const paymentSelect = document.querySelector(
          `[data-ui-id="${uiId}"][data-field="payment"]`,
        );
        const client = state.clients.find(
          (c) => c.nome.toLowerCase() === value.toLowerCase(),
        );

        // Apply Preset if exists
        if (client && client.preset) {
          if (serviceEl) serviceEl.innerText = client.preset.service || "";
          if (valueEl)
            valueEl.innerText = client.preset.value
              ? parseFloat(client.preset.value).toFixed(2)
              : "";
          if (paymentSelect)
            paymentSelect.value = client.preset.payment || "PIX";
        }

        const usage = getClientPlanUsage(value);
        if (usage) {
          const dateVal =
            document.querySelector(`[data-ui-id="${uiId}"][data-field="time"]`)
              ?.dataset.date || new Date().toISOString().split("T")[0];

          if (usage.isWithinLimit) {
            if (serviceEl && (!client?.preset || !client.preset.service)) {
              serviceEl.innerText = `${usage.nextVisit}º DIA`;
            }
            if (valueEl) valueEl.innerText = "0.00";
            if (paymentSelect) {
              let planPayment = "PLANO MENSAL";
              if (client?.plano === "Semestral")
                planPayment = "PLANO SEMESTRAL";
              if (client?.plano === "Anual") planPayment = "PLANO ANUAL";
              paymentSelect.value = planPayment;
            }
          } else {
            if (!client?.preset) {
              if (serviceEl) serviceEl.innerText = `RENOVAÇÃO`;
              if (valueEl && client?.valor_plano)
                valueEl.innerText = parseFloat(client.valor_plano).toFixed(2);
              if (paymentSelect) paymentSelect.value = "PIX";
            }

            if (client && window.updateClientPlan)
              window.updateClientPlan(
                client.id,
                { plano_pagamento: dateVal },
                true,
              );
          }
        }
        saveInlineEdit(el);
        // Also save other fields if they were updated by preset/plan
        if (!isNew) {
          if (serviceEl) saveInlineEdit(serviceEl);
          if (valueEl) saveInlineEdit(valueEl);
          if (paymentSelect) saveInlineEdit(paymentSelect);
        }
        return;
      }

      if (field === "service") {
        const isRenewal = /RENOVA[CÇ][AÃ]O/i.test(value);
        if (isRenewal) {
          const clientName = document
            .querySelector(`[data-ui-id="${uiId}"][data-field="client"]`)
            ?.innerText.trim();
          const client = state.clients.find(
            (c) => c.nome.toLowerCase() === clientName?.toLowerCase(),
          );
          if (client) {
            const priceEl = document.querySelector(
              `[data-ui-id="${uiId}"][data-field="value"]`,
            );
            const payEl = document.querySelector(
              `[data-ui-id="${uiId}"][data-field="payment"]`,
            );
            if (priceEl && client.valor_plano)
              priceEl.innerText = parseFloat(client.valor_plano).toFixed(2);
            if (payEl) payEl.value = "PIX";
            const dateVal =
              document.querySelector(
                `[data-ui-id="${uiId}"][data-field="time"]`,
              )?.dataset.date || new Date().toISOString().split("T")[0];
            if (dateVal && window.updateClientPlan)
              window.updateClientPlan(client.id, { plano_pagamento: dateVal });
            if (!isNew) {
              if (priceEl) saveInlineEdit(priceEl);
              if (payEl) saveInlineEdit(payEl);
            }
          }
        } else if (/\d+º\s*DIA/i.test(value)) {
          const priceEl = document.querySelector(
            `[data-ui-id="${uiId}"][data-field="value"]`,
          );
          const payEl = document.querySelector(
            `[data-ui-id="${uiId}"][data-field="payment"]`,
          );
          if (priceEl) priceEl.innerText = "0.00";
          if (payEl) {
            const clientName = document
              .querySelector(`[data-ui-id="${uiId}"][data-field="client"]`)
              ?.innerText.trim();
            const client = state.clients.find(
              (c) => c.nome.toLowerCase() === clientName?.toLowerCase(),
            );
            let planPayment = "PLANO MENSAL";
            if (client?.plano === "Semestral") planPayment = "PLANO SEMESTRAL";
            if (client?.plano === "Anual") planPayment = "PLANO ANUAL";
            payEl.value = planPayment;
          }
          if (!isNew) {
            if (priceEl) saveInlineEdit(priceEl);
            if (payEl) saveInlineEdit(payEl);
          }
        } else {
          const proc = state.procedures.find((p) => p.nome === value);
          if (proc) {
            const priceEl = document.querySelector(
              `[data-ui-id="${uiId}"][data-field="value"]`,
            );
            if (priceEl) {
              priceEl.innerText = proc.preco.toFixed(2);
              if (!isNew) saveInlineEdit(priceEl);
            }
          }
        }
      }
      saveInlineEdit(el);
    }
  };
};
