# Developing Puma Approach

## Tech

- One HTML file, vanilla JS and CSS, canvas for the scope, nothing fetched at play time
- The rules engine has no DOM in it; `node tools/sim-check.js` runs it headless against the separation, landing, exit, fuel, weather and pay rules, and checks that a replay reproduces a shift
- Web Audio for the effects; the voice is 4-bit PCM embedded in the file (about 130 KB)
- `localStorage` for the career, the career log, a shift in progress and settings, all under `pumaapproach_*`; Settings can forget everything
- Tactical look, the cyan-on-navy palette PumaRally, PumaCity and PumaPanic share

## The voice

The original spoke with Electronic Speech Systems' "Software Speech": a recorded human voice, cut into words, played back through the SID chip at four bits. Puma Approach does it the same way with its own words. `tools/voice/` holds the pipeline:

1. `words.txt` — the vocabulary, one `key|text` a line.
2. `say.ps1` — records each word with a Windows voice (Microsoft David, by default) to WAV.
3. `build.py` — trims, band-passes to a phone line, resamples to 8 kHz, quantises to 4 bits, packs two samples a byte, and writes the lot as base64 into the `@voice` block of `index.html`. `--preview` writes the processed words back out as WAVs to listen to.

```
powershell -ExecutionPolicy Bypass -File tools/voice/say.ps1 -Out /tmp/words
python -I tools/voice/build.py --wav-dir /tmp/words --out index.html
```

At play time the words are decoded into 8 kHz buffers and spliced with a short gap, the controller clean, each pilot through a radio of their own: a pitch, a band and a clip drawn from the callsign, so a pilot sounds the same all shift, with a squelch click either side. The pace follows the frequency: quiet, the words play as recorded; as lines back up and the scope fills it steps up (`PACES`, to 1.24×), each word time-compressed with its pitch kept, until everyone talks at the clip of the quick stock phrases (`contact center`, `good day`).

## The boot's transmission and the title's music

As the boot plays, a pilot checks in with Kansas City Center: one phrase, recorded whole rather than spliced, through the same ESS chain into the `@radio` block. It is the one recording made on a Mac (`say`, Samantha by default), since it is a voice from off the scope rather than the game's own:

```
sh tools/voice/radio.sh [voice] [rate]
```

`PREVIEW=<dir>` writes the processed phrase out as `radio.wav` too. A key or click that skips the boot fades it out; left alone it runs on over the title. The title's music is a step sequencer after PumaCity: Watchers' title (`MUSIC` in `index.html`): starting with the boot, 0.4 s ahead of the pilot: bass alone for four bars, then pad, hats, a radar ping and a kick, ducked under the pilot while the pilot is still talking. Sound off silences both, and Voice off silences the pilot. A browser that will not play before a key or click is never heard to say the transmission (that key skips the boot); the music waits for the first key or click, which skips the boot.

## Icons and the share card

`icon.svg` and `tools/og.svg` are the sources; the PNGs and `favicon.ico` are rendered from them and committed (games-meta STANDARD.md §9). `tools/render-icons.sh` does it with rsvg-convert and Pillow. The GitLab project avatar is a copy of `apple-touch-icon.png`, so upload that again after a change:

```bash
glab api --method PUT projects/greykit-app%2Fgames%2Fpumaapproach --form "avatar=@apple-touch-icon.png"
```
