import { state } from "../../core/state.js";
import { getClientPlanUsage } from "../../services/clients.js";

export const setupAutocomplete = () => {
  window.openClientDropdown = () => {
    const dropdown = document.getElementById("clientDropdown");
    const input = document.getElementById("clientSearchInput");
    if (dropdown && input) {
      const val = input.value;
      const filtered = state.clients.filter((c) =>
        c.nome.toLowerCase().includes(val.toLowerCase()),
      );
      dropdown.innerHTML =
        filtered
          .map((c) => {
            const planStats = getClientPlanUsage(c.nome);
            const hasPlan = planStats !== null;
            return `
          <div onmousedown="window.selectClient('${c.nome.replace(/'/g, "\\'")}')" 
               class="p-3 hover:bg-brand-primary/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
              <div class="flex flex-col">
                  <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${c.nome}</span>
                  <span class="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">${c.telefone || "SEM TELEFONE..."}</span>
              </div>
              ${
                hasPlan
                  ? `
                  <div class="text-right">
                      <span class="${planStats.usageCount >= planStats.limit ? "text-slate-600" : "text-slate-300"} font-black text-[10px] block">
                          ${planStats.usageCount}/${planStats.limit}
                      </span>
                      <span class="text-[8px] text-slate-600 font-black uppercase tracking-tighter block">CORTES</span>
                  </div>
              `
                  : ""
              }
          </div>
        `;
          })
          .join("") ||
        `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
      dropdown.classList.remove("hidden");
    }
  };

  window.filterClients = (val) => {
    state.clientSearch = val;
    const dropdown = document.getElementById("clientDropdown");
    const hidden = document.querySelector('input[name="client"]');
    if (hidden) hidden.value = val;
    window.openClientDropdown();
  };

  window.selectClient = (name) => {
    state.clientSearch = name;
    const input = document.getElementById("clientSearchInput");
    const hidden = document.querySelector('input[name="client"]');
    if (input) input.value = name;
    if (hidden) hidden.value = name;
    document.getElementById("clientDropdown")?.classList.add("hidden");

    const usage = getClientPlanUsage(name);
    const form = document.querySelector(
      'form[onsubmit="window.saveNewRecord(event)"]:not(.glass-card form)',
    );
    if (form) {
      const serviceInput = form.querySelector("#serviceSearchInput");
      const serviceHidden = form.querySelector('input[name="service"]');
      const valueInput = form.querySelector('input[name="value"]');
      const paymentSelect = form.querySelector('select[name="payment"]');
      const client = state.clients.find(
        (c) => c.nome.toLowerCase() === name.toLowerCase(),
      );

      // Apply Preset if exists
      if (client && client.preset) {
        if (serviceInput) serviceInput.value = client.preset.service || "";
        if (serviceHidden) serviceHidden.value = client.preset.service || "";
        if (valueInput)
          valueInput.value = client.preset.value
            ? parseFloat(client.preset.value).toFixed(2)
            : "";
        if (paymentSelect) paymentSelect.value = client.preset.payment || "PIX";
      }

      if (usage && usage.isWithinLimit) {
        const planServiceName = `${usage.nextVisit}º DIA`;
        if (serviceInput && (!client?.preset || !client.preset.service)) {
          serviceInput.value = planServiceName;
          if (serviceHidden) serviceHidden.value = planServiceName;
        }
        if (valueInput) valueInput.value = "0";
        if (paymentSelect) {
          let planPayment = "PLANO MENSAL";
          if (client?.plano === "Semestral") planPayment = "PLANO SEMESTRAL";
          if (client?.plano === "Anual") planPayment = "PLANO ANUAL";
          paymentSelect.value = planPayment;
        }
      }
    }
  };

  window.openClientDropdownModal = () => {
    const dropdown = document.getElementById("clientDropdownModal");
    const input = document.getElementById("clientSearchInputModal");
    if (dropdown && input) {
      const val = input.value;
      const filtered = state.clients.filter((c) =>
        c.nome.toLowerCase().includes(val.toLowerCase()),
      );
      dropdown.innerHTML =
        filtered
          .map((c) => {
            const planStats = getClientPlanUsage(c.nome);
            const hasPlan = planStats !== null;
            return `
          <div onmousedown="window.selectClientModal('${c.nome.replace(/'/g, "\\'")}')" 
               class="p-3 hover:bg-brand-primary/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
              <div class="flex flex-col">
                  <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${c.nome}</span>
                  <span class="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">${c.telefone || "SEM TELEFONE..."}</span>
              </div>
              ${
                hasPlan
                  ? `
                  <div class="text-right">
                      <span class="${planStats.usageCount >= planStats.limit ? "text-slate-600" : "text-slate-300"} font-black text-[10px] block">
                          ${planStats.usageCount}/${planStats.limit}
                      </span>
                      <span class="text-[8px] text-slate-600 font-black uppercase tracking-tighter block">CORTES</span>
                  </div>
              `
                  : ""
              }
          </div>
        `;
          })
          .join("") ||
        `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum cliente encontrado.</div>`;
      dropdown.classList.remove("hidden");
    }
  };

  window.filterClientsModal = (val) => {
    state.clientSearch = val;
    const hidden = document
      .querySelector("#clientSearchInputModal")
      ?.parentElement?.querySelector('input[name="client"]');
    if (hidden) hidden.value = val;
    window.openClientDropdownModal();
  };

  window.selectClientModal = (name) => {
    state.clientSearch = name;
    const input = document.getElementById("clientSearchInputModal");
    const hidden = document
      .querySelector("#clientSearchInputModal")
      ?.parentElement?.querySelector('input[name="client"]');
    if (input) input.value = name;
    if (hidden) hidden.value = name;
    document.getElementById("clientDropdownModal")?.classList.add("hidden");

    const usage = getClientPlanUsage(name);
    const form = document.querySelector(
      '.glass-card form[onsubmit="window.saveNewRecord(event)"]',
    );
    if (form) {
      const serviceInput = form.querySelector("#serviceSearchInputModal");
      const serviceHidden = form.querySelector('input[name="service"]');
      const valueInput = form.querySelector('input[name="value"]');
      const paymentSelect = form.querySelector('select[name="payment"]');
      const client = state.clients.find(
        (c) => c.nome.toLowerCase() === name.toLowerCase(),
      );

      // Apply Preset if exists
      if (client && client.preset) {
        if (serviceInput) serviceInput.value = client.preset.service || "";
        if (serviceHidden) serviceHidden.value = client.preset.service || "";
        if (valueInput)
          valueInput.value = client.preset.value
            ? parseFloat(client.preset.value).toFixed(2)
            : "";
        if (paymentSelect) paymentSelect.value = client.preset.payment || "PIX";
      }

      // Plan logic takes precedence for specific fields if valid
      if (usage) {
        if (usage.isWithinLimit) {
          const planServiceName = `${usage.nextVisit}º DIA`;
          // If no preset service, use plan service name
          if (serviceInput && (!client?.preset || !client.preset.service)) {
            serviceInput.value = planServiceName;
            if (serviceHidden) serviceHidden.value = planServiceName;
          }
          if (valueInput) valueInput.value = "0";
          if (paymentSelect) {
            let planPayment = "PLANO MENSAL";
            if (client?.plano === "Semestral") planPayment = "PLANO SEMESTRAL";
            if (client?.plano === "Anual") planPayment = "PLANO ANUAL";
            paymentSelect.value = planPayment;
          }
        } else {
          // If over limit, suggest renewal if no preset
          if (!client?.preset) {
            const renewalService = `RENOVAÇÃO`;
            if (serviceInput) serviceInput.value = renewalService;
            if (serviceHidden) serviceHidden.value = renewalService;
            if (valueInput && client?.valor_plano)
              valueInput.value = parseFloat(client.valor_plano).toFixed(2);
            if (paymentSelect) paymentSelect.value = "PIX";
          }
        }
      }
    }
  };

  window.openProcedureDropdown = () => {
    const dropdown = document.getElementById("procedureDropdown");
    const input = document.getElementById("serviceSearchInput");
    if (dropdown && input) {
      const val = input.value.toLowerCase();
      const filtered = state.procedures.filter((p) =>
        p.nome.toLowerCase().includes(val),
      );
      dropdown.innerHTML =
        filtered
          .map(
            (p) => `
          <div onmousedown="window.selectProcedure('${p.nome.replace(/'/g, "\\'")}', ${p.preco})" 
               class="p-3 hover:bg-brand-primary/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
              <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${p.nome}</span>
              <span class="text-[10px] font-black text-brand-primary/50 group-hover:text-brand-primary">R$ ${p.preco.toFixed(2)}</span>
          </div>
      `,
          )
          .join("") ||
        `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum serviço encontrado.</div>`;
      dropdown.classList.remove("hidden");
    }
  };

  window.filterProcedures = (val) => {
    const hidden = document.querySelector('input[name="service"]');
    if (hidden) hidden.value = val;
    window.openProcedureDropdown();
  };

  window.selectProcedure = (name, price) => {
    const input = document.getElementById("serviceSearchInput");
    const hidden = document.querySelector('input[name="service"]');
    const priceInput = document.querySelector('input[name="value"]');
    if (input) input.value = name;
    if (hidden) hidden.value = name;
    if (priceInput && price) priceInput.value = price;
    document.getElementById("procedureDropdown")?.classList.add("hidden");
  };

  window.openProcedureDropdownModal = () => {
    const dropdown = document.getElementById("procedureDropdownModal");
    const input = document.getElementById("serviceSearchInputModal");
    if (dropdown && input) {
      const val = input.value.toLowerCase();
      const filtered = state.procedures.filter((p) =>
        p.nome.toLowerCase().includes(val),
      );
      dropdown.innerHTML =
        filtered
          .map(
            (p) => `
          <div onmousedown="window.selectProcedureModal('${p.nome.replace(/'/g, "\\'")}', ${p.preco})" 
               class="p-3 hover:bg-brand-primary/10 rounded-xl cursor-pointer transition-all group flex justify-between items-center text-left">
              <span class="font-bold text-slate-300 group-hover:text-white uppercase text-xs">${p.nome}</span>
              <span class="text-[10px] font-black text-brand-primary/50 group-hover:text-brand-primary">R$ ${p.preco.toFixed(2)}</span>
          </div>
      `,
          )
          .join("") ||
        `<div class="p-4 text-center text-slate-500 text-xs italic">Nenhum serviço encontrado.</div>`;
      dropdown.classList.remove("hidden");
    }
  };

  window.filterProceduresModal = (val) => {
    const hidden = document
      .querySelector("#serviceSearchInputModal")
      ?.parentElement?.querySelector('input[name="service"]');
    if (hidden) hidden.value = val;
    window.openProcedureDropdownModal();
  };

  window.selectProcedureModal = (name, price) => {
    const input = document.getElementById("serviceSearchInputModal");
    const hidden = document
      .querySelector("#serviceSearchInputModal")
      ?.parentElement?.querySelector('input[name="service"]');
    const priceInput = document.querySelector(
      '.glass-card input[name="value"]',
    );
    if (input) input.value = name;
    if (hidden) hidden.value = name;
    if (priceInput && price) priceInput.value = price;
    document.getElementById("procedureDropdownModal")?.classList.add("hidden");
  };

  window.updatePriceByService = (serviceName) => {
    const proc = state.procedures.find((p) => p.nome === serviceName);
    if (proc) {
      const input = document.querySelector('input[name="value"]');
      if (input) input.value = proc.preco;
    }
  };
};
