#!/usr/bin/env python3
"""Tonspur Einsatz 03 (Berghütte): Geräusche + eigene Musik + Stimmen (Funk-/Lautsprecherfilter, Ducking)."""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parents[1] / "tools"))
from cartoon import SR, lowpass  # noqa: E402
from musik import Musik  # noqa: E402

TL = json.loads((HIER / "timeline_fertig.json").read_text())
SZ = {s["n"]: s for s in TL["szenen"]}
DAUER = TL["dauer"]
n = int(DAUER * SR)
a = np.zeros(n)
rng = np.random.default_rng(7)


def st(x):
    return SZ[x]["start"]


def zeile(sz, anf):
    return next(z for z in TL["dialog"] if z["szene"] == sz and z["text"].startswith(anf))


def ts(d):
    return np.arange(int(d * SR)) / SR


def add(t0, sig, vol=1.0):
    i = int(t0 * SR)
    if i < 0:
        sig, i = sig[-i:], 0
    e = min(n, i + len(sig))
    if i < n:
        a[i:e] += vol * sig[:e - i]


def rauschen(d, cut):
    return lowpass(rng.uniform(-1, 1, int(d * SR)), cut)


def band(d, lo, hi):
    x = rng.uniform(-1, 1, int(d * SR))
    return lowpass(x, hi) - lowpass(x, lo)


def boom(s=1.0):
    t = ts(2.5)
    tief = np.sin(2 * np.pi * np.cumsum(30 + 65 * np.exp(-5 * t)) / SR) * np.exp(-2 * t)
    return s * (tief + .8 * rauschen(2.5, 900) * np.exp(-2.4 * t) + .35 * rng.uniform(-1, 1, len(t)) * np.exp(-25 * t))


def thud(s=1.0):
    t = ts(.3)
    return s * np.sin(2 * np.pi * np.cumsum(55 + 80 * np.exp(-30 * t)) / SR) * np.exp(-12 * t)


def klick(f=3000):
    t = ts(.06)
    return np.sin(2 * np.pi * f * t) * np.exp(-90 * t) + .4 * rng.uniform(-1, 1, len(t)) * np.exp(-150 * t)


def metall(f=900, d=.5):
    t = ts(d)
    return sum(np.sin(2 * np.pi * f * k * t) * np.exp(-(4 + k) * t) / k for k in (1, 2.7, 4.1, 5.9))


def whoosh(d=.4):
    t = ts(d)
    return rauschen(d, 3500) * np.sin(np.pi * t / d) ** 2


def schritt(metall_=False):
    t = ts(.12)
    s = .6 * rauschen(.12, 900) * np.exp(-35 * t) + .5 * np.sin(2 * np.pi * 70 * t) * np.exp(-40 * t)
    return s + (.4 * metall(420, .12) if metall_ else 0)


def funk():
    t = ts(.18)
    return .5 * band(.18, 800, 4000) * np.exp(-8 * t) + .3 * np.sin(2 * np.pi * 1800 * t) * (t < .06)


def rotor(d, f=4.6, laut=1.0):
    t = ts(d)
    schlag = (np.maximum(0, np.sin(2 * np.pi * f * t)) ** 6)
    turbine = .25 * np.sin(2 * np.pi * np.cumsum(420 + 8 * np.sin(t)) / SR) + .15 * band(d, 2000, 6000)
    return laut * (lowpass(rng.uniform(-1, 1, len(t)), 220) * (0.4 + 2.2 * schlag) + .15 * turbine)


def turbine(d, f0, f1, laut=1.0):
    t = ts(d)
    f = f0 + (f1 - f0) * (t / d)
    return laut * (.3 * np.sin(2 * np.pi * np.cumsum(f) / SR) + .5 * band(d, 300, 2500) * (.6 + .4 * np.sin(2 * np.pi * 3 * t)))


def sirene(d, laut=1.0):
    t = ts(d); f = np.where((t * 1.4) % 1 < .5, 466, 622)
    return laut * np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .5


def sturm(d, laut=1.0):   # Wind mit Böen
    t = ts(d)
    boe = .55 + .45 * np.sin(2 * np.pi * .23 * t) * np.sin(2 * np.pi * .071 * t + 1)
    return laut * (band(d, 120, 1400) * boe + .35 * band(d, 2500, 6000) * boe ** 2)


def holz():   # Schritt auf Holzdielen
    t = ts(.1)
    return .7 * rauschen(.1, 1500) * np.exp(-45 * t) + .5 * np.sin(2 * np.pi * 140 * t) * np.exp(-35 * t)


def knall(s=1.0):   # Blendgranate: sehr harter Knall + Pfeifen im Ohr
    t = ts(.6)
    return s * (rng.uniform(-1, 1, len(t)) * np.exp(-14 * t) + .8 * np.sin(2 * np.pi * np.cumsum(90 + 200 * np.exp(-20 * t)) / SR) * np.exp(-6 * t))


