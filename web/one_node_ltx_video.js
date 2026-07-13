import { api } from "../../scripts/api.js";

const VIDEO_STATE_KEY = "one_node_ltx_video_state";
const IMAGE_STATE_KEY = "one_node_flux_klein_state";
const LIME = "#f0ff41";

const DEFAULT_STATE = {
  mode: "t2v",
  prompt: "",
  enhanced: { t2v: "", i2v: "" },
  enhance: { t2v: false, i2v: false },
  width: { t2v: 1280, i2v: 960 },
  height: { t2v: 720, i2v: 544 },
  fps: 24,
  duration: 5,
  seed: 0,
  imageName: "",
  audioName: "",
  models: {
    unet: "ltx-2.3-22b-distilled-Q4_K_M.gguf",
    clip: "gemma-3-12b-it-qat-UD-Q4_K_XL.gguf",
    connector: "ltx-2.3-22b-dev_embeddings_connectors.safetensors",
    videoVae: "ltx-2.3-22b-dev_video_vae.safetensors",
    audioVae: "ltx-2.3-22b-dev_audio_vae.safetensors",
    upscaler: "ltx-2.3-spatial-upscaler-x2-1.0.safetensors",
    t2vLora: "ltx2.3\\ltx-2.3-22b-distilled-lora-dynamic_fro09_avg_rank_105_bf16.safetensors",
    i2vLora: "ltx2.3\\ltx-2.3-22b-distilled-lora-dynamic_fro09_avg_rank_105_bf16.safetensors",
  },
};

const readJson = (key, fallback = {}) => {
  try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key) || "{}")) }; }
  catch { return { ...fallback }; }
};

const el = (tag, style = {}, attrs = {}) => {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  Object.assign(node, attrs);
  return node;
};

const text = (node, value) => { node.textContent = value; return node; };
const clampInt = (value, min, max, fallback) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

