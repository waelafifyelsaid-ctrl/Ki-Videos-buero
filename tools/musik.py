"""Eigene Hintergrundmusik per Code (lizenzfrei, keine fremden Songs).

Baukasten: Kick, Snare, HiHat, Toms, Bass, Pad, Stabs, Arpeggio, Riser, Impact.
Alles in d-Moll. Benutzung siehe videos/falke-01-3d/ton.py (Funktion musik()).
"""
import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
NOTEN = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name, okt):
    return 440.0 * 2 ** ((NOTEN[name] + 12 * (okt + 1) - 69) / 12)


def ts(d):
    return np.arange(int(d * SR)) / SR


def lp(x, f, ordnung=2):
    b, a = butter(ordnung, min(f, SR / 2 - 100) / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, f, ordnung=2):
    b, a = butter(ordnung, f / (SR / 2), "high")
    return lfilter(b, a, x)


def saege(f, d, verstimmt=0.0):
    t = ts(d)
    return 2 * ((t * f * (1 + verstimmt)) % 1) - 1


class Musik:
    def __init__(self, dauer, seed=11):
        self.n = int(dauer * SR)
        self.m = np.zeros(self.n)
        self.rng = np.random.default_rng(seed)

    def add(self, t0, sig, vol=1.0):
        i = int(t0 * SR)
        if i >= self.n or i + len(sig) <= 0:
            return
        if i < 0:
            sig, i = sig[-i:], 0
        e = min(self.n, i + len(sig))
        self.m[i:e] += vol * sig[:e - i]

    # ---- Schlagzeug
    def kick(self, t0, v=1.0):
        t = ts(.35)
        self.add(t0, np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-28 * t)) / SR) * np.exp(-7 * t), v)

    def snare(self, t0, v=1.0):
        t = ts(.25)
        rausch = hp(self.rng.uniform(-1, 1, len(t)), 1500) * np.exp(-18 * t)
        ton = np.sin(2 * np.pi * 185 * t) * np.exp(-25 * t)
        self.add(t0, .7 * rausch + .5 * ton, v)

    def hat(self, t0, v=1.0, offen=False):
        d = .25 if offen else .05
        t = ts(d)
        self.add(t0, hp(self.rng.uniform(-1, 1, len(t)), 7000) * np.exp(-(10 if offen else 70) * t), v)

    def tom(self, t0, f=90, v=1.0):
        t = ts(.5)
        self.add(t0, np.sin(2 * np.pi * np.cumsum(f + 60 * np.exp(-15 * t)) / SR) * np.exp(-6 * t), v)

    # ---- Melodisches
    def bass(self, t0, note, d, v=1.0, cutoff=600):
        f = hz(note, 1)
        t = ts(d)
        x = saege(f, d) + .5 * saege(f, d, .006)
        x = lp(x * np.minimum(1, t * 200) * np.exp(-1.5 * t), cutoff)
        self.add(t0, x, v)

    def pad(self, t0, akkord, d, v=1.0, cutoff=1400, attack=.8):
        t = ts(d)
        x = sum(saege(hz(n, o), d, dv) for n, o in akkord for dv in (-.004, 0, .005)) / (3 * len(akkord))
        huelle = np.minimum(1, t / attack) * np.minimum(1, (d - t) / .6)
        self.add(t0, lp(x, cutoff) * huelle, v)

    def stab(self, t0, akkord, v=1.0, d=.35):
        t = ts(d)
        x = sum(np.sign(np.sin(2 * np.pi * hz(n, o) * t)) for n, o in akkord) / len(akkord)
        self.add(t0, lp(x, 2500) * np.exp(-6 * t), v)

    def arp(self, t0, noten, d_note, wiederh, v=1.0):
        for k in range(wiederh):
            n, o = noten[k % len(noten)]
            t = ts(d_note * .9)
            x = (2 * np.abs(2 * ((t * hz(n, o)) % 1) - 1) - 1) * np.exp(-8 * t)
            self.add(t0 + k * d_note, x, v)

    def riser(self, t0, d, v=1.0):
        t = ts(d)
        rausch = self.rng.uniform(-1, 1, len(t))
        k = t / d
        x = np.zeros(len(t))
        for i in range(0, len(t), 2205):     # gleitender Tiefpass in Blöcken
            x[i:i + 2205] = lp(rausch[i:i + 2205], 300 + 9000 * k[i] ** 2)
        ton = np.sin(2 * np.pi * np.cumsum(110 + 700 * k ** 2) / SR)
        self.add(t0, (.6 * x + .3 * ton) * k ** 1.5, v)

    def impact(self, t0, v=1.0):
        t = ts(2.5)
        tief = np.sin(2 * np.pi * np.cumsum(32 + 50 * np.exp(-4 * t)) / SR) * np.exp(-1.6 * t)
        self.add(t0, tief + .3 * lp(self.rng.uniform(-1, 1, len(t)), 3000) * np.exp(-3 * t), v)

    # ---- Muster
    def groove(self, t0, t1, bpm, stufe=1, akkorde=None, bass_noten=None, cutoff_bass=600):
        """stufe 1 = locker, 2 = treibend, 3 = Action."""
        b = 60 / bpm
        akkorde = akkorde or [[("D", 3), ("F", 3), ("A", 3)]]
        bass_noten = bass_noten or ["D"]
        takt, t = 0, t0
        while t < t1 - 1e-6:
            for s in range(16):               # Sechzehntel
                ts_ = t + s * b / 4
                if ts_ >= t1:
                    break
                if stufe >= 2 or s in (0, 8):
                    if s % 4 == 0:
                        self.kick(ts_, .9 if stufe >= 2 else .6)
                if stufe == 3 and s in (6, 14):
                    self.kick(ts_, .6)
                if s in (4, 12):
                    self.snare(ts_, .55 if stufe == 1 else .8)
                if (stufe >= 2 or s % 4 == 2) and s % 2 == 0:
                    self.hat(ts_, .25 if s % 4 else .15)
                if stufe >= 2 and s % 2 == 0:
                    self.bass(ts_, bass_noten[takt % len(bass_noten)], b / 2 * .95, .5, cutoff_bass)
                elif stufe == 1 and s in (0, 6, 10):
                    self.bass(ts_, bass_noten[takt % len(bass_noten)], b * .9, .45, cutoff_bass)
                if stufe == 3 and s == 0 and takt % 2 == 0:
                    self.stab(ts_, akkorde[takt % len(akkorde)], .35)
                if stufe == 3 and s in (13, 15) and takt % 4 == 3:
                    self.tom(ts_, 80 + 20 * (s == 15), .7)
            self.pad(t, akkorde[takt % len(akkorde)], min(4 * b, t1 - t), .22 if stufe < 3 else .16)
            takt += 1
            t += 4 * b

    def fertig(self, lautheit=.35):
        m = self.m - np.mean(self.m)
        return m / max(1e-9, np.max(np.abs(m))) * lautheit
