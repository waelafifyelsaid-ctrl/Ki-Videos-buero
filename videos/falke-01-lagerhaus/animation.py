#!/usr/bin/env python3
"""EINHEIT FALKE – Einsatz 01: Lagerhaus 7 (Regen, Nacht, Hafen).

  python3 animation.py frames <a> <b> | bild <t> <png> | ton <wav> | skript
"""
import math
import random
import sys
import wave
from pathlib import Path

import cairo
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
from cartoon import SR, babbeln, lowpass, sichtbar, uebergang  # noqa: E402
from einsatz import *  # noqa: E402,F401,F403

# ---------------------------------------------------------------- Ablauf
SZ = [
    dict(n="hook", d=4.0, tr=None),
    dict(n="hq", d=10.0, tr="uhr", karte="6 STUNDEN VORHER"),
    dict(n="briefing", d=9.0, tr="zoom", fokus=(540, 640)),
    dict(n="montage", d=5.0, tr="glitch"),
    dict(n="fahrt", d=4.5, tr="whip"),
    dict(n="van", d=5.0, tr="zoom", fokus=(640, 1060)),
    dict(n="anschleichen", d=7.0, tr="black"),
    dict(n="zugriff", d=7.0, tr="zoom", fokus=(290, 930)),
    dict(n="innen", d=8.5, tr=None),
    dict(n="verfolgung", d=9.0, tr="whip"),
    dict(n="twist", d=9.5, tr="iris", fokus=(540, 1100)),
]
_t = 0.0
for _s in SZ:
    _s["start"] = _t
    _t += _s["d"]
DAUER = _t
TR_DAUER = {"uhr": 0.9, "zoom": 0.55, "iris": 0.5}


def start(n):
    return next(s["start"] for s in SZ if s["n"] == n)


# ---------------------------------------------------------------- Skript
CPS = 22
DIALOG = [
    ("hook", 0.5, "ich", "Okay … das war lauter als geplant.", 2.6),
    ("hq", 5.4, "ich", "Tank, das ist dein drittes Frühstück.", 7.3),
    ("hq", 7.4, "tank", "Viertes.", 8.3),
    ("hq", 8.5, "boss", "Briefing. Sofort.", 10.0),
    ("briefing", 0.3, "hartmann", "Hafen Nord, Lagerhaus 7. Drogen im Wert von 40 Millionen.", 3.1),
    ("briefing", 3.2, "hartmann", "Der Kopf der Bande: 'Der Fuchs'. Er hat immer einen Plan B.", 5.6),
    ("briefing", 5.7, "ich", "Und was ist UNSER Plan B?", 6.9),
    ("briefing", 7.0, "boss", "Tank.", 7.6),
    ("briefing", 7.7, "tank", "Ich bin Plan A bis Z.", 9.0),
    ("van", 0.2, "pixel", "Ich hasse Regen. Und Häfen. Und Möwen.", 2.4),
    ("van", 2.5, "ich", "Pixel, du bist ein Angsthase mit WLAN.", 5.0),
    ("anschleichen", 3.2, "boss", "Alle auf Position. Leise.", 5.0),
    ("anschleichen", 5.1, "tank", "Ich bin IMMER leise.", 7.0),
    ("zugriff", 0.3, "boss", "Ladung gesetzt.", 1.3),
    ("zugriff", 1.4, "boss", "Drei … zwei … eins …", 3.5),
    ("zugriff", 4.4, "boss", "ZUGRIFF!", 5.6),
    ("innen", 2.6, "nova", "FALKE! Hände hoch! SOFORT!", 4.2),
    ("innen", 5.6, "tank", "Hingefallen. Komisch.", 6.7),
    ("innen", 6.8, "pixel", "Der Fuchs! Hinterausgang, Richtung Pier!", 8.0),
    ("innen", 8.0, "boss", "Neuer – hinterher!", 8.5),
    ("verfolgung", 0.8, "ich", "Stehen bleiben, du Fuchs-Imitat!", 2.8),
    ("verfolgung", 2.9, "fuchs", "Fang mich doch, Anfänger!", 4.4),
    ("verfolgung", 6.1, "ich", "Plan B war wohl: ausrutschen.", 7.6),
    ("verfolgung", 7.7, "fuchs", "Ihr habt keine Ahnung, wer ich bin …", 9.0),
    ("twist", 0.4, "pixel", "Leute … das ist nur sein FAHRER.", 2.4),
    ("twist", 2.5, "fuchs", "Der echte Fuchs fliegt um sechs.", 4.2),
    ("twist", 4.3, "boss", "Packt eure Sachen. Wir fliegen.", 5.8),
    ("twist", 5.9, "ich", "Ich hab Flugangst.", 6.8),
    ("twist", 6.9, "tank", "Ich hab Hunger.", 7.6),
]
STIMME = {"boss": 125, "tank": 92, "nova": 255, "pixel": 225, "ich": 175, "hartmann": 210, "fuchs": 150,
          "ganove": 135}


def aktive_zeile(n, lt):
    akt = None
    for sz, s0, wer, txt, bis in DIALOG:
        if sz == n and s0 <= lt < bis:
            akt = (wer, txt, lt - s0)
    return akt


def redet(n, lt, wer):
    z = aktive_zeile(n, lt)
    return bool(z and z[0] == wer and z[2] < len(z[1]) / CPS)


def flap(lt):
    return 0.2 + 0.55 * abs(math.sin(lt * 21))


def mund(n, lt, wer, sonst="laecheln"):
    return flap(lt) if redet(n, lt, wer) else sonst


def zeige_untertitel(ctx, n, lt, y=1330):
    z = aktive_zeile(n, lt)
    if z:
        wer, txt, d = z
        untertitel(ctx, wer, txt, sichtbar(d, txt, CPS), y=y, sc=ease_back(d / 0.15))


# ---------------------------------------------------------------- Gemeinsame Welt: Lagerhaus-Front (Hook + Zugriff + Twist)
WAND_Z = 6.0
TUER = (-0.75, 0.75, 2.35)          # x0, x1, Höhe
PFUETZEN = [(-1.0, 2.2, 0.8), (1.8, 3.4, 1.1), (-2.6, 4.6, 0.7), (0.6, 5.2, 0.6)]


def tuer_physik(d):
    """Tür fliegt nach der Sprengung auf die Kamera zu und landet flach auf dem Boden.
    Rückgabe: (mitte_y, mitte_z, kippwinkel) in Weltkoordinaten."""
    y, z, vy, vz, w, om = 1.18, WAND_Z - 0.05, 3.2, -7.5, 0.0, -5.5
    dt, t = 1 / 240, 0.0
    liegt = False
    while t < d and not liegt:
        vy -= G * dt
        y += vy * dt
        z += vz * dt
        w += om * dt
        # Unterkante: halbe Türhöhe * |cos(w)| + halbe Dicke
        unter = y - 1.175 * abs(math.cos(w)) - 0.04
        if unter <= 0 and vy < 0:
            if abs(math.cos(w)) < 0.35 or abs(vy) < 1.5:
                liegt = True
            else:
                vy = -vy * 0.3
                vz *= 0.5
                om *= 0.6
                y -= unter
        t += dt
    if liegt:
        return 0.05, z, -math.pi / 2
    return y, z, w


def tuer_zeichnen(ctx, cam, d):
    y, z, w = tuer_physik(d)
    hx, hh = (TUER[1] - TUER[0]) / 2, 1.175
    ecken = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        ly = sy * hh
        ecken.append((sx * hx, y + ly * math.cos(w), z + ly * math.sin(w)))
    flaeche(ctx, cam, ecken, "#6c757d", 6)
    mitte = (0, y, z)
    linie3d(ctx, cam, (-hx * 0.7, y, z), (hx * 0.7, y, z), "#495057", 4)
    return mitte


def lagerhaus_front(ctx, cam, t, gesprengt_d=None, licht=True):
    """Wand bei z = WAND_Z mit Tür (oder Loch nach der Sprengung). gesprengt_d = Sek. seit Sprengung."""
    himmel(ctx, "regen", True, cam.horizont)
    # Kräne in der Ferne
    for kx, kh in ((-14, 26), (16, 30)):
        linie3d(ctx, cam, (kx, 0, 60), (kx, kh, 60), "#1d2d50", 14)
        linie3d(ctx, cam, (kx - 10, kh, 60), (kx + 12, kh, 60), "#1d2d50", 12)
    boden(ctx, cam, "regen", z0=-3, z1=WAND_Z, farbe="#495057")
    pfuetzen(ctx, cam, PFUETZEN, 0.5)
    x0, x1, th = TUER
    wand = "#8b4a2b"
    loch = gesprengt_d is not None and gesprengt_d >= 0
    # Wand in Teilen um die Tür herum (damit man durch das Loch sehen kann)
    if loch:
        flaeche(ctx, cam, [(x0, 0, WAND_Z + 0.4), (x1, 0, WAND_Z + 0.4), (x1, th, WAND_Z + 0.4), (x0, th, WAND_Z + 0.4)],
                "#0b0b10", 0)
        # schwacher Schein von innen
    for pts in ([(-12, 0, WAND_Z), (x0, 0, WAND_Z), (x0, 9, WAND_Z), (-12, 9, WAND_Z)],
                [(x1, 0, WAND_Z), (12, 0, WAND_Z), (12, 9, WAND_Z), (x1, 9, WAND_Z)],
                [(x0, th, WAND_Z), (x1, th, WAND_Z), (x1, 9, WAND_Z), (x0, 9, WAND_Z)]):
        flaeche(ctx, cam, pts, wand, 6)
    # Ziegelfugen
    yy = 0.35
    while yy < 9:
        for xa, xb in ((-12, x0), (x1, 12)):
            linie3d(ctx, cam, (xa, yy, WAND_Z - 0.01), (xb, yy, WAND_Z - 0.01), "#6d3a22", 2)
        if yy > th:
            linie3d(ctx, cam, (x0, yy, WAND_Z - 0.01), (x1, yy, WAND_Z - 0.01), "#6d3a22", 2)
        yy += 0.35
    # große "7"
    px, py = cam.p(3.6, 4.6, WAND_Z)
    text(ctx, "7", px, py, 2.2 * cam.skala(0, WAND_Z), fill="#f1faee", sw=10)
    # Rolltor rechts
    flaeche(ctx, cam, [(5.5, 0, WAND_Z - 0.02), (9.5, 0, WAND_Z - 0.02), (9.5, 3.6, WAND_Z - 0.02),
                       (5.5, 3.6, WAND_Z - 0.02)], "#adb5bd", 5)
    yy = 0.3
    while yy < 3.6:
        linie3d(ctx, cam, (5.5, yy, WAND_Z - 0.03), (9.5, yy, WAND_Z - 0.03), "#6c757d", 2)
        yy += 0.25
    if not loch:
        flaeche(ctx, cam, [(x0, 0, WAND_Z - 0.02), (x1, 0, WAND_Z - 0.02), (x1, th, WAND_Z - 0.02),
                           (x0, th, WAND_Z - 0.02)], "#6c757d", 6)
        linie3d(ctx, cam, (x1 - 0.25, 1.1, WAND_Z - 0.03), (x1 - 0.1, 1.1, WAND_Z - 0.03), "#ced4da", 6)
    else:
        # verkohlte Ränder
        for pts in ([(x0 - 0.3, -0.0, WAND_Z - 0.02), (x0, 0, WAND_Z - 0.02), (x0, th + 0.2, WAND_Z - 0.02),
                     (x0 - 0.35, th + 0.4, WAND_Z - 0.02)],
                    [(x1, 0, WAND_Z - 0.02), (x1 + 0.3, 0, WAND_Z - 0.02), (x1 + 0.4, th + 0.3, WAND_Z - 0.02),
                     (x1, th + 0.2, WAND_Z - 0.02)]):
            flaeche(ctx, cam, pts, "#2b2118", 0)
    # Lampe über der Tür
    lx, ly = cam.p(0, 3.0, WAND_Z - 0.1)
    s = cam.skala(0, WAND_Z)
    rrect(ctx, lx - 0.3 * s, ly - 0.12 * s, 0.6 * s, 0.22 * s, 0.06 * s)
    form(ctx, "#343a40", 4)
    return (lx, ly + 0.1 * s, s)


