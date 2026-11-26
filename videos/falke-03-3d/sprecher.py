#!/usr/bin/env python3
"""Sprecher-Skript Einsatz 03 (Markdown + CSV) aus timeline_fertig.json."""
import csv
import json
from pathlib import Path

HIER = Path(__file__).resolve().parent
TL = json.loads((HIER / "timeline_fertig.json").read_text())
ROLLE = {"6": "6", "1": "1", "1f": "1", "2": "2", "4": "4", "7v": "7", "Zf": "Z", "G": "G"}
# Text wie gesprochen (Zahlen ausgeschrieben) + Regie-Tag
ZEILEN = {
    "Abseilen stand nicht im Vertrag.": ("[trocken]", "Abseilen stand nicht im Vertrag."),
    "Kein Platz zum Landen. Wir seilen ab!": ("[ruft]", "Kein Platz zum Landen. Wir seilen ab!"),
    "Geisel in der Hütte. Vier Täter.": ("[ernst]", "Geisel in der Hütte. Vier Täter."),
    "Zu viel Wind zum Landen. Wir springen!": ("[ruft]", "Zu viel Wind zum Landen. Wir springen!"),
    "Ich hasse Höhe.": ("[nervös]", "Ich hasse Höhe."),
    "Nicht runterschauen, Sieben.": ("[spöttisch]", "Nicht runterschauen, Sieben."),
    "ZUGRIFF!": ("[schreit]", "ZUGRIFF!"),
    "POLIZEI! Auf den Boden!": ("[schreit]", "POLIZEI! Auf den Boden!"),
    "Danke … ihr wart schnell.": ("[grinsend]", "Danke … ihr wart schnell."),
    "Moment mal …": ("[ernst]", "Moment mal …"),
}
start = {s["n"]: s["start"] for s in TL["szenen"]}
with open(HIER / "stimmen" / "skript.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["id", "rolle", "funk", "text_v3", "text_ohne_tags", "regie", "zeit_im_video"])
    for z in TL["dialog"]:
        tag, txt = ZEILEN[z["text"]]
        t = start[z["szene"]] + z["start"]
        w.writerow([z["id"], ROLLE[z["wer"]], "ja" if z["funk"] else "nein", f"{tag} {txt}", txt, "", f"{int(t // 60)}:{t % 60:04.1f}"])
md = ["# EINHEIT FALKE · Einsatz 03 – Sprecher-Skript", "", "| Zeit | Wer | Text (Regie) |", "|---|---|---|"]
for z in TL["dialog"]:
    tag, txt = ZEILEN[z["text"]]
    t = start[z["szene"]] + z["start"]
    md.append(f"| {int(t // 60)}:{t % 60:04.1f} | {TL['sprecher'][z['wer']][0]} | {tag} {z['text']} |")
(HIER / "stimmen" / "SPRECHER-SKRIPT.md").write_text("\n".join(md) + "\n")
print("skript.csv:", len(TL["dialog"]), "Zeilen")
