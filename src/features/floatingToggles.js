// @ts-check
/**
 * features/floatingToggles.js — Floating Toggle Group: compact cluster (Close All / Undo / Redo /
 * Edit Mode). Expands on hover on desktop (pure CSS, see :hover in style.css); on mobile (no
 * hover) tapping the main button expands/collapses it — that tap behavior is the only thing this
 * module wires.
 */
export function initFloatingToggles() {
  const mainBtn = document.getElementById("floatingMainBtn");
  const group = document.getElementById("floatingToggleGroup");
  if (!mainBtn || !group) return;
  mainBtn.addEventListener("click", () => {
    group.classList.toggle("expanded");
  });
}
