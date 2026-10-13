# PumaApproach

**Air traffic control on a 1985 radar scope.** A remake of *Kennedy Approach… and Beyond* (Andy Hollis, MicroProse, 1985, Commodore 64), with Puma Air on the frequency.

## Play

[greykit.com/games/pumaapproach](https://greykit.com/games/pumaapproach/)

No install required. One HTML file, runs in any modern browser, nothing fetched at play time.

![The title screen, with traffic drifting under the sweep](screenshots/title.png)

![New York on a Morning shift: the flight-plan board, a thunderstorm moving in, and commands waiting to take hold](screenshots/scope.png)

## How it works

You are the approach controller. Every plane on the scope is yours until it lands at one of your airports or leaves through the fix on its flight plan. Keep them **3 miles or 1,000 feet apart**.

The scope is a grid of dots a mile apart. Each plane is an arrowhead on one of eight headings, a bar under it for every 1,000 feet, and its letter; its true place is the bottom bar. Planes change heading and height only at the dots, 45 degrees and 1,000 feet a mile, and fly straight and level until told otherwise.

- **Arrivals** enter at 5,000 feet, fly to the airport's VOR by themselves and hold. Stack them at different heights and clear them to land one at a time.
- **Overflights** must leave through their exit fix at exactly 4,000 feet.
- **Departures** wait on the flight-plan board for a heading and a height.
- Below 8 minutes of fuel a pilot declares an emergency. Thunderstorms, Denver's mountains below 4,000 feet, and Washington's restricted zone take planes down.

A command is heading and height together, sent with one click or `Enter`; height 0 is the landing clearance, as on the C64. Hold, takeoff and "say heading and altitude" are the rest of the vocabulary. The controller speaks every command and the pilot reads it back; a second command to the same plane replaces the first, with "correction" if the first was already on the air.

The pilot takes about four seconds to take a command in, then acts at the next dot after that. `L` (or Settings → Scope) picks the aids: **Learning**, the default, which rings the dot where each command will take hold and turns two planes amber one dot before they lose separation; or **Classic**, the 1985 scope, where the heading being set up runs from the plane's bottom bar and the buzzer is the first you hear of a conflict.

## Facilities and the career

Five facilities, in order of difficulty: Atlanta, Dallas-Ft.Worth, Denver, Washington D.C., New York. Five shifts: Trainee, Graveyard, Afternoon, Morning, Prime Time. Your rank, GS-7 to GS-13, sets which shift each facility gives you, by the original's table. The header counts the shift's conflict seconds and delay minutes as they happen. No crashes, no bad exits and under 30 seconds of conflict: promoted. A crash, a bad exit, over a minute of conflict or 45 minutes of delay: fired. A trainee is never fired.

Pay is $500 a rank plus $100 per flight completed, $200 per emergency landed, −$100 per minute of delay, as in the manual. **Puma** flights pay double, and a delayed Puma costs double.

Every shift is deterministic from its seed and your command log, so **Instant replay** shows it back exactly.

## The voice

The original spoke with Electronic Speech Systems' "Software Speech": a recorded human voice, cut into words, played back through the SID chip at four bits. PumaApproach does it the same way with its own words. `tools/voice/` holds the pipeline:

1. `words.txt` — the vocabulary, one `key|text` a line.
2. `say.ps1` — records each word with a Windows voice (Microsoft David, by default) to WAV.
3. `build.py` — trims, band-passes to a phone line, resamples to 8 kHz, quantises to 4 bits, packs two samples a byte, and writes the lot as base64 into the `@voice` block of `index.html`. `--preview` writes the processed words back out as WAVs to listen to.

```
powershell -ExecutionPolicy Bypass -File tools/voice/say.ps1 -Out /tmp/words
python -I tools/voice/build.py --wav-dir /tmp/words --out index.html
```

At play time the words are decoded into 8 kHz buffers and spliced with a short gap; the pilot's go through a band-pass and a little clipping, with a squelch click either side.

## Keys

One hand on the mouse, the other on the keys. Three layouts do the same things:

| | arrows | numpad | left hand |
|---|---|---|---|
| heading left, right | ← → | 4 6 | A D |
| height up, down | ↑ ↓ | 8 5 | W S |
| hold, left or right turns | [ ] | 7 9 | Q R |
| say heading and altitude | / | 0 | F |
| fast time, while held | Space or . | * | Space |

| Key | Action |
|---|---|
| Enter | send; at height 0 that is the landing clearance |
| Esc | cancel, deselect |
| L | scope aids: Learning or Classic |
| Tab, Shift+Tab | next plane down the board, or up |
| Shift+1…9 | bookmark the selected plane on that digit, RTS-style (Ctrl works too, where the browser leaves it alone) |
| 1…9 | select the plane on that digit |
| P, Pause | pause |
| M | sound |
| H | help |

## Tech

- One HTML file, vanilla JS and CSS, canvas for the scope
- The rules engine has no DOM in it; `node tools/sim-check.js` runs it headless against the separation, landing, exit, fuel, weather and pay rules, and checks that a replay reproduces a shift
- Web Audio for the effects; the voice is 4-bit PCM embedded in the file (about 130 KB)
- `localStorage` for the career, the career log, a shift in progress and settings, all under `pumaapproach_*`; Settings can forget everything
- Tactical look, the cyan-on-navy palette PumaRally, PumaCity and PumaPanic share

## Icons and the share card

`icon.svg` and `tools/og.svg` are the sources; the PNGs and `favicon.ico` are rendered from them and committed (games-meta STANDARD.md §9). `tools/render-icons.sh` does it with rsvg-convert and Pillow. The GitLab project avatar is a copy of `apple-touch-icon.png`, so upload that again after a change:

```bash
glab api --method PUT projects/greykit-app%2Fgames%2Fpumaapproach --form "avatar=@apple-touch-icon.png"
```

## Other Puma games

- [PumaPanic](https://greykit.com/games/pumapanic/) — cyber tower-defense card game
- [PumaCity](https://greykit.com/games/pumacity/) — trading game
- [PumaTower](https://greykit.com/games/pumatower/) — network tower defense

## Credits

Game design and code by [shandower](https://gitlab.com/shandower) with AI assistance from Claude.

After Kennedy Approach by Andy Hollis, MicroProse, 1985. Not affiliated with MicroProse; no code, art or audio from the original is used.
