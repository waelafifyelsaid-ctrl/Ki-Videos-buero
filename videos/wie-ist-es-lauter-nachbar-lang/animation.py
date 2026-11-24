#!/usr/bin/env python3
"""Wie ist es … einen LAUTEN Nachbarn zu haben? – Langfassung (> 60 s) mit Skript,
POV-Szenen und Übergängen.

  python3 animation.py frames <start> <ende>   -> rohe BGRA-Frames auf stdout
  python3 animation.py ton tmp/ton.wav         -> Tonspur
  python3 animation.py bild <t> datei.png      -> Einzelbild
  python3 animation.py skript                  -> Skript als Markdown-Tabelle
"""
import math
import random
import sys
import wave
from pathlib import Path

import cairo
import numpy as np

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))
import kulisse as K  # noqa: E402
from kulisse import *  # noqa: E402,F401

# ---------------------------------------------------------------- Ablauf
SZ = [
    dict(n="hook", typ="pov_decke", d=3.5, tr=None),
    dict(n="intro", typ="haus", d=6.0, tr="zoom_out", fokus=(175, 1470)),
    dict(n="rennt", typ="haus", d=8.0, tr="whip"),
    dict(n="pov_wecker", typ="pov_decke", d=5.0, tr="zoom", fokus=(175, 1470)),
    dict(n="musik", typ="haus", d=9.0, tr="black"),
    dict(n="pov_tisch", typ="pov_tisch", d=5.5, tr="zoom", fokus=(870, 1470)),
    dict(n="schreit", typ="haus", d=8.0, tr="glitch"),
    dict(n="saugt", typ="haus", d=7.5, tr="uhr", karte="03:00 NACHTS"),
    dict(n="pov_besen", typ="pov_besen", d=5.0, tr="zoom", fokus=(175, 1420)),
    dict(n="stille", typ="haus", d=9.0, tr="iris", fokus=(330, 1300)),
    dict(n="outro", typ="pov_decke", d=6.0, tr="uhr", karte="07:00 – AM NÄCHSTEN TAG"),
]
_t = 0.0
for _s in SZ:
    _s["start"] = _t
    _t += _s["d"]
DAUER = _t
K.DAUER = DAUER
TR_DAUER = {"uhr": 0.9, "zoom": 0.55, "zoom_out": 0.5}


def start(n):
    return next(s["start"] for s in SZ if s["n"] == n)


def index_bei(t):
    i = 0
    for k, s in enumerate(SZ):
        if t >= s["start"]:
            i = k
    return i


# ---------------------------------------------------------------- Skript
CPS = 24  # Schreibgeschwindigkeit (Zeichen/s)
# (szene, start, wer, text, bis, schrei)
DIALOG = [
    ("hook", 0.2, "ich", "Jeden. Verdammten. Morgen.", 3.5, False),
    ("rennt", 0.6, "ich", "KALLE! Es ist 7 Uhr, du wandelnder Presslufthammer!", 3.8, False),
    ("rennt", 4.0, "kalle", "Morgensport, Baby! Lauf mit!", 6.0, False),
    ("rennt", 6.1, "ich", "Ich hoffe, du stolperst.", 8.0, False),
    ("pov_wecker", 0.3, "ich", "Wenn die Decke einstürzt, verklag ich dich, Kalle.", 3.9, False),
    ("musik", 1.0, "ich", "Ich lerne für Statistik, du Disko-Nilpferd!", 3.8, False),
    ("musik", 4.0, "kalle", "WAS?! ICH HÖR DICH NICHT!", 6.0, True),
    ("musik", 6.2, "ich", "Klar. Dein Hirn ist auch auf lautlos.", 9.0, False),
    ("pov_tisch", 0.5, "ich", "Die Formeln tanzen schon mit.", 2.9, False),
    ("pov_tisch", 3.0, "ich", "Ich hasse dich, Kalle. Im Takt.", 5.5, False),
    ("schreit", 0.4, "kalle", "NEEEEIN! LAAAAG!!", 2.4, True),
    ("schreit", 2.6, "ich", "Das Einzige, was hier laggt, bist DU, Kalle!", 5.2, False),
    ("schreit", 5.4, "kalle", "Halt die Klappe, Brillenschlange!", 8.0, False),
    ("saugt", 0.5, "ich", "Wer saugt um 3 Uhr nachts?!", 2.8, False),
    ("saugt", 3.0, "ich", "Ein Psychopath. Genau der.", 5.0, False),
    ("saugt", 5.1, "kalle", "Sauberkeit kennt keine Uhrzeit!", 7.5, False),
    ("pov_besen", 0.2, "ich", "Okay. Jetzt reicht's.", 1.1, False),
    ("pov_besen", 2.5, "ich", "Nimm das, Staubsauger-König!", 5.0, False),
    ("stille", 0.9, "ich", "Ha! Endlich Ruhe. Ich hab gewonnen.", 3.7, False),
    ("stille", 4.2, "kalle", "RUHE DA UNTEN!! MANCHE MÜSSEN SCHLAFEN!", 6.8, True),
    ("stille", 7.0, "ich", "Hat er gerade WIRKLICH …?!", 9.0, False),
    ("outro", 1.4, "ich", "… ich zieh aus.", 3.0, False),
]
# Blasen für "ich" in Haus-Szenen: (cx, top, maxw, ziel)
ICH_BLASE = {
    "rennt": (580, 1050, 780, (230, 1420)),
    "musik": (300, 1045, 540, (560, 1250)),
    "schreit": (300, 1045, 540, (560, 1250)),
    "saugt": (600, 1050, 780, (240, 1390)),
    "stille": (660, 1050, 700, (390, 1240)),
}
BANNER = {"intro": ("06:59", "DAS IST KALLE."), "rennt": ("07:00", "ER RENNT."),
          "musik": ("14:00", "MUSIK AUF 100."), "schreit": ("20:00", "ER ZOCKT."),
          "saugt": ("03:00", "ER SAUGT STAUB."), "stille": ("03:01", "STILLE …?")}
LEISTE = {"intro": "Mein Nachbar. Mein Albtraum.", "rennt": "Tag 1 von 365.",
          "musik": "Klausur in 2 Tagen.", "schreit": "Er verliert. Schon wieder.",
          "saugt": "Mitten in der Nacht.", "stille": "3 Uhr 01."}
POV_LABEL = {"pov_wecker": "POV: Dein Wecker heißt Kalle.",
             "pov_tisch": "POV: Seite 1. Seit 3 Stunden.",
             "pov_besen": "POV: Du redest jetzt wie ein Höhlenmensch."}


