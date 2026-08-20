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

                if (!confirm('Confirm SOS submission? This will alert emergency services.')) return;

                // Add to Shared Storage (Admin will see it instantly)
                Storage.addEmergency(emergencyData);

                if (window.RealtimeService) {
                    RealtimeService.emitSOS(emergencyData);
                }

                Utils.showToast(`SOS Triggered! Admin notified. Ref NO: ${emergencyData.id}`);
                if (window.Gamification) {
                    Gamification.unlockAchievement('highway_guardian', 'Guardian', 200);
                }
                
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
            listEl.innerHTML = `
                <div style="text-align: center; padding: 30px 20px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: 12px; margin-top: 10px;">
                    <i class="fa-solid fa-shield-heart" style="font-size: 24px; color: var(--text-muted); margin-bottom: 12px;"></i>
                    <p style="color: var(--text-main); font-size: 13px; font-weight: 600; margin: 0 0 4px;">No Active Incidents</p>
                    <p style="color: var(--text-muted); font-size: 11px; margin: 0; line-height: 1.4;">Your reported SOS emergencies and their admin resolution status will appear here.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = emergencies.slice(0, 5).map(c => {
            const date = new Date(c.reportedAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            
            let badgeClass = 'badge-pending';
            if(c.status === 'ACKNOWLEDGED') badgeClass = 'badge-warning';
            if(c.status === 'DISPATCHED') badgeClass = 'badge-primary';
            if(c.status === 'RESOLVED') badgeClass = 'badge-success';

            let actionBtn = '';
            if (c.status === 'RESOLVED') {
                actionBtn = `<button class="btn btn-outline w-full" style="justify-content:center; margin-top:8px; font-size:11px;" onclick="EmergencyReporter.openFeedback('${Utils.escapeHtml(c.id)}')">Review & Close Incident</button>`;
            } else if (c.status === 'CLOSED') {
                actionBtn = `<div style="font-size:10px; color:var(--text-sec); margin-top:8px; text-align:center;"><i class="fa-solid fa-check-double"></i> Closed (Rated ${Utils.escapeHtml(c.feedbackRating)}★)</div>`;
            }

            return `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <p style="color: #fff; font-size: 13px; font-weight: 600; margin: 0 0 4px;"><i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red); margin-right:5px;"></i> ${Utils.escapeHtml(c.type)}</p>
                            <p style="color: var(--text-sec); font-size: 11px; margin: 0;">${Utils.escapeHtml(c.location)}</p>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge ${badgeClass}" style="margin-bottom: 4px;">${Utils.escapeHtml(c.status)}</span>
                            <p style="color: var(--text-muted); font-size: 9px; margin: 0;">${date}</p>
                        </div>
                    </div>

                    <!-- Kokonut Timeline Tracker -->
                    <div class="kokonut-timeline" style="margin-top: 15px;">
                        <div class="kokonut-timeline-item active">
                            <div class="kokonut-timeline-title">Request Raised</div>
                            <div class="kokonut-timeline-desc">${date}</div>
                        </div>
                        <div class="kokonut-timeline-item ${['ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED', 'CLOSED'].includes(c.status) ? 'active' : ''}">
                            <div class="kokonut-timeline-title">Control Room Acknowledged</div>
                            <div class="kokonut-timeline-desc">Verifying details</div>
                        </div>
                        <div class="kokonut-timeline-item ${['DISPATCHED', 'RESOLVED', 'CLOSED'].includes(c.status) ? 'active' : ''}">
                            <div class="kokonut-timeline-title">Unit Dispatched</div>
                            <div class="kokonut-timeline-desc">Emergency responders en route</div>
                        </div>
                        <div class="kokonut-timeline-item ${['RESOLVED', 'CLOSED'].includes(c.status) ? 'active' : ''}" style="margin-bottom: 0;">
                            <div class="kokonut-timeline-title">Case Resolved</div>
                            <div class="kokonut-timeline-desc">Issue cleared from highway</div>
                        </div>
                    </div>
                    ${c.adminNote && c.status !== 'RESOLVED' && c.status !== 'CLOSED' ? `<div style="font-size:10px; color:var(--primary); background:rgba(100,255,218,0.1); padding:4px; border-radius:4px; margin-top:10px;">Admin: ${Utils.escapeHtml(c.adminNote)}</div>` : ''}
                    ${actionBtn}
                </div>
            `;
        }).join('');
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
            const placeholder = document.getElementById('fb-res-placeholder');
            if (inc.resolutionImage && inc.resolutionImage.trim() !== '') {
                imgEl.src = inc.resolutionImage;
                imgEl.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
            } else {
                imgEl.src = '';
                imgEl.style.display = 'none';
                if (placeholder) placeholder.style.display = 'block';
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
