// Live Meteorological & Road Advisory Weather Engine (Open-Meteo API + Fallback)

const WeatherEngine = {
    conditions: [
        { code: 'CLEAR', name: 'Clear Skies', icon: 'fa-sun', color: '#fcd34d', risk: 'LOW', tempMod: 0 },
        { code: 'RAIN', name: 'Heavy Rain / Showers', icon: 'fa-cloud-showers-heavy', color: '#10b981', risk: 'MEDIUM', tempMod: -5 },
        { code: 'FOG', name: 'Dense Fog / Mist', icon: 'fa-smog', color: '#a8a29e', risk: 'HIGH', tempMod: -3 },
        { code: 'STORM', name: 'Severe Thunderstorm', icon: 'fa-cloud-bolt', color: '#8b5cf6', risk: 'HIGH', tempMod: -8 },
        { code: 'HEAT', name: 'Extreme Heatwave', icon: 'fa-temperature-arrow-up', color: '#ef4444', risk: 'HIGH', tempMod: +8 }
    ],

    // In-memory weather cache (key: "lat,lng" -> { data, timestamp })
    _cache: new Map(),
    _CACHE_TTL_MS: 15 * 60 * 1000, // 15 minutes

    /**
     * Map WMO Weather Interpretation Codes to NHAI Road Conditions
     * Reference: https://open-meteo.com/en/docs
     */
    mapWmoCodeToCondition: (wmoCode, temperature) => {
        if (typeof temperature === 'number' && temperature >= 42) {
            return WeatherEngine.conditions.find(c => c.code === 'HEAT');
        }

        // Thunderstorm / Squall
        if ([95, 96, 99].includes(wmoCode)) {
            return WeatherEngine.conditions.find(c => c.code === 'STORM');
        }
        // Fog / Freezing Fog
        if ([45, 48].includes(wmoCode)) {
            return WeatherEngine.conditions.find(c => c.code === 'FOG');
        }
        // Rain / Drizzle / Showers / Snow
        if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 85, 86].includes(wmoCode)) {
            return WeatherEngine.conditions.find(c => c.code === 'RAIN');
        }
        // Clear / Partly Cloudy / Overcast
        return WeatherEngine.conditions.find(c => c.code === 'CLEAR');
    },

    /**
     * Fetches real live weather from Open-Meteo public API for given coordinates.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<Object>} Weather state object
     */
    fetchLiveWeather: async (lat, lng) => {
        const cacheKey = `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`;
        const cached = WeatherEngine._cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < WeatherEngine._CACHE_TTL_MS)) {
            return cached.data;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);

            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&timezone=auto`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const json = await res.json();
                const cur = json.current || {};
                const temp = Math.round(cur.temperature_2m !== undefined ? cur.temperature_2m : 32);
                const wmo = cur.weather_code !== undefined ? cur.weather_code : 0;
                const condition = WeatherEngine.mapWmoCodeToCondition(wmo, temp);

                const result = {
                    temp,
                    humidity: cur.relative_humidity_2m || 50,
                    windSpeed: cur.wind_speed_10m || 10,
                    precipitation: cur.precipitation || 0,
                    condition,
                    source: 'LIVE_OPEN_METEO',
                    advisory: WeatherEngine.getAdvisoryMessage(condition.code)
                };

                WeatherEngine._cache.set(cacheKey, { data: result, timestamp: Date.now() });
                return result;
            }
        } catch (e) {
            // Live fetch failed / offline / timeout: fallback seamlessly
        }

        // Fallback to local model
        return WeatherEngine._calculateLocalWeather(lat, lng);
    },

    /**
     * Internal deterministic calculation based on coordinates and diurnal time
     */
    _calculateLocalWeather: (lat, lng) => {
        const hour = new Date().getHours();
        const seedStr = `${lat}-${lng}-${hour}`;
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const baseTemp = 42 - (lat * 0.6); 
        const conditionIndex = Math.abs(hash) % WeatherEngine.conditions.length;
        const condition = WeatherEngine.conditions[conditionIndex];
        const finalTemp = Math.round(baseTemp + condition.tempMod);

        return {
            temp: finalTemp,
            humidity: 55,
            windSpeed: 12,
            precipitation: condition.code === 'RAIN' ? 15 : 0,
            condition,
            source: 'LOCAL_MODEL',
            advisory: WeatherEngine.getAdvisoryMessage(condition.code)
        };
    },

    getWeatherForNode: (nodeId) => {
        const node = window.IndiaMapData?.nodes[nodeId];
        if (!node) return null;

        const cacheKey = `${Number(node.lat).toFixed(2)},${Number(node.lng).toFixed(2)}`;
        const cached = WeatherEngine._cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < WeatherEngine._CACHE_TTL_MS)) {
            return cached.data;
        }

        // Trigger background live fetch to warm cache for subsequent queries
        if (typeof window !== 'undefined' && window.fetch) {
            WeatherEngine.fetchLiveWeather(node.lat, node.lng).catch(() => {});
        }

        return WeatherEngine._calculateLocalWeather(node.lat, node.lng);
    },

    getAdvisoryMessage: (code) => {
        switch(code) {
            case 'CLEAR': return "Optimal travel conditions. Highway clear.";
            case 'RAIN': return "Slippery roads. Reduce vehicle speed by 20%. Maintain braking distance.";
            case 'FOG': return "Low visibility advisory. Use fog lamps & maintain lane discipline.";
            case 'STORM': return "High crosswinds & lightning alert. Exercise heightened vigilance.";
            case 'HEAT': return "Extreme heatwave alert. Inspect tyre pressures and radiator coolant. Hydrate frequently.";
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
            if (w && riskValues[w.condition.risk] > riskValues[maxRisk]) {
                maxRisk = w.condition.risk;
                worstCondition = w.condition.name;
                worstNote = w.advisory;
            }
        });

        let penaltyMulti = 1.0;
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

if (typeof window !== 'undefined') {
    window.WeatherEngine = WeatherEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherEngine;
}
