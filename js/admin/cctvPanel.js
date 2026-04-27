// Refactored Hybrid CCTV Grid Engine

const CCTVPanel = {
    init: () => {
        const container = document.getElementById('cctv-container');
        if (!container) return;

        const cams = window.CCTVManager ? CCTVManager.getAll() : [];
        
        let html = '';
        const nowStr = new Date().toLocaleTimeString();

        cams.forEach(cam => {
            let statusTextClass = '';
            let statusText = '• ' + cam.mode;
            if (cam.mode === 'OFFLINE') {
                statusTextClass = 'style="color: var(--accent-red);"';
            } else if (cam.mode === 'MAINTENANCE') {
                statusTextClass = 'style="color: var(--accent-yellow);"';
            } else {
                statusText = '• ' + (cam.mode === 'PUBLIC' ? 'Live Demo' : 'Live-Sim');
            }

            const tollObj = (window.TollData && window.TollData.getTollById) ? TollData.getTollById(cam.tollId) : null;
            const tollName = tollObj ? tollObj.name : 'Unassigned';

            // Queue length simulation
            let queue = cam.mode === 'OFFLINE' ? '-' : Math.floor(Math.random() * 25) + ' cars';

            html += `
                <div class="cctv-cam">
                    ${window.CCTVFeedEngine ? CCTVFeedEngine.getFeedHTML(cam) : '<div class="cctv-feed-sim"></div>'}
                    <div class="cctv-overlay" style="background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%); display:flex; flex-direction:column; justify-content:space-between; padding:10px;">
                        
                        <div style="display:flex; justify-content:space-between;">
                            <span class="cctv-status" ${statusTextClass}>${statusText}</span>
                            <button class="btn" style="padding:2px 6px; font-size:10px;" onclick="CCTVManager.deleteCamera('${cam.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>

                        <div>
                            <span class="cctv-label" style="display:block; margin-bottom: 2px;">${cam.name}</span>
                            <span style="font-size:10px; color:var(--text-sec); display:block;">@ ${tollName} | Q: ${queue}</span>
                            <span style="font-size:9px; color:var(--text-sec); display:block; text-align:right;">${nowStr}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        // Add delete logic directly to CCTVManager if it exists (simple patch)
        if (window.CCTVManager && !window.CCTVManager.deleteCamera) {
            window.CCTVManager.deleteCamera = (id) => {
                const updated = CCTVManager.getAll().filter(c => c.id !== id);
                Storage.set('nhai_cameras', updated);
                CCTVPanel.init();
            };
        }

        container.innerHTML = html.length ? html : '<p style="grid-column: span 3; text-align:center; color:var(--text-sec);">No cameras assigned to the wall.</p>';
    }
};

window.CCTVPanel = CCTVPanel;

// Periodic Refresh for Real-Time feel
setInterval(() => {
    if(document.getElementById('view-cctv')?.classList?.contains('active')) {
        CCTVPanel.init(); 
    }
}, 7000);
