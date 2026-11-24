# Anleitung für Einsteiger

## Was ist Claude Code überhaupt?
Claude Code ist Claude, der direkt auf deinem Laptop arbeiten darf: Dateien anlegen,
Programme starten, Videos rendern. Du schreibst ihm auf Deutsch, was du willst –
er macht es und fragt nach, bevor er etwas Wichtiges tut. Du musst nicht programmieren.

Das „Büro“ in diesem Ordner sind einfach Textdateien mit Anweisungen:
- `CLAUDE.md` – liest Claude Code automatisch beim Start. Damit wird er zum **Chef**.
- `.claude/agents/` – die drei Mitarbeiter. Der Chef ruft sie selbst auf.
- `.claude/commands/` – deine Kurzbefehle wie `/neues-video`.

## Einmal einrichten (ca. 15 Minuten)

### 1. Claude Code installieren
Terminal öffnen (Mac: App „Terminal“ / Windows: „PowerShell“), Befehl einfügen, Enter:
- **Mac:** `curl -fsSL https://claude.ai/install.sh | bash`
- **Windows:** `irm https://claude.ai/install.ps1 | iex`
Der Befehl zeigt keinen Fortschritt an – einfach warten. Danach ein neues Terminal öffnen.

### 2. Projekt öffnen
- `ki-video-buero.zip` entpacken (z. B. in deinen Dokumente-Ordner)
- Im Terminal in den Ordner wechseln, z. B. `cd Documents/ki-video-buero`
- `claude` eingeben und Enter → beim ersten Mal mit deinem Claude-Konto anmelden

### 3. Den Rest erledigt Claude für dich
Schreib Claude Code einfach diesen Satz:
> Richte das Projekt ein: Prüf, ob ffmpeg, Python und Pillow installiert sind, und installier, was fehlt. Dann leg ein Git-Repo an.

Er fragt vor jedem Befehl, ob er darf – du drückst Enter zum Erlauben.

### 4. ElevenLabs verbinden
1. Bei elevenlabs.io einloggen → Profil → **API Keys** → neuen Schlüssel erstellen und kopieren
2. Unter **Voices** eine deutsche Stimme aussuchen und ihre **Voice ID** kopieren
3. Im Projektordner `.env.example` kopieren, Kopie `.env` nennen, beide Werte eintragen
   (oder Claude sagen: „Leg mir die .env an“ und die Werte dann selbst einfügen)
4. Test: Sag Claude „Teste die Stimme mit einem kurzen Satz“

Wichtig: Den Schlüssel nie in den Chat schreiben oder jemandem zeigen.

## Ein Video machen
Im Projektordner `claude` starten und eingeben:
```
/neues-video Lifehacks für Studenten
```
Dann passiert das:
1. Der **Ideen-Scout** zeigt dir 5 Ideen → du antwortest mit der Nummer
2. Der **Produzent** vertont, baut die Bilder und schneidet das Video
3. Der **Optimierer** prüft es und lässt Fehler reparieren
4. Du bekommst den Pfad zu `final.mp4` plus Caption und Hashtags

Das Video hochladen machst **du** selbst in der TikTok-App.

## Nach dem Posten (ein paar Tage später)
Sag Claude: „Trag für das Video *xy* ein: 12.000 Aufrufe, 800 Likes, 40 Kommentare“ – und dann `/review`.
So lernt das Büro, was bei deinem Publikum ankommt.

## Am Handy weitermachen
Wenn das Projekt auf GitHub ist (sag Claude: „Lade das Projekt in ein privates GitHub-Repo hoch“),
kannst du in der Claude-App unter **Code** eine Session damit starten und am Laptop mit
`claude --teleport` weitermachen.

## Alles nur am Handy (ohne Laptop)
Dann arbeitet das Büro in der Cloud. Voraussetzung: ein Pro- oder Max-Abo bei Claude und ein GitHub-Konto.

1. **GitHub-Repo anlegen:** Im Handy-Browser auf github.com → **New repository** → Name z. B. `ki-video-buero`,
   **Private**, Haken bei „Add a README“ → Create.
2. **Zip hochladen:** Im Repo **Add file → Upload files** → `ki-video-buero.zip` auswählen → **Commit changes**.
3. **Cloud-Umgebung einrichten** (einmal, im Handy-Browser auf claude.ai/code, Umgebung bearbeiten):
   - **Setup script:** `apt update && apt install -y ffmpeg && pip install pillow`
   - **Environment variables:** `ELEVENLABS_VOICE_ID=deine_stimmen_id`
   - **Network secrets → Add secret:** Host `api.elevenlabs.io`, Header-Name `xi-api-key`,
     Prefix leer lassen, Value = dein ElevenLabs-Schlüssel. So sieht Claude den Schlüssel nie.
4. **Session starten:** Claude-App → **Code** → Repo `ki-video-buero` wählen und schreiben:
   > Entpack ki-video-buero.zip ins Hauptverzeichnis (Inhalt des Ordners ki-video-buero direkt nach oben), lösch die Zip und committe.
5. **Video machen:** In einer neuen Session `/neues-video Thema` – wie am Laptop.
6. **Video aufs Handy holen:** Sag „Committe das fertige Video und pushe den Branch“. Dann auf GitHub
   im Branch `videos/<slug>/final.mp4` öffnen → herunterladen → in TikTok hochladen.

Hinweis: Ein Cloud-Rechner wird nach einer Weile Leerlauf abgeschaltet. Alles, was committet ist, bleibt erhalten.

## Wenn etwas hakt
Einfach Claude Code fragen: „Das hat nicht geklappt, was ist los?“ – er liest die Fehlermeldung selbst.
