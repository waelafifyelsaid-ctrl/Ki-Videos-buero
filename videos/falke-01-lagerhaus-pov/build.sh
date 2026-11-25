#!/usr/bin/env bash
# Baut final.mp4 komplett neu: Frames parallel rendern (Cairo), Ton erzeugen (numpy), zusammenfügen.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p tmp
FPS=30; FRAMES=$(python3 -c "import animation as a; print(int(a.DAUER*a.FPS))")
TEILE=${TEILE:-$(nproc)}
python3 animation.py ton tmp/ton.wav &
pids=()
for k in $(seq 0 $((TEILE-1))); do
  a=$((FRAMES*k/TEILE)); b=$((FRAMES*(k+1)/TEILE))
  ( python3 animation.py frames $a $b | ffmpeg -y -loglevel error -f rawvideo -pix_fmt bgra -s 1080x1920 -r $FPS -i - \
      -c:v libx264 -preset veryfast -crf 19 -pix_fmt yuv420p tmp/teil$k.mp4 ) &
  pids+=($!)
done
for p in "${pids[@]}"; do wait $p; done
wait
: > tmp/liste.txt
for k in $(seq 0 $((TEILE-1))); do echo "file 'teil$k.mp4'" >> tmp/liste.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i tmp/liste.txt -i tmp/ton.wav \
  -map 0:v -map 1:a -c:v libx264 -preset medium -crf 23 -maxrate 4M -bufsize 8M -pix_fmt yuv420p -c:a aac -b:a 160k -ar 44100 -ac 2 -shortest -movflags +faststart final.mp4
echo "Fertig: final.mp4"
