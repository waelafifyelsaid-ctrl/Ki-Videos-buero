# EINHEIT FALKE · Einsatz 01 – Sprecher-Skript für ElevenLabs

Fertige Sprechfassung aller 39 Sätze. Zahlen sind ausgeschrieben, damit ElevenLabs sie richtig spricht.
In eckigen Klammern stehen Regie-Tags für das Modell **Eleven v3**. Bei **Multilingual v2** lässt du sie weg und nutzt die Spalte „ohne Tags“ in `stimmen/skript.csv`.

## So geht's

1. **Stimmen auswählen:** Für jede Rolle unten eine deutsche Stimme in der Voice Library suchen. Die Suchbegriffe stehen in der Tabelle.
   Wichtig: 7 Rollen, 7 **verschiedene** Stimmen. 1, 2 und 6 dürfen sich nicht ähneln.
2. **Jede Zeile einzeln erzeugen** (nicht alles am Stück) und als MP3 speichern, **Dateiname = ID**, z. B. `22_zugriff_1.mp3`.
3. **Funksprüche (FUNK) trocken aufnehmen**, ohne Funk-Effekt. Das Rauschen, den Funkfilter und das Klicken baut unser Schnitt automatisch ein.
4. **Keine Musik und keine Effekte** in ElevenLabs. Explosionen, Regen usw. liegen schon im Video.
5. Alle MP3s nach `videos/falke-01-3d/stimmen/` legen und `./build.sh` starten. Dann passiert automatisch:
   - Die Untertitel richten sich nach der echten Länge jeder Aufnahme.
   - Funksprüche bekommen den Funk-Klang.
   - Hintergrundgeräusche werden leiser, solange jemand spricht.
6. **Automatisch statt Klicken:** Trag die Voice-IDs in `.env` ein (`ELEVENLABS_STIMME_6=…`, `_1`, `_2`, `_4`, `_7`, `_Z`, `_F`) und starte
   `python3 videos/falke-01-3d/stimmen_erzeugen.py`. Das Skript erzeugt alle 39 Dateien mit den Einstellungen unten.
7. **Lizenz:** Für Videos, mit denen du Geld verdienst, brauchst du einen bezahlten ElevenLabs-Plan. Im Gratis-Plan ist kommerzielle Nutzung nicht erlaubt.

## Besetzung – welche Stimme passt zu wem

| Rolle | Alter | So soll sie klingen | Suche in der Voice Library | Einstellungen (Multilingual v2) |
|---|---|---|---|---|
| **6 – DU (der Neue)** | Anfang 20 | junger Mann, hell-mittel, frech, schnell, Umgangssprache, leicht ironisch | German · male · young · conversational / casual | Stability 0.35 · Similarity 0.75 · Style 0.45 · Speaker Boost an |
| **1 – Teamführer** | Mitte 50 | tief, ruhig, rau, sehr knapp, null Emotion – wenn er laut wird, hört jeder zu | German · male · old/middle aged · deep · authoritative / gravelly | Stability 0.65 · Similarity 0.8 · Style 0.15 |
| **2 – Türöffner** | Mitte 30 | sehr tiefer Bass, langsam, gemütlich, trocken-witzig (sagt alles todernst) | German · male · deep · bass · calm | Stability 0.55 · Similarity 0.75 · Style 0.3 |
| **4 – Präzision & Drohne** | um 30 | Frau, klar, kühl, präzise, trockener Sarkasmus; im Einsatz laut und schneidend | German · female · middle aged · confident / professional | Stability 0.45 · Similarity 0.75 · Style 0.35 |
| **7 – Technik** | Mitte 20 | Mann, eher hoch, schnell, nervös, nerdig, verhaspelt sich fast | German · male · young · energetic / nervous | Stability 0.3 · Similarity 0.75 · Style 0.55 |
| **ZENTRALE (Chefin)** | Ende 50 | Frau, sachlich, ruhig, wie eine Nachrichtensprecherin, kein Lächeln | German · female · old · news / narration / authoritative | Stability 0.7 · Similarity 0.8 · Style 0.1 |
| **ORANGE JACKE (Fake-Fuchs)** | um 30 | Mann, großspurig, schnodderig, etwas Straße; am Boden außer Atem, aber frech | German · male · middle aged · casual / street / cocky | Stability 0.35 · Similarity 0.75 · Style 0.5 |

