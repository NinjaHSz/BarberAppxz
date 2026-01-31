import { state } from "./core/state.js";
import { applyTheme } from "./ui/theme.js";
import {
  fetchClients,
  fetchProcedures,
  fetchAllPlanPayments,
  fetchExpenses,
  fetchCards,
} from "./api/supabase.js";
import { syncFromSheet } from "./api/sync.js";
import { render } from "./ui/render.js";
import { setupGlobalHandlers } from "./ui/handlers.js";
import { syncFromHash } from "./ui/navigation.js";
import "./utils/dom.js"; // Registers selectAll globally

// Run initialization directly since script is a module (deferred by default)
setupGlobalHandlers();
applyTheme();

// Sync state with URL Hash
syncFromHash();

// Background data fetch
(async () => {
  try {
    await Promise.all([
      fetchClients(),
      fetchProcedures(),
      fetchAllPlanPayments(),
      fetchExpenses(),
      fetchCards(),
    ]);

    if (state.sheetUrl) {
      syncFromSheet(state.sheetUrl);
    }
  } catch (err) {
    console.error("Erro na inicialização de dados:", err);
  } finally {
    state.isLoading = false;
    render();
  }
})();
