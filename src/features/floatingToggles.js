// @ts-check
/**
 * features/floatingToggles.js — Floating Toggle Group: compact cluster (Close All / Undo / Redo /
 * Edit Mode). Expands on hover on desktop (pure CSS, gated to hover-capable pointers — see
 * `@media (hover: hover) and (pointer: fine)` in style.css); on touch, tapping the main button
 * expands/collapses it, tapping outside the group closes it, and tapping any item inside also
 * closes it (mirrors the outside-click-closes pattern used by questionView.js's dropdown panels —
 * without it, `:hover`'s emulated touch behavior and this module's `.expanded` class toggle fought
 * each other, making taps unreliable and leaving the menu open after using an item).
 */
export function initFloatingToggles() {
  const mainBtn = document.getElementById("floatingMainBtn");
  const group = document.getElementById("floatingToggleGroup");
  const items = document.querySelector("#floatingToggleGroup .floating-toggle-items");
  if (!mainBtn || !group) return;

  const closeGroup = () => {
    group.classList.remove("expanded");
    document.removeEventListener("click", onDocClick);
  };
  const onDocClick = (e) => {
    if (!group.contains(/** @type {Node} */ (e.target))) closeGroup();
  };

  mainBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = !group.classList.contains("expanded");
    group.classList.toggle("expanded", opening);
    if (opening) document.addEventListener("click", onDocClick);
    else document.removeEventListener("click", onDocClick);
  });

  if (items) items.addEventListener("click", closeGroup);
}
