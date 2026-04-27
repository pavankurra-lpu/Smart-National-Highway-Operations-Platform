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
        // Just mock some random services along the path
        for (let i = 0; i < nodesList.length - 1; i++) {
            const start = nodesList[i];
            const end = nodesList[i+1];
            
            // Add 1-3 services between these two nodes randomly
            const numServices = Math.floor(Math.random() * 3) + 1;
            for(let j=0; j<numServices; j++) {
                const typeObj = ServiceData.types[Math.floor(Math.random() * ServiceData.types.length)];
                services.push({
                    id: Utils.generateId('SRV'),
                    segment: `${start}-${end}`,
                    typeId: typeObj.id,
                    name: `${start} Highway ${typeObj.name}`,
                    icon: typeObj.icon,
                    color: typeObj.color,
                    percentAlongLine: Math.random() // Used to place marker somewhere between nodes
                });
            }
        }
        return services;
    }
}

window.ServiceData = ServiceData;