function initVideoUI(root) {
  if (root.dataset.ltxVideoReady === "1") return;
  const poseButton = [...root.querySelectorAll("button")].find(button => button.textContent.trim() === "POSE");
  if (!poseButton?.parentElement) return;
  root.dataset.ltxVideoReady = "1";

  const state = readJson(VIDEO_STATE_KEY, DEFAULT_STATE);
  state.enhanced = { ...DEFAULT_STATE.enhanced, ...(state.enhanced || {}) };
  state.enhance = { ...DEFAULT_STATE.enhance, ...(state.enhance || {}) };
  state.width = { ...DEFAULT_STATE.width, ...(state.width || {}) };
  state.height = { ...DEFAULT_STATE.height, ...(state.height || {}) };
  state.models = { ...DEFAULT_STATE.models, ...(state.models || {}) };
  const persist = () => localStorage.setItem(VIDEO_STATE_KEY, JSON.stringify(state));
  const sharedState = () => readJson(IMAGE_STATE_KEY, {});

  const makePill = label => {
    const button = poseButton.cloneNode(false);
    button.textContent = label;
    button.style.marginLeft = "0";
    button.style.flexShrink = "0";
    return button;
  };
  const t2vPill = makePill("T2V");
  const i2vPill = makePill("I2V");
  const imagePills = [...poseButton.parentElement.querySelectorAll("button")];
  poseButton.parentElement.append(t2vPill, i2vPill);

  const overlay = el("div", {
    position: "absolute", left: "0", right: "0", top: "31px", bottom: "0", zIndex: "230",
    display: "none", background: "#0b0b0b", color: "#dedede", padding: "10px 14px 12px",
    boxSizing: "border-box", fontFamily: "inherit", overflow: "hidden",
  });

  const layout = el("div", { display: "grid", gridTemplateColumns: "390px minmax(0,1fr)", gap: "12px", height: "100%" });
  const controls = el("div", { display: "flex", flexDirection: "column", gap: "7px", minWidth: "0", overflow: "hidden" });
  const preview = el("div", { display: "flex", flexDirection: "column", gap: "7px", minWidth: "0", minHeight: "0" });

  const row = el("div", { display: "flex", alignItems: "center", gap: "6px", minHeight: "24px" });
  const modeLabel = text(el("div", { color: LIME, fontWeight: "800", fontSize: "11px", letterSpacing: ".06em" }), "LTX 2.3 · T2V");
  const spacer = el("div", { flex: "1" });
  const smallButton = label => text(el("button", {
    border: "1px solid #383838", borderRadius: "5px", background: "#171717", color: "#bdbdbd",
    padding: "4px 8px", fontSize: "9px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap",
  }), label);
  const modelButton = smallButton("Models");
  const reviewButton = smallButton("Review JSON");
  row.append(modeLabel, spacer, modelButton, reviewButton);

  const promptHeader = el("div", { display: "flex", alignItems: "center", gap: "7px" });
  promptHeader.append(text(el("span", { fontSize: "9px", color: "#777", fontWeight: "700", textTransform: "uppercase" }), "Prompt"));
  const enhanceToggle = smallButton("Enhance off");
  promptHeader.append(enhanceToggle);
  const promptTA = el("textarea", {
    width: "100%", minHeight: "118px", flex: "1", resize: "none", border: "1px solid #303030",
    borderRadius: "6px", background: "#171717", color: "#dedede", padding: "9px 10px", boxSizing: "border-box",
    fontSize: "11px", lineHeight: "1.45", outline: "none", fontFamily: "inherit",
  }, { value: state.prompt || "", placeholder: "Describe the shot, motion, camera and sound..." });

  const jsonPanel = el("div", { display: "none", flexDirection: "column", gap: "6px", flex: "1", minHeight: "0" });
  const jsonTA = el("textarea", {
    width: "100%", flex: "1", resize: "none", border: "1px solid #3c430e", borderRadius: "6px",
    background: "#121407", color: "#dfe87b", padding: "8px", boxSizing: "border-box", minHeight: "150px",
    font: "10px/1.45 ui-monospace,Consolas,monospace", outline: "none",
  });
  const useJsonButton = smallButton("Use without Enhance");
  jsonPanel.append(jsonTA, useJsonButton);

  const fields = el("div", { display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "5px" });
  const numberField = (label, value, min, max) => {
    const wrap = el("label", { display: "flex", flexDirection: "column", gap: "3px", color: "#777", fontSize: "8px", fontWeight: "700", textTransform: "uppercase" });
    const input = el("input", { width: "100%", background: "#171717", border: "1px solid #303030", borderRadius: "4px", color: "#ddd", padding: "5px", boxSizing: "border-box", fontSize: "10px", outline: "none" }, { type: "number", value: String(value), min: String(min), max: String(max) });
    wrap.append(text(el("span"), label), input);
    return { wrap, input };
  };
  const widthField = numberField("Width", state.width[state.mode], 256, 4096);
  const heightField = numberField("Height", state.height[state.mode], 256, 4096);
  const fpsField = numberField("FPS", state.fps, 1, 60);
  const durationField = numberField("Seconds", state.duration, 1, 120);
  const seedField = numberField("Seed · 0 auto", state.seed, 0, 999999999999999);
  fields.append(widthField.wrap, heightField.wrap, fpsField.wrap, durationField.wrap, seedField.wrap);

  const assets = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" });
  const fileControl = (label, accept) => {
    const wrap = el("label", { display: "flex", alignItems: "center", gap: "6px", minWidth: "0", border: "1px dashed #3a3a3a", borderRadius: "5px", padding: "6px 8px", cursor: "pointer", background: "#141414" });
    const input = el("input", { display: "none" }, { type: "file", accept });
    const caption = text(el("span", { color: "#aaa", fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }), label);
    wrap.append(input, caption);
    return { wrap, input, caption };
  };
  const imageFile = fileControl("First frame", "image/*");
  const audioFile = fileControl("Optional audio", "audio/*");
  assets.append(imageFile.wrap, audioFile.wrap);

  const actionRow = el("div", { display: "flex", alignItems: "center", gap: "7px" });
  const generateButton = text(el("button", {
    flex: "1", height: "34px", border: "0", borderRadius: "6px", background: LIME, color: "#111",
    fontSize: "12px", fontWeight: "800", cursor: "pointer",
  }), "Generate video");
  const clearAudioButton = smallButton("Clear audio");
  actionRow.append(generateButton, clearAudioButton);
  const status = text(el("div", { minHeight: "14px", color: "#888", fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }), "Ready");

  const video = el("video", { width: "100%", flex: "1", minHeight: "0", objectFit: "contain", background: "#050505", border: "1px solid #292929", borderRadius: "6px" }, { controls: true });
  const outputMeta = text(el("div", { minHeight: "18px", color: "#777", fontSize: "9px", textAlign: "right" }), "Generated video will appear here");
  preview.append(video, outputMeta);

  controls.append(row, promptHeader, promptTA, jsonPanel, fields, assets, actionRow, status);
  layout.append(controls, preview);
  overlay.append(layout);
  root.append(overlay);

  const modelOverlay = el("div", { position: "absolute", inset: "0", zIndex: "4", display: "none", flexDirection: "column", gap: "8px", background: "#0b0b0b", padding: "12px 14px", boxSizing: "border-box" });
  const modelHead = el("div", { display: "flex", alignItems: "center" });
  modelHead.append(text(el("div", { color: LIME, fontWeight: "800", fontSize: "11px", flex: "1" }), "LTX model files"));
  const closeModels = smallButton("Close"); modelHead.append(closeModels);
  const modelGrid = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", overflow: "auto" });
  const modelFields = {};
  const modelLabels = { unet:"Diffusion model",clip:"Text encoder",connector:"Connector",videoVae:"Video VAE",audioVae:"Audio VAE",upscaler:"Latent upscaler",t2vLora:"T2V LoRA",i2vLora:"I2V LoRA" };
  for (const [key, label] of Object.entries(modelLabels)) {
    const wrap = el("label", { display: "flex", flexDirection: "column", gap: "3px", color: "#777", fontSize: "8px", fontWeight: "700", textTransform: "uppercase" });
    const input = el("input", { width: "100%", background: "#171717", border: "1px solid #303030", borderRadius: "4px", color: "#ddd", padding: "6px", boxSizing: "border-box", fontSize: "9px", outline: "none" }, { value: state.models[key] });
    input.onchange = () => { state.models[key] = input.value.trim(); persist(); };
    wrap.append(text(el("span"), label), input); modelGrid.append(wrap); modelFields[key] = input;
  }
  modelOverlay.append(modelHead, modelGrid); overlay.append(modelOverlay);

  const setStatus = (message, error = false) => { status.textContent = message; status.style.color = error ? "#ff6b6b" : "#888"; };
  const refresh = () => {
    const mode = state.mode;
    modeLabel.textContent = `LTX 2.3 · ${mode.toUpperCase()}`;
    t2vPill.style.background = mode === "t2v" && overlay.style.display !== "none" ? LIME : "#202020";
    t2vPill.style.color = mode === "t2v" && overlay.style.display !== "none" ? "#111" : "#bbb";
    i2vPill.style.background = mode === "i2v" && overlay.style.display !== "none" ? LIME : "#202020";
    i2vPill.style.color = mode === "i2v" && overlay.style.display !== "none" ? "#111" : "#bbb";
    imageFile.wrap.style.display = mode === "i2v" ? "flex" : "none";
    imageFile.caption.textContent = state.imageName || "First frame";
    audioFile.caption.textContent = state.audioName || "Optional audio";
    enhanceToggle.textContent = state.enhance[mode] ? "Enhance on" : "Enhance off";
    enhanceToggle.style.color = state.enhance[mode] ? LIME : "#aaa";
    enhanceToggle.style.borderColor = state.enhance[mode] ? "#768018" : "#383838";
    reviewButton.disabled = !state.enhanced[mode];
    reviewButton.style.opacity = state.enhanced[mode] ? "1" : ".4";
    widthField.input.value = state.width[mode]; heightField.input.value = state.height[mode];
  };

  const openMode = mode => {
    state.mode = mode; overlay.style.display = "block"; modelOverlay.style.display = "none";
    for (const button of imagePills) { button.style.background = "#202020"; button.style.color = "#bbb"; }
    jsonPanel.style.display = "none"; promptTA.style.display = "block"; promptTA.value = state.prompt || "";
    persist(); refresh();
  };
  t2vPill.onclick = () => openMode("t2v");
  i2vPill.onclick = () => openMode("i2v");
  for (const button of [...poseButton.parentElement.querySelectorAll("button")]) {
    if (button === t2vPill || button === i2vPill) continue;
    button.addEventListener("click", () => { overlay.style.display = "none"; refresh(); });
  }

  enhanceToggle.onclick = () => { state.enhance[state.mode] = !state.enhance[state.mode]; persist(); refresh(); };
  reviewButton.onclick = () => {
    jsonTA.value = state.enhanced[state.mode] || "";
    const show = jsonPanel.style.display !== "flex";
    jsonPanel.style.display = show ? "flex" : "none"; promptTA.style.display = show ? "none" : "block";
  };
  useJsonButton.onclick = () => {
    const value = jsonTA.value.trim(); if (!value) return;
    state.enhanced[state.mode] = value; state.prompt = value; state.enhance[state.mode] = false;
    promptTA.value = value; jsonPanel.style.display = "none"; promptTA.style.display = "block"; persist(); refresh();
  };
  modelButton.onclick = () => { modelOverlay.style.display = "flex"; };
  closeModels.onclick = () => { modelOverlay.style.display = "none"; };

  const upload = async file => {
    const form = new FormData(); form.append("image", file, file.name); form.append("type", "input"); form.append("overwrite", "true");
    const response = await api.fetchApi("/upload/image", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || `Upload HTTP ${response.status}`);
    return result.subfolder ? `${result.subfolder}/${result.name}` : (result.name || file.name);
  };
  imageFile.input.onchange = async () => {
    const file = imageFile.input.files?.[0]; if (!file) return;
    try { setStatus("Uploading first frame..."); state.imageName = await upload(file); persist(); refresh(); setStatus("First frame ready"); }
    catch (error) { setStatus(`Image upload failed: ${error.message}`, true); }
  };
  audioFile.input.onchange = async () => {
    const file = audioFile.input.files?.[0]; if (!file) return;
    try { setStatus("Uploading audio..."); state.audioName = await upload(file); persist(); refresh(); setStatus("External audio ready"); }
    catch (error) { setStatus(`Audio upload failed: ${error.message}`, true); }
  };
  clearAudioButton.onclick = () => { state.audioName = ""; audioFile.input.value = ""; persist(); refresh(); };

  const findVideo = output => {
    const raw = output?.video || output?.videos || output?.gifs;
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return null;
    if (typeof item === "string") return { filename: item, subfolder: "", type: "output" };
    return item;
  };
  const waitForVideo = (promptId, saveId) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error("Video generation timed out")); }, 7200000);
    const cleanup = () => {
      clearTimeout(timeout); api.removeEventListener("executed", executed); api.removeEventListener("execution_error", failed);
    };
    const executed = event => {
      const detail = event.detail || event;
      if (detail.prompt_id !== promptId || String(detail.node) !== saveId) return;
      const media = findVideo(detail.output); if (!media) return;
      cleanup(); resolve(media);
    };
    const failed = event => {
      const detail = event.detail || event; if (detail.prompt_id !== promptId) return;
      cleanup(); reject(new Error(detail.exception_message || detail.exception_type || "Video generation failed"));
    };
    api.addEventListener("executed", executed); api.addEventListener("execution_error", failed);
  });

  generateButton.onclick = async () => {
    if (generateButton.disabled) return;
    state.prompt = promptTA.value.trim();
    state.width[state.mode] = clampInt(widthField.input.value, 256, 4096, state.width[state.mode]);
    state.height[state.mode] = clampInt(heightField.input.value, 256, 4096, state.height[state.mode]);
    state.fps = clampInt(fpsField.input.value, 1, 60, 24);
    state.duration = clampInt(durationField.input.value, 1, 120, 5);
    state.seed = clampInt(seedField.input.value, 0, 999999999999999, 0);
    if (!state.prompt) { setStatus("Enter a video prompt", true); return; }
    if (state.mode === "i2v" && !state.imageName) { setStatus("Choose a first frame", true); return; }
    persist(); generateButton.disabled = true; generateButton.style.opacity = ".55";
    try {
      let effectivePrompt = state.prompt;
      if (state.enhance[state.mode]) {
        setStatus("Enhancing video prompt with LM Studio...");
        const shared = sharedState(); const llm = shared.llmSettings || {};
        const response = await api.fetchApi("/flux_klein/enhance_prompt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: effectivePrompt, width: state.width[state.mode], height: state.height[state.mode], mode: state.mode, settings: {
            base_url: llm.baseUrl, model: llm.model, temperature: llm.temperature, context_length: llm.contextLength,
            max_tokens: llm.maxTokens, timeout_seconds: llm.timeoutSeconds, api_key: llm.apiKey || "lm-studio", system_prompt: llm.systemPrompt,
          } }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok || !result.json_prompt) throw new Error(result.error || `Enhance HTTP ${response.status}`);
        effectivePrompt = result.json_prompt; state.enhanced[state.mode] = effectivePrompt; persist(); refresh();
      }

      setStatus("Preparing LTX workflow...");
      const endpoint = state.mode === "t2v" ? "/flux_klein/workflow_ltx_t2v" : "/flux_klein/workflow_ltx_i2v";
      const graphResponse = await api.fetchApi(endpoint); const graph = await graphResponse.json();
      const prefix = state.mode === "t2v" ? "LTX:T2V" : "LTX:I2V";
      const classes = new Set(Object.values(graph).map(node => node.class_type));
      const objectInfo = await (await api.fetchApi("/object_info")).json();
      const missing = [...classes].filter(name => !objectInfo[name]);
      if (missing.length) throw new Error(`Missing ComfyUI nodes: ${missing.join(", ")}`);

      const width = Math.max(256, Math.round(state.width[state.mode] / 32) * 32);
      const height = Math.max(256, Math.round(state.height[state.mode] / 32) * 32);
      const frames = Math.max(9, Math.round((state.duration * state.fps - 1) / 8) * 8 + 1);
      const seed = state.seed || Math.floor(Math.random() * 9007199254740990) + 1;
      graph[`${prefix}:positive`].inputs.text = effectivePrompt;
      graph[`${prefix}:size`]?.inputs && Object.assign(graph[`${prefix}:size`].inputs, { width, height });
      if (state.mode === "i2v") {
        graph[`${prefix}:load_image`].inputs.image = state.imageName;
        Object.assign(graph[`${prefix}:resize`].inputs, { width, height });
      }
      graph[`${prefix}:video_latent`].inputs.length = frames;
      graph[`${prefix}:audio_latent`].inputs.frames_number = frames;
      graph[`${prefix}:audio_latent`].inputs.frame_rate = state.fps;
      graph[`${prefix}:conditioning`].inputs.frame_rate = state.fps;
      graph[`${prefix}:create`].inputs.fps = state.fps;
      graph[`${prefix}:noise1`].inputs.noise_seed = seed;
      graph[`${prefix}:noise2`].inputs.noise_seed = seed + 1;
      graph[`${prefix}:model`].inputs.unet_name = state.models.unet;
      graph[`${prefix}:clip`].inputs.clip_name1 = state.models.clip;
      graph[`${prefix}:clip`].inputs.clip_name2 = state.models.connector;
      graph[`${prefix}:video_vae`].inputs.vae_name = state.models.videoVae;
      graph[`${prefix}:audio_vae`].inputs.vae_name = state.models.audioVae;
      graph[`${prefix}:upscaler`].inputs.model_name = state.models.upscaler;
      graph[`${prefix}:lora`].inputs.lora_name = state.mode === "t2v" ? state.models.t2vLora : state.models.i2vLora;
      graph[`${prefix}:lora`].inputs.strength_model = 0.6;
      if (state.audioName) {
        graph["LTX:external_audio"] = { class_type: "LoadAudio", inputs: { audio: state.audioName }, _meta: { title: "External Audio" } };
        graph[`${prefix}:create`].inputs.audio = ["LTX:external_audio", 0];
      }

      setStatus("LTX video is generating...");
      const queued = await api.fetchApi("/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph, client_id: api.clientId, extra_data: { enable_previews: true } }) });
      const queueResult = await queued.json();
      if (!queued.ok || queueResult.error || Object.keys(queueResult.node_errors || {}).length) {
        const firstError = Object.values(queueResult.node_errors || {})[0];
        throw new Error(queueResult.error?.message || firstError?.errors?.[0]?.message || `Queue HTTP ${queued.status}`);
      }
      const media = await waitForVideo(queueResult.prompt_id, `${prefix}:save`);
      const url = api.apiURL(`/view?filename=${encodeURIComponent(media.filename)}&type=${encodeURIComponent(media.type || "output")}&subfolder=${encodeURIComponent(media.subfolder || "")}`);
      video.src = url; video.load(); outputMeta.textContent = media.subfolder ? `${media.subfolder}/${media.filename}` : media.filename;
      setStatus("Video ready");
      if (sharedState().unloadAfterGeneration) {
        await api.fetchApi("/free", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unload_models: true, free_memory: true }) });
      }
    } catch (error) {
      setStatus(error?.message || String(error), true);
    } finally {
      generateButton.disabled = false; generateButton.style.opacity = "1";
    }
  };

  refresh();
}

const scan = () => document.querySelectorAll(".fk-root").forEach(initVideoUI);
scan();
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