E0 = st("anflug")
def T(E):   # Einsatz-Uhr → Videozeit
    return E0 + E

# ---- Anflug: Rotor laut, Sturm an der offenen Tür, Schweben, Absprung
add(T(0), rotor(14.5, f=4.6, laut=1.0) * np.concatenate([np.ones(int(13.9 * SR)), np.linspace(1, .5, int(.6 * SR))]))
add(T(13.9), rotor(7, f=4.3, laut=.5) * np.linspace(1, 0, int(7 * SR)) ** 1.5)          # Heli fliegt weg
add(T(0), .3 * band(13.9, 180, 2400))
add(T(9.0), .3 * band(5.0, 150, 2200) * np.sin(np.pi * ts(5.0) / 5.0))                 # Abwind wirbelt Schnee
for nr, j in {"2": 10.6, "7": 11.1, "4": 11.6, "1": 12.1}.items():
    add(T(j - .3), whoosh(.3), .25); add(T(j + .55), thud(.5), .6); add(T(j + .6), .3 * rauschen(.25, 1200) * np.exp(-12 * ts(.25)))
add(T(12.8), whoosh(.5), .5); add(T(13.35), thud(1.0), 1.0); add(T(13.38), .5 * rauschen(.35, 1500) * np.exp(-9 * ts(.35)))   # ICH lande
for k in range(9):
    add(T(13.7 + k * .26), .35 * rauschen(.12, 1100) * np.exp(-30 * ts(.12)))          # Schritte im Schnee
# Polizeisirenen weit unten im Tal
add(T(1.0), lowpass(sirene(12, .06), 2500))
# ---- Sturm draußen (bis wir in der Hütte sind), drinnen gedämpft
add(T(0), sturm(40.8, .22))
add(T(40.8), lowpass(sturm(25, .12), 500))
# ---- Wand: Seilwerfer, Haken, Klettern
for F in (16.6, 17.7):
    add(T(F), thud(.9), .8); add(T(F), .5 * band(.25, 300, 3000) * np.exp(-14 * ts(.25)))   # Pressluft-Schuss
    add(T(F + .02), whoosh(.45), .5)
    add(T(F + .45), metall(1100, .6), .6); add(T(F + .5), metall(700, .4), .3)              # Haken greift ins Geländer
k = 0
while 20.6 + k * .24 < 28.0:
    add(T(20.6 + k * .24), .25 * band(.09, 1500, 5000) * np.exp(-40 * ts(.09)))               # Griff ans Seil
    if k % 2 == 0: add(T(20.7 + k * .24), .22 * rauschen(.1, 700) * np.exp(-35 * ts(.1)))    # Stiefel an der Wand
    k += 1
for k in range(14):
    add(T(20.8 + k * .55), .08 * band(.35, 300, 1500) * np.sin(np.pi * ts(.35) / .35))       # Atmen
add(T(25.7), whoosh(.6), .7); add(T(26.4), .3 * rauschen(.3, 900) * np.exp(-10 * ts(.3)))    # Schneebrocken
add(T(28.1), metall(500, .5), .4); add(T(29.2), thud(.6), .6)                                # übers Geländer, Landung
# ---- Hütte: Schritte, Wache, Tackle, Countdown, Doppelsprengung, Blendgranate
for k in range(7):
    add(T(29.4 + k * .27), holz(), .3)
add(T(31.25), .2 * np.sin(2 * np.pi * 880 * ts(.1)) * np.exp(-20 * ts(.1)))                  # Handy fällt
add(T(31.55), thud(1.0), .9); add(T(31.75), thud(.7), .7); add(T(31.8), holz(), .6)
for z_ in (32.9, 33.25):
    add(T(z_), klick(3500), .7); add(T(z_ + .03), metall(2600, .2), .4)
for k in range(6):
    tt = 35.0 + k * .4
    add(T(tt), thud(.55), .5 + .08 * k); add(T(tt + .14), thud(.35), .35 + .06 * k)          # Herzschlag beim Countdown
add(T(37.2), boom(1.0), 1.0); add(T(37.23), boom(.7), .8)                                     # Tür + Fenster
add(T(37.25), .5 * band(.9, 3000, 9000) * np.exp(-5 * ts(.9)))                                # Glas
add(T(37.85), thud(.8), .8); add(T(37.88), metall(240, .6), .3)                               # Tür schlägt innen auf
add(T(37.5), whoosh(.4), .4)
add(T(37.95), knall(1.0), 1.0)
add(T(38.0), .07 * np.sin(2 * np.pi * 3900 * ts(1.6)) * np.exp(-1.6 * ts(1.6)))              # Pfeifen im Ohr
for k in range(12):
    add(T(38.3 + k * .3), holz(), .35)
