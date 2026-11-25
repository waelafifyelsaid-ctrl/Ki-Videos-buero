#!/usr/bin/env python3
"""ElevenLabs-Stimmen für Einsatz 02 – gleiche Stimmen wie Einsatz 01 (+ Pilot, Fuchs).
Laute Zeilen (schreien/rufen/aufgeregt) mit eleven_multilingual_v2 (Stimme bleibt sicher gleich),
der Rest mit eleven_v3 „Natural“ + festem Seed pro Figur. Schlüssel kommt über den Proxy oder .env.
"""
import csv
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HIER = Path(__file__).resolve().parent
STIMME = {"6": "TX3LPaxmHKxFdv7VOQHJ", "1": "nPczCjzI2devNBz1zQrb", "2": "pNInz6obpgDQGcFmaJgB", "4": "Xb7hH8MSUJpSbSDYk0k2",
          "7": "IKne3meq5aSn9XLyUdCD", "Z": "XrExE9yKIg1WjnnlVkGX", "F": "N2lVS1w4EtoT3dr4eOWO",
          "P": "iP95p4xoKVk53GoZ742B",    # Pilot: Chris
          "X": "JBFqnCBsd6RMkjVDRZzb"}    # echter Fuchs: George
SEED = {r: 1000 + i * 17 for i, r in enumerate("61247ZFPX")}
SEED_EXTRA = int(os.environ.get("SEED_EXTRA", "0"))
TAGS = {"trocken": "deadpan", "sarkastisch": "sarcastic", "nervös": "nervous", "flüsternd": "whispering", "ruhig": "calm",
        "grinsend": "smirking", "kleinlaut": "sheepish", "ernst": "serious", "genervt": "annoyed", "kalt": "cold, menacing",
        "spöttisch": "mocking", "hungrig": "hopeful", "müde": "tired", "panisch": "panicked", "lässig": "casual"}
LAUT = ("schreit", "ruft", "laut", "aufgeregt", "panisch")
key = os.environ.get("ELEVENLABS_API_KEY", "")
zeilen = list(csv.DictReader(open(HIER / "stimmen" / "skript.csv", encoding="utf-8"), delimiter=";"))
nur = set(sys.argv[1:])
_zu = HIER / "stimmen" / "zuordnung.json"
ZU = json.loads(_zu.read_text()) if _zu.exists() else {}
zeichen = 0
TEST = os.environ.get("TROCKEN") == "1"
for z in zeilen:
    ziel = HIER / "stimmen" / f"{z['id']}.mp3"
    if ziel.exists() or (nur and z["rolle"] not in nur) or any(t == z["text_ohne_tags"] or t.replace("1A", "eins A").replace("FX-77", "F X sieben sieben") == z["text_ohne_tags"] for t in ZU if (HIER / "stimmen" / ZU[t]).exists()):
        continue
    tag = z["text_v3"][1:z["text_v3"].index("]")].lower() if z["text_v3"].startswith("[") else ""
    laut = tag in LAUT
    modell = "eleven_multilingual_v2" if laut else "eleven_v3"
    text = z["text_ohne_tags"]
    if not laut and tag:
        text = f"[{TAGS.get(tag, tag)}] " + text
    daten = {"text": text, "model_id": modell, "seed": SEED[z["rolle"]] + SEED_EXTRA,
             "voice_settings": {"stability": .5 if not laut else .62, "similarity_boost": .95, "style": .35 if not laut else .25, "use_speaker_boost": True}}
    if not laut:
        daten["language_code"] = "de"
    kopf = {"Content-Type": "application/json", **({"xi-api-key": key} if key else {})}
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{STIMME[z['rolle']]}?output_format=mp3_44100_128"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(daten).encode(), headers=kopf, method="POST"), timeout=120) as r:
            ziel.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"{z['id']}: ElevenLabs-Fehler {e.code}: {e.read().decode('utf-8', 'replace')[:300]}")
    zeichen += len(text)
    print(f"✓ {ziel.name}  ({modell}, {len(text)} Zeichen)")
    if TEST: break
print(f"Fertig. Verbrauchte Zeichen: {zeichen}")
