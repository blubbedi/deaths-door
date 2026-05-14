let heartbeatSound = null; // Speichert den laufenden Sound, um ihn später stoppen zu können

Hooks.once('ready', () => {
    console.log("Death's Door | Modul erfolgreich geladen und wachsam.");

    // 1. Wir injizieren das Schicksals-UI direkt in den HTML-Body von Foundry
    const uiHtml = `
        <div id="deaths-door-ui">
            <button class="deaths-door-btn" id="roll-death-save-btn">Stelle dich dem Schicksal</button>
        </div>
    `;
    $('body').append(uiHtml);

    // 2. Wir geben dem Button seine Funktion
    $('#roll-death-save-btn').on('click', async () => {
        const actor = game.user.character;
        if (actor) {
            // Löst das native dnd5e Makro für den Todesrettungswurf aus
            await actor.rollDeathSave(); 
        }
    });
});

Hooks.on('updateActor', async (actor, changes, options, userId) => {
    
    if (game.user.character?.id !== actor.id) return;

    if (hasProperty(changes, "system.attributes.hp")) {
        const currentHp = getProperty(changes, "system.attributes.hp.value") ?? actor.system.attributes.hp.value;
        
        if (currentHp <= 0) {
            // Verhindert, dass der Effekt mehrfach ausgelöst wird, wenn man bereits auf 0 HP ist
            if (!document.body.classList.contains('deaths-door-active')) {
                document.body.classList.add('deaths-door-active');
                
                // 3. Audio abspielen (loop = true)
                if (!heartbeatSound) {
                    heartbeatSound = await AudioHelper.play({
                        src: "modules/deaths-door/sounds/heartbeat.mp3",
                        volume: 0.6,
                        loop: true
                    }, true); // Das 'true' am Ende ist wichtig, damit es als lokaler Sound gespielt wird
                }
            }
        } 
        else {
            if (document.body.classList.contains('deaths-door-active')) {
                document.body.classList.remove('deaths-door-active');
                
                // 4. Audio stoppen, wenn der Spieler geheilt wird
                if (heartbeatSound) {
                    heartbeatSound.stop();
                    heartbeatSound = null;
                }
            }
        }
    }
});