def ladung(ctx, cam, t):
    px, py = cam.p(0, 1.25, WAND_Z - 0.05)
    s = cam.skala(0, WAND_Z)
    rrect(ctx, px - 0.18 * s, py - 0.12 * s, 0.36 * s, 0.24 * s, 0.03 * s)
    form(ctx, "#343a40", 4)
    if int(t * 4) % 2 == 0:
        ctx.arc(px + 0.1 * s, py - 0.05 * s, 0.035 * s, 0, 2 * math.pi)
        ctx.set_source_rgba(1, 0.1, 0.2, 1)
        ctx.fill()
        licht_punkt(ctx, px + 0.1 * s, py - 0.05 * s, 0.25 * s, (1, 0.1, 0.2), 0.8)


def team_an_der_tuer(ctx, cam, t, nach_expl=None):
    """Boss, Tank, Nova, Pixel von hinten, geduckt neben der Tür. Reagieren auf die Explosion."""
    duck = 0.0
    if nach_expl is not None and nach_expl >= 0:
        duck = clamp(1 - nach_expl / 1.6)
    plan = [("nova", -2.5, 3.6), ("pixel", 2.6, 3.4), ("boss", -1.55, 4.5), ("tank", 1.55, 4.4)]
    for wer, X, Z in sorted(plan, key=lambda p: -p[2]):
        atm = 0.03 * math.sin(t * 2.5 + X)
        arme = (-2.0, -1.6, 2.0, 1.6) if duck > 0.3 else (0.5 + atm, 1.0, 0.4, 1.1)
        if wer == "boss" and nach_expl is None:
            arme = (0.4, 1.0, 2.6 + 0.1 * math.sin(t * 3), 0.3)   # Handzeichen
        teammitglied(ctx, cam, wer, X, Z, k=dict(ruecken=True),
                     beine=(0.5, 1.1 + 0.5 * duck, -0.45, 1.0 + 0.5 * duck), neigung=0.1 + 0.35 * duck,
                     arme=arme)


def front_szene(ctx, t, lt, expl_lt, cam_z=0.0, pov=True, team=True, freeze=False, lauf=0.0):
    """Hook / Zugriff: POV vor der Tür. expl_lt = Szenenzeit der Sprengung."""
    d = lt - expl_lt
    wackel = 0.0
    if d >= 0:
        wackel = 40 * math.exp(-3.5 * d)
    dx, dy = kamera_wackel(t, wackel)
    cam = Kamera(x=0.0 + dx * 0.004, y=1.55 + 0.05 * math.sin(t * 9) * lauf + dy * 0.004, z=cam_z, f=900, horizont=880)
    ctx.save()
    ctx.translate(dx, dy)
    lp = lagerhaus_front(ctx, cam, t, gesprengt_d=d if d >= 0 else None)
    if d < 0:
        ladung(ctx, cam, t)
    nacht_filter(ctx, 0.6)
    licht_punkt(ctx, lp[0], lp[1], 3.2 * lp[2], alpha=0.55)
    lichtkegel(ctx, lp[0], lp[1], 4 * lp[2], 6 * lp[2], alpha=0.22)

    def figuren():
        if team:
            team_an_der_tuer(ctx, cam, t, d if d >= 0 else None)
        if d >= 0:
            tuer_zeichnen(ctx, cam, d)
    ebene(ctx, figuren, 0.22)
    tx, ty = cam.p(0, 1.2, WAND_Z)
    boden_y = cam.p(0, 0, WAND_Z - 1.0)[1]
    if d >= 0:
        explosion(ctx, tx, ty, d, s=cam.skala(0, WAND_Z) / 160, boden_y=boden_y, seed=4)
        licht_punkt(ctx, tx, ty, 900, (1, 0.55, 0.15), 0.9 * clamp(1.4 - d))
    regen(ctx, t if not freeze else expl_lt + 2.4, alpha=0.4)
    if pov:
        pov_arme(ctx, t, laufen=lauf, zielen=0.15 if d < 0 else 0.0, lampe=lauf > 0)
    ctx.restore()
    return cam


# ---------------------------------------------------------------- Szene 1: Hook
def s_hook(ctx, t, lt):
    freeze_ab = 2.5
    lt_eff = min(lt, freeze_ab)
    front_szene(ctx, start("hook") + lt_eff, lt_eff, expl_lt=-0.12, freeze=lt >= freeze_ab)
    text(ctx, "EINSATZ 01", 540, 120, 64, fill="#80ed99", sw=10, scale=ease_back(lt / 0.2))
    zeige_untertitel(ctx, "hook", lt)
    if lt >= freeze_ab:
        k = clamp((lt - freeze_ab) / 0.25)
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_HSL_SATURATION)
        ctx.set_source_rgba(0.5, 0.5, 0.5, k)
        ctx.paint()
        ctx.restore()
        text(ctx, "Wie wir hier gelandet sind?", 540, 1560, 62, fill="#ffffff", sw=12,
             scale=ease_back((lt - freeze_ab - 0.1) / 0.25), maxw=980)
        if lt > 3.3:   # Zurückspulen
            rnd = random.Random(int(lt * FPS))
            for _ in range(12):
                y = rnd.uniform(0, H)
                ctx.rectangle(0, y, W, rnd.uniform(4, 22))
            ctx.set_source_rgba(1, 1, 1, 0.5)
            ctx.fill()
            text(ctx, "◀◀", 540, 960, 200, fill="#ffffff", sw=16)


# ---------------------------------------------------------------- Szene 2+3: Hauptquartier
RAUM = dict(x0=-4.6, x1=4.6, y1=3.4, z1=9.5)


def hq_raum(ctx, cam, t, schirm="logo", alarm=0.0, schirm_lt=0.0):
    r = RAUM
    x0, x1, y1, z1 = r["x0"], r["x1"], r["y1"], r["z1"]
    flaeche(ctx, cam, [(x0, 0, -2), (x1, 0, -2), (x1, 0, z1), (x0, 0, z1)], "#5c677d", 0)
    z = 0.0
    while z < z1:   # Bodenfliesen
        linie3d(ctx, cam, (x0, 0.002, z), (x1, 0.002, z), "#4a5468", 2)
        z += 1.0
    x = x0
    while x <= x1:
        linie3d(ctx, cam, (x, 0.002, -2), (x, 0.002, z1), "#4a5468", 2)
        x += 1.0
    flaeche(ctx, cam, [(x0, y1, -2), (x1, y1, -2), (x1, y1, z1), (x0, y1, z1)], "#dee2e6", 4)
    flaeche(ctx, cam, [(x0, 0, -2), (x0, 0, z1), (x0, y1, z1), (x0, y1, -2)], "#9aa5b8", 5)
    flaeche(ctx, cam, [(x1, 0, -2), (x1, 0, z1), (x1, y1, z1), (x1, y1, -2)], "#9aa5b8", 5)
    flaeche(ctx, cam, [(x0, 0, z1), (x1, 0, z1), (x1, y1, z1), (x0, y1, z1)], "#b8c0cc", 5)
    # Fenster links mit Regen
    for za in (1.0, 4.0, 7.0):
        flaeche(ctx, cam, [(x0 + 0.01, 1.0, za), (x0 + 0.01, 1.0, za + 2.2), (x0 + 0.01, 2.7, za + 2.2),
                           (x0 + 0.01, 2.7, za)], "#6c8ebf", 5, "#f8f9fa")
        rnd = random.Random(int(za))
        for k in range(10):
            zz = za + 0.15 + rnd.random() * 1.9
            ya = 2.65 - ((t * rnd.uniform(0.4, 0.9) + rnd.random()) % 1) * 1.6
            linie3d(ctx, cam, (x0 + 0.02, ya, zz), (x0 + 0.02, ya - 0.12, zz), "#dbe9ff", 3)
    # Spinde rechts
    for k in range(6):
        za = 1.0 + k * 0.75
        flaeche(ctx, cam, [(x1 - 0.01, 0, za), (x1 - 0.01, 0, za + 0.7), (x1 - 0.01, 2.1, za + 0.7),
                           (x1 - 0.01, 2.1, za)], "#495057", 4)
        linie3d(ctx, cam, (x1 - 0.02, 1.0, za + 0.55), (x1 - 0.02, 1.2, za + 0.55), "#ced4da", 4)
    # Logo-Schild + Bildschirm an der Rückwand
    px, py = cam.p(-3.3, 2.95, z1 - 0.01)
    text(ctx, "EINHEIT FALKE", px + 1.2 * cam.skala(0, z1), py, 0.36 * cam.skala(0, z1), fill="#2b2d42", stroke=None)
    sx0, sy0 = cam.p(-2.0, 2.75, z1 - 0.02)
    sx1, sy1 = cam.p(2.0, 0.95, z1 - 0.02)
    rrect(ctx, sx0 - 10, sy0 - 10, sx1 - sx0 + 20, sy1 - sy0 + 20, 10)
    form(ctx, "#111111", 6)
    ctx.save()
    ctx.rectangle(sx0, sy0, sx1 - sx0, sy1 - sy0)
    ctx.clip()
    ctx.translate(sx0, sy0)
    ctx.scale((sx1 - sx0) / 1600, (sy1 - sy0) / 720)
    schirm_inhalt(ctx, schirm, t, schirm_lt, alarm)
    ctx.restore()
    # Deckenlampen
    for zz in (2.5, 6.0):
        flaeche(ctx, cam, [(-1.2, y1 - 0.01, zz), (1.2, y1 - 0.01, zz), (1.2, y1 - 0.01, zz + 0.5),
                           (-1.2, y1 - 0.01, zz + 0.5)], "#fffbe6", 3)
    # Tisch
    kiste(ctx, cam, -1.5, 1.5, 0.74, 0.82, 4.6, 6.2, "#7f5539", 5)
    return (sx0 + sx1) / 2, (sy0 + sy1) / 2