Bei **Eleven v3** entspricht „Stability“ dem Regler Creative / Natural / Robust:
- **Natural** für 1, 2 und die Zentrale.
- **Creative** für 6, 7 und Orange Jacke, damit Flüstern, Schreien und Keuchen gut rauskommen.

## Funk-Regeln (damit es echt klingt)

- Immer **zuerst wer ruft, dann wer gemeint ist**: „Vier an alle: …“, „Zentrale für Falke: …“, „Sechs an alle: …“.
- Kurz, keine ganzen Sätze, deutlich. Beim Anschleichen **geflüstert**, im Zugriff **laut und abgehackt**.
- Keine Namen, nur Nummern. Du bist **Sechs**.

## Alle Zeilen nach Rolle (zum Abarbeiten pro Stimme)

### 6 – DU (der Neue)

| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |
|---|---|---|---|
| `01_hook_6.mp3` | 0:00.5 | [außer Atem] Okay … das war lauter als geplant. | nach der Explosion, Ohren klingeln, halb lachend |
| `02_hq_6.mp3` | 0:06.0 | [grinsend] Zwei, das ist dein drittes Frühstück. | lässig, stichelnd über den Tisch |
| `07_briefing_6.mp3` | 0:21.4 | [frech] Und was ist UNSER Plan B? | Betonung auf UNSER |
| `11_spind_6.mp3` | 0:30.5 | [sarkastisch] Danke, Mama. | kurz, augenrollend |
| `15_van_6.mp3` | 0:41.0 | [grinsend] Sieben, du bist ein Angsthase mit Weh-Lan. | stichelnd; „WLAN“ deutsch ausgesprochen |
| `29_verfolgung_6.mp3` | 1:18.4 | [rennend, außer Atem] Stehen bleiben, du Billig-Fuchs! | beim Sprinten gerufen, keuchend |
| `31_verfolgung_6.mp3` | 1:24.4 | [außer Atem, bestimmt] Hände auf den Rücken! | kniend, keuchend, aber Kommandoton |
| `32_verfolgung_6.mp3` | 1:26.6 | [grinsend, schnaufend] Plan B war wohl: ausrutschen. | zufrieden, noch außer Atem |
| `34_verfolgung_6f.mp3` | 1:31.5 | [außer Atem] Sechs an alle: Person gesichert. Kai Nord. | FUNK – stolz, schnaufend **(FUNK)** |
| `38_twist_6.mp3` | 1:43.2 | [kleinlaut] Ich hab Flugangst. | plötzlich gar nicht mehr frech |

### 1 – Teamführer

| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |
|---|---|---|---|
| `04_hq_1.mp3` | 0:13.0 | Briefing. Sofort. | ruhig, aber keine Widerrede – Alarm läuft |
| `08_briefing_1.mp3` | 0:23.5 | Zwei. | ein Wort, trocken, ohne hinzusehen |
| `12_spind_1.mp3` | 0:32.3 | [laut] Abfahrt! | aus dem Gang gerufen |
| `17_van_1.mp3` | 0:46.4 | Wir sind da. Masken auf. | leise, konzentriert – ab jetzt Einsatz |
| `19_anschleichen_1f.mp3` | 0:52.6 | [flüsternd] Verstanden. Leise rein, wie besprochen. | FUNK – sehr ruhig **(FUNK)** |
| `22_zugriff_1.mp3` | 0:59.6 | [flüsternd] Auf mein Zeichen. Drei … zwei … eins … | langsam, gleichmäßig – je eine Sekunde zwischen den Zahlen |
| `24_zugriff_1.mp3` | 1:04.6 | [schreit] ZUGRIFF! | voller Kommandoton |
| `28_innen_1.mp3` | 1:15.1 | [laut] Sechs – hinterher! | Befehl, scharf |
| `37_twist_1.mp3` | 1:40.9 | Packt eure Sachen. Wir fliegen. | ruhig, entschlossen |

