import { api } from "../../scripts/api.js";

const MEDIA_STATE_KEY = "one_node_ltx_video_state";
const IMAGE_STATE_KEY = "one_node_flux_klein_state";
const LIME = "#f0ff41";
const BG = "#0b0b0b";
const PANEL = "#151515";
const BORDER = "#343434";

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
  imageLabel: "",
  audioName: "",
  audioLabel: "",
  voice: {
    text: "",
    refText: "",
    refAudioName: "",
    refAudioLabel: "",
    language: "German",
    seed: 42,
  },
  song: {
    tags: "",
    lyrics: "",
    duration: 180,
    bpm: 120,
    language: "de",
    keyscale: "E minor",
    timesignature: "4",
    seed: 0,
  },
  models: {
    unet: "ltx-2.3-22b-distilled-Q4_K_M.gguf",
    clip: "gemma-3-12b-it-qat-UD-Q4_K_XL.gguf",
    connector: "ltx-2.3-22b-dev_embeddings_connectors.safetensors",
    videoVae: "ltx-2.3-22b-dev_video_vae.safetensors",
    audioVae: "ltx-2.3-22b-dev_audio_vae.safetensors",
    upscaler: "ltx-2.3-spatial-upscaler-x2-1.0.safetensors",
    t2vLora: "ltx2.3\\ltx-2.3-22b-distilled-lora-dynamic_fro09_avg_rank_105_bf16.safetensors",
    i2vLora: "ltx2.3\\ltx-2.3-22b-distilled-lora-dynamic_fro09_avg_rank_105_bf16.safetensors",
    voiceRepo: "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    voiceSource: "HuggingFace",
    voicePrecision: "bf16",
    voiceAttention: "auto",
    voiceLocalPath: "",
    voiceMaxTokens: 2048,
    voiceRefSeconds: 30,
    songUnet: "acestep_v1.5_xl_turbo_bf16.safetensors",
    songClip1: "qwen_0.6b_ace15.safetensors",
    songClip2: "qwen_1.7b_ace15.safetensors",
    songVae: "ace_1.5_vae.safetensors",
    songWeightDtype: "default",
    songDevice: "default",
    songShift: 3.5,
    songSteps: 50,
    songCfg: 2.0,
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
const tx = (node, value) => { node.textContent = value; return node; };
const clampInt = (value, min, max, fallback) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};
const clampFloat = (value, min, max, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

function initMediaUI(root) {
  if (root.dataset.oneNodeMediaReady === "1") return;
  const poseButton = [...root.querySelectorAll("button")].find(button => button.textContent.trim() === "POSE");
  if (!poseButton?.parentElement) return;
  root.dataset.oneNodeMediaReady = "1";

  const state = readJson(MEDIA_STATE_KEY, DEFAULT_STATE);
  state.enhanced = { ...DEFAULT_STATE.enhanced, ...(state.enhanced || {}) };
  state.enhance = { ...DEFAULT_STATE.enhance, ...(state.enhance || {}) };
  state.width = { ...DEFAULT_STATE.width, ...(state.width || {}) };
  state.height = { ...DEFAULT_STATE.height, ...(state.height || {}) };
  state.voice = { ...DEFAULT_STATE.voice, ...(state.voice || {}) };
  state.song = { ...DEFAULT_STATE.song, ...(state.song || {}) };
  state.models = { ...DEFAULT_STATE.models, ...(state.models || {}) };
  const persist = () => localStorage.setItem(MEDIA_STATE_KEY, JSON.stringify(state));
  const sharedState = () => readJson(IMAGE_STATE_KEY, {});
  const llmSettingsPayload = () => {
    const llm = sharedState().llmSettings || {};
    return {
      base_url: llm.baseUrl, model: llm.model, temperature: llm.temperature,
      context_length: llm.contextLength, max_tokens: llm.maxTokens,
      timeout_seconds: llm.timeoutSeconds, api_key: llm.apiKey || "lm-studio",
      system_prompt: llm.systemPrompt,
    };
  };

  const modeBar = poseButton.parentElement;
  const topBar = modeBar.parentElement;
  const baseSurface = topBar?.parentElement;
  const baseContent = baseSurface ? [...baseSurface.children].filter(node => node !== topBar) : [];
  const baseVisibility = new Map(baseContent.map(node => [node, node.style.visibility]));
  let baseContentHidden = false;
  const setBaseContentHidden = hidden => {
    if (baseContentHidden === hidden) return;
    baseContentHidden = hidden;
    for (const node of baseContent) node.style.visibility = hidden ? "hidden" : (baseVisibility.get(node) || "");
  };
  modeBar.style.overflowX = "auto";
  modeBar.style.overflowY = "hidden";
  modeBar.style.scrollbarWidth = "thin";
  modeBar.style.flexWrap = "nowrap";
  const imagePills = [...modeBar.querySelectorAll("button")];
  const makePill = label => {
    const button = poseButton.cloneNode(false);
    button.textContent = label;
    Object.assign(button.style, { marginLeft: "0", flexShrink: "0", paddingLeft: "7px", paddingRight: "7px", fontSize: "9px" });
    return button;
  };
  const pills = {
    t2v: makePill("T2V"),
    i2v: makePill("I2V"),
    clonevoice: makePill("CloneVoice"),
    song: makePill("Song"),
  };
  modeBar.append(pills.t2v, pills.i2v, pills.clonevoice, pills.song);

  const overlay = el("div", {
    position: "absolute", left: "0", right: "0", bottom: "0", zIndex: "900",
    display: "none", background: BG, color: "#dedede", padding: "10px 14px 12px",
    boxSizing: "border-box", fontFamily: "inherit", overflow: "hidden", isolation: "isolate",
  });
  const placeOverlay = () => {
    const anchor = topBar || modeBar;
    overlay.style.top = `${Math.max(34, anchor.offsetTop + anchor.offsetHeight)}px`;
  };
  new ResizeObserver(placeOverlay).observe(topBar || modeBar);

  const smallButton = label => tx(el("button", {
    border: `1px solid ${BORDER}`, borderRadius: "5px", background: "#171717", color: "#bdbdbd",
    padding: "4px 8px", fontSize: "9px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap",
  }), label);
  const primaryButton = label => tx(el("button", {
    height: "34px", border: "0", borderRadius: "6px", background: LIME, color: "#111",
    fontSize: "12px", fontWeight: "800", cursor: "pointer", padding: "0 16px",
  }), label);
  const switchControl = (label, title) => {
    const button = el("button", {
      display: "flex", alignItems: "center", gap: "5px", border: `1px solid ${BORDER}`,
      borderRadius: "5px", background: "#171717", color: "#888", padding: "3px 7px",
      fontSize: "9px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap",
    }, { title, type: "button" });
    const caption = tx(el("span"), label);
    const track = el("span", { position: "relative", width: "24px", height: "12px", borderRadius: "7px", background: "#333", transition: "background .18s" });
    const thumb = el("span", { position: "absolute", top: "2px", left: "2px", width: "8px", height: "8px", borderRadius: "50%", background: "#888", transition: "left .18s, background .18s" });
    track.append(thumb); button.append(caption, track);
    button.setOn = on => {
      button.dataset.on = on ? "1" : "0";
      button.style.borderColor = on ? "rgba(240,255,65,.55)" : BORDER;
      caption.style.color = on ? LIME : "#888";
      track.style.background = on ? LIME : "#333";
      thumb.style.left = on ? "14px" : "2px";
      thumb.style.background = on ? "#111" : "#888";
    };
    return button;
  };
  const textarea = (value, placeholder, minHeight = "100px") => el("textarea", {
    width: "100%", minHeight, resize: "none", border: `1px solid ${BORDER}`, borderRadius: "6px",
    background: "#171717", color: "#dedede", padding: "9px 10px", boxSizing: "border-box",
    fontSize: "11px", lineHeight: "1.45", outline: "none", fontFamily: "inherit",
  }, { value: value || "", placeholder });
  const numberField = (label, value, min, max, step = 1) => {
    const wrap = el("label", { display: "flex", flexDirection: "column", gap: "3px", color: "#777", fontSize: "8px", fontWeight: "700", textTransform: "uppercase" });
    const input = el("input", { width: "100%", background: "#171717", border: `1px solid ${BORDER}`, borderRadius: "4px", color: "#ddd", padding: "5px", boxSizing: "border-box", fontSize: "10px", outline: "none" }, { type: "number", value: String(value), min: String(min), max: String(max), step: String(step) });
    wrap.append(tx(el("span"), label), input);
    return { wrap, input };
  };
  const textField = (label, value, placeholder = "") => {
    const wrap = el("label", { display: "flex", flexDirection: "column", gap: "3px", color: "#777", fontSize: "8px", fontWeight: "700", textTransform: "uppercase", minWidth: "0" });
    const input = el("input", { width: "100%", background: "#171717", border: `1px solid ${BORDER}`, borderRadius: "4px", color: "#ddd", padding: "6px", boxSizing: "border-box", fontSize: "9px", outline: "none" }, { value: value ?? "", placeholder });
    wrap.append(tx(el("span"), label), input);
    return { wrap, input };
  };
  const selectField = (label, value, options) => {
    const wrap = el("label", { display: "flex", flexDirection: "column", gap: "3px", color: "#777", fontSize: "8px", fontWeight: "700", textTransform: "uppercase" });
    const select = el("select", { width: "100%", background: "#171717", border: `1px solid ${BORDER}`, borderRadius: "4px", color: "#ddd", padding: "5px", boxSizing: "border-box", fontSize: "10px", outline: "none" });
    for (const option of options) select.append(tx(el("option", {}, { value: option }), option));
    select.value = value;
    wrap.append(tx(el("span"), label), select);
    return { wrap, input: select };
  };
  const fileControl = (label, accept) => {
    const wrap = el("label", { display: "flex", alignItems: "center", gap: "6px", minWidth: "0", border: "1px dashed #3a3a3a", borderRadius: "5px", padding: "6px 8px", cursor: "pointer", background: "#141414" });
    const input = el("input", { display: "none" }, { type: "file", accept });
    const caption = tx(el("span", { color: "#aaa", fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }), label);
    wrap.append(input, caption);
    return { wrap, input, caption };
  };
  const panelHeader = (label, extra = []) => {
    const row = el("div", { display: "flex", alignItems: "center", gap: "6px", minHeight: "24px" });
    row.append(tx(el("div", { color: LIME, fontWeight: "800", fontSize: "11px", letterSpacing: "0" }), label), el("div", { flex: "1" }), ...extra);
    return row;
  };
  const mediaUrl = asset => api.apiURL(`/view?filename=${encodeURIComponent(asset.filename)}&type=${encodeURIComponent(asset.type || "output")}&subfolder=${encodeURIComponent(asset.subfolder || "")}`);

  const panels = {};
  const settingsButton = smallButton("Models");
  const helpButton = smallButton("Help");
  const videoUnloadToggle = switchControl("Unload", "Unload all ComfyUI models and free GPU memory after generation");

  // Video panel
  const videoPanel = el("div", { display: "none", gridTemplateColumns: "390px minmax(0,1fr)", gap: "12px", height: "100%" });
  const videoControls = el("div", { display: "flex", flexDirection: "column", gap: "7px", minWidth: "0", overflow: "hidden" });
  const reviewButton = smallButton("Review JSON");
  const videoHeaderLabel = tx(el("div", { color: LIME, fontWeight: "800", fontSize: "11px" }), "LTX 2.3 - T2V");
  const videoHeader = el("div", { display: "flex", alignItems: "center", gap: "6px", minHeight: "24px" });
  videoHeader.append(videoHeaderLabel, el("div", { flex: "1" }), videoUnloadToggle, helpButton, settingsButton, reviewButton);
  const promptHeader = el("div", { display: "flex", alignItems: "center", gap: "7px" });
  promptHeader.append(tx(el("span", { fontSize: "9px", color: "#777", fontWeight: "700", textTransform: "uppercase" }), "Prompt"));
  const enhanceToggle = smallButton("Enhance off");
  promptHeader.append(enhanceToggle);
  const promptTA = textarea(state.prompt, "Describe the shot, motion, camera and sound...", "112px");
  promptTA.style.flex = "1";
  const jsonPanel = el("div", { display: "none", flexDirection: "column", gap: "6px", flex: "1", minHeight: "0" });
  const jsonTA = textarea("", "Enhanced JSON", "150px");
  Object.assign(jsonTA.style, { flex: "1", background: "#121407", color: "#dfe87b", borderColor: "#3c430e", font: "10px/1.45 ui-monospace,Consolas,monospace" });
  const useJsonButton = smallButton("Use without Enhance");
  jsonPanel.append(jsonTA, useJsonButton);
  const videoFields = el("div", { display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "5px" });
  const widthField = numberField("Width", state.width[state.mode] || 1280, 256, 4096);
  const heightField = numberField("Height", state.height[state.mode] || 720, 256, 4096);
  const fpsField = numberField("FPS", state.fps, 1, 60);
  const durationField = numberField("Seconds", state.duration, 1, 120);
  const seedField = numberField("Seed - 0 auto", state.seed, 0, 999999999999999);
  videoFields.append(widthField.wrap, heightField.wrap, fpsField.wrap, durationField.wrap, seedField.wrap);
  const videoAssets = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" });
  const imageFile = fileControl("Upload first frame", "image/*");
  const audioFile = fileControl("Optional audio", "audio/*");
  const imageActions = el("div", { display: "flex", gap: "5px", minWidth: "0" });
  const galleryImageButton = smallButton("From Gallery");
  imageActions.append(imageFile.wrap, galleryImageButton);
  imageFile.wrap.style.flex = "1";
  videoAssets.append(imageActions, audioFile.wrap);
  const videoActions = el("div", { display: "flex", gap: "7px" });
  const generateVideoButton = primaryButton("Generate video"); generateVideoButton.style.flex = "1";
  const clearImageButton = smallButton("Clear image");
  const clearAudioButton = smallButton("Clear audio");
  videoActions.append(generateVideoButton, clearImageButton, clearAudioButton);
  const videoStatus = tx(el("div", { minHeight: "14px", color: "#888", fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }), "Ready");
  const videoPreview = el("div", { display: "flex", flexDirection: "column", gap: "7px", minWidth: "0", minHeight: "0" });
  const video = el("video", { width: "100%", flex: "1", minHeight: "0", objectFit: "contain", background: "#050505", border: "1px solid #292929", borderRadius: "6px" }, { controls: true });
  const videoMeta = tx(el("div", { minHeight: "18px", color: "#777", fontSize: "9px", textAlign: "right" }), "Generated video will appear here");
  videoPreview.append(video, videoMeta);
  videoControls.append(videoHeader, promptHeader, promptTA, jsonPanel, videoFields, videoAssets, videoActions, videoStatus);
  videoPanel.append(videoControls, videoPreview);
  panels.video = videoPanel;

  // CloneVoice panel
  const voicePanel = el("div", { display: "none", gridTemplateColumns: "420px minmax(0,1fr)", gap: "12px", height: "100%" });
  const voiceControls = el("div", { display: "flex", flexDirection: "column", gap: "7px", minWidth: "0", overflowY: "auto", paddingRight: "3px" });
  const voiceModelsButton = smallButton("Models");
  const voiceHelpButton = smallButton("Help");
  const voiceUnloadToggle = switchControl("Unload", "Unload all ComfyUI models and free GPU memory after generation");
  voiceControls.append(panelHeader("Qwen3 TTS - CloneVoice", [voiceUnloadToggle, voiceHelpButton, voiceModelsButton]));
  const voiceText = textarea(state.voice.text, "Text to speak with the cloned voice...", "105px");
  const voiceRefText = textarea(state.voice.refText, "Exact transcript of the reference audio...", "72px");
  const voiceTemplateRow = el("div", { display: "grid", gridTemplateColumns: "minmax(100px,1fr) minmax(90px,1fr) auto auto", gap: "5px", alignItems: "end" });
  const voiceTemplateSelectField = selectField("Voice template", "", []);
  const voiceTemplateName = textField("Template name", "", "e.g. Sierra or Mathias");
  const saveVoiceTemplateButton = smallButton("Save");
  const deleteVoiceTemplateButton = smallButton("Delete");
  Object.assign(saveVoiceTemplateButton.style, { height: "27px" });
  Object.assign(deleteVoiceTemplateButton.style, { height: "27px" });
  voiceTemplateRow.append(voiceTemplateSelectField.wrap, voiceTemplateName.wrap, saveVoiceTemplateButton, deleteVoiceTemplateButton);
  const voiceFields = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" });
  const voiceLanguage = selectField("Language", state.voice.language, ["Auto", "German", "English", "French", "Spanish", "Italian", "Portuguese", "Chinese", "Japanese", "Korean", "Russian"]);
  const voiceSeed = numberField("Seed", state.voice.seed, 1, 999999999999999);
  voiceFields.append(voiceLanguage.wrap, voiceSeed.wrap);
  const refAudioFile = fileControl("Reference voice audio", "audio/*");
  const generateVoiceButton = primaryButton("Generate voice");
  const voiceStatus = tx(el("div", { minHeight: "14px", color: "#888", fontSize: "9px" }), "Ready");
  voiceControls.append(voiceTemplateRow, tx(el("div", { fontSize: "8px", color: "#777", fontWeight: "700", textTransform: "uppercase" }), "Spoken text"), voiceText, tx(el("div", { fontSize: "8px", color: "#777", fontWeight: "700", textTransform: "uppercase" }), "Reference transcript"), voiceRefText, voiceFields, refAudioFile.wrap, generateVoiceButton, voiceStatus);
  const voicePreview = el("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "12px", minWidth: "0", padding: "18px", background: "#101010", border: "1px solid #292929", borderRadius: "6px" });
  const voiceAudio = el("audio", { width: "100%" }, { controls: true });
  const voiceMeta = tx(el("div", { color: "#777", fontSize: "9px", textAlign: "center" }), "Generated voice will appear here");
  const voiceSend = el("div", { display: "flex", justifyContent: "center", gap: "7px" });
  const voiceToT2V = smallButton("Use in T2V"); const voiceToI2V = smallButton("Use in I2V");
  voiceSend.append(voiceToT2V, voiceToI2V); voicePreview.append(voiceAudio, voiceMeta, voiceSend);
  voicePanel.append(voiceControls, voicePreview);
  panels.voice = voicePanel;

  // Song panel
  const songPanel = el("div", { display: "none", gridTemplateColumns: "430px minmax(0,1fr)", gap: "12px", height: "100%" });
  const songControls = el("div", { display: "flex", flexDirection: "column", gap: "7px", minWidth: "0", overflowY: "auto", paddingRight: "3px" });
  const songModelsButton = smallButton("Models"); const songHelpButton = smallButton("Help");
  const songEnhanceAllButton = smallButton("Enhance all");
  const songUnloadToggle = switchControl("Unload", "Unload all ComfyUI models and free GPU memory after generation");
  songControls.append(panelHeader("ACE-Step 1.5 - Song", [songEnhanceAllButton, songUnloadToggle, songHelpButton, songModelsButton]));
  const songTags = textarea(state.song.tags, "Style, genre, instruments, mood, vocals...", "62px");
  const songLyrics = textarea(state.song.lyrics, "Lyrics with optional [Verse], [Chorus] and [Bridge] sections...", "105px");
  const songTagsHeader = el("div", { display: "flex", alignItems: "center", gap: "6px" });
  const songLyricsHeader = el("div", { display: "flex", alignItems: "center", gap: "6px" });
  const songTagsEnhance = smallButton("Enhance");
  const songLyricsEnhance = smallButton("Enhance");
  songTagsHeader.append(tx(el("div", { fontSize: "8px", color: "#777", fontWeight: "700", textTransform: "uppercase", flex: "1" }), "Music description"), songTagsEnhance);
  songLyricsHeader.append(tx(el("div", { fontSize: "8px", color: "#777", fontWeight: "700", textTransform: "uppercase", flex: "1" }), "Lyrics"), songLyricsEnhance);
  const songFields = el("div", { display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: "5px" });
  const songDuration = numberField("Seconds", state.song.duration, 1, 1000, 0.1);
  const songBpm = numberField("BPM", state.song.bpm, 10, 300);
  const songLanguage = textField("Language", state.song.language);
  const songKey = textField("Key", state.song.keyscale);
  const songTime = selectField("Time", state.song.timesignature, ["2", "3", "4", "6"]);
  const songSeed = numberField("Seed - 0 auto", state.song.seed, 0, 999999999999999);
  songFields.append(songDuration.wrap, songBpm.wrap, songLanguage.wrap, songKey.wrap, songTime.wrap, songSeed.wrap);
  const generateSongButton = primaryButton("Generate song");
  const songStatus = tx(el("div", { minHeight: "14px", color: "#888", fontSize: "9px" }), "Ready");
  songControls.append(songTagsHeader, songTags, songLyricsHeader, songLyrics, songFields, generateSongButton, songStatus);
  const songPreview = el("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "12px", minWidth: "0", padding: "18px", background: "#101010", border: "1px solid #292929", borderRadius: "6px" });
  const songAudio = el("audio", { width: "100%" }, { controls: true });
  const songMeta = tx(el("div", { color: "#777", fontSize: "9px", textAlign: "center" }), "Generated song will appear here");
  const songSend = el("div", { display: "flex", justifyContent: "center", gap: "7px" });
  const songToT2V = smallButton("Use in T2V"); const songToI2V = smallButton("Use in I2V");
  songSend.append(songToT2V, songToI2V); songPreview.append(songAudio, songMeta, songSend);
  songPanel.append(songControls, songPreview);
  panels.song = songPanel;

  overlay.append(videoPanel, voicePanel, songPanel);
  root.append(overlay);

  // Context-specific media settings
  const settingsOverlay = el("div", { position: "absolute", inset: "0", zIndex: "8", display: "none", flexDirection: "column", gap: "8px", background: BG, padding: "12px 14px", boxSizing: "border-box" });
  const settingsTitle = tx(el("div", { color: LIME, fontWeight: "800", fontSize: "11px", flex: "1" }), "Media models");
  const closeSettings = smallButton("Close");
  const settingsHead = el("div", { display: "flex", alignItems: "center" }); settingsHead.append(settingsTitle, closeSettings);
  const settingsGrid = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", overflow: "auto", paddingRight: "4px" });
  const modelFields = {};
  const modelGroups = {
    "LTX 2.3 video": { unet: "Diffusion model", clip: "Text encoder", connector: "Connector", videoVae: "Video VAE", audioVae: "Audio VAE", upscaler: "Latent upscaler", t2vLora: "T2V LoRA", i2vLora: "I2V LoRA" },
    "Qwen3 CloneVoice": { voiceRepo: "Repository ID", voiceSource: "Source", voicePrecision: "Precision", voiceAttention: "Attention", voiceLocalPath: "Local model path", voiceMaxTokens: "Max output tokens", voiceRefSeconds: "Reference max seconds" },
    "ACE-Step Song": { songUnet: "Diffusion model", songClip1: "Text encoder 1", songClip2: "Text encoder 2", songVae: "Audio VAE", songWeightDtype: "Weight dtype", songDevice: "Encoder device", songShift: "Model shift", songSteps: "Sampling steps", songCfg: "CFG" },
  };
  for (const [group, fields] of Object.entries(modelGroups)) {
    const heading = tx(el("div", { gridColumn: "1 / -1", color: "#ddd", fontSize: "10px", fontWeight: "800", borderBottom: `1px solid ${BORDER}`, padding: "7px 0 4px" }), group);
    settingsGrid.append(heading);
    for (const [key, label] of Object.entries(fields)) {
      const field = textField(label, state.models[key]);
      field.input.onchange = () => {
        const original = DEFAULT_STATE.models[key];
        state.models[key] = typeof original === "number" ? Number(field.input.value) : field.input.value.trim();
        persist();
      };
      settingsGrid.append(field.wrap); modelFields[key] = field.input;
    }
  }
  settingsOverlay.append(settingsHead, settingsGrid); overlay.append(settingsOverlay);

  // Media help with model names and download locations
  const helpOverlay = el("div", { position: "absolute", inset: "0", zIndex: "9", display: "none", flexDirection: "column", gap: "10px", background: BG, padding: "12px 14px", boxSizing: "border-box", overflow: "auto" });
  const closeHelp = smallButton("Close");
  const helpHead = el("div", { display: "flex", alignItems: "center" });
  helpHead.append(tx(el("div", { color: LIME, fontWeight: "800", fontSize: "11px", flex: "1" }), "Media models and locations"), closeHelp);
  const helpBody = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" });
  const helpCard = (title, rows) => {
    const card = el("section", { border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "9px", background: PANEL, minWidth: "0" });
    card.append(tx(el("div", { color: "#ddd", fontSize: "10px", fontWeight: "800", marginBottom: "7px" }), title));
    for (const row of rows) {
      const line = el("div", { fontSize: "9px", color: "#aaa", margin: "5px 0", overflowWrap: "anywhere" });
      const link = el("a", { color: LIME, textDecoration: "none" }, { href: row.url, target: "_blank", rel: "noopener", textContent: row.name });
      line.append(link, tx(el("span"), ` -> ${row.path}`)); card.append(line);
    }
    return card;
  };
  helpBody.append(
    helpCard("LTX 2.3 video", [
      { name: "LTX-2.3 model files", url: "https://huggingface.co/Lightricks/LTX-2.3", path: "models/diffusion_models, vae, text_encoders" },
      { name: "LTX spatial upscaler", url: "https://huggingface.co/Lightricks/LTX-2", path: "models/latent_upscale_models" },
      { name: "LTX distilled LoRA", url: "https://huggingface.co/Lightricks/LTX-2", path: "models/loras" },
    ]),
    helpCard("Qwen3 CloneVoice", [
      { name: "Qwen3-TTS-12Hz-1.7B-Base", url: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base", path: "HuggingFace cache or local model path" },
      { name: "ComfyUI-Qwen3-TTS", url: "https://github.com/DarioFT/ComfyUI-Qwen3-TTS", path: "custom_nodes" },
    ]),
    helpCard("ACE-Step 1.5 Song", [
      { name: "acestep_v1.5_xl_turbo_bf16.safetensors", url: "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files", path: "models/diffusion_models" },
      { name: "qwen_0.6b_ace15 + qwen_1.7b_ace15", url: "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files", path: "models/text_encoders" },
      { name: "ace_1.5_vae.safetensors", url: "https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files", path: "models/vae" },
    ]),
    helpCard("Media handoff", [
      { name: "Gallery: Use as - I2V first frame", url: "#", path: "select any generated image" },
      { name: "CloneVoice/Song: Use in T2V or I2V", url: "#", path: "sets optional video audio" },
    ]),
  );
  helpOverlay.append(helpHead, helpBody); overlay.append(helpOverlay);

  const setStatus = (node, message, error = false) => { node.textContent = message; node.style.color = error ? "#ff6b6b" : "#888"; };
  const unloadToggles = [videoUnloadToggle, voiceUnloadToggle, songUnloadToggle];
  const refreshUnloadToggles = () => {
    const enabled = !!sharedState().unloadAfterGeneration;
    for (const toggle of unloadToggles) toggle.setOn(enabled);
  };
  const setGlobalUnload = enabled => {
    const shared = sharedState();
    shared.unloadAfterGeneration = !!enabled;
    localStorage.setItem(IMAGE_STATE_KEY, JSON.stringify(shared));
    window.dispatchEvent(new CustomEvent("one-node:unload-setting-changed", { detail: { enabled: !!enabled } }));
    refreshUnloadToggles();
  };
  for (const toggle of unloadToggles) toggle.onclick = () => setGlobalUnload(toggle.dataset.on !== "1");
  window.addEventListener("one-node:unload-setting-changed", refreshUnloadToggles);
  let voiceTemplates = [];
  const renderVoiceTemplates = (selectedName = voiceTemplateSelectField.input.value) => {
    voiceTemplateSelectField.input.replaceChildren(tx(el("option", {}, { value: "" }), "Choose template..."));
    for (const template of voiceTemplates) {
      voiceTemplateSelectField.input.append(tx(el("option", {}, { value: template.name }), template.name));
    }
    voiceTemplateSelectField.input.value = voiceTemplates.some(item => item.name === selectedName) ? selectedName : "";
    deleteVoiceTemplateButton.disabled = !voiceTemplateSelectField.input.value;
    deleteVoiceTemplateButton.style.opacity = voiceTemplateSelectField.input.value ? "1" : ".4";
  };
  const loadVoiceTemplates = async () => {
    try {
      const response = await api.fetchApi("/flux_klein/config");
      const config = await response.json();
      voiceTemplates = Array.isArray(config.voice_templates)
        ? config.voice_templates.filter(item => item && typeof item.name === "string" && item.name.trim())
        : [];
      renderVoiceTemplates();
    } catch (error) {
      setStatus(voiceStatus, `Could not load voice templates: ${error.message}`, true);
    }
  };
  const storeVoiceTemplates = async selectedName => {
    const response = await api.fetchApi("/flux_klein/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_templates: voiceTemplates }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `Template save HTTP ${response.status}`);
    renderVoiceTemplates(selectedName);
  };
  const refresh = () => {
    const active = overlay.style.display !== "none";
    setBaseContentHidden(active);
    for (const [mode, pill] of Object.entries(pills)) {
      const selected = active && state.mode === mode;
      pill.style.background = selected ? LIME : "#202020";
      pill.style.color = selected ? "#111" : "#bbb";
      pill.style.borderColor = selected ? LIME : BORDER;
      pill.style.fontWeight = selected ? "700" : "400";
    }
    const videoMode = state.mode === "t2v" || state.mode === "i2v";
    videoPanel.style.display = videoMode ? "grid" : "none";
    voicePanel.style.display = state.mode === "clonevoice" ? "grid" : "none";
    songPanel.style.display = state.mode === "song" ? "grid" : "none";
    if (videoMode) {
      videoHeaderLabel.textContent = `LTX 2.3 - ${state.mode.toUpperCase()}`;
      imageActions.style.display = state.mode === "i2v" ? "flex" : "none";
      clearImageButton.style.display = state.mode === "i2v" ? "block" : "none";
      imageFile.caption.textContent = state.imageLabel || state.imageName || "Upload first frame";
      audioFile.caption.textContent = state.audioLabel || state.audioName || "Optional audio";
      enhanceToggle.textContent = state.enhance[state.mode] ? "Enhance on" : "Enhance off";
      enhanceToggle.style.color = state.enhance[state.mode] ? LIME : "#aaa";
      reviewButton.disabled = !state.enhanced[state.mode];
      reviewButton.style.opacity = state.enhanced[state.mode] ? "1" : ".4";
      widthField.input.value = state.width[state.mode]; heightField.input.value = state.height[state.mode];
    }
    refAudioFile.caption.textContent = state.voice.refAudioLabel || state.voice.refAudioName || "Reference voice audio";
    refreshUnloadToggles();
    placeOverlay();
  };
  const openMode = mode => {
    state.mode = mode; overlay.style.display = "block"; settingsOverlay.style.display = "none"; helpOverlay.style.display = "none";
    for (const button of imagePills) {
      button.style.background = "#202020"; button.style.color = "#bbb";
      button.style.borderColor = BORDER; button.style.fontWeight = "400";
    }
    jsonPanel.style.display = "none"; promptTA.style.display = "block"; promptTA.value = state.prompt || "";
    persist(); refresh();
  };
  Object.entries(pills).forEach(([mode, pill]) => { pill.onclick = () => openMode(mode); });
  for (const button of imagePills) button.addEventListener("click", () => { overlay.style.display = "none"; refresh(); });

  const openSettings = () => { helpOverlay.style.display = "none"; settingsOverlay.style.display = "flex"; };
  const openHelp = () => { settingsOverlay.style.display = "none"; helpOverlay.style.display = "flex"; };
  settingsButton.onclick = voiceModelsButton.onclick = songModelsButton.onclick = openSettings;
  helpButton.onclick = voiceHelpButton.onclick = songHelpButton.onclick = openHelp;
  closeSettings.onclick = () => { settingsOverlay.style.display = "none"; };
  closeHelp.onclick = () => { helpOverlay.style.display = "none"; };

  voiceTemplateSelectField.input.onchange = () => {
    const template = voiceTemplates.find(item => item.name === voiceTemplateSelectField.input.value);
    if (!template) { voiceTemplateName.input.value = ""; renderVoiceTemplates(); return; }
    voiceTemplateName.input.value = template.name;
    state.voice.refText = String(template.refText || "");
    state.voice.refAudioName = String(template.refAudioName || "");
    state.voice.refAudioLabel = String(template.refAudioLabel || template.refAudioName || "");
    voiceRefText.value = state.voice.refText;
    persist(); refresh(); setStatus(voiceStatus, `Voice template "${template.name}" loaded`);
  };
  saveVoiceTemplateButton.onclick = async () => {
    const name = voiceTemplateName.input.value.trim();
    state.voice.refText = voiceRefText.value.trim();
    if (!name) { setStatus(voiceStatus, "Enter a template name", true); return; }
    if (!state.voice.refAudioName) { setStatus(voiceStatus, "Upload reference voice audio first", true); return; }
    if (!state.voice.refText) { setStatus(voiceStatus, "Enter the exact reference transcript first", true); return; }
    const template = { name, refText: state.voice.refText, refAudioName: state.voice.refAudioName, refAudioLabel: state.voice.refAudioLabel };
    const index = voiceTemplates.findIndex(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (index >= 0) voiceTemplates[index] = template; else voiceTemplates.push(template);
    voiceTemplates.sort((a, b) => a.name.localeCompare(b.name));
    try { await storeVoiceTemplates(name); persist(); setStatus(voiceStatus, `Voice template "${name}" saved`); }
    catch (error) { setStatus(voiceStatus, error.message, true); }
  };
  deleteVoiceTemplateButton.onclick = async () => {
    const name = voiceTemplateSelectField.input.value;
    if (!name || !window.confirm(`Delete voice template "${name}"?`)) return;
    voiceTemplates = voiceTemplates.filter(item => item.name !== name);
    try { await storeVoiceTemplates(""); voiceTemplateName.input.value = ""; setStatus(voiceStatus, `Voice template "${name}" deleted`); }
    catch (error) { setStatus(voiceStatus, error.message, true); }
  };

  window.addEventListener("one-node:settings-request", event => {
    if (overlay.style.display === "none") return;
    event.preventDefault(); openSettings();
  });
  window.addEventListener("one-node:main-overlay-open", () => { overlay.style.display = "none"; refresh(); });
  window.addEventListener("one-node:media-handoff", event => {
    const detail = event.detail || {};
    if (detail.kind !== "image" || detail.target !== "i2v") return;
    state.imageName = detail.name || detail.asset?.filename || "";
    state.imageLabel = detail.asset?.filename || state.imageName;
    persist(); openMode("i2v"); setStatus(videoStatus, "Gallery image selected as first frame");
  });

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

  const readSongContext = () => ({
    duration_seconds: clampFloat(songDuration.input.value, 1, 1000, 180),
    bpm: clampInt(songBpm.input.value, 10, 300, 120),
    language: songLanguage.input.value.trim() || "de",
    key: songKey.input.value.trim() || "E minor",
    time_signature: songTime.input.value,
    seed: clampInt(songSeed.input.value, 0, 999999999999999, 0),
  });
  const enhanceSongField = async (mode, input, button) => {
    const prompt = input.value.trim();
    if (!prompt) { setStatus(songStatus, mode === "song_lyrics" ? "Enter lyrics or lyric ideas first" : "Enter a music description first", true); return; }
    if (button.disabled) return;
    const originalLabel = button.textContent;
    button.disabled = true; button.style.opacity = ".55"; button.textContent = "Enhancing...";
    try {
      setStatus(songStatus, mode === "song_lyrics" ? "Enhancing lyrics with LM Studio..." : "Enhancing music description with LM Studio...");
      const response = await api.fetchApi("/flux_klein/enhance_prompt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt, mode, width: 1024, height: 1024, settings: llmSettingsPayload(),
          context: readSongContext(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.json_prompt) throw new Error(result.error || `Enhance HTTP ${response.status}`);
      const parsed = JSON.parse(result.json_prompt);
      const enhanced = String((mode === "song_lyrics" ? parsed.lyrics : parsed.music_description) || "").trim();
      if (!enhanced) throw new Error("LM Studio returned an empty enhanced text");
      input.value = enhanced;
      if (mode === "song_lyrics") state.song.lyrics = enhanced; else state.song.tags = enhanced;
      persist(); setStatus(songStatus, "Enhanced text ready - edit it if needed, then generate the song");
    } catch (error) { setStatus(songStatus, error?.message || String(error), true); }
    finally { button.disabled = false; button.style.opacity = "1"; button.textContent = originalLabel; }
  };
  songTagsEnhance.onclick = () => enhanceSongField("song_description", songTags, songTagsEnhance);
  songLyricsEnhance.onclick = () => enhanceSongField("song_lyrics", songLyrics, songLyricsEnhance);
  songEnhanceAllButton.onclick = async () => {
    const description = songTags.value.trim();
    const lyrics = songLyrics.value.trim();
    if (!description && !lyrics) { setStatus(songStatus, "Enter a music idea or lyric idea first", true); return; }
    if (songEnhanceAllButton.disabled) return;
    const originalLabel = songEnhanceAllButton.textContent;
    songEnhanceAllButton.disabled = true; songEnhanceAllButton.style.opacity = ".55"; songEnhanceAllButton.textContent = "Enhancing...";
    try {
      setStatus(songStatus, "Enhancing the complete song specification with LM Studio...");
      const response = await api.fetchApi("/flux_klein/enhance_prompt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `MUSIC DESCRIPTION NOTES:\n${description || "(not provided)"}\n\nLYRIC NOTES OR DRAFT:\n${lyrics || "(not provided)"}`,
          mode: "song_all", width: 1024, height: 1024, settings: llmSettingsPayload(), context: readSongContext(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.json_prompt) throw new Error(result.error || `Enhance HTTP ${response.status}`);
      const enhanced = JSON.parse(result.json_prompt);
      songTags.value = String(enhanced.music_description || "").trim();
      songLyrics.value = String(enhanced.lyrics || "").trim();
      if (!songTags.value || !songLyrics.value) throw new Error("LM Studio returned an incomplete song specification");
      songDuration.input.value = String(clampFloat(enhanced.duration_seconds, 1, 1000, 180));
      songBpm.input.value = String(clampInt(enhanced.bpm, 10, 300, 120));
      songLanguage.input.value = String(enhanced.language || "de").trim();
      songKey.input.value = String(enhanced.key || "E minor").trim();
      songTime.input.value = ["2", "3", "4", "6"].includes(String(enhanced.time_signature)) ? String(enhanced.time_signature) : "4";
      songSeed.input.value = String(clampInt(enhanced.seed, 0, 999999999999999, 0));
      Object.assign(state.song, {
        tags: songTags.value, lyrics: songLyrics.value,
        duration: Number(songDuration.input.value), bpm: Number(songBpm.input.value),
        language: songLanguage.input.value, keyscale: songKey.input.value,
        timesignature: songTime.input.value, seed: Number(songSeed.input.value),
      });
      persist(); setStatus(songStatus, "All song parameters enhanced - review or edit them, then generate");
    } catch (error) { setStatus(songStatus, error?.message || String(error), true); }
    finally { songEnhanceAllButton.disabled = false; songEnhanceAllButton.style.opacity = "1"; songEnhanceAllButton.textContent = originalLabel; }
  };

  const upload = async file => {
    const form = new FormData(); form.append("image", file, file.name); form.append("type", "input"); form.append("overwrite", "true");
    const response = await api.fetchApi("/upload/image", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || `Upload HTTP ${response.status}`);
    return result.subfolder ? `${result.subfolder}/${result.name}` : (result.name || file.name);
  };
  imageFile.input.onchange = async () => {
    const file = imageFile.input.files?.[0]; if (!file) return;
    try { setStatus(videoStatus, "Uploading first frame..."); state.imageName = await upload(file); state.imageLabel = file.name; persist(); refresh(); setStatus(videoStatus, "First frame ready"); }
    catch (error) { setStatus(videoStatus, `Image upload failed: ${error.message}`, true); }
  };
  audioFile.input.onchange = async () => {
    const file = audioFile.input.files?.[0]; if (!file) return;
    try { setStatus(videoStatus, "Uploading audio..."); state.audioName = await upload(file); state.audioLabel = file.name; persist(); refresh(); setStatus(videoStatus, "External audio ready"); }
    catch (error) { setStatus(videoStatus, `Audio upload failed: ${error.message}`, true); }
  };
  refAudioFile.input.onchange = async () => {
    const file = refAudioFile.input.files?.[0]; if (!file) return;
    try { setStatus(voiceStatus, "Uploading reference voice..."); state.voice.refAudioName = await upload(file); state.voice.refAudioLabel = file.name; persist(); refresh(); setStatus(voiceStatus, "Reference voice ready"); }
    catch (error) { setStatus(voiceStatus, `Reference upload failed: ${error.message}`, true); }
  };
  clearImageButton.onclick = () => { state.imageName = ""; state.imageLabel = ""; imageFile.input.value = ""; persist(); refresh(); };
  clearAudioButton.onclick = () => { state.audioName = ""; state.audioLabel = ""; audioFile.input.value = ""; persist(); refresh(); };
  galleryImageButton.onclick = () => {
    overlay.style.display = "none"; refresh();
    const gallery = [...root.querySelectorAll("button")].find(button => button.textContent.includes("Gallery"));
    gallery?.click();
  };

  let objectInfoCache = null;
  const validateGraph = async graph => {
    objectInfoCache ||= await (await api.fetchApi("/object_info")).json();
    const missing = [...new Set(Object.values(graph).map(node => node.class_type))].filter(name => !objectInfoCache[name]);
    if (missing.length) throw new Error(`Missing ComfyUI nodes: ${missing.join(", ")}`);
  };
  const findAsset = (output, kind) => {
    const keys = kind === "video" ? ["video", "videos", "gifs"] : ["audio", "audios"];
    for (const key of keys) {
      const raw = output?.[key];
      const item = Array.isArray(raw) ? raw[0] : raw;
      if (!item) continue;
      return typeof item === "string" ? { filename: item, subfolder: "", type: "output" } : item;
    }
    return null;
  };
  const waitForAsset = (promptId, saveId, kind) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error(`${kind} generation timed out`)); }, 7200000);
    const cleanup = () => { clearTimeout(timeout); api.removeEventListener("executed", executed); api.removeEventListener("execution_error", failed); };
    const executed = event => {
      const detail = event.detail || event;
      if (detail.prompt_id !== promptId || String(detail.node) !== saveId) return;
      const asset = findAsset(detail.output, kind); if (!asset) return;
      cleanup(); resolve(asset);
    };
    const failed = event => { const detail = event.detail || event; if (detail.prompt_id !== promptId) return; cleanup(); reject(new Error(detail.exception_message || detail.exception_type || `${kind} generation failed`)); };
    api.addEventListener("executed", executed); api.addEventListener("execution_error", failed);
  });
  const queueGraph = async (graph, saveId, kind) => {
    await validateGraph(graph);
    const queued = await api.fetchApi("/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph, client_id: api.clientId, extra_data: { enable_previews: true } }) });
    const result = await queued.json();
    if (!queued.ok || result.error || Object.keys(result.node_errors || {}).length) {
      const firstError = Object.values(result.node_errors || {})[0];
      throw new Error(result.error?.message || firstError?.errors?.[0]?.message || `Queue HTTP ${queued.status}`);
    }
    return waitForAsset(result.prompt_id, saveId, kind);
  };
  const importMedia = async asset => {
    const response = await api.fetchApi("/flux_klein/import_media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(asset) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `Import HTTP ${response.status}`);
    return result.name;
  };
  const maybeUnload = async () => {
    if (!sharedState().unloadAfterGeneration) return;
    await api.fetchApi("/free", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unload_models: true, free_memory: true }) });
  };
  const useAudioInVideo = mode => {
    if (!state.audioName) return;
    persist(); openMode(mode); setStatus(videoStatus, `${state.audioLabel || "Generated audio"} selected`);
  };
  voiceToT2V.onclick = () => useAudioInVideo("t2v"); voiceToI2V.onclick = () => useAudioInVideo("i2v");
  songToT2V.onclick = () => useAudioInVideo("t2v"); songToI2V.onclick = () => useAudioInVideo("i2v");

  generateVideoButton.onclick = async () => {
    if (generateVideoButton.disabled) return;
    state.prompt = promptTA.value.trim();
    state.width[state.mode] = clampInt(widthField.input.value, 256, 4096, state.width[state.mode]);
    state.height[state.mode] = clampInt(heightField.input.value, 256, 4096, state.height[state.mode]);
    state.fps = clampInt(fpsField.input.value, 1, 60, 24);
    state.duration = clampInt(durationField.input.value, 1, 120, 5);
    state.seed = clampInt(seedField.input.value, 0, 999999999999999, 0);
    if (!state.prompt) { setStatus(videoStatus, "Enter a video prompt", true); return; }
    if (state.mode === "i2v" && !state.imageName) { setStatus(videoStatus, "Choose a first frame", true); return; }
    persist(); generateVideoButton.disabled = true; generateVideoButton.style.opacity = ".55";
    try {
      let effectivePrompt = state.prompt;
      if (state.enhance[state.mode]) {
        setStatus(videoStatus, "Enhancing video prompt with LM Studio...");
        const response = await api.fetchApi("/flux_klein/enhance_prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: effectivePrompt, width: state.width[state.mode], height: state.height[state.mode], mode: state.mode, settings: llmSettingsPayload() }) });
        const result = await response.json();
        if (!response.ok || !result.ok || !result.json_prompt) throw new Error(result.error || `Enhance HTTP ${response.status}`);
        effectivePrompt = result.json_prompt; state.enhanced[state.mode] = effectivePrompt; persist(); refresh();
      }
      setStatus(videoStatus, "Preparing LTX workflow...");
      const prefix = state.mode === "t2v" ? "LTX:T2V" : "LTX:I2V";
      const endpoint = state.mode === "t2v" ? "/flux_klein/workflow_ltx_t2v" : "/flux_klein/workflow_ltx_i2v";
      const graph = await (await api.fetchApi(endpoint)).json();
      const width = Math.max(256, Math.round(state.width[state.mode] / 32) * 32);
      const height = Math.max(256, Math.round(state.height[state.mode] / 32) * 32);
      const frames = Math.max(9, Math.round((state.duration * state.fps - 1) / 8) * 8 + 1);
      const seed = state.seed || Math.floor(Math.random() * 9007199254740990) + 1;
      graph[`${prefix}:positive`].inputs.text = effectivePrompt;
      if (graph[`${prefix}:size`]?.inputs) Object.assign(graph[`${prefix}:size`].inputs, { width, height });
      if (state.mode === "i2v") { graph[`${prefix}:load_image`].inputs.image = state.imageName; Object.assign(graph[`${prefix}:resize`].inputs, { width, height }); }
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
      if (state.audioName) { graph["LTX:external_audio"] = { class_type: "LoadAudio", inputs: { audio: state.audioName }, _meta: { title: "External Audio" } }; graph[`${prefix}:create`].inputs.audio = ["LTX:external_audio", 0]; }
      setStatus(videoStatus, "LTX video is generating...");
      const asset = await queueGraph(graph, `${prefix}:save`, "video");
      video.src = mediaUrl(asset); video.load(); videoMeta.textContent = asset.subfolder ? `${asset.subfolder}/${asset.filename}` : asset.filename;
      setStatus(videoStatus, "Video ready"); await maybeUnload();
    } catch (error) { setStatus(videoStatus, error?.message || String(error), true); }
    finally { generateVideoButton.disabled = false; generateVideoButton.style.opacity = "1"; }
  };

  generateVoiceButton.onclick = async () => {
    if (generateVoiceButton.disabled) return;
    state.voice.text = voiceText.value.trim(); state.voice.refText = voiceRefText.value.trim();
    state.voice.language = voiceLanguage.input.value; state.voice.seed = clampInt(voiceSeed.input.value, 1, 999999999999999, 42);
    if (!state.voice.text) { setStatus(voiceStatus, "Enter text to speak", true); return; }
    if (!state.voice.refAudioName) { setStatus(voiceStatus, "Choose reference voice audio", true); return; }
    if (!state.voice.refText) { setStatus(voiceStatus, "Enter the exact reference transcript", true); return; }
    persist(); generateVoiceButton.disabled = true; generateVoiceButton.style.opacity = ".55";
    try {
      setStatus(voiceStatus, "Generating cloned voice...");
      const graph = await (await api.fetchApi("/flux_klein/workflow_clone_voice")).json();
      Object.assign(graph["VOICE:model"].inputs, { repo_id: state.models.voiceRepo, source: state.models.voiceSource, precision: state.models.voicePrecision, attention: state.models.voiceAttention, local_model_path: state.models.voiceLocalPath });
      graph["VOICE:reference"].inputs.audio = state.voice.refAudioName;
      Object.assign(graph["VOICE:clone"].inputs, { text: state.voice.text, seed: state.voice.seed, language: state.voice.language, ref_text: state.voice.refText, max_new_tokens: clampInt(state.models.voiceMaxTokens, 64, 8192, 2048), ref_audio_max_seconds: clampFloat(state.models.voiceRefSeconds, -1, 120, 30) });
      const asset = await queueGraph(graph, "VOICE:save", "audio");
      voiceAudio.src = mediaUrl(asset); voiceAudio.load(); voiceMeta.textContent = asset.subfolder ? `${asset.subfolder}/${asset.filename}` : asset.filename;
      state.audioName = await importMedia(asset); state.audioLabel = asset.filename; persist(); refresh();
      setStatus(voiceStatus, "Voice ready and available for video"); await maybeUnload();
    } catch (error) { setStatus(voiceStatus, error?.message || String(error), true); }
    finally { generateVoiceButton.disabled = false; generateVoiceButton.style.opacity = "1"; }
  };

  generateSongButton.onclick = async () => {
    if (generateSongButton.disabled) return;
    state.song.tags = songTags.value.trim(); state.song.lyrics = songLyrics.value.trim();
    state.song.duration = clampFloat(songDuration.input.value, 1, 1000, 180);
    state.song.bpm = clampInt(songBpm.input.value, 10, 300, 120);
    state.song.language = songLanguage.input.value.trim() || "de"; state.song.keyscale = songKey.input.value.trim() || "E minor";
    state.song.timesignature = songTime.input.value; state.song.seed = clampInt(songSeed.input.value, 0, 999999999999999, 0);
    if (!state.song.tags) { setStatus(songStatus, "Enter a music description", true); return; }
    persist(); generateSongButton.disabled = true; generateSongButton.style.opacity = ".55";
    try {
      setStatus(songStatus, "Generating ACE-Step song...");
      const graph = await (await api.fetchApi("/flux_klein/workflow_song")).json();
      const seed = state.song.seed || Math.floor(Math.random() * 9007199254740990) + 1;
      Object.assign(graph["SONG:model"].inputs, { unet_name: state.models.songUnet, weight_dtype: state.models.songWeightDtype });
      Object.assign(graph["SONG:clip"].inputs, { clip_name1: state.models.songClip1, clip_name2: state.models.songClip2, device: state.models.songDevice });
      graph["SONG:vae"].inputs.vae_name = state.models.songVae;
      graph["SONG:latent"].inputs.seconds = state.song.duration;
      Object.assign(graph["SONG:positive"].inputs, { tags: state.song.tags, lyrics: state.song.lyrics, seed, bpm: state.song.bpm, duration: state.song.duration, timesignature: state.song.timesignature, language: state.song.language, keyscale: state.song.keyscale, cfg_scale: clampFloat(state.models.songCfg, 0, 100, 2) });
      graph["SONG:sampling"].inputs.shift = clampFloat(state.models.songShift, 0, 100, 3.5);
      Object.assign(graph["SONG:sampler"].inputs, { seed, steps: clampInt(state.models.songSteps, 1, 10000, 50), cfg: clampFloat(state.models.songCfg, 0, 100, 2) });
      const asset = await queueGraph(graph, "SONG:save", "audio");
      songAudio.src = mediaUrl(asset); songAudio.load(); songMeta.textContent = asset.subfolder ? `${asset.subfolder}/${asset.filename}` : asset.filename;
      state.audioName = await importMedia(asset); state.audioLabel = asset.filename; persist(); refresh();
      setStatus(songStatus, "Song ready and available for video"); await maybeUnload();
    } catch (error) { setStatus(songStatus, error?.message || String(error), true); }
    finally { generateSongButton.disabled = false; generateSongButton.style.opacity = "1"; }
  };

  loadVoiceTemplates();
  refresh();
}

const scan = () => document.querySelectorAll(".fk-root").forEach(initMediaUI);
scan();
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
