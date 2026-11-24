"""Kulisse 'Haus-Querschnitt' (oben Nachbar, unten Ich) für die Nachbar-Folgen."""
import math
import random
import sys
from pathlib import Path

import cairo

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
from cartoon import *  # noqa

X0, X1 = 40, 1040
UP_TOP, UP_FLOOR = 300, 960
SLAB_BOT = 1030
LOW_FLOOR = 1700
EVENTS = []        # wird von animation.py gesetzt: (zeit, stärke, x)
VAC = (-1, -1)     # Staubsauger-Zeitraum (absolut)
UHR = "07:00"      # Uhrzeit an der Wand unten
DAUER = 72.0

NACHBAR_K = {"haut": "#e0a77a", "kappe": "#d62828", "stoppeln": True}
NACHBAR_P = {"hemd": "#f77f00", "hose": "#3d405b", "schuh": "#fcbf49", "aufdruck": "XXL"}
DU_K = {"haut": "#f2c39a", "haare": "stachel", "brille": True, "haarfarbe": "#5c3d2e"}
DU_P = {"hemd": "#2a9d8f", "hose": "#264653", "schuh": "#e9ecef"}


def p(base, **kw):
    d = dict(base)
    d.update(kw)
    return d

def lampen_winkel(t):
    a = 0.0
    for ti, st, _ in EVENTS:
        d = t - ti
        if 0 <= d < 6:
            a += 0.18 * st * math.exp(-0.9 * d) * math.sin(4.2 * d)
    return a

def letzter_schlag(t, nach=0.0):
    best = None
    for ti, st, x in EVENTS:
        if ti <= t and ti >= nach:
            best = (ti, st, x)
    return best

def huepf(t, staerke=60, nach=0.0):
    """Kurzer Hüpfer nach dem letzten Einschlag."""
    e = letzter_schlag(t, nach)
    if not e:
        return 0.0
    d = t - e[0]
    return staerke * e[1] * math.exp(-9 * d) * abs(math.sin(d * 14)) if d < 0.6 else 0.0

def erschuetterung(t):
    s = 0.0
    for ti, st, _ in EVENTS:
        if 0 <= t - ti < 0.4:
            s += st * math.exp(-12 * (t - ti))
    if VAC[0] <= t < VAC[1]:                     # Staubsauger brummt
        s += 0.08
    return s

def kamera_wackeln(t):
    s = erschuetterung(t)
    rnd = random.Random(int(t * FPS))
    return (rnd.uniform(-1, 1) * 22 * s, rnd.uniform(-1, 1) * 22 * s)

def zimmer_oben(ctx, t, nacht):
    g = cairo.LinearGradient(0, UP_TOP, 0, UP_FLOOR)
    g.add_color_stop_rgb(0, *hexc("#f4a261")[:3])
    g.add_color_stop_rgb(1, *hexc("#e76f51")[:3])
    ctx.rectangle(X0, UP_TOP, X1 - X0, UP_FLOOR - UP_TOP)
    ctx.set_source(g)
    ctx.fill()
    ctx.set_source_rgba(1, 1, 1, 0.12)
    for x in range(X0 + 30, X1, 70):
        ctx.rectangle(x, UP_TOP, 22, UP_FLOOR - UP_TOP)
    ctx.fill()
    fenster(ctx, 420, 360, 240, 200, nacht)
    # Poster (eigener Blitz)
    rrect(ctx, 120, 380, 150, 200, 10)
    form(ctx, "#ffd166", 6)
    ctx.move_to(205, 400)
    ctx.line_to(160, 490)
    ctx.line_to(200, 490)
    ctx.line_to(180, 560)
    ctx.line_to(240, 460)
    ctx.line_to(200, 460)
    ctx.close_path()
    form(ctx, "#ef476f", 5)
    ctx.rectangle(X0, UP_FLOOR - 22, X1 - X0, 22)
    form(ctx, "#8d5524", 5)