def zeilen_aktiv(n, lt):
    for sz, s0, wer, txt, bis, schrei in DIALOG:
        if sz == n and s0 <= lt < bis:
            yield wer, txt, lt - s0, schrei


def spricht(n, lt, wer):
    return any(w == wer and d < len(t) / CPS for w, t, d, _ in zeilen_aktiv(n, lt))


def flap(lt):
    return 0.25 + 0.5 * abs(math.sin(lt * 21))


# ---------------------------------------------------------------- Ereignisse
def kalle_run_x(T):
    f = ((T - start("rennt")) / 1.6) % 2
    return 230 + 620 * (f if f < 1 else 2 - f), (1 if f < 1 else -1)


def baue_events():
    E = []

    def add(n, lt, st, x=540):
        E.append((start(n) + lt, st, x))

    for k in range(6):
        add("hook", 0.15 + 0.6 * k, 1.0, 300 + (k * 170) % 500)
    for k in range(10):
        add("intro", 0.3 + 0.6 * k, 0.45, 600)
    t = 0.2
    while t < 8.0:
        add("rennt", t, 0.7, kalle_run_x(start("rennt") + t)[0])
        t += 0.28
    t = 0.1
    while t < 5.0:
        add("pov_wecker", t, 0.7, 250 + (int(t * 100) * 37) % 580)
        t += 0.28
    for n, d in (("musik", 9.0), ("pov_tisch", 5.5)):
        t = 0.0
        while t < d - 0.01:
            add(n, t, 0.35)
            t += 0.5
    add("schreit", 0.4, 0.6)
    for kt in (1.2, 1.7, 2.2):
        add("pov_besen", kt, 0.5, 540)
    add("stille", 4.0, 1.4)
    t = 1.0
    while t < 6.0:
        add("outro", t, 0.7, 250 + (int(t * 100) * 53) % 580)
        t += 0.28
    return sorted(E)


K.EVENTS = baue_events()
K.VAC = (start("saugt"), start("pov_besen") + 2.3)
EVENTS = K.EVENTS


def schlag_jetzt(T, fenster=0.45, min_st=0.5):
    for i, (ti, st, x) in enumerate(EVENTS):
        if 0 <= T - ti < fenster and st >= min_st:
            yield i, ti, st, x


# ---------------------------------------------------------------- Haus-Szenen
def lautsprecher(ctx, cx, b, T):
    puls = 1 + 0.12 * math.exp(-10 * b)
    ctx.save()
    ctx.translate(cx, UP_FLOOR - 20)
    ctx.scale(puls, puls)
    rrect(ctx, -85, -380, 170, 380, 18)
    form(ctx, "#2b2d42", 8)
    for yy, rr in ((-290, 45), (-130, 70)):
        ctx.arc(0, yy, rr, 0, 2 * math.pi)
        form(ctx, "#8d99ae", 6)
        ctx.arc(0, yy, rr * 0.4, 0, 2 * math.pi)
        form(ctx, "#2b2d42", 5)
    ctx.restore()
    for k in range(3):
        r = 100 + ((T * 300 + k * 90) % 270)
        ctx.arc(cx, UP_FLOOR - 220, r, -0.7 if cx > 540 else math.pi - 0.7, 0.7 if cx > 540 else math.pi + 0.7)
        ctx.set_source_rgba(1, 1, 1, clamp(1 - (r - 100) / 270) * 0.8)
        ctx.set_line_width(8)
        ctx.stroke()


def noten_unten(ctx, lt):
    for k in range(9):
        s0 = k * 0.55
        if lt < s0:
            continue
        d = (lt - s0) % 4.9
        x = 150 + (k * 137) % 800 + 40 * math.sin(d * 4 + k)
        y = SLAB_BOT + 20 + d * 150
        if y > LOW_FLOOR - 60:
            continue
        text(ctx, "♪" if k % 2 else "♫", x, y, 80, fill="#7209b7", stroke="#ffffff", sw=8,
             rot=0.3 * math.sin(d * 5), alpha=clamp(2 - d * 0.5))


def controller(ctx, x, y):
    rrect(ctx, x - 50, y - 24, 100, 48, 22)
    form(ctx, "#4a4e69", 6)
    for dx, c in ((-22, "#ef476f"), (22, "#06d6a0")):
        ctx.arc(x + dx, y, 8, 0, 2 * math.pi)
        ctx.set_source_rgba(*hexc(c))
        ctx.fill()


