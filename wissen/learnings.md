# Learnings des Büros

Hier schreibt der Optimierer rein, was funktioniert und was nicht.
Der Ideen-Scout liest diese Datei vor jeder neuen Idee.

## Bewährt
- (noch leer – kommt nach den ersten Videos)

## Vermeiden
- (noch leer)

## Laufende Experimente
- Vermutung (1 Video): Provokations-Hook „Du lernst falsch.“ + Nutzen-Liste (1-3-7-Regel). Zahlen nach dem Posten eintragen.
- Vermutung: Video ohne Stimme, nur Bildschirmtext + eigener Beat – mit späterem Stimm-Video vergleichen.

- Format-Test: Cartoon-Serie „Wie ist es …“ (Haus-Querschnitt oben/unten) vs. Text-Karten-Video. Nutzer-Wunsch: viel mehr Animation → Cartoon ist jetzt der Standard-Stil.

- Nutzer-Feedback (Nachbar-Video): gut, aber mehr Übergänge, POV-Ansichten, Dialog-Skript mit frechen
  Beleidigungen der Ich-Figur, immer über 1 Minute → als feste Regeln in CLAUDE.md übernommen.

- Neue Serie EINHEIT FALKE (Nutzer-Wunsch nach Referenz-Video „animated story deutsch", POV, 124k Likes):
  Explosion als Hook, Hauptquartier → Einsatz → Cliffhanger, über 1 Minute.

- Nutzer-Feedback Einsatz 01: Richtung „sehr gut“, aber: keine Babbel-Töne zum Text, NUR POV, etwas realistischer.
  → Serie EINHEIT FALKE ab jetzt: komplett Ich-Sicht, Bodycam-Look, Dialog nur als Untertitel, keine Comic-Wörter.

- Nutzer-Feedback POV-Fassung: „sehr gut“ → jetzt 3D-Figuren, besserer Zugriff, keine Namen (Nummern, Ich = 6),
  mehr Details (auch im Van), Untertitel nicht mittig + nie abgeschnitten, Fake-Fuchs sichtbar fliehen lassen,
  Handschellen wirklich anlegen.

- Nutzer-Feedback 3D-Fassung: „sehr sehr gut“. Personen-Vorstellung war zu schnell (jetzt 1,6 s pro Person),
  Blendgranate kam zu spät (jetzt direkt nach der Sprengung, VOR dem Eindringen). Wunsch: echte Stimmen per ElevenLabs.

## Technik-Learnings (Produktion)
- 3D-Pipeline: Three.js + Headless-Chromium (SwiftShader) rendert ~0,2–0,5 s/Bild; 4 Browser parallel.
- Hochkant-Kamera ist horizontal sehr eng (≈45° bei 74° vertikal): Figuren nah an die Bildachse stellen.
- Nachts Belichtung hoch (toneMappingExposure ~1.35), Hemisphären-Licht ~0.85, sonst ist alles schwarz.
- Sprites (Rauch/Feuer) direkt vor der Kamera machen das Bild grau/weiß → nach Kamera-Abstand ausblenden.
- Welt-Zustand bleibt zwischen Bildern erhalten: jede Szene muss Sichtbarkeit/Türen ihrer Objekte selbst setzen.
- Dialog-Timing zentral in timeline.json; timeline.py legt Zeilen überschneidungsfrei mit Lesedauer 0,75 s + 0,048 s/Zeichen.
- Bodycam-Look: `bodycam()` in `videos/falke-01-lagerhaus-pov/animation.py` (Weitwinkel-Wölbung, Vignette, Korn, REC-Anzeige).
- Realistischer Ton statt Stimmen: Schritte, Atmen, Herzschlag, Spind/Türen/Durchladen (Funktionen in `ton()`).
- Objekte, an denen die Kamera vorbeiläuft (Laternen), müssen hinter der Kamera übersprungen werden (sonst Division durch 0).
- Nachts: Figuren in eigener Ebene (`ebene()`), sonst verschwinden dunkle Uniformen im Hintergrund.
- Perspektive: Figuren sehr nah an der Kamera (dz < 2 m) landen seitlich außerhalb des Bildes – Vordergrund-Figuren
  mit 2,5–3,5 m Abstand platzieren und die Hauptfiguren dazwischen sichtbar lassen.
- Comic-Streifen: Figur so setzen, dass der Kopf im Streifen ist (Füße bei ca. 1,6 × Streifenhöhe).
- Langfassung-Vorlage: `videos/wie-ist-es-lauter-nachbar-lang/` – Szenenliste `SZ` (Typ, Dauer, Übergang),
  `DIALOG`-Liste (Szene, Zeit, wer, Text) → Blasen, Untertitel, Mundbewegung und Babbel-Ton entstehen automatisch.
  `python3 animation.py skript` druckt das Dialog-Skript mit echten Zeiten.
- Babbel-Stimmen brauchen ca. 0,6 Lautstärke im Mix, sonst gehen sie unter den Stampf-Geräuschen unter.
- Lange Texte auf Zeitsprung-Karten immer mit `maxw` begrenzen.
- Cartoon-Stil: Cairo (`pip install pycairo`) statt Pillow – glatte Vektor-Figuren mit Gelenken, jeder Frame neu gezeichnet. Vorlage: `videos/wie-ist-es-lauter-nachbar/animation.py`.
- Alles als Funktion der Zeit t schreiben (keine Zustände) → Frames parallel in 4 Prozessen rendern, 29 s Video in ~15 s.
- Soundeffekte selbst mit numpy bauen (Stampfen, gedämpfter Bass, Schreie, Staubsauger) – macht auch ohne Stimme viel aus.
- Vor dem Rendern Einzelbilder an Schlüsselstellen prüfen (`animation.py bild <t>`): Figuren dürfen nicht durch Decken springen, gespiegelte Figuren spiegeln auch Text.
- Pillow-Text: max. ~190 px Schriftgröße für 6–7 Buchstaben, sonst läuft er beim Zoom über den Rand. Immer `max_breite≈900` nutzen.
- Mehrzeilige Texte fließend setzen (y aus der vorherigen Zeile), nie feste y-Werte – sonst Überlappungen.
- Grafiken müssen die Botschaft zeigen: „Wissen bleibt“ = Kurve muss am Ende oben sein.
- Filmkorn, das sich jedes Frame ändert, bläht die Datei auf (530 MB!). Korn schwach halten und beim Zusammenfügen
  mit Bitrate-Deckel kodieren (`-crf 23 -maxrate 4M`) → ca. 40 MB. GitHub erlaubt max. 100 MB pro Datei.
- Ablauf Zugriff realistisch: Sprengung → „Flash raus!“ + Blendgranate durchs Loch → Knall → „ZUGRIFF!“ → Eindringen.
- Sprachaufnahmen bestimmen das Timing: timeline.py liest die Länge jeder Datei in stimmen/ und verlängert die Zeile.
