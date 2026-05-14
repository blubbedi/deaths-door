let heartbeatSound = null; 

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

    // --- LOGIK FÜR DEN TOD (FADE OUT) ---
    if (isDead) {
        document.body.classList.remove('deaths-door-active');
        
        if (!document.body.classList.contains('deaths-door-dead')) {
            document.body.classList.add('deaths-door-dead');
            
            // Wenn der Sound ein Objekt ist (also fertig geladen) und noch nicht ausfadet
            if (heartbeatSound && typeof heartbeatSound === 'object' && !heartbeatSound.isFading) {
                heartbeatSound.isFading = true;
                let fadeVol = 0.6; 
                
                const fadeInterval = setInterval(() => {
                    if (heartbeatSound && typeof heartbeatSound.stop === 'function') {
                        fadeVol -= 0.03; 
                        heartbeatSound.volume = Math.max(0, fadeVol);
                        
                        if (fadeVol <= 0) {
                            heartbeatSound.stop();
                            heartbeatSound = null;
                            clearInterval(fadeInterval);
                        }
                    } else {
                        clearInterval(fadeInterval);
                    }
                }, 250); 
            } 
            // Falls der Sound noch im Ladevorgang war, brich ihn sofort ab
            else if (heartbeatSound === "loading") {
                heartbeatSound = "cancelled";
            }
        }
    } 
    // --- LOGIK FÜR DAS STERBEN ---
    else if (isDying) {
        document.body.classList.remove('deaths-door-dead');

        if (!document.body.classList.contains('deaths-door-active')) {
            document.body.classList.add('deaths-door-active');
            
            // Verhindert die Race Condition: Wir markieren den Sound sofort als "loading"
            if (!heartbeatSound) {
                heartbeatSound = "loading"; 
                
                AudioHelper.play({
                    src: "modules/deaths-door/sounds/heartbeat.mp3", 
                    volume: 0.6,
                    loop: true
                }, true).then(sound => {
                    // Wenn in der Zwischenzeit niemand den Sound abgebrochen hat, speichern wir ihn
                    if (heartbeatSound === "loading") {
                        heartbeatSound = sound;
                    } else {
                        // Wurde der Charakter in den Millisekunden des Ladens schon wieder geheilt/getötet -> Stop!
                        sound.stop();
                    }
                });
            } else if (typeof heartbeatSound === 'object') {
                // Sound läuft bereits, setze Volumen zurück falls er am Faden war
                heartbeatSound.isFading = false;
                heartbeatSound.volume = 0.6;
            }
        }
    } 
    // --- LOGIK FÜR LEBENDIG / STABIL ---
    else {
        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        // Stoppt den Sound hart
        if (heartbeatSound && typeof heartbeatSound === 'object') {
            heartbeatSound.stop();
            heartbeatSound = null;
        } 
        // Bricht den Ladevorgang ab, falls er gerade passiert
        else if (heartbeatSound === "loading") {
            heartbeatSound = "cancelled";
        }
    }
});