### 2 – Türöffner

| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |
|---|---|---|---|
| `03_hq_2.mp3` | 0:08.7 | [mit vollem Mund] Viertes. | todernst, kauend, keine Pause |
| `09_briefing_2.mp3` | 0:25.0 | [stolz, ruhig] Ich bin Plan A bis Z. | langsam, zufrieden |
| `16_van_2.mp3` | 0:43.8 | [ruhig] Lass ihn. Er hat heute schon geweint. | gutmütig, todernst |
| `20_anschleichen_2.mp3` | 0:55.4 | [flüsternd] Ich bin IMMER leise. | geflüstert, beleidigt – direkt danach rempelt er die Tonne an |
| `21_zugriff_2.mp3` | 0:57.8 | [flüsternd] Ladung gesetzt. | knapp, konzentriert |
| `27_innen_2.mp3` | 1:13.1 | [trocken] Hingefallen. Komisch. | auf dem Ganoven kniend, null Stress |
| `39_twist_2.mp3` | 1:45.0 | [ernst] Ich hab Hunger. | todernst – Pointe |

### 4 – Präzision & Drohne

| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |
|---|---|---|---|
| `10_spind_4.mp3` | 0:27.7 | [trocken] Visier runter, Neuer. Heute wird's laut. | beiläufig beim Helm-Aufsetzen |
| `18_anschleichen_4f.mp3` | 0:49.2 | [flüsternd] Vier an alle: Drohne oben. Drei Personen im Gebäude. | FUNK – gedämpft, schnell, präzise **(FUNK)** |
| `23_zugriff_4.mp3` | 1:02.9 | [ruft] Flash raus! | kurz und scharf, während sie wirft |
| `25_innen_4.mp3` | 1:07.4 | [schreit] POLIZEI! Hände hoch! Auf den Boden! | sehr laut, abgehackt, jedes Kommando einzeln |

### 7 – Technik

| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |
|---|---|---|---|
| `14_van_7v.mp3` | 0:38.3 | [nervös] Ich hasse Regen. Und Häfen. Und Möwen. | aufgezählt, wird bei jedem Punkt jammernder |
| `26_innen_7.mp3` | 1:10.0 | [aufgeregt] Orange Jacke! Hinterausgang – er ist raus! | FUNK – hektisch, überschlägt sich fast **(FUNK)** |
| `35_twist_7v.mp3` | 1:35.1 | [zögernd] Leute … das ist nicht der Fuchs. Nur sein Fahrer. | liest vom Tablet ab, Stimmung kippt |

### ZENTRALE (Chefin)

| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |
|---|---|---|---|
| `05_briefing_Z.mp3` | 0:15.2 | Lagerhaus Sieben am Hafen. Vierzig Millionen in Drogen. | sachlich, Fakten vorlesen |
| `06_briefing_Z.mp3` | 0:18.3 | Zielperson: der Fuchs. Hat immer einen Plan B. | leicht warnend bei „Plan B“ |
| `13_van_Zf.mp3` | 0:34.4 | Zentrale für Falke: Zielobjekt bestätigt. Zugriff freigegeben. | FUNK – sachlich, deutlich, ohne Eile **(FUNK)** |

### ORANGE JACKE (Fake-Fuchs)

| ID / Dateiname | Zeit | Text für ElevenLabs | Regie |
|---|---|---|---|
| `30_verfolgung_F.mp3` | 1:21.0 | [lachend, rennend] Fang mich doch, Anfänger! | über die Schulter, großspurig |
| `33_verfolgung_F.mp3` | 1:28.9 | [gepresst, frech] Ihr habt keine Ahnung, wer ich bin … | Gesicht am Boden, trotzdem großspurig |
| `36_twist_F.mp3` | 1:38.4 | [grinsend] Der echte Fuchs fliegt um sechs. | genüsslich, langsam |

