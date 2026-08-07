// @ts-check
/**
 * multiselect/multiSelect.js — dependency-free multi-select component (replaces jQuery+Select2).
 * Supports: multiple selection, placeholder, clearing, searchable/filterable option list.
 * DOM-only UI component; owns its own small piece of the tree but exposes a plain callback API so
 * features/filters.js (its only consumer) never needs to touch its internal DOM structure.
 */

/**
 * @param {HTMLElement} mount
 * @param {{placeholder?: string, onChange: (selected: string[]) => void}} config
 * @returns {{setOptions: (options: string[]) => void, setSelected: (selected: string[]) => void, getSelected: () => string[], clear: () => void}}
 */
export function createMultiSelect(mount, config) {
  mount.textContent = "";
  mount.className = "multiselect";

  /** @type {string[]} */
  let options = [];
  /** @type {Set<string>} */
  let selected = new Set();
  let filterText = "";
  let dropdownOpen = false;

  const control = document.createElement("div");
  control.className = "multiselect-control";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "multiselect-input";
  input.placeholder = config.placeholder || "";

  const dropdown = document.createElement("div");
  dropdown.className = "multiselect-dropdown";
  dropdown.hidden = true;

  control.appendChild(input);
  mount.appendChild(control);
  mount.appendChild(dropdown);

  function renderTags() {
    control.querySelectorAll(".multiselect-tag").forEach((t) => t.remove());
    for (const val of selected) {
      const tag = document.createElement("span");
      tag.className = "multiselect-tag";
      const label = document.createElement("span");
      label.textContent = val;
      const rm = document.createElement("span");
      rm.className = "rm";
      rm.textContent = "×";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        selected.delete(val);
        renderTags();
        config.onChange([...selected]);
      });
      tag.appendChild(label);
      tag.appendChild(rm);
      control.insertBefore(tag, input);
    }
  }

  function renderDropdown() {
    dropdown.textContent = "";
    const filtered = options.filter((o) => o.toLowerCase().includes(filterText.toLowerCase()));
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "multiselect-option";
      empty.textContent = "No options";
      dropdown.appendChild(empty);
      return;
    }
    for (const opt of filtered) {
      const optEl = document.createElement("div");
      optEl.className = "multiselect-option" + (selected.has(opt) ? " selected" : "");
      optEl.textContent = opt;
      optEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (selected.has(opt)) selected.delete(opt);
        else selected.add(opt);
        renderTags();
        renderDropdown();
        config.onChange([...selected]);
      });
      dropdown.appendChild(optEl);
    }
  }

  input.addEventListener("focus", () => {
    dropdownOpen = true;
    dropdown.hidden = false;
    renderDropdown();
  });
  input.addEventListener("input", () => {
    filterText = input.value;
    renderDropdown();
  });
  document.addEventListener("click", (e) => {
    if (!mount.contains(/** @type {Node} */ (e.target))) {
      dropdownOpen = false;
      dropdown.hidden = true;
      filterText = "";
      input.value = "";
    }
  });

  return {
    setOptions(newOptions) {
      options = newOptions;
      if (dropdownOpen) renderDropdown();
    },
    setSelected(newSelected) {
      selected = new Set(newSelected);
      renderTags();
    },
    getSelected() {
      return [...selected];
    },
    clear() {
      selected = new Set();
      renderTags();
      config.onChange([]);
    },
  };
}
