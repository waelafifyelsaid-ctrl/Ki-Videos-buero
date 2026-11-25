#!/usr/bin/env python3
"""Tonspur Einsatz 02: Geräusche + eigene Musik + Stimmen (Funk-/Lautsprecherfilter, Ducking)."""
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


# ---- Atmosphäre je Szene
add(st("hq"), .03 * rauschen(SZ["hq"]["d"], 1200))
add(st("hq") + 1.0, .15 * band(1.2, 400, 3000) * np.exp(-1.5 * ts(1.2)))           # Kaffeemaschine
add(st("heli"), rotor(SZ["heli"]["d"], laut=.55))
add(st("heli"), .22 * band(SZ["heli"]["d"], 200, 2500))                               # Wind an der offenen Tür
l0, ld = st("landung"), SZ["landung"]["d"]
add(l0, rotor(4.9, laut=.6) * np.linspace(1, .8, int(4.9 * SR)))
add(l0 + 4.9, rotor(ld - 4.9 + SZ["tuer"]["d"], f=4.0, laut=.25) * np.linspace(1, .2, int((ld - 4.9 + SZ["tuer"]["d"]) * SR)))
add(l0, turbine(ld + 3.0, 900, 300, .35) * np.concatenate([np.linspace(.2, 1, int(3.7 * SR)), np.linspace(1, .3, int((ld - .7) * SR))])[:int((ld + 3.0) * SR)])
add(l0 + 3.7, .25 * band(1.4, 2500, 7000) * np.exp(-1.2 * ts(1.4)))                  # Bremsen
add(l0 + 3.6, thud(.9))                                                               # Aufsetzen
add(l0 + 4.9, thud(.5))                                                               # Sprung raus
for k in range(int(2.2 / .3)):
    add(l0 + 5.1 + k * .3, schritt(), .35)
# ---- Tür
t0 = st("tuer")
VZ = SZ["tuer"].get("verzug", 0)
spreng = t0 + 4.9 + VZ
add(t0 + 1.0, klick(1200), .5)
for k in range(int((spreng - t0 - 1.3) / .5)):
    add(t0 + 1.3 + k * .5, .06 * np.sin(2 * np.pi * 2600 * ts(.04)))
add(spreng, boom(.8), 1.0)
add(spreng + .75, metall(260, .9), .8)
add(spreng + .8, thud(.7))
zug = t0 + zeile("tuer", "ZUGRIFF")["start"]
for k in range(6):
    add(zug + .5 + k * .3, schritt(k > 1), .35)
# ---- Kabine
k0 = st("kabine")
for k in range(5):
    add(k0 + k * .28, schritt(True), .35)
add(k0, .04 * rauschen(SZ["kabine"]["d"] + SZ["twist"]["d"], 400))
tackle = zeile("kabine", "Nicht")["ende"] + .1
add(k0 + tackle, thud(1.0), .9)
add(k0 + tackle + .25, thud(.6), .6)
for z in (2.2, 2.5):
    add(k0 + tackle + z, klick(3500), .7)
    add(k0 + tackle + z + .03, metall(2600, .2), .4)
zT = zeile("kabine", "Sitz 1A")
add(k0 + zT["start"] + 2.3, .2 * band(.3, 300, 2000))
# ---- Twist
w0, wd = st("twist"), SZ["twist"]["d"]
add(w0 + .1, .2 * np.sin(2 * np.pi * 880 * ts(.12)) * np.exp(-10 * ts(.12)))
add(w0 + .3, .2 * np.sin(2 * np.pi * 1320 * ts(.12)) * np.exp(-10 * ts(.12)))
# ---- Übergänge + Hook
for s in TL["szenen"]:
    tr = s.get("tr")
    if tr in ("whip", "zoom", "mix", "glitch"):
        add(s["start"], whoosh(.45), .3)
    elif tr == "uhr":
        for k in range(12):
            add(s["start"] + k * .08, klick(2000), .25)
add(.3, boom(.8), .9)
add(1.05, metall(260, .9), .7)
add(2.4, whoosh(.6), .45)
t = ts(.8)
add(3.2, .12 * np.sign(np.sin(2 * np.pi * np.cumsum(500 + 2500 * (t * 10 % 1)) / SR)))
for z in TL["dialog"]:
    if z["funk"]:
        add(st(z["szene"]) + z["start"] - .15, funk(), .55)

