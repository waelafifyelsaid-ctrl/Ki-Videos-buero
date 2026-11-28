#!/usr/bin/env python3
"""Serienfabrik: macht aus videos/<folge>/skript.json ein fertiges TikTok-Video.

  python3 tools/serie/produziere.py videos/<folge>            # alles: Timeline → Stimmen → Render → Ton → final.mp4
  python3 tools/serie/produziere.py videos/<folge> --nur-ton  # nur Tonspur neu (Bilder bleiben)
  python3 tools/serie/produziere.py videos/<folge> --pruefen  # nur Timeline + Stimmen (schnell, ohne Render)

Stimmen: ElevenLabs (echte Stimmen, Schlüssel kommt über den Proxy). Ohne Stimme bleibt nur der Untertitel.
Fortschritt beim Rendern: python3 tools/fortschritt.py videos/<folge>/tmp
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import wave
from datetime import date
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools"))
from cartoon import SR, lowpass  # noqa: E402
from musik import Musik  # noqa: E402

STIMMEN = {   # feste Stimmen pro Typ (ElevenLabs Standard-Stimmen)
    "ich": "TX3LPaxmHKxFdv7VOQHJ", "mann": "nPczCjzI2devNBz1zQrb", "mann2": "pNInz6obpgDQGcFmaJgB", "mann3": "iP95p4xoKVk53GoZ742B",
    "alt": "JBFqnCBsd6RMkjVDRZzb", "frau": "Xb7hH8MSUJpSbSDYk0k2", "frau2": "XrExE9yKIg1WjnnlVkGX", "frau3": "cgSgspJ2msm6clMCkdW9",
    "kind": "cgSgspJ2msm6clMCkdW9", "junge": "IKne3meq5aSn9XLyUdCD",
}


def lesedauer(text):
    return max(1.3, .75 + .048 * len(text))


def dauer_datei(f):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout.strip()
    return float(out or 0)


def stimme_erzeugen(ordner, sk, wer, text):
    """Erzeugt (falls nötig) die Sprachaufnahme und gibt den Dateinamen zurück."""
    rolle = sk["rollen"].get(wer, {})
    stimme = STIMMEN.get(rolle.get("stimme", ""), rolle.get("stimme")) or STIMMEN["mann"]
    if wer == "ich":
        stimme = STIMMEN.get(sk.get("ich", {}).get("stimme", "ich"), STIMMEN["ich"])
    h = hashlib.sha1(f"{stimme}|{text}".encode()).hexdigest()[:10]
    datei = ordner / "stimmen" / f"{wer}_{h}.mp3"
    if datei.exists():
        return datei.name
    if os.environ.get("OHNE_STIMMEN") == "1":
        return None
    daten = {"text": text, "model_id": "eleven_multilingual_v2", "seed": 1000 + int(h[:4], 16) % 97,
             "voice_settings": {"stability": .55, "similarity_boost": .9, "style": .3, "use_speaker_boost": True}}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{stimme}?output_format=mp3_44100_128",
                                 data=json.dumps(daten).encode(), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            datei.parent.mkdir(exist_ok=True)
            datei.write_bytes(r.read())
        print(f"  ✓ Stimme {datei.name}: {text}")
        return datei.name
    except urllib.error.HTTPError as e:
        print(f"  ! keine Stimme für „{text}“ ({e.code}) – nur Untertitel", file=sys.stderr)
        return None


def timeline(ordner):
    sk = json.loads((ordner / "skript.json").read_text())
    zeilen = []
    for s in sk["szenen"]:
        ende_vorher = -1.0
        for sz, ab, wer, text, *rest in sk["dialog"]:
            if sz != s["n"]:
                continue
            datei = stimme_erzeugen(ordner, sk, wer, text)
            laenge = dauer_datei(ordner / "stimmen" / datei) if datei else 0
            start = max(ab, ende_vorher + .15)
            ende = start + max(lesedauer(text), laenge + .3)
            opt = rest[0] if rest else {}
            zeilen.append({"szene": sz, "start": round(start, 3), "ende": round(ende, 3), "wer": wer, "text": text, "datei": datei, **opt})
            ende_vorher = ende
        s["d"] = round(max(s["d"], ende_vorher + .35 + (3.0 if s is sk["szenen"][-1] else 0)), 3)
    t = 0.0
    for s in sk["szenen"]:
        s["start"] = round(t, 3)
        t += s["d"]
    sk["dialog"], sk["dauer"] = zeilen, round(t, 3)
    (ordner / "skript_fertig.json").write_text(json.dumps(sk, ensure_ascii=False, indent=1))
    print(f"Timeline: {sk['dauer']:.1f} s, {len(zeilen)} Zeilen, Stimmen: {sum(1 for z in zeilen if z['datei'])}/{len(zeilen)}")
    return sk


# ---------------------------------------------------------------- Ton
rng = np.random.default_rng(7)


def ts(d):
    return np.arange(int(max(d, 0) * SR)) / SR


def rauschen(d, cut):
    return lowpass(rng.uniform(-1, 1, int(d * SR)), cut)


def band(d, lo, hi):
    x = rng.uniform(-1, 1, int(d * SR))
    return lowpass(x, hi) - lowpass(x, lo)


def boom(s=1.0, d=2.5):
    t = ts(d)
    return s * (np.sin(2 * np.pi * np.cumsum(30 + 65 * np.exp(-5 * t)) / SR) * np.exp(-2 * t) + .8 * rauschen(d, 900) * np.exp(-2.4 * t))


def thud(s=1.0):
    t = ts(.3)
    return s * np.sin(2 * np.pi * np.cumsum(55 + 80 * np.exp(-30 * t)) / SR) * np.exp(-12 * t)


def klick(f=3000):
    t = ts(.06)
    return np.sin(2 * np.pi * f * t) * np.exp(-90 * t) + .4 * rng.uniform(-1, 1, len(t)) * np.exp(-150 * t)


def whoosh(d=.4):
    t = ts(d)
    return rauschen(d, 3500) * np.sin(np.pi * t / d) ** 2


def sirene(d, laut=1.0):
    t = ts(d)
    f = 650 + 350 * np.sin(2 * np.pi * .25 * t)
    return laut * np.sin(2 * np.pi * np.cumsum(f) / SR)


def ton(ordner, sk):
    n = int(sk["dauer"] * SR)
    a = np.zeros(n)

    def add(t0, sig, vol=1.0):
        i = int(t0 * SR)
        if i < 0:
            sig, i = sig[-i:], 0
        e = min(n, i + len(sig))
        if i < n:
            a[i:e] += vol * sig[:e - i]

    M = Musik(sk["dauer"])
    DM, BB, GM, CD = [("D", 3), ("F", 3), ("A", 3)], [("A#", 2), ("D", 3), ("F", 3)], [("G", 2), ("A#", 2), ("D", 3)], [("C", 3), ("E", 3), ("G", 3)]
    DUNKEL = [("D", 3), ("F", 3), ("G#", 3)]
    OST = [("D", 4), ("D", 4), ("F", 4), ("D", 4), ("G#", 4), ("D", 4), ("F", 4), ("A", 4)]
    for s in sk["szenen"]:
        t0, d, wn = s["start"], s["d"], s["welt"]
        licht = s.get("licht", [[0, 1]])
        an = licht[0][1] > .5
        # Atmosphäre
        if wn == "wohnung":
            add(t0, .02 * rauschen(d, 800))
            if an:
                add(t0, .05 * np.sin(2 * np.pi * 50 * ts(d)) * (1 + .2 * np.sin(2 * np.pi * .3 * ts(d))))   # Kühlschrank
            add(t0, .06 * band(d, 200, 1200) * (.6 + .4 * np.sin(2 * np.pi * .07 * ts(d))))                  # Wind draußen
        elif wn.startswith("strasse"):
            add(t0, .1 * band(d, 80, 900) * (.7 + .3 * np.sin(2 * np.pi * .1 * ts(d))))
            if "nacht" not in wn:
                for k in range(int(d / 1.7)):
                    add(t0 + k * 1.7 + .3, .05 * np.sin(2 * np.pi * (2400 + 300 * np.sin(k)) * ts(.15)) * np.exp(-10 * ts(.15)))
        elif wn.startswith("markt"):
            add(t0, .05 * np.sin(2 * np.pi * 100 * ts(d)) + .12 * band(d, 300, 2500) * (.7 + .3 * np.sin(2 * np.pi * .5 * ts(d))))
        # Licht fällt aus → Brummen bricht ab, Klick
        for (ta, va), (tb, vb) in zip(licht, licht[1:]):
            if va > .5 and vb < .5:
                add(t0 + tb, .35 * np.sin(2 * np.pi * 100 * ts(.6)) * np.linspace(1, 0, int(.6 * SR)) ** 2); add(t0 + tb, klick(1500), .6)
            if va < .5 and vb > .5:
                add(t0 + tb, klick(1800), .5)
        # Effekte
        for e in s.get("effekte", []):
            te, name = t0 + e[0], e[1]
            if name == "explosion": add(te + .25, boom(1.0, 3.0), .9)
            elif name == "knall": add(te, boom(1.1, 1.5), 1.0)
            elif name == "blitz": add(te, .5 * band(.15, 2000, 8000)); add(te + .4, boom(.8, 3.5), .8)
            elif name == "klopfen":
                for k in range(3): add(te + k * .28, thud(.9), .9)
            elif name == "haemmern":
                for k in range(6): add(te + k * .18, thud(1.0), 1.0)
            elif name == "sirene": add(te, lowpass(sirene(e[2] if len(e) > 2 else 6, .12), 3000))
            elif name == "schlag": add(te, thud(1.0), 1.0); add(te + .05, rauschen(.25, 1500) * np.exp(-12 * ts(.25)), .5)
            elif name == "glas": add(te, .5 * band(.9, 3000, 9000) * np.exp(-5 * ts(.9)))
            elif name == "schritte":
                for k in range(int((e[2] if len(e) > 2 else 2) / .3)): add(te + k * .3, .3 * rauschen(.1, 900) * np.exp(-35 * ts(.1)))
            elif name == "handy":
                for k in range(3): add(te + k * .32, .25 * np.sin(2 * np.pi * 160 * ts(.18)) * (np.sin(2 * np.pi * 30 * ts(.18)) > 0))
                add(te, .2 * np.sin(2 * np.pi * 1320 * ts(.15)) * np.exp(-12 * ts(.15)))
            elif name == "warnton":
                t = ts(2.0); add(te, .25 * np.sign(np.sin(2 * np.pi * 850 * t)) * (np.sin(2 * np.pi * 2 * t) > 0))
            elif name == "tuer": add(te, thud(.7), .7); add(te + .02, .2 * band(.4, 300, 1500) * np.exp(-6 * ts(.4)))
            elif name == "auto": add(te, .3 * band(2.5, 100, 1500) * np.sin(np.pi * ts(2.5) / 2.5) ** 2)
            elif name == "alarm":
                t = ts(e[2] if len(e) > 2 else 4); add(te, .12 * np.sign(np.sin(2 * np.pi * np.where((t * 3) % 1 < .5, 900, 1300) * t)))
            elif name == "menge": add(te, .25 * band(e[2] if len(e) > 2 else 4, 250, 2500) * (.6 + .4 * np.abs(np.sin(2 * np.pi * 1.3 * ts(e[2] if len(e) > 2 else 4)))))
            elif name == "herz":
                for k in range(int((e[2] if len(e) > 2 else 3) / .7)): add(te + k * .7, thud(.6), .6); add(te + k * .7 + .16, thud(.4), .4)
        # Musik nach Stimmung
        st = s.get("musik", "spannung")
        if st == "hook":
            M.braam(t0, 2.2, 1.0); M.taiko(t0, t0 + d, 150, .8); M.ostinato(t0, t0 + d, OST, 150, .4)
        elif st == "ruhig":
            M.pad(t0, DM, d / 2, .25, cutoff=900); M.pad(t0 + d / 2, BB, d / 2, .25, cutoff=900)
            M.arp(t0 + .2, [("D", 5), ("A", 4), ("F", 4), ("A", 4)], .3, int(d / .3), .07)
        elif st == "spannung":
            M.pad(t0, DUNKEL, d, .3, cutoff=700); M.ostinato(t0, t0 + d, [("D", 4), ("D#", 4)] * 4, 130, .3)
        elif st == "action":
            M.groove(t0, t0 + d, 140, 3, [DM, BB, CD, DM], ["D", "A#", "C", "D"], cutoff_bass=700); M.taiko(t0, t0 + d, 140, .9); M.braam(t0, 2.2, .9)
        elif st == "horror":
            M.pad(t0, DUNKEL, d, .35, cutoff=500)
            for k in range(int(d / .8)): add(t0 + k * .8, thud(.5), .45); add(t0 + k * .8 + .16, thud(.3), .3)
        if s.get("tr"):
            add(t0, whoosh(.45), .35); M.impact(t0, .5)
    e = sk["szenen"][-1]["start"] + sk["szenen"][-1]["d"] - 3.0
    M.impact(e, .9); M.braam(e, 2.6, 1.0, ("D", 1)); M.stab(e, DUNKEL, .6, d=.7)
    for z_ in (.7, 1.1):
        add(e + z_ + .05, .3 * np.sin(2 * np.pi * 1200 * ts(.15)) * np.exp(-18 * ts(.15)))
    a = a / max(1e-9, np.max(np.abs(a))) * .55 + M.fertig(1.0) * 1.8
    # Stimmen
    stimme = np.zeros(n)
    for z in sk["dialog"]:
        if not z.get("datei"):
            continue
        roh = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ordner / "stimmen" / z["datei"]), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
        x = np.frombuffer(roh, dtype=np.int16).astype(np.float64) / 32768
        if not len(x):
            continue
        x = x / max(1e-9, np.max(np.abs(x))) * .9
        rolle = sk["rollen"].get(z["wer"], {})
        if z.get("telefon") or rolle.get("telefon"):
            x = lowpass(x, 3200) - lowpass(x, 320); x = np.tanh(x * 3) / np.tanh(3)
        if z.get("laut"):
            x = np.tanh(x * 2.2) / np.tanh(2.2) * 1.2
        s = next(s for s in sk["szenen"] if s["n"] == z["szene"])
        i = int((s["start"] + z["start"]) * SR)
        e2 = min(n, i + len(x))
        stimme[i:e2] += x[:e2 - i]
    huelle = lowpass(np.abs(stimme), 6) * 8
    a = a * (1 - .5 * np.clip(huelle, 0, 1))
    a = a / max(1e-9, np.max(np.abs(a))) * .6 + stimme
    a = a / max(1e-9, np.max(np.abs(a))) * .89
    with wave.open(str(ordner / "tmp" / "ton.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def main():
    ordner = (REPO / sys.argv[1]).resolve() if not Path(sys.argv[1]).is_absolute() else Path(sys.argv[1])
    opt = set(sys.argv[2:])
    (ordner / "tmp").mkdir(exist_ok=True); (ordner / "stimmen").mkdir(exist_ok=True); (ordner / "ausgabe").mkdir(exist_ok=True)
    shutil.copy(REPO / "tools" / "serie" / "index.html", ordner / "index.html")
    sk = timeline(ordner)
    if "--pruefen" in opt:
        return
    seite = str((ordner / "index.html").relative_to(REPO))
    if "--nur-ton" not in opt:
        for f in (ordner / "tmp").glob("teil*"):
            f.unlink()
        subprocess.run(["node", "render3d.js", "video", seite, str(sk["dauer"]), os.environ.get("WORKER", "4"), str(ordner / "tmp")], cwd=REPO / "tools", check=True)
    ton(ordner, sk)
    final = ordner / "final.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(ordner / "tmp" / "liste.txt"), "-i", str(ordner / "tmp" / "ton.wav"),
                    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-maxrate", "5M", "-bufsize", "10M", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-shortest", "-movflags", "+faststart", str(final)], check=True)
    slug = ordner.name
    shutil.copy(final, ordner / "ausgabe" / f"{slug}.mp4")
    (ordner / "caption.txt").write_text(sk.get("caption", "") + "\n\n" + " ".join(sk.get("hashtags", [])) + "\n(Beim Posten als KI-generiert kennzeichnen)\n")
    stat = REPO / "wissen" / "statistik.csv"
    zeile = f"{date.today()},{slug},{sk['titel']},fertig,{sk['dauer']:.1f},,,,,,Serienfabrik\n"
    if slug not in stat.read_text():
        with stat.open("a") as f:
            f.write(zeile)
    print(f"Fertig: {final} ({sk['dauer']:.1f} s)")


if __name__ == "__main__":
    main()
