#!/usr/bin/env bash
# Baut final.mp4: Timeline berechnen -> 3D-Frames (Headless-Chromium, parallel) -> Ton -> zusammenfügen.
set -euo pipefail
cd "$(dirname "$0")"
REPO=$(cd ../.. && pwd)
[ -d "$REPO/tools/node_modules/three" ] || (cd "$REPO/tools" && npm install)
python3 timeline.py
DAUER=$(python3 -c "import json;print(json.load(open('timeline_fertig.json'))['dauer'])")
mkdir -p tmp
(cd "$REPO/tools" && node render3d.js video videos/falke-01-3d/index.html "$DAUER" "${WORKER:-4}" "$REPO/videos/falke-01-3d/tmp")
python3 ton.py tmp/ton.wav
ffmpeg -y -loglevel error -f concat -safe 0 -i tmp/liste.txt -i tmp/ton.wav -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 21 -maxrate 6M -bufsize 12M -pix_fmt yuv420p -c:a aac -b:a 160k -ac 2 -shortest -movflags +faststart final.mp4
echo "Fertig: final.mp4"