def kalle(ctx, n, lt, T):
    y = UP_FLOOR - 18
    rede = spricht(n, lt, "kalle")
    if n == "intro":
        ph = (T % 0.6) / 0.6
        o = math.sin(math.pi * ph)
        person(ctx, 600, y, 1.0, p(NACHBAR_P, hoch=40 * o, beine=(0.35 * o, 0, -0.35 * o, 0),
                                   arme=(-(0.3 + 2.4 * o), 0, 0.3 + 2.4 * o, 0)),
               p(NACHBAR_K, mund="grinsen", augen="zu" if ph > 0.5 else "normal"))
        return 600
    if n == "rennt":
        x, r = kalle_run_x(T)
        ph = T / 0.56 * 2 * math.pi
        sw = math.sin(ph)
        person(ctx, x, y, 1.0, p(NACHBAR_P, links=r < 0, hoch=18 * abs(math.cos(ph)), neigung=0.18,
                                 beine=(0.75 * sw, 0.9 * max(0, -sw) + 0.2, -0.75 * sw, 0.9 * max(0, sw) + 0.2),
                                 arme=(-0.9 * sw, 1.2, 0.9 * sw, 1.2)),
               p(NACHBAR_K, mund=flap(lt) if rede else 0.45, augen="weit", blick=(1, 0)))
        return x
    if n == "musik":
        b = lt % 0.5
        lautsprecher(ctx, 150, b, T)
        lautsprecher(ctx, 930, b, T)
        w = lt / 0.5 * math.pi
        x = 540 + 60 * math.sin(w / 2)
        person(ctx, x, y, 1.0,
               p(NACHBAR_P, hoch=25 * abs(math.sin(w)), neigung=0.25 * math.sin(w / 2),
                 beine=(0.35 * math.sin(w), 0.5, -0.35 * math.sin(w), 0.5),
                 arme=(-2.7 + 0.4 * math.sin(w), -0.5, 2.7 - 0.4 * math.cos(w), 0.5)),
               p(NACHBAR_K, mund=flap(lt) * 1.4 if rede else "grinsen", augen="weit" if rede else "zu",
                 blick=(0, 1)))
        return x
    if n == "schreit":
        rnd = random.Random(int(T * FPS))
        schrei = 0.4 <= lt < 2.4
        jx = rnd.uniform(-9, 9) if schrei else 0
        arme = (-2.4, -0.6, 2.4, 0.6) if schrei else (0.9, 0.7, 0.9, 0.7)
        hand, _ = person(ctx, 540 + jx, y, 1.05, p(NACHBAR_P, arme=arme, neigung=-0.1 if schrei else 0),
                         p(NACHBAR_K, mund=1.0 if schrei else (flap(lt) if rede else "sauer"),
                           augen="wuetend" if (schrei or rede) else "normal",
                           blick=(0, 1) if rede else (0.3, 0.4)))
        controller(ctx, *hand)
        if not schrei and not rede:   # TV-Flackern
            ctx.set_source_rgba(0.6, 0.8, 1, 0.08 + 0.06 * math.sin(T * 30))
            ctx.rectangle(X0, UP_TOP, X1 - X0, UP_FLOOR - UP_TOP)
            ctx.fill()
        return 540
    if n in ("saugt", "stille"):
        aktiv = n == "saugt"
        if aktiv:
            vx = 540 + 250 * math.sin(lt * 2.2)
            r = math.cos(lt * 2.2)
        else:
            vx, r = 540 + 250 * math.sin(7.5 * 2.2), -1
        dirn = 1 if r >= 0 else -1
        bein = (0.1, 0, -0.1, 0)
        if n == "stille" and 3.6 <= lt < 4.0:
            bein = (0.1, 0, -1.2 * (lt - 3.6) / 0.4 - 0.2, 1.6)
        kk = p(NACHBAR_K, mund=flap(lt) if rede else "laecheln", augen="zu")
        if n == "stille":
            kk = p(NACHBAR_K, mund=0.15, augen="weit", blick=(0, 1))
            if lt >= 3.6:
                kk = p(NACHBAR_K, mund=flap(lt) * 1.5 if rede else 0.6, augen="wuetend", blick=(0, 1))
        sx_ = vx + 210 * dirn
        sauger(ctx, sx_, UP_FLOOR - 20, T, aktiv=aktiv)
        hand, _ = person(ctx, vx, y, 1.0, p(NACHBAR_P, links=r < 0, beine=bein,
                                            arme=(0.2, 0.3, 0.9, 0.3), neigung=0.1 if aktiv else 0), kk)
        ctx.move_to(*hand)
        ctx.curve_to(hand[0] + 80 * dirn, hand[1] + 40, sx_ - 120 * dirn, UP_FLOOR - 40,
                     sx_ - 60 * dirn, UP_FLOOR - 70)
        ctx.set_source_rgba(*hexc("#111111"))
        ctx.set_line_width(22)
        ctx.stroke_preserve()
        ctx.set_source_rgba(*hexc("#7b8794"))
        ctx.set_line_width(12)
        ctx.stroke()
        if aktiv:
            rnd = random.Random(int(T * FPS))
            text(ctx, "WRRRRR", clamp(sx_, 230, 850), UP_FLOOR - 170 + rnd.uniform(-6, 6), 70,
                 fill="#4cc9f0", rot=rnd.uniform(-0.08, 0.08))
        if n == "stille" and 0.3 <= lt < 3.6:
            text(ctx, "?", vx, 470 - 12 * math.sin(T * 6), 120, fill="#ffffff", scale=ease_back((lt - 0.3) / 0.2))
        return vx
    return 540


def ich(ctx, n, lt, T):
    rede = spricht(n, lt, "ich")
    if n == "intro":
        bett(ctx, p(DU_K, augen="muede", mund="sauer", zucken=1.0 if int(T * 5) % 4 == 0 else 0), T)
    elif n == "rennt":
        b = huepf(T, 1)
        bett(ctx, p(DU_K, augen="wuetend" if rede else "weit",
                    mund=flap(lt) if rede else 0.35 + 0.4 * clamp(b), haar_hoch=clamp(b * 1.5),
                    blick=(0, -1)), T)
    elif n == "musik":
        b = lt % 0.5
        stuhl(ctx)
        arme = (1.1, 0.4, 2.9, 0.2) if rede else (1.1, 0.4, 1.3, 0.3)
        person(ctx, 600, 1682, 1.0, sitzen(600, 0, {"neigung": 0.12 + 0.15 * math.exp(-8 * b), "arme": arme}),
               p(DU_K, augen="wuetend" if rede else "muede", mund=flap(lt) if rede else "sauer",
                 blick=(0, -1) if rede else (0.3, 0.6)))
        schreibtisch(ctx, T, buecher_hops=40 * math.exp(-10 * b))
        noten_unten(ctx, lt)
    elif n == "schreit":
        stuhl(ctx)
        sprung = 45 * math.sin(math.pi * (lt - 0.4) / 0.7) if 0.4 <= lt < 1.1 else 0
        arme = (1.1, 0.4, 1.3, 0.3)
        if 0.4 <= lt < 1.1:
            arme = (-2.5, -0.3, 2.5, 0.3)
        elif rede:
            arme = (1.1, 0.4, 2.9, 0.2)
        elif lt >= 5.4:
            arme = (-2.2, -2.2, 2.2, 2.2)
        person(ctx, 600, 1682 - sprung, 1.0, sitzen(600, 0, {"arme": arme}),
               p(DU_K, augen="wuetend" if rede else ("weit" if lt >= 0.4 else "normal"),
                 mund=flap(lt) if rede else (0.6 if lt >= 0.4 else "gerade"),
                 haar_hoch=1.0 if lt >= 0.4 else 0, blick=(0, -1)))
        schreibtisch(ctx, T, tasse=lt < 0.4)
        if lt >= 0.4:
            d = lt - 0.4
            if d < 0.9:
                tx, ty = 760 + 260 * d, 1440 - 700 * d + 1050 * d * d
                ctx.save()
                ctx.translate(tx, ty)
                ctx.rotate(d * 9)
                rrect(ctx, -25, -30, 50, 60, 8)
                form(ctx, "#ffffff", 5)
                ctx.restore()
            else:
                for k in range(5):
                    ctx.move_to(960 + k * 18, LOW_FLOOR - 26)
                    ctx.line_to(970 + k * 18, LOW_FLOOR - 46 + (k % 2) * 10)
                    ctx.line_to(980 + k * 18, LOW_FLOOR - 26)
                    ctx.close_path()
                    form(ctx, "#ffffff", 4)
                if d < 1.4:
                    text(ctx, "KLIRR!", 940, LOW_FLOOR - 120, 62, fill="#ffffff", scale=ease_back((d - 0.9) / 0.12))
    elif n == "saugt":
        zuck = 1.0 if (int(T * 6) % 3 == 0) else 0.0
        bett(ctx, p(DU_K, augen="muede", mund=flap(lt) if rede else "gerade", zucken=zuck), T, kissen_drauf=True)
    elif n == "stille":
        bett_leer(ctx)
        schock = lt >= 4.0
        hoch = 40 * math.exp(-8 * (lt - 4.0)) if schock else 0
        person(ctx, 330, LOW_FLOOR - 18 - hoch, 1.0,
               p(DU_P, arme=(0.4, 0.3, -0.4, -0.3) if schock else (0.7, 1.9, -0.7, -1.9)),
               p(DU_K, augen="weit" if schock else "zu",
                 mund=flap(lt) if rede else (0.95 if schock else "grinsen"),
                 haar_hoch=1.0 if schock else 0, blick=(0, -1)))
        besen(ctx, 470, LOW_FLOOR - 10, liegt=True)


