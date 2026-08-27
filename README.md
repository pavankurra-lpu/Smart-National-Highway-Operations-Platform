# Smart National Highway Operations Platform (SNHOP)

An intelligent, full-stack Indian highway mobility, FASTag toll intelligence, and emergency incident response platform inspired by **NHAI** and **FASTag** operational workflows.

The platform features a **Dual-Portal Architecture** connecting highway commuters (**Traveller Portal**) with regional traffic command centers (**Operations Admin Room**). It supports both full-stack live server mode (Node.js/Express + WebSockets + Persistent Storage) and zero-dependency offline client-side simulation.

---

## 📌 Architectural Overview

SNHOP operates with a **Hybrid Dual-Tier System Architecture**:

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         HYBRID DUAL-MODE ARCHITECTURE                       │
 ├──────────────────────────────────────┬──────────────────────────────────────┤
 │   Mode A: Full-Stack Live Server     │ Mode B: Progressive Offline Fallback │
 │   (Node.js / Express / Socket.IO)    │ (Zero-install Browser Simulation)    │
 ├──────────────────────────────────────┼──────────────────────────────────────┤
 │ • Server-side FASTag ledger & fee    │ • Client-side Web Storage cache      │
 │ • PBKDF2 salted password hashing     │ • Instant standalone evaluation      │
 │ • Rate-limiting & brute-force lockout│ • Deterministic heuristic fallback   │
 │ • Persistent disk database (db.json) │ • Cross-tab storage event syncing    │
 │ • Real-time WebSocket broadcasting   │ • No Node.js runtime required        │
 └──────────────────────────────────────┴──────────────────────────────────────┘
