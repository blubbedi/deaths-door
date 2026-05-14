let heartbeatSound = null; 

Hooks.once('ready', () => {
    console.log("Death's Door | Modul erfolgreich geladen und wachsam.");

    const uiHtml = `
        <div id="deaths-door-ui">
            <button class="deaths-door-btn" id="roll-death-save-btn">Stelle dich dem Schicksal</button>
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

Hooks.on('updateActor', async (actor, changes, options, userId) => {
    
    if (game.user.character?.id !== actor.id) return;

    const currentHp = actor.system.attributes.hp?.value || 0;
    const deathSuccesses = actor.system.attributes.death?.success || 0;
    const deathFailures = actor.system.attributes.death?.failure || 0;
    const isDeadStatus = actor.statuses.has("dead");

    const isDead = deathFailures >= 3 || isDeadStatus;
    const isDying = currentHp <= 0 && deathSuccesses < 3 && !isDead;

    if (isDead) {
        document.body.classList.remove('deaths-door-active');
        
        if (!document.body.classList.contains('deaths-door-dead')) {
            document.body.classList.add('deaths-door-dead');
            
            if (heartbeatSound && !heartbeatSound.isFading) {
                heartbeatSound.isFading = true;
                let fadeVol = 0.6; 
                
                const fadeInterval = setInterval(() => {
                    if (heartbeatSound) {
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
        }
    } 
    else if (isDying) {
        document.body.classList.remove('deaths-door-dead');

        if (!document.body.classList.contains('deaths-door-active')) {
            document.body.classList.add('deaths-door-active');
            
            if (!heartbeatSound) {
                heartbeatSound = await AudioHelper.play({
                    src: "modules/deaths-door/sounds/heartbeat.mp3", 
                    volume: 0.6,
                    loop: true
                }, true); 
            } else {
                heartbeatSound.isFading = false;
                heartbeatSound.volume = 0.6;
            }
        }
    } 
    else {
        document.body.classList.remove('deaths-door-active');
        document.body.classList.remove('deaths-door-dead');
        
        if (heartbeatSound) {
            heartbeatSound.stop();
            heartbeatSound = null;
        }
    }
});