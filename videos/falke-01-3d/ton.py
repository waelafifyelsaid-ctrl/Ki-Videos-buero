#!/usr/bin/env python3
"""Tonspur für EINHEIT FALKE 01 (3D): nur Geräusche + Musik, keine Stimmen."""
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parents[1] / "tools"))
from cartoon import SR, lowpass  # noqa: E402

TL = json.loads((HIER / "timeline_fertig.json").read_text())


def zeile(szene, anfang):
    return next(z for z in TL["dialog"] if z["szene"] == szene and z["text"].startswith(anfang))

SZ = {s["n"]: s for s in TL["szenen"]}
DAUER = TL["dauer"]
n = int(DAUER * SR)
a = np.zeros(n)
rng = np.random.default_rng(5)


def st(name):
    return SZ[name]["start"]


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
    t = ts(3.0)
    tief = np.sin(2 * np.pi * np.cumsum(28 + 70 * np.exp(-5 * t)) / SR) * np.exp(-1.8 * t)
    return s * (1.0 * tief + .9 * rauschen(3.0, 800) * np.exp(-2.2 * t) + .4 * rng.uniform(-1, 1, len(t)) * np.exp(-25 * t))


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


def schritt(nass=True):
    t = ts(.12)
    s = .6 * rauschen(.12, 900) * np.exp(-35 * t) + .5 * np.sin(2 * np.pi * 70 * t) * np.exp(-40 * t)
    if nass:
        s += .35 * band(.12, 1500, 5000) * np.exp(-25 * t)
    return s


def atmen(d, rate, staerke):
    t = ts(d)
    return staerke * band(d, 250, 1400) * np.sin(np.pi * ((t * rate) % 1)) ** 2


def herz(d, bpm=80):
    out = np.zeros(int(d * SR))
    for k in range(int(d * bpm / 60)):
        for off, s in ((0, 1), (.22, .6)):
            i = int((k * 60 / bpm + off) * SR)
            t = ts(.15)
            x = s * np.sin(2 * np.pi * 48 * t) * np.exp(-25 * t)
            out[i:i + len(x)] += x[:max(0, len(out) - i)]
    return out


def knarzen(d=.6, f0=180):
    t = ts(d)
    return .5 * np.sign(np.sin(2 * np.pi * np.cumsum(f0 + 60 * np.sin(2 * np.pi * 9 * t)) / SR)) * \
        lowpass(rng.uniform(0, 1, len(t)), 40) * np.sin(np.pi * t / d)


def funk():
    t = ts(.18)
    return .5 * band(.18, 800, 4000) * np.exp(-8 * t) + .3 * np.sin(2 * np.pi * 1800 * t) * (t < .06)


# Regen je Szene
regen = {"hook": .16, "hq": .04, "briefing": .03, "spind": .02, "van": .07, "anschleichen": .2, "zugriff": .18,
         "innen": .05, "verfolgung": .22, "twist": .2}
for name, vol in regen.items():
    add(st(name), rauschen(SZ[name]["d"], 5000) * vol)
# Übergänge
for s in TL["szenen"]:
    tr = s.get("tr")
    if tr in ("whip", "zoom", "mix"):
        add(s["start"], whoosh(.45), .3)
    elif tr == "uhr":
        for k in range(12):
            add(s["start"] + k * .08, klick(2000), .25)
# Hook
add(st("hook") + .25, boom(), 1.0)
add(st("hook") + .25, atmen(2.2, 1.6, .2))
add(st("hook") + 2.35, whoosh(.6), .5)
t = ts(.8)
add(st("hook") + 3.2, .12 * np.sign(np.sin(2 * np.pi * np.cumsum(500 + 2500 * (t * 10 % 1)) / SR)))
# HQ
s0 = st("hq")
ALARM = 8.6
for k in range(int(ALARM / .11)):
    if rng.random() < .7:
        add(s0 + k * .11, klick(rng.uniform(2500, 4000)), .06)
for k in range(5):
    add(s0 + .3 + k * 1.6, .2 * np.sin(2 * np.pi * np.cumsum(600 + 1800 * ts(.1) / .1) / SR) * np.exp(-14 * ts(.1)))