add(T(41.05), thud(1.0), .9); add(T(41.25), thud(.6), .6)                                     # Tackle A
for z_ in (42.2, 42.5, 44.0, 44.3):
    add(T(z_), klick(3500), .6); add(T(z_ + .03), metall(2600, .2), .35)
add(T(45.3), .25 * band(.7, 1500, 5000) * (np.sin(2 * np.pi * 11 * ts(.7)) > 0))              # Messer sägt
add(T(46.05), .3 * band(.1, 800, 4000) * np.exp(-30 * ts(.1)))                                # Fessel reißt
add(T(46.3), .15 * rauschen(.2, 800) * np.exp(-15 * ts(.2)))
# ---- Polizei kommt, Handy vibriert
add(T(47.5), rotor(18, f=4.8, laut=.45) * np.concatenate([np.linspace(0, 1, int(4 * SR)), np.ones(int(14 * SR))]))
add(T(48.0), lowpass(sirene(16, .08), 3000))
for k in range(4):
    add(T(50.9 + k * .32), .25 * np.sin(2 * np.pi * 160 * ts(.18)) * (np.sin(2 * np.pi * 30 * ts(.18)) > 0))
add(T(51.0), .25 * np.sin(2 * np.pi * 1320 * ts(.15)) * np.exp(-12 * ts(.15)))
# ---- Hook: Klettern im Sturm → Schnitt → Doppelsprengung → Freeze → Spulen
add(0, sturm(2.1, .35)); add(0, rotor(2.1, f=4.4, laut=.3))
add(2.0, whoosh(.3), .6)
add(2.6, boom(1.1), 1.0); add(2.63, boom(.7), .8); add(2.65, .5 * band(.8, 3000, 9000) * np.exp(-5 * ts(.8)))
add(3.3, whoosh(.6), .45)
t = ts(.6)
add(4.0, .12 * np.sign(np.sin(2 * np.pi * np.cumsum(500 + 2500 * (t * 10 % 1)) / SR)))
for k in range(12):
    add(st("anflug") + k * .08, klick(2000), .25)                                             # Uhr-Zeitsprung
for z in TL["dialog"]:
    if z["funk"]:
        add(st(z["szene"]) + z["start"] - .15, funk(), .55)

