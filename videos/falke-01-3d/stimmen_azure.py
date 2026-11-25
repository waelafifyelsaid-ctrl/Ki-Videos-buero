#!/usr/bin/env python3
"""Plan B: echte, natürliche Microsoft-Neural-Stimmen über Azure Speech (offizielle API, Free-Tier F0 = 500.000 Zeichen/Monat).

Einrichten (einmalig, kostenlos):
  1. portal.azure.com → Ressource „Speech“ (Speech service) anlegen, Tarif „Free F0“, Region z. B. westeurope.
  2. Unter „Schlüssel und Endpunkt“ KEY 1 kopieren.
  3. In .env:  AZURE_SPEECH_KEY=...   AZURE_SPEECH_REGION=westeurope
Dann:  python3 videos/falke-01-3d/stimmen_azure.py   → schreibt stimmen/<id>.mp3 (haben Vorrang vor den Ersatzstimmen)
Andere Stimme für eine Rolle: unten in BESETZUNG ändern, Datei löschen, neu starten.
"""
import csv
import json
import os
import sys
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

HIER = Path(__file__).resolve().parent
PROJEKT = HIER.parents[1]

# Rolle -> (Stimme, Ersatzstimme, Tempo, Tonhöhe)
BESETZUNG = {
    "6": ("de-DE-KillianNeural", "de-DE-FlorianMultilingualNeural", "+8%", "+2%"),    # jung, frech
    "1": ("de-DE-ConradNeural", "de-DE-BerndNeural", "-6%", "-6%"),                   # tief, ruhig, Chef
    "2": ("de-DE-KlausNeural", "de-DE-ChristophNeural", "-12%", "-14%"),              # Bass, langsam
    "4": ("de-DE-AmalaNeural", "de-DE-TanjaNeural", "+3%", "0%"),                     # kühl, klar
    "7": ("de-DE-KasperNeural", "de-AT-JonasNeural", "+14%", "+6%"),                  # nervös, schnell
    "Z": ("de-DE-KatjaNeural", "de-DE-ElkeNeural", "-4%", "-2%"),                     # Nachrichtenton
    "F": ("de-DE-RalfNeural", "de-CH-JanNeural", "+4%", "+3%"),                       # großspurig
}

env = PROJEKT / ".env"
if env.exists():
    for z in env.read_text(encoding="utf-8").splitlines():
        if "=" in z and not z.strip().startswith("#"):
            k, v = z.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
region = os.environ.get("AZURE_SPEECH_REGION", "westeurope")
key = os.environ.get("AZURE_SPEECH_KEY", "")
if not key and os.environ.get("CLAUDE_CODE_REMOTE") != "true":
    sys.exit("AZURE_SPEECH_KEY fehlt in .env (siehe Anleitung oben).")
basis = f"https://{region}.tts.speech.microsoft.com/cognitiveservices"
kopf = {"Ocp-Apim-Subscription-Key": key} if key else {}

with urllib.request.urlopen(urllib.request.Request(basis + "/voices/list", headers=kopf), timeout=60) as r:
    verfuegbar = {v["ShortName"] for v in json.load(r)}
print("Deutsche Stimmen verfügbar:", ", ".join(sorted(v for v in verfuegbar if v.startswith("de-"))))


def stimme(rolle):
    a, b, tempo, hoehe = BESETZUNG[rolle]
    return (a if a in verfuegbar else b), tempo, hoehe


zeilen = list(csv.DictReader(open(HIER / "stimmen" / "skript.csv", encoding="utf-8"), delimiter=";"))
zeichen = 0
for z in zeilen:
    ziel = HIER / "stimmen" / f"{z['id']}.mp3"
    if ziel.exists():
        continue
    name, tempo, hoehe = stimme(z["rolle"])
    tags = z["text_v3"].split("]")[0].lower() if z["text_v3"].startswith("[") else ""
    text = escape(z["text_ohne_tags"].replace("Weh-Lan", "W-LAN"))
    lautst = "medium"
    if "flüster" in tags:
        lautst, tempo = "x-soft", "-4%"
    elif any(w in tags for w in ("schreit", "ruft", "laut")):
        lautst = "x-loud"
    ssml = (f"<speak version='1.0' xml:lang='de-DE'><voice name='{name}'>"
            f"<prosody rate='{tempo}' pitch='{hoehe}' volume='{lautst}'>{text}</prosody></voice></speak>")
    req = urllib.request.Request(basis + "/v1", data=ssml.encode("utf-8"), method="POST", headers={
        **kopf, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
        "User-Agent": "ki-video-buero"})
    with urllib.request.urlopen(req, timeout=60) as r:
        ziel.write_bytes(r.read())
    zeichen += len(text)
    print(f"✓ {ziel.name}  ({name})")
print(f"Fertig, {zeichen} Zeichen. Jetzt ./build.sh – Timing, Funkfilter und Ducking passen sich automatisch an.")