d_alarm = SZ["hq"]["d"] - ALARM + .6
t = ts(d_alarm)
add(s0 + ALARM, .22 * lowpass(np.sign(np.sin(2 * np.pi * np.where((t % .8) < .4, 960, 770) * t)), 2500))
# Briefing: Piepser am Bildschirm
for z in (zeile("briefing", "Zielperson")["start"], zeile("briefing", "Zwei.")["start"]):
    add(st("briefing") + z, .2 * np.sin(2 * np.pi * 1320 * ts(.12)) * np.exp(-10 * ts(.12)))
# Spind
s0 = st("spind")
add(s0 + .3, knarzen(.6), .5)
add(s0 + .9, .3 * band(.25, 300, 2500) * np.exp(-10 * ts(.25)))
add(s0 + 2.1, klick(1500), .7)
add(s0 + 2.15, klick(2600), .5)
add(s0 + 3.0, .25 * band(.3, 300, 1500))
add(s0 + 4.05, metall(700, .25), .5)
add(s0 + 4.3, metall(1100, .3), .6)
# Van
s0, d = st("van"), SZ["van"]["d"]
t = ts(d - 2.0)
motor = 2 * ((np.cumsum(52 + 6 * np.sin(2 * np.pi * .6 * t)) / SR) % 1) - 1
add(s0, .28 * lowpass(motor, 280) * np.minimum(1, (d - 2.0 - t) * 2))
add(s0 + d - 2.2, .15 * np.sin(2 * np.pi * np.cumsum(2400 - 600 * ts(.6)) / SR) * np.exp(-3 * ts(.6)))
add(s0 + d - 1.35, klick(700), .9)
add(s0 + d - 1.3, knarzen(.9, 140), .4)
add(s0 + d - 1.2, rauschen(1.2, 5000) * np.linspace(0, .18, int(1.2 * SR)))
# Anschleichen
s0 = st("anschleichen")
for k in range(int(8.2 / .42)):
    add(s0 + k * .42, schritt(), .22)
add(s0, herz(SZ["anschleichen"]["d"] + 5.1, 84), .35)
add(s0, atmen(SZ["anschleichen"]["d"] + 5.1, .45, .1))
add(s0 + zeile("anschleichen", "Ich bin IMMER")["ende"] - .25, metall(320, .8), .6)
add(s0 + .45, funk(), .5)
# Zugriff (Ereignisse nach dem Countdown um den Verzug verschoben)
VZ = SZ["zugriff"].get("verzug", 0)
s0 = st("zugriff")
add(s0 + 1.15, klick(1200), .5)
for k in range(int((3.8 + VZ) / .5)):
    add(s0 + 1.3 + k * .5, .06 * np.sin(2 * np.pi * 2600 * ts(.04)))
add(s0 + 5.1 + VZ, boom(), 1.0)
add(s0 + 5.6 + VZ, thud(.7))
add(s0 + 5.75 + VZ, metall(260, .7), .5)
add(s0 + 5.95 + VZ, .3 * band(.2, 400, 2000) * np.exp(-12 * ts(.2)))
add(s0 + 6.35 + VZ, metall(1700, .25), .35)
add(s0 + 6.7 + VZ, boom(.55), .85)
add(s0 + 6.7 + VZ, .25 * band(.25, 3000, 9000) * np.exp(-14 * ts(.25)))
for k in range(int(2.3 / .28)):
    add(s0 + 7.3 + VZ + k * .28, schritt(), .3)
# Innen
s0 = st("innen")
add(s0 + 2.0, metall(220, .4), .5)
add(s0 + 3.4, thud(.6))
add(s0 + 3.4, metall(180, .6), .5)
add(s0 + 5.0, thud(1.0), .9)
add(s0 + 5.25, thud(.6), .6)
for k in range(int(1.8 / .27)):
    add(s0 + 9.0 + k * .27, schritt(False), .35)
for z in TL["dialog"]:
    if z["funk"]:
        add(st(z["szene"]) + z["start"] - .15, funk(), .6)
# Verfolgung
s0 = st("verfolgung")
F_START, F_V, PF_Z, KAM_V = -9, 5.7, -41.5, 6.2
slip = (F_START - PF_Z) / F_V
fz_end = PF_Z - F_V / 2.6
t_an = (1.0 - (fz_end - .85)) / KAM_V
for k in range(int(t_an / .3)):
    add(s0 + k * .3, schritt(), .4)
