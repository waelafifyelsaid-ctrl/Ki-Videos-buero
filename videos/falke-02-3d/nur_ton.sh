#!/usr/bin/env bash
# Baut nur die Tonspur neu (Musik/Stimmen/Geräusche) und legt sie unter die vorhandenen gerenderten Bilder.
set -euo pipefail
cd "$(dirname "$0")"
python3 timeline.py >/dev/null
python3 ton.py tmp/ton.wav
ffmpeg -y -loglevel error -f concat -safe 0 -i tmp/liste.txt -i tmp/ton.wav -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 21 -maxrate 6M -bufsize 12M -pix_fmt yuv420p -c:a aac -b:a 192k -ac 2 -shortest -movflags +faststart final.mp4
echo "Fertig: final.mp4"