def schirm_inhalt(ctx, modus, t, lt, alarm):
    if alarm > 0 and modus != "karte":
        ctx.set_source_rgba(0.5 + 0.4 * alarm, 0.02, 0.05, 1)
        ctx.paint()
        text(ctx, "EINSATZ", 800, 330, 260, fill="#ffffff", sw=24, scale=1 + 0.05 * math.sin(t * 12))
        text(ctx, "ALARMSTUFE ROT", 800, 560, 90, fill="#ffd166", stroke=None)
        return
    if modus == "logo":
        ctx.set_source_rgba(*hexc("#0b132b"))
        ctx.paint()
        ctx.move_to(800, 140)
        ctx.line_to(1000, 380)
        ctx.line_to(800, 300)
        ctx.line_to(600, 380)
        ctx.close_path()
        form(ctx, "#80ed99", 10)
        text(ctx, "FALKE", 800, 520, 150, fill="#ffffff", stroke=None)
        return
    # Karte: Hafen + Zielperson
    ctx.set_source_rgba(*hexc("#1d3557"))
    ctx.paint()
    ctx.set_source_rgba(*hexc("#457b9d"))
    ctx.rectangle(0, 470, 1600, 250)
    ctx.fill()
    for k, (x, w) in enumerate(((120, 220), (420, 260), (760, 220), (1060, 240))):
        rrect(ctx, x, 230, w, 200, 8)
        form(ctx, "#a8dadc" if k != 1 else "#e63946", 6)
        text(ctx, str(5 + k), x + w / 2, 330, 90, fill="#1d3557", stroke=None)
    for x in range(140, 1400, 160):
        ctx.rectangle(x, 470, 40, 140)
    ctx.set_source_rgba(*hexc("#a8dadc"))
    ctx.fill()
    pr = 140 + 60 * ((lt * 1.3) % 1)
    ctx.arc(550, 330, pr, 0, 2 * math.pi)
    ctx.set_source_rgba(1, 0.2, 0.25, 1 - ((lt * 1.3) % 1))
    ctx.set_line_width(10)
    ctx.stroke()
    text(ctx, "HAFEN NORD · LAGERHAUS 7", 800, 90, 70, fill="#ffffff", stroke=None)
    if lt > 2.6:   # Zielperson-Karte
        k = ease_back((lt - 2.6) / 0.3)
        ctx.save()
        ctx.translate(1300, 380)
        ctx.scale(k, k)
        rrect(ctx, -230, -300, 460, 600, 20)
        form(ctx, "#f1faee", 8)
        ctx.arc(0, -90, 110, 0, 2 * math.pi)
        form(ctx, "#343a40", 6)
        rrect(ctx, -150, 20, 300, 160, 70)
        form(ctx, "#343a40", 6)
        text(ctx, "?", 0, -90, 150, fill="#ff9f1c", stroke=None)
        text(ctx, "\"DER FUCHS\"", 0, 240, 64, fill="#e63946", stroke=None)
        ctx.restore()


def hartmann(ctx, cam, X, Z, n, lt):
    return figur(ctx, cam, X, Z,
                 dict(hemd="#495057", hose="#343a40", schuh="#111111", weste=None,
                      arme=(0.3, 0.4, -0.5 - 0.6 * abs(math.sin(lt * 2)) if redet(n, lt, "hartmann") else -0.3, -0.5)),
                 dict(haut="#f1c27d", zopf="#e9ecef", haare="stachel", haarfarbe="#e9ecef", brille=True,
                      mund=mund(n, lt, "hartmann", "gerade"), augen="normal"), 1.72)


def namensschild(ctx, ziel, z1, z2, farbe, k, links=False):
    if k <= 0.01:
        return
    x = ziel[0] + (-260 if links else 260)
    y = ziel[1] - 140
    x = clamp(x, 250, W - 250)
    ctx.move_to(x, y + 50)
    ctx.line_to(*ziel)
    ctx.set_source_rgba(1, 1, 1, 1)
    ctx.set_line_width(5)
    ctx.stroke()
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(k, k)
    rrect(ctx, -235, -62, 470, 124, 18)
    form(ctx, "#0b132b", 6, farbe)
    text(ctx, z1, 0, -22, 50, fill=farbe, stroke=None)
    text(ctx, z2, 0, 32, 32, fill="#ffffff", stroke=None, maxw=440)
    ctx.restore()


def s_hq(ctx, t, lt):
    alarm = 0.5 + 0.5 * math.sin(lt * 9) if lt >= 8.0 else 0.0
    cam = Kamera(x=0.2 * math.sin(lt * 0.25), y=1.6, z=1.6 + 0.06 * lt, f=900, horizont=820)
    hq_raum(ctx, cam, t, "logo", alarm)
    schauen = (0, 0) if lt < 8.0 else (0, -0.6)
    rede = lambda w, sonst="laecheln": mund("hq", lt, w, sonst)  # noqa: E731
    # Reihenfolge: hinten zuerst
    boss = teammitglied(ctx, cam, "boss", 3.0, 8.0, arme=(0.4, 0.5, 0.9, 1.8),
                        k=dict(mund=rede("boss", "gerade"), blick=schauen))
    if boss:   # Kaffeetasse
        hx, hy = boss[0]
        s = boss[3]
        rrect(ctx, hx - 22 * s, hy - 70 * s, 44 * s, 52 * s, 8 * s)
        form(ctx, "#f8f9fa", 4)
    nova = teammitglied(ctx, cam, "nova", -2.3, 7.4, arme=(0.3, 0.4, 2.2 + 0.25 * math.sin(lt * 5), 1.9),
                        k=dict(mund="grinsen" if 7.4 < lt < 8.3 else "laecheln", blick=schauen), beine=(0.1, 0, -0.3, 0.2))
    beiss = (lt * 1.1) % 1 < 0.25
    tank = teammitglied(ctx, cam, "tank", -0.75, 6.7, arme=(0.6, 1.2, 1.0 if not beiss else 1.6, 1.8 if not beiss else 2.3),
                        k=dict(mund=rede("tank", 0.5 if beiss else "grinsen"), augen="zu" if beiss else "normal",
                               blick=schauen))
    if tank and lt < 8.0:   # Riesen-Sandwich
        hx, hy = tank[0]
        s = tank[3]
        rrect(ctx, hx - 70 * s, hy - 40 * s, 140 * s, 56 * s, 20 * s)
        form(ctx, "#e9c46a", 4)
        ctx.rectangle(hx - 66 * s, hy - 16 * s, 132 * s, 10 * s)
        ctx.set_source_rgba(*hexc("#52b788"))
        ctx.fill()
    pixel = teammitglied(ctx, cam, "pixel", 0.95, 6.7, arme=(0.9, 0.9, 0.8 + 0.1 * math.sin(lt * 20), 0.9),
                         k=dict(mund="gerade" if lt < 8 else 0.5, augen="weit" if lt >= 8 else "normal", blick=(0.4, 0.6)))
    # Tischkante vor den Sitzenden
    kiste(ctx, cam, -1.5, 1.5, 0.74, 0.82, 4.6, 6.2, "#7f5539", 5)
    lx, ly = cam.p(0.95, 0.83, 5.2)
    s = cam.skala(0.95, 5.2)
    ctx.move_to(lx - 0.35 * s, ly)
    ctx.line_to(lx + 0.35 * s, ly)
    ctx.line_to(lx + 0.3 * s, ly - 0.32 * s)
    ctx.line_to(lx - 0.3 * s, ly - 0.32 * s)
    ctx.close_path()
    form(ctx, "#adb5bd", 4)
    ich = teammitglied(ctx, cam, "ich", 1.35, 4.9, arme=(0.2, 0.3, -0.3 if lt < 5.4 else 1.6, -0.3 if lt < 5.4 else 0.9),
                       k=dict(mund=rede("ich", "grinsen"), blick=(-0.7, 0) if lt < 8 else (0, -0.6)),
                       beine=(0.12, 0, -0.18, 0.1))
    # Alarmlicht
    if alarm > 0:
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_ADD)
        ctx.set_source_rgba(0.6, 0.0, 0.05, 0.25 * alarm)
        ctx.paint()
        ctx.restore()
        text(ctx, "EINSATZ!", 540, 330, 120, fill="#ff0a54", sw=16, scale=ease_back((lt - 8.0) / 0.2) * (1 + 0.06 * alarm))
    # Namensschilder
    schilder = [(boss, "BOSS", "Teamleiter. Hatte nie Urlaub.", "boss", True),
                (tank, "TANK", "Ramme. Isst immer.", "tank", False),
                (nova, "NOVA", "Scharfschützin. Auch mit Worten.", "nova", False),
                (pixel, "PIXEL", "Technik. Angst vor Möwen.", "pixel", False),
                (ich, "ICH", "Der Neue. Große Klappe.", "ich", True)]
    for i, (fig, z1, z2, wer, links) in enumerate(schilder):
        a = 0.3 + i * 1.0
        if fig and a <= lt < a + 1.0:
            namensschild(ctx, fig[2], z1, z2, TEAM[wer]["farbe"], ease_back((lt - a) / 0.2), links)
    zeige_untertitel(ctx, "hq", lt, y=1560)


