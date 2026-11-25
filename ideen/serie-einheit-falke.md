# Serienbibel: EINHEIT FALKE

TikTok-Cartoon-Serie im POV-Stil: **Du** bist der Neue in einer fiktiven Spezialeinheit (5 Leute).
Jede Folge = ein Einsatz: Alarm im Hauptquartier → Anfahrt (Van, Hubschrauber, Flugzeug) → Zugriff →
Festnahme → Cliffhanger zur nächsten Folge.

> Fiktive Einheit. Keine echten Einheiten, Abzeichen oder Logos (GSG 9, SEK, KSK usw.).
> Action ja, aber **niemand wird erschossen, kein Blut**: Festnahmen, Tackles, Blendgranaten, Sprengungen von Türen.

## Das Team (keine Namen – nur Nummern)
| Nummer | Rolle | Erkennungszeichen | Running Gag |
|---|---|---|---|
| **1** | Teamführer | Headset, grauer Bart (ohne Maske) | wenig Worte, immer Kaffee, „Hatte nie Urlaub“ |
| **2** | Türöffner / Schild | riesig, Schild „POLIZEI“ | isst IMMER, „Ich bin Plan A bis Z“ |
| **4** | Präzision + Drohne | kleiner, rote Haare im Dutt (ohne Maske) | trockener Sarkasmus |
| **7** | Technik / Funk | Brille, Tablet, Headset | hat vor allem Angst (Möwen, Regen, Höhe) |
| **6** | **DU** – der Neue (POV) | grüner Armpatch „6“ | große Klappe, beleidigt Gegner kreativ |
| – | **Zentrale** | weißes Haar, Brille | vergibt die Einsätze |

Im Einsatz: Helm + Sturmhaube, Nummer auf Weste vorne und groß auf dem Rücken. Im Hauptquartier: Gesichter sichtbar, Nummer auf dem Shirt-Rücken.

## Hauptquartier (immer gleich)
Büro mit großem Bildschirm (Lagekarte), Tisch, Spinden, Fenstern (Wetter sichtbar), Schild „EINHEIT FALKE".
Alarm = rotes Licht + Sirene + „EINSATZ!" auf dem Bildschirm.

## Aufbau jeder Folge (65–80 s)
1. **Hook (0–4 s):** Explosion oder Action-Moment aus der Mitte des Einsatzes → Freeze → „Wie wir hier gelandet sind?" → Zurückspulen.
2. **Hauptquartier:** kurzer Gag im Team → Alarm.
3. **Briefing:** Hartmann + Bildschirm (Ort, Zielperson, Gefahr).
4. **Ausrüsten:** Comic-Streifen-Montage (5 Panels).
5. **Anfahrt:** Van / Hubschrauber / Flugzeug + POV im Fahrzeug mit Team-Gelaber.
6. **Anschleichen:** Perspektiv-Straße (Stil wie Referenz), Team in Reihe an der Wand.
7. **Zugriff:** POV an der Tür, Countdown, Sprengung/Ramme, „ZUGRIFF!".
8. **Action:** Räume sichern, Blendgranate, Tackle, Verfolgung.
9. **Festnahme + Twist:** Handschellen „KLICK" → überraschende Wendung → **Cliffhanger-Endkarte „EINSATZ XX – Folgen für Teil 2!"**.

## Wetter/Jahreszeiten (abwechseln)
Regen + Nacht · Sommer + Hitze · Schnee · Sturm/Gewitter · Nebel. Baukasten: `himmel()`, `regen()`, `schnee()`, `hitze()`, `blitz_gewitter()`.

## Folgen-Plan (Staffel 1 – „Der Fuchs")
| # | Titel | Ort / Fahrzeug | Wetter | Kern-Action | Cliffhanger |
|---|---|---|---|---|---|
| 01 | Lagerhaus 7 ✅ | Hafen, Van | Regen, Nacht | Türsprengung, Blendgranate, Pier-Verfolgung | Falscher Fuchs – der echte fliegt um 6 |
| 02 | Das Flugzeug ✅ | HQ-Dach → Hubschrauber → Flughafen-Vorfeld | Morgennebel | Sprint zum Heli, Abseilen vor dem rollenden Jet, Tür sprengen, Kabine stürmen | Nur ein Tablet: Videobotschaft vom Fuchs – „Wir sehen uns in den Bergen“ |
| 03 | Die Berghütte | Alpen, Hubschrauber + Abseilen | Schnee, Sturm | Geiselbefreiung in der Hütte | Geisel ist Fuchs' Partnerin |
| 04 | Autobahn | Mobile Festnahme, 3 Fahrzeuge | Sommer, Hitze | Fahrzeug einkeilen, Festnahme aus dem Auto | Navi zeigt: Hafen im Ausland |
| 05 | Das Schiff | Containerschiff, Schlauchboot | Gewitter | Schiff entern, Laderaum sichern | Fuchs entkommt mit Mini-U-Boot |
| 06 | Ausland | Flug ins Ausland, Wüstenstadt | Sommer, 40 °C | Markt-Verfolgung, Dach-Sprünge | Pixel wird entführt! |
| 07 | Entführt | Fabrikhalle | Nebel | Befreiung von Pixel | Verräter im Team? |
| 08 | Der Maulwurf | Hauptquartier | Regen | Einsatz im eigenen Büro | Hartmann verschwindet |
| 09 | Hochhaus | Wolkenkratzer, Hubschrauber aufs Dach | Gewitter | Abseilen an der Fassade, Fenster-Zugriff | Fuchs' wahres Gesicht |
| 10 | Finale: Der Fuchs | alles | Schnee + Feuerwerk | Großeinsatz, alle 5 | Staffel 2? |

## Technik (für den Produzenten)
- **Ab Folge 01 (3D):** `tools/einsatz3d/` + `videos/falke-01-3d/` als Vorlage (siehe CLAUDE.md).
- Baukasten: `tools/einsatz.py` (Kamera mit echter Perspektive, Fassaden, Kisten, Wetter, Explosion mit Physik, POV-Waffe, Van, Hubschrauber, Team-Looks) + `tools/cartoon.py`.
- Vorlage einer kompletten Folge: `videos/falke-01-lagerhaus/animation.py`.
- **Physik-Regeln:** Figuren immer mit `teammitglied()`/`figur()` platzieren (Füße automatisch auf dem Boden), Tiefe sortieren (weit weg zuerst), fallende Körper mit `rot` (landen AUF dem Boden), Wurfobjekte mit Schwerkraft + Abprallen.
- **Nachts:** Hintergrund → `nacht_filter` → Lichter → Figuren in `ebene(..., 0.2)` → Explosion/Feuer → Regen → POV-Waffe.
