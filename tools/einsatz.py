"""Baukasten für die Serie 'Einheit FALKE' (Spezialeinheit, POV, Cartoon).

Kernidee: eine echte Perspektiv-Kamera. Alles (Boden, Häuser, Kisten, Figuren) hat
Welt-Koordinaten in Metern (x = rechts, y = hoch, z = nach vorne). Figuren stehen
mit den Füßen auf y = 0 und werden mit der Entfernung kleiner – so schwebt nichts
und nichts rutscht durch Wände. Physik (Trümmer, Tür, Blendgranate) ist
deterministisch: Schwerkraft + Abprallen am Boden.
"""
import math
import random

import cairo

from cartoon import (FONT, FPS, H, W, clamp, ease_back, ease_out, form, hexc, kopf,  # noqa: F401
                     limb, person, rrect, text)

G = 9.81
FIGUR_PX = 455.0          # Höhe einer Figur bei Skala 1 (Fuß bis Helmspitze)


# ---------------------------------------------------------------- Kamera
class Kamera:
    def __init__(self, x=0.0, y=1.6, z=0.0, f=950.0, horizont=880.0, yaw=0.0, nah=0.25):
        self.x, self.y, self.z, self.f, self.horizont, self.yaw, self.nah = x, y, z, f, horizont, yaw, nah

    def cam(self, X, Y, Z):
        dx, dy, dz = X - self.x, Y - self.y, Z - self.z
        if self.yaw:
            c, s = math.cos(self.yaw), math.sin(self.yaw)
            dx, dz = c * dx - s * dz, s * dx + c * dz
        return dx, dy, dz

    def p_cam(self, dx, dy, dz):
        return W / 2 + self.f * dx / dz, self.horizont - self.f * dy / dz

    def p(self, X, Y, Z):
        return self.p_cam(*self.cam(X, Y, Z))

    def skala(self, X, Z):
        return self.f / max(self.nah, self.cam(X, 0, Z)[2])


def _clip_nah(pts, nah):
    """Sutherland-Hodgman gegen die Ebene dz = nah (Kamera-Raum)."""
    out = []
    n = len(pts)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        ina, inb = a[2] >= nah, b[2] >= nah
        if ina:
            out.append(a)
        if ina != inb:
            t = (nah - a[2]) / (b[2] - a[2])
            out.append(tuple(a[k] + (b[k] - a[k]) * t for k in range(3)))
    return out


def pfad3d(ctx, cam, pts):
    c = _clip_nah([cam.cam(*p) for p in pts], cam.nah)
    if len(c) < 3:
        return False
    ctx.move_to(*cam.p_cam(*c[0]))
    for q in c[1:]:
        ctx.line_to(*cam.p_cam(*q))
    ctx.close_path()
    return True


def flaeche(ctx, cam, pts, fill, lw=5, outline="#111111"):
    if pfad3d(ctx, cam, pts):
        if lw:
            form(ctx, fill, lw, outline)
        else:
            ctx.set_source_rgba(*(hexc(fill) if isinstance(fill, str) else fill))
            ctx.fill()


def linie3d(ctx, cam, a, b, farbe="#111111", lw=4):
    ca, cb = cam.cam(*a), cam.cam(*b)
    if ca[2] < cam.nah and cb[2] < cam.nah:
        return
    seg = _clip_nah([ca, cb, cb], cam.nah)
    if len(seg) < 2:
        return
    ctx.move_to(*cam.p_cam(*seg[0]))
    ctx.line_to(*cam.p_cam(*seg[1]))
    ctx.set_source_rgba(*hexc(farbe))
    ctx.set_line_width(lw)
    ctx.stroke()


def mischen(farbe, f):
    r, g, b, a = hexc(farbe)
    return (clamp(r * f), clamp(g * f), clamp(b * f), a)


def kiste(ctx, cam, x0, x1, y0, y1, z0, z1, farbe, lw=5, schnee=False, deckel=None):
    """Quader mit sichtbaren Seiten (einfache Schattierung)."""
    if cam.z < z0:
        flaeche(ctx, cam, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], farbe, lw)
    if cam.x < x0:
        flaeche(ctx, cam, [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], mischen(farbe, 0.78), lw)
    if cam.x > x1:
        flaeche(ctx, cam, [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], mischen(farbe, 0.78), lw)
    if cam.y > y1:
        flaeche(ctx, cam, [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)],
                "#f8f9fa" if schnee else (deckel or mischen(farbe, 1.15)), lw)


# ---------------------------------------------------------------- Figuren
TEAM = {
    "boss": dict(name="BOSS", farbe="#ffd166",
                 K=dict(haut="#e0ac69", helm="#2f3e46", headset=True, bart="#adb5bd", stoppeln=True),
                 P=dict(label="FALKE 1"), groesse=1.85),
    "tank": dict(name="TANK", farbe="#ef476f",
                 K=dict(haut="#8d5524", helm="#2f3e46", visier="#90e0ef"),
                 P=dict(label="FALKE 2", breit=1.3), groesse=2.0),
    "nova": dict(name="NOVA", farbe="#c77dff",
                 K=dict(haut="#f1c27d", helm="#2f3e46", zopf="#6f1d1b", visier="#c77dff"),
                 P=dict(label="FALKE 3"), groesse=1.72),
    "pixel": dict(name="PIXEL", farbe="#4cc9f0",
                  K=dict(haut="#ffdbac", helm="#2f3e46", brille=True, headset=True),
                  P=dict(label="FALKE 4"), groesse=1.75),
    "ich": dict(name="ICH", farbe="#80ed99",
                K=dict(haut="#f2c39a", helm="#2f3e46", visier="#80ed99"),
                P=dict(label="FALKE 5", armbinde="#80ed99"), groesse=1.8),
}
UNIFORM = dict(hemd="#3a4066", hose="#2b2d42", schuh="#111111", handschuh="#1b1b1e", weste="#525779")


