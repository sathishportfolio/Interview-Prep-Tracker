// @ts-check
/**
 * features/closeAll.js — Close All Accordions floating button.
 */
import { closeAllNodes } from "../state/appState.js";
import { repaint } from "./refresh.js";

export function closeAllAccordions() {
  closeAllNodes();
  repaint();
}
