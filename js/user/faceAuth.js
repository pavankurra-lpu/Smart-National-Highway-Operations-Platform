// SNHOP Face Recognition Biometric Security System

const FaceAuth = {
    modalId: 'face-auth-modal',
    canvasInterval: null,

    init: () => {
        // Initialize settings default if needed
        if (Storage.get('nhai_face_auth_enabled') === null) {
            Storage.set('nhai_face_auth_enabled', true);
        }
        if (Storage.get('nhai_face_auth_interval') === null) {
            Storage.set('nhai_face_auth_interval', 12); // Default 12 hours
        }
    },

    isVerificationRequired: () => {
        let enabled = Storage.get('nhai_face_auth_enabled', true);
        
        // If a specific active vehicle is selected, override global setting
        if (window.VehicleGarage) {
            const activeVeh = VehicleGarage.getActive();
            if (activeVeh && activeVeh.requireFaceAuth !== undefined) {
                enabled = activeVeh.requireFaceAuth;
            }
        }

        if (!enabled) return false;

        const lastAuthTime = Storage.get('nhai_face_auth_time');
        if (!lastAuthTime) return true;

        const intervalHours = parseFloat(Storage.get('nhai_face_auth_interval', 12));
        const diffMs = Date.now() - new Date(lastAuthTime).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        return diffHours >= intervalHours;
    },

    // Trigger face auth sequence. Returns a Promise.
    verify: () => {
        return new Promise((resolve, reject) => {
            if (!FaceAuth.isVerificationRequired()) {
                resolve(true);
                return;
            }

            FaceAuth.showModal(resolve, reject);
        });
    },

    showModal: (onSuccess, onFailure) => {
        // Remove existing modal if any
        let modal = document.getElementById(FaceAuth.modalId);
        if (modal) modal.remove();

        // Create the modal element
        modal = document.createElement('div');
        modal.id = FaceAuth.modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 15, 10, 0.95); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Inter', sans-serif; backdrop-filter: blur(10px);
        `;

        const modalHTML = `
            <div style="
                background: rgba(30, 45, 30, 0.8);
                border: 2px solid #8da672;
                border-radius: 24px;
                padding: 40px;
                width: 90%;
                max-width: 480px;
                text-align: center;
                box-shadow: 0 0 50px rgba(141, 166, 114, 0.4);
                color: #f4f7f0;
                position: relative;
            ">
                <!-- Glowing laser scan effects -->
                <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 10px; color: #8da672;">
                    <i class="fa-solid fa-face-viewfinder"></i> BIOMETRIC SIMULATION (DEMO)
                </div>
                <div style="font-size: 13px; color: #a3ad9b; margin-bottom: 25px;">
                    NHAI Smart Security: Simulated driver biometric check
                </div>

                <!-- Camera/Scan Container -->
                <div id="face-scanner-container" style="
                    position: relative;
                    width: 320px;
                    height: 320px;
                    margin: 0 auto 25px auto;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 4px solid #8da672;
                    background: #121510;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: inset 0 0 30px rgba(0, 255, 0, 0.2);
                ">
                    <!-- Scanner Laser Line -->
                    <div id="scanner-laser" style="
                        position: absolute;
                        top: 0; left: 0; width: 100%; height: 3px;
                        background: linear-gradient(90deg, transparent, #8da672, transparent);
                        box-shadow: 0 0 10px #8da672;
                        animation: scanLaser 2s linear infinite;
                        z-index: 10;
                    "></div>

                    <!-- Target Overlay Outline -->
                    <div style="
                        position: absolute;
                        width: 180px; height: 230px;
                        border: 2px dashed rgba(141, 166, 114, 0.6);
                        border-radius: 50% 50% 40% 40%;
                        z-index: 5;
                    "></div>

                    <!-- Live Video Feed -->
                    <video id="face-video" autoplay playsinline style="
                        width: 100%; height: 100%; object-fit: cover;
                        transform: scaleX(-1); display: none;
                    "></video>

                    <!-- Face Mesh Canvas (Webcam Fallback or Grid Effect) -->
                    <canvas id="face-canvas" width="320" height="320" style="
                        width: 100%; height: 100%; position: absolute; top: 0; left: 0;
                    "></canvas>
                </div>

                <!-- Status Feedback -->
                <div id="face-auth-status" style="font-size: 15px; font-weight: 600; color: #f4f7f0; margin-bottom: 25px; min-height: 22px;">
                    Connecting Camera...
                </div>

                <!-- Controls -->
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="btn-cancel-face-auth" class="btn" style="
                        background: rgba(255, 255, 255, 0.05); color: #f4f7f0;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
                    ">Cancel</button>
                </div>
            </div>
            
            <style>
                @keyframes scanLaser {
                    0% { top: 0%; }
                    50% { top: 100%; }
                    100% { top: 0%; }
                }
            </style>
        `;

        modal.innerHTML = modalHTML;
        document.body.appendChild(modal);

        const video = document.getElementById('face-video');
        const canvas = document.getElementById('face-canvas');
        const ctx = canvas.getContext('2d');
        const statusEl = document.getElementById('face-auth-status');
        const cancelBtn = document.getElementById('btn-cancel-face-auth');

        let cameraStream = null;

        // Cancel handler
        cancelBtn.onclick = () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(t => t.stop());
            }
            clearInterval(FaceAuth.canvasInterval);
            modal.remove();
            Utils.showToast('Face recognition verification cancelled.', 'error');
            onFailure(false);
        };

        // Draw futuristic cyber grid animation on canvas
        const drawGrid = (isLocked = false, progress = 0) => {
            ctx.clearRect(0, 0, 320, 320);

            // Draw scanning nodes
            ctx.strokeStyle = isLocked ? '#10b981' : '#8da672';
            ctx.lineWidth = 1;

            const time = Date.now() * 0.002;
            const cx = 160;
            const cy = 160;

            // Draw target nodes
            const points = [];
            const rows = 9;
            const cols = 9;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const px = 60 + c * 25;
                    const py = 60 + r * 25;
                    
                    // Keep nodes only inside circle radius
                    const dx = px - cx;
                    const dy = py - cy;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 120) {
                        // Apply slight random movement
                        const ox = Math.sin(time + px) * 3;
                        const oy = Math.cos(time + py) * 3;
                        points.push({ x: px + ox, y: py + oy });
                    }
                }
            }

            // Draw triangles/lines between nodes
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    const dx = points[i].x - points[j].x;
                    const dy = points[i].y - points[j].y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 32) {
                        ctx.moveTo(points[i].x, points[i].y);
                        ctx.lineTo(points[j].x, points[j].y);
                    }
                }
            }
            ctx.globalAlpha = 0.15;
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            // Draw glowing node dots
            ctx.fillStyle = isLocked ? '#10b981' : '#8da672';
            points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw dynamic scanner details
            ctx.fillStyle = isLocked ? '#10b981' : '#8da672';
            ctx.font = '10px monospace';
            ctx.fillText(`SYS: ${isLocked ? 'SECURE' : 'COMPUTING'}`, 20, 30);
            ctx.fillText(`MATCH: ${(progress * 100).toFixed(0)}%`, 20, 45);
            ctx.fillText(`CONF: ${(80 + progress * 19.8).toFixed(1)}%`, 20, 60);

            // Draw crosshairs
            ctx.strokeStyle = isLocked ? '#10b981' : 'rgba(141, 166, 114, 0.4)';
            ctx.beginPath();
            ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
            ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
            ctx.stroke();
        };

        // Try webcam access
        navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } })
            .then(stream => {
                cameraStream = stream;
                video.srcObject = stream;
                video.style.display = 'block';
                statusEl.innerText = 'Demo Biometric Simulation...';
                statusEl.style.color = '#8da672';
                
                // Audio signal if VoiceAssistant is available
                if (window.VoiceAssistant) {
                    window.VoiceAssistant.speak('Demo biometric scan in progress.');
                }

                let progress = 0;
                FaceAuth.canvasInterval = setInterval(() => {
                    progress += 0.02;
                    drawGrid(false, Math.min(progress, 1));
                    statusEl.innerText = `Analyzing Matrix (Demo Simulation): ${Math.floor(progress * 100)}%`;

                    if (progress >= 1.0) {
                        clearInterval(FaceAuth.canvasInterval);
                        FaceAuth.completeVerification(stream, modal, onSuccess);
                    }
                }, 50);
            })
            .catch(err => {
                console.warn('Camera blocked or unavailable, using grid simulation.', err);
                statusEl.innerText = 'Initializing Demo Biometric Simulation...';
                
                let progress = 0;
                FaceAuth.canvasInterval = setInterval(() => {
                    progress += 0.02;
                    drawGrid(false, Math.min(progress, 1));
                    statusEl.innerText = `Simulating Biometric Grid (Demo): ${Math.floor(progress * 100)}%`;

                    if (progress >= 1.0) {
                        clearInterval(FaceAuth.canvasInterval);
                        FaceAuth.completeVerification(null, modal, onSuccess);
                    }
                }, 50);
            });
    },

    completeVerification: (stream, modal, onSuccess) => {
        const video = document.getElementById('face-video');
        const statusEl = document.getElementById('face-auth-status');
        const laser = document.getElementById('scanner-laser');

        if (stream) {
            stream.getTracks().forEach(t => t.stop());
        }
        if (video) video.style.display = 'none';
        if (laser) laser.style.display = 'none';

        // Redraw success screen
        const canvas = document.getElementById('face-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 320, 320);

            // Draw glowing green locked nodes
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(160, 160, 90, 0, Math.PI * 2);
            ctx.stroke();

            // Draw checkmark
            ctx.fillStyle = '#10b981';
            ctx.font = '700 80px "Font Awesome 6 Free"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', 160, 160);
        }

        statusEl.innerText = 'DEMO VERIFIED. (Simulation only — not real biometric check)';
        statusEl.style.color = '#10b981';

        // Voice confirmation
        if (window.VoiceAssistant) {
            window.VoiceAssistant.speak('Demo biometric check complete.');
        }

        // Save timestamp to storage (which write-throughs to backend)
        const nowStr = new Date().toISOString();
        Storage.set('nhai_face_auth_time', nowStr);

        setTimeout(() => {
            modal.remove();
            Utils.showToast('Face recognition identity verified!', 'success');
            onSuccess(true);
        }, 1500);
    }
};

// Expose and initialize
window.FaceAuth = FaceAuth;
document.addEventListener('DOMContentLoaded', () => FaceAuth.init());