def pose(wer, **kw):
    d = dict(UNIFORM)
    d.update(TEAM[wer]["P"])
    d.update(kw)
    return d


def gesicht(wer, **kw):
    d = dict(TEAM[wer]["K"])
    d.update(kw)
    return d


def schatten(ctx, cam, X, Z, radius=0.45, alpha=0.35):
    sx, sy = cam.p(X, 0, Z)
    s = cam.skala(X, Z)
    if cam.cam(X, 0, Z)[2] < cam.nah:
        return
    ctx.save()
    ctx.translate(sx, sy)
    ctx.scale(radius * s, radius * s * 0.22)
    ctx.arc(0, 0, 1, 0, 2 * math.pi)
    ctx.restore()
    ctx.set_source_rgba(0, 0, 0, alpha)
    ctx.fill()


def figur(ctx, cam, X, Z, P, K, groesse=1.8, Y=0.0, schatten_an=True):
    """Figur mit Füßen auf (X, Y, Z). Gibt (Hand vorne, Hand hinten, Kopfpunkt, Skala) zurück."""
    if cam.cam(X, 0, Z)[2] < cam.nah + 0.2:
        return None
    if schatten_an and Y < 0.05:
        schatten(ctx, cam, X, Z, 0.45 * groesse / 1.8)
    sx, sy = cam.p(X, Y, Z)
    s = cam.skala(X, Z) * groesse / FIGUR_PX
    P = boden_kontakt(P, s, cam.skala(X, Z))
    hv, hh = person(ctx, sx, sy, s, P, K)
    return hv, hh, (sx, sy - (380 + 74) * s - P["hoch"]), s


def bein_hoehe(a, k):
    return 84 * math.cos(a) + 80 * math.cos(a - abs(k))


def boden_kontakt(P, s, px_pro_meter):
    """Hebt/senkt die Figur so, dass der tiefere Fuß genau auf dem Boden steht (kein Schweben,
    kein Einsinken). P['sprung'] = zusätzliche Höhe in Metern (Springen)."""
    P = dict(P)
    b = P.get("beine", (0.08, 0, -0.08, 0))
    tief = max(bein_hoehe(b[0], b[1]), bein_hoehe(b[2], b[3]))
    P["hoch"] = (tief - 163.5) * s + P.pop("sprung", 0.0) * px_pro_meter
    return P


def geh_beine(phase, schritt=0.45, hocke=0.0):
    """Beinwinkel für einen Geh-/Laufzyklus. hocke 0..1 = geduckt."""
    sw = math.sin(phase)
    return (schritt * sw + 0.25 * hocke, 0.15 + 0.55 * max(0, -sw) + 0.9 * hocke,
            -schritt * sw + 0.25 * hocke, 0.15 + 0.55 * max(0, sw) + 0.9 * hocke)


def teammitglied(ctx, cam, wer, X, Z, Y=0.0, k=None, **pose_kw):
    return figur(ctx, cam, X, Z, pose(wer, **pose_kw), gesicht(wer, **(k or {})), TEAM[wer]["groesse"], Y)


def gewehr(ctx, hinten, vorne, s, laenge=1.0):
    """Stilisierter Karabiner zwischen zwei Händen (zeigt nach unten-vorne: 'low ready')."""
    dx, dy = vorne[0] - hinten[0], vorne[1] - hinten[1]
    d = math.hypot(dx, dy) or 1
    ux, uy = dx / d, dy / d
    a = (hinten[0] - ux * 60 * s, hinten[1] - uy * 60 * s)
    b = (vorne[0] + ux * 120 * s * laenge, vorne[1] + uy * 120 * s * laenge)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for lw, c in ((26 * s + 8, "#111111"), (26 * s, "#3a3a40")):
        ctx.move_to(*a)
        ctx.line_to(*b)
        ctx.set_source_rgba(*hexc(c))
        ctx.set_line_width(lw)
        ctx.stroke()
    m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    ctx.move_to(*m)
    ctx.line_to(m[0] - uy * 40 * s, m[1] + ux * 40 * s)
    ctx.set_line_width(14 * s + 6)
    ctx.set_source_rgba(*hexc("#111111"))
    ctx.stroke()


def ramme(ctx, hinten, vorne, s):
    dx, dy = vorne[0] - hinten[0], vorne[1] - hinten[1]
    d = math.hypot(dx, dy) or 1
    ux, uy = dx / d, dy / d
    a = (hinten[0] - ux * 40 * s, hinten[1] - uy * 40 * s)
    b = (vorne[0] + ux * 70 * s, vorne[1] + uy * 70 * s)
    ctx.set_line_cap(cairo.LINE_CAP_BUTT)
    for lw, c in ((60 * s + 10, "#111111"), (60 * s, "#c1121f")):
        ctx.move_to(*a)
        ctx.line_to(*b)
        ctx.set_source_rgba(*hexc(c))
        ctx.set_line_width(lw)
        ctx.stroke()


