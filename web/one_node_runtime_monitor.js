const LIME = "#f0ff41";
const BORDER = "#303030";

const make = (tag, style = {}) => {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
};

const setText = (node, value) => { node.textContent = value; };
const clampPercent = value => Math.max(0, Math.min(100, Number(value) || 0));
const formatSeconds = seconds => {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.ceil(seconds % 60)}s`;
};

export function createRuntimeMonitor(api) {
  const root = make("div", {
    display: "flex", flexDirection: "column", gap: "5px", flexShrink: "0",
    padding: "7px 9px", background: "#101010", border: `1px solid ${BORDER}`,
    borderRadius: "6px", boxSizing: "border-box", minWidth: "0",
  });
  const headline = make("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "9px" });
  const stateLabel = make("span", { color: "#aaa", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
  const timeLabel = make("span", { color: "#777", marginLeft: "auto", whiteSpace: "nowrap" });
  const percentLabel = make("span", { color: LIME, fontWeight: "800", minWidth: "32px", textAlign: "right" });
  headline.append(stateLabel, timeLabel, percentLabel);

  const progressTrack = make("div", { height: "3px", borderRadius: "2px", background: "#292929", overflow: "hidden" });
  const progressFill = make("div", { width: "0%", height: "100%", background: LIME, transition: "width .25s ease" });
  progressTrack.append(progressFill);

  const metrics = make("div", { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "7px" });
  const metric = label => {
    const wrap = make("div", { minWidth: "0" });
    const row = make("div", { display: "flex", gap: "4px", justifyContent: "space-between", fontSize: "8px", color: "#777", marginBottom: "2px" });
    const name = make("span", { whiteSpace: "nowrap" });
    const value = make("span", { color: "#aaa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
    setText(name, label); setText(value, "--"); row.append(name, value);
    const track = make("div", { height: "3px", borderRadius: "2px", background: "#292929", overflow: "hidden" });
    const fill = make("div", { width: "0%", height: "100%", background: "#747474", transition: "width .35s ease" });
    track.append(fill); wrap.append(row, track); metrics.append(wrap);
    return { value, fill };
  };
  const gpuMetric = metric("GPU");
  const vramMetric = metric("VRAM");
  const tempMetric = metric("TEMP");
  root.append(headline, progressTrack, metrics);

  let active = false;
  let promptId = null;
  let startedAt = 0;
  let phaseStartedAt = 0;
  let percent = 0;
  let estimatedEndAt = 0;
  let etaTimer = null;

  const renderEta = () => {
    if (!active || percent <= 0 || percent >= 100) {
      setText(timeLabel, percent >= 100 ? "Remaining 0 s" : "Remaining --");
      return;
    }
    const remaining = estimatedEndAt > Date.now() ? (estimatedEndAt - Date.now()) / 1000 : 0;
    setText(timeLabel, estimatedEndAt ? `Remaining ~${formatSeconds(remaining)}` : "Remaining --");
  };
  const renderProgress = (next, label = "Generating") => {
    percent = clampPercent(next);
    progressFill.style.width = `${percent}%`;
    setText(percentLabel, `${Math.round(percent)}%`);
    setText(stateLabel, label);
    renderEta();
  };
  const matches = detail => !promptId || !detail?.prompt_id || detail.prompt_id === promptId;
  const prepare = (label = "Preparing") => {
    active = true; promptId = null; startedAt = Date.now(); phaseStartedAt = startedAt; estimatedEndAt = 0;
    renderProgress(0, label);
  };
  const begin = (id, label = "Generating") => {
    active = true; promptId = id || null; startedAt ||= Date.now(); phaseStartedAt = Date.now(); estimatedEndAt = 0;
    renderProgress(0, label);
  };
  const finish = (label = "Ready") => {
    if (!active) return;
    active = false; renderProgress(100, label);
    const elapsed = (Date.now() - startedAt) / 1000;
    setText(timeLabel, `${formatSeconds(elapsed)} total`);
  };
  const fail = (label = "Failed") => {
    active = false; setText(stateLabel, label); setText(timeLabel, "Remaining --");
    progressFill.style.background = "#ff6b6b";
  };
  const reset = () => {
    active = false; promptId = null; startedAt = 0; phaseStartedAt = 0; estimatedEndAt = 0;
    progressFill.style.background = LIME; renderProgress(0, "Ready");
  };

  const onProgress = event => {
    const detail = event.detail || event;
    if (!active || !matches(detail)) return;
    const max = Number(detail.max) || 0;
    if (max <= 0) return;
    const next = clampPercent(Number(detail.value) / max * 100);
    if (next < percent || next === 0) { phaseStartedAt = Date.now(); estimatedEndAt = 0; }
    const elapsed = Date.now() - phaseStartedAt;
    if (next > 0 && elapsed > 300) estimatedEndAt = Date.now() + elapsed * (100 - next) / next;
    renderProgress(next, detail.node ? "Generating" : "Working");
  };
  const onSuccess = event => { const detail = event.detail || event; if (active && matches(detail)) finish("Ready"); };
  const onError = event => { const detail = event.detail || event; if (active && matches(detail)) fail("Failed"); };
  const onCrystools = event => {
    const gpu = event?.detail?.gpus?.[0];
    if (!gpu) return;
    const utilization = clampPercent(gpu.gpu_utilization);
    const vram = clampPercent(gpu.vram_used_percent);
    const temp = Math.max(0, Number(gpu.gpu_temperature) || 0);
    setText(gpuMetric.value, `${Math.round(utilization)}%`); gpuMetric.fill.style.width = `${utilization}%`;
    const used = Number(gpu.vram_used); const total = Number(gpu.vram_total);
    const gib = value => value / (1024 ** 3);
    setText(vramMetric.value, Number.isFinite(used) && Number.isFinite(total) && total > 0 ? `${gib(used).toFixed(1)}/${gib(total).toFixed(1)} GB` : `${Math.round(vram)}%`);
    vramMetric.fill.style.width = `${vram}%`;
    setText(tempMetric.value, `${Math.round(temp)} C`); tempMetric.fill.style.width = `${clampPercent(temp)}%`;
    tempMetric.fill.style.background = temp >= 80 ? "#ff6b6b" : temp >= 65 ? "#e0b84b" : "#747474";
  };
  api.addEventListener("progress", onProgress);
  api.addEventListener("execution_success", onSuccess);
  api.addEventListener("execution_error", onError);
  api.addEventListener("crystools.monitor", onCrystools);
  etaTimer = window.setInterval(renderEta, 1000);
  reset();

  return {
    root, prepare, begin, finish, fail, reset,
    destroy: () => {
      window.clearInterval(etaTimer);
      api.removeEventListener("progress", onProgress);
      api.removeEventListener("execution_success", onSuccess);
      api.removeEventListener("execution_error", onError);
      api.removeEventListener("crystools.monitor", onCrystools);
    },
  };
}
