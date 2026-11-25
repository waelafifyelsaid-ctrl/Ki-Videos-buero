#!/usr/bin/env python3
"""EINHEIT FALKE – Einsatz 01: Lagerhaus 7 – POV-Fassung (nur Ich-Sicht, Bodycam-Look, ohne Babbel-Stimmen).

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
from cartoon import SR, lowpass, sichtbar, uebergang  # noqa: E402
from einsatz import *  # noqa: E402,F401,F403

# ---------------------------------------------------------------- Ablauf
SZ = [
    dict(n="hook", d=4.0, tr=None),
    dict(n="hq", d=10.0, tr="uhr", karte="6 STUNDEN VORHER"),
    dict(n="briefing", d=9.0, tr="zoom", fokus=(540, 560)),
    dict(n="spind", d=6.0, tr="black"),
    dict(n="van", d=9.5, tr="black"),
    dict(n="anschleichen", d=7.0, tr="zoom", fokus=(540, 900)),
    dict(n="zugriff", d=7.0, tr="black"),
    dict(n="innen", d=8.5, tr=None),
    dict(n="verfolgung", d=9.0, tr="whip"),
    dict(n="twist", d=9.5, tr="black"),
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
    ("spind", 0.8, "nova", "Visier runter, Neuer. Heute wird's laut.", 3.0),
    ("spind", 3.1, "ich", "Danke, Mama.", 4.4),
    ("spind", 4.6, "boss", "Abfahrt!", 6.0),
    ("van", 0.3, "pixel", "Ich hasse Regen. Und Häfen. Und Möwen.", 2.5),
    ("van", 2.6, "ich", "Pixel, du bist ein Angsthase mit WLAN.", 4.5),
    ("van", 4.6, "tank", "Lass ihn. Er hat heute schon geweint.", 6.3),
    ("van", 6.4, "pixel", "Das war REGEN!", 7.5),
    ("van", 7.6, "boss", "Ruhe. Wir sind da.", 9.5),
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
    helm_rand(ctx)
    text(ctx, "EINSATZ 01", 540, 400, 64, fill="#80ed99", sw=10, scale=ease_back(lt / 0.2))
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
    kopf_dreh = 0.25 * clamp((lt - 8.0) / 0.4)
    cam = Kamera(x=0.5 + 0.05 * math.sin(lt * 0.7), y=1.28 + 0.01 * math.sin(lt * 1.6), z=3.9, f=880,
                 horizont=760 - 120 * kopf_dreh)
    hq_raum(ctx, cam, t, "logo", alarm)
    schauen = (0, 0) if lt < 8.0 else (0, -0.6)
    rede = lambda w, sonst="laecheln": mund("hq", lt, w, sonst)  # noqa: E731
    nova = teammitglied(ctx, cam, "nova", -1.9, 8.6, arme=(0.3, 0.4, 2.2 + 0.25 * math.sin(lt * 5), 1.9),
                        k=dict(mund="grinsen" if 7.4 < lt < 8.3 else "laecheln", blick=schauen), beine=(0.1, 0, -0.3, 0.2))
    boss = teammitglied(ctx, cam, "boss", 2.2, 8.4, arme=(0.4, 0.5, 0.9, 1.8),
                        k=dict(mund=rede("boss", "gerade"), blick=schauen if lt >= 8 else (-0.6, 0.2)))
    if boss:
        hx, hy = boss[0]
        s = boss[3]
        rrect(ctx, hx - 22 * s, hy - 70 * s, 44 * s, 52 * s, 8 * s)
        form(ctx, "#f8f9fa", 4)
    beiss = (lt * 1.1) % 1 < 0.25
    tank = teammitglied(ctx, cam, "tank", -0.75, 6.7, arme=(0.6, 1.2, 1.0 if not beiss else 1.6, 1.8 if not beiss else 2.3),
                        k=dict(mund=rede("tank", 0.5 if beiss else "grinsen"), augen="zu" if beiss else "normal",
                               blick=schauen if lt >= 8 else (0.5, 0.3)))
    if tank and lt < 8.0:
        hx, hy = tank[0]
        s = tank[3]
        rrect(ctx, hx - 70 * s, hy - 40 * s, 140 * s, 56 * s, 20 * s)
        form(ctx, "#e9c46a", 4)
        ctx.rectangle(hx - 66 * s, hy - 16 * s, 132 * s, 10 * s)
        ctx.set_source_rgba(*hexc("#52b788"))
        ctx.fill()
    pixel = teammitglied(ctx, cam, "pixel", 0.95, 6.7, arme=(0.9, 0.9, 0.8 + 0.1 * math.sin(lt * 20), 0.9),
                         k=dict(mund="gerade" if lt < 8 else 0.5, augen="weit" if lt >= 8 else "normal", blick=(0.4, 0.6)))
    kiste(ctx, cam, -1.5, 1.5, 0.74, 0.82, 4.6, 6.2, "#7f5539", 5)
    lx, ly = cam.p(0.95, 0.83, 5.6)
    s = cam.skala(0.95, 5.6)
    ctx.move_to(lx - 0.35 * s, ly)
    ctx.line_to(lx + 0.35 * s, ly)
    ctx.line_to(lx + 0.3 * s, ly - 0.32 * s)
    ctx.line_to(lx - 0.3 * s, ly - 0.32 * s)
    ctx.close_path()
    form(ctx, "#adb5bd", 4)
    tasse = pov_tasse(ctx, t, lt)
    if alarm > 0:
        ctx.save()
        ctx.set_operator(cairo.OPERATOR_ADD)
        ctx.set_source_rgba(0.6, 0.0, 0.05, 0.25 * alarm)
        ctx.paint()
        ctx.restore()
    schilder = [(boss, "BOSS", "Teamleiter. Hatte nie Urlaub.", "boss", True),
                (tank, "TANK", "Ramme. Isst immer.", "tank", False),
                (nova, "NOVA", "Scharfschützin. Auch mit Worten.", "nova", False),
                (pixel, "PIXEL", "Technik. Angst vor Möwen.", "pixel", False),
                ((None, None, tasse), "ICH", "Der Neue. Große Klappe.", "ich", True)]
    for i, (fig, z1, z2, wer, links) in enumerate(schilder):
        a = 0.3 + i * 1.0
        if fig and a <= lt < a + 1.0:
            namensschild(ctx, fig[2], z1, z2, TEAM[wer]["farbe"], ease_back((lt - a) / 0.2), links)
    zeige_untertitel(ctx, "hq", lt, y=1250)


def s_briefing(ctx, t, lt):
    cam = Kamera(x=-0.5, y=1.75, z=1.2 + 0.1 * lt, f=760, horizont=860)
    hq_raum(ctx, cam, t, "karte", 0.0, lt)
    hartmann(ctx, cam, -2.5, 8.8, "briefing", lt)
    # Team von hinten im Vordergrund (Lücke für Hartmann lassen)
    for wer, X, Z in (("nova", -3.5, 5.6), ("pixel", 2.5, 5.6), ("tank", -0.6, 5.4), ("boss", 1.2, 5.2)):
        teammitglied(ctx, cam, wer, X, Z, k=dict(ruecken=True), arme=(0.15, 0.2, -0.15, -0.2))
    zeige_untertitel(ctx, "briefing", lt, y=1560)


# ---------------------------------------------------------------- Szene 4: Ausrüsten (Comic-Streifen)


# ---------------------------------------------------------------- Szene 5: Fahrt (Seitenansicht)


# ---------------------------------------------------------------- Szene 6: Im Van (POV)
def s_van(ctx, t, lt):
    rnd = random.Random(int(t * 7))
    ruhig = clamp((lt - 7.9) / 0.4)
    dx, dy = rnd.uniform(-1, 1) * 6 * (1 - ruhig), rnd.uniform(-1, 1) * 9 * (1 - ruhig)
    cam = Kamera(x=0.0, y=1.15 + dy * 0.002, z=-1.3, f=620, horizont=820 + dy)
    x0, x1, y1, z1 = -1.2, 1.2, 1.9, 4.4
    auf = ease_out(clamp((lt - 8.3) / 0.8)) * 1.9
    # Draußen (hinter den Hecktüren): nasse Gasse, Laterne
    flaeche(ctx, cam, [(-8, -3, 12), (8, -3, 12), (8, 6, 12), (-8, 6, 12)], "#1d2d50", 0)
    flaeche(ctx, cam, [(-8, 0, z1), (8, 0, z1), (8, 0, 12), (-8, 0, 12)], "#343a40", 0)
    lx, ly = cam.p(1.5, 3.6, 11)
    flaeche(ctx, cam, [(x0, 0, -1), (x1, 0, -1), (x1, 0, z1), (x0, 0, z1)], "#343a40", 0)
    flaeche(ctx, cam, [(x0, y1, -1), (x1, y1, -1), (x1, y1, z1), (x0, y1, z1)], "#22223b", 4)
    flaeche(ctx, cam, [(x0, 0, -1), (x0, 0, z1), (x0, y1, z1), (x0, y1, -1)], "#3d405b", 5)
    flaeche(ctx, cam, [(x1, 0, -1), (x1, 0, z1), (x1, y1, z1), (x1, y1, -1)], "#3d405b", 5)
    blau = int(t * 8) % 2
    # Hecktüren drehen um die Scharniere nach außen
    for seite, xh in ((-1, x0), (1, x1)):
        fx, fz = xh - seite * 1.2 * math.cos(auf), z1 + 1.2 * math.sin(auf)
        flaeche(ctx, cam, [(xh, 0, z1), (fx, 0, fz), (fx, y1, fz), (xh, y1, z1)], "#2b2d42", 5)
        wa = (xh + (fx - xh) * 0.15, z1 + (fz - z1) * 0.15)
        wb = (xh + (fx - xh) * 0.85, z1 + (fz - z1) * 0.85)
        flaeche(ctx, cam, [(wa[0], 1.0, wa[1]), (wb[0], 1.0, wb[1]), (wb[0], 1.65, wb[1]), (wa[0], 1.65, wa[1])],
                "#4cc9f0" if blau == (seite > 0) and auf < 0.1 else "#1d3557", 4)
    for xa in (x0, x1):
        kiste(ctx, cam, min(xa, xa * 0.55), max(xa, xa * 0.55), 0, 0.45, 0.3, 4.2, "#495057", 4)
    nacht_filter(ctx, 0.3, (0.5, 0.2, 0.25))
    if auf > 0.05:
        licht_punkt(ctx, lx, ly, 300 * clamp(auf), alpha=0.5)
    team_im_van = []
    for wer, X, Z, links in (("nova", -0.82, 3.3, False), ("pixel", 0.82, 3.1, True),
                             ("boss", -0.82, 1.9, False), ("tank", 0.82, 1.7, True)):
        beine = (-1.45, 1.4, -1.35, 1.35)
        P = pose(wer, beine=beine, arme=(1.0, 0.6, 1.2, 0.5), links=links)
        if wer == "pixel":
            P["arme"] = (1.0, 0.6, 1.2 + 0.4 * abs(math.sin(lt * 8)), 0.5) if redet("van", lt, "pixel") else (1.6, 1.8, 1.6, 1.8)
        blick = (-1 if links else 1, 0)
        if redet("van", lt, "ich") or 6.4 <= lt < 7.5:
            blick = (0, 0.2)
        K = gesicht(wer, mund=mund("van", lt, wer, "gerade" if wer == "pixel" else "laecheln"), blick=blick,
                    augen="weit" if wer == "pixel" else "normal")
        if wer in ("nova", "tank") and 4.6 <= lt < 7.6 and not redet("van", lt, wer):
            K["mund"] = "grinsen"
        team_im_van.append((X, Z, P, K, TEAM[wer]["groesse"]))
    ebene(ctx, lambda: [figur(ctx, cam, X, Z, P, K, g, Y=-0.42, schatten_an=False) for X, Z, P, K, g in team_im_van], 0.12)
    licht_punkt(ctx, 540, 560, 600, (1, 0.15, 0.2), 0.3)
    if blau and auf < 0.1:
        licht_punkt(ctx, 600, 820, 500, (0.2, 0.5, 1), 0.35)
    if auf > 0.05:
        regen(ctx, t, alpha=0.3 * clamp(auf))
    ctx.save()
    ctx.translate(dx, dy)
    pov_arme(ctx, t, laufen=0.0, zielen=-0.5)
    ctx.restore()
    helm_rand(ctx)
    zeige_untertitel(ctx, "van", lt, y=1080)


# ---------------------------------------------------------------- Szene 7: Anschleichen (Gasse, wie im Vorbild)
GASSE_TUER_Z = 9.0


def gasse(ctx, cam, t, tuer_z=GASSE_TUER_Z):
    himmel(ctx, "regen", True, cam.horizont)
    for kx, kh in ((-30, 34), (24, 30)):
        linie3d(ctx, cam, (kx, 0, 90), (kx, kh, 90), "#1d2d50", 10)
        linie3d(ctx, cam, (kx - 12, kh, 90), (kx + 14, kh, 90), "#1d2d50", 9)
    boden(ctx, cam, "regen", farbe="#495057")
    gehweg_platten(ctx, cam, -4.5, -2.0, 0, 80, farbe="#8d99ae", fugen="#6c757d")
    pfuetzen(ctx, cam, [(0.8, 22, 1.2), (-1.0, 27, 0.8), (0.5, 33, 1.4), (2.5, 40, 1.2)], 0.45)
    fassade(ctx, cam, 6.0, 1, 80, 14, -1, farbe="#7f4f24", licht=0.25, seed=5, balkone=True)
    fassade(ctx, cam, -4.5, 1, 80, 12, 1, farbe="#8b4a2b", licht=0.15, seed=6, balkone=False, rolltor=False)
    flaeche(ctx, cam, [(-4.49, 0, tuer_z - 0.7), (-4.49, 0, tuer_z + 0.7), (-4.49, 2.35, tuer_z + 0.7),
                       (-4.49, 2.35, tuer_z - 0.7)], "#6c757d", 5)
    px, py = cam.p(-4.48, 3.3, tuer_z + 2.5)
    text(ctx, "7", px, py, 1.6 * cam.skala(-4.48, tuer_z + 2.5), fill="#f1faee", sw=8)
    for z0, f in ((24, "#9d0208"), (30, "#264653"), (36, "#6d597a")):
        kiste(ctx, cam, 2.6, 5.0, 0, 2.6, z0, z0 + 5.5, f, 5)
    kiste(ctx, cam, 2.6, 5.0, 2.6, 5.2, 30.5, 36.0, "#bc6c25", 5)
    return laterne(ctx, cam, 1.8, 22.5), laterne(ctx, cam, 1.8, 38)


def s_anschleichen(ctx, t, lt):
    tempo = 1.6
    geht = lt < 6.2
    cz = 14.5 + tempo * min(lt, 6.2)
    bob = math.sin(t * 7.5) * 0.04 * (1 if geht else 0.2)
    cam = Kamera(x=-2.5 + 0.03 * math.sin(t * 3.7), y=1.45 + bob, z=cz, f=820, horizont=840)
    lamp1, lamp2 = gasse(ctx, cam, t, tuer_z=30.5)
    nacht_filter(ctx, 0.62)
    for lp in (lamp1, lamp2):
        licht_punkt(ctx, lp[0], lp[1], 2.5 * lp[2], alpha=0.5)
        lichtkegel(ctx, lp[0], lp[1], 3.5 * lp[2], 5.2 * lp[2], alpha=0.2)
    stack = [("boss", 19.6, 29.4), ("tank", 18.4, 28.2), ("nova", 17.2, 27.0), ("pixel", 16.0, 25.8)]

    def team():
        for wer, z0, z_end in sorted(stack, key=lambda s: -s[2]):
            z = min(z_end, z0 + tempo * lt)
            laeuft = z < z_end - 0.01
            ph = t * 7.5 + len(wer)
            beine = geh_beine(ph, 0.35, hocke=0.5) if laeuft else (0.5, 1.2, -0.4, 1.1)
            arme = (0.9, 0.7, 0.9, 0.7)
            if wer == "boss" and not laeuft and lt > 3.0:
                arme = (0.9, 0.7, 2.8, 0.2)
            teammitglied(ctx, cam, wer, -3.35, z, beine=beine, arme=arme, neigung=0.25,
                         k=dict(ruecken=True))
        dxp, dyp = cam.p(-1.0 + 0.4 * math.sin(t * 1.3), 5.2 + 0.2 * math.sin(t * 2.1), 34)
        s = cam.skala(0, 34)
        rrect(ctx, dxp - 0.4 * s, dyp - 0.08 * s, 0.8 * s, 0.16 * s, 0.05 * s)
        form(ctx, "#111111", 3)
        if int(t * 3) % 2 == 0:
            licht_punkt(ctx, dxp, dyp, 0.5 * s, (1, 0.1, 0.1), 0.9)
    ebene(ctx, team, 0.2)
    regen(ctx, t, alpha=0.38)
    regen_spritzer(ctx, cam, t, 40, -4, 5, cam.z + 2, cam.z + 25)
    pov_arme(ctx, t, laufen=0.7 if geht else 0.1, zielen=-0.1)
    helm_rand(ctx)
    einblendung(ctx, "02:31 UHR · ZUGRIFFSORT", "Lagerhaus 7", lt, y=440)
    zeige_untertitel(ctx, "anschleichen", lt, y=1150)


# ---------------------------------------------------------------- Szene 8: Zugriff (POV an der Tür)
def s_zugriff(ctx, t, lt):
    expl = 3.6
    lauf = clamp((lt - 5.0) / 0.3)
    cam_z = 0.0 if lt < 5.0 else min(6.6, (lt - 5.0) * 3.5)
    front_szene(ctx, t, lt, expl_lt=expl, cam_z=cam_z, lauf=lauf, team=lt < 5.0)
    helm_rand(ctx)
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
    helm_rand(ctx)
    zeige_untertitel(ctx, "innen", lt, y=1060)


# ---------------------------------------------------------------- Szene 10: Verfolgung auf dem Pier (Seite)
PIER_Y = 1500
RUTSCH_X = 2600.0






def s_verfolgung(ctx, t, lt):
    cz, rennt = kamera_z(lt)
    runter = ease_out(clamp((lt - 5.2) / 0.6))
    bob = math.sin(t * 11) * 0.07 * (1 if rennt else 0)
    cam = Kamera(x=0.25 * math.sin(t * 5.5) * (1 if rennt else 0), y=1.6 + bob - 0.25 * runter, z=cz, f=820,
                 horizont=860 - 430 * runter)
    himmel(ctx, "regen", True, cam.horizont)
    # Wasser links, Kai rechts
    flaeche(ctx, cam, [(-80, -0.8, cz - 5), (-2.5, -0.8, cz - 5), (-2.5, -0.8, cz + 120), (-80, -0.8, cz + 120)],
            "#0d1b2a", 0)
    for k in range(14):
        zz = cz + 2 + k * 4 - (t * 2) % 4
        linie3d(ctx, cam, (-40, -0.8, zz), (-2.6, -0.8, zz), "#2a4365", 3)
    flaeche(ctx, cam, [(-2.5, 0, cz - 5), (14, 0, cz - 5), (14, 0, cz + 120), (-2.5, 0, cz + 120)], "#6f4e37", 0)
    z = math.floor(cz) - 3
    while z < cz + 60:
        linie3d(ctx, cam, (-2.5, 0.001, z), (3.0, 0.001, z), "#4a3426", 2.5)
        z += 0.6
    flaeche(ctx, cam, [(-2.5, 0, cz - 5), (-2.5, 0, cz + 120), (-2.5, -0.8, cz + 120), (-2.5, -0.8, cz - 5)],
            "#3e2a1c", 4)
    flaeche(ctx, cam, [(3.0, 0.002, cz - 5), (14, 0.002, cz - 5), (14, 0.002, cz + 120), (3.0, 0.002, cz + 120)],
            "#495057", 0)
    pfuetzen(ctx, cam, [(1.0, 31.0, 1.0), (1.4, 18, 0.7), (-1.2, 44, 0.9)], 0.55)
    # Container + Poller + Laternen (weit weg zuerst)
    objekte = []
    for i in range(14):
        z0 = i * 7.0
        objekte.append((z0 + 6, "container", z0, ["#9d0208", "#264653", "#6d597a", "#3a5a40", "#bc6c25"][i % 5]))
    for i in range(20):
        objekte.append((i * 4.0 + 1, "poller", i * 4.0 + 1, None))
    for i in range(8):
        objekte.append((i * 12.0 + 6, "laterne", i * 12.0 + 6, None))
    lampen = []
    for zz, art, z0, f in sorted(objekte, key=lambda o: -o[0]):
        if zz < cz - 2 or zz > cz + 70:
            continue
        if art == "container":
            kiste(ctx, cam, 4.2, 6.6, 0, 2.6, z0, z0 + 6.0, f, 5)
            if (int(z0) // 7) % 2 == 0:
                kiste(ctx, cam, 4.2, 6.6, 2.6, 5.2, z0 + 0.3, z0 + 5.7, "#264653", 5)
        elif art == "poller":
            kiste(ctx, cam, -2.35, -2.05, 0, 0.45, z0, z0 + 0.3, "#212529", 3)
        else:
            lampen.append(laterne(ctx, cam, -2.2, z0, hoehe=5.5))
    nacht_filter(ctx, 0.58)
    for lp in lampen:
        licht_punkt(ctx, lp[0], lp[1], 2.6 * lp[2], alpha=0.5)
        lichtkegel(ctx, lp[0], lp[1], 3.6 * lp[2], 5.5 * lp[2], alpha=0.2)
    fz, frot = fuchs_z(lt)
    schaut = 2.9 <= lt < 4.0

    def fuchs():
        K = dict(brille=True, haare="stachel", haarfarbe="#212529", ruecken=not schaut and frot == 0,
                 mund=mund("verfolgung", lt, "fuchs", "grinsen"), augen="normal")
        if frot != 0:
            K.update(ruecken=False, augen="weit", mund=mund("verfolgung", lt, "fuchs", 0.5))
        if frot == 0:
            ganove(ctx, cam, 1.0, fz, "#ff9f1c", kappe=None,
                   P=dict(beine=geh_beine(t * 12, 0.75), arme=(-0.9 * math.sin(t * 12), 1.2, 0.9 * math.sin(t * 12), 1.2),
                          neigung=0.12),
                   K=K)
        else:
            ganove(ctx, cam, 1.0, fz, "#ff9f1c", kappe=None, rot=frot,
                   P=dict(beine=(0.9, 0.1, 0.6, 0.1), arme=(-1.8, 0.3, 2.4, 0.3) if lt < 5.8 else (0.4, 0.2, 0.5, 0.2)),
                   K=K)
    ebene(ctx, fuchs, 0.15)
    # Spritzer beim Ausrutschen
    if 4.0 <= lt < 5.0:
        rnd = random.Random(int(lt * 30))
        for _ in range(20):
            px, py = cam.p(rnd.uniform(0, 2.2), rnd.uniform(0, 0.8) * (1 - (lt - 4.0)), 30.8 + rnd.uniform(0, 1))
            ctx.arc(px, py, rnd.uniform(4, 10), 0, 2 * math.pi)
            ctx.set_source_rgba(0.7, 0.85, 1, 0.7)
            ctx.fill()
    regen(ctx, t, wind=0.1, alpha=0.4)
    if lt < 5.4:
        pov_arme(ctx, t, laufen=1.0 if rennt else 0.3, zielen=-0.6)
    else:
        # Handschellen in den Händen, Richtung Handgelenke des Liegenden
        k = ease_out(clamp((lt - 5.4) / 0.4))
        hx, hy = 560, 1950 - 600 * k
        for sx in (-1, 1):
            limb(ctx, [(540 + sx * 520, 2100), (hx + sx * 220, hy + 260), (hx + sx * 90, hy + 40)], 140, "#3a4066")
            rrect(ctx, hx + sx * 90 - 65, hy - 20, 130, 110, 40)
            form(ctx, "#1b1b1e", 6)
        for dxh in (-45, 45):
            ctx.arc(hx + dxh, hy - 70, 42, 0, 2 * math.pi)
            ctx.set_source_rgba(*hexc("#ced4da"))
            ctx.set_line_width(14)
            ctx.stroke()
    helm_rand(ctx)
    zeige_untertitel(ctx, "verfolgung", lt, y=1250 if lt < 5.4 else 560)


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
    reihe = [("nova", -2.4, 5.0), ("tank", -1.2, 4.6), ("boss", 1.3, 4.6), ("pixel", 2.5, 5.0)]
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
    pov_arme(ctx, t, zielen=-0.8)
    helm_rand(ctx)
    # Laptop-Einblendung
    if 0.6 <= lt < 4.4:
        k = ease_back((lt - 0.6) / 0.25)
        ctx.save()
        ctx.translate(540, 640)
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
def pov_tasse(ctx, t, lt):
    """Ich-Sicht am Tisch: linke Hand liegt auf dem Tisch, rechte hält die Kaffeetasse (trinkt zwischendurch)."""
    hx, hy = 780 + 6 * math.sin(lt * 1.3), 1620 + 4 * math.sin(lt * 2.1)
    haut, aermel = "#f2c39a", "#3a4066"
    limb(ctx, [(-120, 2050), (120, 1830), (300, 1760)], 150, aermel)
    rrect(ctx, 230, 1700, 190, 110, 50)
    form(ctx, haut, 7)
    for k in range(4):
        rrect(ctx, 400, 1705 + k * 25, 60, 22, 11)
        form(ctx, haut, 4)
    limb(ctx, [(1200, 2050), (hx + 220, hy + 260), (hx + 70, hy + 60)], 150, aermel)
    rrect(ctx, hx - 110, hy - 130, 200, 230, 26)
    form(ctx, "#f8f9fa", 7)
    ctx.arc(hx + 100, hy - 10, 55, -1.3, 1.3)
    ctx.set_source_rgba(0, 0, 0, 1)
    ctx.set_line_width(26)
    ctx.stroke()
    ctx.arc(hx + 100, hy - 10, 55, -1.3, 1.3)
    ctx.set_source_rgba(*hexc("#f8f9fa"))
    ctx.set_line_width(14)
    ctx.stroke()
    text(ctx, "FALKE", hx - 10, hy - 20, 34, fill="#2b2d42", stroke=None)
    rrect(ctx, hx + 20, hy - 40, 120, 130, 50)
    form(ctx, haut, 7)
    for k in range(3):   # Dampf
        ph = (t * 0.6 + k / 3) % 1
        ctx.move_to(hx - 50 + k * 50, hy - 140 - ph * 160)
        ctx.curve_to(hx - 20 + k * 50, hy - 170 - ph * 160, hx - 80 + k * 50, hy - 200 - ph * 160,
                     hx - 50 + k * 50, hy - 230 - ph * 160)
        ctx.set_source_rgba(1, 1, 1, 0.5 * (1 - ph))
        ctx.set_line_width(8)
        ctx.stroke()
    return (hx - 10, hy - 140)

def s_spind(ctx, t, lt):
    cam = Kamera(x=0.0, y=1.66 + 0.01 * math.sin(lt * 1.7), z=0.6, f=820, horizont=840)
    ctx.set_source_rgba(*hexc("#9aa5b8"))
    ctx.paint()
    flaeche(ctx, cam, [(-6, 0, 0), (6, 0, 0), (6, 0, 2.6), (-6, 0, 2.6)], "#5c677d", 0)
    flaeche(ctx, cam, [(-6, 0, 2.6), (6, 0, 2.6), (6, 3.2, 2.6), (-6, 3.2, 2.6)], "#b8c0cc", 4)
    tuer_auf = ease_out(clamp(lt / 0.6)) * 1.7
    for k in range(-4, 5):
        x0 = -0.3 + k * 0.62
        flaeche(ctx, cam, [(x0, 0.0, 2.58), (x0 + 0.6, 0.0, 2.58), (x0 + 0.6, 2.0, 2.58), (x0, 2.0, 2.58)],
                "#495057" if k else "#1b1b22", 4)
        if k == 0:
            # Inneres: Fach + Helm (solange nicht gegriffen)
            linie3d(ctx, cam, (x0, 1.4, 2.57), (x0 + 0.6, 1.4, 2.57), "#6c757d", 6)
            if lt < 1.4:
                hx, hy = cam.p(0.0, 1.62, 2.55)
                s = cam.skala(0, 2.55)
                ctx.arc(hx, hy, 0.17 * s, math.pi, 2 * math.pi)
                ctx.close_path()
                form(ctx, "#2f3e46", 5)
            # Tür dreht um das Scharnier links zur Kamera hin
            a = tuer_auf
            fx, fz = x0 + 0.6 * math.cos(a), 2.58 - 0.6 * math.sin(a)
            flaeche(ctx, cam, [(x0, 0.0, 2.58), (fx, 0.0, fz), (fx, 2.0, fz), (x0, 2.0, 2.58)], "#6c757d", 5)
        else:
            for j in range(4):
                linie3d(ctx, cam, (x0 + 0.15, 1.75 - j * 0.06, 2.57), (x0 + 0.45, 1.75 - j * 0.06, 2.57), "#343a40", 3)
            px, py = cam.p(x0 + 0.3, 1.2, 2.57)
            text(ctx, f"FALKE {k + 5}" if k < 0 else "", px, py, 0.07 * cam.skala(0, 2.57),
                 fill="#ced4da", stroke=None)
    # Nova am Rand links, setzt den Helm auf
    teammitglied(ctx, cam, "nova", -0.95, 2.2, arme=(0.3, 0.3, 2.7, 1.2),
                 k=dict(mund=mund("spind", lt, "nova", "grinsen"), blick=(1, 0)))
    # Hand greift den Helm und hebt ihn hoch
    if 0.8 <= lt < 2.1:
        k = clamp((lt - 0.8) / 0.6)
        hoch = clamp((lt - 1.4) / 0.6)
        hx0, hy0 = cam.p(0.0, 1.62, 2.55)
        hx = 980 + (hx0 - 980) * ease_out(k)
        hy = 1900 + (hy0 - 1900) * ease_out(k) - 1400 * hoch * hoch
        groesse = 1 + 2.5 * hoch
        limb(ctx, [(1250, 2100), (hx + 160, hy + 200), (hx + 40, hy + 40)], 140, "#3a4066")
        if lt >= 1.4:
            ctx.arc(hx, hy, 0.17 * cam.skala(0, 2.55) * groesse, math.pi, 2 * math.pi)
            ctx.close_path()
            form(ctx, "#2f3e46", 6)
        rrect(ctx, hx - 60, hy - 30, 130, 110, 40)
        form(ctx, "#1b1b1e", 6)
    # Waffe kommt ins Bild und wird durchgeladen
    if lt >= 2.6:
        k = ease_out(clamp((lt - 2.6) / 0.6))
        ruck = 30 * math.exp(-12 * (lt - 3.4)) if lt >= 3.4 else 0
        ctx.save()
        ctx.translate(0, 700 * (1 - k) + ruck)
        pov_arme(ctx, t, zielen=-0.3)
        ctx.restore()
    if lt >= 2.0:
        helm_rand(ctx, clamp((lt - 2.0) / 0.3))
    zeige_untertitel(ctx, "spind", lt, y=1150)

def helm_rand(ctx, k=1.0):
    """Rand des Helms/Visiers oben im Bild."""
    ctx.save()
    ctx.translate(0, -200 * (1 - k))
    ctx.move_to(-50, -10)
    ctx.line_to(W + 50, -10)
    ctx.line_to(W + 50, 120)
    ctx.curve_to(800, 200, 280, 200, -50, 120)
    ctx.close_path()
    ctx.set_source_rgba(0.06, 0.07, 0.09, 0.92)
    ctx.fill()
    ctx.restore()

def fuchs_z(lt):
    """Fuchs rennt vor uns weg, rutscht bei z = 30.6 aus, schlittert und bleibt liegen."""
    t_r = 4.0
    if lt < t_r:
        return 9.0 + 5.4 * lt, 0.0
    d = lt - t_r
    z = 30.6 + 5.4 * (1 - math.exp(-2.5 * d)) / 2.5
    rot = -(math.pi / 2) * min(1.0, (d / 0.5) ** 2)
    return z, rot

def kamera_z(lt):
    stop = fuchs_z(20)[0] - 2.1
    t_stop = (stop - 1.0) / 6.0
    if lt < t_stop:
        return 1.0 + 6.0 * lt, True
    return stop, False

def bodycam(surf, t, n, lt):
    """Helmkamera-Look: leichte Weitwinkel-Wölbung, Vignette, Filmkorn, REC-Anzeige."""
    global _MAP, _VIG, _KORN
    if _MAP is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        cx, cy = W / 2, H / 2
        R = math.hypot(cx, cy)
        u, v = (xx - cx) / R, (yy - cy) / R
        r2 = u * u + v * v
        k = 0.10
        f = (1 + k * r2) / (1 + k)
        sx = np.clip(cx + u * f * R, 0, W - 1).astype(np.int32)
        sy = np.clip(cy + v * f * R, 0, H - 1).astype(np.int32)
        _MAP = (sy * W + sx).ravel()
        _VIG = (1.0 - 0.38 * np.clip(r2 * 1.15 - 0.12, 0, 1)).astype(np.float32)[..., None]
        _KORN = np.random.default_rng(9).integers(-5, 6, size=(H + 64, W + 64, 1), dtype=np.int16)
    surf.flush()
    buf = np.ndarray((H, W, 4), np.uint8, surf.get_data())
    bild = buf.reshape(-1, 4)[_MAP].reshape(H, W, 4)
    rgb = bild[..., :3].astype(np.float32) * _VIG
    o = int(t * FPS * 37) % 64
    rgb += _KORN[o:o + H, (o * 3) % 64:(o * 3) % 64 + W]
    buf[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    buf[..., 3] = 255
    surf.mark_dirty()
    ctx = cairo.Context(surf)
    uhr = {"hook": 2 * 3600 + 33 * 60 + 10, "hq": 20 * 3600 + 14 * 60, "briefing": 20 * 3600 + 24 * 60,
           "spind": 1 * 3600 + 48 * 60, "van": 2 * 3600 + 14 * 60, "anschleichen": 2 * 3600 + 31 * 60,
           "zugriff": 2 * 3600 + 32 * 60 + 52, "innen": 2 * 3600 + 33 * 60 + 2, "verfolgung": 2 * 3600 + 34 * 60,
           "twist": 2 * 3600 + 38 * 60}.get(n, 0) + int(lt)
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(34)
    if int(t * 2) % 2 == 0:
        ctx.arc(80, 252, 13, 0, 2 * math.pi)
        ctx.set_source_rgba(1, 0.15, 0.2, 0.95)
        ctx.fill()
    ctx.set_source_rgba(1, 1, 1, 0.85)
    ctx.move_to(104, 264)
    ctx.show_text(f"REC   FALKE 5   {uhr // 3600:02d}:{uhr // 60 % 60:02d}:{uhr % 60:02d}")
    ctx.set_font_size(26)
    ctx.move_to(70, 300)
    ctx.set_source_rgba(1, 1, 1, 0.6)
    ctx.show_text("BODYCAM · EINHEIT FALKE")


_MAP = _VIG = _KORN = None


SZENEN = {"hook": s_hook, "hq": s_hq, "briefing": s_briefing, "spind": s_spind,
          "van": s_van, "anschleichen": s_anschleichen, "zugriff": s_zugriff, "innen": s_innen,
          "verfolgung": s_verfolgung, "twist": s_twist}


def render(i, lt):
    s = SZ[i]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    ctx.set_source_rgb(0, 0, 0)
    ctx.paint()
    SZENEN[s["n"]](ctx, s["start"] + lt, lt)
    if not (s["n"] == "twist" and lt >= 7.7):
        bodycam(surf, s["start"] + lt, s["n"], lt)
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

    def band(d, lo, hi):
        x = rng.uniform(-1, 1, int(d * SR))
        return lowpass(x, hi) - lowpass(x, lo)

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

    def schritt(nass=True):
        tt = ts(0.12)
        s = 0.6 * rauschen(0.12, 900) * np.exp(-35 * tt) + 0.5 * np.sin(2 * np.pi * 70 * tt) * np.exp(-40 * tt)
        if nass:
            s += 0.35 * band(0.12, 1500, 5000) * np.exp(-25 * tt)
        return s

    def atmen(d, rate, staerke):
        tt = ts(d)
        hull = np.sin(np.pi * ((tt * rate) % 1)) ** 2
        return staerke * band(d, 250, 1400) * hull

    def herz(d, bpm=78):
        out = np.zeros(int(d * SR))
        for k in range(int(d * bpm / 60)):
            for off, st in ((0.0, 1.0), (0.22, 0.6)):
                i = int((k * 60 / bpm + off) * SR)
                tt = ts(0.15)
                s = st * np.sin(2 * np.pi * 48 * tt) * np.exp(-25 * tt)
                out[i:i + len(s)] += s[:max(0, len(out) - i)]
        return out

    def knarzen(d=0.6, f0=180):
        tt = ts(d)
        return 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(f0 + 60 * np.sin(2 * np.pi * 9 * tt)) / SR)) * \
            lowpass(rng.uniform(0, 1, len(tt)), 40) * np.sin(np.pi * tt / d)

    lautst = {"hook": 0.18, "hq": 0.05, "briefing": 0.03, "spind": 0.0, "van": 0.08, "anschleichen": 0.2,
              "zugriff": 0.18, "innen": 0.05, "verfolgung": 0.22, "twist": 0.18}
    for s in SZ:
        if lautst[s["n"]]:
            add(s["start"], rauschen(s["d"], 5000) * lautst[s["n"]])
    # Hook
    add(0.0, boom(), 0.9)
    add(0.0, atmen(2.5, 1.6, 0.25))
    add(2.5, whoosh(0.5), 0.5)
    tt = ts(0.7)
    add(3.3, 0.15 * np.sign(np.sin(2 * np.pi * np.cumsum(600 + 2000 * (tt * 9 % 1)) / SR)))
    # Übergänge (dezent)
    for s in SZ:
        tr = s.get("tr")
        if tr == "whip":
            add(s["start"], whoosh(), 0.35)
        elif tr == "zoom":
            add(s["start"], whoosh(0.5), 0.25)
        elif tr == "uhr":
            for k in range(10):
                add(s["start"] + k * 0.08, klick(2000), 0.25)
    # HQ: Alarm
    s0 = start("hq")
    tt = ts(3.0)
    sirene = np.sign(np.sin(2 * np.pi * np.where((tt % 0.8) < 0.4, 960, 770) * tt))
    add(s0 + 8.0, 0.22 * lowpass(sirene, 2500))
    add(s0 + 3.4, 0.08 * band(0.6, 200, 900))   # Schlürfen
    # Spind
    s0 = start("spind")
    add(s0 + 0.05, knarzen(0.6), 0.5)
    add(s0 + 0.6, thud(0.4))
    add(s0 + 1.4, 0.4 * band(0.25, 300, 2500) * np.exp(-10 * ts(0.25)))
    add(s0 + 2.0, klick(1500), 0.6)
    add(s0 + 2.05, klick(2600), 0.4)
    add(s0 + 3.4, klick(900), 0.8)
    add(s0 + 3.55, klick(1400), 0.8)
    for k in range(3):
        add(s0 + 4.2 + k * 0.45, schritt(False), 0.25)
    # Van: Motor, Riegel, Türen
    s0 = start("van")
    tt = ts(8.3)
    motor = 2 * ((np.cumsum(55 + 5 * np.sin(2 * np.pi * 0.7 * tt)) / SR) % 1) - 1
    add(s0, 0.25 * lowpass(motor, 300) * np.minimum(1, (8.3 - tt) * 2))
    add(s0 + 8.2, klick(700), 0.9)
    add(s0 + 8.3, knarzen(0.8, 140), 0.4)
    add(s0 + 8.4, rauschen(1.1, 5000) * np.linspace(0, 0.18, int(1.1 * SR)))
    # Anschleichen: Schritte, Herzschlag, Atmen
    s0 = start("anschleichen")
    for k in range(int(6.2 / 0.42)):
        add(s0 + k * 0.42, schritt(), 0.22)
    add(s0, herz(7.0 + 3.6, 82), 0.35)
    add(s0, atmen(10.6, 0.45, 0.12))
    # Zugriff
    s0 = start("zugriff")
    add(s0 + 3.6, boom(), 1.0)
    add(s0 + 3.6 + 0.9, thud(0.6))
    for k in range(int(2.0 / 0.28)):
        add(s0 + 5.0 + k * 0.28, schritt(), 0.3)
    # Innen
    s0 = start("innen")
    add(s0 + 0.9, klick(900), 0.4)
    add(s0 + 1.5, boom(0.6), 0.8)
    add(s0 + 5.0, thud(1.0), 0.8)
    add(s0 + 5.25, thud(0.6), 0.6)
    # Verfolgung: Rennen, schweres Atmen, Ausrutschen, Handschellen
    s0 = start("verfolgung")
    for k in range(int(5.0 / 0.29)):
        add(s0 + k * 0.29, schritt(), 0.4)
    add(s0, atmen(9.0, 1.3, 0.35) * np.concatenate([np.ones(int(5.2 * SR)), np.linspace(1, 0.4, int(3.8 * SR))]))
    add(s0 + 4.0, whoosh(0.4), 0.4)
    add(s0 + 4.0, 0.35 * band(0.5, 600, 4000) * np.exp(-6 * ts(0.5)))
    add(s0 + 4.5, thud(0.9))
    add(s0 + 5.8, klick(3500), 0.7)
    add(s0 + 5.95, klick(3800), 0.7)
    add(s0 + 6.0, 0.2 * band(0.3, 2000, 6000) * np.exp(-12 * ts(0.3)))
    # Twist
    s0 = start("twist")
    for t0, fs in ((s0 + 2.5, (110, 130.8, 155.6)), (s0 + 7.7, (98, 146.8, 196, 246.9))):
        tt = ts(2.0)
        akk = sum(np.sin(2 * np.pi * f * tt) for f in fs) / len(fs)
        add(t0, 0.3 * akk * np.exp(-1.2 * tt))
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
