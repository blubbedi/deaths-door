// Natives HTML5-Audio für maximale Zuverlässigkeit
const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;

// Der neue Sound für die Stabilisierung / Heilung
const stabilizeAudio = new Audio("modules/deaths-door/sounds/stabilize.mp3");

let fadeInterval = null; 
const actorStates = new Map();

Hooks.once('ready', () => {
    console.log("Death's Door | Modul geladen. Tunnelblick & Flash aktiv.");

    // Flash-Overlay und UI-Container injizieren
    const uiHtml = `
        <div id="deaths-door-flash-overlay" style="z-index: 999999;"></div>
        
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

    // Wir laden den vorherigen Zustand aus dem Gedächtnis, inkl. "dying" (war er gerade noch sterbend?)
    const prevState = actorStates.get(actor.id) || { hp: currentHp, success: 0, failure: 0, stabilized: false, dying: false };
    let isStabilized = prevState.stabilized;

    // --- STABILISIERUNGS-LOGIK ---
    if (hasProperty(changes, "system.attributes.hp.value")) {
        isStabilized = false;
    }

    const savesCleared = (prevState.success > 0 || prevState.failure > 0) && 
                         (deathSuccesses === 0 && deathFailures === 0);

    if (savesCleared && currentHp <= 0 && !isDeadStatus) {
        isStabilized = true;
    }

    if (deathSuccesses >= 3) {
        isStabilized = true;
    }

    // --- ZUSTANDS-ERMITTLUNG ---
    const isDead = deathFailures >= 3 || isDeadStatus;
    const isDying = currentHp <= 0 && !isDead && !isStabilized;

    // --- DIE NEUE FLASH-ABFRAGE ---
    // War er beim letzten Check noch am Sterben, ist aber JETZT weder sterbend noch tot? (Also gerettet/geheilt!)
    const wasDying = prevState.dying;
    const justRecovered = wasDying && !isDying && !isDead;

    // Speichere den aktuellen Zustand fürs nächste Mal ab
    actorStates.set(actor.id, {
        hp: currentHp,
        success: deathSuccesses,
        failure: deathFailures,
        stabilized: isStabilized,
        dying: isDying
    });

    // --- UI AKTUALISIERUNG ---
    const nextRollNumber = deathSuccesses + deathFailures + 1;
    $('#roll-death-save-btn').text(`Mach deinen ${nextRollNumber}. Todesrettungswurf!`);
    $('#dd-succ-val').text(deathSuccesses);
    $('#dd-fail-val').text(deathFailures);

    // --- SOUND-GESCHWINDIGKEIT ---
    const speed = Math.max(0.6, 1.0 - (deathFailures * 0.2));
    heartbeatAudio.playbackRate = speed;

    // --- EFFEKT-STEUERUNG ---
    if (isDead) {
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
        // --- DER WEISSE BLITZ & SOUND (STABIL / GEHEILT) ---
        // Die neue Abfrage löst 100% zielsicher aus
        if (justRecovered) {
            const flashOverlay = document.getElementById('deaths-door-flash-overlay');
            if (flashOverlay) {
                flashOverlay.classList.remove('flash-active');
                void flashOverlay.offsetWidth; // Erzwingt Neuladen der Animation
                flashOverlay.classList.add('flash-active');
                
                // Sound abspielen (mit try-catch, falls die Datei noch fehlt)
                try {
                    stabilizeAudio.volume = 0.7; 
                    stabilizeAudio.currentTime = 0;
                    stabilizeAudio.play().catch(() => {});
                } catch(e) {
                    console.warn("Death's Door | Stabilize Sound nicht gefunden.");
                }

                // Aufräumen der CSS-Klasse
                setTimeout(() => {
                    flashOverlay.classList.remove('flash-active');
                }, 1500);
            }
        }

        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        clearInterval(fadeInterval);
        heartbeatAudio.pause();
        heartbeatAudio.currentTime = 0;
    }
});