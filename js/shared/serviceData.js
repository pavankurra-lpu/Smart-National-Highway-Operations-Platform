// Service points logic

const ServiceData = {
    // Generate synthetic services between nodes
    types: [
        { id: 'hospital', name: 'Hospital / Trauma Center', icon: 'fa-hospital', color: '#ff5e5e' },
        { id: 'food', name: 'Food Court', icon: 'fa-utensils', color: '#fcd34d' },
        { id: 'fuel', name: 'Petrol Bunk', icon: 'fa-gas-pump', color: '#3b82f6' },
        { id: 'police', name: 'Highway Patrol Station', icon: 'fa-shield-halved', color: '#64ffda' },
        { id: 'mechanic', name: 'Mechanic / Garage', icon: 'fa-wrench', color: '#a8a29e' },
        { id: 'toilet', name: 'Public Restroom', icon: 'fa-restroom', color: '#ffffff' }
    ],

    generateServicesForRoute: (nodesList) => {
        const services = [];
        for (let i = 0; i < nodesList.length - 1; i++) {
            const start = nodesList[i];
            const end = nodesList[i+1];
            
            // Deterministic seed from node names
            const segSeed = `${start}-${end}`.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const numServices = (segSeed % 3) + 1; // 1-3 services

            for(let j=0; j<numServices; j++) {
                const hash = segSeed * (j + 1) + j * 7;
                const typeObj = ServiceData.types[Math.abs(hash) % ServiceData.types.length];
                services.push({
                    id: `SRV-${start}-${end}-${j}`,
                    segment: `${start}-${end}`,
                    typeId: typeObj.id,
                    name: `${start} Highway ${typeObj.name}`,
                    icon: typeObj.icon,
                    color: typeObj.color,
                    percentAlongLine: ((hash % 80) + 10) / 100 // 0.10 to 0.90, stable
                });
            }
        }
        return services;
    }
}

window.ServiceData = ServiceData;
