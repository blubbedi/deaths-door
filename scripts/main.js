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
    console.log("Death's Door | Deep-Logic-Fix geladen.");

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

Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp.value;
    const successes = actor.system.attributes.death.success;
    const failures = actor.system.attributes.death.failure;
    const isDeadStatus = actor.statuses.has("dead") || failures >= 3;

    // Lade alten Zustand oder erstelle Standard
    const prev = actorStates.get(actor.id) || { hp: currentHp, succ: successes, fail: failures, stabilized: false, dying: false };

    let nowStabilized = prev.stabilized;

    // --- RE-DEATH LOGIK (Erschütterung bei 0 HP) ---
    const hpChanged = hasProperty(changes, "system.attributes.hp.value");
    const failChanged = failures > prev.fail;

    if (currentHp === 0 && (hpChanged || failChanged)) {
        nowStabilized = false; // Schaden bricht Stabilität sofort
    }

    // --- STABILISIERUNGS LOGIK ---
    if (currentHp > 0) {
        nowStabilized = false;
    } else {
        const savesReset = (prev.succ > 0 || prev.fail > 0) && (successes === 0 && failures === 0);
        const reachedThreeSucc = (successes >= 3 && prev.succ < 3);
        if (savesReset || reachedThreeSucc) {
            nowStabilized = true;
        }
    }

    const isDying = currentHp <= 0 && !isDeadStatus && !nowStabilized;

    // --- EFFEKTE TRIGGERN ---
    
    // 1. FLASH & SOUND: Wenn man gerade stabilisiert wurde
    if (nowStabilized && !prev.stabilized) {
        const flash = document.getElementById('deaths-door-flash-overlay');
        flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1500 });
        stabilizeAudio.play().catch(() => {});
    }

    // 2. BLOOD FLASH: Wenn man Schaden bei 0 HP frisst (egal ob sterbend oder stabil)
    if (currentHp === 0 && (hpChanged || failChanged)) {
        document.getElementById('deaths-door-blood-overlay').animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 600 });
    }

    // --- UI & KLASSEN ---
    $('#dd-succ-val').text(successes);
    $('#dd-fail-val').text(failures);

    if (isDying) {
        document.body.classList.add('deaths-door-active');
        document.body.classList.remove('fail-0', 'fail-1', 'fail-2');
        document.body.classList.add(`fail-${Math.min(2, failures)}`);
        if (heartbeatAudio.paused) heartbeatAudio.play();
        updateTurnUI();
    } else {
        document.body.classList.remove('deaths-door-active', 'fail-0', 'fail-1', 'fail-2');
        heartbeatAudio.pause();
    }

    if (isDeadStatus) document.body.classList.add('deaths-door-dead');
    else document.body.classList.remove('deaths-door-dead');

    // Zustand für das nächste Mal speichern
    actorStates.set(actor.id, { hp: currentHp, succ: successes, fail: failures, stabilized: nowStabilized, dying: isDying });
});