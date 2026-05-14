// Wir erstellen ein natives HTML5-Audio-Element. Das ist wesentlich robuster für UI-Sounds.
const heartbeatAudio = new Audio("modules/deaths-door/sounds/heartbeat.mp3");
heartbeatAudio.loop = true;
let fadeInterval = null; // Speichert den Fade-Timer

Hooks.once('ready', () => {
    console.log("Death's Door | Modul erfolgreich geladen und wachsam.");

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
    
    // Nur reagieren, wenn es der Charakter des aktuellen Spielers ist
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp?.value || 0;
    const deathSuccesses = actor.system.attributes.death?.success || 0;
    const deathFailures = actor.system.attributes.death?.failure || 0;
    const isDeadStatus = actor.statuses.has("dead");

    const isDead = deathFailures >= 3 || isDeadStatus;
    const isDying = currentHp <= 0 && deathSuccesses < 3 && !isDead;

    // --- DYNAMISCHES UI UPDATE ---
    const nextRollNumber = deathSuccesses + deathFailures + 1;
    $('#roll-death-save-btn').text(`Mach deinen ${nextRollNumber}. Todesrettungswurf!`);
    $('#dd-succ-val').text(deathSuccesses);
    $('#dd-fail-val').text(deathFailures);

    // --- LOGIK FÜR DEN TOD (LANGSAMES FADE OUT) ---
    if (isDead) {
        document.body.classList.remove('deaths-door-active');
        
        if (!document.body.classList.contains('deaths-door-dead')) {
            document.body.classList.add('deaths-door-dead');
            
            // Wenn der Sound läuft, blenden wir ihn sanft aus
            if (!heartbeatAudio.paused) {
                clearInterval(fadeInterval); // Stoppt eventuell laufende andere Fades
                
                fadeInterval = setInterval(() => {
                    let newVolume = heartbeatAudio.volume - 0.03;
                    
                    if (newVolume <= 0) {
                        heartbeatAudio.volume = 0;
                        heartbeatAudio.pause();
                        heartbeatAudio.currentTime = 0; // Spult den Sound zurück auf Anfang
                        clearInterval(fadeInterval);
                    } else {
                        heartbeatAudio.volume = newVolume;
                    }
                }, 250);
            }
        }
    } 
    // --- LOGIK FÜR DAS STERBEN (SOUND STARTEN) ---
    else if (isDying) {
        document.body.classList.remove('deaths-door-dead');

        if (!document.body.classList.contains('deaths-door-active')) {
            document.body.classList.add('deaths-door-active');
            
            clearInterval(fadeInterval); // Stoppt eventuell laufendes Ausfaden
            heartbeatAudio.volume = 0.6; // Setzt die Lautstärke auf Standard
            
            if (heartbeatAudio.paused) {
                heartbeatAudio.play().catch(err => {
                    console.warn("Death's Door | Browser hat Autoplay blockiert.", err);
                });
            }
        }
    } 
    // --- LOGIK FÜR LEBENDIG / STABIL (HARTES STOPPEN) ---
    else {
        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        // Sofortiger Stopp bei Heilung oder Stabilisierung
        clearInterval(fadeInterval);
        heartbeatAudio.pause();
        heartbeatAudio.currentTime = 0; // Spult den Sound zurück auf Anfang
    }
});