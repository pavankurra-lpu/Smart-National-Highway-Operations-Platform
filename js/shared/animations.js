document.addEventListener('DOMContentLoaded', () => {
    // Check if Motion is available
    if (typeof Motion === 'undefined') {
        console.warn('Motion library is not loaded. Animations skipped.');
        return;
    }

    const { animate, stagger } = Motion;

    // Helper for Number Counting Animation
    window.animateNumber = (elementId, endValue, prefix = '', suffix = '', decimals = 0) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        let startValue = parseFloat(el.getAttribute('data-val') || 0);
        if (isNaN(startValue)) startValue = 0;
        
        animate(
            (progress) => {
                const current = startValue + (endValue - startValue) * progress;
                el.innerText = prefix + current.toFixed(decimals) + suffix;
            },
            { duration: 1.5, easing: 'ease-out' }
        );
        el.setAttribute('data-val', endValue);
    };

    // ==========================================
    // 1. GENERIC INTERACTIVE MICRO-INTERACTIONS
    // ==========================================

    // Hover scale animations for standard buttons and active pills
    const buttonSelectors = '.btn, .tab-btn, .admin-nav-btn, .back-btn, .theme-toggle-btn, .btn-kokonut';
    document.querySelectorAll(buttonSelectors).forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            animate(btn, { scale: 1.05 }, { duration: 0.2, easing: 'ease-out' });
        });
        btn.addEventListener('mouseleave', () => {
            animate(btn, { scale: 1.0 }, { duration: 0.2, easing: 'ease-out' });
        });
    });

    // CCTV & stats card glows/scales on hover
    const hoverCards = '.stat-card, .cctv-cam, .fastag-card, .alert-box, .glass-panel table tbody tr, .kokonut-stat-tile';
    document.querySelectorAll(hoverCards).forEach(card => {
        card.addEventListener('mouseenter', () => {
            animate(card, { scale: 1.015, translateZ: 0 }, { duration: 0.2, easing: 'ease-out' });
            card.style.borderColor = 'var(--primary)';
            card.style.boxShadow = '0 10px 25px -5px rgba(0, 229, 179, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            animate(card, { scale: 1.0, translateZ: 0 }, { duration: 0.2, easing: 'ease-out' });
            card.style.borderColor = '';
            card.style.boxShadow = '';
        });
    });

    // Pulsing animation for the SOS Warning badge (Visual improvement)
    const sosBadge = document.getElementById('sos-badge');
    if (sosBadge) {
        // Animate a pulsing scale forever
        const pulseBadge = () => {
            if (sosBadge.classList.contains('hidden')) return;
            animate(sosBadge, 
                { scale: [1, 1.25, 1] }, 
                { duration: 1.2, easing: 'ease-in-out', repeat: Infinity }
            );
        };
        
        // Watch for badge visibility changes (MutationObserver)
        const observer = new MutationObserver(() => {
            pulseBadge();
        });
        observer.observe(sosBadge, { attributes: true, attributeFilter: ['class'] });
        pulseBadge(); // Initial run
    }

    // ==========================================
    // 2. ROOT LANDING PAGE (index.html)
    // ==========================================
    const isLandingPage = document.querySelector('body > .container');
    if (isLandingPage) {
        const container = document.querySelector('.container');
        // Initial reset for stagger
        const elements = container.querySelectorAll('h1, p, .btn-group, .disclaimer');
        elements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(25px)';
        });

        // Intro stagger
        animate(
            Array.from(elements),
            { opacity: [0, 1], y: [25, 0] },
            { delay: stagger(0.12), duration: 0.7, easing: [0.16, 1, 0.3, 1] }
        );
    }

    // ==========================================
    // 3. TOLL ROUTE PLANNING PAGE (toll-route.html)
    // ==========================================
    const isTollRoutePage = document.getElementById('ui-panel');
    if (isTollRoutePage) {
        // Slide in panel from left
        isTollRoutePage.style.opacity = '0';
        isTollRoutePage.style.transform = 'translateX(-100px)';
        animate(
            isTollRoutePage,
            { opacity: [0, 1], x: [-100, 0] },
            { duration: 0.6, easing: [0.16, 1, 0.3, 1] }
        );

        // Intercept route selection details display
        const routeDetails = document.getElementById('route-details');
        if (routeDetails) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.attributeName === 'class' && !routeDetails.classList.contains('hidden')) {
                        // Slide-up and fade-in container
                        routeDetails.style.opacity = '0';
                        routeDetails.style.transform = 'translateY(20px)';
                        animate(
                            routeDetails,
                            { opacity: [0, 1], y: [20, 0] },
                            { duration: 0.4, easing: 'ease-out' }
                        ).then(() => {
                            // Stagger animate toll items if present
                            const items = document.querySelectorAll('#toll-list li');
                            if (items.length > 0) {
                                items.forEach(it => {
                                    it.style.opacity = '0';
                                    it.style.transform = 'translateX(-15px)';
                                });
                                animate(
                                    Array.from(items),
                                    { opacity: [0, 1], x: [-15, 0] },
                                    { delay: stagger(0.04), duration: 0.3, easing: 'ease-out' }
                                );
                            }
                        });
                    }
                });
            });
            observer.observe(routeDetails, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // ==========================================
    // 4. TRAVELLER PORTAL (user/index.html)
    // ==========================================
    const entryScreen = document.getElementById('entry-screen');
    const userApp = document.getElementById('user-app');

    if (entryScreen) {
        // Stagger landing content
        const logo = entryScreen.querySelector('.entry-logo-box');
        const textItems = entryScreen.querySelectorAll('.entry-tagline, .entry-title, .entry-subtitle');
        const badges = entryScreen.querySelectorAll('.entry-badge-pill');
        const unlockBtn = document.getElementById('btn-unlock-portal');

        if (logo) {
            logo.style.opacity = '0';
            logo.style.transform = 'scale(0.8) rotate(-45deg)';
            animate(logo, 
                { opacity: [0, 1], scale: [0.8, 1], rotate: [-45, 0] }, 
                { duration: 0.8, easing: [0.34, 1.56, 0.64, 1] } // Spring rotate
            );
        }

        textItems.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(15px)';
        });
        animate(
            Array.from(textItems),
            { opacity: [0, 1], y: [15, 0] },
            { delay: stagger(0.1, { startDelay: 0.2 }), duration: 0.5, easing: 'ease-out' }
        );

        badges.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'scale(0.95)';
        });
        animate(
            Array.from(badges),
            { opacity: [0, 1], scale: [0.95, 1] },
            { delay: stagger(0.06, { startDelay: 0.5 }), duration: 0.4, easing: 'ease-out' }
        );

        if (unlockBtn) {
            unlockBtn.style.opacity = '0';
            unlockBtn.style.transform = 'translateY(20px)';
            animate(unlockBtn, 
                { opacity: [0, 1], y: [20, 0] }, 
                { delay: 0.7, duration: 0.5, easing: 'ease-out' }
            ).then(() => {
                // Pulse breath effect on unlock button
                animate(unlockBtn, 
                    { scale: [1, 1.03, 1] }, 
                    { duration: 2.0, repeat: Infinity, easing: 'ease-in-out' }
                );
            });

            // Intercept portal unlock button click
            unlockBtn.addEventListener('click', () => {
                // Exit Animation for Landing Portal
                animate(entryScreen, { opacity: 0, scale: 0.95 }, { duration: 0.6, easing: 'ease-in-out' });
                
                // Entrance for Main App Panel
                setTimeout(() => {
                    const sidebar = document.getElementById('nhai-sidebar');
                    if (sidebar) {
                        sidebar.style.opacity = '0';
                        sidebar.style.transform = 'translateX(100px)';
                        animate(sidebar, 
                            { opacity: [0, 1], x: [100, 0] }, 
                            { duration: 0.6, easing: [0.16, 1, 0.3, 1] }
                        );
                    }
                    
                    // Stagger reveal the dashboard panels
                    const dashboardPanels = document.querySelectorAll('#tab-planner .glass-panel, #tab-planner .stat-card, #tab-planner .kokonut-stat-tile, #tab-planner button');
                    dashboardPanels.forEach(panel => {
                        panel.style.opacity = '0';
                        panel.style.transform = 'translateY(25px)';
                    });
                    
                    animate(
                        Array.from(dashboardPanels),
                        { opacity: [0, 1], y: [25, 0] },
                        { delay: stagger(0.08, { startDelay: 0.2 }), duration: 0.6, easing: [0.16, 1, 0.3, 1] }
                    );
                }, 600);
            });
        }
    }

    // Intercept tabs switching inside traveller dashboard
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.getAttribute('data-tab');
            const targetTab = document.getElementById(targetTabId);
            if (targetTab) {
                targetTab.style.opacity = '0';
                targetTab.style.transform = 'translateY(15px)';
                animate(
                    targetTab,
                    { opacity: [0, 1], y: [15, 0] },
                    { duration: 0.35, easing: 'ease-out' }
                );

                // If switching to analytics, stagger statistic values
                if (targetTabId === 'tab-analytics') {
                    setTimeout(() => {
                        const vals = targetTab.querySelectorAll('.value, h3');
                        vals.forEach(v => {
                            v.style.opacity = '0';
                            v.style.transform = 'scale(0.9)';
                        });
                        animate(
                            Array.from(vals),
                            { opacity: [0, 1], scale: [0.9, 1] },
                            { delay: stagger(0.06), duration: 0.4 }
                        );
                    }, 100);
                }
            }
        });
    });

    // ==========================================
    // 5. ADMIN PORTAL (admin/index.html & login.html)
    // ==========================================
    const isAdminApp = document.getElementById('admin-app');
    if (isAdminApp) {
        // Slide in admin sidebar
        const adminSidebar = document.querySelector('.admin-sidebar');
        if (adminSidebar) {
            adminSidebar.style.opacity = '0';
            adminSidebar.style.transform = 'translateX(-50px)';
            animate(adminSidebar, 
                { opacity: [0, 1], x: [-50, 0] }, 
                { duration: 0.6, easing: [0.16, 1, 0.3, 1] }
            );
        }

        // Stagger first load overview cards
        const firstView = document.querySelector('.view-section.active');
        if (firstView && firstView.id === 'view-overview') {
            const statCards = firstView.querySelectorAll('.stat-card');
            statCards.forEach(c => {
                c.style.opacity = '0';
                c.style.transform = 'translateY(20px)';
            });
            animate(
                Array.from(statCards),
                { opacity: [0, 1], y: [20, 0] },
                { delay: stagger(0.08), duration: 0.5, easing: 'ease-out' }
            );
        }

        // Intercept Admin side view tabs
        const adminNavBtns = document.querySelectorAll('.admin-nav-btn');
        adminNavBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetViewId = btn.getAttribute('data-view');
                const targetView = document.getElementById(targetViewId);
                if (targetView) {
                    // Slide up & fade in view section
                    targetView.style.opacity = '0';
                    targetView.style.transform = 'translateY(25px)';
                    animate(
                        targetView,
                        { opacity: [0, 1], y: [25, 0] },
                        { duration: 0.4, easing: 'ease-out' }
                    );

                    // Special staggers inside specific admin tabs
                    if (targetViewId === 'view-cctv') {
                        setTimeout(() => {
                            const cctvs = targetView.querySelectorAll('.cctv-cam');
                            cctvs.forEach(card => {
                                card.style.opacity = '0';
                                card.style.transform = 'scale(0.95)';
                            });
                            animate(
                                Array.from(cctvs),
                                { opacity: [0, 1], scale: [0.95, 1] },
                                { delay: stagger(0.06), duration: 0.4, easing: 'ease-out' }
                            );
                        }, 100);
                    } else if (targetViewId === 'view-incidents') {
                        setTimeout(() => {
                            const rows = targetView.querySelectorAll('table tbody tr');
                            rows.forEach(r => {
                                r.style.opacity = '0';
                                r.style.transform = 'translateX(-10px)';
                            });
                            animate(
                                Array.from(rows),
                                { opacity: [0, 1], x: [-10, 0] },
                                { delay: stagger(0.04), duration: 0.3 }
                            );
                        }, 100);
                    }
                }
            });
        });
    }

    // Admin Login Screen page load
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
        loginCard.style.opacity = '0';
        loginCard.style.transform = 'scale(0.95) translateY(20px)';
        animate(
            loginCard,
            { opacity: [0, 1], scale: [0.95, 1], y: [20, 0] },
            { duration: 0.6, easing: [0.34, 1.56, 0.64, 1] } // Spring/bounce entrance
        );
    }
});
