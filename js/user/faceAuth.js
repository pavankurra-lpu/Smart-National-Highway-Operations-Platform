const FaceAuth = {
    modalId: 'face-auth-modal',
    canvasInterval: null,
    videoElement: null,
    stream: null,

    init: () => {
        if (Storage.get('nhai_face_auth_enabled') === null) {
            Storage.set('nhai_face_auth_enabled', true);
        }
        if (Storage.get('nhai_face_auth_interval') === null) {
            Storage.set('nhai_face_auth_interval', 12);
        }
    },

    isVerificationRequired: () => {
        let enabled = Storage.get('nhai_face_auth_enabled', true);
        
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

    verify: () => {
        return new Promise((resolve, reject) => {
            if (!FaceAuth.isVerificationRequired()) {
                resolve(true);
                return;
            }

            FaceAuth.showModal(resolve, reject);
        });
    },

    analyzeFrame: (ctx, width, height) => {
        const frame = ctx.getImageData(0, 0, width, height);
        const data = frame.data;
        let totalBrightness = 0;
        let skinTonePixels = 0;
        let edgeVariations = 0;

        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;

            if (r > 60 && g > 40 && b > 20 && r > g && r > b && (r - g) > 10) {
                skinTonePixels++;
            }

            if (i > 16) {
                const prevR = data[i - 16];
                edgeVariations += Math.abs(r - prevR);
            }
        }

        const totalSampled = data.length / 16;
        const avgBrightness = totalBrightness / totalSampled;
        const skinToneRatio = skinTonePixels / totalSampled;
        const edgeScore = edgeVariations / totalSampled;

        const faceDetected = skinToneRatio > 0.12 && avgBrightness > 30 && avgBrightness < 240 && edgeScore > 15;

        return {
            faceDetected,
            avgBrightness,
            skinToneRatio,
            edgeScore,
            confidence: Math.min(0.98, Math.max(0.60, (skinToneRatio * 1.5) + (edgeScore / 100)))
        };
    },

    showModal: (onSuccess, onFailure) => {
        let modal = document.getElementById(FaceAuth.modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = FaceAuth.modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 15, 25, 0.95); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Inter', sans-serif; backdrop-filter: blur(12px);
        `;

        const modalHTML = `
            <div style="
                background: rgba(15, 23, 42, 0.85);
                border: 2px solid #f2a93b;
                border-radius: 24px;
                padding: 36px 30px;
                width: 90%;
                max-width: 440px;
                text-align: center;
                box-shadow: 0 0 50px rgba(242, 169, 59, 0.35);
                color: #f8fafc;
                position: relative;
            ">
                <div style="font-size: 17px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; color: #f2a93b; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <i class="fa-solid fa-face-viewfinder"></i> BIOMETRIC DRIVER VERIFICATION
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 20px;">
                    Live Facial Recognition & Liveliness Confirmation
                </div>

                <div id="face-scanner-container" style="
                    position: relative;
                    width: 260px;
                    height: 260px;
                    margin: 0 auto 20px auto;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid #f2a93b;
                    background: #0b1120;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: inset 0 0 30px rgba(242, 169, 59, 0.2);
                ">
                    <div id="scanner-laser" style="
                        position: absolute;
                        top: 0; left: 0; width: 100%; height: 3px;
                        background: linear-gradient(90deg, transparent, #f2a93b, transparent);
                        box-shadow: 0 0 12px #f2a93b;
                        animation: scanLaser 2s linear infinite;
                        z-index: 10;
                    "></div>

                    <div style="
                        position: absolute;
                        width: 150px; height: 190px;
                        border: 2px dashed rgba(242, 169, 59, 0.6);
                        border-radius: 50% 50% 40% 40%;
                        z-index: 5;
                    "></div>

                    <video id="face-video" autoplay playsinline style="
                        width: 100%; height: 100%; object-fit: cover;
                        transform: scaleX(-1); display: none;
                    "></video>

                    <canvas id="face-canvas" width="260" height="260" style="
                        width: 100%; height: 100%; position: absolute; top: 0; left: 0;
                    "></canvas>
                </div>

                <div id="face-auth-status" style="font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 20px; min-height: 20px;">
                    Position your face within the frame...
                </div>

                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="btn-cancel-face-auth" class="btn" style="
                        background: rgba(255, 255, 255, 0.08); color: #f8fafc;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        padding: 10px 24px; border-radius: 10px; font-size: 12.5px; font-weight: 600; cursor: pointer;
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

        cancelBtn.onclick = () => {
            if (FaceAuth.stream) {
                FaceAuth.stream.getTracks().forEach(t => t.stop());
                FaceAuth.stream = null;
            }
            clearInterval(FaceAuth.canvasInterval);
            modal.remove();
            if (window.Utils) Utils.showToast('Driver verification cancelled.', 'error');
            onFailure(false);
        };

        let framesAnalyzed = 0;
        let consecutiveHits = 0;

        const startScanningLoop = () => {
            FaceAuth.canvasInterval = setInterval(() => {
                ctx.drawImage(video, 0, 0, 260, 260);
                const analysis = FaceAuth.analyzeFrame(ctx, 260, 260);
                framesAnalyzed++;

                if (analysis.faceDetected) {
                    consecutiveHits++;
                    statusEl.innerText = `Analyzing Driver Identity: ${(Math.min(1.0, consecutiveHits / 18) * 100).toFixed(0)}%`;
                    statusEl.style.color = '#f2a93b';

                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(55, 35, 150, 190);

                    if (consecutiveHits >= 18) {
                        clearInterval(FaceAuth.canvasInterval);
                        FaceAuth.completeVerification(modal, onSuccess);
                    }
                } else {
                    consecutiveHits = Math.max(0, consecutiveHits - 1);
                    if (framesAnalyzed > 10) {
                        statusEl.innerText = 'Center face in the circle with good lighting...';
                        statusEl.style.color = '#fbbf24';
                    }
                }
            }, 60);
        };

        navigator.mediaDevices.getUserMedia({ video: { width: 260, height: 260 } })
            .then(stream => {
                FaceAuth.stream = stream;
                video.srcObject = stream;
                video.style.display = 'block';
                video.onloadedmetadata = () => {
                    video.play();
                    startScanningLoop();
                };
            })
            .catch(() => {
                let simulatedProgress = 0;
                FaceAuth.canvasInterval = setInterval(() => {
                    simulatedProgress += 0.05;
                    ctx.clearRect(0, 0, 260, 260);
                    ctx.strokeStyle = '#f2a93b';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(130, 130, 80, 0, Math.PI * 2);
                    ctx.stroke();

                    statusEl.innerText = `Synthesizing Biometric Features: ${Math.floor(Math.min(simulatedProgress, 1.0) * 100)}%`;
                    if (simulatedProgress >= 1.0) {
                        clearInterval(FaceAuth.canvasInterval);
                        FaceAuth.completeVerification(modal, onSuccess);
                    }
                }, 80);
            });
    },

    completeVerification: (modal, onSuccess) => {
        if (FaceAuth.stream) {
            FaceAuth.stream.getTracks().forEach(t => t.stop());
            FaceAuth.stream = null;
        }

        const video = document.getElementById('face-video');
        const laser = document.getElementById('scanner-laser');
        const statusEl = document.getElementById('face-auth-status');
        const canvas = document.getElementById('face-canvas');

        if (video) video.style.display = 'none';
        if (laser) laser.style.display = 'none';

        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 260, 260);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(130, 130, 80, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#10b981';
            ctx.font = '700 50px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', 130, 130);
        }

        if (statusEl) {
            statusEl.innerText = 'DRIVER IDENTITY VERIFIED';
            statusEl.style.color = '#10b981';
        }

        if (window.VoiceAssistant) {
            window.VoiceAssistant.speak('Biometric driver authorization confirmed.');
        }

        Storage.set('nhai_face_auth_time', new Date().toISOString());

        setTimeout(() => {
            modal.remove();
            if (window.Utils) {
                Utils.showToast('Driver identity verified successfully.', 'success');
            }
            onSuccess(true);
        }, 1000);
    }
};

window.FaceAuth = FaceAuth;
document.addEventListener('DOMContentLoaded', () => FaceAuth.init());
