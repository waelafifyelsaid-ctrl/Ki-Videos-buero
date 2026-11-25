#!/usr/bin/env python3
"""Erzeugt das Sprecher-Skript für ElevenLabs (Markdown für Menschen + CSV für den Batch-Generator)
aus timeline_fertig.json. Eine Quelle für alles: IDs, Dateinamen und Zeiten passen immer zum Video."""
import csv
import json
from pathlib import Path

HIER = Path(__file__).resolve().parent
REPO = HIER.parents[1]
TL = json.loads((HIER / "timeline_fertig.json").read_text())

# Rolle je Sprecher-Code (Funk-Varianten = gleiche Stimme, Funk-Effekt kommt automatisch im Schnitt)
ROLLE = {"6": "6", "6f": "6", "1": "1", "1f": "1", "2": "2", "4": "4", "4f": "4", "7": "7", "7v": "7",
         "Z": "Z", "Zf": "Z", "F": "F"}

CASTING = {
    "6": dict(name="6 – DU (der Neue)", alter="Anfang 20", stimme="junger Mann, hell-mittel, frech, schnell, Umgangssprache, leicht ironisch",
              suche="German · male · young · conversational / casual", settings="Stability 0.35 · Similarity 0.75 · Style 0.45 · Speaker Boost an"),
    "1": dict(name="1 – Teamführer", alter="Mitte 50", stimme="tief, ruhig, rau, sehr knapp, null Emotion – wenn er laut wird, hört jeder zu",
              suche="German · male · old/middle aged · deep · authoritative / gravelly", settings="Stability 0.65 · Similarity 0.8 · Style 0.15"),
    "2": dict(name="2 – Türöffner", alter="Mitte 30", stimme="sehr tiefer Bass, langsam, gemütlich, trocken-witzig (sagt alles todernst)",
              suche="German · male · deep · bass · calm", settings="Stability 0.55 · Similarity 0.75 · Style 0.3"),
    "4": dict(name="4 – Präzision & Drohne", alter="um 30", stimme="Frau, klar, kühl, präzise, trockener Sarkasmus; im Einsatz laut und schneidend",
              suche="German · female · middle aged · confident / professional", settings="Stability 0.45 · Similarity 0.75 · Style 0.35"),
    "7": dict(name="7 – Technik", alter="Mitte 20", stimme="Mann, eher hoch, schnell, nervös, nerdig, verhaspelt sich fast",
              suche="German · male · young · energetic / nervous", settings="Stability 0.3 · Similarity 0.75 · Style 0.55"),
    "Z": dict(name="ZENTRALE (Chefin)", alter="Ende 50", stimme="Frau, sachlich, ruhig, wie eine Nachrichtensprecherin, kein Lächeln",
              suche="German · female · old · news / narration / authoritative", settings="Stability 0.7 · Similarity 0.8 · Style 0.1"),
    "F": dict(name="ORANGE JACKE (Fake-Fuchs)", alter="um 30", stimme="Mann, großspurig, schnodderig, etwas Straße; am Boden außer Atem, aber frech",
              suche="German · male · middle aged · casual / street / cocky", settings="Stability 0.35 · Similarity 0.75 · Style 0.5"),
}

