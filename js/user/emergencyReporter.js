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

                const phoneRegex = /^[6-9]\d{9}$/;
                if (phone && !phoneRegex.test(phone)) {
                    Utils.showToast("Please enter a valid 10-digit Indian mobile number.", "error");
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

        // Feedback Modal Handlers
        const stars = document.querySelectorAll('.fb-star');
        if (stars.length > 0) {
            stars.forEach(star => {
                star.addEventListener('click', (e) => {
                    const rating = parseInt(star.getAttribute('data-rating'));
                    document.getElementById('fb-rating-value').value = rating;
                    stars.forEach(s => {
                        const sRating = parseInt(s.getAttribute('data-rating'));
                        s.style.color = sRating <= rating ? '#fbbf24' : 'var(--border)';
                    });
                });
            });
        }

        const submitFbBtn = document.getElementById('btn-submit-feedback');
        if (submitFbBtn) {
            submitFbBtn.onclick = () => {
                const rating = parseInt(document.getElementById('fb-rating-value').value) || 0;
                const comment = document.getElementById('fb-comment').value.trim();
                const id = document.getElementById('resolution-feedback-modal').dataset.incidentId;
                
                if (!id) return;
                if (rating === 0) {
                    Utils.showToast("Please provide a star rating.", "error");
                    return;
                }

                Storage.addEmergencyFeedback(id, rating, comment);
                Utils.toggleVisibility('resolution-feedback-modal', false);
                Utils.showToast("Thank you! Feedback submitted and incident closed.", "success");
                EmergencyReporter.renderHistory();
            };
        }

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
            if(e.status === 'CLOSED') badgeClass = 'badge-success';

            let actionBtn = '';
            if (e.status === 'RESOLVED') {
                actionBtn = `<button class="btn btn-outline w-full" style="justify-content:center; margin-top:8px; font-size:11px;" onclick="EmergencyReporter.openFeedback('${e.id}')">Review & Close Incident</button>`;
            } else if (e.status === 'CLOSED') {
                actionBtn = `<div style="font-size:10px; color:var(--text-sec); margin-top:8px; text-align:center;"><i class="fa-solid fa-check-double"></i> Closed (Rated ${e.feedbackRating}★)</div>`;
            }

            html += `
                <div class="glass-panel" style="margin-bottom:10px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:11px; color:var(--text-main); font-weight:bold;">${e.id} | ${e.type}</span>
                        <span class="badge ${badgeClass}">${e.status}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-sec); margin-bottom:5px;">Loc: ${e.location}</div>
                    ${e.adminNote && e.status !== 'RESOLVED' && e.status !== 'CLOSED' ? `<div style="font-size:10px; color:var(--primary); background:rgba(100,255,218,0.1); padding:4px; border-radius:4px;">Admin: ${e.adminNote}</div>` : ''}
                    <div style="font-size:9px; color:rgba(255,255,255,0.3); text-align:right; margin-top:5px;">Updated: ${Utils.formatDateTime(e.updatedAt)}</div>
                    ${actionBtn}
                </div>
            `;
        });
        listEl.innerHTML = html;
    },

    openFeedback: (id) => {
        const emergencies = Storage.get(Storage.KEYS.EMERGENCIES, []);
        const inc = emergencies.find(e => e.id === id);
        if (!inc) {
            console.error("Incident not found for feedback:", id);
            return;
        }

        const noteEl = document.getElementById('fb-admin-note');
        const imgEl = document.getElementById('fb-res-image');
        const modal = document.getElementById('resolution-feedback-modal');

        if (noteEl) noteEl.innerText = inc.adminNote || 'No notes provided.';
        
        if (imgEl) {
            if (inc.resolutionImage) {
                imgEl.src = inc.resolutionImage;
                imgEl.parentElement.style.display = 'block';
            } else {
                imgEl.parentElement.style.display = 'none';
            }
        }

        // Reset stars
        const ratingInput = document.getElementById('fb-rating-value');
        if (ratingInput) ratingInput.value = 0;
        document.querySelectorAll('.fb-star').forEach(s => s.style.color = 'var(--border)');
        
        const commentInput = document.getElementById('fb-comment');
        if (commentInput) commentInput.value = '';

        if (modal) {
            modal.dataset.incidentId = id;
            modal.classList.remove('hidden');
        }
    }
};

window.EmergencyReporter = EmergencyReporter;
