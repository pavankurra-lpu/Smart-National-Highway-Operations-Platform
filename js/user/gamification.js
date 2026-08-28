// SNHOP Gamification Engine - 8-Tier Driver Level & Achievement System

const Gamification = {
    KEYS: {
        XP: 'nhai_driver_xp',
        LEVEL: 'nhai_driver_level',
        ACHIEVEMENTS: 'nhai_unlocked_achievements',
        LAST_CHECKIN: 'nhai_last_daily_checkin'
    },

    levels: [
        { lvl: 1, name: 'Highway Cadet', xpNeeded: 500, titleColor: '#94a3b8', badgeBg: 'linear-gradient(135deg, #64748b, #475569)', icon: '🔰', perk: 'Standard Route Intelligence & 1033 SOS' },
        { lvl: 2, name: 'Eco Cruiser', xpNeeded: 1200, titleColor: '#3b82f6', badgeBg: 'linear-gradient(135deg, #2563eb, #3b82f6)', icon: '🌱', perk: '2% FASTag Cashback + Fuel Station Finder' },
        { lvl: 3, name: 'Corridor Navigator', xpNeeded: 2500, titleColor: '#3b82f6', badgeBg: 'linear-gradient(135deg, #2563eb, #3b82f6)', icon: '🧭', perk: 'AI Lane Guidance + Live Highway CCTV Access' },
        { lvl: 4, name: 'Expressway Pro', xpNeeded: 4500, titleColor: '#34d399', badgeBg: 'linear-gradient(135deg, #059669, #34d399)', icon: '⚡', perk: '5% FASTag Recharge Bonus + Express Lanes' },
        { lvl: 5, name: 'Toll Master', xpNeeded: 7500, titleColor: '#fbbf24', badgeBg: 'linear-gradient(135deg, #d97706, #fbbf24)', icon: '🏆', perk: 'VIP Highway Lounge Access + Pass Discounts' },
        { lvl: 6, name: 'Highway Captain', xpNeeded: 12000, titleColor: '#f43f5e', badgeBg: 'linear-gradient(135deg, #e11d48, #f43f5e)', icon: '👑', perk: 'Priority Highway Patrol + 8% Fuel Rebate' },
        { lvl: 7, name: 'Golden Quad Legend', xpNeeded: 20000, titleColor: '#a855f7', badgeBg: 'linear-gradient(135deg, #7e22ce, #a855f7)', icon: '🌌', perk: 'Zero-Wait Fast-Track Barrier Clearance' },
        { lvl: 8, name: 'NHAI Champion', xpNeeded: 35000, titleColor: '#ec4899', badgeBg: 'linear-gradient(135deg, #db2777, #ec4899)', icon: '💎', perk: 'Master VIP Status & Dedicated Fleet Hotline' }
    ],

    badgeDefs: {
        'face_verified': { icon: '🛡️', name: 'Shield Guard', desc: 'Complete biometric Face ID & Aadhaar authentication', xp: 200 },
        'first_trip': { icon: '⚡', name: 'FASTag Hero', desc: 'Complete your first national highway journey', xp: 250 },
        'fuel_stop': { icon: '🌱', name: 'Eco-Drive', desc: 'Explore wayside amenities & green EV charging hubs', xp: 150 },
        'highway_guardian': { icon: '🚨', name: 'Guardian', desc: 'Report an emergency SOS or highway incident', xp: 200 },
        'wallet_master': { icon: '💳', name: 'Wallet Master', desc: 'Recharge FASTag balance with ₹500 or more', xp: 180 },
        'voice_navigator': { icon: '🎙️', name: 'Voice AI', desc: 'Plan a highway corridor via AI Voice Assistant', xp: 150 },
        'state_explorer': { icon: '🗺️', name: 'Interstate', desc: 'Travel across interstate toll plaza corridors', xp: 300 },
        'century_driver': { icon: '🏆', name: 'Century Rider', desc: 'Complete 100+ km of national highway journeys', xp: 350 }
    },

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
        let targetLevel = 1;
        for (let i = 0; i < Gamification.levels.length; i++) {
            if (xp >= Gamification.levels[i].xpNeeded && i < Gamification.levels.length - 1) {
                targetLevel = Gamification.levels[i + 1].lvl;
            }
        }

        if (targetLevel > lvlVal) {
            const oldLvl = lvlVal;
            lvlVal = targetLevel;
            localStorage.setItem(Gamification.KEYS.LEVEL, lvlVal.toString());
            
            const newLvlObj = Gamification.levels.find(l => l.lvl === lvlVal) || Gamification.levels[lvlVal - 1];
            
            // Level Up alert celebration
            setTimeout(() => {
                Utils.showToast(`🎉 LEVEL UP! You reached Level ${lvlVal}: ${newLvlObj.name}!`, 'success');
                if (window.VoiceAssistant) {
                    window.VoiceAssistant.speak(`Congratulations! You leveled up to Level ${lvlVal}. You are now a ${newLvlObj.name}.`);
                }
            }, 1500);
        }

        Gamification.refreshUI();
        window.dispatchEvent(new Event('local-storage-update'));
    },

    unlockAchievement: (id, name, xpReward = 200) => {
        const achs = Gamification.getAchievements();
        if (achs[id]) return; // Already unlocked!

        achs[id] = {
            unlockedAt: new Date().toISOString(),
            name: name
        };
        localStorage.setItem(Gamification.KEYS.ACHIEVEMENTS, JSON.stringify(achs));
        
        const bDef = Gamification.badgeDefs[id] || { name, xp: xpReward };
        Utils.showToast(`🏆 Badge Unlocked: ${bDef.name} (+${bDef.xp || xpReward} XP)!`, 'success');
        Gamification.addXP(bDef.xp || xpReward, `Badge: ${bDef.name}`);
    },

    claimDailyCheckIn: () => {
        const lastCheckIn = localStorage.getItem(Gamification.KEYS.LAST_CHECKIN);
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (lastCheckIn && (now - parseInt(lastCheckIn)) < ONE_DAY) {
            const hrsLeft = Math.ceil((ONE_DAY - (now - parseInt(lastCheckIn))) / (1000 * 60 * 60));
            Utils.showToast(`Daily check-in already claimed! Next check-in available in ${hrsLeft}h.`, 'info');
            return;
        }

        localStorage.setItem(Gamification.KEYS.LAST_CHECKIN, now.toString());
        Gamification.addXP(50, 'Daily Highway Check-in');
        Utils.showToast('🎁 Daily Check-in Bonus Claimed: +50 XP!', 'success');
        
        const btn = document.getElementById('btn-daily-checkin');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Claimed Today';
            btn.style.opacity = '0.6';
        }
    },

    inspectBadge: (badgeId) => {
        const bDef = Gamification.badgeDefs[badgeId];
        if (!bDef) return;

        const achs = Gamification.getAchievements();
        const isUnlocked = !!achs[badgeId];

        const modalIcon = document.getElementById('modal-badge-icon');
        const modalName = document.getElementById('modal-badge-name');
        const modalXp = document.getElementById('modal-badge-xp');
        const modalDesc = document.getElementById('modal-badge-desc');
        const modalStatus = document.getElementById('modal-badge-status');

        if (modalIcon) modalIcon.innerText = bDef.icon || '🏆';
        if (modalName) modalName.innerText = bDef.name || 'Badge';
        if (modalXp) modalXp.innerText = `+${bDef.xp || 200} XP Reward`;
        if (modalDesc) modalDesc.innerText = bDef.desc || '';
        
        if (modalStatus) {
            if (isUnlocked) {
                const dateStr = new Date(achs[badgeId].unlockedAt || Date.now()).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
                modalStatus.innerHTML = `
                    <div style="color: #34d399; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 3px;">
                        <i class="fa-solid fa-circle-check"></i> UNLOCKED
                    </div>
                    <div style="color: #94a3b8; font-size: 11px;">Unlocked on ${dateStr}</div>
                `;
                modalStatus.style.borderColor = 'rgba(16,185,129,0.3)';
                modalStatus.style.background = 'rgba(16,185,129,0.1)';
            } else {
                modalStatus.innerHTML = `
                    <div style="color: #f43f5e; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 3px;">
                        <i class="fa-solid fa-lock"></i> LOCKED
                    </div>
                    <div style="color: #94a3b8; font-size: 11px;">Complete the requirement above to unlock this badge and claim XP</div>
                `;
                modalStatus.style.borderColor = 'rgba(244,63,94,0.2)';
                modalStatus.style.background = 'rgba(0,0,0,0.3)';
            }
        }

        Utils.toggleVisibility('driver-badge-modal', true);
    },

    showPerksModal: () => {
        const currentLvl = Gamification.getLevel();
        const bodyEl = document.getElementById('driver-perks-modal-body');
        if (!bodyEl) return;

        let html = '';
        Gamification.levels.forEach(lvl => {
            const isCurrent = lvl.lvl === currentLvl;
            const isUnlocked = currentLvl >= lvl.lvl;
            const borderCol = isCurrent ? 'rgba(59, 130, 246,0.5)' : (isUnlocked ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)');
            const bgCol = isCurrent ? 'rgba(59, 130, 246,0.12)' : (isUnlocked ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.25)');

            html += `
                <div style="background:${bgCol}; border:1px solid ${borderCol}; border-radius:10px; padding:10px 14px; margin-bottom:10px; transition: all 0.2s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:800; font-size:13px; color:${lvl.titleColor}; display:flex; align-items:center; gap:6px;">
                            <span>${lvl.icon}</span> <span>Level ${lvl.lvl}: ${lvl.name}</span>
                        </div>
                        <span style="font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:12px; background:${isCurrent ? 'rgba(59, 130, 246,0.2)' : (isUnlocked ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)')}; color:${isCurrent ? '#3b82f6' : (isUnlocked ? '#34d399' : '#94a3b8')};">
                            ${isCurrent ? '⭐ CURRENT' : (isUnlocked ? '✓ UNLOCKED' : `${lvl.xpNeeded} XP`)}
                        </span>
                    </div>
                    <div style="font-size:11.5px; color:#cbd5e1; margin-top:5px; display:flex; align-items:flex-start; gap:6px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="color:#fbbf24; font-size:10px; margin-top:3px; flex-shrink:0;"></i>
                        <span>${lvl.perk}</span>
                    </div>
                </div>
            `;
        });

        bodyEl.innerHTML = html;
        Utils.toggleVisibility('driver-perks-modal', true);
    },

    refreshUI: () => {
        const xp = Gamification.getXP();
        const levelVal = Gamification.getLevel();
        const achs = Gamification.getAchievements();

        const activeLvl = Gamification.levels.find(l => l.lvl === levelVal) || Gamification.levels[0];
        const nextLvl = Gamification.levels.find(l => l.lvl === levelVal + 1) || activeLvl;
        
        // Update labels
        const lvlTitle = document.getElementById('gamified-lvl-title');
        const lvlBadge = document.getElementById('gamified-lvl-badge');
        const tierTag = document.getElementById('gamified-tier-tag');
        const xpText = document.getElementById('gamified-xp-text');
        const xpPct = document.getElementById('gamified-xp-pct');
        const xpBar = document.getElementById('gamified-xp-bar');
        const activePerkEl = document.getElementById('gamified-active-perk');
        const countBadgeEl = document.getElementById('badges-unlocked-count');

        if (lvlTitle) {
            lvlTitle.innerText = `Level ${levelVal} ${activeLvl.name}`;
            lvlTitle.style.color = activeLvl.titleColor || '#fff';
        }
        if (lvlBadge) {
            lvlBadge.innerText = levelVal;
            lvlBadge.style.boxShadow = `0 0 16px ${activeLvl.titleColor || 'var(--primary)'}`;
            lvlBadge.style.background = activeLvl.badgeBg || activeLvl.titleColor || 'var(--primary)';
        }
        if (tierTag) {
            tierTag.innerText = `Tier ${levelVal}`;
            tierTag.style.color = activeLvl.titleColor || '#3b82f6';
            tierTag.style.borderColor = `${activeLvl.titleColor}40`;
        }
        if (activePerkEl) {
            activePerkEl.innerText = `Perk: ${activeLvl.perk}`;
        }
        
        const currentLimit = activeLvl.xpNeeded;
        const prevLimit = levelVal > 1 ? (Gamification.levels[levelVal - 2]?.xpNeeded || 0) : 0;
        const currentPct = Math.min(100, Math.max(5, Math.floor(((xp) / currentLimit) * 100)));
        
        if (xpText) {
            xpText.innerText = `${xp} / ${currentLimit} XP (Next: Lvl ${nextLvl.lvl})`;
        }
        
        if (xpPct) {
            xpPct.innerText = `${currentPct}%`;
        }
        
        if (xpBar) xpBar.style.width = `${currentPct}%`;

        // Refresh Badge statuses across all 8 badges
        const badgeIds = Object.keys(Gamification.badgeDefs);
        let unlockedCount = 0;

        badgeIds.forEach(id => {
            const badgeEl = document.getElementById(`badge-${id}`);
            const bDef = Gamification.badgeDefs[id];
            if (badgeEl && bDef) {
                if (achs[id]) {
                    unlockedCount++;
                    badgeEl.style.opacity = '1.0';
                    badgeEl.style.background = 'rgba(16,185,129,0.12)';
                    badgeEl.style.borderColor = 'rgba(16,185,129,0.35)';
                    badgeEl.style.transform = 'scale(1.03)';
                    badgeEl.classList.remove('locked');
                    badgeEl.classList.add('unlocked');
                    badgeEl.title = `UNLOCKED: ${bDef.name} (+${bDef.xp} XP)`;
                } else {
                    badgeEl.style.opacity = '0.35';
                    badgeEl.style.background = 'rgba(0,0,0,0.25)';
                    badgeEl.style.borderColor = 'transparent';
                    badgeEl.style.transform = 'none';
                    badgeEl.classList.add('locked');
                    badgeEl.classList.remove('unlocked');
                    badgeEl.title = `LOCKED: ${bDef.name} — ${bDef.desc}`;
                }
            }
        });

        if (countBadgeEl) {
            countBadgeEl.innerText = `${unlockedCount}/8 Unlocked`;
            countBadgeEl.style.color = unlockedCount > 0 ? '#34d399' : '#3b82f6';
        }
    },

    playXpAnimation: (amount, reason) => {
        const pop = document.createElement('div');
        pop.className = 'xp-pop-animate';
        pop.innerHTML = `
            <div style="font-size: 14px; font-weight: 800; color: var(--primary); display:flex; align-items:center; justify-content:center; gap:4px;">
                <i class="fa-solid fa-bolt" style="color:#fbbf24;"></i> +${amount} XP
            </div>
            <div style="font-size: 9.5px; color: var(--text-sec); margin-top: 2px;">${reason}</div>
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
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
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

