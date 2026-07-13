# Multimedia Roadmap

The image modes remain the stable core of this fork. The multimedia modes below are now integrated into the full-screen interface.

## CloneVoice

Implemented with `Qwen3Loader`, `Qwen3VoiceClone`, `LoadAudio`, and `SaveAudioMP3` from ComfyUI-Qwen3-TTS. The UI includes spoken text, reference recording, exact transcript, language, seed, and model controls. Generated speech can be sent directly to T2V or I2V.

## Song

Implemented with normal executable ACE-Step 1.5 nodes rather than frontend subgraphs. The UI includes separate tags and lyrics fields plus duration, BPM, time signature, language, key, seed, and model selection. Generated songs can be sent directly to T2V or I2V.

## Text2Video and Image2Video

Implemented in the main full-screen interface. The public API workflows were rebuilt from separate LTX 2.3 source workflows and contain no local media filenames, frontend Get/Set nodes, rgthree controls, or embedded preview history. Missing video dependencies are checked only when a video is requested, so the FLUX image modes continue to work without them.

Future video work may add multi-shot LTX Director timelines and audio-driven lip synchronization. External audio in the current release replaces the generated soundtrack during final muxing; it is not yet used as a motion or lip-sync conditioning signal.