add(s0, atmen(SZ["verfolgung"]["d"], 1.3, .3) * np.concatenate([np.ones(int(t_an * SR)), np.linspace(1, .35, int((SZ["verfolgung"]["d"] - t_an) * SR) + 1)])[:int(SZ["verfolgung"]["d"] * SR)])
add(s0 + slip, whoosh(.4), .4)
add(s0 + slip, .35 * band(.5, 600, 4000) * np.exp(-6 * ts(.5)))
add(s0 + slip + .5, thud(.9))
add(s0 + t_an + .2, .3 * band(.3, 200, 1200))
for z in (t_an + 2.35, t_an + 2.75):
    add(s0 + z, klick(3500), .8)
    add(s0 + z + .03, metall(2600, .2), .4)
for k in range(int(t_an / .5)):
    tt = ts(.2)
    add(s0 + k * .5, .25 * np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-30 * tt)) / SR) * np.exp(-9 * tt))
# Twist: Stich + Endkarte
s0, d = st("twist"), SZ["twist"]["d"]
for t0, fs in ((s0 + zeile("twist", "Der echte")["start"], (110, 130.8, 155.6)), (s0 + d - 1.9, (98, 146.8, 196, 246.9))):
    t = ts(2.2)
    add(t0, .3 * sum(np.sin(2 * np.pi * f * t) for f in fs) / len(fs) * np.exp(-1.1 * t))
t = ts(d)
add(s0, .05 * np.sin(2 * np.pi * np.where((t % 1.2) < .6, 700, 560) * t) * lowpass(np.ones(len(t)), 5))
# Blendgranate (draußen vor der Tür): kurz dumpf + leises Piepen
t0, t1 = int((st("zugriff") + 6.75 + VZ) * SR), int((st("zugriff") + 8.2 + VZ) * SR)
a[t0:t1] = lowpass(a[t0:t1], 600) * .75
tt = np.arange(t1 - t0) / SR
a[t0:t1] += .08 * np.sin(2 * np.pi * 3600 * tt) * np.exp(-1.5 * tt)


# ---------------------------------------------------------------- Hintergrundmusik (eigene Komposition, d-Moll)
from musik import Musik  # noqa: E402

DM, BB, FD, CD = [("D", 3), ("F", 3), ("A", 3)], [("A#", 2), ("D", 3), ("F", 3)], [("F", 3), ("A", 3), ("C", 4)], [("C", 3), ("E", 3), ("G", 3)]
GM, DUNKEL = [("G", 2), ("A#", 2), ("D", 3)], [("D", 3), ("F", 3), ("G#", 3)]
M = Musik(DAUER)
# Hook: tiefer Teppich + Einschlag, beim Standbild bricht alles ab
M.pad(st("hook"), DM, 2.35, .35, cutoff=600, attack=.05)
M.impact(st("hook") + .25, .9)
# Hauptquartier: lockerer Groove bis zum Alarm, dann Puls
h0 = st("hq")
M.groove(h0 + .2, h0 + ALARM, 92, 1, [DM, BB, FD, CD], ["D", "A#", "F", "C"])
for k in range(int((SZ["hq"]["d"] - ALARM) / .25)):
    M.bass(h0 + ALARM + k * .25, "D", .22, .55, 450)
M.impact(h0 + ALARM, .5)
# Briefing: gespannter Teppich + langsamer Puls
b0, bd = st("briefing"), SZ["briefing"]["d"]
for k, ak in enumerate([DM, BB, GM, DM]):
    M.pad(b0 + k * bd / 4, ak, bd / 4 + .5, .3, cutoff=900)
for k in range(int(bd / .66)):
    M.bass(b0 + k * .66, "D", .5, .35, 300)
# Spind: Aufbau mit Trommeln + Riser
s0_, sd = st("spind"), SZ["spind"]["d"]
M.pad(s0_, DM, sd, .25, cutoff=1100)
for k in range(int(sd / .5)):
    M.tom(s0_ + k * .5, 70 + 4 * k, .25 + .5 * k / (sd / .5))
