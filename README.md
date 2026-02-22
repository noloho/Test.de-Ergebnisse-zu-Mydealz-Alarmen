# Test.de -> Mydealz Deal-Alarme

Firefox-Erweiterung zum Erstellen von Mydealz-Deal-Alarmen aus Produktnamen auf test.de-Ergebnisseiten (auch mit Filtern und Pagination).

## Funktionen
- Scannt Produkte auf test.de-Ergebnisseiten.
- Optionaler Probelauf (nur Vorschau, keine Alarme).
- Automatisches Einbeziehen aller Seiten (basierend auf der Trefferzahl, 15 pro Seite).
- Erstellung von Deal-Alarmen über den eingeloggten Mydealz-Account.

## Installation (Temporär, Firefox)
1. Öffne `about:debugging#/runtime/this-firefox`
2. Klicke auf **„Load Temporary Add-on…“**
3. Wähle `src/manifest.json`

## Nutzung
1. Öffne eine test.de-Ergebnisseite (ggf. mit Filtern).
2. Öffne das Erweiterungs-Popup über das Symbol in der Toolbar.
3. Klicke **„test.de-Seite scannen“**.
4. Optional: **„Probelauf“** aktiviert lassen, um nur die Liste zu prüfen.
5. Klicke **„Deal-Alarme erstellen“**.

## Einstellungen
In den Einstellungen kannst du u. a. die Temperatur sowie Min-/Max-Preis und Benachrichtigungsoptionen festlegen.

## Hinweise
- Du musst bei test.de eingeloggt sein (Abo erforderlich), damit die Produktliste im DOM verfügbar ist.
- Du musst bei mydealz eingeloggt sein, um Deal-Alarme erstellen zu können.

## Screenshots
Werden später ergänzt.