def ganove(ctx, cam, X, Z, farbe="#6c757d", hoch=False, Y=0.0, rot=0.0, **kw):
    """Böser Typ im Hoodie. rot = Kippwinkel (fällt um die Füße, landet AUF dem Boden)."""
    P = dict(hemd=farbe, hose="#343a40", schuh="#f8f9fa", arme=(-2.6, -0.3, 2.6, 0.3) if hoch else (0.25, 0.3, -0.25, -0.3))
    P.update(kw.pop("P", {}))
    K = dict(haut=kw.pop("haut", "#e8b98a"), kappe=kw.pop("kappe", "#212529"), augen="weit" if hoch else "wuetend",
             mund=0.5 if hoch else "sauer")
    K.update(kw.pop("K", {}))
    if rot == 0:
        return figur(ctx, cam, X, Z, P, K, 1.78, Y)
    sx, sy = cam.p(X, Y, Z)
    s = cam.skala(X, Z) * 1.78 / FIGUR_PX
    schatten(ctx, cam, X + 0.9 * math.sin(abs(rot)) * (1 if rot > 0 else -1), Z, 0.9)
    ctx.save()
    # Drehpunkt leicht über dem Fuß: liegend ruht der Körper AUF dem Boden statt darin
    lift = 45 * s * abs(math.sin(rot))
    ctx.translate(sx, sy - lift)
    ctx.rotate(rot)
    ctx.translate(-sx, -sy)
    person(ctx, sx, sy, s, P, K)
    ctx.restore()


# ---------------------------------------------------------------- Kulisse: Straße / Hafengasse
def himmel(ctx, wetter, nacht, horizont):
    g = cairo.LinearGradient(0, 0, 0, horizont + 200)
    if nacht:
        stops = ("#0b1020", "#1d2d50")
    elif wetter == "schnee":
        stops = ("#adb5bd", "#e9ecef")
    elif wetter == "regen":
        stops = ("#5c677d", "#979dac")
    else:
        stops = ("#48cae4", "#caf0f8")
    g.add_color_stop_rgb(0, *hexc(stops[0])[:3])
    g.add_color_stop_rgb(1, *hexc(stops[1])[:3])
    ctx.rectangle(0, 0, W, H)
    ctx.set_source(g)
    ctx.fill()
    if wetter == "sommer" and not nacht:
        g = cairo.RadialGradient(820, 220, 30, 820, 220, 420)
        g.add_color_stop_rgba(0, 1, 1, 0.85, 1)
        g.add_color_stop_rgba(0.25, 1, 0.95, 0.6, 0.6)
        g.add_color_stop_rgba(1, 1, 0.9, 0.6, 0)
        ctx.arc(820, 220, 420, 0, 2 * math.pi)
        ctx.set_source(g)
        ctx.fill()


def boden(ctx, cam, wetter, z0=-5, z1=200, breite=60, farbe="#8d8d8d"):
    f = "#f1f3f5" if wetter == "schnee" else farbe
    flaeche(ctx, cam, [(-breite, 0, z0), (breite, 0, z0), (breite, 0, z1), (-breite, 0, z1)], f, 0)


def gehweg_platten(ctx, cam, x0, x1, z0, z1, schritt=1.2, farbe="#c9c3b8", fugen="#8f897e"):
    flaeche(ctx, cam, [(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)], farbe, 0)
    z = z0
    while z <= z1:
        linie3d(ctx, cam, (x0, 0, z), (x1, 0, z), fugen, 2.5)
        z += schritt
    x = x0
    while x <= x1:
        linie3d(ctx, cam, (x, 0, z0), (x, 0, z1), fugen, 2.5)
        x += schritt


def fassade(ctx, cam, x, z0, z1, hoehe, seite, farbe="#b5651d", stockwerk=3.2, rolltor=True,
            fenster_farbe="#9ec5ec", licht=None, schnee=False, balkone=True, seed=0):
    """Hauswand in der Ebene X = x, von z0 bis z1. seite = +1 (Wand zeigt nach rechts) / -1."""
    flaeche(ctx, cam, [(x, 0, z0), (x, 0, z1), (x, hoehe, z1), (x, hoehe, z0)], farbe, 6)
    rnd = random.Random(seed)
    breite = 2.6
    nz = max(1, int((z1 - z0) / breite))
    for k in range(nz):
        za, zb = z0 + k * breite + 0.45, z0 + (k + 1) * breite - 0.45
        # Erdgeschoss: Rolltor/Laden
        if rolltor:
            flaeche(ctx, cam, [(x, 0, za - 0.2), (x, 0, zb + 0.2), (x, 2.7, zb + 0.2), (x, 2.7, za - 0.2)], "#adb5bd", 4)
            yy = 0.25
            while yy < 2.6:
                linie3d(ctx, cam, (x, yy, za - 0.2), (x, yy, zb + 0.2), "#6c757d", 2)
                yy += 0.22
            # Markise
            m = 0.8 * seite
            for j in range(6):
                zz0 = za - 0.2 + (zb - za + 0.4) * j / 6
                zz1 = za - 0.2 + (zb - za + 0.4) * (j + 1) / 6
                flaeche(ctx, cam, [(x, 3.1, zz0), (x, 3.1, zz1), (x + m, 2.85, zz1), (x + m, 2.85, zz0)],
                        "#e63946" if j % 2 else "#f8f9fa", 3)
        for st in range(1, int(hoehe / stockwerk)):
            ya, yb = st * stockwerk + 0.7, st * stockwerk + 2.3
            hell = licht and rnd.random() < licht
            flaeche(ctx, cam, [(x, ya, za), (x, ya, zb), (x, yb, zb), (x, yb, za)],
                    "#ffd166" if hell else fenster_farbe, 4, "#f8f9fa")
            linie3d(ctx, cam, (x, ya, (za + zb) / 2), (x, yb, (za + zb) / 2), "#f8f9fa", 4)
            if balkone and st % 2 == 1 and k % 2 == 0:
                tiefe = 1.0 * seite
                kiste(ctx, cam, min(x, x + tiefe), max(x, x + tiefe), ya - 0.35, ya - 0.1, za - 0.3, zb + 0.3,
                      "#dee2e6", 4, schnee=schnee)
                for zz in [za - 0.3 + i * 0.3 for i in range(int((zb - za + 0.6) / 0.3) + 1)]:
                    linie3d(ctx, cam, (x + tiefe, ya - 0.1, zz), (x + tiefe, ya + 0.75, zz), "#212529", 2.5)
                linie3d(ctx, cam, (x + tiefe, ya + 0.75, za - 0.3), (x + tiefe, ya + 0.75, zb + 0.3), "#212529", 4)
    if schnee:
        flaeche(ctx, cam, [(x, hoehe, z0), (x, hoehe, z1), (x, hoehe + 0.25, z1), (x, hoehe + 0.25, z0)], "#f8f9fa", 3)


