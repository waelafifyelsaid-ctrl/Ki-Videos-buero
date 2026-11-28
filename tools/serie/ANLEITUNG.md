# Serienfabrik – so entsteht eine Folge automatisch

1. Ordner `videos/<serie>-NN/` anlegen, `skript.json` schreiben (Vorlage: `videos/blackout-01/skript.json`, `videos/blackout-02/skript.json`).
2. `python3 tools/serie/produziere.py videos/<folge> --pruefen` → Timeline + Stimmen (ElevenLabs), Länge muss **> 60 s** sein (sonst Szenen verlängern).
3. Testbilder: `cd tools && node render3d.js bilder videos/<folge>/index.html 1,5,10,… /tmp/x` und ansehen (Figuren nicht in Wänden/Möbeln, Blick stimmt).
4. `python3 tools/serie/produziere.py videos/<folge>` → rendert (~20 min für 60 s), Ton, `final.mp4`, `ausgabe/<folge>.mp4`, `caption.txt`, Statistik.
   Fortschritt: `python3 tools/fortschritt.py videos/<folge>/tmp`.
5. Commit + Push, Folge in der Serienbibel (`ideen/serie-*.md`) eintragen.

## skript.json
- `rollen`: ID → `{name, farbe, look, stimme, extra}`. Looks: mama, papa, schwester, bruder, freund, freundin, nachbar, nachbarin, fremder, polizist, verkaeufer, passant.
  Stimmen: ich, mann, mann2, mann3, alt, frau, frau2, frau3, kind, junge. `telefon: true` → Telefon-/Funkklang.
- `szenen[]`: `{n, welt, d, tr, musik, uhr, licht, stadt, kerzen, treppe, tv, kamera, hand, figuren, karten, mitte, effekte, tueren, requisiten, sat}`
  - `welt`: `wohnung` (Wohnung 4. Stock + Treppenhaus + Stadtblick) · `strasse` (Tag: Straße + Supermarkt FRISCHMARKT innen) · `strasse_nacht`
  - Keyframes: Zahlen `[[t, wert], …]` (linear), Zustände `[[t, "wert"], …]` (springen).
  - `kamera.pos`: `[[t, x, y, z], …]` (Augenhöhe stehend 1.62, sitzend 1.22, Gehweg +0.12), `kamera.blick`: `[[t, ziel, dauer], …]` – ziel = Rollen-ID | "kamera" | [x,y,z].
  - `hand`: leer | handy | lampe (Taschenlampe mit Lichtkegel) | tasse | [[x,y,z]] (Hand greift Punkt, z. B. Türklinke).
  - `figuren.ID`: `wege [[t,x,z]…]` (Gehen/Rennen automatisch nach Tempo), `pose [[t,name]]`, `yaw [[t,grad]]` (0 = Blick +z), `blick`, `boden`, `sichtbar`, `sitzhoehe`.
    Posen: stehen, sitzen, reden, zeigen, arme_hoch, panik, telefon, arme_verschraenkt, knien, hocken, winken, tragen.
  - `karten`: `[[t0, t1, "KOPFZEILE", "Text", "info"|"warn"|"chat"]]` (Handy-/Eilmeldung oben).
  - `mitte`: `[[t0, t1, "Großer Text"]]` (Hook-Satz, „10 MINUTEN VORHER“).
  - `effekte`: `[t, name, …]`: explosion [x,y,z], knall, blitz, klopfen, haemmern, sirene dauer, schlag, glas, schritte dauer, handy, warnton, tuer, auto, alarm dauer, menge dauer, herz dauer, lampe_aus dauer.
  - `tueren`: `{wohnung: [[t, grad]], nachbar: [[t, grad]]}`; `requisiten`: `[{typ: wasser|kiste|tuete, pos: [[t,x,y,z]], halter: [[t, null|ID|"ich"]]}]`.
  - `tr` (Übergang zur Szene): whip, zoom, glitch, mix, schwarz.  `musik`: hook, ruhig, spannung, action, horror.
- `dialog`: `[szene, t, rolle, text, {laut, telefon}]` – kurze Sätze; wer redet, bekommt automatisch die Namens-Markierung.

## Maße der Kulissen
- **wohnung**: Raum x −3..3, z −3..2.5 · Tisch (−1, −0.4) · Stühle: (−1, −1.15) Blick +z, (−1, 0.35) Blick −z, (0, −0.4) Blick −x (= Ich) ·
  Sofa x 0.7..1.6, z −0.45..1.55 · TV-Wand x 2.75 · Küche x −3..−2.4 · Kühlschrank (−2.6, 1.75) · Balkontür z −3 (x −2.2..0.8, Pfosten bei −0.7), Balkon bis z −4.4 ·
  Wohnungstür x −1.4..−0.4 in z 2.5 · Treppenhaus z 2.7..6.5 · Nachbartür x 0..2.2 bei z 6.5 · Treppe runter x −3..−1.6 ab z 3.4 (Stufe k: Höhe −(k+1)·0.18).
- **strasse**: Fahrbahn z −4..4 (entlang x), Gehwege z 4..8 / −8..−4 (Höhe 0.12) · Zebrastreifen x 10..13 · Ampeln (9.5, 4.4) / (13.5, −4.4) · Haltestelle (−14, 6.6) ·
  Supermarkt: Eingang (0, −8), Kassen x −8.5..−3.4 bei z −10.4, Regale bei x −7, −3.5, 0, 3.5, 7 (z −24..−13), Gänge x −5.25, −1.75, 1.75, 5.25, Kühlregal hinten z −27.
- **Abstand:** Figuren ≥ 1 m voneinander und von der Kamera, nie durch Möbel/Regale laufen (Wege durch Gänge planen).