```

> **Architectural Boundary Note:** While the platform includes a progressive `localStorage` event-bus for zero-dependency standalone portfolio evaluation in static environments, client-side storage is inherently unauthenticated and vulnerable to browser DevTools manipulation. For production-grade security, all financial transactions, admin authentication sessions, and incident resolutions are strictly validated server-side by the Express backend (`backend/server.js`).

---

## 🚀 Key System Features

### 🟢 Traveller Portal (Highway Commuters)
- **All-India Route Planning Map**: Interactive route planning across an expansive national graph (1,558+ operational toll plazas), utilizing Leaflet.js with Map Layer switching (Standard / Dark / Satellite Hybrid) and OSRM integration.
- **Live Weather Intelligence**: Real-time meteorological queries powered by **Open-Meteo API** (with local deterministic fallback), tracking rain, fog, thunderstorms, and extreme heatwaves to adjust travel ETAs dynamically.
- **Dijkstra Multi-Modal Routing**: Computes 'Fastest Route', 'Lowest Toll Route', and 'Balanced Route' using custom weighted graph algorithms.
- **FASTag Digital Wallet**: Simulates 3rd-party platform recharges (with server-validated 1% platform convenience fee calculation) and automatic plaza barrier deductions.
- **Toll Intelligence & Lane Allocation**: Recommends Daily/Return Trip Passes and Monthly Passes based on route traversal, with live vehicle-specific lane allocation and express barrier lane guidance.
- **Biometric Security & Emergency SOS**: Simulated WebRTC face authentication and one-touch SOS emergency reporting (accidents, breakdowns, medical) dispatched directly to Highway Operations.

### 🔴 Operations Control Portal (NHAI Command Center)
- **Token-Based Admin Authentication**: Secured via PBKDF2 cryptographic password hashing, constant-time comparison, and IP-level brute-force lockout protection (10 req/15 min limit + 5-attempt consecutive lockout).
- **Live Operations Dashboard**: Aggregated overview of active highway incidents, revenue figures, and real-time vehicle flow.
- **CCTV Lane Surveillance**: Animated multi-tile camera feeds indicating toll gate statuses and traffic density across corridors.
- **Incident Response & Mandatory Proof**: Track user-reported emergencies, acknowledge dispatches, and require image proof + admin notes + verification classification (`CONFIRMED` real hazard vs `FALSE_ALARM`) to resolve cases.
- **Traffic & Alert Broadcaster**: Push localized highway safety bulletins, weather warnings, and lane closures directly to travelers via WebSockets and storage events.

---

## 🔬 Technical Contribution: Adaptive Multi-Signal Recommendation Engine

This project implements a custom multi-signal fusion algorithm ([`js/shared/adaptiveLaneEngine.js`](js/shared/adaptiveLaneEngine.js)) that couples:
1. **FASTag Balance Depletion Horizon Forecasting ($S_{\text{balance}}$)**: Exponential Moving Average (EMA) toll spend modeling vs. inferred longitudinal recharge periodicity ($\Delta t_{\text{recharge}}$).
2. **Weather-Adjusted Congestion-Corrected ETA ($S_{\text{eta}}$)**: Fuses real Open-Meteo meteorological risk factors, historical diurnal time-of-day traffic matrices, and toll barrier queues.
3. **Confidence-Decayed Incident Feedback ($S_{\text{incident}}$)**: Evaluates closed-loop operations center resolution tags with negative penalties for `FALSE_ALARM` reports and exponential temporal decay ($e^{-\lambda \Delta t}$ with 4-hour half-life).

The complete engineering architecture, formal mathematical formulation, pseudocode, prior art comparisons (FASTag, Waze, E-ZPass), and data flow diagrams are documented in:
👉 **[Technical Invention Disclosure (`docs/INVENTION-DISCLOSURE.md`)](docs/INVENTION-DISCLOSURE.md)**

> **Notice:** This document describes a specific algorithmic mechanism implemented in this project. It has not been reviewed by a patent attorney or checked against a professional prior-art database; it is provided as engineering documentation, not a legal claim of patentability.

### Running Engine Unit Tests
The multi-signal fusion engine includes an automated unit test suite covering cold-starts, balance depletion edge cases, false alarm decay dynamics, and severe storm rerouting:
```bash
node tests/test_adaptive_engine.js
```

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+), Leaflet.js, Anime.js, Motion.dev.
- **Backend**: Node.js, Express, Socket.IO, `express-rate-limit`, `cors`.
- **Database / State**: File-based ACID JSON store (`backend/db.json`) + progressive `localStorage` caching.
- **External Services**: Open-Meteo Live Forecast API, OSRM Highway Routing Machine, Cloudflare Turnstile Verification.
- **Routing Engine**: Custom Weighted Graph Data Structure and Dijkstra's algorithm across nationwide Indian highway edges.

---

## 🏃 How to Run Locally

### Option 1: Full-Stack Mode (Recommended)
1. Navigate to the backend directory and start the server:
   ```bash
   cd backend
   npm install
   npm start
   ```
2. Open `index.html` in your browser (or serve via VS Code Live Server / `npx serve`).
3. Set custom admin credentials via environment variables if desired:
   ```bash
   ADMIN_ID=command@nhai ADMIN_PASS=YourSecurePasscode npm start
   ```

### Option 2: Standalone Static Mode
1. Open `index.html` directly in any modern web browser.
2. The platform will automatically detect offline mode and activate client-side simulation.

---

## 🏆 Key Engineering Highlights

- **Multi-Signal Tri-Factor Arbitration:** Developed an auditable recommendation engine fusing rolling wallet burn rates, time-of-day congestion vectors, and decaying emergency incident signals into deterministic pass and route advisories.
- **Graph-Based Routing Core:** Implemented a custom weighted graph incorporating Dijkstra's algorithm to compute multi-modal routes ('Lowest Toll', 'Fastest Speed', 'Balanced') across 1,558+ Indian toll nodes.
- **Defensive API Architecture:** Built server-side validation for FASTag fee computation, balance verification, cryptographic session management, and rate limiting against brute-force intrusion.

---

## ⚠️ Important Disclaimer

*This platform is a simulation-based portfolio/demo project inspired by Indian NHAI / FASTag highway operations. Toll prices, pass plans, exemptions, lane rules, special vehicle handling, alerts, CCTV feeds, and payment flows shown here are representative demo logic and do not process real monetary transactions or contact real emergency services.*
