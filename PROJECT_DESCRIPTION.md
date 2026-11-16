# Kutaisi Bus App — Project Description

Repository: https://github.com/LuDeVing/Kutaisi-Bus-App

## 1. Project Overview

The Kutaisi Bus App is a single-page web application that visualizes public bus routes, stops, and active vehicles for the city of Kutaisi. It provides an interactive map view, searchable stops and routes, trip planning utilities, and simulated bus movement for demonstration and testing purposes.

## 2. Objectives

- Provide an accessible, interactive visualization of the city's bus network.
- Allow users to search stops and routes, view details, and plan simple trips.
- Demonstrate a working prototype that can be extended to integrate live data.

## 3. Key Features

- Interactive map with route polylines and markers for buses and stops.
- Search bar to find stops and routes quickly.
- Stop and bus detail panels with metadata and nearby stops.
- Trip planner utility for simple route suggestions.
- Local simulation of bus movement for demoing dynamic behavior.

## 4. Technical Stack

- Frontend: React (JSX), Vite for bundling and fast dev server.
- Styling: Tailwind CSS and PostCSS.
- Mapping: Browser map library (leaflet or similar) with custom markers and polylines.
- Data: Static JS modules under `src/data/` for buses, routes, and stops.
- Utilities: `src/utils/tripPlanner.js` for trip planning logic.

Files of interest:
- `src/App.jsx`, `src/main.jsx` — app entry and mounting.
- `src/components/MapView.jsx` — map and layer composition.
- `src/components/TripPlanner.jsx` and `src/utils/tripPlanner.js` — trip planning logic.

## 5. Architecture & Workflow

The app follows a component-based architecture with small, focused components:

- `MapView` composes map layers and passes events to child components.
- Marker components (`BusMarker`, `StopMarker`) encapsulate rendering and popups.
- Panels (`BusDetailPanel`, `StopDetailPanel`) show selected entity details.

Data flows from local static modules; components subscribe to state exposed via React hooks. `useBusSimulation.js` simulates vehicle movement and updates components via state changes.

Development workflow used for the project:

1. Fork/clone the repository and create a feature branch per task.
2. Implement UI or logic in small commits with descriptive messages.
3. Push to GitHub and open PRs for review (if working in a team).

## 6. Setup & Run (Developer)

Prerequisites: Node.js (LTS) and npm or yarn.

Commands:

```bash
npm install
npm run dev
```

The `dev` script runs Vite's dev server. Build for production with:

```bash
npm run build
```

## 7. Testing & Validation

- Manual testing by running the dev server and exercising the UI.
- Simulated buses validate dynamic UI updates and map rendering.

## 8. Project Workflow & Contributions

Please replace the placeholders below with actual names and contributions for grading.

- Team / Authors:
  - Name(s): [REPLACE WITH TEAM MEMBER NAMES]

- Contributions (example roles — edit as needed):
  - Project lead / frontend architecture: [NAME]
  - Map integration and visualization: [NAME]
  - Trip planning algorithm and utilities: [NAME]
  - Data collection and route/stop tables: [NAME]
  - Testing, simulation harness, and demos: [NAME]

## 9. Notes for Presentation

- No separate slides required — bring your laptop and demo the app.
- Be ready to explain design choices, algorithmic logic in `tripPlanner.js`, and answer questions about state management and mapping.

---

If you want, I can fill the `Team / Authors` and `Contributions` sections with the actual names from your group — provide the names and who did what and I'll update this file.
