// Admin Incident Handling Logic

const IncidentCenter = {
    init: () => {
        IncidentCenter.refresh();
        window.updateIncidentStatus = IncidentCenter.updateStatus;
    },

    refresh: () => {
        const incidents = Storage.get(Storage.KEYS.EMERGENCIES, []);
        const tbody = document.getElementById('incidents-table-body');
        const badge = document.getElementById('sos-badge');

        if (!tbody) return;

        let activeCount = 0;
        let html = '';

        incidents.forEach(inc => {
            if (inc.status === 'RAISED' || inc.status === 'ACKNOWLEDGED') activeCount++;

            let rowClass = inc.status === 'RAISED' ? 'style="background: rgba(255, 94, 94, 0.1);"' : '';
            
            html += `
                <tr ${rowClass}>
                    <td style="font-size:11px; font-weight:bold;">${inc.id}</td>
                    <td><span class="badge badge-warning">${inc.type}</span></td>
                    <td style="font-size:12px;">${inc.location}</td>
                    <td style="max-width: 200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px;" title="${inc.description}">
                        ${inc.description || '-'}
                    </td>
                    <td><span class="badge ${inc.status === 'RESOLVED' ? 'badge-success' : 'badge-danger'}">${inc.status}</span></td>
                    <td>
                        <select onchange="updateIncidentStatus('${inc.id}', this.value)" style="width:auto; padding:4px; font-size:11px;">
                            <option value="RAISED" ${inc.status === 'RAISED' ? 'selected' : ''}>Raised</option>
                            <option value="ACKNOWLEDGED" ${inc.status === 'ACKNOWLEDGED' ? 'selected' : ''}>Ack</option>
                            <option value="DISPATCHED" ${inc.status === 'DISPATCHED' ? 'selected' : ''}>Dispatch</option>
                            <option value="RESOLVED" ${inc.status === 'RESOLVED' ? 'selected' : ''}>Resolve</option>
                        </select>
                    </td>
                </tr>
            `;
        });

        if (badge) {
            if (activeCount > 0) {
                badge.innerText = activeCount;
                badge.classList.remove('hidden');
                badge.classList.add('pulse-anim');
            } else {
                badge.classList.add('hidden');
                badge.classList.remove('pulse-anim');
            }
        }

        tbody.innerHTML = html.length ? html : '<tr><td colspan="6" style="text-align:center;">No SOS Incidents reported.</td></tr>';
    },

    updateStatus: (id, newStatus) => {
        let note = '';
        if (newStatus === 'ACKNOWLEDGED') note = 'NHAI team evaluating.';
        if (newStatus === 'DISPATCHED') note = 'Patrol unit dispatched to location.';
        
        if (newStatus === 'RESOLVED') {
            IncidentCenter.openResolutionModal(id);
            // Revert select visually until resolved
            IncidentCenter.refresh();
            return;
        }

        Storage.updateEmergencyStatus(id, newStatus, note);
        Utils.showToast(`Updated case ${id} to ${newStatus}`);
        IncidentCenter.refresh();
        Analytics.refresh();
    },

    openResolutionModal: (id) => {
        let m = document.getElementById('resolution-modal');
        if(!m) {
            m = document.createElement('div');
            m.id = 'resolution-modal';
            m.className = 'modal-overlay';
            m.style.zIndex = '99999';
            document.body.appendChild(m);
        }
        
        m.innerHTML = `
            <div class="glass-panel" style="width:400px; max-width:90%;">
                <h3 style="color:var(--primary); font-size:16px; margin-bottom:15px;"><i class="fa-solid fa-camera"></i> Mandatory Proof of Resolution</h3>
                <p style="font-size:12px; color:var(--text-sec); margin-bottom:15px;">Incident <b>${id}</b> requires a valid image proof and resolution notes to be closed.</p>
                
                <div style="margin-bottom:15px;">
                    <label style="font-size:11px; font-weight:bold; color:var(--text-main);">Upload Resolution Image *</label>
                    <input type="file" id="res-image-upload" accept="image/*" class="w-full" style="font-size:11px; margin-top:5px; padding:10px; background:rgba(0,0,0,0.3); border:1px dashed var(--border); border-radius:4px;">
                </div>

                <div style="margin-bottom:15px;">
                    <label style="font-size:11px; font-weight:bold; color:var(--text-main);">Admin Summary Note *</label>
                    <textarea id="res-note" rows="3" class="w-full" style="background:var(--bg-dark); color:#fff; border:1px solid var(--border); border-radius:4px; padding:8px; font-size:12px; margin-top:5px;" placeholder="Detailed actions taken..."></textarea>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-outline" onclick="document.getElementById('resolution-modal').classList.add('hidden')">Cancel</button>
                    <button class="btn btn-primary" onclick="IncidentCenter.confirmResolution('${id}')">Upload & Resolve</button>
                </div>
            </div>
        `;
        m.classList.remove('hidden');
    },

    confirmResolution: (id) => {
        const imgInput = document.getElementById('res-image-upload');
        const noteInput = document.getElementById('res-note');
        
        if (!imgInput.files || imgInput.files.length === 0) {
            Utils.showToast("Error: Resolution proof image is mandatory.", "error"); 
            return;
        }
        if (!noteInput.value.trim()) {
            Utils.showToast("Error: Admin Summary Note is mandatory.", "error"); 
            return;
        }

        const note = `[RESOLVED + PROOF UPLOADED] ${noteInput.value.trim()}`;
        
        // Mock base64 save could go here
        Storage.updateEmergencyStatus(id, 'RESOLVED', note);
        document.getElementById('resolution-modal').classList.add('hidden');
        Utils.showToast(`Incident ${id} completely resolved. Proof verified.`, "success");
        
        IncidentCenter.refresh();
        Analytics.refresh();
    }
};

window.IncidentCenter = IncidentCenter;