def laterne(ctx, cam, X, Z, an=True, hoehe=5.0):
    linie3d(ctx, cam, (X, 0, Z), (X, hoehe, Z), "#212529", max(3, cam.skala(X, Z) * 0.12))
    px, py = cam.p(X, hoehe, Z)
    s = cam.skala(X, Z)
    rrect(ctx, px - 0.35 * s, py - 0.12 * s, 0.7 * s, 0.24 * s, 0.08 * s)
    form(ctx, "#343a40", 3)
    return (px, py + 0.1 * s, s)


def lichtkegel(ctx, x, y, breite, laenge, winkel=math.pi / 2, farbe=(1, 0.9, 0.6), alpha=0.35):
    """Additiver Lichtkegel (Taschenlampe, Laterne, Scheinwerfer)."""
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_ADD)
    ctx.translate(x, y)
    ctx.rotate(winkel - math.pi / 2)
    g = cairo.LinearGradient(0, 0, 0, laenge)
    g.add_color_stop_rgba(0, *farbe, alpha)
    g.add_color_stop_rgba(1, *farbe, 0)
    ctx.move_to(-breite * 0.08, 0)
    ctx.line_to(breite * 0.08, 0)
    ctx.line_to(breite / 2, laenge)
    ctx.line_to(-breite / 2, laenge)
    ctx.close_path()
    ctx.set_source(g)
    ctx.fill()
    ctx.restore()


def licht_punkt(ctx, x, y, r, farbe=(1, 0.85, 0.5), alpha=0.6):
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_ADD)
    g = cairo.RadialGradient(x, y, 0, x, y, r)
    g.add_color_stop_rgba(0, *farbe, alpha)
    g.add_color_stop_rgba(1, *farbe, 0)
    ctx.arc(x, y, r, 0, 2 * math.pi)
    ctx.set_source(g)
    ctx.fill()
    ctx.restore()


def nacht_filter(ctx, staerke=0.55, farbe=(0.25, 0.32, 0.6)):
    """Dunkelt die ganze Szene ab (Multiplizieren) – danach Lichter mit licht_punkt/lichtkegel."""
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_MULTIPLY)
    ctx.set_source_rgba(*[1 - staerke * (1 - c) for c in farbe], 1)
    ctx.paint()
    ctx.restore()


# ---------------------------------------------------------------- Wetter
def regen(ctx, t, menge=260, wind=0.18, laenge=70, seed=1, alpha=0.5):
    rnd = random.Random(seed)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for i in range(menge):
        tiefe = rnd.uniform(0.4, 1.0)
        speed = 2600 * tiefe
        x0 = rnd.uniform(-200, W + 200)
        y = (rnd.uniform(0, H + 200) + t * speed) % (H + 200) - 100
        x = (x0 + y * wind) % (W + 200) - 100
        ctx.move_to(x, y)
        ctx.line_to(x - wind * laenge * tiefe, y - laenge * tiefe)
        ctx.set_source_rgba(0.85, 0.9, 1, alpha * tiefe)
        ctx.set_line_width(2.5 * tiefe + 0.5)
        ctx.stroke()


def regen_spritzer(ctx, cam, t, menge=50, x0=-6, x1=6, z0=2, z1=30, seed=2):
    rnd = random.Random(seed)
    for i in range(menge):
        X, Z = rnd.uniform(x0, x1), rnd.uniform(z0, z1)
        ph = (t * rnd.uniform(2.5, 4) + rnd.random()) % 1
        sx, sy = cam.p(X, 0, Z)
        s = cam.skala(X, Z)
        r = (0.05 + 0.25 * ph) * s
        ctx.save()
        ctx.translate(sx, sy)
        ctx.scale(1, 0.3)
        ctx.arc(0, 0, r, 0, 2 * math.pi)
        ctx.restore()
        ctx.set_source_rgba(0.9, 0.95, 1, 0.6 * (1 - ph))
        ctx.set_line_width(2)
        ctx.stroke()


def pfuetzen(ctx, cam, liste, alpha=0.45):
    for X, Z, r in liste:
        pts = [(X + r * math.cos(a), 0.005, Z + r * 0.6 * math.sin(a)) for a in [i * math.pi / 8 for i in range(16)]]
        if pfad3d(ctx, cam, pts):
            ctx.set_source_rgba(0.55, 0.65, 0.85, alpha)
            ctx.fill()