def namensschild(ctx, z1, z2, x, y, ziel, sc, farbe):
    if sc <= 0.01:
        return
    ctx.move_to(x, y)
    ctx.line_to(*ziel)
    ctx.set_source_rgba(*hexc("#111111"))
    ctx.set_line_width(7)
    ctx.stroke()
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(sc, sc)
    ctx.rotate(-0.05)
    rrect(ctx, -230, -75, 460, 150, 24)
    form(ctx, farbe, 8)
    text(ctx, z1, 0, -25, 60, fill="#ffffff", sw=9)
    text(ctx, z2, 0, 38, 38, fill="#111111", stroke=None, maxw=420)
    ctx.restore()


def banner(ctx, n, lt, T, nacht):
    g = cairo.LinearGradient(0, 0, 0, UP_TOP)
    oben, unten = ("#0b132b", "#1c2541") if nacht else ("#48cae4", "#90e0ef")
    g.add_color_stop_rgb(0, *hexc(oben)[:3])
    g.add_color_stop_rgb(1, *hexc(unten)[:3])
    ctx.rectangle(0, 0, W, UP_TOP)
    ctx.set_source(g)
    ctx.fill()
    if nacht:
        rnd = random.Random(5)
        for _ in range(40):
            ctx.arc(rnd.uniform(0, W), rnd.uniform(0, UP_TOP - 80), rnd.uniform(1.5, 4), 0, 2 * math.pi)
            ctx.set_source_rgba(1, 1, 1, 0.5 + 0.5 * math.sin(T * 3 + rnd.uniform(0, 6)))
            ctx.fill()
    ctx.move_to(-20, UP_TOP)
    ctx.line_to(W / 2, UP_TOP - 70)
    ctx.line_to(W + 20, UP_TOP)
    ctx.close_path()
    form(ctx, "#9d0208", 8)
    uhr, titel = BANNER[n]
    t0 = 0
    if n == "intro" and lt >= 3.0:
        titel, t0 = "UND DAS BIN ICH.", 3.0
    rrect(ctx, 40, 50, 230, 110, 24)
    form(ctx, "#222831", 7)
    text(ctx, uhr, 155, 105, 70, fill="#ff4d6d", stroke=None)
    text(ctx, titel, 660, 110, 92, fill="#ffffff", scale=ease_back((lt - t0) / 0.25), maxw=740,
         rot=0.025 * math.sin(T * 10))


def leiste(ctx, n, lt):
    ctx.rectangle(0, LOW_FLOOR, W, H - LOW_FLOOR)
    ctx.set_source_rgba(*hexc("#3a3a3a"))
    ctx.fill()
    ctx.rectangle(0, LOW_FLOOR, W, 16)
    ctx.set_source_rgba(*hexc("#5c5c5c"))
    ctx.fill()
    text(ctx, LEISTE[n], W / 2, 1810, 72, fill="#ffffff", sw=12, scale=ease_back(lt / 0.25), maxw=980)


def haus(ctx, n, lt, T):
    nacht = n in ("saugt", "stille")
    K.UHR = BANNER[n][0]
    banner(ctx, n, lt, T, nacht)
    dx, dy = kamera_wackeln(T)
    zoom = 1 + 0.07 * math.exp(-5 * (lt - 4.0)) if (n == "stille" and lt >= 4.0) else 1.0
    ctx.save()
    ctx.translate(W / 2 + dx, H / 2 + dy)
    ctx.scale(zoom, zoom)
    ctx.translate(-W / 2, -H / 2)
    ctx.rectangle(0, UP_TOP, W, LOW_FLOOR - UP_TOP)
    ctx.set_source_rgba(*hexc("#bc4749"))
    ctx.fill()
    zimmer_oben(ctx, T, nacht)
    kx = kalle(ctx, n, lt, T)
    zimmer_unten(ctx, T, nacht)
    lampe(ctx, T)
    ich(ctx, n, lt, T)
    decke(ctx, T)
    staub(ctx, T)
    if n in ("intro", "rennt"):
        for i, ti, st, x in schlag_jetzt(T):
            d = T - ti
            wort = ["BUMM!", "WUMMS!", "POLTER!", "BUMM!"][i % 4]
            text(ctx, wort, clamp(x, 170, 910), SLAB_BOT + 70 + (i % 2) * 40, 78, fill="#ffd60a",
                 scale=ease_back(d / 0.12) * (1 + 0.15 * st), rot=-0.12 + 0.24 * (i % 2),
                 alpha=clamp((0.45 - d) * 5))
    if n == "musik" and lt % 1.0 < 0.2:
        text(ctx, "WUMM", 820, SLAB_BOT + 80, 70, fill="#f72585", scale=ease_back((lt % 1.0) / 0.1))
    if n == "stille" and 4.0 <= lt < 4.8:
        text(ctx, "BUMM!!!", 540, SLAB_BOT + 110, 130, fill="#ff006e", scale=ease_back((lt - 4.0) / 0.12))
    if nacht:
        ctx.rectangle(0, UP_TOP, W, LOW_FLOOR - UP_TOP)
        ctx.set_source_rgba(0.05, 0.08, 0.25, 0.38)
        ctx.fill()
    if n == "intro":
        namensschild(ctx, "KALLE (34)", "Hobby: Lärm. Beruf: Lärm.", 300, 430, (560, 520),
                     ease_back((lt - 0.4) / 0.25), "#f77f00")
        namensschild(ctx, "ICH (21)", "Will nur schlafen. Seit 2 Jahren.", 680, 1200, (240, 1440),
                     ease_back((lt - 3.1) / 0.25), "#2a9d8f")
    # Sprechblasen
    for wer, txt, d, schrei in zeilen_aktiv(n, lt):
        sc = ease_back(d / 0.18)
        rnd = random.Random(int(T * FPS))
        rot = rnd.uniform(-0.04, 0.04) if schrei else 0
        if wer == "kalle":
            blase(ctx, kx, 318, txt, sichtbar(d, txt, CPS), (kx, 500), farbe="#d62828",
                  sc=sc, rot=rot, schrei=schrei, maxw=900)
        else:
            cx, top, mw, ziel = ICH_BLASE[n]
            blase(ctx, cx, top, txt, sichtbar(d, txt, CPS), ziel, farbe="#1d3557", sc=sc, maxw=mw)
    ctx.restore()
    leiste(ctx, n, lt)


