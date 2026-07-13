# Multimedia Roadmap

The image modes remain the stable core of this fork. The following modes were evaluated from a larger local ComfyUI workflow but are not included in the first public release:

## CloneVoice

Planned around `Qwen3Loader`, `Qwen3VoiceClone`, `LoadAudio`, and `SaveAudioMP3` from ComfyUI-Qwen3-TTS. A portable UI needs spoken text, a reference recording, its transcript, language, seed, and model controls. Spoken text must not be rewritten by the image prompt enhancer.

## Song

Planned around the ComfyUI-native ACE-Step 1.5 nodes. A portable UI needs separate tags and lyrics fields plus duration, BPM, time signature, language, key, seed, and model selection. The source workflow used frontend group nodes, so the public implementation must use normal executable nodes instead.

## Text2Video and Image2Video

The evaluated LTX 2.3 graph depends on GGUF loaders, KJNodes, WhatDreamsCost LTX Director nodes, an unload node, two LoRAs, separate video and audio VAEs, and a latent upscaler. Its timeline JSON also contained local image and audio filenames. Those values are intentionally excluded from this repository.

A public video module should:

- keep T2V, I2V, and optional audio conditioning as separate validated paths;
- discover or explicitly configure every required model instead of embedding one machine's filenames;
- upload reference images and audio through ComfyUI's input API;
- construct clean LTX Director timeline data at runtime;
- expose output duration, frame rate, dimensions, guide strength, and audio behavior;
- declare every optional custom-node dependency and fail with a useful message;
- be tested on a clean ComfyUI installation before release.

The multimedia work should be delivered as a separate feature branch or optional companion extension so that missing audio or video dependencies cannot break the FLUX image node.
