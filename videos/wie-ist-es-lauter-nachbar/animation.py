#!/usr/bin/env python3
"""Cartoon 'Wie ist es … einen LAUTEN Nachbarn zu haben?'

Zeichnet jeden Frame einzeln mit Cairo (Vektor, geglättet) und erzeugt die
Soundeffekte mit numpy. Alles ist eine reine Funktion der Zeit t, daher kann
in mehreren Prozessen parallel gerendert werden.

  python3 animation.py frames <start> <ende>   -> rohe BGRA-Frames auf stdout
  python3 animation.py ton tmp/ton.wav         -> Tonspur
  python3 animation.py bild <t> datei.png      -> Einzelbild (zum Prüfen)
"""
import math
import random
import sys
import wave

import cairo
import numpy as np

W, H, FPS = 1080, 1920, 30
DAUER = 29.0
FONT = "DejaVu Sans"

# Raum-Geometrie
X0, X1 = 40, 1040            # Innenwände
UP_TOP, UP_FLOOR = 300, 960  # oberes Zimmer
SLAB_BOT = 1030              # Unterkante Decke = Decke unten
LOW_FLOOR = 1700             # Boden unten

# Szenen: (start, name)
SZENEN = [(0.0, "hook"), (2.5, "rennt"), (7.5, "musik"), (12.5, "schreit"),
          (17.0, "saugt"), (21.5, "klopft"), (25.5, "ruhe")]


def szene(t):
    aktuell = SZENEN[0]
    for s in SZENEN:
        if t >= s[0]:
            aktuell = s
    return aktuell[1], t - aktuell[0]


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (a,)


def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def ease_back(x):
    x = clamp(x)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


# ---------------------------------------------------------------- Ereignisse
def nachbar_x_rennt(t):
    """Nachbar rennt im Dreieck zwischen 230 und 850 hin und her."""
    p = (t - 2.5) / 1.6
    f = p % 2
    return 230 + 620 * (f if f < 1 else 2 - f), (1 if f < 1 else -1)


def einschlaege():
    """(zeit, stärke, x) – jedes Stampfen/Beat/Klopfen erschüttert die Decke."""
    ev = []
    for k in range(4):                       # Hook: Springen
        ev.append((0.3 + 0.6 * k, 1.0, 540))
    t = 2.7
    while t < 7.4:                           # Rennen
        ev.append((t, 0.7, nachbar_x_rennt(t)[0]))
        t += 0.28
    t = 7.5
    while t < 12.45:                         # Musik-Beat
        ev.append((t, 0.35, 540))
        t += 0.5
    ev += [(13.0, 0.6, 540), (15.0, 0.6, 540)]   # Schreie
    ev += [(22.4, 0.5, 300), (22.8, 0.5, 300), (23.2, 0.5, 300)]  # Klopfen (von unten)
    ev.append((25.85, 1.4, 540))             # finales Stampfen
    return ev


EVENTS = einschlaege()


def erschuetterung(t):
    s = 0.0
    for ti, st, _ in EVENTS:
        if 0 <= t - ti < 0.4:
            s += st * math.exp(-12 * (t - ti))
    if 17.0 <= t < 23.3:                     # Staubsauger brummt
        s += 0.08
    return s


def kamera_wackeln(t):
    s = erschuetterung(t)
    rnd = random.Random(int(t * FPS))
    return (rnd.uniform(-1, 1) * 22 * s, rnd.uniform(-1, 1) * 22 * s)


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


