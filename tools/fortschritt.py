#!/usr/bin/env python3
"""Fortschrittsbalken fürs Rendern: python3 tools/fortschritt.py videos/<folge>/tmp"""
import sys
from pathlib import Path

ordner = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
teile = sorted(ordner.glob("teil*.fortschritt"))
fertig = gesamt = 0
zeilen = []
for t in teile:
    a, b = map(int, t.read_text().split())
    fertig += a; gesamt += b
    zeilen.append(f"  {t.stem}: {'█' * int(20 * a / b)}{'░' * (20 - int(20 * a / b))} {100 * a // b:3d} %")
if not gesamt:
    print("Noch kein Fortschritt."); sys.exit()
p = fertig / gesamt
print(f"Rendern: {'█' * int(30 * p)}{'░' * (30 - int(30 * p))} {p * 100:.0f} %  ({fertig}/{gesamt} Bilder)")
print("\n".join(zeilen))