# Je Zeile: Text so, wie ElevenLabs ihn sprechen soll (Zahlen ausgeschrieben), v3-Tags, Regie-Hinweis
ZEILEN = {
    "01_hook_6": ("[außer Atem] Okay … das war lauter als geplant.", "nach der Explosion, Ohren klingeln, halb lachend"),
    "02_hq_6": ("[grinsend] Zwei, das ist dein drittes Frühstück.", "lässig, stichelnd über den Tisch"),
    "03_hq_2": ("[mit vollem Mund] Viertes.", "todernst, kauend, keine Pause"),
    "04_hq_1": ("Briefing. Sofort.", "ruhig, aber keine Widerrede – Alarm läuft"),
    "05_briefing_Z": ("Lagerhaus Sieben am Hafen. Vierzig Millionen in Drogen.", "sachlich, Fakten vorlesen"),
    "06_briefing_Z": ("Zielperson: der Fuchs. Hat immer einen Plan B.", "leicht warnend bei „Plan B“"),
    "07_briefing_6": ("[frech] Und was ist UNSER Plan B?", "Betonung auf UNSER"),
    "08_briefing_1": ("Zwei.", "ein Wort, trocken, ohne hinzusehen"),
    "09_briefing_2": ("[stolz, ruhig] Ich bin Plan A bis Z.", "langsam, zufrieden"),
    "10_spind_4": ("[trocken] Visier runter, Neuer. Heute wird's laut.", "beiläufig beim Helm-Aufsetzen"),
    "11_spind_6": ("[sarkastisch] Danke, Mama.", "kurz, augenrollend"),
    "12_spind_1": ("[laut] Abfahrt!", "aus dem Gang gerufen"),
    "13_van_Zf": ("Zentrale für Falke: Zielobjekt bestätigt. Zugriff freigegeben.", "FUNK – sachlich, deutlich, ohne Eile"),
    "14_van_7v": ("[nervös] Ich hasse Regen. Und Häfen. Und Möwen.", "aufgezählt, wird bei jedem Punkt jammernder"),
    "15_van_6": ("[grinsend] Sieben, du bist ein Angsthase mit Weh-Lan.", "stichelnd; „WLAN“ deutsch ausgesprochen"),
    "16_van_2": ("[ruhig] Lass ihn. Er hat heute schon geweint.", "gutmütig, todernst"),
    "17_van_1": ("Wir sind da. Masken auf.", "leise, konzentriert – ab jetzt Einsatz"),
    "18_anschleichen_4f": ("[flüsternd] Vier an alle: Drohne oben. Drei Personen im Gebäude.", "FUNK – gedämpft, schnell, präzise"),
    "19_anschleichen_1f": ("[flüsternd] Verstanden. Leise rein, wie besprochen.", "FUNK – sehr ruhig"),
    "20_anschleichen_2": ("[flüsternd] Ich bin IMMER leise.", "geflüstert, beleidigt – direkt danach rempelt er die Tonne an"),
    "21_zugriff_2": ("[flüsternd] Ladung gesetzt.", "knapp, konzentriert"),
    "22_zugriff_1": ("[flüsternd] Auf mein Zeichen. Drei … zwei … eins …", "langsam, gleichmäßig – je eine Sekunde zwischen den Zahlen"),
    "23_zugriff_4": ("[ruft] Flash raus!", "kurz und scharf, während sie wirft"),
    "24_zugriff_1": ("[schreit] ZUGRIFF!", "voller Kommandoton"),
    "25_innen_4": ("[schreit] POLIZEI! Hände hoch! Auf den Boden!", "sehr laut, abgehackt, jedes Kommando einzeln"),
    "26_innen_7": ("[aufgeregt] Orange Jacke! Hinterausgang – er ist raus!", "FUNK – hektisch, überschlägt sich fast"),
    "27_innen_2": ("[trocken] Hingefallen. Komisch.", "auf dem Ganoven kniend, null Stress"),
    "28_innen_1": ("[laut] Sechs – hinterher!", "Befehl, scharf"),
    "29_verfolgung_6": ("[rennend, außer Atem] Stehen bleiben, du Billig-Fuchs!", "beim Sprinten gerufen, keuchend"),
    "30_verfolgung_F": ("[lachend, rennend] Fang mich doch, Anfänger!", "über die Schulter, großspurig"),
    "31_verfolgung_6": ("[außer Atem, bestimmt] Hände auf den Rücken!", "kniend, keuchend, aber Kommandoton"),
    "32_verfolgung_6": ("[grinsend, schnaufend] Plan B war wohl: ausrutschen.", "zufrieden, noch außer Atem"),
    "33_verfolgung_F": ("[gepresst, frech] Ihr habt keine Ahnung, wer ich bin …", "Gesicht am Boden, trotzdem großspurig"),
    "34_verfolgung_6f": ("[außer Atem] Sechs an alle: Person gesichert. Kai Nord.", "FUNK – stolz, schnaufend"),
    "35_twist_7v": ("[zögernd] Leute … das ist nicht der Fuchs. Nur sein Fahrer.", "liest vom Tablet ab, Stimmung kippt"),
    "36_twist_F": ("[grinsend] Der echte Fuchs fliegt um sechs.", "genüsslich, langsam"),
    "37_twist_1": ("Packt eure Sachen. Wir fliegen.", "ruhig, entschlossen"),
    "38_twist_6": ("[kleinlaut] Ich hab Flugangst.", "plötzlich gar nicht mehr frech"),
    "39_twist_2": ("[ernst] Ich hab Hunger.", "todernst – Pointe"),
}


