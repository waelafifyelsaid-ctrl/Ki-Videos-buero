#!/usr/bin/env python3
"""Erzeugt eine Sprachaufnahme mit ElevenLabs.

Benutzung:
    python tools/stimme.py "Hallo, das ist ein Test" videos/test/stimme.mp3
    python tools/stimme.py --datei videos/test/text.txt videos/test/stimme.mp3

Der API-Schlüssel und die Stimme kommen aus der Datei .env im Projektordner:
    ELEVENLABS_API_KEY=...
    ELEVENLABS_VOICE_ID=...
Braucht nur Python 3, keine Zusatzpakete.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent


def lade_env():
    env_datei = PROJEKT / ".env"
    if env_datei.exists():
        for zeile in env_datei.read_text(encoding="utf-8").splitlines():
            zeile = zeile.strip()
            if zeile and not zeile.startswith("#") and "=" in zeile:
                k, v = zeile.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main():
    args = sys.argv[1:]
    if len(args) == 3 and args[0] == "--datei":
        text = Path(args[1]).read_text(encoding="utf-8").strip()
        ziel = Path(args[2])
    elif len(args) == 2:
        text, ziel = args[0], Path(args[1])
    else:
        print(__doc__)
        sys.exit(1)

    lade_env()
    key = os.environ.get("ELEVENLABS_API_KEY")
    voice = os.environ.get("ELEVENLABS_VOICE_ID")
    modell = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
    in_cloud = os.environ.get("CLAUDE_CODE_REMOTE") == "true"
    if not voice:
        print("Fehler: ELEVENLABS_VOICE_ID fehlt (in .env oder in den Umgebungsvariablen der Cloud-Umgebung)")
        sys.exit(1)
    if not key and not in_cloud:
        print("Fehler: ELEVENLABS_API_KEY fehlt in .env")
        sys.exit(1)

    url = (f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
           "?output_format=mp3_44100_128")
    daten = json.dumps({"text": text, "model_id": modell}).encode("utf-8")
    kopf = {"Content-Type": "application/json"}
    if key:
        kopf["xi-api-key"] = key
    # In der Cloud ohne Schlüssel: Der Schlüssel ist als "Network secret" hinterlegt
    # und wird unterwegs automatisch angehängt – Claude sieht ihn nie.
    anfrage = urllib.request.Request(url, data=daten, method="POST", headers=kopf)
    try:
        with urllib.request.urlopen(anfrage, timeout=120) as antwort:
            audio = antwort.read()
    except urllib.error.HTTPError as e:
        print(f"ElevenLabs-Fehler {e.code}: {e.read().decode('utf-8', 'replace')}")
        sys.exit(1)

    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_bytes(audio)
    print(f"Gespeichert: {ziel} ({len(audio) // 1024} KB, {len(text)} Zeichen verbraucht)")


if __name__ == "__main__":
    main()