# ---------------------------------------------------------------- POV-Szenen
def raum_rahmen(ctx, nacht, morgen=False):
    """Blick nach oben: Decke in der Mitte, Wände perspektivisch am Rand."""
    g = cairo.RadialGradient(W / 2, 850, 50, W / 2, 850, 900)
    g.add_color_stop_rgb(0, *hexc("#fbfaf3")[:3])
    g.add_color_stop_rgb(1, *hexc("#d8d6c8")[:3])
    ctx.rectangle(0, 0, W, H)
    ctx.set_source(g)
    ctx.fill()
    wand = "#9ec5ec"
    for poly in ([(0, 0), (140, 200), (140, 1500), (0, 1920)], [(W, 0), (940, 200), (940, 1500), (W, 1920)],
                 [(0, 0), (W, 0), (940, 200), (140, 200)], [(0, 1920), (140, 1500), (940, 1500), (W, 1920)]):
        ctx.move_to(*poly[0])
        for pt in poly[1:]:
            ctx.line_to(*pt)
        ctx.close_path()
        form(ctx, wand, 6)
    # Fenster an der linken Wand
    ctx.move_to(20, 700)
    ctx.line_to(110, 720)
    ctx.line_to(110, 1000)
    ctx.line_to(20, 1040)
    ctx.close_path()
    form(ctx, "#1d3557" if nacht else ("#ffd6a5" if morgen else "#8ecae6"), 8, "#ffffff")
    ctx.rectangle(140, 200, 800, 1300)
    ctx.set_source_rgba(0, 0, 0, 0)
    ctx.set_line_width(6)
    ctx.set_source_rgba(*hexc("#111111"))
    ctx.stroke()


def risse(ctx, T, cx=540, cy=850):
    rnd = random.Random(11)
    n = sum(1 for ti, st, _ in EVENTS if ti <= T and st >= 0.5)
    laenge = clamp(n / 60)
    ctx.set_source_rgba(*hexc("#343a40"))
    ctx.set_line_width(6)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    for a in range(5):
        ang = a * 1.25 + 0.3
        x, y = cx + 160 * math.cos(ang), cy + 160 * math.sin(ang)
        ctx.move_to(x, y)
        for k in range(int(2 + 10 * laenge)):
            ang += rnd.uniform(-0.6, 0.6)
            x += 38 * math.cos(ang)
            y += 38 * math.sin(ang)
            ctx.line_to(clamp(x, 150, 930), clamp(y, 210, 1490))
        ctx.stroke()


def lampe_unten_sicht(ctx, T, nacht):
    w = lampen_winkel(T)
    x, y = 540 + 380 * w, 850 + 60 * abs(w)
    if not nacht:
        g = cairo.RadialGradient(x, y, 20, x, y, 330)
        g.add_color_stop_rgba(0, 1, 0.95, 0.6, 0.55)
        g.add_color_stop_rgba(1, 1, 0.95, 0.6, 0)
        ctx.arc(x, y, 330, 0, 2 * math.pi)
        ctx.set_source(g)
        ctx.fill()
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1 - 0.3 * abs(w), 1)
    ctx.arc(0, 0, 150, 0, 2 * math.pi)
    form(ctx, "#ffbe0b", 9)
    ctx.arc(0, 0, 95, 0, 2 * math.pi)
    form(ctx, "#fff3b0" if not nacht else "#8d8d6a", 7)
    ctx.arc(0, 0, 40, 0, 2 * math.pi)
    form(ctx, "#ffffff" if not nacht else "#adb5bd", 5)
    ctx.restore()


def staub_pov(ctx, T):
    for ti, st, x in EVENTS:
        d = T - ti
        if not (0 <= d < 1.0) or st < 0.5:
            continue
        rnd = random.Random(int(ti * 1000))
        for _ in range(int(9 * st)):
            ox, oy = rnd.uniform(200, 880), rnd.uniform(300, 1400)
            r = rnd.uniform(4, 10) + 90 * d * d
            px = ox + (ox - 540) * d * 0.8
            py = oy + (oy - 850) * d * 0.8
            ctx.arc(px, py, r, 0, 2 * math.pi)
            ctx.set_source_rgba(0.5, 0.47, 0.43, clamp(0.9 - d))
            ctx.fill()


def bumm_pov(ctx, T, worte=("BUMM!", "WUMMS!", "POLTER!", "BUMM!")):
    for i, ti, st, x in schlag_jetzt(T, 0.4):
        d = T - ti
        text(ctx, worte[i % len(worte)], x, 420 + (i % 3) * 330, 120, fill="#ffd60a",
             scale=ease_back(d / 0.1) * 1.1, rot=-0.15 + 0.3 * (i % 2), alpha=clamp((0.4 - d) * 5))


def bettdecke_pov(ctx, T, hoehe=0.0):
    """Bettdecke unten im Bild; hoehe 0..1 zieht sie übers Gesicht."""
    top = 1700 - hoehe * 1900
    ctx.move_to(0, top + 40)
    for i in range(9):
        x = i * W / 8
        ctx.line_to(x, top + 30 * math.sin(i * 1.3 + T * 2))
    ctx.line_to(W, H + 10)
    ctx.line_to(0, H + 10)
    ctx.close_path()
    form(ctx, "#e07a5f", 9)
    rnd = random.Random(2)
    ctx.set_source_rgba(1, 1, 1, 0.35)
    for _ in range(25):
        ctx.arc(rnd.uniform(0, W), top + rnd.uniform(80, 400), 16, 0, 2 * math.pi)
        ctx.fill()
    if hoehe < 0.05:   # Füße
        for fx in (700, 860):
            ctx.save()
            ctx.translate(fx, top + 10 + 8 * math.sin(T * 3))
            ctx.scale(1, 0.7)
            ctx.arc(0, 0, 70, math.pi, 2 * math.pi)
            ctx.restore()
            form(ctx, "#e07a5f", 9)
    else:              # Hände halten die Decke
        for fx in (330, 750):
            ctx.arc(fx, top + 20, 50, 0, 2 * math.pi)
            form(ctx, "#f2c39a", 7)


