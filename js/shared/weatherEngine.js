// Simulated Weather Intelligence Engine

const WeatherEngine = {
    conditions: [
        { code: 'CLEAR', name: 'Clear Skies', icon: 'fa-sun', color: '#fcd34d', riskRisk: 'LOW', tempMod: 0 },
        { code: 'RAIN', name: 'Heavy Rain', icon: 'fa-cloud-showers-heavy', color: '#3b82f6', riskRisk: 'MEDIUM', tempMod: -5 },
        { code: 'FOG', name: 'Dense Fog', icon: 'fa-smog', color: '#a8a29e', riskRisk: 'HIGH', tempMod: -3 },
        { code: 'STORM', name: 'Thunderstorm', icon: 'fa-cloud-bolt', color: '#8b5cf6', riskRisk: 'HIGH', tempMod: -8 },
        { code: 'HEAT', name: 'Extreme HeatWave', icon: 'fa-temperature-arrow-up', color: '#ef4444', riskRisk: 'MEDIUM', tempMod: +8 }
    ],

    // Deterministic simulation based on node coordinates and current hour string
    // This ensures consistency across tabs and reloads for the same hour.
    getWeatherForNode: (nodeId) => {
        const node = window.IndiaMapData?.nodes[nodeId];
        if (!node) return null;

        // Create a pseudo-random seed based on lat, lng and current hour
        const hour = new Date().getHours();
        const seedStr = `${node.lat}-${node.lng}-${hour}`;
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Base temp dependent on latitude (lower lat = higher base temp in India)
        // India lat range roughly 8 (South) to 35 (North)
        const baseTemp = 42 - (node.lat * 0.6); 

        // Pseudo-random condition (bias towards clear/rain mostly)
        const conditionIndex = Math.abs(hash) % WeatherEngine.conditions.length;
        const condition = WeatherEngine.conditions[conditionIndex];

        const finalTemp = Math.round(baseTemp + condition.tempMod);

        return {
            temp: finalTemp,
            condition: condition,
            advisory: WeatherEngine.getAdvisoryMessage(condition.code)
        };
    },

    getAdvisoryMessage: (code) => {
        switch(code) {
            case 'CLEAR': return "Optimal travel conditions.";
            case 'RAIN': return "Slippery roads. Reduce speed by 20%.";
            case 'FOG': return "Low visibility. Use fog lights & hazard lamps.";
            case 'STORM': return "High winds and lightning hazard. Proceed with caution.";
            case 'HEAT': return "Check tire pressure and coolant levels.";
            default: return "Drive safely.";
        }
    },

    generateRouteSummary: (routeNodes) => {
        let maxRisk = 'LOW';
        let worstCondition = 'CLEAR';
        let worstNote = "Optimal travel conditions.";

        const riskValues = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2 };

        if (!routeNodes || routeNodes.length === 0) return null;

        const startW = WeatherEngine.getWeatherForNode(routeNodes[0]);
        const endW = WeatherEngine.getWeatherForNode(routeNodes[routeNodes.length - 1]);

        routeNodes.forEach(nId => {
            const w = WeatherEngine.getWeatherForNode(nId);
            if (w && riskValues[w.condition.riskRisk] > riskValues[maxRisk]) {
                maxRisk = w.condition.riskRisk;
                worstCondition = w.condition.name;
                worstNote = w.advisory;
            }
        });

        // Modify ETA text based on weather risk
        let penaltyMulti = 1;
        if (maxRisk === 'MEDIUM') penaltyMulti = 1.15;
        if (maxRisk === 'HIGH') penaltyMulti = 1.35;

        return {
            startWeather: startW,
            endWeather: endW,
            overallRisk: maxRisk,
            overallConditionName: worstCondition,
            advisory: worstNote,
            etaPenalty: penaltyMulti
        };
    }
};

window.WeatherEngine = WeatherEngine;
