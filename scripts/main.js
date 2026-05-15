const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;
const stabilizeAudio = new Audio("modules/deaths-door/sounds/stabilize.mp3");

let fadeInterval = null; 
const actorStates = new Map();

function updateTurnUI() {
    const actor = game.user.character;
    if (!actor) return;
    const combat = game.combat;
    const isMyTurn = !combat || !combat.started || (combat.combatant?.actor?.id === actor.id);

    if (isMyTurn) {
        $('#roll-death-save-btn').show();
        $('#dd-wait-text').hide();
    } else {
        $('#roll-death-save-btn').hide();
        $('#dd-wait-text').show();
    }
}

Hooks.once('ready', () => {
    console.log("Death's Door | Modul geladen. Alle D&D 5e Nahtod-Regeln erfasst.");

    // Flash-Overlays für Rettung (Weiß) und Schaden (Rot) injizieren
    const uiHtml = `
        <div id="deaths-door-flash-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: white; z-index: 999999; pointer-events: none; opacity: 0;"></div>
        <div id="deaths-door-blood-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: darkred; z-index: 999999; pointer-events: none; opacity: 0;"></div>
        
        <div id="deaths-door-ui">
            <div id="dd-wait-text">Warte auf deinen Zug...</div>
            <button class="deaths-door-btn" id="roll-death-save-btn">Mach deinen Todesrettungswurf!</button>
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

// Listener für Kampf-Fortschritt
Hooks.on('updateCombat', () => { if (document.body.classList.contains('deaths-door-active')) updateTurnUI(); });
Hooks.on('deleteCombat', () => { if (document.body.classList.contains('deaths-door-active')) updateTurnUI(); });

Hooks.on('updateActor', (actor, changes, options, userId) => {
    
    // Nur reagieren, wenn es der Charakter des jeweiligen Spielers ist
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp?.value || 0;
    const deathSuccesses = actor.system.attributes.death?.success || 0;
    const deathFailures = actor.system.attributes.death?.failure || 0;
    const isDeadStatus = actor.statuses.has("dead");

    const prevState = actorStates.get(actor.id) || { hp: currentHp, success: 0, failure: 0, stabilized: false, dying: false };
    let isStabilized = prevState.stabilized;

    // HP hat sich geändert -> Stabilisierung verfällt, falls man wieder fällt
    if (hasProperty(changes, "system.attributes.hp.value")) isStabilized = false;

    // Erkennung heimlicher System-Resets
    const savesCleared = (prevState.success > 0 || prevState.failure > 0) && (deathSuccesses === 0 && deathFailures === 0);
    if (savesCleared && currentHp <= 0 && !isDeadStatus) isStabilized = true;
    if (deathSuccesses >= 3) isStabilized = true;

    const isDead = deathFailures >= 3 || isDeadStatus;
    const isDying = currentHp <= 0 && !isDead && !isStabilized;

    const wasDying = prevState.dying;
    const justRecovered = wasDying && !isDying && !isDead;
    
    // ERKENNUNG VON TREFFERN & NATÜRLICHER 1 WÄHREND MAN LIEGT
    const tookDamageWhileDown = isDying && (deathFailures > prevState.failure);

    actorStates.set(actor.id, {
        hp: currentHp,
        success: deathSuccesses,
        failure: deathFailures,
        stabilized: isStabilized,
        dying: isDying
    });

    // UI aktualisieren
    $('#dd-succ-val').text(deathSuccesses);
    $('#dd-fail-val').text(deathFailures);

    // Herzschlag-Puls anpassen
    const speed = Math.max(0.6, 1.0 - (deathFailures * 0.2));
    heartbeatAudio.playbackRate = speed;

    document.body.classList.remove('fail-0', 'fail-1', 'fail-2');

    if (isDying) {
        document.body.classList.add(`fail-${Math.min(2, deathFailures)}`);
        updateTurnUI();
        
        // VISUELLES FEEDBACK FÜR TREFFER BEI 0 HP ODER NAT 1
        if (tookDamageWhileDown) {
            document.body.classList.add('dd-shaking');
            setTimeout(() => document.body.classList.remove('dd-shaking'), 400); // Schütteln beenden
            
            const bloodOverlay = document.getElementById('deaths-door-blood-overlay');
            if (bloodOverlay) {
                bloodOverlay.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 800, easing: 'ease-out' });
            }
        }
    }

    if (isDead) {
        if (!document.body.classList.contains('deaths-door-dead')) {
            document.body.classList.add('deaths-door-dead');
            if (!heartbeatAudio.paused) {
                clearInterval(fadeInterval);
                fadeInterval = setInterval(() => {
                    let newVolume = heartbeatAudio.volume - 0.03;
                    if (newVolume <= 0) {
                        heartbeatAudio.volume = 0; heartbeatAudio.pause(); heartbeatAudio.currentTime = 0; clearInterval(fadeInterval);
                    } else { heartbeatAudio.volume = newVolume; }
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
            if (heartbeatAudio.paused) { heartbeatAudio.play().catch(err => console.warn("Autoplay blockiert", err)); }
        }
    } 
    else {
        if (justRecovered) {
            const flashOverlay = document.getElementById('deaths-door-flash-overlay');
            if (flashOverlay) {
                flashOverlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1500, easing: 'ease-out' });
                try { stabilizeAudio.volume = 0.7; stabilizeAudio.currentTime = 0; stabilizeAudio.play().catch(() => {}); } catch(e) { }
            }
        }
        document.body.classList.remove('deaths-door-active', 'deaths-door-dead');
        clearInterval(fadeInterval);
        heartbeatAudio.pause();
        heartbeatAudio.currentTime = 0;
    }
});