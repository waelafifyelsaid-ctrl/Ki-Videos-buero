#!/usr/bin/env bash
# Baut final.mp4 komplett neu aus szenen.py (+ stimme.mp3, falls vorhanden).
set -euo pipefail
cd "$(dirname "$0")"
python3 szenen.py
DAUER=(2.5 4 3.5 3.5 3.5 3.5 4 3.5)   # Sekunden pro Szene
UEB=0.3                                # Überblendung
FPS=30
for i in "${!DAUER[@]}"; do
  n=$((i+1)); d=${DAUER[$i]}; fr=$(python3 -c "print(round($d*$FPS))")
  if [ "$n" = 1 ]; then  # Hook: schneller Zoom + Wackeln
    zp="zoompan=z='1.0+0.06*on/$fr':x='iw/2-(iw/zoom/2)+12*sin(on*1.3)':y='ih/2-(ih/zoom/2)+12*cos(on*1.7)':d=$fr:s=1080x1920:fps=$FPS"
  elif [ $((n%2)) = 0 ]; then  # sanft rein
    zp="zoompan=z='1.0+0.05*on/$fr':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$fr:s=1080x1920:fps=$FPS"
  else  # sanft raus
    zp="zoompan=z='1.05-0.05*on/$fr':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$fr:s=1080x1920:fps=$FPS"
  fi
  ffmpeg -y -loglevel error -i tmp/s$n.png -vf "scale=2160:3840,$zp,format=yuv420p" \
    -frames:v $fr -c:v libx264 -preset veryfast -crf 18 tmp/c$n.mp4
done
# Überblendungen verketten
inputs=""; filt=""; prev="0:v"; off=0
for i in "${!DAUER[@]}"; do inputs="$inputs -i tmp/c$((i+1)).mp4"; done
for i in $(seq 1 $((${#DAUER[@]}-1))); do
  off=$(python3 -c "print(round($off+${DAUER[$((i-1))]}-$UEB,3))")
  filt="$filt[$prev][$i:v]xfade=transition=slideup:duration=$UEB:offset=$off[v$i];"; prev="v$i"
done
LAENGE=$(python3 -c "print(round(sum([$(IFS=,; echo "${DAUER[*]}")])-$UEB*$((${#DAUER[@]}-1)),3))")
# Ton: Stimme falls vorhanden, sonst selbst erzeugter Beat (120 BPM, lizenzfrei)
BEAT="aevalsrc='0.7*sin(2*PI*(45*mod(t,0.5)+3*(1-exp(-30*mod(t,0.5)))))*exp(-8*mod(t,0.5))+0.12*(2*random(0)-1)*exp(-70*mod(t+0.25,0.5))+0.06*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.5*t))':s=44100:d=$LAENGE"
if [ -f stimme.mp3 ]; then
  AUD="-f lavfi -i $BEAT -i stimme.mp3"
  AF="[$((${#DAUER[@]})):a]volume=0.25[b];[b][$((${#DAUER[@]}+1)):a]amix=inputs=2:duration=first,afade=t=out:st=$(python3 -c "print($LAENGE-1)"):d=1[a]"
else
  AUD="-f lavfi -i $BEAT"
  AF="[$((${#DAUER[@]})):a]volume=0.6,afade=t=in:d=0.1,afade=t=out:st=$(python3 -c "print($LAENGE-1)"):d=1[a]"
fi
ffmpeg -y -loglevel error $inputs $AUD -filter_complex "${filt%;};$AF" \
  -map "[$prev]" -map "[a]" -t $LAENGE -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 160k -movflags +faststart final.mp4
echo "Fertig: final.mp4 ($LAENGE s)"