# ---------------------------------------------------------------- Musik (eigene Komposition, d-Moll)
DM, BB, FD, CD = [("D", 3), ("F", 3), ("A", 3)], [("A#", 2), ("D", 3), ("F", 3)], [("F", 3), ("A", 3), ("C", 4)], [("C", 3), ("E", 3), ("G", 3)]
GM, DUNKEL = [("G", 2), ("A#", 2), ("D", 3)], [("D", 3), ("F", 3), ("G#", 3)]
M = Musik(DAUER)
M.pad(0, DM, 2.4, .35, cutoff=600, attack=.05)
M.impact(.3, .9)
h0, hd = st("hq"), SZ["hq"]["d"]
M.pad(h0, DM, hd / 2, .28, cutoff=900); M.pad(h0 + hd / 2, BB, hd / 2 + .4, .28, cutoff=900)
for k in range(int(hd / .5)):
    M.bass(h0 + k * .5, "D" if k % 8 < 4 else "A#", .4, .4, 380)
M.riser(h0 + hd - 2.0, 2.0, .45)
e0, ed = st("heli"), SZ["heli"]["d"]
M.groove(e0, e0 + ed, 118, 2, [DM, BB, GM, CD], ["D", "A#", "G", "C"], cutoff_bass=500)
l0 = st("landung")
M.pad(l0, [("D", 2), ("A", 2), ("D#", 3)], 3.6, .3, cutoff=700)
M.riser(l0 + .6, 3.0, .6)
M.impact(l0 + 3.6, 1.0)
M.groove(l0 + 4.9, l0 + SZ["landung"]["d"], 132, 2, [DM, CD], ["D", "C"], cutoff_bass=600)
t0, td = st("tuer"), SZ["tuer"]["d"]
M.pad(t0, [("D", 2), ("A", 2), ("D#", 3)], spreng - t0, .32, cutoff=600)
M.arp(t0 + .3, [("D", 4), ("A", 4), ("D#", 5), ("A", 4)], .25, int((spreng - t0 - .6) / .25), .12)
M.riser(spreng - 2.6, 2.6, .7)
M.impact(spreng, 1.0)
M.groove(zug, st("kabine") + SZ["kabine"]["d"] - 1.5, 140, 3, [DM, BB, CD, DM], ["D", "A#", "C", "D"], cutoff_bass=700)
k0 = st("kabine"); kd = SZ["kabine"]["d"]
M.pad(k0 + kd - 1.5, DUNKEL, 1.9, .3, cutoff=700)
M.pad(w0, DUNKEL, wd - 1.9, .32, cutoff=800)
M.stab(w0 + .8, DUNKEL, .6, d=.6)
M.impact(w0 + .8, .6)
e = w0 + wd - 1.9
M.impact(e, .9); M.stab(e, DM, .7, d=.9); M.pad(e, DM + [("A", 4)], 1.9, .35, cutoff=1800, attack=.05)
M.arp(e + .2, [("D", 5), ("F", 5), ("A", 5), ("D", 6)], .12, 12, .15)
a = a / max(1e-9, np.max(np.abs(a))) * .62 + M.fertig(1.0) * .85


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
    x = x / max(1e-9, np.max(np.abs(x))) * .8
    if z["funk"]:
        x = np.concatenate([funkfilter(x) * .9, .4 * funk()[:int(.12 * SR)]])
    elif z.get("lautsprecher"):
        x = lautsprecher(x) * .85
    i = int((st(z["szene"]) + z["start"]) * SR)
    e2 = min(n, i + len(x))
    stimme[i:e2] += x[:e2 - i]
if gef:
    huelle = lowpass(np.abs(stimme), 6) * 8
    a = a * (1 - .45 * np.clip(huelle, 0, 1))
    a = a / max(1e-9, np.max(np.abs(a))) * .6 + stimme
print(f"Stimmen gemischt: {gef}")
a = a / max(1e-9, np.max(np.abs(a))) * .89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((a * 32767).astype(np.int16).tobytes())
print("Ton:", DAUER, "s")
