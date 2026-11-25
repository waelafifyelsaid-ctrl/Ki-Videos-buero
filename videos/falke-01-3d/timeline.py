#!/usr/bin/env python3
"""Legt die Dialogzeilen so, dass jede lang genug lesbar ist und sich nichts überschneidet,
verlängert Szenen bei Bedarf und schreibt timeline_fertig.json (für Bild + Ton)."""
import json
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent


def lesedauer(text):
    return max(1.3, 0.75 + 0.048 * len(text))


def berechne(roh):
    szenen = [dict(s) for s in roh["szenen"]]
    zeilen = []
    for s in szenen:
        ende_vorher = -1.0
        for sz, ab, wer, text in roh["dialog"]:
            if sz != s["n"]:
                continue
            start = max(ab, ende_vorher + 0.15)
            ende = start + lesedauer(text)
            zeilen.append({"szene": sz, "start": round(start, 3), "ende": round(ende, 3), "wer": wer, "text": text,
                           "verschoben": round(start - ab, 2)})
            ende_vorher = ende
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
    print(f"Gesamt: {fertig['dauer']:.1f} s")