def pov_decke(ctx, n, lt, T):
    nacht = False
    morgen = n == "outro"
    dx, dy = kamera_wackeln(T)
    ctx.save()
    ctx.translate(W / 2 + dx * 1.6, H / 2 + dy * 1.6)
    ctx.rotate(0.015 * math.sin(T * 1.3) + dx * 0.0015)
    ctx.scale(1.06, 1.06)
    ctx.translate(-W / 2, -H / 2)
    raum_rahmen(ctx, nacht, morgen)
    risse(ctx, T)
    lampe_unten_sicht(ctx, T, nacht)
    staub_pov(ctx, T)
    hoehe = 0.0
    if n == "pov_wecker" and lt > 3.9:
        hoehe = ease_out((lt - 3.9) / 1.0)
    bettdecke_pov(ctx, T, hoehe)
    if hoehe < 0.6:
        bumm_pov(ctx, T)
    ctx.restore()
    if morgen:
        ctx.set_source_rgba(1, 0.75, 0.4, 0.12)
        ctx.paint()
    # Vignette
    g = cairo.RadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1200)
    g.add_color_stop_rgba(0, 0, 0, 0, 0)
    g.add_color_stop_rgba(1, 0, 0, 0, 0.55)
    ctx.set_source(g)
    ctx.paint()
    if n == "hook":
        ctx.save()
        rrect(ctx, 50, 70, W - 100, 250, 40)
        form(ctx, "#111111", 6, "#ffffff")
        ctx.restore()
        text(ctx, "WIE IST ES …", W / 2, 150, 104, fill="#ffffff", rot=0.02 * math.sin(T * 8))
        text(ctx, "einen LAUTEN Nachbarn zu haben?", W / 2, 255, 62, fill="#ffd60a", maxw=940)
    elif n == "outro":
        pov_label(ctx, "AM NÄCHSTEN MORGEN …", sc=ease_back(lt / 0.25))
        if lt >= 3.1:
            k = ease_back((lt - 3.1) / 0.3)
            puls = 1 + 0.04 * math.sin(T * 8)
            ctx.save()
            ctx.translate(W / 2, 900)
            ctx.scale(k * puls, k * puls)
            ctx.rotate(-0.04)
            rrect(ctx, -460, -170, 920, 340, 50)
            form(ctx, "#ff006e", 10)
            text(ctx, "MARKIER", 0, -80, 110, fill="#ffffff", sw=14)
            text(ctx, "DEINEN KALLE!", 0, 60, 110, fill="#ffd60a", sw=14, maxw=860)
            ctx.restore()
            text(ctx, "Teil 2? Folgen!", W / 2, 1180, 64, fill="#ffffff", scale=ease_back((lt - 3.6) / 0.3))
    else:
        pov_label(ctx, POV_LABEL[n], sc=ease_back(lt / 0.25))
    if hoehe > 0.95:
        ctx.set_source_rgba(0, 0, 0, (hoehe - 0.95) * 20)
        ctx.paint()
    pov_dialog(ctx, n, lt)


def pov_dialog(ctx, n, lt):
    for wer, txt, d, _ in zeilen_aktiv(n, lt):
        untertitel_box(ctx, "ICH" if wer == "ich" else "KALLE", txt, sichtbar(d, txt, CPS),
                       farbe="#ffd60a" if wer == "ich" else "#ff6b6b")


def pov_tisch(ctx, n, lt, T):
    b = lt % 0.5
    hop = 26 * math.exp(-10 * b)
    dx, dy = kamera_wackeln(T)
    ctx.save()
    ctx.translate(dx, dy)
    # Wand + Decke
    ctx.rectangle(0, 0, W, 760)
    ctx.set_source_rgba(*hexc("#bde0fe"))
    ctx.fill()
    ctx.rectangle(0, 0, W, 130)
    form(ctx, "#ced4da", 6)
    ctx.save()
    ctx.translate(540, 130)
    ctx.rotate(lampen_winkel(T))
    ctx.move_to(0, 0)
    ctx.line_to(0, 90)
    ctx.set_source_rgba(0, 0, 0, 1)
    ctx.set_line_width(5)
    ctx.stroke()
    ctx.move_to(-70, 160)
    ctx.line_to(-30, 90)
    ctx.line_to(30, 90)
    ctx.line_to(70, 160)
    ctx.close_path()
    form(ctx, "#ffbe0b", 6)
    ctx.restore()
    rrect(ctx, 760, 260, 200, 90, 16)
    form(ctx, "#222831", 6)
    text(ctx, "14:00", 860, 305, 56, fill="#ff4d6d", stroke=None)
    rrect(ctx, 110, 230, 230, 300, 10)
    form(ctx, "#ffd166", 6)
    text(ctx, "DU", 225, 330, 80, fill="#ef476f", stroke=None)
    text(ctx, "SCHAFFST", 225, 400, 40, fill="#ef476f", stroke=None)
    text(ctx, "DAS", 225, 455, 52, fill="#ef476f", stroke=None)
    # Tisch
    ctx.move_to(-40, 760)
    ctx.line_to(W + 40, 760)
    ctx.line_to(W + 40, H)
    ctx.line_to(-40, H)
    ctx.close_path()
    form(ctx, "#c68b59", 8)
    ctx.set_source_rgba(0.45, 0.25, 0.1, 0.25)
    ctx.set_line_width(4)
    for y in range(820, H, 90):
        ctx.move_to(0, y)
        ctx.curve_to(300, y + 20, 700, y - 20, W, y + 10)
        ctx.stroke()
    # Buch
    ctx.save()
    ctx.translate(0, -hop)
    for sgn in (-1, 1):
        ctx.move_to(540, 880)
        ctx.line_to(540 + sgn * 420, 900)
        ctx.line_to(540 + sgn * 450, 1560)
        ctx.line_to(540, 1530)
        ctx.close_path()
        form(ctx, "#fdfcf7", 7)
    rnd = random.Random(int(T * 10))
    text(ctx, "STATISTIK", 330, 980, 58, fill="#1d3557", stroke=None, rot=0.03 * math.sin(T * 12))
    formel = "σ² = Σ(x − μ)² / n"
    for k, ch in enumerate(formel):
        jitter = hop * 0.6
        text(ctx, ch, 170 + k * 22, 1100 + rnd.uniform(-jitter, jitter), 40, fill="#111111", stroke=None,
             rot=rnd.uniform(-0.3, 0.3) * hop / 26)
    for k in range(6):
        ctx.rectangle(170 + rnd.uniform(-2, 2) * hop / 10, 1180 + k * 55, 300 - (k % 3) * 40, 14)
        ctx.rectangle(610, 980 + k * 75, 320 - (k % 2) * 60, 14)
    ctx.set_source_rgba(0.5, 0.5, 0.55, 1)
    ctx.fill()
    ctx.restore()
    # Kaffee mit Wellen
    ctx.save()
    ctx.translate(900, 1560 - hop * 0.5)
    ctx.scale(1, 0.75)
    ctx.arc(0, 0, 120, 0, 2 * math.pi)
    form(ctx, "#ffffff", 8)
    ctx.arc(0, 0, 95, 0, 2 * math.pi)
    form(ctx, "#5e3023", 5)
    for k in range(3):
        r = ((lt * 2 + k / 3) % 1) * 90
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.set_source_rgba(1, 1, 1, 0.4 * (1 - r / 90))
        ctx.set_line_width(4)
        ctx.stroke()
    ctx.restore()
    # Noten fallen aufs Buch
    for k in range(8):
        s0 = k * 0.6
        if lt < s0:
            continue
        d = (lt - s0) % 3.0
        x = 200 + (k * 151) % 700 + 50 * math.sin(d * 3 + k)
        y = 150 + d * 420
        text(ctx, "♪" if k % 2 else "♫", x, y, 100, fill="#7209b7", stroke="#ffffff", sw=10,
             rot=0.4 * math.sin(d * 4), alpha=clamp(3 - d))
    # Meine Hände (Unterarme von unten)
    halt_kopf = lt >= 3.0
    for sgn in (-1, 1):
        if halt_kopf:   # Fäuste hauen im Takt auf den Tisch
            schlag = abs(math.sin((lt / 0.5) * math.pi + (0 if sgn < 0 else math.pi / 2)))
            pts = [(540 + sgn * 420, H + 40), (540 + sgn * 330, 1560 - 160 * schlag)]
        else:
            pts = [(540 + sgn * 380, H + 40), (540 + sgn * 320, 1640 - hop * 0.3)]
        limb(ctx, pts, 110, "#2a9d8f")
        ctx.arc(*pts[-1], 70, 0, 2 * math.pi)
        form(ctx, "#f2c39a", 8)
    if lt % 1.0 < 0.2:
        text(ctx, "WUMM", 820, 620, 90, fill="#f72585", scale=ease_back((lt % 1.0) / 0.1))
    ctx.restore()
    pov_label(ctx, POV_LABEL[n], sc=ease_back(lt / 0.25))
    pov_dialog(ctx, n, lt)


