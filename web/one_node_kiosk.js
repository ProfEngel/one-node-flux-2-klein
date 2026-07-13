import { app } from "../../scripts/app.js";

const KIOSK_MODE = new URLSearchParams(window.location.search).get("one-node") === "1";
const NODE_W = 980;
const NODE_H = Math.round(NODE_W * 9 / 16);

function installKioskStyles() {
  if (document.getElementById("fk-kiosk-bootstrap-style")) return;
  const style = document.createElement("style");
  style.id = "fk-kiosk-bootstrap-style";
  style.textContent = `
    #fk-kiosk-bootstrap-backdrop {
      position: fixed; inset: 0; z-index: 99980; background: #060608;
    }
    body.fk-kiosk-bootstrap #graph-canvas-container .isolate:has(.fk-root) {
      position: fixed !important; inset: 0 !important; z-index: 99991 !important;
      pointer-events: none !important;
    }
    body.fk-kiosk-bootstrap #graph-canvas-container .isolate:has(.fk-root)
      .dom-widget:not(:has(.fk-root)) {
      display: none !important;
    }
    body.fk-kiosk-bootstrap .dom-widget:has(.fk-root) {
      position: fixed !important; left: 50% !important; top: 50% !important;
      display: block !important;
      width: ${NODE_W}px !important; height: ${NODE_H}px !important;
      transform: translate(-50%, -50%) scale(var(--fk-kiosk-scale, 1)) !important;
      transform-origin: center center !important; z-index: 99991 !important;
      pointer-events: auto !important; opacity: 1 !important;
      clip-path: none !important; will-change: auto !important;
    }
    body.fk-kiosk-bootstrap .dom-widget:has(.fk-root) .fk-root {
      width: ${NODE_W}px !important; height: ${NODE_H}px !important;
      position: relative !important; inset: auto !important; margin: 0 !important;
      transform: none !important; transform-origin: center center !important;
      border-radius: 0 !important; overflow: hidden !important;
    }
  `;
  document.head.appendChild(style);
}

function activateKiosk() {
  const root = document.querySelector(".fk-root");
  if (!root) return false;

  // Remove an empty legacy OneNode fullscreen overlay that an older cached version
  // may have created before the Nodes 2.0 portal became available.
  for (const child of [...document.body.children]) {
    const style = getComputedStyle(child);
    if (style.position === "fixed" && style.zIndex === "99990" &&
        style.backgroundColor === "rgba(6, 6, 8, 0.97)" &&
        !child.querySelector(".fk-root")) {
      child.remove();
    }
  }

  // Nodes 2.0 renders DOM widgets in a direct body portal. Classic LiteGraph is
  // handled by OneNode's existing fullscreen function.
  if (!root.parentElement?.classList.contains("dom-widget")) {
    const fullscreen = root.querySelector('button[title="Fullscreen"]');
    fullscreen?.click();
    return Boolean(fullscreen);
  }

  installKioskStyles();
  if (!document.getElementById("fk-kiosk-bootstrap-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.id = "fk-kiosk-bootstrap-backdrop";
    document.body.appendChild(backdrop);
  }
  const updateScale = () => {
    const scale = Math.min(window.innerWidth / NODE_W, window.innerHeight / NODE_H) * 0.97;
    document.body.style.setProperty("--fk-kiosk-scale", String(scale));
  };
  updateScale();
  window.addEventListener("resize", updateScale, { passive: true });
  document.body.classList.add("fk-kiosk-bootstrap");
  requestAnimationFrame(() => {
    window.parent.postMessage({ type: "flux-klein-kiosk-ready" }, window.location.origin);
  });
  return true;
}

app.registerExtension({
  name: "FluxKleinPlayground.Kiosk",
  async setup() {
    if (!KIOSK_MODE) return;

    const ensure = () => {
      try {
        if (activateKiosk()) return true;
        const graph = app.canvas?.graph;
        if (!graph || typeof LiteGraph === "undefined") return false;
        const existing = (graph._nodes || []).some(node => node.type === "FluxKleinOneNode");
        if (!existing) {
          const node = LiteGraph.createNode("FluxKleinOneNode");
          if (node) {
            node.pos = [80, 80];
            graph.add(node);
          }
        }
      } catch (error) {
        console.warn("[FluxKlein] kiosk bootstrap:", error);
      }
      return false;
    };

    if (ensure()) return;
    const timer = setInterval(() => {
      if (ensure()) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 30000);
  },
});
