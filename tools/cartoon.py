"""Cartoon-Baukasten fürs KI-Video-Büro (Cairo).

Figuren mit Gelenken (person), Köpfe mit Mimik (kopf), Text mit Rand (text),
Sprechblasen mit Schreibmaschinen-Effekt (blase), Übergänge (uebergang) und
Ton-Helfer (lowpass, babbeln). Alles ist eine reine Funktion der Zeit.
"""
import math
import random

import cairo
import numpy as np

W, H, FPS, SR = 1080, 1920, 30, 44100
FONT = "DejaVu Sans"


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


# ---------------------------------------------------------------- Dialog
def umbrechen(ctx, s, size, maxw):
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(size)
    zeilen, akt = [], ""
    for wort in s.split():
        probe = (akt + " " + wort).strip()
        if ctx.text_extents(probe).x_advance <= maxw or not akt:
            akt = probe
        else:
            zeilen.append(akt)
            akt = wort
    zeilen.append(akt)
    return zeilen


def sichtbar(lt, s, cps=24):
    """Schreibmaschinen-Effekt: wie viele Zeichen sind nach lt Sekunden zu sehen."""
    return int(clamp(lt * cps / max(1, len(s))) * len(s))


def blase(ctx, cx, top, s, n, ziel, size=50, maxw=860, farbe="#111111", rand="#111111",
          sc=1.0, rot=0.0, schrei=False):
    """Sprechblase oben-mittig bei (cx, top), Schwanz zeigt auf ziel. n = sichtbare Zeichen."""
    zeilen = umbrechen(ctx, s, size, maxw - 60)
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(size)
    bw = max(ctx.text_extents(z).x_advance for z in zeilen) + 70
    lh = size * 1.22
    bh = lh * len(zeilen) + 44
    cx = clamp(cx, 50 + bw / 2, W - 50 - bw / 2)
    ctx.save()
    ctx.translate(cx, top + bh / 2)
    ctx.rotate(rot)
    ctx.scale(sc, sc)
    zx, zy = ziel[0] - cx, ziel[1] - (top + bh / 2)
    # Schwanz
    bx = clamp(zx * 0.5, -bw / 2 + 50, bw / 2 - 50)
    by = bh / 2 - 4 if zy > 0 else -bh / 2 + 4
    lz = math.hypot(zx - bx, zy - by)
    k = min(1.0, 70 / max(1, lz)) if lz > 0 else 0
    tip = (bx + (zx - bx) * k * 1.6, by + (zy - by) * k * 1.6) if lz > 0 else (bx, by + 60)
    if schrei:
        ctx.new_path()
        n_z = 22
        for i in range(n_z):
            a = 2 * math.pi * i / n_z
            r = 1.0 if i % 2 == 0 else 1.13
            px, py = (bw / 2 + 10) * r * math.cos(a), (bh / 2 + 10) * r * math.sin(a)
            ctx.line_to(px, py)
        ctx.close_path()
    else:
        rrect(ctx, -bw / 2, -bh / 2, bw, bh, min(40, bh / 2))
    ctx.move_to(bx - 28, by)
    ctx.line_to(*tip)
    ctx.line_to(bx + 28, by)
    form(ctx, "#ffffff", 8, rand)
    if schrei:
        pass
    else:
        rrect(ctx, -bw / 2 + 4, -bh / 2 + 4, bw - 8, bh - 8, min(36, bh / 2 - 4))
        ctx.set_source_rgba(1, 1, 1, 1)
        ctx.fill()
    rest = n
    y = -bh / 2 + 22 + lh / 2
    for z in zeilen:
        teil = z[:max(0, rest)]
        rest -= len(z) + 1
        if teil:
            ctx.set_font_size(size)
            breite = ctx.text_extents(z).x_advance
            ctx.move_to(-breite / 2, y + size * 0.36)
            ctx.text_path(teil)
            ctx.set_source_rgba(*hexc(farbe))
            ctx.fill()
        y += lh
    ctx.restore()


