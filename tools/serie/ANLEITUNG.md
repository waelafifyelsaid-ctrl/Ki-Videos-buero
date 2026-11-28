# Serienfabrik – so entsteht eine Folge automatisch

1. Ordner `videos/<serie>-NN/` anlegen, `skript.json` schreiben (Vorlage: `videos/blackout-01/skript.json`, `videos/blackout-02/skript.json`).
2. `python3 tools/serie/produziere.py videos/<folge> --pruefen` → Timeline + Stimmen (ElevenLabs), Länge muss **> 60 s** sein (sonst Szenen verlängern).
3. Testbilder: `cd tools && node render3d.js bilder videos/<folge>/index.html 1,5,10,… /tmp/x` und ansehen (Figuren nicht in Wänden/Möbeln, Blick stimmt).
4. `python3 tools/serie/produziere.py videos/<folge>` → rendert (~20 min für 60 s), Ton, `final.mp4`, `ausgabe/<folge>.mp4`, `caption.txt`, Statistik.
   Fortschritt: `python3 tools/fortschritt.py videos/<folge>/tmp`.
5. Commit + Push, Folge in der Serienbibel (`ideen/serie-*.md`) eintragen.

## skript.json
- **Wiedererkennung (Pflicht):** `teil` („TEIL 3“) + `pov` („pov: … *Schlüsselwort* …“, Sternchen = farbig) + `povFarbe` – steht oben während der ganzen Folge (wie erfolgreiche POV-Serien).
- **Hook:** Szene 1 = spektakulärster Moment (Unfall, Explosion, Regal kippt …) mit Bewegung + Geräusch, dann „X MINUTEN VORHER“. **Wenig reden, viel passieren:** 8–12 kurze Sätze, Handlung über Bilder, Eilmeldungen, Zettel erzählen.
- `rollen`: ID → `{name, farbe, look, stimme, extra}`. Looks: mama, papa, schwester, bruder, freund, freundin, nachbar, nachbarin, fremder, polizist, verkaeufer, passant.
  Stimmen: ich, mann, mann2, mann3, alt, frau, frau2, frau3, kind, junge. `telefon: true` → Telefon-/Funkklang.
- `szenen[]`: `{n, welt, d, tr, musik, uhr, licht, stadt, kerzen, treppe, tv, kamera, hand, figuren, karten, mitte, effekte, tueren, requisiten, sat}`
  - `welt`: `wohnung` (Wohnung 4. Stock + Treppenhaus + Stadtblick + Kreuzung unten) · `keller` · `strasse` (Tag: Straße + Supermarkt FRISCHMARKT innen) · `strasse_nacht`
  - `verkehr: 0` blendet den Hintergrundverkehr unten aus; `ampel: [[t,0|1]]` (0 = Ampeln blinken gelb).
  - `fahrzeuge`: `[{farbe, y, wege [[t,x,z]], yaw [[t,grad]], typ: pkw|transporter}]` (z. B. Unfall an der Kreuzung, Straße unten y = −14).
  - Keyframes: Zahlen `[[t, wert], …]` (linear), Zustände `[[t, "wert"], …]` (springen).
  - `kamera.pos`: `[[t, x, y, z], …]` (Augenhöhe stehend 1.62, sitzend 1.22, Gehweg +0.12), `kamera.blick`: `[[t, ziel, dauer], …]` – ziel = Rollen-ID | "kamera" | [x,y,z].
  - `hand`: leer | handy | lampe (Taschenlampe mit Lichtkegel) | tasse | [[x,y,z]] (Hand greift Punkt, z. B. Türklinke).
  - `figuren.ID`: `wege [[t,x,z]…]` (Gehen/Rennen automatisch nach Tempo), `pose [[t,name]]`, `yaw [[t,grad]]` (0 = Blick +z), `blick`, `boden`, `sichtbar`, `sitzhoehe`.
    Posen: stehen, sitzen, reden, zeigen, arme_hoch, panik, telefon, arme_verschraenkt, knien, hocken, winken, tragen.
  - `karten`: `[[t0, t1, "KOPFZEILE", "Text", "info"|"warn"|"chat"]]` (Handy-/Eilmeldung oben).
  - `mitte`: `[[t0, t1, "Großer Text"]]` (Hook-Satz, „10 MINUTEN VORHER“).
  - `effekte`: `[t, name, …]`: explosion [x,y,z], knall, blitz, klopfen, haemmern, sirene dauer, schlag, glas, schritte dauer, handy, warnton, tuer, auto, alarm dauer, menge dauer, herz dauer, lampe_aus dauer.
  - `tueren`: `{wohnung, nachbar, hinten (Keller-Hintertür), notausgang (Supermarkt)}` jeweils `[[t, grad]]`.
  - `requisiten`: `[{typ: wasser|kiste|tuete|regal|chaos|wagen|zettel|brecheisen, pos: [[t,x,y,z]], rot: [[t,rx,ry,rz]] (Grad), halter: [[t, null|ID|"ich"]]}]` – z. B. Regal kippt: rot x 0 → −88 und pos y 0 → 0.48.
  - `effekte` zusätzlich: `[t, "explosion", [x,y,z], größe, lichtfaktor]` (Ferne: größe 30–40).
  - `tr` (Übergang zur Szene): whip, zoom, glitch, mix, schwarz.  `musik`: hook, ruhig, spannung, action, horror.
