// SOS Emergency Reporting Logic

const EmergencyReporter = {
    init: () => {
        const btnSubmit = document.getElementById('btn-submit-sos');
        
        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                const type = document.getElementById('sos-type').value;
                const loc = document.getElementById('sos-location').value;
                const desc = document.getElementById('sos-desc').value;
                const phone = document.getElementById('sos-phone').value;

                if (!loc) {
                    Utils.showToast("Please specify your nearest highway location.", "error");
                    return;
                }

                const emergencyData = {
                    id: Utils.generateId('SOS'),
                    type: type,
                    location: loc,
                    description: desc,
                    phone: phone,
                    status: 'RAISED', // RAISED, ACKNOWLEDGED, DISPATCHED, RESOLVED
                    reportedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    adminNote: ''
                };

                // Add to Shared Storage (Admin will see it instantly)
                Storage.addEmergency(emergencyData);

                Utils.showToast(`SOS Triggered! Admin notified. Ref NO: ${emergencyData.id}`);
                
                // Clear Form
                document.getElementById('sos-location').value = '';
                document.getElementById('sos-desc').value = '';
                
                EmergencyReporter.renderHistory();
            });
        }

        // Listen for updates from admin
        window.addEventListener('local-storage-update', () => {
            EmergencyReporter.renderHistory();
        });

        EmergencyReporter.renderHistory();
    },

    renderHistory: () => {
        const listEl = document.getElementById('sos-cases-list');
        if (!listEl) return;

        const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
        
        if (emergencies.length === 0) {
            listEl.innerHTML = '<p style="font-size:11px; color:var(--text-sec);">No active emergency cases.</p>';
            return;
        }

        let html = '';
        // Only show recent 5
        emergencies.slice(0, 5).forEach(e => {
            let badgeClass = 'badge-danger';
            if(e.status === 'ACKNOWLEDGED') badgeClass = 'badge-warning';
            if(e.status === 'DISPATCHED') badgeClass = 'badge-warning';
            if(e.status === 'RESOLVED') badgeClass = 'badge-success';

            html += `
                <div class="glass-panel" style="margin-bottom:10px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:11px; color:var(--text-main); font-weight:bold;">${e.id} | ${e.type}</span>
                        <span class="badge ${badgeClass}">${e.status}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-sec); margin-bottom:5px;">Loc: ${e.location}</div>
                    ${e.adminNote ? `<div style="font-size:10px; color:var(--primary); background:rgba(100,255,218,0.1); padding:4px; border-radius:4px;">Admin: ${e.adminNote}</div>` : ''}
                    <div style="font-size:9px; color:rgba(255,255,255,0.3); text-align:right; margin-top:5px;">Updated: ${Utils.formatDateTime(e.updatedAt)}</div>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }
};

window.EmergencyReporter = EmergencyReporter;
