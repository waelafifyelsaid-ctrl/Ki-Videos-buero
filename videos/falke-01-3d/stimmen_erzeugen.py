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
# Standard-Stimmen von ElevenLabs (öffentliche IDs) – überschreibbar per ELEVENLABS_STIMME_<rolle> in .env
STANDARD = {"6": "TX3LPaxmHKxFdv7VOQHJ",   # Liam: jung
            "1": "nPczCjzI2devNBz1zQrb",   # Brian: tief, ruhig
            "2": "pNInz6obpgDQGcFmaJgB",   # Adam: tiefer Bass
            "4": "Xb7hH8MSUJpSbSDYk0k2",   # Alice: klar, kühl
            "7": "IKne3meq5aSn9XLyUdCD",   # Charlie: locker, schnell
            "Z": "XrExE9yKIg1WjnnlVkGX",   # Matilda: sachlich
            "F": "N2lVS1w4EtoT3dr4eOWO"}   # Callum: rau, großspurig
# deutsche Regie-Tags -> Eleven-v3-Tags
TAGS = {"außer atem": "out of breath", "grinsend": "smirking", "mit vollem mund": "mouth full, chewing", "frech": "cheeky",
        "stolz, ruhig": "proud, calm", "trocken": "deadpan", "sarkastisch": "sarcastic", "laut": "loudly", "nervös": "nervous",
        "ruhig": "calm", "flüsternd": "whispering", "ruft": "shouting", "schreit": "shouting", "aufgeregt": "panicked",
        "rennend, außer atem": "running, out of breath", "lachend, rennend": "laughing, running",
        "außer atem, bestimmt": "out of breath, commanding", "grinsend, schnaufend": "smirking, panting",
        "gepresst, frech": "strained, cocky", "zögernd": "hesitant", "kleinlaut": "sheepish", "ernst": "serious"}
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
modell = os.environ.get("ELEVENLABS_MODEL", "eleven_v3")
v3 = "v3" in modell
if not key and os.environ.get("CLAUDE_CODE_REMOTE") != "true":
    sys.exit("ELEVENLABS_API_KEY fehlt in .env")

zeilen = list(csv.DictReader(open(HIER / "stimmen" / "skript.csv", encoding="utf-8"), delimiter=";"))
nur = set(sys.argv[1:])          # optional: nur bestimmte Rollen, z. B. "1 6"

zeichen = 0
for z in zeilen:
    ziel = HIER / "stimmen" / f"{z['id']}.mp3"
    if ziel.exists() or (nur and z["rolle"] not in nur):
        continue
    text = z["text_ohne_tags"].replace("Weh-Lan", "W-LAN")
    if v3 and z["text_v3"].startswith("["):
        tag = z["text_v3"][1:z["text_v3"].index("]")].lower()
        text = f"[{TAGS.get(tag, tag)}] " + text
    st, sim, sty = EINSTELLUNG[z["rolle"]]
    stimme = os.environ.get(f"ELEVENLABS_STIMME_{z['rolle']}", STANDARD[z["rolle"]])
    if v3:   # v3: nur 0.0 / 0.5 / 1.0 – „Natural“ (0.5) hält die Stimme stabil, fester Seed pro Figur
        st = 0.5
    daten = {"text": text, "model_id": modell, **({"language_code": "de"} if v3 else {}),
             "seed": 1000 + "61247ZF".index(z["rolle"]) * 17,
             "voice_settings": {"stability": st, "similarity_boost": .9, "style": sty, "use_speaker_boost": True}}
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{stimme}?output_format=mp3_44100_128"
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
