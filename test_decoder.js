const r = { geometry: "a~l~Fjk~uO??" };

let pts = [];
if (r.geometry && typeof r.geometry === 'string') {
    let index = 0, len = r.geometry.length;
    let lat = 0, lng = 0;
    let is1e6 = false;
    let first = true;
    while (index < len) {
        let b, shift = 0, result = 0;
        do { b = r.geometry.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = 0; result = 0;
        do { b = r.geometry.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
        if (first) {
            if (Math.abs(lat) > 4000000 || Math.abs(lng) > 4000000) is1e6 = true;
            first = false;
        }
        const mult = is1e6 ? 1e-6 : 1e-5;
        pts.push([lng * mult, lat * mult]);
    }
}
console.log(pts);
