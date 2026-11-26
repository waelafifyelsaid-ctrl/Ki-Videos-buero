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
- Piper-Ersatzstimmen (lokal, gratis) klingen zu künstlich – Nutzer lehnt sie ab. ElevenLabs-Credits sind knapp.
  Plan B: Azure Speech Free-Tier (offiziell, 500k Zeichen/Monat, ~20 deutsche Neural-Stimmen). Inoffizielle Edge-Vorlese-Zugänge nicht nutzen.
- Hintergrundmusik selbst komponiert per Code (`tools/musik.py`, d-Moll, pro Szene eigene Stimmung, Stille nach der Sprengung, Action ab „ZUGRIFF!“). Nur Ton neu bauen: `nur_ton.sh` (kein neues Rendern nötig).
- Einsatz 02: Kabinen in Flugzeugen sind eng – Sitzlehnen verdecken schnell die Sicht. Kamera in die Gangmitte stellen.
- Stimmen: laute Zeilen (schreien/rufen) gleich mit eleven_multilingual_v2, Rest mit v3 „Natural“ + festem Seed → Figuren klingen konstant.
- Einsatz 02 (Fassung 2): Module `tools/einsatz3d/heli.js` (Hubschrauber außen+innen, Piloten, Rotor, Abseilseil, Abwind),
  `flughafen.js` (Terminal, Tower, Hangars, Fahrzeuge, Markierungen) und `dach.js` (Landeplatz, Skyline) sind wiederverwendbar.
- Hubschrauber-Innenraum: Kamera muss innerhalb der Türöffnung sitzen, sonst verdeckt die Seitenwand/Schiebetür den Blick nach draußen.
- Zylinder liegen nach `rotation.x = π/2` entlang z – zum Plattdrücken dann `scale.z` nehmen, nicht `scale.y` (sonst wird er nur kürzer).
- POV-Hände am Seil: Greifpunkte 0,35–0,6 m UNTER der Kamera wählen und Kamera auf die Rumpf-Seite des Seils setzen, sonst liegen Hände/Seil außerhalb des Bildes.
- Neue Sprachzeilen ohne alte neu zu erzeugen: `stimmen/zuordnung.json` (Text → Datei); timeline.py und stimmen_erzeugen.py nutzen sie.
- Jet-Nase als HALBkugel bauen: eine ganze, gestreckte Kugel ragt nach hinten in die Kabine und verdeckt das Cockpit (grauer Bildschirm).
- Geparkte Flugzeuge mit Abstand zum Rollweg platzieren (Heck/Flügel nachrechnen) – sonst fährt der Jet durch sie hindurch.
- Zugriff staffeln: jede Figur bekommt eigene Zeitfenster auf der Treppe (2 → 1 → 4 → Kamera), an der niedrigen Tür ducken.
- Bei Dialog-Szenen in engen Räumen Kamera seitlich versetzen und Team an den Rand stellen, damit niemand Sprecher/Action verdeckt.
- Endkarte mit LIKE + FOLGEN-Buttons (3 s) + „Teil 3 kommt bald“; Musik im Mix lauter (Musik 1,25 : Geräusche 0,5, Ducking 30 %).
- Zierstreifen/Anbauteile am Rumpf an der Türöffnung unterbrechen – sonst laufen Figuren sichtbar „durch den Strich“.
- Club-Sitze im Jet: Tische gehören zwischen die GEGENÜBER-Sitze (Beinraum), nicht zwischen Rücken an Rücken.
- Kamera im Jet immer im Gang lassen (x ≈ 0…0,1); für den Blick auf die Festnahme den Kollegen seitlich in den Beinraum knien lassen.
- Neue Zeile für 6 mit v3 klang höher (147 Hz statt ~105 Hz) → mit `NUR_V2=1 python3 stimmen_erzeugen.py` neu: 111 Hz, passt.
- Mehr Leben im Bild: Einweiser mit Warnweste + Leuchtkellen, Crew-Chief an der Heli-Tür, Flughafenfeuerwehr mit Blaulicht, Seilhaufen am Boden.
- Gespräche lesbar machen: `schaueAn()` dreht den Kopf (im Halsraum gerechnet) zum Angesprochenen, `nicken()` beim Reden,
  Zuhörer schauen zum Sprecher, Funk = Hand ans Headset, eigene Zeilen (6) = linke POV-Hand gestikuliert (`pov.setze({geste})`),
  Kamera schwenkt kurz zum Sprecher. Dazu Bodycam-Mikropegel im HUD (voll bei 6, Funk-Lampe bei Funksprüchen).
