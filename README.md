# KI-Video-Büro

Ein kleines Büro aus Claude-Code-Mitarbeitern, das TikTok-Videos plant, produziert und ständig verbessert.

- **Chef** = deine normale Claude-Code-Session (Anweisungen in `CLAUDE.md`)
- **ideen-scout**, **produzent**, **optimierer** = Subagents in `.claude/agents/`

## Einrichten
Siehe **ANLEITUNG.md** – Schritt für Schritt, ohne Vorkenntnisse.
Bilder und Animationen macht der Produzent per Code, die Stimme kommt von ElevenLabs (`tools/stimme.py`).

## Am Handy weitermachen
In der Claude-App unter **Code** eine Session mit diesem Repo starten – das Büro
arbeitet dann in der Cloud. Am Laptop mit `claude --teleport` übernehmen.

## Befehle
| Befehl | Was passiert |
|---|---|
| `/neues-video [Thema]` | Idee → Skript → Video → Qualitätscheck |
| `/ideen [Thema]` | 10 Ideen in den Ideen-Pool |
| `/review` | Statistiken auswerten, Learnings aktualisieren |

Nach dem Posten: Zahlen aus TikTok in `wissen/statistik.csv` eintragen, dann `/review`.
