import { state } from "../core/state.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../core/config.js";
import { fetchClients, fetchProcedures } from "./supabase.js";

export async function syncFromSheet(url, silent = false) {
  if (!url) return false;

  try {
    state.syncStatus = "syncing";
    const recordMap = new Map();

    if (url.includes("supabase.co")) {
      console.log("Iniciando Sincronização via Supabase...");
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/agendamentos?select=*&order=data.desc,horario.desc`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: "Bearer " + SUPABASE_KEY,
              Range: "0-5000",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          console.log(
            `[Sync] Recebidos ${data.length} registros via Supabase.`,
          );

          data.forEach((r) => {
            const key = r.id;
            recordMap.set(key, {
              id: r.id,
              date: r.data,
              time: r.horario,
              client: r.cliente,
              service: r.procedimento || "A DEFINIR",
              value: parseFloat(r.valor) || 0,
              paymentMethod: r.forma_pagamento || "N/A",
              observations: r.observacoes || "",
            });
          });
        }
      } catch (err) {
        console.error("[Sync] Supabase erro:", err);
      }
    } else if (url.includes("/macros/s/")) {
      console.log("Iniciando Sincronização via Script Pro...");
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`[Sync] Falha no Script: Status ${res.status}`);
          return false;
        }
        const data = await res.json();

        if (!Array.isArray(data)) {
          if (data.erro) {
            console.error("[Sync] Erro do Script:", data.erro);
            if (window.showAlert) {
              window.showAlert(
                `Atenção: ${data.erro}. O robô não encontrou dados formatados na sua planilha.`,
                "error",
              );
            } else {
              console.warn(
                `Atenção: ${data.erro}. O robô não encontrou dados formatados na sua planilha.`,
              );
            }
          }
          return false;
        }

        console.log(`[Sync] Recebidos ${data.length} registros via Script.`);
        data.forEach((r) => {
          if (!r.client || r.client.toLowerCase() === "cliente") return;
          const rawVal = String(r.value || "0")
            .replace(/[^\d,.-]/g, "")
            .replace(",", ".");
          const cleanVal = parseFloat(rawVal);
          const key =
            `${r.date}_${r.time}_${r.client}_${r.service}`.toLowerCase();
          recordMap.set(key, {
            date: r.date,
            time: r.time,
            client: r.client,
            service: r.service || "A DEFINIR",
            value: isNaN(cleanVal) ? 0 : cleanVal,
            paymentMethod: r.paymentMethod || "N/A",
          });
        });
      } catch (fetchErr) {
        console.error("[Sync] Erro ao buscar dados do Script:", fetchErr);
        return false;
      }
    } else {
      // Fallback CSV Logic (Truncated for brevity in thought, but I'll write the full version)
      const idMatch = url.match(/[-\w]{25,}/);
      if (!idMatch) return false;
      const spreadsheetId = idMatch[0];
      const months = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ];
      const processedHashes = new Set();

      const processSheetText = (text, monthIdx) => {
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
        if (lines.length < 2) return;
        let sep = ",";
        for (let i = 0; i < Math.min(lines.length, 100); i++) {
          const l = lines[i].toLowerCase();
          if (l.includes("cliente") || l.includes("horário")) {
            sep = l.split(";").length > l.split(",").length ? ";" : ",";
            break;
          }
        }
        const parseCSVRow = (line, separator) => {
          const parts = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
              parts.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          parts.push(current.trim());
          return parts;
        };
        let mapping = null;
        let currentDay = 1;
        lines.forEach((line) => {
          const cols = parseCSVRow(line, sep);
          if (cols.length === 0) return;
          const lineStr = line.replace(/[";]/g, " ").trim();
          const lineLower = lineStr.toLowerCase();
          const dMatch = lineStr.match(/Dia\s*(\d+)/i);
          if (dMatch && !lineStr.includes(":") && lineStr.length < 30) {
            currentDay = parseInt(dMatch[1]);
            mapping = null;
            return;
          }
          if (lineLower.includes("horário") || lineLower.includes("cliente")) {
            mapping = {};
            cols.forEach((name, i) => {
              const n = name.toLowerCase();
              if (n.includes("horário")) mapping.time = i;
              if (n.includes("cliente")) mapping.client = i;
              if (n.includes("procedimento")) mapping.service = i;
              if (n.includes("valor")) mapping.value = i;
              if (n.includes("pagamento")) mapping.method = i;
              if (n.includes("observ") || n.includes("anot")) mapping.obs = i;
            });
            return;
          }
          if (
            mapping &&
            cols[mapping.client] &&
            !lineLower.includes("cliente") &&
            !lineLower.includes("total")
          ) {
            let valStr = String(cols[mapping.value] || "0").trim();
            let rawVal = valStr.replace(/[^\d,.-]/g, "");
            let cleanVal = 0;
            if (rawVal) {
              if (rawVal.includes(",") && rawVal.includes("."))
                cleanVal = parseFloat(
                  rawVal.replace(/\./g, "").replace(",", "."),
                );
              else if (rawVal.includes(","))
                cleanVal = parseFloat(rawVal.replace(",", "."));
              else cleanVal = parseFloat(rawVal);
            }
            const dateStr = `${state.filters.year}-${String(monthIdx + 1).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;
            const timeStr = (cols[mapping.time] || "00:00").substring(0, 5);
            const clientName = cols[mapping.client];
            const serviceName = cols[mapping.service] || "A DEFINIR";
            if (clientName && clientName.length > 1) {
              const key =
                `${dateStr}_${timeStr}_${clientName}_${serviceName}`.toLowerCase();
              if (!recordMap.has(key)) {
                recordMap.set(key, {
                  date: dateStr,
                  time: timeStr,
                  client: clientName,
                  service: serviceName,
                  value: isNaN(cleanVal) ? 0 : cleanVal,
                  paymentMethod: cols[mapping.method] || "N/A",
                  observations:
                    mapping.obs !== undefined ? cols[mapping.obs] : "",
                });
              }
            }
          }
        });
      };

      const mainRes = await fetch(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`,
      );
      const mainText = mainRes.ok ? await mainRes.text() : "";
      const mainHash = mainText.trim().substring(0, 500);

      for (let i = 0; i < months.length; i++) {
        const name = months[i];
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
        try {
          const res = await fetch(gvizUrl);
          if (res.ok) {
            const text = await res.text();
            const hash = text.trim().substring(0, 500);
            if (hash === mainHash && i !== 0 && mainHash !== "") continue;
            if (!processedHashes.has(hash)) {
              processSheetText(text, i);
              processedHashes.add(hash);
            }
          }
        } catch (e) {}
      }
      if (recordMap.size === 0 && mainText)
        processSheetText(mainText, new Date().getMonth());
    }

    state.records = Array.from(recordMap.values()).sort(
      (a, b) =>
        new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time),
    );
    state.isIntegrated = true;
    state.sheetUrl = url;
    localStorage.setItem("sheetUrl", url);
    localStorage.setItem("isIntegrated", "true");
    localStorage.setItem("records", JSON.stringify(state.records));

    if (window.updateInternalStats) window.updateInternalStats();
    state.syncStatus = "idle";
    if (window.render && !silent) window.render();
    return true;
  } catch (err) {
    console.error("Erro crítico no Sync:", err);
    state.syncStatus = "error";
    return false;
  }
}

window.syncFromSheet = syncFromSheet;
