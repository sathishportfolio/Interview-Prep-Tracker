// @ts-check
/**
 * features/keyboardShortcutsHelp.js — read-only reference for features/reviewShortcuts.js's
 * shortcuts, shown in a modal opened from the floating toggle group's "?" button (or the "?" key
 * itself). Kept as plain static content, not wired to any state.
 */
import { openModal } from "./modal.js";

const SHORTCUTS = [
  ["Up / Down", "Move the Active Question to the previous/next question"],
  ["d", "Mark the Active Question Done"],
  ["r", "Flag the Active Question Review Later"],
  ["s or *", "Flag the Active Question Starred"],
  ["Ctrl/Cmd + Up / Down", "Move the Active Question to the top/bottom of its SubTopic"],
  ["Enter", "Expand/collapse the Active Question's answer"],
  ["Ctrl/Cmd + Enter", "Google-search the Active Question"],
  ["Ctrl/Cmd + C", "Copy the Active Question's text (when nothing else is selected)"],
  ["?", "Show this list"],
];

export function openShortcutsHelp() {
  const wrap = document.createElement("div");
  const note = document.createElement("p");
  note.className = "text-muted";
  note.style.marginBottom = "0.75rem";
  note.textContent = "These apply to the current Active Question (flag icon) and are ignored while typing in a text field.";
  wrap.appendChild(note);

  const table = document.createElement("table");
  table.className = "table table-sm";
  const tbody = document.createElement("tbody");
  for (const [keys, desc] of SHORTCUTS) {
    const tr = document.createElement("tr");
    const keyCell = document.createElement("td");
    keyCell.style.whiteSpace = "nowrap";
    const kbd = document.createElement("kbd");
    kbd.textContent = keys;
    keyCell.appendChild(kbd);
    const descCell = document.createElement("td");
    descCell.textContent = desc;
    tr.appendChild(keyCell);
    tr.appendChild(descCell);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  openModal({ title: "Keyboard Shortcuts", bodyEl: wrap });
}
