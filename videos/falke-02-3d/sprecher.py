#!/usr/bin/env python3
"""Sprecher-Skript Einsatz 02 (Markdown + CSV) aus timeline_fertig.json."""
import csv
import json
from pathlib import Path

HIER = Path(__file__).resolve().parent
TL = json.loads((HIER / "timeline_fertig.json").read_text())
ROLLE = {"6": "6", "1": "1", "1f": "1", "2": "2", "4": "4", "4f": "4", "7v": "7", "7f": "7", "Z": "Z", "P": "P", "X": "X"}
# Text wie gesprochen (Zahlen ausgeschrieben) + Regie-Tag
ZEILEN = {
    "Tja. Die Tür war mal zu.": ("[trocken]", "Tja. Die Tür war mal zu."),
    "Flug FX-77. Privatjet, Vorfeld Ost. Start in zwanzig Minuten.": ("[ruhig]", "Flug F X sieben sieben. Privatjet, Vorfeld Ost. Start in zwanzig Minuten."),
    "Dann sind wir in zehn da.": ("[ruhig]", "Dann sind wir in zehn da."),
    "Gibt's im Hubschrauber Frühstück?": ("[hungrig]", "Gibt's im Hubschrauber Frühstück?"),
    "Nein.": ("[trocken]", "Nein."),
    "Ich hasse Höhe.": ("[nervös]", "Ich hasse Höhe."),
    "Sieben, du hasst ALLES.": ("[spöttisch]", "Sieben, du hasst ALLES."),
    "Dich zum Beispiel.": ("[genervt]", "Dich zum Beispiel."),
    "Jet rollt! Er will zur Startbahn!": ("[aufgeregt]", "Jet rollt! Er will zur Startbahn!"),
    "Pilot, setz uns direkt davor!": ("[ruft]", "Pilot, setz uns direkt davor!"),
    "Raus! Raus! Raus!": ("[schreit]", "Raus! Raus! Raus!"),
    "Ladung gesetzt.": ("[flüsternd]", "Ladung gesetzt."),
    "Drei … zwei … eins …": ("[flüsternd]", "Drei … zwei … eins …"),
    "Tür ist offen.": ("[trocken]", "Tür ist offen."),
    "ZUGRIFF!": ("[schreit]", "ZUGRIFF!"),
    "POLIZEI! Hände hoch!": ("[schreit]", "POLIZEI! Hände hoch!"),
    "Nicht schießen! Ich bin nur der Pilot!": ("[panisch]", "Nicht schießen! Ich bin nur der Pilot!"),
    "Gute Landung, Kleiderschrank.": ("[grinsend]", "Gute Landung, Kleiderschrank."),
    "Bitte anschnallen.": ("[trocken]", "Bitte anschnallen."),
    "Wo ist der Fuchs?": ("[ernst]", "Wo ist der Fuchs?"),
    "Sitz 1A. Da liegt nur ein Tablet.": ("[nervös]", "Sitz eins A. Da liegt nur ein Tablet."),
    "Zu langsam, Falke.": ("[kalt]", "Zu langsam, Falke."),
    "Wir sehen uns in den Bergen.": ("[kalt]", "Wir sehen uns in den Bergen."),
    "Ich hasse Berge.": ("[kleinlaut]", "Ich hasse Berge."),
    "Gibt's da Frühstück?": ("[hungrig]", "Gibt's da Frühstück?"),
    "Einsteigen! Los!": ("[schreit]", "Einsteigen! Los!"),
    "Kein Platz zum Landen. Wir seilen ab!": ("[ruft]", "Kein Platz zum Landen. Wir seilen ab!"),
    "Seil frei!": ("[ruft]", "Seil frei!"),
    "Ihr Flug wurde leider gestrichen.": ("[grinsend]", "Ihr Flug wurde leider gestrichen."),
}
start = {s["n"]: s["start"] for s in TL["szenen"]}
with open(HIER / "stimmen" / "skript.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["id", "rolle", "funk", "text_v3", "text_ohne_tags", "regie", "zeit_im_video"])
    for z in TL["dialog"]:
        tag, txt = ZEILEN[z["text"]]
        t = start[z["szene"]] + z["start"]
        w.writerow([z["id"], ROLLE[z["wer"]], "ja" if z["funk"] else "nein", f"{tag} {txt}", txt, "", f"{int(t // 60)}:{t % 60:04.1f}"])
md = ["# EINHEIT FALKE · Einsatz 02 – Sprecher-Skript", "", "| Zeit | Wer | Text (Regie) |", "|---|---|---|"]
for z in TL["dialog"]:
    tag, txt = ZEILEN[z["text"]]
    t = start[z["szene"]] + z["start"]
    md.append(f"| {int(t // 60)}:{t % 60:04.1f} | {TL['sprecher'][z['wer']][0]} | {tag} {z['text']} |")
(HIER / "stimmen" / "SPRECHER-SKRIPT.md").write_text("\n".join(md) + "\n")
print("skript.csv:", len(TL["dialog"]), "Zeilen")