def schnee(ctx, t, menge=220, seed=3):
    rnd = random.Random(seed)
    for i in range(menge):
        tiefe = rnd.uniform(0.3, 1.0)
        x0 = rnd.uniform(0, W)
        y = (rnd.uniform(0, H) + t * 160 * tiefe) % (H + 40) - 20
        x = (x0 + 40 * math.sin(t * 1.3 + i) * tiefe) % W
        ctx.arc(x, y, 3 + 6 * tiefe, 0, 2 * math.pi)
        ctx.set_source_rgba(1, 1, 1, 0.5 + 0.5 * tiefe)
        ctx.fill()


def hitze(ctx, t):
    ctx.save()
    ctx.set_operator(cairo.OPERATOR_ADD)
    ctx.set_source_rgba(0.25, 0.12, 0.0, 0.10 + 0.02 * math.sin(t * 2))
    ctx.paint()
    ctx.restore()


def wetter_filter(ctx, cam, wetter, t, nacht=False):
    if wetter == "regen":
        regen(ctx, t, alpha=0.35 if nacht else 0.5)
    elif wetter == "schnee":
        schnee(ctx, t)
    elif wetter == "sommer":
        hitze(ctx, t)


def blitz_gewitter(t, zeiten):
    """Helligkeit eines Gewitterblitzes (0..1) zu den angegebenen Zeiten."""
    h = 0.0
    for z in zeiten:
        d = t - z
        if 0 <= d < 0.35:
            h = max(h, (1 if d < 0.05 or 0.12 < d < 0.17 else 0.4) * (1 - d / 0.35))
    return h


# ---------------------------------------------------------------- Explosion + Physik
def wurf(x0, y0, vx, vy, t, boden_y, rest=0.45, reibung=0.6, g=2600.0):
    """Bildschirm-Physik (Pixel): Wurfparabel mit Abprallen am Boden. Gibt (x, y, liegt?) zurück."""
    x, y, dt, tt = x0, y0, 1 / 120, 0.0
    liegt = False
    while tt < t:
        if not liegt:
            vy += g * dt
            x += vx * dt
            y += vy * dt
            if y > boden_y:
                y = boden_y
                vy = -vy * rest
                vx *= reibung
                if abs(vy) < 120:
                    vy, liegt = 0, True
        else:
            vx *= 0.9
            x += vx * dt
        tt += dt
    return x, y, liegt


def explosion(ctx, x, y, d, s=1.0, boden_y=None, seed=7, truemmer=18):
    """Explosion bei (x, y), d = Sekunden seit Zündung, s = Größe. Trümmer landen auf boden_y."""
    if d < 0:
        return
    rnd = random.Random(seed)
    boden_y = boden_y if boden_y is not None else y + 300 * s
    # Rauch (unter dem Feuer)
    for i in range(16):
        a = rnd.uniform(0, 2 * math.pi)
        v = rnd.uniform(60, 200) * s
        r0 = rnd.uniform(60, 130) * s
        px = x + math.cos(a) * v * min(d, 1.5) * 1.2
        py = y + math.sin(a) * v * min(d, 1.5) * 0.6 - 110 * s * d
        r = r0 * (0.6 + 1.6 * ease_out(d / 2.5))
        al = clamp(1.4 - d / 3.0) * 0.85 * clamp(d * 4)
        grau = rnd.uniform(0.18, 0.32)
        ctx.arc(px, py, r, 0, 2 * math.pi)
        ctx.set_source_rgba(grau, grau, grau + 0.02, al)
        ctx.fill_preserve()
        ctx.set_source_rgba(0.05, 0.05, 0.05, al)
        ctx.set_line_width(5)
        ctx.stroke()
    # Feuerball
    if d < 1.1:
        k = ease_out(d / 0.35)
        verblassen = clamp(1 - (d - 0.45) / 0.65)
        for schicht, (farbe, rf) in enumerate((("#9d0208", 1.0), ("#f48c06", 0.8), ("#ffba08", 0.58), ("#fff3b0", 0.3))):
            rnd2 = random.Random(seed + schicht)
            for j in range(9):
                a = j * 2 * math.pi / 9 + rnd2.uniform(-0.3, 0.3)
                rr = 210 * s * k * rf
                px, py = x + math.cos(a) * rr * 0.55, y + math.sin(a) * rr * 0.45 - 40 * s * d
                ctx.arc(px, py, rr * rnd2.uniform(0.45, 0.7), 0, 2 * math.pi)
                ctx.set_source_rgba(*hexc(farbe)[:3], verblassen)
                ctx.fill()
    # Druckwelle
    if d < 0.45:
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(1, 0.55)
        ctx.arc(0, 0, 1500 * s * d, 0, 2 * math.pi)
        ctx.restore()
        ctx.set_source_rgba(1, 1, 1, 0.6 * (1 - d / 0.45))
        ctx.set_line_width(26 * s)
        ctx.stroke()
    # Funken
    if d < 0.9:
        for i in range(26):
            a = rnd.uniform(-math.pi, 0.2)
            v = rnd.uniform(700, 1500) * s
            px = x + math.cos(a) * v * d
            py = y + math.sin(a) * v * d + 1300 * s * d * d
            ctx.move_to(px, py)
            ctx.line_to(px - math.cos(a) * 40 * s, py - (math.sin(a) * v + 2600 * s * d) * 0.03)
            ctx.set_source_rgba(1, 0.85, 0.3, 1 - d / 0.9)
            ctx.set_line_width(5 * s + 1)
            ctx.stroke()
    # Trümmer mit Physik
    for i in range(truemmer):
        a = rnd.uniform(-math.pi * 0.95, -0.05)
        v = rnd.uniform(500, 1300) * s
        tx, ty, liegt = wurf(x, y, math.cos(a) * v, math.sin(a) * v, d, boden_y, g=2600 * s)
        groesse = rnd.uniform(10, 26) * s
        ctx.save()
        ctx.translate(tx, ty - groesse * 0.4)
        ctx.rotate(0 if liegt else d * rnd.uniform(-14, 14))
        rrect(ctx, -groesse, -groesse * 0.5, groesse * 2, groesse, 3)
        form(ctx, rnd.choice(["#6c584c", "#495057", "#a98467"]), 3)
        ctx.restore()
    # Blitz
    if d < 0.15:
        ctx.set_source_rgba(1, 0.97, 0.85, 0.85 * (1 - d / 0.15))
        ctx.paint()


