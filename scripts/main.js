// Natives HTML5-Audio
const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;
let fadeInterval = null; 

// Unser Kurzzeitgedächtnis: Merkt sich, welche Spieler stabilisiert sind
const stabilizedActors = new Set();

Hooks.once('ready', () => {
    console.log("Death's Door | Modul geladen. Überwache Lebenszeichen...");

    const uiHtml = `
        <div id="deaths-door-ui">
            <button class="deaths-door-btn" id="roll-death-save-btn">Mach deinen 1. Todesrettungswurf!</button>
            <div class="dd-tracker-container">
                <div class="dd-success">Geschafft: <span id="dd-succ-val">0</span>/3</div>
                <div class="dd-failure">Nicht geschafft: <span id="dd-fail-val">0</span>/3</div>
            </div>
        </div>
    `;
    $('body').append(uiHtml);

    $('#roll-death-save-btn').on('click', async () => {
        const actor = game.user.character;
        if (actor) {
            await actor.rollDeathSave(); 
        }
    });
});

Hooks.on('updateActor', (actor, changes, options, userId) => {
    
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp?.value || 0;
    const deathSuccesses = actor.system.attributes.death?.success || 0;
    const deathFailures = actor.system.attributes.death?.failure || 0;
    const isDeadStatus = actor.statuses.has("dead");

    // --- NEU: DAS STABILISIERUNGS-GEDÄCHTNIS ---
    // 1. Hat er gerade 3 Erfolge erreicht? Merken!
    if (deathSuccesses >= 3) {
        stabilizedActors.add(actor.id);
    }
    // 2. Wurde er geheilt? Aus dem Gedächtnis löschen!
    if (currentHp > 0) {
        stabilizedActors.delete(actor.id);
    }
    // 3. Hat er neuen Schaden kassiert (Fehlschläge steigen)? Aus dem Gedächtnis löschen!
    if (hasProperty(changes, "system.attributes.death.failure") && changes.system.attributes.death.failure > 0) {
        stabilizedActors.delete(actor.id);
    }

    // --- ZUSTANDS-LOGIK ---
    const isDead = deathFailures >= 3 || isDeadStatus;
    const isStable = stabilizedActors.has(actor.id);
    
    // Sterbend ist man jetzt nur noch, wenn man weder tot noch in unserem "stabil"-Gedächtnis ist
    const isDying = currentHp <= 0 && !isDead && !isStable;

    // --- UI AKTUALISIERUNG ---
    const nextRollNumber = deathSuccesses + deathFailures + 1;
    $('#roll-death-save-btn').text(`Mach deinen ${nextRollNumber}. Todesrettungswurf!`);
    $('#dd-succ-val').text(deathSuccesses);
    $('#dd-fail-val').text(deathFailures);

    // --- EFFEKT-STEUERUNG ---
    if (isDead) {
        document.body.classList.remove('deaths-door-active');
        
        if (!document.body.classList.contains('deaths-door-dead')) {
            document.body.classList.add('deaths-door-dead');
            
            if (!heartbeatAudio.paused) {
                clearInterval(fadeInterval);
                fadeInterval = setInterval(() => {
                    let newVolume = heartbeatAudio.volume - 0.03;
                    if (newVolume <= 0) {
                        heartbeatAudio.volume = 0;
                        heartbeatAudio.pause();
                        heartbeatAudio.currentTime = 0;
                        clearInterval(fadeInterval);
                    } else {
                        heartbeatAudio.volume = newVolume;
                    }
                }, 250);
            }
        }
    } 
    else if (isDying) {
        document.body.classList.remove('deaths-door-dead');

        if (!document.body.classList.contains('deaths-door-active')) {
            document.body.classList.add('deaths-door-active');
            
            clearInterval(fadeInterval);
            heartbeatAudio.volume = 0.6;
            
            if (heartbeatAudio.paused) {
                heartbeatAudio.play().catch(err => console.warn("Autoplay blockiert", err));
            }
        }
    } 
    else {
        // Hier landet das Skript jetzt auch sicher, wenn man stabilisiert ist
        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        clearInterval(fadeInterval);
        heartbeatAudio.pause();
        heartbeatAudio.currentTime = 0;
    }
});