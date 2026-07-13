# One Node · FLUX.2 [klein]

> Enhanced community fork of [yanokusnir-ai/one-node-flux-2-klein](https://github.com/yanokusnir-ai/one-node-flux-2-klein). The original interface, workflows, and project direction are by Yan Kusnir. This fork adds optional local-LLM prompt enhancement, prompt review and reuse, GPU unloading, and a distraction-free full-screen WebUI.

A ComfyUI custom node that wraps the full FLUX.2 [klein] workflow into a single self-contained UI widget. No graph to build, no spaghetti wires to connect, just one powerful node with everything inside.

> *One Node to rule them all, One Node to find them,*
> *One Node to bring them all, and in ComfyUI bind them.*
>
> *— J.R.R. Tolkien, probably, if he used ComfyUI*

![One Node · FLUX.2 [klein]](assets/one-node-flux-2-klein.gif)

---

## Tutorial

[![Watch the tutorial](https://img.youtube.com/vi/L4ItbBWXqCo/maxresdefault.jpg)](https://youtu.be/L4ItbBWXqCo)

▶ [Watch on YouTube](https://youtu.be/L4ItbBWXqCo)

▶ [See the latest update](https://youtu.be/Vsp1tDFipHE)

The node has been updated since the tutorial was recorded - check the [Changelog](#changelog) for new features.

---

## What it does

The node has 10 modes, switchable with a single click:

**T2I** - standard text to image generation.

**I2I** - good for creating variations or gently nudging an image in a different direction.

**EDIT** - load one or two reference images and describe the change.

**PAINT** - three tools in one:
- Sketch: a full canvas with layers, brushes, shapes and more. Draw something and generate from it.
- Inpaint: paint a mask over the area you want to change, write what should be there instead.
- Outpaint: expand the image in any direction by dragging the edges.

**FACESWAP** - swap a face from a source image onto a target. Requires a Faceswap LoRA.

**POSE** - copy the pose from one image onto the character from a reference image. Requires the DWPose preprocessor node and a RefControl pose LoRA (a 9B LoRA only for now).

**T2V** - generate an LTX 2.3 video with generated audio from a text prompt.

**I2V** - animate an uploaded or Gallery-selected first frame with LTX 2.3 while preserving its visual identity and composition.

**CloneVoice** - clone a reference voice with Qwen3-TTS and generate reusable speech audio.

**Song** - generate a complete song from music tags and lyrics with ACE-Step 1.5.

### Enhancements in this fork

- Optional prompt enhancement through any OpenAI-compatible local server such as LM Studio.
- Mode-aware instructions for T2I, I2I, Edit, Inpaint, Outpaint, Faceswap, and Pose.
- Short notes are expanded into structured JSON prompts with normalized and pixel-space composition regions.
- The generated JSON can be reviewed, edited, and reused without another LLM call.
- Optional model unloading after each completed generation.
- A full-screen WebUI at `/one-node`, without the normal ComfyUI canvas and toolbars.
- Integrated LTX 2.3 T2V and I2V panels with two-pass sampling, spatial latent upscaling, generated or external audio, and video preview.
- Integrated Qwen3 CloneVoice and ACE-Step Song panels with audio preview and direct T2V/I2V handoff.
- Gallery and image-preview actions can send any generated image directly to the I2V first-frame slot.
- LLM connection data is stored in the browser. This repository contains no personal server address, model name, or API key.

---

## Installation

Clone this repo into your ComfyUI `custom_nodes` folder:

```
git clone https://github.com/ProfEngel/one-node-flux-2-klein.git
```

You need one additional custom node for inpaint and outpaint modes:
[ComfyUI-Inpaint-CropAndStitch](https://github.com/lquesada/ComfyUI-Inpaint-CropAndStitch) by lquesada. Just clone it into the same folder:

```
git clone https://github.com/lquesada/ComfyUI-Inpaint-CropAndStitch.git
```

For POSE mode you also need [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux) by Fannovel16, which provides the DWPose preprocessor. On the Windows portable build, run these two commands from your `ComfyUI_windows_portable` folder, one after the other:

```
git clone https://github.com/Fannovel16/comfyui_controlnet_aux ComfyUI/custom_nodes/comfyui_controlnet_aux
```

```
python_embeded\python.exe -s -m pip install -r ComfyUI/custom_nodes/comfyui_controlnet_aux/requirements.txt
```

On other setups (venv, ComfyUI Desktop, Linux/Mac), follow the install instructions in the [comfyui_controlnet_aux readme](https://github.com/Fannovel16/comfyui_controlnet_aux#installation).

Restart ComfyUI. The node appears as **One Node · FLUX.2 [klein]**.

### Full-screen WebUI

After ComfyUI has started, open:

```text
http://127.0.0.1:8188/one-node
```

Replace `8188` if your ComfyUI instance uses another port. The regular canvas remains available at the normal ComfyUI URL.

### Local prompt enhancement with LM Studio

1. Start LM Studio and load an instruction-tuned model.
2. Start its local OpenAI-compatible server.
3. Open OneNode Settings and enter the server URL, normally `http://127.0.0.1:1234`.
4. Leave Model empty to use the first model currently loaded in LM Studio, or enter an exact model ID.
5. Edit the System Prompt when you want different prompt-writing behavior.
6. Enable **Enhance** for the current mode.

OneNode appends a mode contract to your editable system prompt. For example, Faceswap keeps image 1 as the target scene and uses image 2 only for facial identity, while Inpaint restricts changes to the mask. The LLM response is validated as JSON and repaired once when a model returns malformed JSON.

Use **View JSON** to inspect or edit the latest enhanced prompt. **Use without Enhance** places that JSON in the prompt field and disables the next LLM call.

Enable **Unload** when ComfyUI should release loaded models and GPU memory after the generated result has been handed to the next node.

### LTX 2.3 video modes

T2V and I2V appear beside Pose in the OneNode header. Their **Models** panel contains all model filenames and stores changes locally in the browser. The public defaults match the supplied LTX 2.3 GGUF workflows but can be changed without editing workflow JSON.

Both modes expose output size, frame rate, duration, and seed. A seed of `0` generates a random seed. Frame counts are adjusted to the temporal layout required by LTX. I2V requires a first-frame image, which can be uploaded, selected from Gallery, or sent from the current image preview. Optional audio replaces the model-generated soundtrack in the final video container.

Prompt Enhance uses a dedicated LTX JSON schema with shot, motion, camera, lighting, audio, continuity, and avoid fields. **Review JSON** displays the latest enhanced prompt, and **Use without Enhance** reuses it without another LLM request.

The video workflows require a current ComfyUI build with the native LTX nodes plus:

- [ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)
- [ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes)

The default model filenames are:

- Diffusion model: `ltx-2.3-22b-distilled-Q4_K_M.gguf`
- Text encoder: `gemma-3-12b-it-qat-UD-Q4_K_XL.gguf`
- Connector: `ltx-2.3-22b-dev_embeddings_connectors.safetensors`
- Video VAE: `ltx-2.3-22b-dev_video_vae.safetensors`
- Audio VAE: `ltx-2.3-22b-dev_audio_vae.safetensors`
- Spatial upscaler: `ltx-2.3-spatial-upscaler-x2-1.0.safetensors`
- T2V LoRA: `ltx2.3/ltx-2.3-22b-distilled-lora-dynamic_fro09_avg_rank_105_bf16.safetensors`
- I2V LoRA: `ltx2.3/ltx-2.3-22b-distilled-lora-dynamic_fro09_avg_rank_105_bf16.safetensors`

### CloneVoice

CloneVoice uses [ComfyUI-Qwen3-TTS](https://github.com/DarioFT/ComfyUI-Qwen3-TTS). Enter the text to speak, upload a clean reference recording, and provide the exact transcript of that recording. The default model is `Qwen/Qwen3-TTS-12Hz-1.7B-Base`; it can be loaded from HuggingFace or from a local model path configured in Media Models.

Every generated voice is saved as MP3, previewed in OneNode, copied into ComfyUI input storage, and made immediately available through **Use in T2V** and **Use in I2V**.

### Song

Song uses ComfyUI's ACE-Step 1.5 nodes. It provides separate fields for music description and lyrics, plus duration, BPM, language, key, time signature, and seed. The default model files are:

- Diffusion model: `acestep_v1.5_xl_turbo_bf16.safetensors`
- Text encoders: `qwen_0.6b_ace15.safetensors` and `qwen_1.7b_ace15.safetensors`
- VAE: `ace_1.5_vae.safetensors`

The files are available from [Comfy-Org/ace_step_1.5_ComfyUI_files](https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files). Generated songs are saved as MP3 and can be passed directly to either video mode.

The top-level **Settings** button opens context-specific Media Models while T2V, I2V, CloneVoice, or Song is active. The media Help page and the main Help page list the required filenames and download locations.

---

## Models

This node works with any FLUX.2 [klein] model officially released by Black Forest Labs.

You will find all officially released FLUX.2 [klein] models on the [Black Forest Labs HuggingFace page](https://huggingface.co/collections/black-forest-labs/flux2). Pick the variant that fits your VRAM and use case. You will need a diffusion model, a matching text encoder, and the VAE.

The Faceswap LoRA is required for the Faceswap mode, and the Pose LoRA for the POSE mode. The BiRefNet model is optional, only needed for the Remove Background feature in PAINT mode.

**Text encoder** (place in `models/text_encoders/`)
- [qwen_3_8b for 9b models](https://huggingface.co/Comfy-Org/vae-text-encorder-for-flux-klein-9b/tree/main/split_files/text_encoders)
- [qwen_3_4b for 4b model](https://huggingface.co/Comfy-Org/vae-text-encorder-for-flux-klein-4b/tree/main/split_files/text_encoders)

**VAE** (place in `models/vae/`)
- [flux2-vae](https://huggingface.co/Comfy-Org/vae-text-encorder-for-flux-klein-9b/tree/main/split_files/vae)

**Faceswap LoRA** (place in `models/loras/`)
- [BFS Head Swap v1 (9b)](https://huggingface.co/Alissonerdx/BFS-Best-Face-Swap/blob/main/bfs_head_v1_flux-klein_9b_step3500_rank128.safetensors)
- [BFS Head Swap v1 (4b)](https://huggingface.co/Alissonerdx/BFS-Best-Face-Swap/blob/main/bfs_head_v1_flux-klein_4b.safetensors)

**Pose LoRA** (place in `models/loras/`) — for POSE mode
- [RefControl v2 Poses (9b)](https://huggingface.co/thedeoxen/refcontrol-FLUX.2-klein-9B-reference-pose-lora/blob/main/refcontrol_v2_poses.safetensors)

**Remove Background** (place in `models/background_removal/`)
- [birefnet](https://huggingface.co/Comfy-Org/BiRefNet/tree/main/background_removal)

---

## License note on FLUX.2 [klein] 9B

This node works with both the 4B and 9B variants of FLUX.2 [klein]. The 4B model is released under Apache 2.0 and can be used freely including commercially.

The 9B model is released under the **FLUX Non-Commercial License** by Black Forest Labs. This means you can use it for personal and research purposes, but commercial use is not permitted. If you use the 9B model, you are responsible for complying with that license.

This repository is a GitHub fork of the upstream project. At the time this fork was prepared, the upstream repository did not contain a formal software license file. The upstream author retains rights to the original work; contributors retain rights to their additions. Do not assume a permissive software license until the upstream project publishes one.

---

## Support

If you find this useful and want to support further development:

[buymeacoffee.com/yanokusnir](https://buymeacoffee.com/yanokusnir)

Thanks. Now go make something cool. :)

---

Built with the help of [Claude](https://claude.ai) by Anthropic.

Fork enhancements were developed with OpenAI Codex. See [ROADMAP.md](ROADMAP.md) for the status of optional audio and video modes.

---

## Changelog

### July 13, 2026 - Enhanced fork

- Added optional OpenAI-compatible local-LLM prompt enhancement.
- Added mode-aware prompt contracts for every image workflow, including separate Inpaint and Outpaint behavior.
- Added strict JSON output, malformed-response repair, normalized regions, and pixel-space bounding boxes.
- Added prompt review, editing, and reuse without another LLM call.
- Added optional model unloading after generation.
- Added the distraction-free `/one-node` full-screen WebUI.
- Added integrated LTX 2.3 T2V and I2V modes with optional external audio.
- Removed machine-specific LLM defaults and added automatic loaded-model discovery.
- Added attribution, installation guidance, and the optional multimedia roadmap.

### July 4, 2026

**Reference-guided inpainting**

The inpaint editor now has an optional reference image slot in the top right. Drop an image in and the model uses it to fill the masked area, so you can paint an object, an outfit, or a face straight into a specific spot. Everything outside your mask stays untouched. Leave the slot empty and inpaint works exactly as before. You can also paste a reference straight in with Ctrl+V while the editor is open.

**Batch generation**

Generate up to 4 images in a single run. Works in Text to Image, Image to Image, Edit, Faceswap and Pose. Inpaint and Outpaint run one image at a time, because of how the result is merged back into the original.

**Node output and prompt input**

The node now has an image output, so your result can flow into the rest of your graph, like an upscaler or any other node. It also has a prompt input, so you can feed it a prompt from another node.

**Set image as output from the gallery**

Open any image in the gallery and push it to the node's output with the new "Set as output" button.

**Auto-save toggle**

You can now turn off auto-save. When it's off, results show up as a preview first and you hit Save to keep only the ones you want.

**Canvas-like zoom and pan**

Scroll to zoom and middle-mouse drag to pan while hovering over the node, just like the rest of the ComfyUI canvas.

---

### June 26, 2026

**New POSE mode**

Copy the pose from one image onto the character from a reference image. A DWPose skeleton drives the pose while the reference image drives the appearance, through a RefControl pose LoRA. Requires the comfyui_controlnet_aux node and a RefControl pose LoRA, see the Installation and Models sections.

**Bigger preview layout**

A new layout toggle in the top bar (just right of the Settings button) moves the prompt into the sidebar so the preview window gets the full height, which is handy for portrait images. The classic wide-prompt layout stays the default.

**Keep GGUF connected when toggling External Models off**

The External Models toggle is now the single source of truth. Turning it off keeps your external loader wired but uses the internal dropdowns, so you can switch between the built-in models and an external setup without reconnecting anything.

**Per-slot LoRA on/off toggle**

Each LoRA slot now has a switch, so you can deactivate a LoRA while keeping it loaded, without losing its strength value. This replaces the old per-slot clear button. Thanks to @triatomic for the contribution.

**Paint shortcuts and inpaint marquee**

`[` and `]` change the brush size in the Sketch editor (`{` / `}` for bigger steps), and the inpaint mask editor gains a rectangle marquee tool (`R`) for masking a rectangular area. Thanks to @triatomic.

**Outpaint seam feather**

A Seam feather slider in the outpaint editor controls how far the mask fades into the original, so you can soften visible seams. Defaults to Auto (the previous behaviour).

**More reliable LoRA strength drag**

The drag-to-scrub on LoRA strength now works consistently, including fast flicks and drags started near the edge of the field. Thanks to @triatomic.

---

### June 23, 2026

**More LoRA slots**

The LoRA panel now starts with 3 slots and you can add up to 6 with the "+ Add slot" button (and remove extras with "Remove last slot"). The panel was also redesigned to be cleaner, with collapsible trigger words and a scrollable list.

**Downscale reference images (new Settings option)**

Added a toggle in Settings to downscale input images before they enter the model, for EDIT and Sketch modes. Lower MP means faster generation and lower VRAM, which helps avoid out-of-memory freezes on large images. On by default at 1 MP (matching the previous behaviour); turn it off for maximum fidelity when your GPU can handle the full resolution.

**Custom prompts and settings now survive reinstalls**

Your custom Discover prompts, LoRA trigger words and T2I templates are now stored in the ComfyUI user folder instead of inside the node folder, so they are no longer lost when you update or reinstall the node.

**Paste in Paint mode**

You can now paste an image from your clipboard while the Sketch canvas is open, and it drops in as a new layer.

**Drag to change LoRA strength**

Click and drag horizontally on a LoRA strength value to scrub it, just like native ComfyUI nodes. Clicking still lets you type a value, and the whole number is selected on focus.

**Symlinked model folders are now detected**

The model scanner now follows symbolic links, so LoRAs and other models stored on another drive via symlinks are correctly picked up.

---

### June 22, 2026

**Paste from clipboard**

You can now paste images directly from your clipboard (Ctrl+V) while hovering over the node. In Edit and Faceswap mode the image goes into the first empty slot, then the second if the first is already taken.

**Sketch improvements**

- Added fullscreen mode - hit the expand button in the Sketch toolbar to go fullscreen.
- Brush size limit increased from 200 to 500px.
- Added aspect ratio lock button next to the canvas size inputs.

**Gallery right-click**

Right-clicking any thumbnail in the gallery grid now shows a quick "Use as..." context menu.

---

### June 20, 2026

**Negative LoRA strength**

LoRA strength now accepts negative values - useful for concept sliders and suppressing specific styles or features.

---

### June 19, 2026

**External loaders (GGUF support)**

The node now has optional model, clip, and VAE input slots. Enable them in Settings under "External model/clip/vae inputs" and connect any loader you want - including GGUF. When a loader is connected, the corresponding dropdown in Settings is automatically dimmed.

![External loaders](assets/support_for_external_loaders.png)

**Refresh models**

Added a "↻ Refresh models" button in Settings and in the Add LoRA panel. No more restarting ComfyUI after adding new models or LoRAs to your ComfyUI directories - just hit the button.

**Tablet and pen support**

The Sketch canvas now supports tablet input. Pen pressure controls brush size automatically.

---

### June 18, 2026

Initial release.