- Laufwege vor dem Rendern numerisch prüfen (Abstand ≥ 1,2 m zwischen allen Figuren und der Kamera) – Skript-Idee: pfad() abtasten.
- Countdown spektakulär: Kamera weiter weg (Tür + Rumpf + Heli mit Suchscheinwerfer-Kegel + Morgensonne im Bild), Push-in, Herzschlag.
- Hook: 1,3 s POV-Abseilen auf den Jet → Weißblitz-Schnitt → Sprengung → Freeze → Zurückspulen.
- Mimik: Mund mit Unterlippe/Kiefer/Zähnen, Brauen heben sich beim Reden, automatisches Blinzeln (`Figur.zeit` pro Bild setzen).
  Team ohne Sturmhaube im Heli/Einsatz, damit man sieht, WER redet.
- Kamera nie per `if (...) ziel = …` umschalten – immer gewichtete `lerp` mit `smooth()`-Fenstern (sonst „springt“ das Bild).
  Szenen, die räumlich zusammenhängen (Tür → Kabine → Tablet/Twist), ohne Übergang mit identischer End-/Startkamera verbinden.
- Einsteigen in den Heli in Phasen (Trittstufe → geduckt rein → umdrehen → hinsetzen), Abheben erst danach.
- POV-Hände am Seil: Greifpunkte auf Schulterhöhe berechnen (immer erreichbar), Kamera 0,35 m vom Seil, Blick ~40° nach unten.
- Festnahme-Rufe (POLIZEI/ZUGRIFF/Seil frei/Einsteigen) im Mix lauter + leicht übersteuert + kurzer Raumhall; Ducking unter Stimmen 50 %.
- Kommentar NIE hinter Code in dieselbe Zeile schreiben, wenn danach per Ersetzung Code angehängt wird (Syntaxfehler „Unexpected end of input“).
- Durchgehende Szenen statt Schnitte: Flug + Anflug + Abseilen = EINE Szene in der Flughafen-Welt (Heli-Bahn als Funktion der Zeit,
  am Ende exakt auf die Schwebeposition; Team als Kinder des Helis, beim Abseilen Übergabe an die Boden-Figuren an derselben Stelle).
