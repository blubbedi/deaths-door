const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;
const stabilizeAudio = new Audio("modules/deaths-door/sounds/stabilize.mp3");

let fadeInterval = null; 
const actorStates = new Map();

function updateTurnUI() {
    const actor = game.user.character;
    if (!actor) return;
    const isMyTurn = !game.combat || !game.combat.started || (game.combat.combatant?.actor?.id === actor.id);

    if (isMyTurn) {
        $('#roll-death-save-btn').show();
        $('#dd-wait-text').hide();
    } else {
        $('#roll-death-save-btn').hide();
        $('#dd-wait-text').show();
    }
}

Hooks.once('ready', () => {
    console.log("Death's Door | Aktiv und bereit.");

    const uiHtml = `
        <div id="deaths-door-flash-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: white; z-index: 999999; pointer-events: none; opacity: 0;"></div>
        <div id="deaths-door-blood-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: darkred; z-index: 999999; pointer-events: none; opacity: 0;"></div>
        <div id="deaths-door-ui">
            <div id="dd-wait-text">Warte auf deinen Zug...</div>
            <button class="deaths-door-btn" id="roll-death-save-btn">Todesrettungswurf!</button>
            <div class="dd-tracker-container">
                <div class="dd-success">E: <span id="dd-succ-val">0</span></div>
                <div class="dd-failure">F: <span id="dd-fail-val">0</span></div>
            </div>
        </div>
    `;
    $('body').append(uiHtml);

    $('#roll-death-save-btn').on('click', async () => {
        const actor = game.user.character;
        if (actor) await actor.rollDeathSave(); 
    });
});

// DER FIX FÜR RE-DEATH BEI 0 HP
Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp.value;
    const deathSuccesses = actor.system.attributes.death.success;
    const deathFailures = actor.system.attributes.death.failure;
    
    const prevState = actorStates.get(actor.id) || { hp: currentHp, success: 0, failure: 0, stabilized: false };
    let isStabilized = prevState.stabilized;

    // PRÜFUNG: Wurde der Charakter erschüttert?
    // Auch wenn HP 0 bleibt: Wenn ein HP-Update-Paket reinkommt, endet die Stabilisierung.
    const hpUpdateSent = hasProperty(changes, "system.attributes.hp.value");
    const failuresIncreased = deathFailures > prevState.failure;

    if (currentHp === 0 && (hpUpdateSent || failuresIncreased)) {
        isStabilized = false; 
    }

    // Wenn HP über 0 steigen, ist die Stabilisierung sowieso vorbei (Wach)
    if (currentHp > 0) isStabilized = false;

    // STABILISIERUNG AKTIVIEREN
    const savesCleared = (prevState.success > 0 || prevState.failure > 0) && (deathSuccesses === 0 && deathFailures === 0);
    if (savesCleared && currentHp <= 0) isStabilized = true;
    if (deathSuccesses >= 3 && prevState.success < 3) isStabilized = true;

    // STATUS BERECHNEN
    const isDead = deathFailures >= 3 || actor.statuses.has("dead");
    const isDying = currentHp <= 0 && !isDead && !isStabilized;

    actorStates.set(actor.id, { hp: currentHp, success: deathSuccesses, failure: deathFailures, stabilized: isStabilized, dying: isDying });

    // UI AKTUALISIEREN
    $('#dd-succ-val').text(deathSuccesses);
    $('#dd-fail-val').text(deathFailures);

    if (isDying) {
        document.body.classList.add('deaths-door-active');
        // Eskalationsstufen (fail-0, fail-1, fail-2)
        document.body.classList.remove('fail-0', 'fail-1', 'fail-2');
        document.body.classList.add(`fail-${Math.min(2, deathFailures)}`);
        
        updateTurnUI();
        if (heartbeatAudio.paused) heartbeatAudio.play();
        
        // Optisches Feedback bei Treffer (auch wenn HP 0 bleibt)
        if (hpUpdateSent || failuresIncreased) {
            document.getElementById('deaths-door-blood-overlay').animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 600 });
        }
    } else {
        document.body.classList.remove('deaths-door-active', 'fail-0', 'fail-1', 'fail-2');
        heartbeatAudio.pause();
    }

    if (isDead) document.body.classList.add('deaths-door-dead');
    else document.body.classList.remove('deaths-door-dead');
});