def s_briefing(ctx, t, lt):
    cam = Kamera(x=-0.5, y=1.75, z=1.2 + 0.1 * lt, f=760, horizont=860)
    hq_raum(ctx, cam, t, "karte", 0.0, lt)
    hartmann(ctx, cam, -2.5, 8.8, "briefing", lt)
    # Team von hinten im Vordergrund (Lücke für Hartmann lassen)
    for wer, X, Z in (("nova", -3.5, 5.6), ("pixel", 2.5, 5.6), ("tank", -0.6, 5.4), ("boss", 1.2, 5.2)):
        teammitglied(ctx, cam, wer, X, Z, k=dict(ruecken=True), arme=(0.15, 0.2, -0.15, -0.2))
    if 7.0 <= lt < 9.0:
        text(ctx, "→ TANK", 540, 1130, 80, fill="#ef476f", sw=12, scale=ease_back((lt - 7.0) / 0.2))
    zeige_untertitel(ctx, "briefing", lt, y=1560)


# ---------------------------------------------------------------- Szene 4: Ausrüsten (Comic-Streifen)
def s_montage(ctx, t, lt):
    ctx.set_source_rgba(*hexc("#0b132b"))
    ctx.paint()
    zeilen = [("boss", "BOSS", "FUNK: CHECK", dict(arme=(0.3, 0.3, 2.6, 0.8))),
              ("tank", "TANK", "RAMME: BEREIT", dict(arme=(-2.5, -0.3, 2.5, 0.3))),
              ("nova", "NOVA", "VISIER: SAUBER", dict(arme=(0.3, 0.3, 2.9, 0.5))),
              ("pixel", "PIXEL", "DROHNE: ONLINE", dict(arme=(0.8, 0.9, 0.8, 0.9))),
              ("ich", "ICH", "BEREIT. GLAUB ICH.", dict(arme=(0.3, 0.3, 2.4, 2.4)))]
    hoehe = H / 5
    for i, (wer, name, aktion, P) in enumerate(zeilen):
        a = i * 0.75
        if lt < a:
            continue
        k = ease_out((lt - a) / 0.3)
        seite = 1 if i % 2 == 0 else -1
        off = seite * W * (1 - k)
        y0 = i * hoehe
        ctx.save()
        ctx.rectangle(0, y0, W, hoehe)
        ctx.clip()
        ctx.translate(off, 0)
        g = cairo.LinearGradient(0, y0, W, y0 + hoehe)
        g.add_color_stop_rgb(0, *mischen(TEAM[wer]["farbe"], 0.35)[:3])
        g.add_color_stop_rgb(1, *mischen(TEAM[wer]["farbe"], 0.12)[:3])
        ctx.rectangle(-W, y0, 3 * W, hoehe)
        ctx.set_source(g)
        ctx.fill()
        rnd = random.Random(i)
        for _ in range(14):   # Speedlines
            yy = y0 + rnd.uniform(0, hoehe)
            xx = (rnd.uniform(0, W) - (lt - a) * 2500 * seite) % (W + 400) - 200
            ctx.rectangle(xx, yy, 260, 5)
        ctx.set_source_rgba(1, 1, 1, 0.25)
        ctx.fill()
        bx = 290 if seite > 0 else 790
        p = pose(wer, **P)
        p["beine"] = (0.08, 0, -0.08, 0)
        person(ctx, bx, y0 + hoehe * 1.6, 1.05 * TEAM[wer]["groesse"] / 1.8, p,
               gesicht(wer, mund="grinsen" if wer != "pixel" else "gerade", augen="normal"))
        tx = 700 if seite > 0 else 380
        text(ctx, name, tx, y0 + hoehe * 0.36, 92, fill=TEAM[wer]["farbe"], sw=12)
        text(ctx, aktion, tx, y0 + hoehe * 0.68, 50, fill="#ffffff", sw=9, maxw=560,
             scale=ease_back((lt - a - 0.15) / 0.2))
        ctx.restore()
        ctx.rectangle(0, y0 + hoehe - 4, W, 8)
        ctx.set_source_rgba(0, 0, 0, 1)
        ctx.fill()


# ---------------------------------------------------------------- Szene 5: Fahrt (Seitenansicht)
def s_fahrt(ctx, t, lt):
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgb(0, *hexc("#0b1020")[:3])
    g.add_color_stop_rgb(1, *hexc("#24345a")[:3])
    ctx.rectangle(0, 0, W, H)
    ctx.set_source(g)
    ctx.fill()
    weg = t * 900
    # Ferne: Kräne + Container (Parallaxe)
    for i in range(8):
        x = (i * 520 - weg * 0.15) % (W + 600) - 300
        ctx.move_to(x, 1300)
        ctx.line_to(x, 700)
        ctx.line_to(x + 260, 700)
        ctx.set_source_rgba(*hexc("#14213d"))
        ctx.set_line_width(22)
        ctx.stroke()
    for i in range(14):
        x = (i * 230 - weg * 0.4) % (W + 460) - 230
        rrect(ctx, x, 1180, 210, 130, 6)
        form(ctx, ["#264653", "#6d597a", "#9d0208", "#3a5a40"][i % 4], 5)
    # Straße
    ctx.rectangle(0, 1330, W, 400)
    ctx.set_source_rgba(*hexc("#2b2d42"))
    ctx.fill()
    for i in range(10):
        x = (i * 300 - weg * 1.0) % (W + 300) - 150
        ctx.rectangle(x, 1520, 160, 16)
    ctx.set_source_rgba(1, 1, 1, 0.8)
    ctx.fill()
    # Laternen vorbeiziehend
    for i in range(4):
        x = (i * 700 - weg * 1.0) % (W + 700) - 200
        ctx.move_to(x, 1340)
        ctx.line_to(x, 820)
        ctx.line_to(x + 90, 820)
        ctx.set_source_rgba(*hexc("#111111"))
        ctx.set_line_width(14)
        ctx.stroke()
        licht_punkt(ctx, x + 90, 830, 220, alpha=0.5)
    van_seite(ctx, 470, 1560, 1.25, t, blaulicht=True, nacht=True, tempo=1.0)
    # Gischt hinter den Rädern
    rnd = random.Random(int(t * FPS))
    for _ in range(30):
        px = 470 - 250 * 1.25 - rnd.uniform(0, 260)
        py = 1560 - rnd.uniform(0, 120)
        ctx.arc(px, py, rnd.uniform(3, 9), 0, 2 * math.pi)
        ctx.set_source_rgba(0.85, 0.9, 1, 0.5)
        ctx.fill()
    regen(ctx, t, wind=0.75, laenge=90, alpha=0.4)
    einblendung(ctx, "02:14 UHR · EINSATZFAHRT", "Hafen Nord", lt)


# ---------------------------------------------------------------- Szene 6: Im Van (POV)
def s_van(ctx, t, lt):
    rnd = random.Random(int(t * 7))
    dx, dy = rnd.uniform(-1, 1) * 6, rnd.uniform(-1, 1) * 9
    cam = Kamera(x=0.0, y=1.15 + dy * 0.002, z=-1.3, f=620, horizont=820 + dy)
    x0, x1, y1, z1 = -1.2, 1.2, 1.9, 4.4
    flaeche(ctx, cam, [(x0, 0, -1), (x1, 0, -1), (x1, 0, z1), (x0, 0, z1)], "#343a40", 0)
    flaeche(ctx, cam, [(x0, y1, -1), (x1, y1, -1), (x1, y1, z1), (x0, y1, z1)], "#22223b", 4)
    flaeche(ctx, cam, [(x0, 0, -1), (x0, 0, z1), (x0, y1, z1), (x0, y1, -1)], "#3d405b", 5)
    flaeche(ctx, cam, [(x1, 0, -1), (x1, 0, z1), (x1, y1, z1), (x1, y1, -1)], "#3d405b", 5)
    flaeche(ctx, cam, [(x0, 0, z1), (x1, 0, z1), (x1, y1, z1), (x0, y1, z1)], "#2b2d42", 5)
    blau = int(t * 8) % 2
    for xa in (-1.0, 0.1):   # Hecktür-Fenster
        flaeche(ctx, cam, [(xa, 1.0, z1 - 0.01), (xa + 0.9, 1.0, z1 - 0.01), (xa + 0.9, 1.65, z1 - 0.01),
                           (xa, 1.65, z1 - 0.01)], "#4cc9f0" if blau == (xa > 0) else "#1d3557", 5)
    for xa in (x0, x1):      # Bänke
        kiste(ctx, cam, min(xa, xa * 0.55), max(xa, xa * 0.55), 0, 0.45, 0.3, 4.2, "#495057", 4)
    nacht_filter(ctx, 0.3, (0.5, 0.2, 0.25))
    team_im_van = []
    for wer, X, Z, links in (("nova", -0.82, 3.3, False), ("pixel", 0.82, 3.1, True),
                             ("boss", -0.82, 1.9, False), ("tank", 0.82, 1.7, True)):
        beine = (-1.45, 1.4, -1.35, 1.35)
        P = pose(wer, beine=beine, arme=(1.0, 0.6, 1.2, 0.5), links=links)
        if wer == "pixel":
            P["arme"] = (1.0, 0.6, 1.2 + 0.4 * abs(math.sin(lt * 8)), 0.5) if redet("van", lt, "pixel") else (1.6, 1.8, 1.6, 1.8)
        K = gesicht(wer, mund=mund("van", lt, wer, "gerade" if wer == "pixel" else "laecheln"),
                    blick=(-1 if links else 1, 0), augen="weit" if wer == "pixel" else "normal")
        if wer == "nova" and 2.5 <= lt:
            K["mund"] = "grinsen"
        team_im_van.append((X, Z, P, K, TEAM[wer]["groesse"]))
    ebene(ctx, lambda: [figur(ctx, cam, X, Z, P, K, g, Y=-0.42, schatten_an=False) for X, Z, P, K, g in team_im_van], 0.12)
    licht_punkt(ctx, 540, 560, 600, (1, 0.15, 0.2), 0.35)
    if blau:
        licht_punkt(ctx, 600, 820, 500, (0.2, 0.5, 1), 0.4)
    ctx.save()
    ctx.translate(dx, dy)
    pov_arme(ctx, t, laufen=0.0, zielen=-0.5)
    ctx.restore()
    zeige_untertitel(ctx, "van", lt, y=1080)


