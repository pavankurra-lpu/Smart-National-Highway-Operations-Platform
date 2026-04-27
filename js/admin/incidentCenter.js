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
            
            let statusUI = '';
            if (inc.status === 'CLOSED') {
                statusUI = `<div style="font-size:11px; color:var(--text-sec);"><i class="fa-solid fa-check-double"></i> Closed (User Accepted)</div><div style="font-size:10px; color:var(--accent-yellow); margin-top:2px;">Rating: ${inc.feedbackRating || 5}★</div>`;
            } else {
                statusUI = `
                    <select onchange="updateIncidentStatus('${inc.id}', this.value)" style="width:auto; padding:4px; font-size:11px;">
                        <option value="RAISED" ${inc.status === 'RAISED' ? 'selected' : ''}>Raised</option>
                        <option value="ACKNOWLEDGED" ${inc.status === 'ACKNOWLEDGED' ? 'selected' : ''}>Ack</option>
                        <option value="DISPATCHED" ${inc.status === 'DISPATCHED' ? 'selected' : ''}>Dispatch</option>
                        <option value="RESOLVED" ${inc.status === 'RESOLVED' ? 'selected' : ''}>Resolve</option>
                    </select>
                `;
            }

            html += `
                <tr ${rowClass}>
                    <td style="font-size:11px; font-weight:bold;">${inc.id}</td>
                    <td><span class="badge badge-warning">${inc.type}</span></td>
                    <td style="font-size:12px;">${inc.location}</td>
                    <td style="max-width: 200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px;" title="${inc.description}">
                        ${inc.description || '-'}
                    </td>
                    <td><span class="badge ${inc.status === 'RESOLVED' || inc.status === 'CLOSED' ? 'badge-success' : 'badge-danger'}">${inc.status}</span></td>
                    <td>
                        ${statusUI}
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
        const m = document.getElementById('resolution-modal');
        const idText = document.getElementById('res-modal-id-text');
        const confirmBtn = document.getElementById('btn-confirm-resolution');
        
        if (!m || !confirmBtn) return;
        
        idText.innerText = id;
        m.classList.remove('hidden');
        
        // Use a one-time listener or reset it
        confirmBtn.onclick = () => IncidentCenter.confirmResolution(id);
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

        const note = `[RESOLVED] ${noteInput.value.trim()}`;
        
        const file = imgInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            Storage.updateEmergencyStatus(id, 'RESOLVED', note, base64Image);
            
            // Clear inputs
            imgInput.value = '';
            noteInput.value = '';
            
            document.getElementById('resolution-modal').classList.add('hidden');
            Utils.showToast(`Incident ${id} resolved. Awaiting user acceptance.`, "success");
            
            IncidentCenter.refresh();
            Analytics.refresh();
        };
        reader.readAsDataURL(file);
    }
};

window.IncidentCenter = IncidentCenter;