# ---------------------------------------------------------------- Musik (eigene Komposition, d-Moll, treibend)
DM, BB, CD, GM = [("D", 3), ("F", 3), ("A", 3)], [("A#", 2), ("D", 3), ("F", 3)], [("C", 3), ("E", 3), ("G", 3)], [("G", 2), ("A#", 2), ("D", 3)]
DUNKEL = [("D", 3), ("F", 3), ("G#", 3)]
OST = [("D", 4), ("D", 4), ("F", 4), ("D", 4), ("G#", 4), ("D", 4), ("F", 4), ("A", 4)]
M = Musik(DAUER)
# Hook
M.braam(0, 2.0, .9); M.taiko(0, 2.6, 150, .9); M.ostinato(0, 2.6, OST, 150, .45)
M.impact(2.6, 1.1); M.braam(2.6, 2.6, 1.3, ("D", 1)); M.braam(3.3, 2.0, .7, ("A#", 0))
# Anflug: großer, weiter Klang + Taiko, beim Schweben Riser, Absprung Impact
M.impact(T(0), .8); M.pad(T(0), DM, 4.8, .3, cutoff=900); M.pad(T(4.8), BB, 4.8, .3, cutoff=900)
M.groove(T(0), T(9.6), 132, 3, [DM, BB, GM, CD], ["D", "A#", "G", "C"], cutoff_bass=650)
M.taiko(T(0), T(13.5), 132, .8); M.ostinato(T(2), T(9.6), OST, 132, .32)
M.riser(T(7.6), 2.0, .55); M.braam(T(9.6), 2.4, 1.0, ("D", 1)); M.impact(T(9.6), .8)
M.arp(T(9.8), [("D", 4), ("A", 4), ("D#", 5), ("A", 4)], .2, 17, .13)
M.impact(T(13.35), .9); M.braam(T(13.35), 2.2, .9, ("F", 1))
# Wand: Spannung, nervöses Ostinato, zwei Impacts für die Haken
M.pad(T(14), [("D", 2), ("A", 2), ("D#", 3)], 14, .3, cutoff=700)
M.ostinato(T(14.5), T(28), [("D", 4), ("D#", 4)] * 4, 140, .35)
M.taiko(T(18.5), T(28), 140, .7)
M.impact(T(17.05), .6); M.impact(T(18.15), .6)
M.riser(T(26.0), 2.1, .55); M.braam(T(28.06), 2.2, .9, ("A#", 0))
# Hütte: Groove beim Anschleichen, Tackle, Countdown nur Herzschlag + Halbton, dann Explosion
M.groove(T(29), T(34.6), 128, 2, [DM, CD, BB, CD], ["D", "C", "A#", "C"], cutoff_bass=600)
M.braam(T(31.6), 2.0, .9, ("F", 1)); M.impact(T(31.6), .7)
M.pad(T(34.6), DUNKEL, 2.6, .3, cutoff=600); M.ostinato(T(34.6), T(37.2), [("D", 4), ("D#", 4)] * 4, 150, .45)
M.riser(T(35.0), 2.2, .7)
M.impact(T(37.2), 1.2); M.braam(T(37.2), 3.0, 1.3, ("D", 1))
M.taiko(T(38.0), T(44.5), 150, 1.0); M.groove(T(38.0), T(44.5), 150, 3, [DM, BB, CD, DM], ["D", "A#", "C", "D"], cutoff_bass=700)
M.braam(T(41.05), 2.0, .9, ("A#", 0))
# Befreiung: ruhiger, dann Twist dunkel
M.pad(T(44.5), DM, 4.0, .28, cutoff=900); M.arp(T(44.6), [("D", 5), ("A", 4), ("F", 4), ("A", 4)], .25, 15, .1)
M.pad(T(48.5), DUNKEL, 8, .32, cutoff=800)
M.stab(T(51.0), DUNKEL, .6, d=.6); M.braam(T(51.0), 2.6, 1.0, ("C#", 1)); M.impact(T(51.0), .6)
M.braam(T(53.7), 2.4, 1.0, ("D", 1))
w0, wd = st("twist"), SZ["twist"]["d"]
e = w0 + wd - 3.0
M.impact(e, .9); M.stab(e, DM, .7, d=.9); M.pad(e, DM + [("A", 4)], 3.0, .35, cutoff=1800, attack=.05)
M.groove(e + .2, e + 2.9, 140, 2, [DM, BB], ["D", "A#"], cutoff_bass=700); M.taiko(e + .2, e + 2.9, 150, .9)
M.arp(e + .2, [("D", 5), ("F", 5), ("A", 5), ("D", 6)], .12, 12, .15)
for z_ in (.7, 1.1):
    add(e + z_ + .05, .3 * np.sin(2 * np.pi * 1200 * ts(.15)) * np.exp(-18 * ts(.15)))   # Like-/Folgen-Pop
a = a / max(1e-9, np.max(np.abs(a))) * .55 + M.fertig(1.0) * 2.0


# ---------------------------------------------------------------- Stimmen
def lade(datei):
    roh = subprocess.run(["ffmpeg", "-v", "error", "-i", str(datei), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float64) / 32768


def funkfilter(x):
    x = lowpass(x, 3200) - lowpass(x, 320)
    return np.tanh(x * 3.0) / np.tanh(3.0) + .015 * rng.uniform(-1, 1, len(x)) * (np.abs(x) > .01)


def lautsprecher(x):   # Tablet-Lautsprecher: dünn, leicht verzerrt
    x = lowpass(x, 5000) - lowpass(x, 450)
    return np.tanh(x * 2.0) / np.tanh(2.0)


stimme = np.zeros(n)
gef = 0
for z in TL["dialog"]:
    if not z.get("datei"):
        continue
    x = lade(HIER / "stimmen" / z["datei"])
    if not len(x):
        continue
    gef += 1
    x = x / max(1e-9, np.max(np.abs(x))) * .9
    if z["text"].startswith(("POLIZEI", "ZUGRIFF", "Einsteigen", "Seil frei", "Raus")):   # Festnahme-Gebrüll: lauter, leicht übersteuert, mit Raumhall
        x = np.tanh(x * 2.2) / np.tanh(2.2) * 1.25   # laut gebrüllt, ohne Hall
    if z["funk"]:
        x = np.concatenate([funkfilter(x) * .9, .4 * funk()[:int(.12 * SR)]])
    elif z.get("lautsprecher"):
        x = lautsprecher(x) * .85
    i = int((st(z["szene"]) + z["start"]) * SR)
    e2 = min(n, i + len(x))
    stimme[i:e2] += x[:e2 - i]
if gef:
    huelle = lowpass(np.abs(stimme), 6) * 8
    a = a * (1 - .5 * np.clip(huelle, 0, 1))   # Musik/Geräusche unter Stimmen deutlicher absenken → Gespräche gut hörbar
    a = a / max(1e-9, np.max(np.abs(a))) * .6 + stimme
print(f"Stimmen gemischt: {gef}")
a = a / max(1e-9, np.max(np.abs(a))) * .89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((a * 32767).astype(np.int16).tobytes())
print("Ton:", DAUER, "s")