def blendgranate(ctx, d):
    """Weißer Blitz + Nachbild. d = Sekunden seit Detonation."""
    if d < 0:
        return
    if d < 0.6:
        ctx.set_source_rgba(1, 1, 1, 1 - d / 0.6 * 0.3)
        ctx.paint()
    elif d < 2.0:
        ctx.set_source_rgba(1, 1, 1, 0.7 * (1 - (d - 0.6) / 1.4))
        ctx.paint()


def kamera_wackel(t, staerke, seed=0):
    rnd = random.Random(int(t * FPS) + seed * 1000)
    return rnd.uniform(-1, 1) * staerke, rnd.uniform(-1, 1) * staerke


# ---------------------------------------------------------------- POV-Arme
def ebene(ctx, zeichnen, dunkel=0.0, farbe=(0.08, 0.1, 0.22)):
    """Figuren-Ebene: wird nur leicht abgedunkelt (ATOP), damit Figuren nachts lesbar bleiben."""
    ctx.push_group()
    zeichnen()
    if dunkel > 0:
        ctx.set_operator(cairo.OPERATOR_ATOP)
        ctx.set_source_rgba(*farbe, dunkel)
        ctx.paint()
        ctx.set_operator(cairo.OPERATOR_OVER)
    ctx.pop_group_to_source()
    ctx.paint()


def pov_arme(ctx, t, laufen=0.0, zielen=0.0, lampe=False, hell=1.0):
    """Ich-Sicht wie im Ego-Shooter-Cartoon: Karabiner von rechts unten zur Bildmitte,
    linke Hand am Handschutz, rechte Hand am Griff. laufen 0..1 = Wippen, zielen hebt die Waffe."""
    bob = math.sin(t * 9) * 28 * laufen
    sway = math.cos(t * 4.5) * 20 * laufen
    zielen = clamp(zielen, -1, 1)
    M = (585 + sway, 1130 + bob - 150 * zielen)          # Mündung
    B = (985 + sway * 1.4, 2080 + bob * 1.3)              # Schaft (außerhalb des Bildes)
    dx, dy = B[0] - M[0], B[1] - M[1]
    L = math.hypot(dx, dy)
    d = (dx / L, dy / L)
    n = (-d[1], d[0])                                     # zeigt nach links (Oberseite der Waffe)

    def pt(u, off):
        return (M[0] + d[0] * L * u + n[0] * off, M[1] + d[1] * L * u + n[1] * off)

    def breite(u):
        return 22 + 150 * u

    def stueck(u0, u1, f=1.0, oben=0.0, farbe="#2b2b30", lw=6):
        ctx.move_to(*pt(u0, oben + breite(u0) * f / 2))
        ctx.line_to(*pt(u1, oben + breite(u1) * f / 2))
        ctx.line_to(*pt(u1, oben - breite(u1) * f / 2))
        ctx.line_to(*pt(u0, oben - breite(u0) * f / 2))
        ctx.close_path()
        form(ctx, farbe, lw)

    if lampe:
        lx, ly = pt(0.26, -breite(0.26) * 0.75)
        lichtkegel(ctx, lx, ly, 950, 1500, winkel=math.atan2(-d[1], -d[0]), alpha=0.26)
    # Magazin (rechte Seite = unten)
    u = 0.6
    ctx.move_to(*pt(u - 0.04, -breite(u) * 0.45))
    ctx.line_to(*pt(u + 0.05, -breite(u) * 0.45))
    ctx.line_to(*pt(u + 0.09, -breite(u) * 1.35))
    ctx.line_to(*pt(u - 0.0, -breite(u) * 1.4))
    ctx.close_path()
    form(ctx, "#1b1b1e", 6)
    stueck(0.0, 0.14, 0.55, farbe="#111111")              # Lauf
    stueck(0.12, 0.48, 1.0, farbe="#3a3a42")              # Handschutz
    for k in range(5):                                    # Kühlschlitze
        uu = 0.16 + k * 0.06
        ctx.move_to(*pt(uu, breite(uu) * 0.25))
        ctx.line_to(*pt(uu + 0.03, breite(uu + 0.03) * 0.25))
        ctx.set_source_rgba(0, 0, 0, 0.7)
        ctx.set_line_width(5)
        ctx.stroke()
    stueck(0.24, 0.3, 0.75, oben=-breite(0.27) * 0.75, farbe="#1b1b1e", lw=5)   # Lampe unten
    stueck(0.46, 0.8, 1.15, farbe="#2b2b30")              # Gehäuse
    stueck(0.78, 1.0, 1.0, farbe="#1f1f24")               # Schaft
    # Visier oben (linke Seite)
    stueck(0.5, 0.6, 0.75, oben=breite(0.55) * 0.85, farbe="#1b1b1e", lw=5)
    vx, vy = pt(0.55, breite(0.55) * 0.85)
    ctx.arc(vx, vy, breite(0.55) * 0.2, 0, 2 * math.pi)
    form(ctx, "#5a6c8a", 4)
    ctx.arc(vx, vy, breite(0.55) * 0.07, 0, 2 * math.pi)
    ctx.set_source_rgba(1, 0.15, 0.3, 1)
    ctx.fill()
    # Rechter Arm + Hand am Griff
    gx, gy = pt(0.74, -breite(0.74) * 0.55)
    limb(ctx, [(1180 + sway, 2000), (gx + 120, gy + 160), (gx + 10, gy + 20)], 150, "#34395a")
    rrect(ctx, gx - 75, gy - 55, 150, 120, 45)
    form(ctx, "#1b1b1e", 7)
    for k in range(3):
        ctx.move_to(gx - 50 + k * 35, gy - 40)
        ctx.line_to(gx - 45 + k * 35, gy + 20)
    ctx.set_source_rgba(0.35, 0.35, 0.4, 1)
    ctx.set_line_width(4)
    ctx.stroke()
    # Linker Arm + Hand am Handschutz
    hx, hy = pt(0.35, 0)
    ell = (150 + sway * 0.5, 1640 + bob)
    limb(ctx, [(-160, 2050), ell, (hx - 30, hy + 50)], 140, "#34395a")
    ctx.arc(ell[0] + 40, ell[1] + 10, 34, 0, 2 * math.pi)
    form(ctx, "#80ed99", 5)
    ctx.save()
    ctx.translate(hx - 10, hy + 15)
    ctx.rotate(math.atan2(d[1], d[0]))
    rrect(ctx, -70, -62, 140, 124, 48)
    form(ctx, "#1b1b1e", 7)
    for k in range(4):
        ctx.move_to(-45 + k * 30, -50)
        ctx.line_to(-45 + k * 30, -10)
    ctx.set_source_rgba(0.35, 0.35, 0.4, 1)
    ctx.set_line_width(4)
    ctx.stroke()
    ctx.restore()


