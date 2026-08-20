// SNHOP Gamification Engine - XP Tracker and Achievement Badges

const Gamification = {
    KEYS: {
        XP: 'nhai_driver_xp',
        LEVEL: 'nhai_driver_level',
        ACHIEVEMENTS: 'nhai_unlocked_achievements'
    },

    levels: [
        { lvl: 1, name: 'Highway Cadet', xpNeeded: 500, titleColor: '#8da672' },
        { lvl: 2, name: 'Eco Cruise Driver', xpNeeded: 1000, titleColor: '#3b82f6' },
        { lvl: 3, name: 'Toll Master', xpNeeded: 2000, titleColor: '#fcd34d' },
        { lvl: 4, name: 'Highway Legend', xpNeeded: 5000, titleColor: '#10b981' }
    ],

    init: () => {
        Gamification.refreshUI();
        
        // Listening for storage synchronization updates
        window.addEventListener('local-storage-update', () => {
            Gamification.refreshUI();
        });
    },

    getXP: () => {
        return parseInt(localStorage.getItem(Gamification.KEYS.XP) || '150');
    },

    getLevel: () => {
        return parseInt(localStorage.getItem(Gamification.KEYS.LEVEL) || '1');
    },

    getAchievements: () => {
        try {
            return JSON.parse(localStorage.getItem(Gamification.KEYS.ACHIEVEMENTS) || '{}');
        } catch(e) {
            return {};
        }
    },

    addXP: (amount, reason) => {
        let xp = Gamification.getXP();
        let lvlVal = Gamification.getLevel();
        
        xp += amount;
        localStorage.setItem(Gamification.KEYS.XP, xp.toString());
        
        Gamification.playXpAnimation(amount, reason);

        // Verify Level Up
        let activeLvl = Gamification.levels.find(l => l.lvl === lvlVal) || Gamification.levels[0];
        if (xp >= activeLvl.xpNeeded && lvlVal < 4) {
            lvlVal++;
            localStorage.setItem(Gamification.KEYS.LEVEL, lvlVal.toString());
            
            // Level Up alert celebration
            setTimeout(() => {
                Utils.showToast(`🎉 LEVEL UP! You reached Level ${lvlVal}: ${Gamification.levels[lvlVal-1].name}!`, 'success');
                if (window.VoiceAssistant) {
                    window.VoiceAssistant.speak(`Congratulations! You leveled up to Level ${lvlVal}. You are now a ${Gamification.levels[lvlVal-1].name}.`);
                }
            }, 2500);
        }

        Gamification.refreshUI();
        
        // Dispatch local-storage-update to notify other views/widgets
        window.dispatchEvent(new Event('local-storage-update'));
    },

    unlockAchievement: (id, name, xpReward = 200) => {
        const achs = Gamification.getAchievements();
        if (achs[id]) return; // Already unlocked!

        achs[id] = true;
        localStorage.setItem(Gamification.KEYS.ACHIEVEMENTS, JSON.stringify(achs));
        
        Utils.showToast(`🏆 Badge Unlocked: ${name}!`, 'success');
        Gamification.addXP(xpReward, `Badge: ${name}`);
    },

    refreshUI: () => {
        const xp = Gamification.getXP();
        const levelVal = Gamification.getLevel();
        const achs = Gamification.getAchievements();

        const activeLvl = Gamification.levels.find(l => l.lvl === levelVal) || Gamification.levels[0];
        
        // Update labels
        const lvlTitle = document.getElementById('gamified-lvl-title');
        const lvlBadge = document.getElementById('gamified-lvl-badge');
        const xpText = document.getElementById('gamified-xp-text');
        const xpPct = document.getElementById('gamified-xp-pct');
        const xpBar = document.getElementById('gamified-xp-bar');

        if (lvlTitle) {
            lvlTitle.innerText = `Level ${levelVal} ${activeLvl.name}`;
            lvlTitle.style.color = activeLvl.titleColor || '#fff';
        }
        if (lvlBadge) {
            lvlBadge.innerText = levelVal;
            lvlBadge.style.boxShadow = `0 0 12px ${activeLvl.titleColor || 'var(--primary)'}`;
            lvlBadge.style.background = activeLvl.titleColor || 'var(--primary)';
        }
        
        const currentLimit = activeLvl.xpNeeded;
        const currentPct = Math.min(100, Math.floor((xp / currentLimit) * 100));
        
        if (xpText) {
            if (window.animateNumber) {
                // Remove existing text to handle animation
                xpText.innerText = '';
                // Since animateNumber doesn't support changing suffix dynamically on the fly based on a secondary limit easily, we can just animate the XP value.
                window.animateNumber('gamified-xp-text', xp, '', ` / ${currentLimit} XP`);
            } else {
                xpText.innerText = `${xp} / ${currentLimit} XP`;
            }
        }
        
        if (xpPct) {
            if (window.animateNumber) window.animateNumber('gamified-xp-pct', currentPct, '', '%');
            else xpPct.innerText = `${currentPct}%`;
        }
        
        if (xpBar) xpBar.style.width = `${currentPct}%`;

        // Refresh Badge statuses
        const badgeIds = ['face_verified', 'first_trip', 'fuel_stop', 'highway_guardian'];
        badgeIds.forEach(id => {
            const badgeEl = document.getElementById(`badge-${id}`);
            if (badgeEl) {
                if (achs[id]) {
                    badgeEl.style.opacity = '1.0';
                    badgeEl.style.background = 'rgba(100,255,218,0.06)';
                    badgeEl.style.borderColor = 'rgba(100,255,218,0.2)';
                    badgeEl.style.transform = 'scale(1.05)';
                    badgeEl.title = `UNLOCKED: ${badgeEl.title.split(': ')[1]}`;
                } else {
                    badgeEl.style.opacity = '0.35';
                    badgeEl.style.background = 'rgba(0,0,0,0.25)';
                    badgeEl.style.borderColor = 'transparent';
                    badgeEl.style.transform = 'none';
                }
            }
        });
    },

    playXpAnimation: (amount, reason) => {
        const pop = document.createElement('div');
        pop.className = 'xp-pop-animate';
        pop.innerHTML = `
            <span style="font-size: 14px; font-weight: 800; color: var(--primary);">+${amount} XP</span>
            <div style="font-size: 9px; color: var(--text-sec); margin-top: 2px;">${reason}</div>
        `;
        document.body.appendChild(pop);
        
        Object.assign(pop.style, {
            position: 'fixed',
            bottom: '40px',
            right: '40px',
            zIndex: '100000',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '2px solid var(--primary)',
            boxShadow: '0 4px 15px rgba(100,255,218,0.3)',
            borderRadius: '10px',
            padding: '10px 16px',
            textAlign: 'center',
            fontFamily: 'var(--font-main)',
            opacity: '0',
            transform: 'translateY(25px)',
            transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });
        
        // Trigger reflow
        pop.offsetHeight;
        
        pop.style.opacity = '1';
        pop.style.transform = 'translateY(0)';
        
        setTimeout(() => {
            pop.style.opacity = '0';
            pop.style.transform = 'translateY(-30px)';
            setTimeout(() => pop.remove(), 600);
        }, 2500);
    }
};

window.Gamification = Gamification;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        Gamification.init();
    }, 100);
});
