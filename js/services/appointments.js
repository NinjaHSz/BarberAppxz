import { state } from "../core/state.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../core/config.js";
import { syncFromSheet } from "../api/sync.js";
import { getClientPlanUsage } from "./clients.js";
import { navigate } from "../ui/navigation.js";

export const saveNewRecord = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const btn = e.target.querySelector('button[type="submit"]');
  const isEditing = !!(state.editingRecord && state.editingRecord.id);

  const recordData = {
    data: formData.get("date"),
    horario: formData.get("time"),
    cliente: formData.get("client"),
    procedimento: formData.get("service"),
    valor: parseFloat(formData.get("value")) || 0,
    forma_pagamento: formData.get("payment"),
    observacoes: formData.get("observations"),
  };

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  try {
    const url = isEditing
      ? `${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${state.editingRecord.id}`
      : `${SUPABASE_URL}/rest/v1/agendamentos`;
    const res = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(recordData),
    });

    if (res.ok) {
      alert("✅ Sucesso!");
      state.editingRecord = null;
      state.isEditModalOpen = false;
      if (state.currentPage === "manage") navigate("records");
      else if (window.render) window.render();
      syncFromSheet(state.sheetUrl);
    } else {
      const err = await res.json();
      alert(`Erro: ${err.message}`);
    }
  } catch (err) {
    alert("Erro de conexão.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = isEditing ? "Salvar Alterações" : "Salvar Agendamento";
  }
};

export const saveInlineEdit = async (el) => {
  const id = el.dataset.id;
  const uiId = el.dataset.uiId;
  const field = el.dataset.field;
  let value = (
    el.tagName === "SELECT" || el.tagName === "INPUT" ? el.value : el.innerText
  ).trim();
  const time = el.dataset.time;
  const date = el.dataset.date;

  if (id === "new" && (field === "time" || field === "date")) {
    document.querySelectorAll(`[data-ui-id="${uiId}"]`).forEach((sibling) => {
      if (field === "time") sibling.dataset.time = value;
      if (field === "date") sibling.dataset.date = value;
    });
  }

  const fieldMap = {
    client: "cliente",
    service: "procedimento",
    value: "valor",
    payment: "forma_pagamento",
    time: "horario",
    date: "data",
    observations: "observacoes",
  };

  const dbField = fieldMap[field];
  if (!dbField) return;

  let finalValue = value;
  if (field === "value")
    finalValue =
      parseFloat(value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

  const planUsage = field === "client" ? getClientPlanUsage(value) : null;
  if (planUsage && planUsage.isWithinLimit) {
    const serviceEl = document.querySelector(
      `[data-ui-id="${uiId}"][data-field="service"]`,
    );
    const valueEl = document.querySelector(
      `[data-ui-id="${uiId}"][data-field="value"]`,
    );
    const paymentEl = document.querySelector(
      `[data-ui-id="${uiId}"][data-field="payment"]`,
    );
    if (serviceEl) serviceEl.innerText = `${planUsage.nextVisit}º DIA`;
    if (valueEl) valueEl.innerText = "0.00";
    if (paymentEl) {
      const client = state.clients.find(
        (c) => c.nome.toLowerCase() === value.toLowerCase(),
      );
      let planPayment = "PLANO MENSAL";
      if (client?.plano === "Semestral") planPayment = "PLANO SEMESTRAL";
      if (client?.plano === "Anual") planPayment = "PLANO ANUAL";
      paymentEl.value = planPayment;
    }
  }

  if (el.dataset.isSaving === "true") return;

  try {
    if (id === "new") {
      if (field === "client" && value !== "" && value !== "---") {
        el.dataset.isSaving = "true";
        const serviceVal =
          document
            .querySelector(`[data-ui-id="${uiId}"][data-field="service"]`)
            ?.innerText.trim() || "A DEFINIR";
        const priceVal =
          parseFloat(
            document
              .querySelector(`[data-ui-id="${uiId}"][data-field="value"]`)
              ?.innerText.trim(),
          ) || 0;
        const paymentVal =
          document.querySelector(`[data-ui-id="${uiId}"][data-field="payment"]`)
            ?.value || "PIX";
        const obsVal = document
          .querySelector(`[data-ui-id="${uiId}"][data-field="observations"]`)
          ?.innerText.trim();
        const recordData = {
          data: date,
          horario: time,
          cliente: value,
          procedimento: serviceVal,
          valor: priceVal,
          forma_pagamento: paymentVal,
          observacoes: obsVal === "Nenhuma obs..." ? "" : obsVal || "",
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/agendamentos`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(recordData),
        });
        if (res.ok) {
          const savedData = await res.json();
          if (savedData && savedData[0]) {
            const newId = savedData[0].id;
            document.querySelectorAll(`[data-ui-id="${uiId}"]`).forEach((s) => {
              s.dataset.id = newId;
            });
            if (/RENOVA[CÇ][AÃ]O/i.test(serviceVal)) {
              const client = state.clients.find(
                (c) => c.nome.toLowerCase() === value.toLowerCase(),
              );
              if (client && window.updateClientPlan)
                window.updateClientPlan(
                  client.id,
                  { plano_pagamento: date },
                  true,
                );
            }
            syncFromSheet(state.sheetUrl);
          }
        }
        delete el.dataset.isSaving;
      }
    } else {
      let recordData = { [dbField]: finalValue };
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
            recordData.forma_pagamento = "PIX";
            recordData.valor = parseFloat(client.valor_plano) || 0;
            const priceEl = document.querySelector(
              `[data-ui-id="${uiId}"][data-field="value"]`,
            );
            const payEl = document.querySelector(
              `[data-ui-id="${uiId}"][data-field="payment"]`,
            );
            if (priceEl)
              priceEl.innerText = parseFloat(client.valor_plano).toFixed(2);
            if (payEl) payEl.value = "PIX";
            if (window.updateClientPlan)
              window.updateClientPlan(
                client.id,
                { plano_pagamento: date },
                true,
              );
          }
        } else if (/\d+º\s*DIA/i.test(value)) {
          recordData.forma_pagamento = "PLANO MENSAL";
          recordData.valor = 0;
        }
      }
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(recordData),
        },
      );
      if (res.ok) {
        const rec = state.records.find((r) => String(r.id) === String(id));
        if (rec) {
          if (field === "payment") rec.paymentMethod = finalValue;
          else if (field === "value") rec.value = finalValue;
          else rec[field] = finalValue;
        }
        // Background sync without full re-render to avoid flickering for the user
        // We only full-sync if it was a 'new' record that now has a real ID
        if (id !== "new") {
          // Skip full render here, the DOM is already updated by the user's input
          // We'll just do a background sync to keep state consistent without blowing away the UI
          syncFromSheet(state.sheetUrl, true);
        } else {
          syncFromSheet(state.sheetUrl);
        }
      }
    }
  } catch (err) {
    console.error("Erro no salvamento inline:", err);
  }
};

export const cancelAppointment = async (id) => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${id}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
        },
      },
    );
    if (res.ok) syncFromSheet(state.sheetUrl);
    else alert("Erro ao cancelar.");
  } catch (err) {
    alert("Erro de conexão.");
  }
};

window.saveNewRecord = saveNewRecord;
window.saveInlineEdit = saveInlineEdit;
window.cancelAppointment = cancelAppointment;