# ---------------------------------------------------------------- Zeichnen
def text(ctx, s, x, y, size, fill="#ffffff", stroke="#111111", sw=None, scale=1.0,
         rot=0.0, maxw=None, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    ctx.save()
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(size)
    ext = ctx.text_extents(s)
    if maxw and ext.width > maxw:
        size *= maxw / ext.width
        ctx.set_font_size(size)
        ext = ctx.text_extents(s)
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.scale(scale, scale)
    ctx.move_to(-ext.width / 2 - ext.x_bearing, -ext.height / 2 - ext.y_bearing)
    ctx.text_path(s)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    if stroke:
        ctx.set_source_rgba(*hexc(stroke, alpha))
        ctx.set_line_width(sw if sw else size * 0.16)
        ctx.stroke_preserve()
    ctx.set_source_rgba(*hexc(fill, alpha))
    ctx.fill()
    ctx.restore()


def form(ctx, fill, lw=7, outline="#111111"):
    ctx.set_source_rgba(*hexc(fill) if isinstance(fill, str) else fill)
    ctx.fill_preserve()
    ctx.set_source_rgba(*hexc(outline))
    ctx.set_line_width(lw)
    ctx.stroke()


def rrect(ctx, x, y, w, h, r):
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    ctx.close_path()


def limb(ctx, pts, w, col):
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    for lw, c in ((w + 14, "#111111"), (w, col)):
        ctx.move_to(*pts[0])
        for p in pts[1:]:
            ctx.line_to(*p)
        ctx.set_source_rgba(*hexc(c))
        ctx.set_line_width(lw)
        ctx.stroke()


def gelenk(p, winkel, laenge):
    """Winkel 0 = nach unten, positiv = nach vorne (rechts)."""
    return (p[0] + laenge * math.sin(winkel), p[1] + laenge * math.cos(winkel))


def kopf(ctx, cx, cy, r, K):
    """K: haut, augen, mund, haare, haar_hoch, blick, brille, kappe, zucken"""
    ctx.save()
    ctx.translate(cx, cy)
    haut = K.get("haut", "#f2c39a")
    # Haare hinten (Stachelfrisur)
    if K.get("haare") == "stachel":
        hoch = 1 + 1.4 * K.get("haar_hoch", 0)
        ctx.move_to(-r * 0.95, -r * 0.2)
        n = 7
        for i in range(n + 1):
            a = math.pi + math.pi * i / n
            spitze = r * (1.0 + 0.45 * hoch) if i % 2 else r * 0.9
            ctx.line_to(spitze * math.cos(a + 0.12), spitze * math.sin(a + 0.12))
        ctx.close_path()
        form(ctx, K.get("haarfarbe", "#3b2a1a"))
    # Ohren + Kopf
    for sx in (-1, 1):
        ctx.arc(sx * r * 0.98, r * 0.1, r * 0.22, 0, 2 * math.pi)
        form(ctx, haut, 6)
    ctx.arc(0, 0, r, 0, 2 * math.pi)
    form(ctx, haut, 8)
    if K.get("stoppeln"):
        ctx.set_source_rgba(*hexc("#6b5545", 0.55))
        rnd = random.Random(3)
        for _ in range(60):
            a = rnd.uniform(0.15, math.pi - 0.15)
            rr = rnd.uniform(0.55, 0.92) * r
            ctx.arc(rr * math.cos(a), rr * math.sin(a), 2.6, 0, 2 * math.pi)
            ctx.fill()
    if K.get("kappe"):
        ctx.arc(0, -r * 0.15, r * 1.02, math.pi * 1.02, math.pi * 1.98)
        ctx.close_path()
        form(ctx, K["kappe"], 8)
        rrect(ctx, -r * 0.2, -r * 0.32, r * 1.45, r * 0.24, r * 0.1)
        form(ctx, K["kappe"], 7)
    # Augen
    augen = K.get("augen", "normal")
    bx, by = K.get("blick", (0, 0))
    for sx in (-1, 1):
        ex, ey = sx * r * 0.36, -r * 0.08
        if augen == "zu":
            ctx.arc(ex, ey, r * 0.17, 0.15 * math.pi, 0.85 * math.pi)
            ctx.set_source_rgba(*hexc("#111111"))
            ctx.set_line_width(7)
            ctx.stroke()
            continue
        er = r * (0.3 if augen == "weit" else 0.23)
        ctx.save()
        ctx.translate(ex, ey)
        ctx.scale(1, 1.15)
        ctx.arc(0, 0, er, 0, 2 * math.pi)
        ctx.restore()
        form(ctx, "#ffffff" if augen != "muede" else "#ffe3e3", 6)
        if augen == "muede":   # rote Äderchen
            ctx.set_source_rgba(*hexc("#e63946"))
            ctx.set_line_width(2.5)
            for k in range(3):
                a = 0.4 + k * 0.5
                ctx.move_to(ex + er * math.cos(a), ey + er * math.sin(a))
                ctx.line_to(ex + er * 0.5 * math.cos(a + 0.3), ey + er * 0.5 * math.sin(a + 0.3))
                ctx.stroke()
        pr = er * (0.32 if augen == "weit" else 0.48)
        ctx.arc(ex + bx * er * 0.45, ey + by * er * 0.45, pr, 0, 2 * math.pi)
        ctx.set_source_rgba(*hexc("#111111"))
        ctx.fill()
        ctx.arc(ex + bx * er * 0.45 + pr * 0.35, ey + by * er * 0.45 - pr * 0.35, pr * 0.3, 0, 2 * math.pi)
        ctx.set_source_rgba(1, 1, 1, 1)
        ctx.fill()
        if augen == "muede":   # halb geschlossenes Lid, zuckt
            lid = 0.15 + 0.5 * K.get("zucken", 0)
            ctx.save()
            ctx.translate(ex, ey)
            ctx.scale(1, 1.15)
            ctx.arc(0, 0, er + 2, math.pi, 2 * math.pi)
            ctx.line_to(er + 2, er * lid)
            ctx.line_to(-er - 2, er * lid)
            ctx.close_path()
            ctx.restore()
            form(ctx, haut, 6)
            ctx.set_source_rgba(*hexc("#6d597a", 0.6))
            ctx.set_line_width(5)
            ctx.arc(ex, ey + er * 0.2, er * 1.15, 0.2 * math.pi, 0.8 * math.pi)
            ctx.stroke()
        if augen == "wuetend":
            ctx.set_source_rgba(*hexc("#111111"))
            ctx.set_line_width(10)
            ctx.move_to(ex - sx * er * 1.1, ey - er * 1.6)
            ctx.line_to(ex + sx * er * 0.9, ey - er * 0.9)
            ctx.stroke()
    if K.get("brille"):
        ctx.set_source_rgba(*hexc("#111111"))
        ctx.set_line_width(6)
        for sx in (-1, 1):
            ctx.arc(sx * r * 0.36, -r * 0.08, r * 0.3, 0, 2 * math.pi)
            ctx.stroke()
        ctx.move_to(-r * 0.07, -r * 0.1)
        ctx.line_to(r * 0.07, -r * 0.1)
        ctx.stroke()
    # Mund
    mund = K.get("mund", 0.0)
    my = r * 0.45
    if isinstance(mund, str):
        ctx.set_source_rgba(*hexc("#111111"))
        ctx.set_line_width(7)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        if mund == "laecheln":
            ctx.arc(0, my - r * 0.18, r * 0.3, 0.2 * math.pi, 0.8 * math.pi)
        elif mund == "grinsen":
            ctx.arc(0, my - r * 0.25, r * 0.42, 0.15 * math.pi, 0.85 * math.pi)
        elif mund == "sauer":
            ctx.arc(0, my + r * 0.18, r * 0.25, 1.2 * math.pi, 1.8 * math.pi)
        else:  # gerade / zickzack
            ctx.move_to(-r * 0.25, my)
            for i in range(1, 7):
                ctx.line_to(-r * 0.25 + i * r * 0.5 / 6, my + (5 if i % 2 else -5))
        ctx.stroke()
    else:
        mh = r * (0.08 + 0.55 * mund)
        mw = r * (0.25 + 0.25 * mund)
        ctx.save()
        ctx.translate(0, my + mh * 0.3)
        ctx.scale(mw, mh)
        ctx.arc(0, 0, 1, 0, 2 * math.pi)
        ctx.restore()
        form(ctx, "#5a1010", 7)
        if mund > 0.3:
            ctx.save()
            ctx.translate(0, my + mh * 0.85)
            ctx.scale(mw * 0.6, mh * 0.35)
            ctx.arc(0, 0, 1, 0, 2 * math.pi)
            ctx.restore()
            ctx.set_source_rgba(*hexc("#ff6b81"))
            ctx.fill()
            ctx.rectangle(-mw * 0.6, my + mh * 0.3 - mh * 0.95, mw * 1.2, mh * 0.25)
            ctx.set_source_rgba(1, 1, 1, 1)
            ctx.fill()
    ctx.restore()


def person(ctx, x, y, s, P, K):
    """Figur mit Füßen bei (x, y). P = Pose (Winkel in Rad), K = Kopf."""
    ctx.save()
    ctx.translate(x, y - P.get("hoch", 0))
    ctx.scale(s * (-1 if P.get("links") else 1), s)
    hemd, hose = P.get("hemd", "#2a9d8f"), P.get("hose", "#264653")
    huefte = (0, -160)
    beine = P.get("beine", (0.08, 0, -0.08, 0))
    for i, sx in ((0, -1), (2, 1)):
        h = (huefte[0] + sx * 22, huefte[1])
        knie = gelenk(h, beine[i], 84)
        fuss = gelenk(knie, beine[i] - abs(beine[i + 1]), 80)
        limb(ctx, [h, knie, fuss], 36, hose)
        ctx.save()
        ctx.translate(fuss[0] + 14, fuss[1] + 6)
        ctx.scale(1.0, 0.55)
        ctx.arc(0, 0, 30, 0, 2 * math.pi)
        ctx.restore()
        form(ctx, P.get("schuh", "#e9ecef"), 6)
    # Oberkörper (kippt um die Hüfte)
    ctx.translate(*huefte)
    ctx.rotate(P.get("neigung", 0))
    ctx.translate(-huefte[0], -huefte[1])
    arme = P.get("arme", (0.15, 0.2, -0.15, -0.2))
    schulter = [(-52, -282), (52, -282)]

    def arm(i, sx):
        sh = schulter[(i // 2)]
        ell = gelenk(sh, arme[i], 72)
        hand = gelenk(ell, arme[i] + arme[i + 1], 66)
        limb(ctx, [sh, ell, hand], 28, hemd)
        ctx.arc(*hand, 20, 0, 2 * math.pi)
        form(ctx, K.get("haut", "#f2c39a"), 6)
        return hand

    hand_hinten = arm(0, -1)
    rrect(ctx, -62, -305, 124, 160, 38)
    form(ctx, hemd, 8)
    if P.get("aufdruck"):
        ctx.save()
        ctx.translate(0, -228)
        ctx.scale(-1 if P.get("links") else 1, 1)
        text(ctx, P["aufdruck"], 0, 0, 40, fill="#ffffff", stroke=None)
        ctx.restore()
    ctx.move_to(0, -305)
    ctx.line_to(0, -322)
    ctx.set_line_width(26)
    ctx.set_source_rgba(*hexc(K.get("haut", "#f2c39a")))
    ctx.stroke()
    hand_vorne = arm(2, 1)
    kopf(ctx, 0, -380, 74, K)
    hv, hh = ctx.user_to_device(*hand_vorne), ctx.user_to_device(*hand_hinten)
    ctx.restore()
    return ctx.device_to_user(*hv), ctx.device_to_user(*hh)


# ---------------------------------------------------------------- Kulissen
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
    uhr = {"hook": "07:00", "rennt": "07:00", "musik": "14:00", "schreit": "20:00",
           "saugt": "03:00", "klopft": "03:01", "ruhe": "03:02"}[szene(t)[0]]
    rrect(ctx, 470, 1100, 160, 70, 14)
    form(ctx, "#222831", 6)
    text(ctx, uhr, 550, 1136, 42, fill="#ff4d6d", stroke=None)
    ctx.rectangle(X0, LOW_FLOOR - 24, X1 - X0, 24)
    form(ctx, "#b08968", 5)


def fenster(ctx, x, y, w, h, nacht):
    rrect(ctx, x, y, w, h, 8)
    if nacht:
        ctx.set_source_rgba(*hexc("#1d3557"))
    else:
        ctx.set_source_rgba(*hexc("#8ecae6"))
    ctx.fill_preserve()
    ctx.set_source_rgba(*hexc("#ffffff"))
    ctx.set_line_width(14)
    ctx.stroke()
    if nacht:
        ctx.arc(x + w * 0.7, y + h * 0.35, 28, 0, 2 * math.pi)
        ctx.set_source_rgba(*hexc("#ffe8a3"))
        ctx.fill()
        ctx.arc(x + w * 0.7 + 14, y + h * 0.35 - 8, 24, 0, 2 * math.pi)
        ctx.set_source_rgba(*hexc("#1d3557"))
        ctx.fill()
    else:
        ctx.arc(x + w * 0.3, y + h * 0.6, 26, 0, 2 * math.pi)
        ctx.arc(x + w * 0.45, y + h * 0.5, 32, 0, 2 * math.pi)
        ctx.set_source_rgba(1, 1, 1, 0.9)
        ctx.fill()
    ctx.move_to(x + w / 2, y)
    ctx.line_to(x + w / 2, y + h)
    ctx.move_to(x, y + h / 2)
    ctx.line_to(x + w, y + h / 2)
    ctx.set_source_rgba(1, 1, 1, 1)
    ctx.set_line_width(8)
    ctx.stroke()


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
    riss = clamp(t / 26)
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


def sfx_bumm(ctx, t, worte, oben=False):
    """Comic-Wörter an Einschlagstellen: unter der Decke."""
    for i, (ti, st, x) in enumerate(EVENTS):
        d = t - ti
        if 0 <= d < 0.45 and st >= 0.5:
            wort = worte[i % len(worte)]
            sc = ease_back(d / 0.12) * (1 + 0.15 * st)
            y = SLAB_BOT + 70 + (i % 2) * 40
            text(ctx, wort, clamp(x, 170, 910), y, 78, fill="#ffd60a",
                 scale=sc, rot=-0.12 + 0.24 * (i % 2), alpha=clamp((0.45 - d) * 5))


# ---------------------------------------------------------------- Figuren-Posen
NACHBAR_K = {"haut": "#e0a77a", "kappe": "#d62828", "stoppeln": True}
NACHBAR_P = {"hemd": "#f77f00", "hose": "#3d405b", "schuh": "#fcbf49", "aufdruck": "XXL"}
DU_K = {"haut": "#f2c39a", "haare": "stachel", "brille": True, "haarfarbe": "#5c3d2e"}
DU_P = {"hemd": "#2a9d8f", "hose": "#264653", "schuh": "#e9ecef"}


def p(base, **kw):
    d = dict(base)
    d.update(kw)
    return d


def zeichne_nachbar(ctx, t, name, lt):
    y = UP_FLOOR - 18
    s = 1.0
    if name == "hook":
        ph = (t % 0.6) / 0.6
        hoch = 170 * math.sin(math.pi * ph)
        arm = 2.6 if ph < 0.5 else 2.2
        person(ctx, 540, y, s, p(NACHBAR_P, hoch=hoch, beine=(0.3, 0.5, -0.3, 0.5) if hoch > 20 else (0.15, 0, -0.15, 0),
                                 arme=(-arm, -0.3, arm, 0.3)),
               p(NACHBAR_K, mund=0.7, augen="weit", blick=(0, -0.5)))
    elif name == "rennt":
        x, richtung = nachbar_x_rennt(t)
        ph = t / 0.56 * 2 * math.pi
        sw = math.sin(ph)
        person(ctx, x, y, s, p(NACHBAR_P, links=richtung < 0, hoch=18 * abs(math.cos(ph)),
                               neigung=0.18, beine=(0.75 * sw, 0.9 * max(0, -sw) + 0.2, -0.75 * sw, 0.9 * max(0, sw) + 0.2),
                               arme=(-0.9 * sw, 1.2, 0.9 * sw, 1.2)),
               p(NACHBAR_K, mund=0.45, augen="weit", blick=(1, 0)))
    elif name == "musik":
        lautsprecher(ctx, 150, t)
        lautsprecher(ctx, 930, t)
        b = (t - 7.5) / 0.5 * math.pi
        person(ctx, 540 + 60 * math.sin(b / 2), y, s,
               p(NACHBAR_P, hoch=25 * abs(math.sin(b)), neigung=0.25 * math.sin(b / 2),
                 beine=(0.35 * math.sin(b), 0.5, -0.35 * math.sin(b), 0.5),
                 arme=(-2.7 + 0.4 * math.sin(b), -0.5, 2.7 - 0.4 * math.cos(b), 0.5)),
               p(NACHBAR_K, mund="grinsen", augen="zu"))
    elif name == "schreit":
        rnd = random.Random(int(t * FPS))
        schreien = (13.0 <= t < 14.4) or (15.0 <= t < 16.7)
        jx = rnd.uniform(-8, 8) if schreien else 0
        person(ctx, 540 + jx, y, 1.05,
               p(NACHBAR_P, arme=(-2.4, -0.6, 2.4, 0.6) if schreien else (0.3, 1.6, -0.3, -1.6),
                 neigung=-0.1 if schreien else 0),
               p(NACHBAR_K, mund=1.0 if schreien else "grinsen", augen="wuetend" if schreien else "normal"))
        if schreien:
            st = 13.0 if t < 14.4 else 15.0
            sc = ease_back((t - st) / 0.15)
            sprechblase(ctx, 760 + jx, 430, "AAAAAH!!", sc, rnd.uniform(-0.06, 0.06))
    elif name in ("saugt", "klopft", "ruhe"):
        if name == "saugt" or (name == "klopft" and t < 23.3):
            vx = 540 + 250 * math.sin((t - 17) * 2.2)
            richtung = math.cos((t - 17) * 2.2)
        else:
            vx, richtung = 540 + 250 * math.sin((23.3 - 17) * 2.2), 1
        frozen = t >= 23.3
        stampf = name == "ruhe" and 25.5 <= t < 25.85
        bein = (0.1, 0, -0.1, 0)
        if stampf:
            bein = (0.1, 0, -1.2 * (t - 25.5) / 0.35 - 0.2, 1.6)
        elif name == "ruhe" and t < 26.0:
            bein = (0.1, 0, -0.1, 0)
        hand, _ = None, None
        kk = p(NACHBAR_K, mund="laecheln", augen="zu")
        if frozen:
            kk = p(NACHBAR_K, mund=0.15, augen="weit", blick=(0, 1))
        if name == "ruhe" and t >= 25.6:
            kk = p(NACHBAR_K, mund=0.9 + 0.1 * math.sin(t * 40), augen="wuetend", blick=(0, 1))
        dirn = 1 if richtung >= 0 else -1
        sx_ = vx + 210 * dirn
        sauger(ctx, sx_, UP_FLOOR - 20, t, aktiv=not frozen)
        hand, _ = person(ctx, vx, y, 1.0, p(NACHBAR_P, links=richtung < 0, beine=bein,
                                            arme=(0.2, 0.3, 0.9, 0.3), neigung=0.1 if not frozen else 0), kk)
        ctx.move_to(*hand)
        ctx.curve_to(hand[0] + 80 * dirn, hand[1] + 40, sx_ - 120 * dirn, UP_FLOOR - 40, sx_ - 60 * dirn, UP_FLOOR - 70)
        ctx.set_source_rgba(*hexc("#111111"))
        ctx.set_line_width(22)
        ctx.stroke_preserve()
        ctx.set_source_rgba(*hexc("#7b8794"))
        ctx.set_line_width(12)
        ctx.stroke()
        if not frozen:
            rnd = random.Random(int(t * FPS))
            text(ctx, "WRRRRR", clamp(sx_, 230, 850), UP_FLOOR - 170 + rnd.uniform(-6, 6), 70,
                 fill="#4cc9f0", rot=rnd.uniform(-0.08, 0.08))
        if frozen and name == "klopft":
            text(ctx, "?", vx, 470 - 12 * math.sin(t * 6), 120, fill="#ffffff", scale=ease_back((t - 23.5) / 0.2))
        if name == "ruhe" and t >= 25.9:
            rnd = random.Random(int(t * FPS))
            sprechblase(ctx, 600, 420, "RUHE DA UNTEN!!", ease_back((t - 25.9) / 0.15), rnd.uniform(-0.05, 0.05))


def lautsprecher(ctx, cx, t):
    b = (t - 7.5) % 0.5
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
    # Schallwellen
    for k in range(3):
        r = 100 + ((t * 300 + k * 90) % 270)
        ctx.arc(cx, UP_FLOOR - 220, r, -0.7 if cx > 540 else math.pi - 0.7, 0.7 if cx > 540 else math.pi + 0.7)
        ctx.set_source_rgba(1, 1, 1, clamp(1 - (r - 100) / 270) * 0.8)
        ctx.set_line_width(8)
        ctx.stroke()


def sauger(ctx, x, y, t, aktiv=True):
    rnd = random.Random(int(t * FPS))
    j = rnd.uniform(-3, 3) if aktiv else 0
    rrect(ctx, x - 70, y - 90 + j, 140, 90, 30)
    form(ctx, "#4361ee", 7)
    ctx.arc(x - 40, y - 5, 16, 0, 2 * math.pi)
    form(ctx, "#111111", 3)
    ctx.arc(x + 40, y - 5, 16, 0, 2 * math.pi)
    form(ctx, "#111111", 3)


def sprechblase(ctx, x, y, s, sc, rot):
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.scale(sc, sc)
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(66)
    w = min(ctx.text_extents(s).width + 70, 560)
    rrect(ctx, -w / 2, -60, w, 120, 50)
    ctx.move_to(-40, 55)
    ctx.line_to(-90, 140)
    ctx.line_to(10, 58)
    form(ctx, "#ffffff", 8)
    rrect(ctx, -w / 2 + 4, -56, w - 8, 112, 48)
    ctx.set_source_rgba(1, 1, 1, 1)
    ctx.fill()
    text(ctx, s, 0, 0, 66, fill="#d62828", stroke=None, maxw=w - 50)
    ctx.restore()


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


def sitzen(x, y, extra=None):
    d = p(DU_P, beine=(-1.45, 1.4, -1.35, 1.35), arme=(1.1, 0.4, 1.3, 0.3))
    if extra:
        d.update(extra)
    return d


def zeichne_du(ctx, t, name, lt):
    if name in ("hook", "rennt"):
        b = huepf(t, 1)
        bett(ctx, p(DU_K, augen="weit", mund=0.35 + 0.4 * clamp(b), haar_hoch=clamp(b * 1.5),
                    blick=(0, -1)), t)
        if name == "hook":
            text(ctx, "?!", 300, 1360 - 30 * b, 90, fill="#ffffff", scale=ease_back(t / 0.3))
    elif name == "musik":
        b = (t - 7.5) % 0.5
        nick = 0.15 * math.exp(-8 * b)
        stuhl(ctx)
        person(ctx, 600, LOW_FLOOR - 18 - 1560 + 1690 - 130, 1.0,
               sitzen(600, 0, {"neigung": 0.12 + nick}),
               p(DU_K, augen="muede", mund="sauer", blick=(0.3, 0.6), zucken=0.0))
        schreibtisch(ctx, t, buecher_hops=40 * math.exp(-10 * b))
        noten(ctx, t)
    elif name == "schreit":
        stuhl(ctx)
        sprung = 0
        if 13.0 <= t < 13.7:
            sprung = 45 * math.sin(math.pi * (t - 13.0) / 0.7)
        haar = 1.0 if t >= 13.0 else 0
        ohren = t >= 14.9
        arme = (1.1, 0.4, 1.3, 0.3)
        if 13.0 <= t < 13.7:
            arme = (-2.5, -0.3, 2.5, 0.3)
        if ohren:
            arme = (-2.2, -2.2, 2.2, 2.2)
        person(ctx, 600, LOW_FLOOR - 148 - sprung, 1.0,
               sitzen(600, 0, {"arme": arme}),
               p(DU_K, augen="weit" if t >= 13.0 else "normal", mund=0.6 if t >= 13.0 else "gerade",
                 haar_hoch=haar, blick=(0, -1)))
        schreibtisch(ctx, t, tasse=t < 13.0)
        if t >= 13.0:   # Tasse fliegt und zerbricht
            d = t - 13.0
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
                    text(ctx, "KLIRR!", 960, LOW_FLOOR - 120, 62, fill="#ffffff",
                         scale=ease_back((d - 0.9) / 0.12))
    elif name == "saugt":
        zuck = 1.0 if (int(t * 6) % 3 == 0) else 0.0
        bett(ctx, p(DU_K, augen="muede", mund="gerade", zucken=zuck), t, kissen_drauf=True)
    elif name in ("klopft", "ruhe"):
        bett_leer(ctx)
        if name == "klopft":
            hoch = 0.0
            for kt in (22.4, 22.8, 23.2):
                if kt - 0.2 <= t < kt + 0.15:
                    hoch = 1 - abs(t - kt) / 0.2
            hoch = clamp(hoch)
            grab = ease_out((t - 21.5) / 0.3)
            stiel_y = SLAB_BOT + 15 + (1 - hoch) * 90 + (1 - grab) * 200
            satt = t >= 23.7
            hand, hand2 = person(ctx, 330, LOW_FLOOR - 18 - 40 * hoch, 1.0,
                                 p(DU_P, arme=(-2.9 + 0.2 * hoch, 0.0, 2.9 - 0.2 * hoch, 0.0) if not satt else (0.7, 1.9, -0.7, -1.9),
                                   beine=(0.12, 0, -0.12, 0)),
                                 p(DU_K, augen="wuetend" if not satt else "zu",
                                   mund="sauer" if not satt else "grinsen", blick=(0, -1)))
            if not satt:
                besen(ctx, hand[0], stiel_y)
        else:
            schock = t >= 25.9
            person(ctx, 330, LOW_FLOOR - 18 - (40 * math.exp(-8 * (t - 25.9)) if schock else 0), 1.0,
                   p(DU_P, arme=(0.4, 0.3, -0.4, -0.3) if schock else (0.7, 1.9, -0.7, -1.9)),
                   p(DU_K, augen="weit" if schock else "zu", mund=0.95 if schock else "grinsen",
                     haar_hoch=1.0 if schock else 0, blick=(0, -1)))
            besen(ctx, 470, LOW_FLOOR - 10, liegt=True)
        if name == "klopft":
            for kt in (22.4, 22.8, 23.2):
                d = t - kt
                if 0 <= d < 0.35:
                    text(ctx, "KLOPF!", 330 + (kt - 22.8) * 400, SLAB_BOT + 70, 70, fill="#ffd60a",
                         scale=ease_back(d / 0.1), rot=(kt - 22.8) * 0.5)


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


def noten(ctx, t):
    for k in range(9):
        start = 7.5 + k * 0.55
        d = (t - start) % 4.9
        if t < start:
            continue
        x = 150 + (k * 137) % 800 + 40 * math.sin(d * 4 + k)
        y = SLAB_BOT + 20 + d * 150
        if y > LOW_FLOOR - 60:
            continue
        text(ctx, "♪" if k % 2 else "♫", x, y, 80, fill="#7209b7", stroke="#ffffff", sw=8,
             rot=0.3 * math.sin(d * 5), alpha=clamp(2 - d * 0.5))


# ---------------------------------------------------------------- Banner + Untertitel
BANNER = {
    "hook": (None, "WIE IST ES …"),
    "rennt": ("07:00", "ER RENNT."),
    "musik": ("14:00", "MUSIK AUF 100."),
    "schreit": ("20:00", "ER SCHREIT."),
    "saugt": ("03:00", "ER SAUGT STAUB."),
    "klopft": ("03:01", "JETZT REICHT'S."),
    "ruhe": ("03:02", "… WAS?!"),
}
UNTERTITEL = {
    "hook": "Kennst du das?",
    "rennt": "Jeden. Morgen.",
    "musik": "Ich will nur lernen …",
    "schreit": "Was ist da oben LOS?!",
    "saugt": "Es ist 3 Uhr nachts.",
    "klopft": "",
    "ruhe": "",
}


def banner(ctx, t, name, lt, nacht):
    g = cairo.LinearGradient(0, 0, 0, UP_TOP)
    if nacht:
        g.add_color_stop_rgb(0, *hexc("#0b132b")[:3])
        g.add_color_stop_rgb(1, *hexc("#1c2541")[:3])
    else:
        g.add_color_stop_rgb(0, *hexc("#48cae4")[:3])
        g.add_color_stop_rgb(1, *hexc("#90e0ef")[:3])
    ctx.rectangle(0, 0, W, UP_TOP)
    ctx.set_source(g)
    ctx.fill()
    if nacht:
        rnd = random.Random(5)
        for _ in range(40):
            ctx.arc(rnd.uniform(0, W), rnd.uniform(0, UP_TOP - 80), rnd.uniform(1.5, 4), 0, 2 * math.pi)
            ctx.set_source_rgba(1, 1, 1, 0.5 + 0.5 * math.sin(t * 3 + rnd.uniform(0, 6)))
            ctx.fill()
    # Dach
    ctx.move_to(-20, UP_TOP)
    ctx.line_to(W / 2, UP_TOP - 70)
    ctx.line_to(W + 20, UP_TOP)
    ctx.close_path()
    form(ctx, "#9d0208", 8)
    uhr, titel = BANNER[name]
    sc = ease_back(lt / 0.25) if name != "hook" else 0.85 + 0.15 * ease_back(lt / 0.25)
    if name == "hook":
        text(ctx, "WIE IST ES …", W / 2, 85, 100, fill="#ffffff", scale=sc,
             rot=0.03 * math.sin(t * 8))
        sc2 = 0.85 + 0.15 * ease_back((lt - 0.1) / 0.25)
        text(ctx, "einen LAUTEN Nachbarn zu haben?", W / 2, 180, 58, fill="#ffd60a", scale=sc2,
             maxw=1000, rot=-0.02 * math.sin(t * 8))
    else:
        rrect(ctx, 40, 50, 230, 110, 24)
        form(ctx, "#222831", 7)
        text(ctx, uhr, 155, 105, 70, fill="#ff4d6d", stroke=None, scale=ease_back(lt / 0.2))
        text(ctx, titel, 660, 110, 92, fill="#ffffff", scale=sc, maxw=740,
             rot=0.025 * math.sin(t * 10))


def untertitel(ctx, t, name, lt):
    ctx.rectangle(0, LOW_FLOOR, W, H - LOW_FLOOR)
    ctx.set_source_rgba(*hexc("#3a3a3a"))
    ctx.fill()
    ctx.rectangle(0, LOW_FLOOR, W, 16)
    ctx.set_source_rgba(*hexc("#5c5c5c"))
    ctx.fill()
    s = UNTERTITEL[name]
    if name == "klopft" and t >= 23.6:
        s, lt = "Endlich Ruhe …", t - 23.6
    if name == "ruhe" and t >= 26.4:
        s, lt = "Markier deinen Nachbarn!", t - 26.4
    if s:
        text(ctx, s, W / 2, 1810, 76, fill="#ffffff", sw=12, scale=ease_back(lt / 0.2), maxw=980)


# ---------------------------------------------------------------- Frame
def frame(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    name, lt = szene(t)
    nacht = name in ("saugt", "klopft", "ruhe")
    ctx.set_source_rgb(0.1, 0.1, 0.1)
    ctx.paint()
    ctx.save()
    # Zoom-Punch beim finalen Stampfen / Hook
    zoom = 1.0
    if 25.85 <= t < 26.6:
        zoom = 1 + 0.08 * math.exp(-5 * (t - 25.85))
    ctx.translate(W / 2, H / 2)
    ctx.scale(zoom, zoom)
    ctx.translate(-W / 2, -H / 2)
    banner(ctx, t, name, lt, nacht)
    dx, dy = kamera_wackeln(t)
    ctx.save()
    ctx.translate(dx, dy)
    # Hauswände
    ctx.rectangle(0, UP_TOP, W, LOW_FLOOR - UP_TOP)
    ctx.set_source_rgba(*hexc("#bc4749"))
    ctx.fill()
    zimmer_oben(ctx, t, nacht)
    zeichne_nachbar(ctx, t, name, lt)
    zimmer_unten(ctx, t, nacht)
    lampe(ctx, t)
    zeichne_du(ctx, t, name, lt)
    decke(ctx, t)
    staub(ctx, t)
    if name in ("hook", "rennt"):
        sfx_bumm(ctx, t, ["BUMM!", "WUMMS!", "BUMM!", "POLTER!"])
    if name == "musik" and (t - 7.5) % 1.0 < 0.2:
        text(ctx, "WUMM", 820, SLAB_BOT + 80, 70, fill="#f72585", scale=ease_back(((t - 7.5) % 1.0) / 0.1))
    if name == "ruhe" and 25.85 <= t < 26.6:
        text(ctx, "BUMM!!!", 540, SLAB_BOT + 110, 130, fill="#ff006e", scale=ease_back((t - 25.85) / 0.12))
    if nacht:
        ctx.rectangle(0, UP_TOP, W, LOW_FLOOR - UP_TOP)
        ctx.set_source_rgba(0.05, 0.08, 0.25, 0.38)
        ctx.fill()
        # Lichtkegel der Lampe unten (Licht an bei klopfen/ruhe)
    ctx.restore()
    untertitel(ctx, t, name, lt)
    ctx.restore()
    # Weißer Blitz bei Szenenwechsel
    for s, _ in SZENEN[1:]:
        if 0 <= t - s < 0.12:
            ctx.set_source_rgba(1, 1, 1, 0.6 * (1 - (t - s) / 0.12))
            ctx.paint()
    return surf


# ---------------------------------------------------------------- Ton
SR = 44100


def ton(pfad):
    n = int(DAUER * SR)
    a = np.zeros(n)
    rng = np.random.default_rng(1)

    def add(start, sig):
        i = int(start * SR)
        e = min(n, i + len(sig))
        if i < n:
            a[i:e] += sig[:e - i]

    def lowpass(x, cutoff):
        alpha = 1 - math.exp(-2 * math.pi * cutoff / SR)
        y = np.zeros_like(x)
        acc = 0.0
        for k in range(len(x)):
            acc += alpha * (x[k] - acc)
            y[k] = acc
        return y

    def thump(st):
        tt = np.arange(int(0.35 * SR)) / SR
        f = 45 + 70 * np.exp(-25 * tt)
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-9 * tt)
        sig += 0.3 * lowpass(rng.uniform(-1, 1, len(tt)), 300) * np.exp(-20 * tt)
        return 0.9 * st * sig

    for ti, st, _ in EVENTS:
        if 7.5 <= ti < 12.5:
            continue
        if 22.3 <= ti < 23.3:   # Klopfen: hölzern
            tt = np.arange(int(0.15 * SR)) / SR
            add(ti, 0.7 * np.sin(2 * np.pi * 420 * tt) * np.exp(-40 * tt) +
                0.3 * rng.uniform(-1, 1, len(tt)) * np.exp(-80 * tt))
            continue
        add(ti, thump(min(st, 1.2)))
    # Musik durch die Decke (gedämpft)
    tt = np.arange(int(5.0 * SR)) / SR
    noten_hz = [55, 55, 65.4, 49]
    bass = np.zeros(len(tt))
    for k in range(10):
        s0 = int(k * 0.5 * SR)
        seg = np.arange(int(0.5 * SR)) / SR
        f = noten_hz[(k // 2) % 4]
        kick = np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-30 * seg)) / SR) * np.exp(-8 * seg)
        b = 0.5 * np.sign(np.sin(2 * np.pi * f * seg)) * np.exp(-2 * seg)
        bass[s0:s0 + len(seg)] += (kick + b)[:len(bass) - s0]
    add(7.5, 0.6 * lowpass(bass, 400))
    # Schreie (gedämpft, Sägezahn mit Vibrato)
    for s0, d in ((13.0, 1.4), (15.0, 1.7)):
        tt = np.arange(int(d * SR)) / SR
        f = 320 + 40 * np.sin(2 * np.pi * 7 * tt) + 60 * tt
        ph = np.cumsum(f) / SR
        saw = 2 * (ph % 1) - 1
        env = np.minimum(1, tt * 20) * np.minimum(1, (d - tt) * 6)
        add(s0, 0.45 * lowpass(saw * env, 1400))
    # Staubsauger
    tt = np.arange(int(6.3 * SR)) / SR
    vac = lowpass(rng.uniform(-1, 1, len(tt)), 2500) * 0.5 + 0.3 * np.sin(2 * np.pi * 120 * tt)
    vac *= 0.35 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.35 * tt)) * np.minimum(1, tt * 4)
    vac[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
    add(17.0, vac)
    # Tasse: Pfeifen + Klirren
    tt = np.arange(int(0.9 * SR)) / SR
    add(13.0, 0.25 * np.sin(2 * np.pi * np.cumsum(1200 - 900 * tt) / SR))
    tt = np.arange(int(0.4 * SR)) / SR
    klirr = sum(np.sin(2 * np.pi * f * tt) for f in (2300, 3100, 4200)) * np.exp(-12 * tt) / 3
    add(13.9, 0.5 * klirr + 0.2 * rng.uniform(-1, 1, len(tt)) * np.exp(-30 * tt))
    # "RUHE DA UNTEN" Brüllen
    tt = np.arange(int(1.5 * SR)) / SR
    f = 180 + 30 * np.sin(2 * np.pi * 5 * tt)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    env = np.minimum(1, tt * 15) * np.minimum(1, (1.5 - tt) * 4) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 2.2 * tt)))
    add(25.95, 0.5 * lowpass(saw * env, 1000))
    # Pop-Sounds bei Szenenwechsel
    for s, _ in SZENEN:
        tt = np.arange(int(0.12 * SR)) / SR
        add(s, 0.25 * np.sin(2 * np.pi * np.cumsum(500 + 2500 * tt / 0.12) / SR) * np.exp(-15 * tt))
    a = a / max(1e-9, np.max(np.abs(a))) * 0.89
    pcm = (a * 32767).astype(np.int16)
    with wave.open(pfad, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "frames":
        a, b = int(sys.argv[2]), int(sys.argv[3])
        out = sys.stdout.buffer
        for i in range(a, b):
            out.write(frame(i / FPS).get_data())
    elif cmd == "bild":
        frame(float(sys.argv[2])).write_to_png(sys.argv[3])
    elif cmd == "ton":
        ton(sys.argv[2])
