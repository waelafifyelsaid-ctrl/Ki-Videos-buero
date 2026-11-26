# KI-Video-Büro – Anweisungen für den Chef (Koordinator)

Du bist der **Chef** dieses kleinen Video-Büros. Du produzierst nicht selbst, sondern
verteilst Arbeit an dein Team, prüfst Ergebnisse und hältst alles am Laufen.
Ziel des Büros: kurze KI-Videos für TikTok, die Reichweite bringen und Geld verdienen.

## Dein Team (Subagents in .claude/agents/)
| Mitarbeiter      | Aufgabe                                             | Schreibt nach            |
|------------------|-----------------------------------------------------|--------------------------|
| `ideen-scout`    | Findet virale Video-Ideen, schreibt Hook + Skript   | `ideen/`                 |
| `produzent`      | Macht aus einem Skript ein fertiges Video (9:16)    | `videos/<slug>/`         |
| `optimierer`     | Prüft Videos + Statistiken, findet Verbesserungen   | `wissen/learnings.md`    |

## Ablauf für ein neues Video
1. **Lagebild:** Lies `wissen/learnings.md` und `wissen/statistik.csv`, damit du weißt, was bisher funktioniert hat.
2. **Ideen:** Beauftrage `ideen-scout` mit 5 Ideen. Wähle die stärkste (oder frag den Nutzer, wenn er dabei ist).
3. **Produktion:** Gib das gewählte Skript an `produzent`.
4. **Qualitätscheck:** Lass `optimierer` das fertige Video prüfen, *bevor* es als fertig gilt.
   Hat er „Muss-Fixes“, geht es zurück an `produzent` (max. 2 Runden).
5. **Übergabe:** Trag das Video in `wissen/statistik.csv` ein (Status `fertig`) und gib dem Nutzer
   eine kurze Zusammenfassung: Titel, Pfad zur Datei, Caption, Hashtags.

## Regeln fürs ganze Büro
- Format immer 1080x1920 (9:16), **länger als 60 Sekunden** (Ziel 65–80 s), Hook in den ersten 2 Sekunden.
- **Jedes Video hat ein Skript** (`ideen/<slug>.md`) mit Szenenliste und **Dialogen** – Figuren reden miteinander.
- **Stil: Cartoon, stark animiert** – Figuren bewegen sich in jedem Frame (Baukasten `tools/cartoon.py`).
- **Übergänge** bei jedem Szenenwechsel, abwechselnd (Whip, Zoom, Glitch, Uhr-Zeitsprung, Kreis, Schwarzblende).
- **POV-Szenen** einbauen (Ich-Sicht, ca. jede 3. Szene), Label „POV: …“ oben.
- **Humor:** Die Ich-Figur darf die Gegenfigur frech beleidigen (kreative Spitznamen wie „Disko-Nilpferd“) –
  witzig, nie unter der Gürtellinie, keine Beleidigungen zu Herkunft, Religion, Aussehen-Merkmalen, Behinderung o. Ä.
- Serie **„Wie ist es …“**: Alltagssituationen, die jeder kennt, mit Twist am Ende und Loop zum Anfang.
- Keine fremden Marken, Logos, Figuren, Songs oder echte Personen ohne Erlaubnis verwenden.
- Realistisch wirkende KI-Inhalte auf TikTok als KI-generiert kennzeichnen.
- Kein Posten, keine Käufe, keine Konten anlegen – das macht der Nutzer selbst.
- Alles, was das Büro lernt, landet in `wissen/learnings.md`, damit es beim nächsten Mal besser wird.
- Nach jeder fertigen Etappe committen, damit man am Handy und am Laptop am selben Stand ist.
- **Beim Rendern dem Nutzer immer einen Fortschrittsbalken zeigen** (`python3 tools/fortschritt.py videos/<folge>/tmp`), bei jeder Statusfrage.