- Einsteigen/Hinsetzen animieren (Kufe → geduckt zum Platz → drehen → Pose überblenden `mischen()`), nie Figur austauschen.
- Sturmhaube (`sturmhaube: true`, `maskeHoch(k)`): im Heli unten (Gesicht sichtbar), vor dem Einsatz hochziehen (Hand zum Gesicht).
- Gewehr sitzend `haltGewehr('sitz')` (Mündung nach unten) – 'hoch' verdeckt das Gesicht.
- Schild vor die Brust hängen + linke Hand per IK an den Griff – an den Unterarm gehängt dreht es sich falsch.
- Rotorblätter ohne Schattenwurf (sonst Flackern in der Kabine), Blitzer-Punktlicht aus.
- Kommentar am Zeilenende kann beim späteren Ersetzen Code verschlucken – immer `node --check` nach Änderungen.
- Helm-Rand muss ÜBER den Augenbrauen sitzen (Kugelabschnitt ~0,44π, höher gesetzt) – sonst sieht man keine Augen.
- Seil als Kind des Helis immer in Weltkoordinaten senkrecht ausrichten (inverse Heli-Drehung), sonst kippt es bei Nick/Roll um 30 cm weg und die Hände greifen ins Leere.
- In der Kabine (Dach 1,6 m über Boden): drin nur tief geduckt bewegen, an der Tür auf einem Knie knien (`KNIEPOSE`) – sonst Kopf im Dach.
- Unter der hochgezogenen Maske Nase/Mund ausblenden, sonst sticht die Nase durch den Stoff.
- Deckenteile nie bündig mit der Deckenplatte (Z-Fighting = Flackern oben).
- Vom Flug aus sieht man weit: riesige Grundfläche bis zum Horizont + Nebelweite abhängig von der Flughöhe.
- Referenz-Stil (TikTok-Cartoon-POV): Toon-Shading, schwarze Konturen, starkes Fischauge, große Augen mit Pupille,
  Untertitel ohne Kasten (weiß/gelb mit dicker schwarzer Kontur), Handy-/Eilmeldungs-Karten oben.
  Umsetzung als Mix: `setzeToon(true)` (kern.js) + `new Post(R, { cartoon: true })` (Sobel-Konturen, Fischauge .3, Sättigung) + `Figur.augen = 1.45`.
- `renderer({ logDepth: true })`: logarithmischer Tiefenpuffer → kein Flackern von Boden/Markierungen aus großer Höhe.
- Kamera-Wackeln immer weich (Sinus-Mix), nie Zufall pro Bild → sonst „ruckelt der Kopf“.
- Fahrzeuge nie aufpoppen lassen: von weit außerhalb losfahren (≥150 m), Fahrtrichtung aus dem Weg berechnen.
- Sturmhaube bis knapp unter die Augen (Kugelabschnitt ab Äquator), sonst wirkt sie „halb im Gesicht“.
- Innenausbau eines Rumpfes muss IN den Rumpf passen: Trennwände als runde Scheiben (ShapeGeometry, ggf. mit Türloch),
  Böden/Paneele nur so breit wie der Querschnitt auf der Höhe (Halbbreite = √(R² − Δy²)) – sonst ragen Teile sichtbar raus.
- Bodenflächen im Cartoon-Look einfarbig (keine Riss-/Grastextur) – feine Muster flimmern mit den Konturen.
- Szenen-Übergang vermeiden, wenn der Raum gleich bleibt: Laufwege, Kamera (Position, Blick, Hocke), POV-Zustand, Heli-Position
  am Ende exakt auf den Start der nächsten Szene legen.
- Sitzende Kamera im Heli: kein Wackeln, Augen nicht zu nah an der Decke (Fischauge macht sie riesig).
- Flimmern auf glatten Flächen: Filmkorn im Cartoon-Modus aus (korn 0), Bodenflächen ohne Schattenempfang (Schattenkarte wandert mit der Kamera).
- Punktlichter IN einem Rumpf beleuchten ohne Schatten auch die Außenhaut → helle „Innenraum“-Flecken außen. Kabinenlicht nur an, wenn die Kamera drin ist.
- Transparente Kanzel/Glas vor Figuren erzeugt Konturlinien → nur die ferne Seite rendern (BackSide).
- Kollisionsprüfung mit gedrehten Rechtecken für Autos (nicht achsenparallel nähern) – Lücken zwischen Autos mittig durchlaufen.
- NIE Kommentare per Ersetzung mitten in eine Code-Zeile setzen (zweimal passiert: Code danach wurde zum Kommentar) – Kommentar in eigene Zeile.
- Cockpit-Einbauten (Instrumentenbrett, Displays) weit genug hinter die Nasenspitze setzen – an der Spitze ist der Rumpf schmal, sonst ragen sie sichtbar heraus. Scheiben als gebogene Kugelausschnitte auf die Nase legen.