def pov_hand_zeichen(ctx, t, zeichen="faust", x=640, y=1250):
    """Handzeichen in Ich-Sicht von vorne (z. B. Boss' Faust = Stopp) – ein großer Handschuh."""
    limb(ctx, [(x + 200, H + 80), (x + 60, y + 200), (x, y)], 120, "#2b2d42")
    if zeichen == "faust":
        rrect(ctx, x - 80, y - 90, 160, 170, 50)
        form(ctx, "#1b1b1e", 7)
    else:  # Finger zählen
        rrect(ctx, x - 80, y - 40, 160, 130, 40)
        form(ctx, "#1b1b1e", 7)
        for k in range(zeichen):
            rrect(ctx, x - 70 + k * 38, y - 150, 30, 120, 14)
            form(ctx, "#1b1b1e", 5)


# ---------------------------------------------------------------- Fahrzeuge (Seitenansicht)
def van_seite(ctx, x, y, s, t, blaulicht=True, nacht=True, tempo=1.0):
    """Schwarzer Einsatz-Transporter, Räder auf y. Fährt nach rechts."""
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    federn = 6 * math.sin(t * 13) * tempo
    ctx.translate(0, federn)
    # Karosserie
    ctx.move_to(-330, -70)
    ctx.line_to(-330, -330)
    ctx.line_to(170, -330)
    ctx.line_to(290, -200)
    ctx.line_to(330, -190)
    ctx.line_to(330, -70)
    ctx.close_path()
    form(ctx, "#1b1b22", 8)
    ctx.rectangle(-330, -150, 660, 26)
    ctx.set_source_rgba(*hexc("#3d405b"))
    ctx.fill()
    text(ctx, "FALKE", -60, -205, 70, fill="#e9ecef", stroke=None)
    # Fenster
    ctx.move_to(180, -310)
    ctx.line_to(270, -205)
    ctx.line_to(180, -205)
    ctx.close_path()
    form(ctx, "#5a6c8a", 6)
    rrect(ctx, 40, -305, 120, 95, 10)
    form(ctx, "#5a6c8a", 6)
    # Blaulicht
    if blaulicht:
        an = int(t * 8) % 2
        for k, dx in enumerate((-80, 40)):
            rrect(ctx, dx, -358, 70, 28, 8)
            form(ctx, "#4cc9f0" if (k == an) else "#0a2463", 5)
    # Räder
    for wx in (-200, 200):
        ctx.arc(wx, -60, 70, 0, 2 * math.pi)
        form(ctx, "#111111", 6)
        ctx.arc(wx, -60, 38, 0, 2 * math.pi)
        form(ctx, "#6c757d", 5)
        for k in range(5):
            a = t * 22 * tempo + k * 2 * math.pi / 5
            ctx.move_to(wx, -60)
            ctx.line_to(wx + 34 * math.cos(a), -60 + 34 * math.sin(a))
        ctx.set_source_rgba(0, 0, 0, 1)
        ctx.set_line_width(5)
        ctx.stroke()
    ctx.restore()
    if blaulicht:
        an = int(t * 8) % 2
        licht_punkt(ctx, x + (-45 if an == 0 else 75) * s, y - 344 * s, 260 * s, (0.3, 0.6, 1.0), 0.7)
    if nacht:
        lichtkegel(ctx, x + 325 * s, y - 150 * s, 380 * s, 900 * s, winkel=0.08, alpha=0.4)


