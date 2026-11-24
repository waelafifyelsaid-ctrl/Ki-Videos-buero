#!/usr/bin/env python3
"""Erzeugt die Szenenbilder (1080x1920) für 'du-lernst-falsch-1-3-7' nach tmp/."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
HIER = Path(__file__).resolve().parent
TMP = HIER / "tmp"
TMP.mkdir(exist_ok=True)
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size):
    return ImageFont.truetype(BOLD, size)


def verlauf(oben, unten):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(oben[i] + (unten[i] - oben[i]) * t) for i in range(3)))
    return img


def text_mitte(d, y, text, size, fill="white", rand=10, rand_farbe="black", max_breite=980):
    """Zeichnet zentrierten, ggf. umbrochenen Text mit Rand. Gibt neues y zurück."""
    f = font(size)
    zeilen, aktuell = [], ""
    for wort in text.split():
        probe = (aktuell + " " + wort).strip()
        if d.textlength(probe, font=f) <= max_breite:
            aktuell = probe
        else:
            zeilen.append(aktuell)
            aktuell = wort
    zeilen.append(aktuell)
    for z in zeilen:
        w = d.textlength(z, font=f)
        d.text(((W - w) / 2, y), z, font=f, fill=fill, stroke_width=rand, stroke_fill=rand_farbe)
        y += int(size * 1.2)
    return y


def untertitel(d, text):
    """Großer Untertitel mittig-unten: weiß mit schwarzem Rand."""
    text_mitte(d, 1450, text, 72, rand=8)


def kurve(d, punkte, farbe, breite=14):
    d.line(punkte, fill=farbe, width=breite, joint="curve")
    for x, y in (punkte[0], punkte[-1]):
        d.ellipse([x - breite, y - breite, x + breite, y + breite], fill=farbe)


def achsen(d, x0, y0, x1, y1):
    d.line([(x0, y0), (x0, y1), (x1, y1)], fill=(255, 255, 255), width=8)
    f = font(44)
    d.text((x0 - 10, y0 - 70), "Wissen", font=f, fill="white")
    d.text((x1 - 150, y1 + 90), "Tage", font=f, fill="white")


def speichern(img, nr):
    img.save(TMP / f"s{nr}.png")


# 1 – Hook
img = verlauf((230, 30, 45), (140, 0, 20))
d = ImageDraw.Draw(img)
y = text_mitte(d, 560, "DU", 240, rand=14, max_breite=900)
y = text_mitte(d, y, "LERNST", 190, rand=14, max_breite=900)
text_mitte(d, y + 10, "FALSCH.", 190, fill=(255, 230, 0), rand=14, max_breite=900)
speichern(img, 1)

# 2 – Vergessenskurve
img = verlauf((25, 25, 45), (10, 10, 20))
d = ImageDraw.Draw(img)
x0, y0, x1, y1 = 140, 380, 960, 1150
achsen(d, x0, y0, x1, y1)
pts = [(x0 + (x1 - x0) * t, y1 - (y1 - y0 - 40) * math.exp(-5 * t) - 60) for t in [i / 60 for i in range(61)]]
kurve(d, pts, (255, 70, 90))
d.text((x0 + 140, y0 + 260), "nach 1 Tag", font=font(52), fill=(255, 70, 90))
untertitel(d, "Nach 1 Tag: das meiste vergessen")
speichern(img, 2)

# 3 – Lösung
img = verlauf((255, 210, 0), (255, 140, 0))
d = ImageDraw.Draw(img)
text_mitte(d, 450, "DIE LÖSUNG:", 110, fill=(30, 30, 30), rand=0)
text_mitte(d, 700, "1·3·7", 230, rand=14, max_breite=1000)
text_mitte(d, 1000, "REGEL", 170, fill=(30, 30, 30), rand=0)
speichern(img, 3)

# 4-6 – Tage
tage = [
    (4, "TAG 1", "Direkt nach der Vorlesung", "10 Min. wiederholen", (0, 150, 255)),
    (5, "TAG 3", "Ohne Notizen", "selbst abfragen", (255, 120, 0)),
    (6, "TAG 7", "Alles einmal", "laut erklären", (180, 60, 255)),
]
for nr, tag, zeile1, zeile2, farbe in tage:
    img = verlauf((20, 20, 35), (5, 5, 15))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([90, 330, 990, 1330], radius=60, fill=farbe)
    text_mitte(d, 420, tag, 210, rand=12)
    d.line([(220, 720), (860, 720)], fill="white", width=8)
    y = text_mitte(d, 800, zeile1, 70, rand=0)
    text_mitte(d, y + 40, zeile2, 100, fill=(255, 240, 120), rand=8)
    untertitel(d, f"{tag} – {zeile2}")
    speichern(img, nr)

# 7 – Kurve bleibt oben
img = verlauf((0, 150, 90), (0, 70, 45))
d = ImageDraw.Draw(img)
x0, y0, x1, y1 = 140, 380, 960, 1150
achsen(d, x0, y0, x1, y1)
oben = y0 + 40
pts = []
starts = [0.0, 1 / 7, 3 / 7, 7 / 7 * 0.999]
verlust = [0.45, 0.25, 0.12]
for i, s in enumerate(starts[:-1]):
    e = starts[i + 1]
    for k in range(21):
        t = s + (e - s) * k / 20
        pts.append((x0 + (x1 - x0) * t, oben + (y1 - oben - 60) * verlust[i] * (1 - math.exp(-4 * (t - s) / (e - s)))))
kurve(d, pts, (255, 240, 0))
for s, lbl in zip(starts[:3], ["1", "3", "7"]):
    x = x0 + (x1 - x0) * s
    d.text((x - 15, y1 + 20), lbl, font=font(56), fill="white")
    d.line([(x, oben), (x, y1)], fill=(255, 255, 255, 90), width=3)
untertitel(d, "Wissen bleibt bis zur Klausur")
speichern(img, 7)

# 8 – CTA
img = verlauf((120, 40, 220), (50, 10, 110))
d = ImageDraw.Draw(img)
y = text_mitte(d, 480, "SPEICHERN", 135, rand=12, max_breite=900)
y = text_mitte(d, y + 20, "&", 130, fill=(255, 230, 0), rand=10)
text_mitte(d, y + 30, "den Freund markieren, der morgen Klausur hat", 90, rand=8, max_breite=900)
speichern(img, 8)

print("Szenen gespeichert in", TMP)
