// Dieser Hook wird ausgelöst, sobald Foundry vollständig geladen ist
Hooks.once('ready', () => {
    console.log("Death's Door | Modul erfolgreich geladen.");
});

// Dieser Hook überwacht jede Änderung an einem Akteur (Schaden, Heilung, etc.)
Hooks.on('updateActor', (actor, changes, options, userId) => {
    
    // WICHTIG: Das Skript darf nur für den Spieler ausgeführt werden, dem der Charakter gehört.
    // So stellen wir sicher, dass nicht alle Bildschirme grau werden, wenn ein Goblin stirbt.
    if (game.user.character?.id !== actor.id) return;

    // Wir prüfen, ob die Änderungen die Lebenspunkte (HP) betreffen
    if (changes.system?.attributes?.hp !== undefined) {
        
        // Hole den neuen HP-Wert
        const currentHp = changes.system.attributes.hp.value ?? actor.system.attributes.hp.value;
        
        // Logik: 0 HP oder weniger löst den Effekt aus
        if (currentHp <= 0) {
            document.body.classList.add('deaths-door-active');
            console.log("Death's Door | Der Charakter hat die Schwelle überschritten.");
        } else {
            // Wird der Charakter geheilt, entfernen wir den Effekt
            document.body.classList.remove('deaths-door-active');
            console.log("Death's Door | Der Charakter ist ins Leben zurückgekehrt.");
        }
    }
});