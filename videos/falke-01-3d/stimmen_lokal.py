#!/usr/bin/env python3
"""Kostenlose Ersatz-Stimmen (Piper, läuft lokal, keine Credits) für alle Zeilen aus stimmen/skript.csv.
Schreibt stimmen/<id>.wav. Echte Aufnahmen (z. B. ElevenLabs) als stimmen/<id>.mp3 haben Vorrang.

Stimmen (GitHub rhasspy/piper v0.0.2): thorsten + kerstin = CC0 (kommerziell frei),
karlsson + ramona = M-AILABS-Datensatz (Lizenz vor Monetarisierung prüfen).
"""
import csv
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

HIER = Path(__file__).resolve().parent
MODELLE = HIER.parents[1] / "tools" / "piper_stimmen"
URL = "https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-{}.tar.gz"

# Rolle -> (Piper-Stimme, Halbtöne, Tempo)
ROLLEN = {
    "6": ("thorsten-low", +1.5, 1.10),   # jung, frech, schnell
    "1": ("karlsson-low", -2.5, 0.92),   # tief, ruhig
    "2": ("thorsten-low", -5.0, 0.84),   # sehr tief, langsam
    "4": ("kerstin-low", 0.0, 1.05),     # klar, kühl
    "7": ("karlsson-low", +3.0, 1.18),   # hoch, nervös
    "Z": ("ramona-low", -1.0, 0.95),     # sachlich
    "F": ("karlsson-low", +0.5, 1.06),   # großspurig
}
FLUESTERN = ("flüsternd",)
LAUT = ("schreit", "ruft", "laut")


def modell(name):
    d = MODELLE / name
    onnx = next(d.glob("*.onnx"), None) if d.exists() else None
    if onnx:
        return onnx
    d.mkdir(parents=True, exist_ok=True)
    print("Lade Stimme", name)
    tgz = d / "v.tgz"
    urllib.request.urlretrieve(URL.format(name), tgz)
    with tarfile.open(tgz) as t:
        t.extractall(d)
    tgz.unlink()
    return next(d.glob("*.onnx"))


def main():
    zeilen = list(csv.DictReader(open(HIER / "stimmen" / "skript.csv", encoding="utf-8"), delimiter=";"))
    for z in zeilen:
        ziel = HIER / "stimmen" / f"{z['id']}.wav"
        if (HIER / "stimmen" / f"{z['id']}.mp3").exists() or ziel.exists():
            continue
        name, halbtoene, tempo = ROLLEN[z["rolle"]]
        tags = z["text_v3"].split("]")[0].lower() if z["text_v3"].startswith("[") else ""
        text = z["text_ohne_tags"].replace("Weh-Lan", "W-LAN").replace("…", ",")
        roh = ziel.with_suffix(".roh.wav")
        flu, laut = any(w in tags for w in FLUESTERN), any(w in tags for w in LAUT)
        if laut:
            tempo *= 1.06
        subprocess.run([sys.executable, "-m", "piper", "-m", str(modell(name)), "-f", str(roh),
                        "--length-scale", str(1 / tempo), "--noise-scale", "0.75" if not flu else "0.9"],
                       input=text.encode(), check=True, capture_output=True)
        p = 2 ** (halbtoene / 12)
        filt = [f"asetrate=16000*{p:.4f}", "aresample=44100", f"atempo={1 / p:.4f}"]
        if flu:
            filt += ["highpass=f=500", "volume=0.55"]
        if laut:
            filt += ["acompressor=threshold=0.2:ratio=6:makeup=2", "volume=1.3"]
        filt += ["loudnorm=I=-18:TP=-2"]
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(roh), "-af", ",".join(filt), "-ar", "44100", str(ziel)], check=True)
        roh.unlink()
        print("✓", ziel.name)


if __name__ == "__main__":
    main()
