#!/usr/bin/env python3
"""Erzeugt alle Sprachaufnahmen für Einsatz 01 mit ElevenLabs aus stimmen/skript.csv.

In .env (Projektordner) eintragen:
  ELEVENLABS_API_KEY=...
  ELEVENLABS_STIMME_6=<voice id>   ELEVENLABS_STIMME_1=...  ELEVENLABS_STIMME_2=...  ELEVENLABS_STIMME_4=...
  ELEVENLABS_STIMME_7=...          ELEVENLABS_STIMME_Z=...  ELEVENLABS_STIMME_F=...
  ELEVENLABS_MODEL=eleven_v3   (optional; Standard: eleven_multilingual_v2 – dann ohne [Tags])
Vorhandene Dateien werden übersprungen (spart Zeichen). Neu erzeugen: Datei löschen.
"""
import csv
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HIER = Path(__file__).resolve().parent
PROJEKT = HIER.parents[1]
EINSTELLUNG = {   # stability, similarity, style
    "6": (.35, .75, .45), "1": (.65, .8, .15), "2": (.55, .75, .3), "4": (.45, .75, .35),
    "7": (.3, .75, .55), "Z": (.7, .8, .1), "F": (.35, .75, .5),
}

env = PROJEKT / ".env"
if env.exists():
    for z in env.read_text(encoding="utf-8").splitlines():
        if "=" in z and not z.strip().startswith("#"):
            k, v = z.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
key = os.environ.get("ELEVENLABS_API_KEY")
modell = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
v3 = "v3" in modell
if not key and os.environ.get("CLAUDE_CODE_REMOTE") != "true":
    sys.exit("ELEVENLABS_API_KEY fehlt in .env")

zeilen = list(csv.DictReader(open(HIER / "stimmen" / "skript.csv", encoding="utf-8"), delimiter=";"))
fehlen = sorted({z["rolle"] for z in zeilen if not os.environ.get(f"ELEVENLABS_STIMME_{z['rolle']}")})
if fehlen:
    sys.exit("Diese Voice-IDs fehlen in .env: " + ", ".join(f"ELEVENLABS_STIMME_{r}" for r in fehlen))

zeichen = 0
for z in zeilen:
    ziel = HIER / "stimmen" / f"{z['id']}.mp3"
    if ziel.exists():
        continue
    text = z["text_v3"] if v3 else z["text_ohne_tags"]
    st, sim, sty = EINSTELLUNG[z["rolle"]]
    daten = {"text": text, "model_id": modell,
             "voice_settings": {"stability": st, "similarity_boost": sim, "style": sty, "use_speaker_boost": True}}
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{os.environ['ELEVENLABS_STIMME_' + z['rolle']]}?output_format=mp3_44100_128"
    kopf = {"Content-Type": "application/json"}
    if key:
        kopf["xi-api-key"] = key
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(daten).encode(), headers=kopf, method="POST"), timeout=120) as r:
            ziel.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"{z['id']}: ElevenLabs-Fehler {e.code}: {e.read().decode('utf-8', 'replace')[:300]}")
    zeichen += len(text)
    print(f"✓ {ziel.name}  ({len(text)} Zeichen)")
print(f"Fertig. Verbrauchte Zeichen: {zeichen}. Jetzt ./build.sh starten – Timing und Funk-Effekt passen sich automatisch an.")