def heli_seite(ctx, x, y, s, t, nacht=False):
    ctx.save()
    ctx.translate(x, y + 10 * math.sin(t * 2.2))
    ctx.scale(s, s)
    ctx.rotate(0.05 * math.sin(t * 1.7))
    ctx.move_to(-120, -40)
    ctx.line_to(-520, -70)
    ctx.line_to(-540, -140)
    ctx.line_to(-480, -130)
    ctx.line_to(-110, -100)
    ctx.close_path()
    form(ctx, "#2b2d42", 7)
    ctx.save()
    ctx.scale(1.6, 1)
    ctx.arc(0, -60, 150, 0, 2 * math.pi)
    ctx.restore()
    form(ctx, "#2b2d42", 8)
    ctx.move_to(100, -150)
    ctx.curve_to(230, -140, 250, -30, 200, 10)
    ctx.line_to(100, 10)
    ctx.close_path()
    form(ctx, "#5a6c8a", 6)
    text(ctx, "FALKE", -60, -40, 60, fill="#e9ecef", stroke=None)
    for dx in (-150, 120):
        ctx.move_to(dx, 85)
        ctx.line_to(dx, 120)
    ctx.move_to(-230, 120)
    ctx.line_to(200, 120)
    ctx.set_source_rgba(0, 0, 0, 1)
    ctx.set_line_width(12)
    ctx.stroke()
    ctx.restore()
    # Rotor (Unschärfe-Ellipse)
    ctx.save()
    ctx.translate(x, y - 230 * s + 10 * math.sin(t * 2.2))
    ctx.scale(1, 0.12)
    ctx.arc(0, 0, 560 * s, 0, 2 * math.pi)
    ctx.restore()
    ctx.set_source_rgba(0.1, 0.1, 0.12, 0.35)
    ctx.fill()
    a = t * 40
    ctx.move_to(x - 560 * s * math.cos(a), y - 230 * s)
    ctx.line_to(x + 560 * s * math.cos(a), y - 230 * s)
    ctx.set_source_rgba(0, 0, 0, 0.8)
    ctx.set_line_width(10 * s)
    ctx.stroke()


# ---------------------------------------------------------------- Text-Stil wie in den Vorbildern
SPRECHER_FARBE = {k: v["farbe"] for k, v in TEAM.items()}
SPRECHER_FARBE.update({"hartmann": "#ffffff", "fuchs": "#ff9f1c", "ganove": "#ced4da", "funk": "#90e0ef"})
SPRECHER_NAME = {k: v["name"] for k, v in TEAM.items()}
SPRECHER_NAME.update({"hartmann": "DIREKTORIN HARTMANN", "fuchs": "???", "ganove": "GANOVE", "funk": "FUNK"})


def untertitel(ctx, wer, s, n, y=1330, sc=1.0):
    """Großer TikTok-Untertitel (hellblau mit dunklem Rand) + Sprechername darüber."""
    from cartoon import umbrechen
    zeilen = umbrechen(ctx, s, 70, 940)
    lh = 84
    y0 = y - (len(zeilen) - 1) * lh / 2
    text(ctx, SPRECHER_NAME.get(wer, wer.upper()), W / 2, y0 - 78, 40, fill=SPRECHER_FARBE.get(wer, "#ffffff"),
         sw=8, scale=sc)
    rest = n
    for i, z in enumerate(zeilen):
        teil = z[:max(0, rest)]
        rest -= len(z) + 1
        if not teil:
            continue
        ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        ctx.set_font_size(70)
        breite = ctx.text_extents(z).x_advance
        ctx.save()
        ctx.translate(W / 2, y0 + i * lh)
        ctx.scale(sc, sc)
        ctx.move_to(-breite / 2, 25)
        ctx.text_path(teil)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.set_source_rgba(*hexc("#0b1d3a"))
        ctx.set_line_width(13)
        ctx.stroke_preserve()
        ctx.set_source_rgba(*hexc("#bde0fe"))
        ctx.fill()
        ctx.restore()


def einblendung(ctx, oben, unten, lt, y=260):
    """Ort/Zeit-Einblendung im Stil eines Einsatzprotokolls."""
    k = ease_out(lt / 0.3)
    breite = 900
    x0 = -breite + (breite + 90) * k
    rrect(ctx, x0, y - 85, breite, 170, 16)
    ctx.set_source_rgba(0.05, 0.07, 0.12, 0.85)
    ctx.fill()
    ctx.rectangle(x0, y - 85, 16, 170)
    ctx.set_source_rgba(*hexc("#80ed99"))
    ctx.fill()
    ctx.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(36)
    ctx.move_to(x0 + 50, y - 22)
    ctx.set_source_rgba(*hexc("#80ed99"))
    ctx.show_text(oben[:int(len(oben) * clamp(lt * 3))])
    ctx.set_font_size(54)
    ctx.move_to(x0 + 50, y + 48)
    ctx.set_source_rgba(1, 1, 1, 1)
    ctx.show_text(unten[:int(len(unten) * clamp(lt * 2.2))])
