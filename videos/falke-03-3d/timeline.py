#!/usr/bin/env python3
"""Legt die Dialogzeilen überschneidungsfrei und lang genug lesbar an, verlängert Szenen bei Bedarf und
schreibt timeline_fertig.json (für Bild + Ton). Liegt für eine Zeile schon eine Sprachaufnahme in
stimmen/<id>.mp3|wav, bestimmt deren Länge die Anzeigedauer."""
import json
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
FUNK = {"1f", "4f", "6f", "7f", "Zf"}
LAUTSPRECHER = {"X"}


def lesedauer(text):
    return max(1.3, 0.75 + 0.048 * len(text))


ZUORDNUNG = HIER / "stimmen" / "zuordnung.json"
ZU = json.loads(ZUORDNUNG.read_text()) if ZUORDNUNG.exists() else {}


def aufnahme(zid, text=None):
    if text in ZU and (HIER / "stimmen" / ZU[text]).exists():
        zid = ZU[text].rsplit(".", 1)[0]
    for endung in ("mp3", "wav"):
        f = HIER / "stimmen" / f"{zid}.{endung}"
        if f.exists():
            out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)],
                                 capture_output=True, text=True).stdout.strip()
            return f.name, float(out or 0)
    return None, 0.0


def berechne(roh):
    szenen = [dict(s) for s in roh["szenen"]]
    zeilen = []
    nr = 0
    for s in szenen:
        ende_vorher = -1.0
        for sz, ab, wer, text in roh["dialog"]:
            if sz != s["n"]:
                continue
            nr += 1
            zid = f"{nr:02d}_{sz}_{wer}"
            datei, laenge = aufnahme(zid, text)
            start = max(ab, ende_vorher + 0.15)
            ende = start + max(lesedauer(text), laenge + 0.3)
            zeilen.append({"id": zid, "szene": sz, "start": round(start, 3), "ende": round(ende, 3), "wer": wer,
                           "text": text, "funk": wer in FUNK, "lautsprecher": wer in LAUTSPRECHER, "datei": datei, "verschoben": round(start - ab, 2)})
            ende_vorher = ende
        s["verzug"] = 0.0
        if s.get("sync"):
            sy = s["sync"]
            z = next(z for z in zeilen if z["szene"] == s["n"] and z["text"].startswith(sy["zeile"]))
            s["verzug"] = round(max(0.0, (z["ende"] - 0.3) + 0.12 - sy["ereignis"]), 3)
            s["marken"] = [round(z["start"] + m, 3) for m in sy.get("marken", [])]
            ende_vorher = max(ende_vorher, sy["basis_d"] + s["verzug"] - 0.35)
        extra = roh.get("ende", 0) if s is szenen[-1] else 0
        s["d"] = round(max(s["d"], ende_vorher + 0.35 + extra), 3)
    t = 0.0
    for s in szenen:
        s["start"] = round(t, 3)
        t += s["d"]
    return {"titel": roh["titel"], "sprecher": roh["sprecher"], "szenen": szenen, "dialog": zeilen, "dauer": round(t, 3)}


if __name__ == "__main__":
    roh = json.loads((HIER / "timeline.json").read_text())
    fertig = berechne(roh)
    (HIER / "timeline_fertig.json").write_text(json.dumps(fertig, ensure_ascii=False, indent=1))
    for z in fertig["dialog"]:
        if z["verschoben"] > 0.4:
            print(f"Hinweis: '{z['text'][:30]}…' um {z['verschoben']} s verschoben", file=sys.stderr)
    for s in fertig["szenen"]:
        print(f"{s['n']:<13} {s['start']:6.2f}  {s['d']:5.2f} s")
    print(f"Gesamt: {fertig['dauer']:.1f} s · Aufnahmen gefunden: {sum(1 for z in fertig['dialog'] if z['datei'])}/{len(fertig['dialog'])}")
