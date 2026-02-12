import { state } from "../core/state.js";
import { Sidebar } from "./components/Sidebar.js";
import { Header } from "./components/Header.js";
import { MobileNav } from "./components/MobileNav.js";
import { EditModal } from "./modals/EditModal.js";
import { pages } from "./pages/index.js";

export function render() {
  const app = document.getElementById("app");
  if (!app) return;

  const activeEl = document.activeElement;
  const activeId = activeEl ? activeEl.id : null;
  const isEditing =
    activeEl &&
    (activeEl.isContentEditable ||
      activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA");

  // Save current scroll and selection
  const mainEl = document.getElementById("mainContent");
  const scrollPos = mainEl ? mainEl.scrollTop : 0;

  let selection = null;
  let activeValue = null;

  if (activeEl && isEditing) {
    activeValue = activeEl.isContentEditable
      ? activeEl.innerText
      : activeEl.value;
    if (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") {
      selection = {
        start: activeEl.selectionStart,
        end: activeEl.selectionEnd,
        type: "input",
      };
    } else {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        selection = {
          start: range.startOffset,
          end: range.endOffset,
          type: "contenteditable",
        };
      }
    }
  }

  const contentFn = pages[state.currentPage] || (() => "404");
  const content = contentFn();

  // Smart Render: Only replace high-level shell if needed
  const shellExists = app.querySelector("#mainContent");
  if (!shellExists) {
    app.innerHTML = `
        <div class="flex h-full w-full bg-pattern text-text-primary">
            ${Sidebar()}
            <div class="flex-1 flex flex-col min-w-0 h-full relative">
                ${Header()}
                <main id="mainContent" class="flex-1 overflow-y-auto custom-scroll pb-24 md:pb-0">
                    ${content}
                </main>
                ${MobileNav()}
            </div>
            ${state.isEditModalOpen ? EditModal() : ""}
        </div>
    `;
  } else {
    // Update main content
    const mainContent = document.getElementById("mainContent");
    if (mainContent) {
      // Optimization: If we are typing in a record row, we might want to skip full mainContent blast
      // but for now, let's just do a controlled update.
      mainContent.innerHTML = content;
    }

    // Update Header if exists (it contains filters that can change)
    const header = app.querySelector("header");
    if (header) {
      const headerPlaceholder = document.createElement("div");
      headerPlaceholder.innerHTML = Header();
      header.replaceWith(headerPlaceholder.firstElementChild);
    }

    // Modal check
    const modalContainer = app.querySelector(".modal-container"); // Assuming EditModal has a predictable wrapper
    if (state.isEditModalOpen) {
      if (!modalContainer) {
        const div = document.createElement("div");
        div.innerHTML = EditModal();
        app
          .querySelector(".flex.h-full.w-full")
          .appendChild(div.firstElementChild);
      }
    } else {
      const existingModal = app.querySelector(".modal-container");
      if (existingModal) existingModal.remove();
    }
  }

  // Restore Scroll
  const newMain = document.getElementById("mainContent");
  if (newMain) newMain.scrollTop = scrollPos;

  // Restore Focus and Selection
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) {
      el.focus();

      // Only restore value and selection if it hasn't been updated by state change
      // or if it's the SAME value we were typing (to prevent clearing on sync)
      if (selection) {
        if (
          selection.type === "input" &&
          (el.tagName === "INPUT" || el.tagName === "TEXTAREA")
        ) {
          el.setSelectionRange(selection.start, selection.end);
        } else if (selection.type === "contenteditable") {
          try {
            const range = document.createRange();
            const sel = window.getSelection();
            if (el.firstChild) {
              const textNode = el.firstChild;
              const len = textNode.textContent.length;
              range.setStart(textNode, Math.min(selection.start, len));
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } catch (e) {
            console.warn("Cursor restoration failed", e);
          }
        }
      }
    }
  }
}

window.render = render;
