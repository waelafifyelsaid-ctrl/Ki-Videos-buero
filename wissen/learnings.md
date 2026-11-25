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

## Technik-Learnings (Produktion)
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