def zimmer_unten(ctx, t, nacht):
    g = cairo.LinearGradient(0, SLAB_BOT, 0, LOW_FLOOR)
    g.add_color_stop_rgb(0, *hexc("#bde0fe")[:3])
    g.add_color_stop_rgb(1, *hexc("#a2d2ff")[:3])
    ctx.rectangle(X0, SLAB_BOT, X1 - X0, LOW_FLOOR - SLAB_BOT)
    ctx.set_source(g)
    ctx.fill()
    fenster(ctx, 90, 1120, 200, 170, nacht)
    # Bild an der Wand kippt mit
    ctx.save()
    ctx.translate(850, 1150)
    ctx.rotate(lampen_winkel(t) * 0.6 + 0.04)
    rrect(ctx, -70, 0, 140, 110, 6)
    form(ctx, "#fefae0", 7)
    ctx.arc(-20, 50, 22, 0, 2 * math.pi)
    form(ctx, "#ffb703", 4)
    ctx.move_to(-60, 100)
    ctx.line_to(0, 55)
    ctx.line_to(60, 100)
    form(ctx, "#52b788", 4)
    ctx.restore()
    # Uhr
    uhr = UHR
    rrect(ctx, 470, 1100, 160, 70, 14)
    form(ctx, "#222831", 6)
    text(ctx, uhr, 550, 1136, 42, fill="#ff4d6d", stroke=None)
    ctx.rectangle(X0, LOW_FLOOR - 24, X1 - X0, 24)
    form(ctx, "#b08968", 5)

def decke(ctx, t):
    ctx.rectangle(0, UP_FLOOR, W, SLAB_BOT - UP_FLOOR)
    ctx.set_source_rgba(*hexc("#adb5bd"))
    ctx.fill()
    ctx.set_source_rgba(*hexc("#868e96"))
    ctx.set_line_width(4)
    for x in range(-60, W, 45):
        ctx.move_to(x, SLAB_BOT)
        ctx.line_to(x + 70, UP_FLOOR)
    ctx.stroke()
    # Risse wachsen mit der Zeit
    riss = clamp(t / DAUER)
    ctx.set_source_rgba(*hexc("#212529"))
    ctx.set_line_width(5)
    ctx.move_to(560, SLAB_BOT)
    ctx.line_to(560 + 30 * riss, SLAB_BOT - 30 * riss)
    ctx.line_to(540 + 50 * riss, SLAB_BOT - 55 * riss)
    ctx.stroke()

def lampe(ctx, t):
    ctx.save()
    ctx.translate(400, SLAB_BOT)
    ctx.rotate(lampen_winkel(t))
    ctx.move_to(0, 0)
    ctx.line_to(0, 110)
    ctx.set_source_rgba(*hexc("#111111"))
    ctx.set_line_width(5)
    ctx.stroke()
    ctx.move_to(-60, 170)
    ctx.line_to(-28, 105)
    ctx.line_to(28, 105)
    ctx.line_to(60, 170)
    ctx.close_path()
    form(ctx, "#ffbe0b", 6)
    ctx.restore()

def staub(ctx, t):
    for ti, st, x in EVENTS:
        d = t - ti
        if not (0 <= d < 1.2) or st < 0.45:
            continue
        rnd = random.Random(int(ti * 1000))
        for _ in range(int(10 * st)):
            px = x + rnd.uniform(-120, 120) + rnd.uniform(-20, 20) * d
            py = SLAB_BOT + 5 + rnd.uniform(100, 380) * d + 260 * d * d
            ctx.arc(px, py, rnd.uniform(4, 9), 0, 2 * math.pi)
            ctx.set_source_rgba(0.45, 0.42, 0.4, clamp(1.2 - d))
            ctx.fill()

