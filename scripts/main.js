// Natives HTML5-Audio für maximale Zuverlässigkeit
const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;
let fadeInterval = null; 

// Unser Langzeit-Gedächtnis für den Status vor dem System-Reset
const actorStates = new Map();

Hooks.once('ready', () => {
    console.log("Death's Door | Modul geladen. Tunnelblick & Dynamischer Puls aktiv.");

    // Das Schicksals-UI in Foundry injizieren
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

    // Klick-Event für den Button (würfelt den Rettungswurf)
    $('#roll-death-save-btn').on('click', async () => {
        const actor = game.user.character;
        if (actor) {
            await actor.rollDeathSave(); 
        }
    });
});

Hooks.on('updateActor', (actor, changes, options, userId) => {
    
    // Nur für den eigenen Charakter des Spielers reagieren
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp?.value || 0;
    const deathSuccesses = actor.system.attributes.death?.success || 0;
    const deathFailures = actor.system.attributes.death?.failure || 0;
    const isDeadStatus = actor.statuses.has("dead");

    // Lade den vorherigen Zustand aus unserem Gedächtnis
    const prevState = actorStates.get(actor.id) || { hp: currentHp, success: 0, failure: 0, stabilized: false };
    let isStabilized = prevState.stabilized;

    // --- STABILISIERUNGS-LOGIK ---
    // 1. HP geändert -> Stabilisierung verfällt
    if (hasProperty(changes, "system.attributes.hp.value")) {
        isStabilized = false;
    }

    // 2. Hat das System heimlich die Würfe gelöscht?
    const savesCleared = (prevState.success > 0 || prevState.failure > 0) && 
                         (deathSuccesses === 0 && deathFailures === 0);

    // Wenn gelöscht + HP auf 0 + nicht tot -> Automatisch Stabilisiert
    if (savesCleared && currentHp <= 0 && !isDeadStatus) {
        isStabilized = true;
    }

    // 3. Wenn 3 Erfolge regulär erreicht wurden
    if (deathSuccesses >= 3) {
        isStabilized = true;
    }

    // Aktuellen Zustand speichern
    actorStates.set(actor.id, {
        hp: currentHp,
        success: deathSuccesses,
        failure: deathFailures,
        stabilized: isStabilized
    });

    // --- ZUSTANDS-ERMITTLUNG ---
    const isDead = deathFailures >= 3 || isDeadStatus;
    const isDying = currentHp <= 0 && !isDead && !isStabilized;

    // --- UI AKTUALISIERUNG ---
    const nextRollNumber = deathSuccesses + deathFailures + 1;
    $('#roll-death-save-btn').text(`Mach deinen ${nextRollNumber}. Todesrettungswurf!`);
    $('#dd-succ-val').text(deathSuccesses);
    $('#dd-fail-val').text(deathFailures);

    // --- SOUND-GESCHWINDIGKEIT ---
    // Standard ist 1.0. Bei jedem Fail wird es 20% langsamer (0.8 -> 0.6).
    const speed = Math.max(0.6, 1.0 - (deathFailures * 0.2));
    heartbeatAudio.playbackRate = speed;

    // --- EFFEKT-STEUERUNG ---
    if (isDead) {
        document.body.classList.remove('deaths-door-active');
        
        if (!document.body.classList.contains('deaths-door-dead')) {
            document.body.classList.add('deaths-door-dead');
            
            // Sound langsam ausfaden
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
        // Spieler ist am Leben oder stabilisiert
        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        clearInterval(fadeInterval);
        heartbeatAudio.pause();
        heartbeatAudio.currentTime = 0;
    }
});