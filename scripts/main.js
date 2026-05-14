// Natives HTML5-Audio
const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;
let fadeInterval = null; 

// Unser Langzeit-Gedächtnis für den Status vor dem System-Reset
const actorStates = new Map();

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
    
    // Nur für den eigenen Charakter des Spielers
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp?.value || 0;
    const deathSuccesses = actor.system.attributes.death?.success || 0;
    const deathFailures = actor.system.attributes.death?.failure || 0;
    const isDeadStatus = actor.statuses.has("dead");

    // Lade den vorherigen Zustand (oder Standardwerte)
    const prevState = actorStates.get(actor.id) || { hp: currentHp, success: 0, failure: 0, stabilized: false };
    let isStabilized = prevState.stabilized;

    // --- DIE NEUE, ROBUSTE STABILISIERUNGS-LOGIK ---

    // 1. Hat sich die HP geändert? (Schaden bekommen oder geheilt worden) -> Stabilisierung verfällt
    if (hasProperty(changes, "system.attributes.hp.value")) {
        isStabilized = false;
    }

    // 2. Hat das D&D 5e System die Würfe im Hintergrund gelöscht?
    const savesCleared = (prevState.success > 0 || prevState.failure > 0) && 
                         (deathSuccesses === 0 && deathFailures === 0);

    // Wenn Würfe gelöscht wurden, die HP noch 0 ist und der Charakter nicht tot ist -> Automatisch Stabilisiert!
    if (savesCleared && currentHp <= 0 && !isDeadStatus) {
        isStabilized = true;
    }

    // 3. Zur absoluten Sicherheit, falls wir die 3 Erfolge doch regulär abfangen können
    if (deathSuccesses >= 3) {
        isStabilized = true;
    }

    // Speichere den aktuellen Zustand für den nächsten Check im Gedächtnis
    actorStates.set(actor.id, {
        hp: currentHp,
        success: deathSuccesses,
        failure: deathFailures,
        stabilized: isStabilized
    });

    // --- ZUSTANDS-LOGIK ---
    const isDead = deathFailures >= 3 || isDeadStatus;
    
    // Sterbend ist man nur, wenn man 0 HP hat, NICHT tot ist und NICHT in unserem System als stabilisiert gilt
    const isDying = currentHp <= 0 && !isDead && !isStabilized;


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
        // Hier landet das Skript ab jetzt zielsicher, wenn das System heimlich auf 0/0 zurücksetzt!
        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        clearInterval(fadeInterval);
        heartbeatAudio.pause();
        heartbeatAudio.currentTime = 0;
    }
});