def zeit(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


start = {s["n"]: s["start"] for s in TL["szenen"]}
fehlt = [z["id"] for z in TL["dialog"] if z["id"] not in ZEILEN]
if fehlt:
    raise SystemExit(f"Für diese Zeilen fehlt die Sprechfassung: {fehlt}")

(HIER / "stimmen").mkdir(exist_ok=True)
with open(HIER / "stimmen" / "skript.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["id", "rolle", "funk", "text_v3", "text_ohne_tags", "regie", "zeit_im_video"])
    for z in TL["dialog"]:
        txt, regie = ZEILEN[z["id"]]
        ohne = " ".join(t for t in txt.split("] ")[-1:]) if txt.startswith("[") else txt
        w.writerow([z["id"], ROLLE[z["wer"]], "ja" if z["funk"] else "nein", txt, ohne, regie, zeit(start[z["szene"]] + z["start"])])

md = ["# EINHEIT FALKE · Einsatz 01 – Sprecher-Skript für ElevenLabs", "",
      "Fertige Sprechfassung aller 39 Sätze. Zahlen sind ausgeschrieben, damit ElevenLabs sie richtig spricht.",
      "In eckigen Klammern stehen Regie-Tags für das Modell **Eleven v3**. Bei **Multilingual v2** lässt du sie weg und nutzt die Spalte „ohne Tags“ in `stimmen/skript.csv`.", "",
      "## So geht's", "",
      "1. **Stimmen auswählen:** Für jede Rolle unten eine deutsche Stimme in der Voice Library suchen. Die Suchbegriffe stehen in der Tabelle.",
      "   Wichtig: 7 Rollen, 7 **verschiedene** Stimmen. 1, 2 und 6 dürfen sich nicht ähneln.",
      "2. **Jede Zeile einzeln erzeugen** (nicht alles am Stück) und als MP3 speichern, **Dateiname = ID**, z. B. `22_zugriff_1.mp3`.",
      "3. **Funksprüche (FUNK) trocken aufnehmen**, ohne Funk-Effekt. Das Rauschen, den Funkfilter und das Klicken baut unser Schnitt automatisch ein.",
      "4. **Keine Musik und keine Effekte** in ElevenLabs. Explosionen, Regen usw. liegen schon im Video.",
      "5. Alle MP3s nach `videos/falke-01-3d/stimmen/` legen und `./build.sh` starten. Dann passiert automatisch:",
      "   - Die Untertitel richten sich nach der echten Länge jeder Aufnahme.",
      "   - Funksprüche bekommen den Funk-Klang.",
      "   - Hintergrundgeräusche werden leiser, solange jemand spricht.",
      "6. **Automatisch statt Klicken:** Trag die Voice-IDs in `.env` ein (`ELEVENLABS_STIMME_6=…`, `_1`, `_2`, `_4`, `_7`, `_Z`, `_F`) und starte",
      "   `python3 videos/falke-01-3d/stimmen_erzeugen.py`. Das Skript erzeugt alle 39 Dateien mit den Einstellungen unten.",
      "7. **Lizenz:** Für Videos, mit denen du Geld verdienst, brauchst du einen bezahlten ElevenLabs-Plan. Im Gratis-Plan ist kommerzielle Nutzung nicht erlaubt.",
      "", "## Besetzung – welche Stimme passt zu wem", "",
      "| Rolle | Alter | So soll sie klingen | Suche in der Voice Library | Einstellungen (Multilingual v2) |", "|---|---|---|---|---|"]
for k, c in CASTING.items():
    md.append(f"| **{c['name']}** | {c['alter']} | {c['stimme']} | {c['suche']} | {c['settings']} |")
md += ["",
       "Bei **Eleven v3** entspricht „Stability“ dem Regler Creative / Natural / Robust:",
       "- **Natural** für 1, 2 und die Zentrale.",
       "- **Creative** für 6, 7 und Orange Jacke, damit Flüstern, Schreien und Keuchen gut rauskommen.", "",
       "## Funk-Regeln (damit es echt klingt)", "",
       "- Immer **zuerst wer ruft, dann wer gemeint ist**: „Vier an alle: …“, „Zentrale für Falke: …“, „Sechs an alle: …“.",
       "- Kurz, keine ganzen Sätze, deutlich. Beim Anschleichen **geflüstert**, im Zugriff **laut und abgehackt**.",
       "- Keine Namen, nur Nummern. Du bist **Sechs**.", "",
       "## Alle Zeilen nach Rolle (zum Abarbeiten pro Stimme)", ""]
for rolle, c in CASTING.items():
    md += [f"### {c['name']}", "", "| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |", "|---|---|---|---|"]
    for z in TL["dialog"]:
        if ROLLE[z["wer"]] != rolle:
            continue
        txt, regie = ZEILEN[z["id"]]
        funk = " **(FUNK)**" if z["funk"] else ""
        md.append(f"| `{z['id']}.mp3` | {zeit(start[z['szene']] + z['start'])} | {txt} | {regie}{funk} |")
    md.append("")
md += ["## Komplettes Skript in Reihenfolge", "", "| Zeit | Wer | Text |", "|---|---|---|"]
for z in TL["dialog"]:
    md.append(f"| {zeit(start[z['szene']] + z['start'])} | {TL['sprecher'][z['wer']][0]} | {ZEILEN[z['id']][0]} |")
md.append("")
text = "\n".join(md)
(REPO / "ideen" / "falke-01-sprecher-skript.md").write_text(text)
(HIER / "stimmen" / "SPRECHER-SKRIPT.md").write_text(text)
print("Sprecher-Skript + stimmen/skript.csv geschrieben:", len(TL["dialog"]), "Zeilen")