- `dialog`: `[szene, t, rolle, text, {laut, telefon}]` – kurze Sätze; wer redet, bekommt automatisch die Namens-Markierung.

## Maße der Kulissen
- **wohnung**: Raum x −3..3, z −3..2.5 · Tisch (−1, −0.4) · Stühle: (−1, −1.15) Blick +z, (−1, 0.35) Blick −z, (0, −0.4) Blick −x (= Ich) ·
  Sofa x 0.7..1.6, z −0.45..1.55 · TV-Wand x 2.75 · Küche x −3..−2.4 · Kühlschrank (−2.6, 1.75) · Balkontür z −3 (x −2.2..0.8, Pfosten bei −0.7), Balkon bis z −4.4 ·
  Wohnungstür x −1.4..−0.4 in z 2.5 · Treppenhaus z 2.7..6.5 · Nachbartür x 0..2.2 bei z 6.5 · Treppe runter x −3..−1.6 ab z 3.4 (Stufe k: Höhe −(k+1)·0.18).
- **strasse**: Fahrbahn z −4..4 (entlang x), Gehwege z 4..8 / −8..−4 (Höhe 0.12) · Zebrastreifen x 10..13 · Ampeln (9.5, 4.4) / (13.5, −4.4) · Haltestelle (−14, 6.6) ·
  Supermarkt: Eingang (0, −8), Kassen x −8.5..−3.4 bei z −10.4, Regale bei x −7, −3.5, 0, 3.5, 7 (z −24..−13), Gänge x −5.25, −1.75, 1.75, 5.25, Kühlregal hinten z −27.
- **keller**: Gang x −1..1 von z 1.5 (Treppe) bis −17 · Kellerabteile links/rechts (x ±1..±3.4) · Waschküche x 2.6..3.3, z −10..−12 · Zählerschrank x −1.6..0.2 an Wand z −17 (Schrift „TAG 1 VON 7“) · Hintertür x 3.4, z −14.8..−16.2.
- **Treppenhaus (wohnung)**: Lauf A x 2.1..3.15 von (z 3.4, y 0) nach (z 6.2, y −1.44), Zwischenpodest z 6.2..7.6, Lauf B x 0.85..1.95 zurück nach (z 3.4, y −2.88). Augenhöhe = Stufenhöhe + 1.62.
- **Supermarkt**: Notausgang (Tür) in der rechten Wand x 10 bei z −26.6..−25.4.
- **Abstand:** Figuren ≥ 1 m voneinander und von der Kamera, nie durch Möbel/Regale laufen (Wege durch Gänge planen).

## Stimmen
- ElevenLabs-Free hat 10.000 Zeichen/Monat. Ist es leer (401 quota_exceeded), bleiben Untertitel. Dann **vorhandene Aufnahmen wiederverwenden**: gleicher Text + gleiche Stimme = gleicher Dateiname (`<rolle>_<hash>.mp3`) – Dateien aus anderen Folgen in `stimmen/` kopieren und Sätze passend wählen.