def bett(ctx, kopf_k, t, kissen_drauf=False):
    rrect(ctx, 70, 1560, 470, 110, 16)
    form(ctx, "#9c6644", 7)
    ctx.rectangle(80, 1660, 26, 36)
    ctx.rectangle(505, 1660, 26, 36)
    form(ctx, "#7f5539", 5)
    rrect(ctx, 60, 1450, 40, 230, 12)
    form(ctx, "#7f5539", 6)
    rrect(ctx, 100, 1505, 150, 70, 30)
    form(ctx, "#ffffff", 6)
    dy = -huepf(t, 90)
    kopf(ctx, 175, 1470 + dy, 64, kopf_k)
    if kissen_drauf:
        ctx.save()
        ctx.translate(175, 1405 + dy)
        ctx.rotate(-0.1 + 0.05 * math.sin(t * 9))
        rrect(ctx, -95, -40, 190, 70, 30)
        form(ctx, "#ffffff", 6)
        ctx.restore()
    # Decke
    ctx.move_to(215, 1530 + dy * 0.5)
    ctx.curve_to(300, 1470 + dy * 0.7, 420, 1490 + dy * 0.5, 540, 1500)
    ctx.line_to(540, 1590)
    ctx.line_to(215, 1590)
    ctx.close_path()
    form(ctx, "#e07a5f", 7)
    ctx.set_source_rgba(1, 1, 1, 0.35)
    for xx in range(250, 540, 60):
        ctx.arc(xx, 1555, 10, 0, 2 * math.pi)
        ctx.fill()

def bett_leer(ctx):
    rrect(ctx, 70, 1560, 470, 110, 16)
    form(ctx, "#9c6644", 7)
    ctx.rectangle(80, 1660, 26, 36)
    ctx.rectangle(505, 1660, 26, 36)
    form(ctx, "#7f5539", 5)
    rrect(ctx, 60, 1450, 40, 230, 12)
    form(ctx, "#7f5539", 6)
    rrect(ctx, 100, 1505, 150, 70, 30)
    form(ctx, "#ffffff", 6)
    rrect(ctx, 260, 1520, 280, 70, 20)
    form(ctx, "#e07a5f", 7)

def schreibtisch(ctx, t, buecher_hops=0.0, tasse=True):
    rrect(ctx, 700, 1500, 310, 26, 6)
    form(ctx, "#bc6c25", 6)
    ctx.rectangle(715, 1526, 22, 160)
    ctx.rectangle(970, 1526, 22, 160)
    form(ctx, "#99582a", 5)
    for i, (c, h) in enumerate((("#e63946", 40), ("#457b9d", 32), ("#ffb703", 36))):
        hop = buecher_hops * (1 if i % 2 else 0.6)
        rrect(ctx, 800, 1500 - sum(hh for _, hh in [("", 40), ("", 32), ("", 36)][:i + 1]) - hop * (i + 1), 150, h, 5)
        form(ctx, c, 5)
    if tasse:
        rrect(ctx, 735, 1440 - buecher_hops * 0.8, 50, 60, 8)
        form(ctx, "#ffffff", 5)

def stuhl(ctx):
    rrect(ctx, 520, 1540, 150, 22, 6)
    form(ctx, "#6c757d", 6)
    rrect(ctx, 510, 1380, 22, 180, 8)
    form(ctx, "#6c757d", 5)
    ctx.rectangle(585, 1562, 20, 120)
    form(ctx, "#495057", 5)

def besen(ctx, x, oben_y, liegt=False):
    ctx.save()
    if liegt:
        ctx.translate(x, oben_y)
        ctx.rotate(-math.pi / 2)
        ctx.translate(0, -400)
        oben_y = 0
        x = 0
    limb(ctx, [(x, oben_y), (x, oben_y + 400)], 12, "#bc6c25")
    rrect(ctx, x - 60, oben_y + 390, 120, 40, 10)
    form(ctx, "#e9c46a", 6)
    ctx.restore()

def sauger(ctx, x, y, t, aktiv=True):
    rnd = random.Random(int(t * FPS))
    j = rnd.uniform(-3, 3) if aktiv else 0
    rrect(ctx, x - 70, y - 90 + j, 140, 90, 30)
    form(ctx, "#4361ee", 7)
    ctx.arc(x - 40, y - 5, 16, 0, 2 * math.pi)
    form(ctx, "#111111", 3)
    ctx.arc(x + 40, y - 5, 16, 0, 2 * math.pi)
    form(ctx, "#111111", 3)

def sitzen(x, y, extra=None):
    d = p(DU_P, beine=(-1.45, 1.4, -1.35, 1.35), arme=(1.1, 0.4, 1.3, 0.3))
    if extra:
        d.update(extra)
    return d