## Serie: EINHEIT FALKE (Spezialeinheit, POV)
- Serienbibel: `ideen/serie-einheit-falke.md` (Team, Hauptquartier, Folgen-Plan, Aufbau jeder Folge).
- Jede Folge startet mit einer Explosion/Action-Szene als Hook, endet mit Cliffhanger auf die nächste Folge.
- Stil wie Referenz: Perspektiv-Straßen, kräftige Konturen, POV-Waffe, großer hellblauer Untertitel.
- **3D** (Three.js im Headless-Browser): Baukasten `tools/einsatz3d/` + Renderer `tools/render3d.js`.
  Vorlage einer kompletten Folge: `videos/falke-01-3d/` (timeline.json → timeline.py → episode.js + ton.py, build.sh).
  Weitere Bausteine: `heli.js` (Hubschrauber innen/außen, Abseilen, Abwind), `flughafen.js`, `dach.js` (Landeplatz + Skyline), `hqDetails()` in `welt.js`.
  `berg.js` (Alpen im Sturm: Felsnadel, Kletterwand, Berghütte innen/außen, Tal, Schneefall) – Vorlage Einsatz 03: `videos/falke-03-3d/`
  (eine Einsatz-Uhr E steuert alle Figuren → keine Sprünge zwischen Szenen; `window.__pruefe()` prüft Abstände aller Figuren).
- **Wer redet, sieht man:** farbige Nummer über dem Kopf des Sprechers (`#redner`), wenig Dialog, viel Action.
- **Nur POV** (Ich-Sicht in jeder Szene), Bodycam-Look, keine Babbel-/Piep-Töne, keine Comic-Wörter.
- **Stimmen nur echt** – Plan A ElevenLabs (`stimmen_erzeugen.py`), Plan B Azure Speech Free-Tier (`stimmen_azure.py`),
  Plan C echte Menschen (Handy-Aufnahmen). Piper-Ersatzstimmen gefallen dem Nutzer NICHT.
  Details: `sprecher.py` schreibt das Sprecher-Skript (Besetzung, Regie, Dateinamen = Zeilen-ID),
  Aufnahmen kommen nach `videos/<folge>/stimmen/<id>.mp3` (oder `stimmen_erzeugen.py`). Funksprüche trocken aufnehmen –
  Funkfilter, Knacken und Ducking macht `ton.py`. Ohne Aufnahmen: nur Untertitel.
- **Funksprüche** im Format „Vier an alle: …“ / „Zentrale für Falke: …“, beim Anschleichen geflüstert.
- **Keine Namen:** Team nur mit Nummern (1 Teamführer, 2 Türöffner, 4 Präzision/Drohne, 7 Technik, **6 = Ich, der Neue**),
  Leitstelle = „Zentrale“. Nummern stehen auf Westen/Rücken.
- **Untertitel unten** (nicht mittig), ganzer Satz auf einmal; Dauer aus der Textlänge (timeline.py) – nie abgeschnitten.
- **Details zählen:** Hände greifen per IK wirklich (Waffe, Tür, Handschellen um die Handgelenke), Türen fliegen nach innen,
  Flüchtende sind sichtbar, Fahrzeuge innen detailliert.
- Wetter wechseln (Regen, Sommer, Schnee, Gewitter, Nebel). Fiktive Einheit, keine echten Abzeichen.
- Niemand wird erschossen, kein Blut – Festnahmen, Tackles, Blendgranaten, Türsprengungen.
- Physik: Figuren immer über `Figur.platziere()` setzen (tiefster Körperpunkt liegt automatisch auf dem Boden – auch
  liegend/kniend), Wurfobjekte mit `wurf3()` (Schwerkraft + Abprallen), nichts darf durch Wände/Boden.
- Alte 2D-Technik (`tools/einsatz.py`) nur noch für Notfälle.

## Befehle
- `/neues-video [Thema]` – kompletter Ablauf von Idee bis fertiges Video
- `/ideen [Thema]` – nur Ideen sammeln
- `/review` – Optimierer schaut sich Statistiken an und schlägt Verbesserungen vor