def untertitel_box(ctx, sprecher, s, n, y=1640, farbe="#ffd60a"):
    """TikTok-Untertitel für POV-Szenen: 'ICH: …' mit Schreibmaschinen-Effekt."""
    zeilen = umbrechen(ctx, s, 62, 900)
    lh = 76
    hoehe = lh * len(zeilen) + 90
    rrect(ctx, 40, y - hoehe / 2, W - 80, hoehe, 30)
    ctx.set_source_rgba(0, 0, 0, 0.62)
    ctx.fill()
    text(ctx, sprecher, W / 2, y - hoehe / 2 + 32, 38, fill=farbe, stroke=None)
    rest = n
    yy = y - hoehe / 2 + 88 + lh / 2 - 20
    for z in zeilen:
        teil = z[:max(0, rest)]
        rest -= len(z) + 1
        if teil:
            ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            ctx.set_font_size(62)
            breite = ctx.text_extents(z).x_advance
            ctx.move_to(W / 2 - breite / 2, yy + 22)
            ctx.text_path(teil)
            ctx.set_line_join(cairo.LINE_JOIN_ROUND)
            ctx.set_source_rgba(0, 0, 0, 1)
            ctx.set_line_width(9)
            ctx.stroke_preserve()
            ctx.set_source_rgba(1, 1, 1, 1)
            ctx.fill()
        yy += lh


def pov_label(ctx, s, y=150, sc=1.0):
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(54)
    w = min(ctx.text_extents(s).x_advance + 80, W - 60)
    ctx.save()
    ctx.translate(W / 2, y)
    ctx.scale(sc, sc)
    rrect(ctx, -w / 2, -52, w, 104, 52)
    form(ctx, "#111111", 6, "#ffffff")
    text(ctx, s, 0, 0, 54, fill="#ffffff", stroke=None, maxw=w - 60)
    ctx.restore()


# ---------------------------------------------------------------- Übergänge
def _blit(ctx, surf, alpha=1.0, scale=1.0, fx=W / 2, fy=H / 2, dx=0, dy=0):
    ctx.save()
    ctx.translate(fx + dx, fy + dy)
    ctx.scale(scale, scale)
    ctx.translate(-fx, -fy)
    ctx.set_source_surface(surf, 0, 0)
    ctx.paint_with_alpha(alpha)
    ctx.restore()


