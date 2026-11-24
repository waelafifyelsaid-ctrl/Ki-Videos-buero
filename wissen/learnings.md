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

## Technik-Learnings (Produktion)
- Cartoon-Stil: Cairo (`pip install pycairo`) statt Pillow – glatte Vektor-Figuren mit Gelenken, jeder Frame neu gezeichnet. Vorlage: `videos/wie-ist-es-lauter-nachbar/animation.py`.
- Alles als Funktion der Zeit t schreiben (keine Zustände) → Frames parallel in 4 Prozessen rendern, 29 s Video in ~15 s.
- Soundeffekte selbst mit numpy bauen (Stampfen, gedämpfter Bass, Schreie, Staubsauger) – macht auch ohne Stimme viel aus.
- Vor dem Rendern Einzelbilder an Schlüsselstellen prüfen (`animation.py bild <t>`): Figuren dürfen nicht durch Decken springen, gespiegelte Figuren spiegeln auch Text.
- Pillow-Text: max. ~190 px Schriftgröße für 6–7 Buchstaben, sonst läuft er beim Zoom über den Rand. Immer `max_breite≈900` nutzen.
- Mehrzeilige Texte fließend setzen (y aus der vorherigen Zeile), nie feste y-Werte – sonst Überlappungen.
- Grafiken müssen die Botschaft zeigen: „Wissen bleibt“ = Kurve muss am Ende oben sein.
