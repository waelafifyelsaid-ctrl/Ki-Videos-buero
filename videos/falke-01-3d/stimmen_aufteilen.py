#!/usr/bin/env python3
"""Zerlegt eine Aufnahme pro Figur (z. B. aus Speechma) in die einzelnen Sätze.

  python3 stimmen_aufteilen.py <rolle> <datei.mp3>      Rollen: 6 1 2 4 7 Z F

Die Sätze der Rolle müssen in der Reihenfolge aus SPEECHMA.md gesprochen sein (jeder Satz eine eigene Zeile).
Geschnitten wird an den längsten Pausen – genau so viele Schnitte wie nötig. Ergebnis: stimmen/<id>.mp3
"""
import csv
import re
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent


def pausen(datei):
    out = subprocess.run(["ffmpeg", "-i", str(datei), "-af", "silencedetect=noise=-38dB:d=0.18", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    enden = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    dauer = float(re.findall(r"Duration: (\d+):(\d+):([\d.]+)", out)[0][2]) + 60 * int(re.findall(r"Duration: (\d+):(\d+)", out)[0][1])
    return list(zip(starts, enden)), dauer


def main():
    rolle, datei = sys.argv[1], Path(sys.argv[2])
    zeilen = [z for z in csv.DictReader(open(HIER / "stimmen" / "skript.csv", encoding="utf-8"), delimiter=";") if z["rolle"] == rolle]
    p, dauer = pausen(datei)
    innen = [(a, e) for a, e in p if a > 0.05 and e < dauer - 0.05]       # Pausen am Anfang/Ende ignorieren
    if len(innen) < len(zeilen) - 1:
        sys.exit(f"Nur {len(innen) + 1} Abschnitte gefunden, aber {len(zeilen)} Sätze nötig – zwischen den Sätzen mehr Pause lassen.")
    schnitte = sorted(sorted(innen, key=lambda x: x[1] - x[0], reverse=True)[:len(zeilen) - 1])
    grenzen = [0.0] + [(a + e) / 2 for a, e in schnitte] + [dauer]
    (HIER / "stimmen").mkdir(exist_ok=True)
    for z, a, e in zip(zeilen, grenzen, grenzen[1:]):
        ziel = HIER / "stimmen" / f"{z['id']}.mp3"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(datei), "-ss", f"{a:.3f}", "-to", f"{e:.3f}",
                        "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                        "-ar", "44100", "-ac", "1", "-b:a", "160k", str(ziel)], check=True)
        print(f"✓ {ziel.name}  {e - a:4.1f} s  {z['text_ohne_tags']}")


if __name__ == "__main__":
    main()