## Komplettes Skript in Reihenfolge

| Zeit | Wer | Text |
|---|---|---|
| 0:00.5 | 6 · DU | [außer Atem] Okay … das war lauter als geplant. |
| 0:06.0 | 6 · DU | [grinsend] Zwei, das ist dein drittes Frühstück. |
| 0:08.7 | 2 | [mit vollem Mund] Viertes. |
| 0:13.0 | 1 | Briefing. Sofort. |
| 0:15.2 | ZENTRALE | Lagerhaus Sieben am Hafen. Vierzig Millionen in Drogen. |
| 0:18.3 | ZENTRALE | Zielperson: der Fuchs. Hat immer einen Plan B. |
| 0:21.4 | 6 · DU | [frech] Und was ist UNSER Plan B? |
| 0:23.5 | 1 | Zwei. |
| 0:25.0 | 2 | [stolz, ruhig] Ich bin Plan A bis Z. |
| 0:27.7 | 4 | [trocken] Visier runter, Neuer. Heute wird's laut. |
| 0:30.5 | 6 · DU | [sarkastisch] Danke, Mama. |
| 0:32.3 | 1 | [laut] Abfahrt! |
| 0:34.4 | ZENTRALE · FUNK | Zentrale für Falke: Zielobjekt bestätigt. Zugriff freigegeben. |
| 0:38.3 | 7 | [nervös] Ich hasse Regen. Und Häfen. Und Möwen. |
| 0:41.0 | 6 · DU | [grinsend] Sieben, du bist ein Angsthase mit Weh-Lan. |
| 0:43.8 | 2 | [ruhig] Lass ihn. Er hat heute schon geweint. |
| 0:46.4 | 1 | Wir sind da. Masken auf. |
| 0:49.2 | 4 · FUNK | [flüsternd] Vier an alle: Drohne oben. Drei Personen im Gebäude. |
| 0:52.6 | 1 · FUNK | [flüsternd] Verstanden. Leise rein, wie besprochen. |
| 0:55.4 | 2 | [flüsternd] Ich bin IMMER leise. |
| 0:57.8 | 2 | [flüsternd] Ladung gesetzt. |
| 0:59.6 | 1 | [flüsternd] Auf mein Zeichen. Drei … zwei … eins … |
| 1:02.9 | 4 | [ruft] Flash raus! |
| 1:04.6 | 1 | [schreit] ZUGRIFF! |
| 1:07.4 | 4 | [schreit] POLIZEI! Hände hoch! Auf den Boden! |
| 1:10.0 | 7 · FUNK | [aufgeregt] Orange Jacke! Hinterausgang – er ist raus! |
| 1:13.1 | 2 | [trocken] Hingefallen. Komisch. |
| 1:15.1 | 1 | [laut] Sechs – hinterher! |
| 1:18.4 | 6 · DU | [rennend, außer Atem] Stehen bleiben, du Billig-Fuchs! |
| 1:21.0 | ORANGE JACKE | [lachend, rennend] Fang mich doch, Anfänger! |
| 1:24.4 | 6 · DU | [außer Atem, bestimmt] Hände auf den Rücken! |
| 1:26.6 | 6 · DU | [grinsend, schnaufend] Plan B war wohl: ausrutschen. |
| 1:28.9 | ORANGE JACKE | [gepresst, frech] Ihr habt keine Ahnung, wer ich bin … |
| 1:31.5 | 6 · DU · FUNK | [außer Atem] Sechs an alle: Person gesichert. Kai Nord. |
| 1:35.1 | 7 | [zögernd] Leute … das ist nicht der Fuchs. Nur sein Fahrer. |
| 1:38.4 | ORANGE JACKE | [grinsend] Der echte Fuchs fliegt um sechs. |
| 1:40.9 | 1 | Packt eure Sachen. Wir fliegen. |
| 1:43.2 | 6 · DU | [kleinlaut] Ich hab Flugangst. |
| 1:45.0 | 2 | [ernst] Ich hab Hunger. |
