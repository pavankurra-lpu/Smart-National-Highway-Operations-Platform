// Admin Camera Configuration & CRUD logic

const CCTVManager = {
    init: () => {
        // Seed default cameras if empty
        if (!Storage.get('nhai_cameras')) {
            const defaultCams = [
                { id: 'cam1', name: 'Manesar Plaza Flow', tollId: 'TP_DEL_JAI_1', mode: 'SIMULATION' },
                { id: 'cam2', name: 'Khalapur Entry Check', tollId: 'TP_MUM_PUN_1', mode: 'SIMULATION' },
                { id: 'cam3', name: 'Panthangi FASTag Array', tollId: 'TP_HYD_VIJ_1', mode: 'MAINTENANCE' },
                { id: 'cam4', name: 'Yamuna Exp Checkpoint', tollId: 'TP_YAMUNA_EXP', mode: 'SIMULATION' }
            ];
            Storage.set('nhai_cameras', defaultCams);
        }

        const btn = document.getElementById('btn-manage-cams');
        if(btn) {
            btn.addEventListener('click', () => {
                CCTVManager.openConfigModal();
            });
        }
    },

    getAll: () => Storage.get('nhai_cameras') || [],

    openConfigModal: () => {
        let m = document.getElementById('cctv-modal');
        if(!m) {
            m = document.createElement('div');
            m.id = 'cctv-modal';
            m.className = 'modal-overlay';
            m.style.zIndex = '9999';
            document.body.appendChild(m);
        }

        const tolls = (window.TollData && TollData.getAllTolls) ? TollData.getAllTolls() : [];
        let sortedTolls = [...tolls].sort((a,b) => (a.name || '').localeCompare(b.name || ''));
        let tollOptions = sortedTolls.map(t => `<option value="${t.id || t.tollId}">${t.name || t.tollName || 'Plaza'} (${t.nhCorridor || 'NH'})</option>`).join('');

        m.innerHTML = `
            <div class="glass-panel" style="width:400px; max-width:90%; animation: fadeIn 0.3s ease-out;">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                    <h3 style="margin:0;"><i class="fa-solid fa-video" style="color:var(--primary);"></i> Configure Camera</h3>
                    <button class="btn btn-outline" style="border:none; padding:5px; min-width:30px;" onclick="document.getElementById('cctv-modal').remove()">✕</button>
                </div>
                
                <div class="flex-col gap-4">
                    <div>
                        <label style="font-size:11px; color:var(--text-sec); display:block; margin-bottom:4px;">Camera Identifier</label>
                        <input type="text" id="cam-name" placeholder="e.g. NH44 Lane 1" style="width:100%; box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:11px; color:var(--text-sec); display:block; margin-bottom:4px;">Assign to Toll Plaza</label>
                        <select id="cam-toll" style="width:100%; box-sizing:border-box;">${tollOptions}</select>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:11px; color:var(--text-sec); display:block; margin-bottom:4px;">Feed Mode</label>
                            <select id="cam-mode" style="width:100%; box-sizing:border-box;">
                                <option value="SIMULATION">Live-Sim</option>
                                <option value="PUBLIC">Public URL</option>
                                <option value="OFFLINE">Maintenance</option>
                            </select>
                        </div>
                    </div>
                    <div id="url-box" style="display:none;">
                        <label style="font-size:11px; color:var(--text-sec); display:block; margin-bottom:4px;">Public URL</label>
                        <input type="text" id="cam-url" placeholder="https://example.com/demo.jpg" style="width:100%; box-sizing:border-box;">
                    </div>
                    
                    <button class="btn btn-primary" onclick="CCTVManager.saveCamera()" style="justify-content:center; width:100%; padding:10px; margin-top:10px;">
                        <i class="fa-solid fa-cloud-arrow-up"></i> REGISTER CAMERA
                    </button>
                </div>
            </div>
        `;

        // Add auto-toggle for URL box
        const modeSel = document.getElementById('cam-mode');
        if (modeSel) {
            modeSel.addEventListener('change', (e) => {
                document.getElementById('url-box').style.display = e.target.value === 'PUBLIC' ? 'block' : 'none';
            });
        }
    },

    saveCamera: () => {
        const nameInput = document.getElementById('cam-name');
        const tollSel = document.getElementById('cam-toll');
        const modeSel = document.getElementById('cam-mode');
        const urlInput = document.getElementById('cam-url');

        if(!nameInput || !nameInput.value.trim()) {
            Utils.showToast("Camera name is required", "error");
            return;
        }

        const cams = CCTVManager.getAll();
        const newCam = {
            id: 'CAM_' + Date.now() + '_' + Math.floor(Math.random() * 999),
            name: nameInput.value.trim(),
            tollId: tollSel ? tollSel.value : '',
            mode: modeSel ? modeSel.value : 'SIMULATION',
            url: urlInput ? urlInput.value.trim() : ''
        };

        cams.push(newCam);
        Storage.set('nhai_cameras', cams);
        
        const modal = document.getElementById('cctv-modal');
        if (modal) modal.remove();
        
        Utils.showToast("Camera registered & linked successfully.", "success");
        
        // Refresh Wall
        if(window.CCTVPanel) CCTVPanel.init();
    }
};

window.CCTVManager = CCTVManager;
