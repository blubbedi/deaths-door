// Natives HTML5-Audio für maximale Zuverlässigkeit beim Stoppen/Faden
const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;
let fadeInterval = null; 

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

    // Aktuelle Werte abgreifen
    const currentHp = actor.system.attributes.hp?.value || 0;
    const deathSuccesses = actor.system.attributes.death?.success || 0;
    const deathFailures = actor.system.attributes.death?.failure || 0;
    const isDeadStatus = actor.statuses.has("dead");

    // ZUSTANDS-LOGIK
    // 1. Tot: 3 Fails oder manueller Status "tot"
    const isDead = deathFailures >= 3 || isDeadStatus;
    
    // 2. Sterbend: 0 HP UND noch nicht 3 Erfolge UND noch nicht tot
    const isDying = currentHp <= 0 && deathSuccesses < 3 && !isDead;

    // 3. Stabilisiert/Geheilt: (HP > 0) ODER (0 HP aber 3 Erfolge erreicht)
    const isStableOrHealed = currentHp > 0 || (currentHp <= 0 && deathSuccesses >= 3);

    // --- UI AKTUALISIERUNG ---
    const nextRollNumber = deathSuccesses + deathFailures + 1;
    $('#roll-death-save-btn').text(`Mach deinen ${nextRollNumber}. Todesrettungswurf!`);
    $('#dd-succ-val').text(deathSuccesses);
    $('#dd-fail-val').text(deathFailures);

    // --- FALL 1: CHARAKTER STIRBT (Fade-Out) ---
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
    // --- FALL 2: CHARAKTER IST STERBEND (Effekt an) ---
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
    // --- FALL 3: CHARAKTER STABIL ODER GEHEILT (Effekt sofort aus) ---
    else if (isStableOrHealed) {
        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        // Sound sofort stoppen
        clearInterval(fadeInterval);
        heartbeatAudio.pause();
        heartbeatAudio.currentTime = 0;
    }
});