def pov_besen(ctx, n, lt, T):
    dx, dy = kamera_wackeln(T)
    ctx.save()
    ctx.translate(W / 2 + dx * 1.5, H / 2 + dy * 1.5)
    ctx.scale(1.06, 1.06)
    ctx.translate(-W / 2, -H / 2)
    raum_rahmen(ctx, True)
    risse(ctx, T)
    lampe_unten_sicht(ctx, T, True)
    staub_pov(ctx, T)
    # Besen: Stiel von unten bis an die Decke
    hoch = 0.0
    for kt in (1.2, 1.7, 2.2):
        if kt - 0.2 <= lt < kt + 0.15:
            hoch = max(hoch, 1 - abs(lt - kt) / 0.2)
    rein = ease_out(lt / 0.5)
    spitze_y = 1050 - 330 * clamp(hoch) + (1 - rein) * 900
    ctx.move_to(540 - 60, H + 20)
    ctx.line_to(540 - 16, spitze_y)
    ctx.line_to(540 + 16, spitze_y)
    ctx.line_to(540 + 60, H + 20)
    ctx.close_path()
    form(ctx, "#bc6c25", 8)
    for hy, rr in ((spitze_y + (H - spitze_y) * 0.55, 78), (spitze_y + (H - spitze_y) * 0.85, 92)):
        ctx.arc(540, hy, rr, 0, 2 * math.pi)
        form(ctx, "#f2c39a", 8)
        for f in range(3):
            ctx.move_to(540 - rr * 0.6, hy - rr * 0.3 + f * rr * 0.3)
            ctx.line_to(540 + rr * 0.2, hy - rr * 0.3 + f * rr * 0.3)
        ctx.set_source_rgba(0, 0, 0, 0.6)
        ctx.set_line_width(5)
        ctx.stroke()
    for i, ti, st, x in schlag_jetzt(T, 0.4, 0.45):
        d = T - ti
        text(ctx, "KLOPF!", 540 + (i % 3 - 1) * 220, 560, 120, fill="#ffd60a",
             scale=ease_back(d / 0.1), rot=(i % 3 - 1) * 0.2, alpha=clamp((0.4 - d) * 5))
    if lt < 2.3:
        rnd = random.Random(int(T * FPS))
        text(ctx, "wrrrrrr …", 540 + rnd.uniform(-8, 8), 380, 70, fill="#4cc9f0", rot=rnd.uniform(-0.05, 0.05))
    elif lt > 3.0:
        text(ctx, "…", 540, 400, 120, fill="#ffffff", alpha=clamp(lt - 3.0))
    ctx.restore()
    ctx.set_source_rgba(0.05, 0.08, 0.25, 0.42)
    ctx.paint()
    g = cairo.RadialGradient(W / 2, H / 2, 450, W / 2, H / 2, 1200)
    g.add_color_stop_rgba(0, 0, 0, 0, 0)
    g.add_color_stop_rgba(1, 0, 0, 0, 0.6)
    ctx.set_source(g)
    ctx.paint()
    pov_label(ctx, POV_LABEL[n], sc=ease_back(lt / 0.25))
    pov_dialog(ctx, n, lt)


# ---------------------------------------------------------------- Frames
def render_szene(i, lt):
    s = SZ[i]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    ctx.set_source_rgb(0.1, 0.1, 0.1)
    ctx.paint()
    T = s["start"] + lt
    {"haus": haus, "pov_decke": pov_decke, "pov_tisch": pov_tisch, "pov_besen": pov_besen}[s["typ"]](ctx, s["n"], lt, T)
    return surf


def frame(t):
    i = index_bei(t)
    s = SZ[i]
    lt = t - s["start"]
    tr = s.get("tr")
    dauer = TR_DAUER.get(tr, 0.45)
    if i > 0 and tr and lt < dauer:
        a = render_szene(i - 1, SZ[i - 1]["d"] + lt)
        b = render_szene(i, lt)
        out = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        ctx = cairo.Context(out)
        ctx.set_source_rgb(0, 0, 0)
        ctx.paint()
        fokus = s.get("fokus", (W / 2, H / 2))
        uebergang(ctx, tr, a, b, lt / dauer, fokus=fokus, karte=s.get("karte", ""), seed=int(t * FPS))
        return out
    return render_szene(i, lt)


