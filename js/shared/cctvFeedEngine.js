// Centralized Hybrid CCTV Generator logic

const CCTVFeedEngine = {
    triggerFallback: (imgElement) => {
        // If image URL fails, switch to simulated feed
        const parent = imgElement.parentElement;
        if(parent) {
            parent.innerHTML = CCTVFeedEngine.getLiveSimulationHTML();
        }
    },

    getFeedHTML: (cameraData) => {
        const mode = cameraData.mode || 'SIMULATION'; // PUBLIC, SIMULATION, OFFLINE
        const url = cameraData.url;

        let content = '';

        if (mode === 'OFFLINE') {
            content = `<div class="cctv-feed-sim" style="background-color: rgba(255, 94, 94, 0.4);">
                <i class="fa-solid fa-plane-slash fa-2x" style="color:rgba(255,255,255,0.4)"></i>
            </div>`;
        } else if (mode === 'PUBLIC' && url) {
            content = `<div class="cctv-feed-sim" style="background:#000;">
                <img src="${url}" style="width:100%; height:100%; object-fit:cover; opacity: 0.8;" onerror="CCTVFeedEngine.triggerFallback(this)" />
            </div>`;
        } else {
            // Live Simulation default
            content = CCTVFeedEngine.getLiveSimulationHTML();
        }

        return content;
    },

    getLiveSimulationHTML: () => {
        // A visual simulation using CSS patterns + an animated car icon
        return `<div class="cctv-feed-sim" style="background-color: rgba(0,0,0,0.4); position:relative; overflow:hidden;">
            <div class="pixel-noise"></div>
            <i class="fa-solid fa-car-side" style="color:rgba(255,255,255,0.2); font-size:40px; position:absolute; top:40%; left:-50px; animation: driveBy 4s infinite linear;"></i>
            <i class="fa-solid fa-truck" style="color:rgba(255,255,255,0.1); font-size:50px; position:absolute; top:20%; right:-50px; animation: driveByRev 7s infinite linear;"></i>
        </div>`;
    }
};

window.CCTVFeedEngine = CCTVFeedEngine;
