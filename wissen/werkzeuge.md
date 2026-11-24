# Werkzeuge

## Bilder und Videos: selbst mit Code erzeugt
Es gibt kein externes Bild-Tool. Der Produzent baut alles selbst:
- **Python + Pillow** für Bilder: Hintergründe, Farbverläufe, große Texte, Formen, Emojis, Diagramme, Memes im eigenen Stil
- **ffmpeg** für Bewegung: Zoom/Schwenk (zoompan), Überblendungen, Text-Animationen, Wackeln, Schnitt im Takt
- Optional **HTML/CSS-Animationen**, wenn ein Browser-Renderer installiert ist
Stil-Ideen, die mit Code gut aussehen: große animierte Texte, „Fakten“-Karten, Countdown-Listen,
Chat-Verläufe, Quiz/Rätsel, Zahlen-Vergleiche, minimalistische Grafiken.

## Stimme: ElevenLabs
- Aufruf: `python tools/stimme.py --datei videos/<slug>/text.txt videos/<slug>/stimme.mp3`
- Schlüssel und Stimme stehen in `.env` (siehe `.env.example`)
- Modell: `eleven_multilingual_v2` (Deutsch)
- Zeichen sparen: Sprechertext erst fertig machen, dann EINMAL vertonen. Nicht für jeden kleinen Fix neu vertonen.
- Lizenz: Für Geld-Videos (Monetarisierung) braucht es einen bezahlten ElevenLabs-Plan.
  Im Gratis-Plan keine kommerzielle Nutzung und Pflicht-Hinweis „elevenlabs.io“ im Titel.

## Lokal nötig
- ffmpeg, ffprobe
- Python 3 mit Pillow (`pip install pillow`)