# ---------------------------------------------------------------- Ton
def ton(pfad):
    n = int(DAUER * SR)
    a = np.zeros(n)
    rng = np.random.default_rng(1)

    def add(t0, sig, vol=1.0):
        i = int(t0 * SR)
        e = min(n, i + len(sig))
        if 0 <= i < n:
            a[i:e] += vol * sig[:e - i]

    def thump(st):
        tt = np.arange(int(0.35 * SR)) / SR
        f = 45 + 70 * np.exp(-25 * tt)
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-9 * tt)
        sig += 0.3 * lowpass(rng.uniform(-1, 1, len(tt)), 300) * np.exp(-20 * tt)
        return 0.6 * st * sig

    musik = (start("musik"), start("pov_tisch") + 5.5)
    besen = [start("pov_besen") + k for k in (1.2, 1.7, 2.2)]
    for ti, st, _ in EVENTS:
        if musik[0] <= ti < musik[1]:
            continue
        if any(abs(ti - b) < 0.01 for b in besen):
            tt = np.arange(int(0.15 * SR)) / SR
            add(ti, 0.7 * np.sin(2 * np.pi * 420 * tt) * np.exp(-40 * tt) +
                0.3 * rng.uniform(-1, 1, len(tt)) * np.exp(-80 * tt))
            continue
        add(ti, thump(min(st, 1.3)))
    # Musik durch die Decke
    laenge = musik[1] - musik[0]
    tt = np.arange(int(laenge * SR)) / SR
    bass = np.zeros(len(tt))
    noten = [55, 55, 65.4, 49]
    seg = np.arange(int(0.5 * SR)) / SR
    for k in range(int(laenge / 0.5)):
        s0 = int(k * 0.5 * SR)
        kick = np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-30 * seg)) / SR) * np.exp(-8 * seg)
        bs = 0.5 * np.sign(np.sin(2 * np.pi * noten[(k // 2) % 4] * seg)) * np.exp(-2 * seg)
        hat = 0.15 * rng.uniform(-1, 1, len(seg)) * np.exp(-60 * ((seg - 0.25) % 0.5))
        bass[s0:s0 + len(seg)] += (kick + bs + hat)[:len(bass) - s0]
    add(musik[0], 0.45 * lowpass(bass, 450))
    # Schrei "NEEEIN LAAAG" + "RUHE DA UNTEN"
    for t0, d, f0 in ((start("schreit") + 0.4, 1.9, 320), (start("stille") + 4.2, 2.0, 200)):
        tt = np.arange(int(d * SR)) / SR
        f = f0 + 40 * np.sin(2 * np.pi * 7 * tt) + 40 * tt
        saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
        env = np.minimum(1, tt * 20) * np.minimum(1, (d - tt) * 6) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 2.5 * tt)))
        add(t0, 0.35 * lowpass(saw * env, 1300))
    # Staubsauger
    v0, v1 = K.VAC
    tt = np.arange(int((v1 - v0) * SR)) / SR
    vac = lowpass(rng.uniform(-1, 1, len(tt)), 2500) * 0.5 + 0.3 * np.sin(2 * np.pi * 120 * tt)
    vac *= 0.3 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.35 * tt)) * np.minimum(1, tt * 4)
    vac[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
    add(v0, vac)
    # Tasse
    s = start("schreit") + 0.4
    tt = np.arange(int(0.9 * SR)) / SR
    add(s, 0.18 * np.sin(2 * np.pi * np.cumsum(1200 - 900 * tt) / SR))
    tt = np.arange(int(0.4 * SR)) / SR
    klirr = sum(np.sin(2 * np.pi * f * tt) for f in (2300, 3100, 4200)) * np.exp(-12 * tt) / 3
    add(s + 0.9, 0.4 * klirr + 0.15 * rng.uniform(-1, 1, len(tt)) * np.exp(-30 * tt))
    # Dialog-"Stimmen"
    for k, (sz, s0, wer, txt, bis, schrei) in enumerate(DIALOG):
        pov = next(x["typ"] for x in SZ if x["n"] == sz) != "haus"
        if wer == "ich":
            add(start(sz) + s0, babbeln(txt, 300, CPS, seed=k), 0.6)
        else:
            add(start(sz) + s0, babbeln(txt, 140, CPS, gedaempft=not pov, seed=k), 0.8 if schrei else 0.65)
    # Übergangs-Sounds
    for i, s_ in enumerate(SZ):
        tr = s_.get("tr")
        t0 = s_["start"]
        if tr == "whip":
            tt = np.arange(int(0.4 * SR)) / SR
            nz = rng.uniform(-1, 1, len(tt))
            add(t0, 0.35 * lowpass(nz, 3000) * np.sin(np.pi * tt / 0.4) ** 2)
        elif tr in ("zoom", "zoom_out", "iris"):
            tt = np.arange(int(0.35 * SR)) / SR
            add(t0, 0.2 * np.sin(2 * np.pi * np.cumsum(300 + 1500 * tt / 0.35) / SR) * np.sin(np.pi * tt / 0.35))
        elif tr == "glitch":
            tt = np.arange(int(0.3 * SR)) / SR
            add(t0, 0.25 * np.sign(np.sin(2 * np.pi * 80 * tt)) * (rng.uniform(0, 1, len(tt)) > 0.5))
        elif tr == "uhr":
            for k in range(10):
                tt = np.arange(int(0.03 * SR)) / SR
                add(t0 + k * 0.08, 0.3 * np.sin(2 * np.pi * 2000 * tt) * np.exp(-150 * tt))
            tt = np.arange(int(0.8 * SR)) / SR
            add(t0 + 0.85, 0.25 * (np.sin(2 * np.pi * 1320 * tt) + 0.5 * np.sin(2 * np.pi * 2640 * tt)) * np.exp(-5 * tt))
    # Pop bei Namensschildern
    for t0 in (start("intro") + 0.4, start("intro") + 3.1):
        tt = np.arange(int(0.12 * SR)) / SR
        add(t0, 0.3 * np.sin(2 * np.pi * np.cumsum(500 + 2500 * tt / 0.12) / SR) * np.exp(-15 * tt))
    a = a / max(1e-9, np.max(np.abs(a))) * 0.89
    with wave.open(pfad, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def skript():
    print("| Zeit | Szene | Wer | Text |\n|---|---|---|---|")
    for sz, s0, wer, txt, bis, _ in DIALOG:
        t = start(sz) + s0
        print(f"| {int(t // 60)}:{t % 60:04.1f} | {sz} | {wer.upper()} | {txt} |")


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