M.riser(s0_ + sd - 2.2, 2.2, .5)
# Van: treibender Beat bis zum Bremsen
v0, vd = st("van"), SZ["van"]["d"]
M.groove(v0, v0 + vd - 2.2, 110, 2, [DM, BB, GM, DM], ["D", "A#", "G", "D"], cutoff_bass=450)
M.pad(v0 + vd - 2.2, DUNKEL, 2.6, .3, cutoff=700)
# Anschleichen: leise Spannung
a0, ad = st("anschleichen"), SZ["anschleichen"]["d"]
M.pad(a0, [("D", 2), ("A", 2), ("D#", 3)], ad, .3, cutoff=500, attack=1.5)
M.arp(a0 + .5, [("D", 4), ("A", 4), ("F", 4), ("A", 4)], .75, int((ad - .5) / .75), .12)
# Zugriff: Riser bis zur Sprengung, Stille, Action ab „ZUGRIFF!"
z0 = st("zugriff")
knall = z0 + 5.1 + VZ
zug = z0 + 7.2 + VZ
M.pad(z0, [("D", 2), ("A", 2), ("D#", 3)], knall - z0, .3, cutoff=600)
M.riser(knall - 3.2, 3.2, .7)
M.impact(knall, 1.0)
action_ende = st("innen") + SZ["innen"]["d"]
M.groove(zug, action_ende, 140, 3, [DM, BB, CD, DM], ["D", "A#", "C", "D"], cutoff_bass=700)
# Verfolgung: Jagd, nach den Handschellen runter
v0 = st("verfolgung")
jagd_ende = v0 + t_an + 2.8
M.groove(v0, jagd_ende, 150, 3, [DM, FD, CD, BB], ["D", "F", "C", "A#"], cutoff_bass=800)
M.pad(jagd_ende, DM, SZ["verfolgung"]["d"] - (jagd_ende - v0) + .5, .28, cutoff=800)
# Twist: dunkel, Stich bei der Enthüllung, Schlussthema zur Endkarte
w0, wd = st("twist"), SZ["twist"]["d"]
enth = w0 + zeile("twist", "Der echte")["start"]
M.pad(w0, DUNKEL, enth - w0 + .5, .28, cutoff=700)
M.stab(enth, DUNKEL, .6, d=.6)
M.impact(enth, .6)
M.pad(enth, [("D", 2), ("A", 2), ("D", 3), ("F", 3)], w0 + wd - 1.9 - enth, .3, cutoff=900)
e0 = w0 + wd - 1.9
M.impact(e0, .9)
M.stab(e0, DM, .7, d=.9)
M.pad(e0, DM + [("A", 4)], 1.9, .35, cutoff=1800, attack=.05)
M.arp(e0 + .2, [("D", 5), ("F", 5), ("A", 5), ("D", 6)], .12, 12, .15)
musik_spur = M.fertig(1.0)
a = a / max(1e-9, np.max(np.abs(a))) * .62 + musik_spur * .85
print("Musik gemischt")


# ---------------------------------------------------------------- Stimmen (ElevenLabs-Aufnahmen aus stimmen/)
def lade(datei):
    roh = subprocess.run(["ffmpeg", "-v", "error", "-i", str(datei), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float64) / 32768


def funkfilter(x):
    x = lowpass(x, 3200) - lowpass(x, 320)            # Bandpass wie ein Funkgerät
    x = np.tanh(x * 3.0) / np.tanh(3.0)               # leichte Verzerrung
    x += .015 * rng.uniform(-1, 1, len(x)) * (np.abs(x) > .01)
    return x


stimme = np.zeros(n)
gefunden = 0
for z in TL["dialog"]:
    if not z.get("datei"):
        continue
    x = lade(HIER / "stimmen" / z["datei"])
    if len(x) == 0:
        continue
    gefunden += 1
    x = x / max(1e-9, np.max(np.abs(x))) * .8
    if z["funk"]:
        x = funkfilter(x) * .9
        x = np.concatenate([x, .4 * funk()[:int(.12 * SR)]])
    i = int((st(z["szene"]) + z["start"]) * SR)
    e = min(n, i + len(x))
    stimme[i:e] += x[:e - i]
if gefunden:
    huelle = lowpass(np.abs(stimme), 6) * 8
    a = a * (1 - .45 * np.clip(huelle, 0, 1))          # Hintergrund leiser, solange jemand spricht
    a = a / max(1e-9, np.max(np.abs(a))) * .6 + stimme
print(f"Stimmen gemischt: {gefunden}")
a = a / max(1e-9, np.max(np.abs(a))) * .89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((a * 32767).astype(np.int16).tobytes())
print("Ton:", DAUER, "s")