# ---------------------------------------------------------------- Szene 7: Anschleichen (Gasse, wie im Vorbild)
GASSE_TUER_Z = 9.0


def gasse(ctx, cam, t):
    himmel(ctx, "regen", True, cam.horizont)
    for kx, kh in ((-30, 34), (24, 30)):
        linie3d(ctx, cam, (kx, 0, 90), (kx, kh, 90), "#1d2d50", 10)
        linie3d(ctx, cam, (kx - 12, kh, 90), (kx + 14, kh, 90), "#1d2d50", 9)
    boden(ctx, cam, "regen", farbe="#495057")
    gehweg_platten(ctx, cam, -4.5, -2.0, 0, 70, farbe="#8d99ae", fugen="#6c757d")
    pfuetzen(ctx, cam, [(1.5, 13, 1.2), (-1.0, 17, 0.8), (0.5, 22, 1.4), (2.5, 30, 1.2)], 0.45)
    fassade(ctx, cam, 6.0, 1, 70, 14, -1, farbe="#7f4f24", licht=0.25, seed=5, balkone=True)
    fassade(ctx, cam, -4.5, 1, 70, 12, 1, farbe="#8b4a2b", licht=0.15, seed=6, balkone=False, rolltor=False)
    # Tür in der linken Wand
    flaeche(ctx, cam, [(-4.49, 0, GASSE_TUER_Z - 0.7), (-4.49, 0, GASSE_TUER_Z + 0.7), (-4.49, 2.35, GASSE_TUER_Z + 0.7),
                       (-4.49, 2.35, GASSE_TUER_Z - 0.7)], "#6c757d", 5)
    px, py = cam.p(-4.48, 3.3, GASSE_TUER_Z + 3)
    text(ctx, "7", px, py, 1.6 * cam.skala(-4.48, GASSE_TUER_Z + 3), fill="#f1faee", sw=8)
    # Container rechts
    for z0, f in ((14, "#9d0208"), (20, "#264653"), (26, "#6d597a")):
        kiste(ctx, cam, 2.6, 5.0, 0, 2.6, z0, z0 + 5.5, f, 5)
        kiste(ctx, cam, 2.6, 5.0, 2.6, 5.2, z0 + 0.5, z0 + 6.0, "#bc6c25", 5) if z0 == 20 else None
    return laterne(ctx, cam, 1.8, 12.5), laterne(ctx, cam, 1.8, 28)


def s_anschleichen(ctx, t, lt):
    cam = Kamera(x=-1.2 - 0.05 * lt, y=1.0, z=4.2 + 0.3 * lt, f=820, horizont=840)
    lamp1, lamp2 = gasse(ctx, cam, t)
    # Team kommt an der linken Wand entlang auf uns zu und stoppt hinter der Tür
    ziele = [("boss", 10.4), ("tank", 11.5), ("nova", 12.6), ("pixel", 13.7), ("ich", 14.8)]
    nacht_filter(ctx, 0.62)
    for lp in (lamp1, lamp2):
        licht_punkt(ctx, lp[0], lp[1], 2.5 * lp[2], alpha=0.5)
        lichtkegel(ctx, lp[0], lp[1], 3.5 * lp[2], 5.2 * lp[2], alpha=0.2)
    figuren = []
    for i, (wer, z_ziel) in enumerate(ziele):
        z_start = 21 + i * 1.6
        tempo = 3.0
        z = max(z_ziel, z_start - tempo * max(0, lt - i * 0.15))
        laeuft = z > z_ziel + 0.01
        figuren.append((z, wer, laeuft))
    ctx.push_group()
    for z, wer, laeuft in sorted(figuren, key=lambda f: -f[0]):
        ph = (t * 7.5 + len(wer))
        beine = geh_beine(ph, 0.4, hocke=0.5) if laeuft else (0.5, 1.2, -0.4, 1.1)
        X = -3.5 + (0.0 if laeuft else 0.05 * math.sin(t * 2 + z))
        arme = (0.9, 0.7, 0.9, 0.7)
        if wer == "boss" and not laeuft and lt > 3.0:
            arme = (0.9, 0.7, 2.8, 0.2)
        r = teammitglied(ctx, cam, wer, X, z, beine=beine, arme=arme, neigung=0.25,
                         k=dict(mund=mund("anschleichen", lt, wer, "gerade"), blick=(0.6, 0)))
        if r:
            (ramme if wer == "tank" else gewehr)(ctx, r[1], r[0], r[3])
    # Drohne von Pixel
    dxp, dyp = cam.p(-1.0 + 0.4 * math.sin(t * 1.3), 5.2 + 0.2 * math.sin(t * 2.1), 16)
    s = cam.skala(0, 16)
    rrect(ctx, dxp - 0.4 * s, dyp - 0.08 * s, 0.8 * s, 0.16 * s, 0.05 * s)
    form(ctx, "#111111", 3)
    for sx in (-1, 1):
        ctx.save()
        ctx.translate(dxp + sx * 0.42 * s, dyp - 0.12 * s)
        ctx.scale(1, 0.18)
        ctx.arc(0, 0, 0.25 * s, 0, 2 * math.pi)
        ctx.restore()
        ctx.set_source_rgba(0.1, 0.1, 0.1, 0.5)
        ctx.fill()
    ctx.set_operator(cairo.OPERATOR_ATOP)
    ctx.set_source_rgba(0.08, 0.1, 0.22, 0.2)
    ctx.paint()
    ctx.set_operator(cairo.OPERATOR_OVER)
    ctx.pop_group_to_source()
    ctx.paint()
    if int(t * 3) % 2 == 0:
        licht_punkt(ctx, dxp, dyp, 0.5 * s, (1, 0.1, 0.1), 0.9)
    regen(ctx, t, alpha=0.38)
    regen_spritzer(ctx, cam, t, 40, -4, 5, cam.z + 2, cam.z + 25)
    einblendung(ctx, "02:31 UHR · ZUGRIFFSORT", "Lagerhaus 7", lt, y=230)
    zeige_untertitel(ctx, "anschleichen", lt, y=1580)


# ---------------------------------------------------------------- Szene 8: Zugriff (POV an der Tür)
def s_zugriff(ctx, t, lt):
    expl = 3.6
    lauf = clamp((lt - 5.0) / 0.3)
    cam_z = 0.0 if lt < 5.0 else min(6.6, (lt - 5.0) * 3.5)
    front_szene(ctx, t, lt, expl_lt=expl, cam_z=cam_z, lauf=lauf, team=lt < 5.0)
    if lt < expl and lt > 1.4:   # Countdown-Zahlen
        n = 3 - int((lt - 1.4) / 0.7)
        if n >= 1:
            text(ctx, str(n), 540, 620, 240, fill="#ffffff", sw=18, scale=ease_back(((lt - 1.4) % 0.7) / 0.15))
    if 4.4 <= lt < 5.6:
        text(ctx, "ZUGRIFF!", 540, 560, 150, fill="#ffd60a", sw=18, scale=ease_back((lt - 4.4) / 0.15),
             rot=-0.05)
    zeige_untertitel(ctx, "zugriff", lt, y=1080)


# ---------------------------------------------------------------- Szene 9: Innen
def blendgranate_pos(d):
    """3D-Wurf von Boss' Hand, prallt auf dem Boden ab und rollt aus."""
    x, y, z, vx, vy, vz = -1.0, 1.5, 14.1, 0.25, 2.4, 2.0
    dt, tt = 1 / 240, 0.0
    while tt < d:
        vy -= G * dt
        x += vx * dt
        y += vy * dt
        z += vz * dt
        if y < 0.06:
            y = 0.06
            vy = -vy * 0.35 if abs(vy) > 0.8 else 0.0
            vx *= 0.7
            vz *= 0.7
        tt += dt
    return x, y, z


