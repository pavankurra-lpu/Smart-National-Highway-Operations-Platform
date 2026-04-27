// Dijkstra based Routing Engine Implementation

const RouteEngine = {
    // Dijkstra algorithm to find path optimizing a specific weight function
    // weightFunc takes (edge, currentPath) and returns incremental weight
    dijkstra: (startNode, endNode, weightFunc) => {
        const dist = {};
        const prev = {};
        const pq = new Set(); // Using Set as a simple priority queue since graph is small

        Object.keys(RouteGraph.edges).forEach(node => {
            dist[node] = Infinity;
            prev[node] = null;
            pq.add(node);
        });
        dist[startNode] = 0;

        while (pq.size > 0) {
            // Find node in pq with min dist
            let u = null;
            let minD = Infinity;
            pq.forEach(node => {
                if (dist[node] < minD) {
                    minD = dist[node];
                    u = node;
                }
            });

            if (u === null || dist[u] === Infinity) break; 
            if (u === endNode) break; 
            pq.delete(u);

            const neighbors = RouteGraph.edges[u] || [];
            neighbors.forEach(edge => {
                if (!pq.has(edge.to)) return;

                const alt = dist[u] + weightFunc(edge);
                if (alt < dist[edge.to]) {
                    dist[edge.to] = alt;
                    prev[edge.to] = { from: u, edge: edge };
                }
            });
        }

        // Reconstruct path
        const path = [];
        let edges = [];
        let curr = endNode;
        if (prev[curr] || curr === startNode) {
            while (curr !== null) {
                path.unshift(curr);
                if (prev[curr]) edges.unshift(prev[curr].edge);
                curr = prev[curr] ? prev[curr].from : null;
            }
        }
        
        return { path, edges };
    },

    calculateRoute: (origin, dest, vehicleType, mode, prefs = {avoidTolls: false, useFastag: true}) => {
        if (origin === dest) return null;

        // Weight functions based on mode
        let weightFunc;
        if (mode === 'FASTEST') {
            weightFunc = (edge) => {
                let w = edge.distance / edge.speedLimit;
                if (prefs.avoidTolls && edge.tolls && edge.tolls.length > 0) w += 10000; // Heavy penalty
                return w;
            };
        } else if (mode === 'CHEAPEST') {
            // Optimize for toll cost + fuel
            weightFunc = (edge) => {
                let cost = 0;
                if (edge.tolls) {
                    edge.tolls.forEach(tId => cost += TollData.getTollCost(tId, vehicleType));
                }
                if (prefs.avoidTolls && edge.tolls && edge.tolls.length > 0) cost += 10000;
                return cost + (edge.distance * 0.5); // 0.5 as fuel proxy
            };
        } else if (mode === 'EMERGENCY') {
            // Emergency Priority: Ignore cost completely. Only care about speed and zero traffic disruption.
            weightFunc = (edge) => {
                return (edge.distance / edge.speedLimit) * 0.8; // Implicit priority lanes
            };
        } else {
            // BALANCED: (0.40 * time) + (0.20 * toll_cost) + (0.20 * congestion) + (0.10 * risk) + (0.10 * fuel)
            weightFunc = (edge) => {
                let cost = 0;
                if (edge.tolls) {
                    edge.tolls.forEach(tId => cost += TollData.getTollCost(tId, vehicleType));
                }
                if (prefs.avoidTolls && edge.tolls && edge.tolls.length > 0) cost += 10000;
                
                let time = edge.distance / edge.speedLimit;
                
                // Deterministic congestion simulation based on edge to/from names
                const seed = (edge.from || u).length + (edge.to || '').length;
                let congestion = (seed % 5) / 10; // 0.0 to 0.4 based on edge name length
                
                let risk = edge.distance * 0.05;
                let fuel = edge.distance * 0.5;

                return (0.40 * time) + (0.20 * cost) + (0.20 * congestion) + (0.10 * risk) + (0.10 * fuel);
            };
        }

        const result = RouteEngine.dijkstra(origin, dest, weightFunc);
        if (result.path.length <= 1) return null;

        // Calculate Totals for the found path
        let totalDist = 0;
        let totalCost = 0;
        let totalTimeHr = 0;
        let tollList = [];

        result.edges.forEach(e => {
            totalDist += e.distance;
            totalTimeHr += (e.distance / e.speedLimit);
            if (e.tolls) {
                e.tolls.forEach(tId => {
                    tollList.push(tId);
                    // Fastag calculation
                    let c = TollData.getTollCost(tId, vehicleType);
                    if (!prefs.useFastag) c *= 2; // Double toll penalty for cash
                    totalCost += c;
                });
            }
        });

        // Ensure distinct metric jittering to distinctify routes
        if(mode === 'BALANCED') totalTimeHr += 0.2; 
        if(mode === 'CHEAPEST') totalTimeHr += 0.5; 
        if(mode === 'EMERGENCY') totalTimeHr -= 0.3;

        return {
            nodes: result.path,
            edges: result.edges,
            totalDistance: totalDist,
            totalTollCost: totalCost,
            estimatedTimeHr: parseFloat(Math.max(0.1, totalTimeHr).toFixed(1)),
            tolls: tollList,
            vehicleType, mode, prefs
        };
    }
};

window.RouteEngine = RouteEngine;