def uebergang(ctx, typ, a, b, e, fokus=(W / 2, H / 2), karte="", seed=0):
    """Mischt Szene a (alt) und b (neu); e läuft von 0 bis 1."""
    if typ == "whip":
        k = e * e * (3 - 2 * e)
        for g in range(4):  # Bewegungsunschärfe aus Geisterbildern
            o = g * 40
            _blit(ctx, a, 0.45 if g else 1, dx=-W * k - o)
            _blit(ctx, b, 0.45 if g else 1, dx=W * (1 - k) + o)
        ctx.set_source_rgba(1, 1, 1, 0.5 * math.sin(math.pi * e))
        rnd = random.Random(seed)
        for _ in range(26):
            y = rnd.uniform(0, H)
            ctx.rectangle(0, y, W, rnd.uniform(3, 12))
        ctx.fill()
    elif typ == "iris":
        _blit(ctx, a)
        ctx.save()
        ctx.arc(fokus[0], fokus[1], ease_out(e) * 2300, 0, 2 * math.pi)
        ctx.clip()
        _blit(ctx, b)
        ctx.restore()
    elif typ == "zoom":   # in den Fokuspunkt von a hineinzoomen
        if e < 0.55:
            k = e / 0.55
            _blit(ctx, a, 1, 1 + 4 * k * k, fokus[0], fokus[1])
            ctx.set_source_rgba(1, 1, 1, k)
            ctx.paint()
        else:
            k = (e - 0.55) / 0.45
            _blit(ctx, b, 1, 1.25 - 0.25 * ease_out(k))
            ctx.set_source_rgba(1, 1, 1, 1 - k)
            ctx.paint()
    elif typ == "zoom_out":  # aus dem Fokuspunkt von b herauszoomen
        k = ease_out(e)
        _blit(ctx, a, 1 - k)
        _blit(ctx, b, k, 1 + 3 * (1 - k), fokus[0], fokus[1])
    elif typ == "black":
        if e < 0.5:
            _blit(ctx, a)
            ctx.set_source_rgba(0, 0, 0, e * 2)
        else:
            _blit(ctx, b)
            ctx.set_source_rgba(0, 0, 0, 2 - e * 2)
        ctx.paint()
    elif typ == "glitch":
        rnd = random.Random(seed)
        _blit(ctx, a if e < 0.5 else b)
        for _ in range(14):
            y = rnd.uniform(0, H)
            h = rnd.uniform(20, 140)
            ctx.save()
            ctx.rectangle(0, y, W, h)
            ctx.clip()
            _blit(ctx, b if rnd.random() < e else a, dx=rnd.uniform(-120, 120))
            ctx.restore()
        for farbe, dx in (((1, 0, 0.3, 0.25), -14), ((0, 1, 1, 0.25), 14)):
            ctx.save()
            ctx.rectangle(0, 0, W, H)
            ctx.set_source_rgba(*farbe)
            ctx.translate(dx, 0)
            ctx.restore()
        ctx.set_source_rgba(1, 1, 1, 0.25 * math.sin(math.pi * e))
        ctx.paint()
    elif typ == "uhr":  # Zeitsprung-Karte mit rasender Uhr
        _blit(ctx, a if e < 0.5 else b)
        sc = max(0.01, math.sin(math.pi * e))
        ctx.set_source_rgba(0.05, 0.05, 0.12, 0.85 * sc)
        ctx.paint()
        ctx.save()
        ctx.translate(W / 2, H / 2 - 60)
        ctx.scale(sc, sc)
        ctx.arc(0, 0, 230, 0, 2 * math.pi)
        form(ctx, "#ffffff", 16)
        for i in range(12):
            a_ = i * math.pi / 6
            ctx.move_to(190 * math.sin(a_), -190 * math.cos(a_))
            ctx.line_to(215 * math.sin(a_), -215 * math.cos(a_))
        ctx.set_source_rgba(0, 0, 0, 1)
        ctx.set_line_width(10)
        ctx.stroke()
        for laenge, speed, lw in ((150, 30, 14), (110, 3, 20)):
            a_ = e * speed
            ctx.move_to(0, 0)
            ctx.line_to(laenge * math.sin(a_), -laenge * math.cos(a_))
            ctx.set_line_width(lw)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.stroke()
        ctx.restore()
        text(ctx, karte, W / 2, H / 2 + 280, 110, fill="#ffd60a", scale=sc, maxw=960)


# ---------------------------------------------------------------- Ton
def lowpass(x, cutoff):
    alpha = 1 - math.exp(-2 * math.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc += alpha * (x[k] - acc)
        y[k] = acc
    return y


def babbeln(s, grundton, cps=24, gedaempft=False, seed=0):
    """Cartoon-'Stimme': ein kurzer Silben-Blip pro 2 Zeichen, Tonhöhe schwankt."""
    rng = np.random.default_rng(seed)
    dauer = len(s) / cps + 0.2
    out = np.zeros(int(dauer * SR))
    for i in range(0, len(s), 2):
        if s[i] in " .,!?…":
            continue
        t0 = int(i / cps * SR)
        n = int(0.075 * SR)
        tt = np.arange(n) / SR
        f = grundton * rng.uniform(0.85, 1.25) * (1.25 if s[i].isupper() else 1)
        ph = np.cumsum(f * (1 + 0.04 * np.sin(2 * np.pi * 30 * tt))) / SR
        sig = 0.6 * np.sign(np.sin(2 * np.pi * ph)) + 0.4 * np.sin(2 * np.pi * ph * 2)
        env = np.minimum(1, tt * 300) * np.exp(-25 * tt)
        out[t0:t0 + n] += (sig * env)[:len(out) - t0]
    return lowpass(out, 900 if gedaempft else 2600)