def s_innen(ctx, t, lt):
    wurf_t, knall_t = 0.5, 1.5
    knall = lt - knall_t
    cam_z = 6.6 + min(1.0, lt / 0.6) * 4.4
    wack = 30 * math.exp(-4 * knall) if knall >= 0 else 0
    dx, dy = kamera_wackel(t, wack)
    cam = Kamera(x=0.1 + dx * 0.003, y=1.55 + 0.04 * math.sin(t * 9) * clamp(1 - lt), z=cam_z, f=860, horizont=900)
    ctx.save()
    ctx.translate(dx, dy)
    # Raum
    x0, x1, y1, z0, z1 = -6.5, 6.5, 6.0, WAND_Z + 0.4, 28
    flaeche(ctx, cam, [(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)], "#6c757d", 0)
    flaeche(ctx, cam, [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], "#343a40", 3)
    flaeche(ctx, cam, [(x0, 0, z0), (x0, 0, z1), (x0, y1, z1), (x0, y1, z0)], "#5c4d3c", 4)
    flaeche(ctx, cam, [(x1, 0, z0), (x1, 0, z1), (x1, y1, z1), (x1, y1, z0)], "#5c4d3c", 4)
    flaeche(ctx, cam, [(x0, 0, z1), (x1, 0, z1), (x1, y1, z1), (x0, y1, z1)], "#4a3f33", 4)
    flaeche(ctx, cam, [(4.4, 0, z1 - 0.01), (5.8, 0, z1 - 0.01), (5.8, 2.4, z1 - 0.01), (4.4, 2.4, z1 - 0.01)],
            "#1d3557", 5)   # Hinterausgang
    for zz in range(10, 28, 4):
        linie3d(ctx, cam, (x0, y1 - 0.3, zz), (x1, y1 - 0.3, zz), "#212529", 10)
    for (a, b, c, d_, e, f) in ((-6.2, -4.2, 0, 2.4, 12, 15), (-6.2, -4.6, 2.4, 4.0, 12.5, 14.5), (4.0, 6.2, 0, 2.0, 11, 13.5),
                                (-6.2, -4.0, 0, 3.0, 19, 23), (3.8, 6.2, 0, 2.8, 21, 25)):
        kiste(ctx, cam, a, b, c, d_, e, f, "#a98467", 5)
    # Tisch mit Päckchen
    kiste(ctx, cam, -1.3, 1.3, 0.78, 0.88, 15.1, 16.0, "#6f4518", 5)
    for k in range(6):
        px0 = -1.15 + (k % 3) * 0.8
        pz0 = 15.2 + (k // 3) * 0.4
        kiste(ctx, cam, px0, px0 + 0.55, 0.88, 1.12, pz0, pz0 + 0.45, "#f8f9fa", 3)
    nacht_filter(ctx, 0.62, (0.3, 0.32, 0.45))
    lx, ly = cam.p(-0.3, 5.6, 16.2)
    licht_punkt(ctx, lx, ly, 300, alpha=0.35)
    ctx.push_group()
    # Ganove 1 bleibt stehen
    hoch = lt >= 3.0
    geblendet = 0 <= knall < 1.6
    g1 = dict(K=dict(augen="zu" if geblendet else ("weit" if hoch else "wuetend"),
                     mund=0.6 if geblendet or hoch else "sauer"))
    if geblendet:
        g1["P"] = dict(arme=(-2.2, -2.2, 2.2, 2.2))
    ganove(ctx, cam, -0.25, 16.6, "#6c757d", hoch=hoch and not geblendet, **g1)
    # Ganove 2 rennt nach rechts, Tank tackelt ihn
    flucht, tackle = 4.0, 5.0
    if lt < flucht:
        gx, rot = 0.7, 0.0
    elif lt < tackle:
        gx, rot = 0.7 + (lt - flucht) * 2.0, 0.0
    else:
        gx = 0.7 + (tackle - flucht) * 2.0 + min(0.5, (lt - tackle) * 1.5)
        rot = (math.pi / 2) * min(1.0, ((lt - tackle) / 0.45) ** 2)
    g2 = dict(K=dict(augen="zu" if geblendet else ("weit" if lt >= flucht else "wuetend"),
                     mund=0.6 if geblendet or lt >= flucht else "sauer"))
    if lt >= flucht and rot == 0:
        g2["P"] = dict(beine=geh_beine(t * 12, 0.7), arme=(-0.8, 1.0, 0.8, 1.0))
    elif geblendet:
        g2["P"] = dict(arme=(-2.2, -2.2, 2.2, 2.2))
    # Tank läuft von links vorne zum Ganoven
    if lt < 3.6:
        tx, tz = 1.45, 14.1
    else:
        k = clamp((lt - 3.6) / (tackle - 3.6))
        ziel_x, ziel_z = 0.7 + (tackle - flucht) * 2.0 - 0.6, 16.9
        tx, tz = 1.45 + (ziel_x - 1.45) * k, 14.1 + (ziel_z - 14.1) * k
    elemente = [(17.2, "g2"), (tz, "tank"), (14.0, "boss")]
    for z, was in sorted(elemente, key=lambda e: -e[0]):
        if was == "g2":
            ganove(ctx, cam, gx, 17.2, "#495057", rot=rot, **g2)
        elif was == "tank":
            if lt >= tackle:
                kk = clamp((lt - tackle) / 0.45)
                teammitglied(ctx, cam, "tank", tx + 0.6 * kk, tz + 0.3, beine=(0.9, 1.8, -0.2, 1.6),
                             arme=(1.4, 0.6, 1.4, 0.6), neigung=0.7 * kk,
                             k=dict(mund=mund("innen", lt, "tank", "grinsen"), blick=(1, 1)))
            else:
                laeuft = lt >= 3.6
                teammitglied(ctx, cam, "tank", tx, tz, beine=geh_beine(t * 11, 0.7) if laeuft else (0.4, 1.0, -0.3, 0.9),
                             arme=(0.9, 0.9, 0.9, 0.9), neigung=0.3 if laeuft else 0.1,
                             k=dict(ruecken=not laeuft, mund=0.4, blick=(1, 0)))
        else:
            arm_wurf = (0.6, 0.5, 2.6, 0.5) if wurf_t - 0.3 < lt < wurf_t + 0.2 else (0.9, 0.7, 0.9, 0.7)
            teammitglied(ctx, cam, "boss", -1.35, 14.0, k=dict(ruecken=True), beine=(0.4, 1.0, -0.3, 0.9), arme=arm_wurf)
    if wurf_t <= lt < knall_t:
        gx_, gy_, gz_ = blendgranate_pos(lt - wurf_t)
        px, py = cam.p(gx_, gy_, gz_)
        r = 0.09 * cam.skala(gx_, gz_)
        rrect(ctx, px - r, py - r * 1.6, 2 * r, 3.2 * r, r * 0.6)
        form(ctx, "#343a40", 4)
    if lt >= tackle and lt < tackle + 0.6:
        px, py = cam.p(gx, 0.5, 17.2)
        text(ctx, "WUMMS!", clamp(px, 260, 820), py - 200, 110, fill="#ffd60a", sw=14, scale=ease_back((lt - tackle) / 0.12))
    ctx.set_operator(cairo.OPERATOR_ATOP)
    ctx.set_source_rgba(0.08, 0.1, 0.22, 0.18)
    ctx.paint()
    ctx.set_operator(cairo.OPERATOR_OVER)
    ctx.pop_group_to_source()
    ctx.paint()
    lichtkegel(ctx, lx, ly, 700, 900, alpha=0.18)
    bx, by = cam.p(-1.1, 1.5, 14.0)
    lichtkegel(ctx, bx, by, 700, 1200, winkel=-math.pi / 2 + 0.25, alpha=0.18)
    ctx.restore()
    pov_arme(ctx, t, laufen=clamp(1 - lt * 2) + (clamp((lt - 7.6) / 0.3) if lt > 7.6 else 0), zielen=0.2, lampe=True)
    if knall >= 0:
        blendgranate(ctx, knall)
        if knall < 0.8:
            text(ctx, "PENG!", 540, 700, 200, fill="#ffffff", stroke="#adb5bd", scale=ease_back(knall / 0.1))
    zeige_untertitel(ctx, "innen", lt, y=1060)


# ---------------------------------------------------------------- Szene 10: Verfolgung auf dem Pier (Seite)
PIER_Y = 1500
RUTSCH_X = 2600.0


def fuchs_zustand(lt):
    """Fuchs rennt, rutscht auf der Pfütze aus, fällt auf den Rücken (bleibt AUF dem Pier liegen)."""
    v = 560.0
    t_r = (RUTSCH_X - 400) / v
    if lt < t_r:
        return 400 + v * lt, 0.0, "rennt"
    d = lt - t_r
    # rutscht mit Reibung weiter, kippt nach hinten
    x = RUTSCH_X + v * (1 - math.exp(-2.2 * d)) / 2.2
    rot = -(math.pi / 2) * min(1.0, (d / 0.5) ** 2)
    return x, rot, "liegt" if d >= 0.5 else "faellt"


def ich_x(lt):
    v = 600.0
    fx, _, z = fuchs_zustand(lt)
    x = 40 + v * lt
    endx = fuchs_zustand(20)[0] - 230
    return min(x, endx), x >= endx


def s_verfolgung(ctx, t, lt):
    fx, frot, fz = fuchs_zustand(lt)
    ix, angekommen = ich_x(lt)
    cx = (fx + ix) / 2 - W / 2
    # Himmel + Ferne
    g = cairo.LinearGradient(0, 0, 0, H)
    g.add_color_stop_rgb(0, *hexc("#0b1020")[:3])
    g.add_color_stop_rgb(1, *hexc("#24345a")[:3])
    ctx.rectangle(0, 0, W, H)
    ctx.set_source(g)
    ctx.fill()
    for i in range(10):
        x = i * 600 - cx * 0.2
        ctx.move_to(x, 1200)
        ctx.line_to(x, 620)
        ctx.line_to(x + 300, 620)
        ctx.set_source_rgba(*hexc("#14213d"))
        ctx.set_line_width(20)
        ctx.stroke()
    for i in range(30):
        x = i * 240 - cx * 0.55
        if -260 < x < W + 20:
            rrect(ctx, x, 1060 - (i % 3) * 120 * (i % 2), 225, 120 + (i % 2) * 120, 6)
            form(ctx, ["#264653", "#6d597a", "#9d0208", "#3a5a40", "#bc6c25"][i % 5], 5)
    # Wasser
    ctx.rectangle(0, PIER_Y + 40, W, H)
    ctx.set_source_rgba(*hexc("#0d1b2a"))
    ctx.fill()
    for k in range(8):
        ctx.move_to(0, PIER_Y + 90 + k * 55)
        for x in range(0, W + 40, 40):
            ctx.line_to(x, PIER_Y + 90 + k * 55 + 8 * math.sin(x * 0.02 + t * 3 + k))
        ctx.set_source_rgba(0.4, 0.55, 0.8, 0.25)
        ctx.set_line_width(4)
        ctx.stroke()
    # Pier-Planken + Pfosten
    ctx.rectangle(0, PIER_Y, W, 60)
    form(ctx, "#6f4e37", 6)
    for i in range(int(cx // 90) - 1, int((cx + W) // 90) + 2):
        x = i * 90 - cx
        ctx.move_to(x, PIER_Y)
        ctx.line_to(x, PIER_Y + 60)
    ctx.set_source_rgba(0, 0, 0, 0.6)
    ctx.set_line_width(3)
    ctx.stroke()
    for i in range(int(cx // 450) - 1, int((cx + W) // 450) + 2):
        x = i * 450 - cx
        ctx.rectangle(x - 18, PIER_Y + 60, 36, 300)
        form(ctx, "#5a3e2b", 5)
    # Pfütze (Rutschstelle)
    ctx.save()
    ctx.translate(RUTSCH_X - cx + 40, PIER_Y + 4)
    ctx.scale(1, 0.14)
    ctx.arc(0, 0, 160, 0, 2 * math.pi)
    ctx.restore()
    ctx.set_source_rgba(0.55, 0.7, 0.95, 0.7)
    ctx.fill()
    lampen = []
    for i in range(int(cx // 800) - 1, int((cx + W) // 800) + 2):
        x = i * 800 + 300 - cx
        ctx.move_to(x, PIER_Y)
        ctx.line_to(x, 880)
        ctx.line_to(x + 80, 880)
        ctx.set_source_rgba(*hexc("#111111"))
        ctx.set_line_width(14)
        ctx.stroke()
        lampen.append((x + 80, 890))
    nacht_filter(ctx, 0.55)
    for lx, ly in lampen:
        licht_punkt(ctx, lx, ly, 260, alpha=0.5)
        lichtkegel(ctx, lx, ly, 420, 560, alpha=0.22)
    ctx.push_group()
    # Fuchs
    s = 0.85
    fuchs_P = dict(hemd="#ff9f1c", hose="#3d405b", schuh="#f8f9fa")
    fuchs_K = dict(haut="#e8b98a", kappe="#111111", brille=True,
                   mund=mund("verfolgung", lt, "fuchs", 0.4 if fz != "rennt" else "grinsen"),
                   augen="weit" if fz != "rennt" else "normal")
    if fz == "rennt":
        ph = t * 13
        sw = math.sin(ph)
        P = dict(fuchs_P, beine=(0.8 * sw, 0.9 * max(0, -sw) + 0.2, -0.8 * sw, 0.9 * max(0, sw) + 0.2),
                 arme=(-0.9 * sw, 1.2, 0.9 * sw, 1.2), neigung=0.18)
        P = boden_kontakt(P, s, 1)
        person(ctx, fx - cx, PIER_Y, s, P, dict(fuchs_K, blick=(1, 0)))
    else:
        P = dict(fuchs_P, beine=(0.9, 0.1, 0.6, 0.1), arme=(-1.8, 0.3, 2.4, 0.3))
        if fz == "liegt" and angekommen and lt > 5.6:
            P["arme"] = (0.4, 0.2, 0.5, 0.2)   # Hände hinterm Rücken
        lift = 42 * s * abs(math.sin(frot))
        ctx.save()
        ctx.translate(fx - cx, PIER_Y - lift)
        ctx.rotate(frot)
        person(ctx, 0, 0, s, P, fuchs_K)
        ctx.restore()
        if fz == "faellt" or (fz == "liegt" and lt - (RUTSCH_X - 400) / 560 < 0.8):
            rnd = random.Random(int(lt * 30))
            for _ in range(18):
                ctx.arc(RUTSCH_X - cx + rnd.uniform(0, 220), PIER_Y - rnd.uniform(0, 90), rnd.uniform(4, 10), 0, 2 * math.pi)
                ctx.set_source_rgba(0.7, 0.85, 1, 0.7)
                ctx.fill()
    # ICH
    if not angekommen:
        ph = t * 13.5
        sw = math.sin(ph)
        P = pose("ich", beine=(0.8 * sw, 0.9 * max(0, -sw) + 0.2, -0.8 * sw, 0.9 * max(0, sw) + 0.2),
                 arme=(-0.9 * sw, 1.2, 0.9 * sw, 1.2), neigung=0.2)
    else:
        P = pose("ich", beine=(0.5, 1.6, -0.2, 1.4), arme=(1.4, 0.6, 1.5, 0.5), neigung=0.45)
    P = boden_kontakt(P, s * TEAM["ich"]["groesse"] / 1.8, 1)
    person(ctx, ix - cx, PIER_Y, s * TEAM["ich"]["groesse"] / 1.8, P,
           gesicht("ich", mund=mund("verfolgung", lt, "ich", "grinsen" if angekommen else 0.35),
                   augen="wuetend" if not angekommen else "normal", blick=(1, 0.3)))
    # Handschellen-KLICK
    if angekommen and 5.6 <= lt < 6.4:
        text(ctx, "KLICK!", fx - cx - 60, PIER_Y - 260, 100, fill="#e9ecef", sw=14, scale=ease_back((lt - 5.6) / 0.12))
    if angekommen and lt >= 5.6:
        hx, hy = fx - cx - 160, PIER_Y - 50
        for dx in (0, 34):
            ctx.arc(hx + dx, hy, 18, 0, 2 * math.pi)
            ctx.set_source_rgba(*hexc("#ced4da"))
            ctx.set_line_width(7)
            ctx.stroke()
    if fz == "faellt":
        text(ctx, "RUTSCH!", RUTSCH_X - cx + 100, PIER_Y - 330, 110, fill="#4cc9f0", sw=14,
             scale=ease_back((lt - (RUTSCH_X - 400) / 560) / 0.15), rot=0.1)
    ctx.set_operator(cairo.OPERATOR_ATOP)
    ctx.set_source_rgba(0.08, 0.1, 0.22, 0.15)
    ctx.paint()
    ctx.set_operator(cairo.OPERATOR_OVER)
    ctx.pop_group_to_source()
    ctx.paint()
    regen(ctx, t, wind=0.25, alpha=0.4)
    zeige_untertitel(ctx, "verfolgung", lt, y=420)


# ---------------------------------------------------------------- Szene 11: Twist + Cliffhanger
def s_twist(ctx, t, lt):
    cam = Kamera(x=0.0, y=1.4, z=-0.8, f=860, horizont=880)
    lp = lagerhaus_front(ctx, cam, t, gesprengt_d=30)
    # Rauchschwaden aus dem Loch
    tx, ty = cam.p(0, 2.0, WAND_Z)
    for k in range(5):
        ph = (t * 0.4 + k / 5) % 1
        ctx.arc(tx + 40 * math.sin(k * 2 + t), ty - ph * 500, 60 + 120 * ph, 0, 2 * math.pi)
        ctx.set_source_rgba(0.3, 0.3, 0.32, 0.5 * (1 - ph))
        ctx.fill()
    nacht_filter(ctx, 0.55)
    licht_punkt(ctx, lp[0], lp[1], 3 * lp[2], alpha=0.5)
    ctx.push_group()
    # Fuchs-Fahrer sitzt gefesselt
    ganove(ctx, cam, 0.5, 4.2, "#ff9f1c", P=dict(beine=(-1.5, 0.2, -1.4, 0.2), arme=(0.4, 0.2, 0.5, 0.2)),
           K=dict(brille=True, mund=mund("twist", lt, "fuchs", "grinsen"), augen="normal"))
    reihe = [("nova", -2.7, 5.0), ("tank", -1.4, 4.6), ("boss", 1.5, 4.6), ("pixel", 2.8, 5.0), ("ich", -0.4, 3.4)]
    for wer, X, Z in sorted(reihe, key=lambda r: -r[2]):
        arme = (0.25, 0.3, -0.25, -0.3)
        if wer == "pixel":
            arme = (0.9, 0.9, 0.9, 0.9)
        if wer == "boss" and lt > 4.3:
            arme = (0.25, 0.3, 1.0, 1.9)
        k = dict(mund=mund("twist", lt, wer, "laecheln"), blick=(0, 0))
        if 0.4 <= lt < 4.3 and wer != "pixel":
            k.update(augen="weit")
        if wer == "tank" and lt > 6.9:
            k.update(mund=mund("twist", lt, wer, 0.3))
        r = teammitglied(ctx, cam, wer, X, Z, arme=arme, k=k)
        if r and wer == "pixel":   # Laptop
            hx, hy = r[0]
            s = r[3]
            ctx.move_to(hx - 90 * s, hy)
            ctx.line_to(hx + 90 * s, hy)
            ctx.line_to(hx + 75 * s, hy - 100 * s)
            ctx.line_to(hx - 75 * s, hy - 100 * s)
            ctx.close_path()
            form(ctx, "#adb5bd", 4)
    ctx.set_operator(cairo.OPERATOR_ATOP)
    ctx.set_source_rgba(0.08, 0.1, 0.22, 0.18)
    ctx.paint()
    ctx.set_operator(cairo.OPERATOR_OVER)
    ctx.pop_group_to_source()
    ctx.paint()
    blau = int(t * 8) % 2
    licht_punkt(ctx, 80 if blau else 1000, 700, 700, (0.2, 0.45, 1.0), 0.35)
    regen(ctx, t, alpha=0.35)
    # Laptop-Einblendung
    if 0.6 <= lt < 4.4:
        k = ease_back((lt - 0.6) / 0.25)
        ctx.save()
        ctx.translate(540, 470)
        ctx.scale(k, k)
        rrect(ctx, -440, -250, 880, 500, 24)
        form(ctx, "#0b132b", 8, "#4cc9f0")
        text(ctx, "FLUG FX-77", 0, -150, 90, fill="#4cc9f0", stroke=None)
        text(ctx, "ABFLUG: 06:00 UHR", 0, -40, 64, fill="#ffffff", stroke=None)
        text(ctx, "PASSAGIER: \"D. FUCHS\"", 0, 50, 54, fill="#ff9f1c", stroke=None)
        text(ctx, "ZIEL: ██████", 0, 150, 64, fill="#ffffff", stroke=None)
        ctx.restore()
    zeige_untertitel(ctx, "twist", lt, y=1580)
    # Endkarte
    if lt >= 7.7:
        k = clamp((lt - 7.7) / 0.3)
        ctx.set_source_rgba(0.02, 0.03, 0.08, 0.85 * k)
        ctx.paint()
        px = -200 + (lt - 7.7) * 900
        py = 780 - (lt - 7.7) * 220
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(-0.22)
        ctx.move_to(-180, 0)
        ctx.line_to(180, -10)
        ctx.line_to(220, 10)
        ctx.line_to(-180, 30)
        ctx.close_path()
        ctx.move_to(-20, 0)
        ctx.line_to(60, -110)
        ctx.line_to(100, -110)
        ctx.line_to(60, 5)
        ctx.close_path()
        ctx.move_to(-150, 5)
        ctx.line_to(-190, -70)
        ctx.line_to(-160, -70)
        ctx.line_to(-120, 5)
        ctx.close_path()
        form(ctx, "#e9ecef", 5)
        ctx.restore()
        text(ctx, "EINSATZ 02", 540, 1000, 120, fill="#80ed99", sw=14, scale=ease_back((lt - 7.8) / 0.25))
        text(ctx, "DAS FLUGZEUG", 540, 1130, 100, fill="#ffffff", sw=12, scale=ease_back((lt - 7.95) / 0.25))
        text(ctx, "Folgen für Teil 2!", 540, 1300, 64, fill="#ffd166", sw=10, scale=ease_back((lt - 8.3) / 0.25))


# ---------------------------------------------------------------- Frames
SZENEN = {"hook": s_hook, "hq": s_hq, "briefing": s_briefing, "montage": s_montage, "fahrt": s_fahrt,
          "van": s_van, "anschleichen": s_anschleichen, "zugriff": s_zugriff, "innen": s_innen,
          "verfolgung": s_verfolgung, "twist": s_twist}


def render(i, lt):
    s = SZ[i]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    ctx.set_source_rgb(0, 0, 0)
    ctx.paint()
    SZENEN[s["n"]](ctx, s["start"] + lt, lt)
    return surf


def frame(t):
    i = max(k for k, s in enumerate(SZ) if t >= s["start"])
    s = SZ[i]
    lt = t - s["start"]
    tr = s.get("tr")
    dauer = TR_DAUER.get(tr, 0.45)
    if i > 0 and tr and lt < dauer:
        a = render(i - 1, SZ[i - 1]["d"] + lt)
        b = render(i, lt)
        out = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(out)
        uebergang(ctx, tr, a, b, lt / dauer, fokus=s.get("fokus", (W / 2, H / 2)), karte=s.get("karte", ""),
                  seed=int(t * FPS))
        return out
    return render(i, lt)


# ---------------------------------------------------------------- Ton
def ton(pfad):
    n = int(DAUER * SR)
    a = np.zeros(n)
    rng = np.random.default_rng(3)

    def add(t0, sig, vol=1.0):
        i = int(t0 * SR)
        if i < 0:
            sig, i = sig[-i:], 0
        e = min(n, i + len(sig))
        if i < n:
            a[i:e] += vol * sig[:e - i]

    def ts(d):
        return np.arange(int(d * SR)) / SR

    def rauschen(d, cut):
        return lowpass(rng.uniform(-1, 1, int(d * SR)), cut)

    def boom(st=1.0):
        tt = ts(2.5)
        tief = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-6 * tt)) / SR) * np.exp(-2.2 * tt)
        return st * (0.9 * tief + 0.8 * rauschen(2.5, 900) * np.exp(-2.5 * tt) + 0.3 * rng.uniform(-1, 1, len(tt)) * np.exp(-30 * tt))

    def thud(st=1.0):
        tt = ts(0.3)
        return st * np.sin(2 * np.pi * np.cumsum(55 + 80 * np.exp(-30 * tt)) / SR) * np.exp(-12 * tt)

    def klick(f=3000):
        tt = ts(0.06)
        return np.sin(2 * np.pi * f * tt) * np.exp(-90 * tt) + 0.4 * rng.uniform(-1, 1, len(tt)) * np.exp(-150 * tt)

    def whoosh(d=0.35):
        tt = ts(d)
        return rauschen(d, 3500) * np.sin(np.pi * tt / d) ** 2

    # Regen-Atmosphäre (außen laut, innen leise)
    lautst = {"hook": 0.18, "hq": 0.05, "briefing": 0.03, "montage": 0.0, "fahrt": 0.2, "van": 0.08,
              "anschleichen": 0.2, "zugriff": 0.18, "innen": 0.05, "verfolgung": 0.22, "twist": 0.18}
    for s in SZ:
        if lautst[s["n"]]:
            add(s["start"], rauschen(s["d"], 5000) * lautst[s["n"]])
    # Hook-Explosion + Freeze + Zurückspulen
    add(0.0, boom(), 0.9)
    add(2.5, whoosh(0.5), 0.5)
    tt = ts(0.7)
    add(3.3, 0.3 * np.sign(np.sin(2 * np.pi * np.cumsum(600 + 2000 * (tt * 9 % 1)) / SR)) * 0.5)
    # Übergänge
    for s in SZ:
        tr = s.get("tr")
        if tr in ("whip", "glitch"):
            add(s["start"], whoosh(), 0.4)
        elif tr in ("zoom", "iris"):
            tt = ts(0.35)
            add(s["start"], 0.25 * np.sin(2 * np.pi * np.cumsum(300 + 1500 * tt / 0.35) / SR) * np.sin(np.pi * tt / 0.35))
        elif tr == "uhr":
            for k in range(10):
                add(s["start"] + k * 0.08, klick(2000), 0.3)
    # HQ-Alarm
    s0 = start("hq")
    tt = ts(3.0)
    sirene = np.sign(np.sin(2 * np.pi * np.where((tt % 0.8) < 0.4, 960, 770) * tt))
    add(s0 + 8.0, 0.22 * lowpass(sirene, 2500))
    for k in range(5):   # Namensschild-Pops
        tt = ts(0.12)
        add(s0 + 0.3 + k, 0.25 * np.sin(2 * np.pi * np.cumsum(500 + 2500 * tt / 0.12) / SR) * np.exp(-15 * tt))
    # Montage: Whoosh + Klick pro Streifen
    s0 = start("montage")
    for k in range(5):
        add(s0 + k * 0.75, whoosh(0.25), 0.35)
        add(s0 + k * 0.75 + 0.2, klick(1800), 0.5)
    # Motor (Fahrt + Van)
    tt = ts(9.5)
    motor = 2 * ((np.cumsum(55 + 5 * np.sin(2 * np.pi * 0.7 * tt)) / SR) % 1) - 1
    add(start("fahrt"), 0.25 * lowpass(motor, 300))
    # Spannungs-Bass (Anschleichen + Zugriff bis zur Explosion)
    s0 = start("anschleichen")
    d = 7.0 + 3.6
    tt = ts(d)
    puls = np.sin(2 * np.pi * 46 * tt) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (1.6 + tt * 0.12) * tt)))
    add(s0, 0.3 * lowpass(puls, 200) * np.minimum(1, tt))
    # Schritte im Regen
    for k in range(int(5.0 / 0.33)):
        add(s0 + k * 0.33, 0.12 * rauschen(0.08, 1500) * np.exp(-40 * ts(0.08)))
    # Countdown-Piepser + Explosion
    s0 = start("zugriff")
    for k in range(3):
        tt = ts(0.12)
        add(s0 + 1.4 + k * 0.7, 0.25 * np.sin(2 * np.pi * 1200 * tt))
    add(s0 + 3.6, boom(), 1.0)
    add(s0 + 3.6 + 0.9, thud(0.6))
    # Innen: Blendgranate, Tackle
    s0 = start("innen")
    add(s0 + 0.9, klick(900), 0.4)
    add(s0 + 1.5, boom(0.6), 0.8)
    add(s0 + 5.0, thud(1.0), 0.8)
    add(s0 + 5.25, thud(0.6), 0.6)
    # Verfolgung: Trommeln, Schritte, Rutschen, Klick
    s0 = start("verfolgung")
    for k in range(int(9.0 / (60 / 150))):
        tt = ts(0.2)
        add(s0 + k * 0.4, 0.35 * np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-30 * tt)) / SR) * np.exp(-9 * tt))
        if k % 2:
            add(s0 + k * 0.4, 0.18 * rauschen(0.15, 4000) * np.exp(-25 * ts(0.15)))
    t_r = (RUTSCH_X - 400) / 560
    add(s0 + t_r, whoosh(0.5), 0.5)
    add(s0 + t_r + 0.5, thud(0.8))
    add(s0 + t_r + 0.5, 0.3 * rauschen(0.4, 2500) * np.exp(-8 * ts(0.4)))
    add(s0 + 5.6, klick(3500), 0.7)
    add(s0 + 5.75, klick(3800), 0.7)
    # Twist: Akkord-Stich + Endkarte
    s0 = start("twist")
    for t0, fs in ((s0 + 2.5, (110, 130.8, 155.6)), (s0 + 7.7, (98, 146.8, 196, 246.9))):
        tt = ts(2.0)
        akk = sum(np.sin(2 * np.pi * f * tt) for f in fs) / len(fs)
        add(t0, 0.35 * akk * np.exp(-1.2 * tt))
    # Stimmen
    for k, (sz, s0_, wer, txt, bis) in enumerate(DIALOG):
        add(start(sz) + s0_, babbeln(txt, STIMME.get(wer, 180), CPS, gedaempft=False, seed=k), 0.55)
    # Blendgranate: alles dumpf + Piepen
    t0 = int((start("innen") + 1.5) * SR)
    t1 = int((start("innen") + 4.0) * SR)
    a[t0:t1] = lowpass(a[t0:t1], 350) * 0.6
    tt = (np.arange(t1 - t0)) / SR
    a[t0:t1] += 0.18 * np.sin(2 * np.pi * 3600 * tt) * np.exp(-0.9 * tt)
    a = a / max(1e-9, np.max(np.abs(a))) * 0.89
    with wave.open(pfad, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def skript():
    print("| Zeit | Szene | Wer | Text |\n|---|---|---|---|")
    for sz, s0, wer, txt, bis in DIALOG:
        t = start(sz) + s0
        print(f"| {int(t // 60)}:{t % 60:04.1f} | {sz} | {SPRECHER_NAME.get(wer, wer)} | {txt} |")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "frames":
        out = sys.stdout.buffer
        for i in range(int(sys.argv[2]), int(sys.argv[3])):
            out.write(frame(i / FPS).get_data())
    elif cmd == "bild":
        frame(float(sys.argv[2])).write_to_png(sys.argv[3])
    elif cmd == "ton":
        ton(sys.argv[2])
    elif cmd == "skript":
        skript()
