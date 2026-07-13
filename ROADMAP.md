# Multimedia Roadmap

The image modes remain the stable core of this fork. The following modes were evaluated from a larger local ComfyUI workflow but are not included in the first public release:

## CloneVoice

Planned around `Qwen3Loader`, `Qwen3VoiceClone`, `LoadAudio`, and `SaveAudioMP3` from ComfyUI-Qwen3-TTS. A portable UI needs spoken text, a reference recording, its transcript, language, seed, and model controls. Spoken text must not be rewritten by the image prompt enhancer.

## Song

Planned around the ComfyUI-native ACE-Step 1.5 nodes. A portable UI needs separate tags and lyrics fields plus duration, BPM, time signature, language, key, seed, and model selection. The source workflow used frontend group nodes, so the public implementation must use normal executable nodes instead.

## Text2Video and Image2Video

Implemented in the main full-screen interface. The public API workflows were rebuilt from separate LTX 2.3 source workflows and contain no local media filenames, frontend Get/Set nodes, rgthree controls, or embedded preview history. Missing video dependencies are checked only when a video is requested, so the FLUX image modes continue to work without them.

Future video work may add multi-shot LTX Director timelines and audio-driven lip synchronization. External audio in the current release replaces the generated soundtrack during final muxing; it is not yet used as a motion or lip-sync conditioning signal.
