// @ts-check
/**
 * features/modal.js — tiny shared modal helper (plain custom modal, not Bootstrap's data-api) for
 * the handful of features that need more than prompt()/confirm() (answer editor, bulk panels'
 * result summaries, move form... move form actually renders inline, not in a modal — see
 * moveForm.js). Kept as a small imperative utility alongside toast.js, outside render/* since it's
 * not part of the tree's keyed reconciliation.
 */

/**
 * @param {{title: string, bodyEl: HTMLElement, onSave?: () => void, saveLabel?: string}} config
 * @returns {{close: () => void}}
 */
export function openModal(config) {
  const host = document.getElementById("modalHost");
  if (!host) throw new Error("modalHost not found");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop-custom";

  const box = document.createElement("div");
  box.className = "modal-box";

  const header = document.createElement("div");
  header.className = "modal-box-header";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "0.5rem";
  const titleEl = document.createElement("h5");
  titleEl.textContent = config.title;
  titleEl.style.margin = "0";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn-close";
  closeBtn.setAttribute("aria-label", "Close");
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  box.appendChild(header);
  box.appendChild(config.bodyEl);

  if (config.onSave) {
    const footer = document.createElement("div");
    footer.style.marginTop = "0.75rem";
    footer.style.display = "flex";
    footer.style.gap = "0.4rem";
    footer.style.justifyContent = "flex-end";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-primary btn-sm";
    saveBtn.textContent = config.saveLabel || "Save";
    saveBtn.addEventListener("click", () => {
      if (config.onSave) config.onSave();
      close();
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary btn-sm";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => close());
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    box.appendChild(footer);
  }

  backdrop.appendChild(box);
  host.appendChild(backdrop);

  function close() {
    document.removeEventListener("keydown", handleKeydown);
    backdrop.remove();
  }
  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", handleKeydown);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  return { close };
}
