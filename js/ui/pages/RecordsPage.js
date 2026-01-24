import { state } from "../../core/state.js";
import { RecordRow } from "../components/RecordRow.js";
import { navigate } from "../navigation.js";

export const RecordsPage = () => {
  if (!state.isIntegrated) {
    return `
            <div class="p-8 h-full flex items-center justify-center">
                <div class="text-center space-y-4">
                    <i class="fas fa-table text-6xl text-white/5 mb-4"></i>
                    <h2 class="text-2xl font-bold">Sem dados sincronizados</h2>
                    <button onclick="navigate('setup')" class="bg-amber-500 text-dark-950 px-6 py-2 rounded-xl font-bold border border-transparent transition-all">Conectar Planilha</button>
                </div>
            </div>
        `;
  }

  const targetDay = parseInt(state.filters.day);
  const targetMonth = String(state.filters.month).padStart(2, "0");
  const targetYear = String(state.filters.year);
  const monthPrefix = `${targetYear}-${targetMonth}`;
  const dayPrefix = `${monthPrefix}-${String(targetDay).padStart(2, "0")}`;

  let recordsToDisplay = [];

  if (targetDay === 0) {
    recordsToDisplay = state.records
      .filter((r) => r.date.startsWith(monthPrefix))
      .filter(
        (r) =>
          (r.client || "")
            .toLowerCase()
            .includes(state.searchTerm.toLowerCase()) ||
          (r.service || "")
            .toLowerCase()
            .includes(state.searchTerm.toLowerCase()),
      );
  } else {
    const existingForDay = state.records.filter((r) => r.date === dayPrefix);

    if (state.searchTerm) {
      recordsToDisplay = existingForDay.filter(
        (r) =>
          (r.client || "")
            .toLowerCase()
            .includes(state.searchTerm.toLowerCase()) ||
          (r.service || "")
            .toLowerCase()
            .includes(state.searchTerm.toLowerCase()),
      );
    } else {
      const realAppointments = existingForDay.sort((a, b) =>
        a.time.localeCompare(b.time),
      );
      const dayStartMin = 7 * 60 + 20; // 07:20
      const dayEndMin = 22 * 60; // 22:00

      const toMin = (t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      const fromMin = (m) => {
        const h = Math.floor(m / 60);
        const min = m % 60;
        return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      };

      const records = [];
      const unhandledReals = [...realAppointments];
      let currentMin = dayStartMin;

      while (currentMin <= dayEndMin) {
        const nextReal = unhandledReals[0];
        const nextRealMin = nextReal ? toMin(nextReal.time) : null;

        if (nextRealMin !== null && nextRealMin <= currentMin + 20) {
          records.push(nextReal);
          unhandledReals.shift();
          currentMin = nextRealMin + 40;
        } else {
          records.push({
            time: fromMin(currentMin),
            client: "---",
            service: "A DEFINIR",
            value: 0,
            paymentMethod: "PIX",
            isEmpty: true,
            date: dayPrefix,
          });
          currentMin += 40;
        }
        if (records.length > 60) break;
      }
      unhandledReals.forEach((r) => records.push(r));
      recordsToDisplay = records.sort((a, b) => a.time.localeCompare(b.time));

      if (!state.showEmptySlots) {
        recordsToDisplay = recordsToDisplay.filter((r) => !r.isEmpty);
      }
    }
  }

  return `
        <div class="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 sm:space-y-8">
             <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 class="text-2xl sm:text-3xl font-display font-bold">Histórico</h2>
                    <p class="text-slate-500 text-xs sm:text-sm mt-1">Sincronização Ativa</p>
                </div>
                <div class="relative w-full sm:w-auto flex flex-col sm:flex-row gap-2 items-center">
                    <button onclick="navigate('manage')" 
                            class="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 text-dark-950 hover:bg-amber-400 hover:scale-110 transition-all shadow-lg shadow-amber-500/50 shrink-0 border border-amber-400"
                            title="Novo Agendamento">
                        <i class="fas fa-plus text-lg"></i>
                    </button>
                    <button onclick="window.toggleEmptySlots()" 
                            class="flex items-center justify-center w-10 h-10 rounded-xl border border-white/5 bg-dark-900/50 hover:bg-white/10 transition-all shrink-0 ${
                              state.showEmptySlots
                                ? "text-amber-500 border-amber-500/30"
                                : "text-slate-500 hover:text-white"
                            }"
                            title="${
                              state.showEmptySlots
                                ? "Ocultar Vazios"
                                : "Mostrar Vazios"
                            }">
                        <i class="fas ${
                          state.showEmptySlots ? "fa-eye-slash" : "fa-eye"
                        }"></i>
                    </button>
                    <div class="relative flex-1 sm:w-80">
                        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                        <input type="text" 
                               id="recordsSearchInput"
                               placeholder="Buscar agendamento..." 
                               oninput="window.handleSearch(this)"
                               value="${state.searchTerm}"
                               class="bg-dark-900 border border-white/5 py-2.5 pl-11 pr-4 rounded-xl text-sm outline-none focus:border-amber-500/50 w-full transition-all font-medium">
                    </div>
                </div>
            </div>

            <div class="space-y-4 md:space-y-0 md:bg-dark-900/30 md:rounded-[2rem] border border-white/5">
                <div class="hidden md:grid md:grid-cols-[70px_1.5fr_1.2fr_1fr_100px_130px_100px] gap-4 bg-white/[0.02] border-b border-white/5 px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest items-center">
                    <div class="text-left">Horário</div>
                    <div class="text-left">Cliente</div>
                    <div class="text-left">Procedimentos</div>
                    <div class="text-left">Observações</div>
                    <div class="text-left">Valor</div>
                    <div class="text-left">Pagamento</div>
                    <div class="text-right pr-4">Ações</div>
                </div>

                <div id="tableBody" class="divide-y divide-white/5">
                    ${recordsToDisplay.map((r) => RecordRow(r)).join("")}
                </div>
            </div>
        </div>
    `;
};
