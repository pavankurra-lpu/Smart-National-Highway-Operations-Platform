# nhai-smart-highway-platform (NHAI Smart Highway Mobility, FASTag & Emergency Response Platform)

Alternative Branding: **Smart NHAI Highway Travel & Toll Intelligence System**

## 📌 Project Overview
This is a premium, high-end, portfolio-grade Indian highway mobility platform inspired by **NHAI** and **FASTag** workflows. It features a complete **Dual-Portal System**, simulating the real-world experience for both Highway Travellers and NHAI Operations Administrators. The application is completely static (HTML/CSS/Vanilla JS) and operates elegantly via a shared `localStorage` state to pass live data between portals.

It is built as a highly interactive, GitHub-worthy demonstration of dynamic web technologies, Graph algorithms (Dijkstra) for route planning, and reactive UI updates.

---

## 🚀 Key Features

### 🟢 User Portal (Traveller End)
- **All-India Route Planning Map**: Interactive route planning across an expansive national graph, utilizing Leaflet.js with Map Layer switching (Standard / Dark / Satellite Hybrid).
- **Live Weather Intelligence**: Simulated dynamic weather engine tracks Origin/Destination and cross-route impact (Rain / Storm / Fog) seamlessly modifying travel ETAs and showing real-time road advisories.
- **Smart Route Engine**: Calculates the Fastest Route, Lowest Toll Route, and Balanced Route (powered by Dijkstra's algorithm across Indian nodes).
- **NHAI-style Vehicle Categories**: Standard LMV/LCV/HCM up to pre-registered special priority vehicles.
- **FASTag Wallet Simulation**: Check balances, simulate 3rd-party recharges (with 1% fee calculation).
- **Toll Intelligence**: Passes (Monthly/Trip/Annual) recommendations depending on route.
- **Lane Allocation**: Live indicators of which entry/exit lane to take (including priority lanes for valid pre-registered vehicles).
- **Emergency Reporting**: Instantly log SOS incidents (breakdowns, accidents, health) that dispatch to the Admin portal.

### 🔴 Admin Portal (Operations End)
- **Secure Access**: Protected login (`admin@nhai` / `NHAI@2026`).
- **Live Operations Dashboard**: High-level overview of active highway issues and daily vehicle counts.
- **CCTV Surveillance Simulation**: Animated video feed tiles indicating gate statuses, allowing operations staff to "monitor" lane traffic.
- **Incident Response System**: Track user-reported emergencies, acknowledge scenarios, and mark them as resolved.
- **Traffic & Alerts Broadcaster**: Send warnings (accidents, congestion, bad weather) that push instantly to the Traveller portal.
- **Pass-through Analytics**: Keep track of special VIP and emergency vehicles requesting passage.

---

## 🛠️ Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+). No frameworks used.
- **Theme**: Automatic persistence-based Dark Mode & Light Mode system globally synced.
- **Mapping**: Leaflet.js alongside Carto, OSM and simulated Satellite Esri tile configurations.
- **Data Persistence**: `localStorage` (cross-tab data sync) and `sessionStorage` (auth guards).
- **Routing Engine**: Custom Weighted Graph Data Structure and Dijkstra's algorithm logic handling nationwide highway edges.

---

## 🏃 Details to Run Locally
Since the platform is entirely built on front-end technologies without the need for a dedicated backend service:
1. Clone the repository.
2. Open `index.html` in your modern browser (Chrome/Edge/Firefox).
3. The platform will boot. Choose either the **Traveller Portal** or **Admin Secure Access**.
4. To test data sync, **open the User and Admin portals in two separate tabs/windows** side by side!

*Note: For absolute best security and module loading compatibility without a bundler, running via a lightweight local server (like VS Code Live Server or `npx serve`) is recommended, though regular file-system access works due to the non-CORS dependent module structures.*

---

## 🏆 Resume Highlight Points (CV-Worthy)
- **Architected a Client-Side Distributed System:** Engineered a dual-portal NHAI highway management simulation utilizing `localStorage` events to achieve real-time, cross-tab state synchronization mimicking WebSockets.
- **Implemented Graph-Based Routing Engine:** Developed a custom weighted graph incorporating Dijkstra’s algorithm to power a multi-modal planner optimizing for 'Lowest Toll', 'Fastest Speed', and 'Balanced' travel routes using live Leaflet.js mapping.
- **Designed Complex Toll & Pass Engine:** Created an intelligent FASTag toll deduction and simulation system factoring in dynamic NHAI-style vehicle classes, pre-registered special exemptions, and automated recommendations for monthly/annual route passes.

---

## ⚠️ Important Disclaimer
"This platform is a simulation-based portfolio/demo project inspired by Indian NHAI / FASTag highway operations. Toll prices, pass plans, exemptions, lane rules, special vehicle handling, alerts, CCTV feeds, and payment flows shown here are representative demo logic and may not exactly match live official NHAI or toll plaza operations."

"FASTag recharge service fee shown in this project is a 3rd-party platform simulation and not an official universal NHAI charge."
