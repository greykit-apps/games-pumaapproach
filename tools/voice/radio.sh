#!/bin/sh
# radio.sh -- record the boot's transmission with a macOS voice and write it
# into index.html's @radio block. One phrase, said whole: a pilot far off on
# Kansas City Center's frequency, not a word of the game's own vocabulary.
#   sh tools/voice/radio.sh [voice] [rate]      (Samantha, 200 words a minute)
# "Puma" is respelled "Pooma", as in words.txt.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
voice=${1:-Samantha}
rate=${2:-200}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
say -v "$voice" -r "$rate" --file-format=WAVE --data-format=LEI16@22050 -o "$tmp/radio.wav" \
  "Kansas City Center, Pooma Airlines thirty-one three-thirty-seven, with you."
python3 "$here/build.py" --radio "$tmp/radio.wav" --out "$here/../../index.html" ${PREVIEW:+--preview "$PREVIEW"}
