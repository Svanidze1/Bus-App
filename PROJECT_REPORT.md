# Kutaisi Bus App — Technical Report

Authors: [REPLACE WITH TEAM MEMBER NAMES]

Date: 26 June 2026

Keywords: public transit visualization, trip planning, simulation, React, Leaflet, routing, Dijkstra

---

## Abstract

This report presents the Kutaisi Bus App as a technically non-trivial web-based transit information system designed to visualize urban bus infrastructure, support interactive route exploration, and generate multimodal itineraries through a combination of geospatial rendering, graph-based search, and lightweight dynamic simulation. Although the implementation remains a prototype based on locally stored transit data, it embodies several computational and interface-level challenges typical of modern intelligent transport systems: stateful UI orchestration, network representation, route optimization, and real-time visual feedback. The project is therefore less a simple mapping exercise and more an exercise in integrating heterogeneous technical components into a coherent user-centered decision-support application.

## 1. Introduction

Urban transport systems are inherently complex, involving spatial topology, temporal constraints, transfer behavior, and user-oriented decision-making. The Kutaisi Bus App addresses this complexity in a compact and educationally meaningful form by combining a map-based interface with a route-planning engine and a simulation layer that imitates vehicle movement. The application is not merely a visual catalog of stops and routes; rather, it provides an interactive environment in which users can inspect transit structure, evaluate plausible journeys, and observe system behavior in a dynamic manner.

The value of the project lies in its ability to translate relatively simple route data into a layered computational experience: geospatial visualization, graph-theoretic routing, and animated state updates are all fused into a single client-side system. This creates a prototype that is both understandable for academic presentation and sufficiently sophisticated to demonstrate the practical challenges of transit software design.

## 2. Related Work and Conceptual Context

The project draws on established ideas from three closely related domains: interactive geospatial interfaces, algorithmic route planning, and simulation-based visualization. In practice, this means combining Leaflet and React-Leaflet for map rendering, Dijkstra-style shortest-path logic for itinerary generation, and OSRM-based geometry retrieval for more realistic walking paths.

Compared with full-scale production systems that rely on GTFS feeds, real-time vehicle tracking, and centralized routing services, the present system uses a deliberately simplified data model. However, this simplification does not eliminate the underlying difficulty of the problem. The system still has to represent bus topology, compute plausible transfers, assign cost weights, render paths on a map, and update the interface as state changes. In that sense, the project reflects the fundamental architectural challenges of transit applications even within a reduced-scale prototype.

References:
- Leaflet — lightweight web mapping library
- Project OSRM — open-source routing machine
- Dijkstra's shortest path algorithm

## 3. Data Model and Preprocessing

The application relies on static JavaScript modules under the data directory for its core information:
- Stops: [src/data/stops.js](src/data/stops.js#L1)
- Routes: [src/data/routes.js](src/data/routes.js#L1)
- Buses: [src/data/buses.js](src/data/buses.js#L1)

Each route is represented as an ordered sequence of stop identifiers together with a polyline-like path structure defined as a sequence of geographic coordinates. In addition, route metadata includes stop-waypoint references that map route stops to positions in the path array. This arrangement allows the system to connect abstract transit entities with coordinate-based spatial rendering. The data model is therefore not merely descriptive; it is operational, because the same structure supports both visual presentation and algorithmic path construction.

A notable technical characteristic of the system is that it avoids dependency on external transit schedules. Instead, it encodes the network directly in the client-side application. This makes the prototype easy to run and demonstrate, but it also means that the system must rely on handcrafted assumptions about travel cost, boarding behavior, and spatial continuity.

## 4. System Architecture

The architecture is organized around a component-based React frontend built with Vite. The principal modules include:
- [src/App.jsx](src/App.jsx#L1) — top-level application state, selection logic, routing context, and UI composition
- [src/components/MapView.jsx](src/components/MapView.jsx#L1) — map lifecycle, zoom/fly behavior, overlays, and route geometries
- [src/components/TripPlanner.jsx](src/components/TripPlanner.jsx#L1) — user-driven trip selection and itinerary presentation
- [src/hooks/useBusSimulation.js](src/hooks/useBusSimulation.js#L1) — simulation of vehicle movement and ETA behavior
- [src/utils/tripPlanner.js](src/utils/tripPlanner.js#L1) — graph construction, path optimization, and itinerary synthesis

The system uses React for stateful user interaction and Leaflet via React-Leaflet for map rendering. This separation of concerns is important: the interface layer manages user intent, while the routing and simulation layers handle computational behavior. Together, they form a small but coherent transport information system that demonstrates how data-driven decision support can be embedded in a browser-based application.

## 5. Algorithmic Design of the Trip Planner

The core routing logic is implemented in [src/utils/tripPlanner.js](src/utils/tripPlanner.js#L1). The planner is built around a graph representation in which stops act as nodes and transit/walking connections act as edges. The algorithm proceeds in several stages.

1. Graph construction:
   - Every stop becomes a node in the search space.
   - Bus routes introduce directed or undirected transit edges between consecutive stops.
   - Walking alternatives are added between stops using distance-based cost estimates derived from geographic coordinates.
   - Each edge is annotated with attributes such as type, route identifier, bus number, travel time, and distance.

2. Cost modeling:
   - Walking is modeled using an assumed pedestrian speed of 5 km/h.
   - Bus movement uses an assumed travel speed of 18 km/h.
   - A boarding penalty of 3 minutes is introduced when switching from one route to another, reflecting the practical burden of transfer behavior.

3. Search strategy:
   - The planner employs a state-expanded variant of Dijkstra's algorithm, where the search state includes both the current stop and the active route context.
   - This is crucial because the cost of moving from one stop to another depends not only on the destination but also on whether the traveler is already aboard a bus and on which route that bus belongs to.
   - The state key is effectively structured as `stopId:routeId`, allowing the system to reason about staying on the same line versus changing routes.

4. Path reconstruction and presentation:
   - After the shortest path is found, the raw sequence of edges is grouped into meaningful segments such as walking segments and bus-ride segments.
   - The planner then enriches these segments with path coordinates so that they can be displayed directly on the map.
   - For walking segments, the system attempts to retrieve geometry from OSRM and falls back to straight-line coordinates if remote geometry is unavailable.
   - For bus segments, the route geometry is sliced according to the relevant stop sequence so that the displayed polyline corresponds to the portion of the route actually traveled.

5. Coordinate-based itinerary generation:
   - If the user selects arbitrary geographic points rather than named stops, the system identifies nearby candidate stops and evaluates candidate itineraries against a direct walking baseline.
   - This adds a practical layer of flexibility, because the planner can support not only stop-to-stop navigation but also point-to-point planning for more realistic user input.

From a computational perspective, the planning logic is intentionally simple but non-trivial. The complete walk graph is dense and grows quadratically with the number of stops, which makes it suitable for a prototype but also reveals the scalability limitations that would emerge in a larger network.

## 6. Simulation Layer and Dynamic Behavior

The simulation system in [src/hooks/useBusSimulation.js](src/hooks/useBusSimulation.js#L1) introduces an additional dimension of complexity. Instead of displaying static route lines only, the application animates buses moving along their assigned paths and updates relevant route information such as current stop, next stop, destination, and ETA data.

The simulation uses a deterministic tick-based mechanism:
- Tick interval: 100 ms
- Progress increment per tick: 0.045
- Stop dwell time: simulated through a dwell counter that temporarily halts motion at route waypoints
- Direction reversal: implemented when buses reach the end of a route segment

This layer is important because it transforms the system from a passive map into a dynamic transport visualization. The animation is not merely decorative; it supports the user’s understanding of movement continuity, service progression, and route behavior. At the same time, the logic remains lightweight enough to be executed entirely in the browser, which is one of the project’s major strengths.

## 7. Implementation Notes and File-Level Responsibility

The implementation is deliberately modular. Each file is responsible for a specific part of the overall functionality:
- [src/App.jsx](src/App.jsx#L1): state orchestration, interaction handling, filtering logic, and coordination of major UI components
- [src/components/MapView.jsx](src/components/MapView.jsx#L1): geospatial rendering, map controls, trip overlays, and visual highlighting of selected paths
- [src/components/TripPlanner.jsx](src/components/TripPlanner.jsx#L1): user-facing trip selection, iterative route evaluation, and presentation of step-by-step direction output
- [src/utils/tripPlanner.js](src/utils/tripPlanner.js#L1): route graph construction, journey search, segment grouping, and geometry enrichment
- [src/hooks/useBusSimulation.js](src/hooks/useBusSimulation.js#L1): bus motion simulation, stop dwell behavior, and ETA computations

This modular structure is not only good engineering practice; it also makes the system easier to extend. A future version could replace the static route graph with live transit feeds, add real-time vehicle tracking, or integrate a more advanced optimization engine without needing to rebuild the entire application from scratch.

## 8. Evaluation, Limitations, and Technical Reflection

The project performs well as an academic prototype and as a proof of concept for a browser-based transit information system. However, its limitations are significant and should be acknowledged clearly:

- Scalability: the current walking graph is dense and grows quadratically with the number of stops, which becomes inefficient in larger networks.
- Accuracy: travel speeds, boarding penalties, and stop dwell behavior are heuristic rather than derived from real timetable or operational data.
- Dependence on external services: OSRM geometry lookup improves realism but introduces network dependency and latency.
- Transfer modeling: the routing logic simplifies transfer behavior by using a fixed penalty rather than a richer model of headways, delays, or reliability.

These limitations do not undermine the project’s value; rather, they reveal the complexity of building a robust transit planner. In other words, the project demonstrates not only what can be implemented quickly and elegantly, but also what must be handled carefully when moving from a prototype toward a production-grade transport system.

## 9. Reproducibility and Running the Project

The project is built with Node.js and Vite. To run it locally, the following commands are used:

```bash
npm install
npm run dev
```

The Vite development server provides a local environment for testing the interface. A production build can be generated with:

```bash
npm run build
npm run preview
```

This makes the application easy to reproduce, evaluate, and extend in an academic or teaching environment.

## 10. Suggested Extensions and Future Work

Several extensions would make the system substantially more powerful:
- Replace the dense walking graph with locality-aware routing strategies such as k-nearest-neighbor constraints or spatial indexing.
- Integrate GTFS or GTFS-realtime data to support timetable-based planning and real-world temporal accuracy.
- Introduce automated tests for path planning and simulation stability.
- Add persistent user features such as saved routes, shareable itineraries, or offline caching.
- Develop a server-side routing layer to reduce dependence on external APIs and improve consistency.

These improvements would move the system from a compelling prototype to a more complete and operational transport intelligence solution.

## 11. Contributions

Please replace the placeholders below with the actual names and roles before submission:

- Authors: [REPLACE WITH TEAM MEMBER NAMES]
- Contributions:
  - System architecture and frontend development: [NAME]
  - Trip planning and routing logic: [NAME]
  - Data preparation and route/stop modeling: [NAME]
  - Simulation and ETA behavior: [NAME]
  - Documentation and report writing: [NAME]

## 12. Conclusion

The Kutaisi Bus App demonstrates that a relatively compact web application can incorporate multiple layers of technical complexity: spatial representation, graph-based route computation, dynamic simulation, and interactive visualization. Although the current system remains a prototype constrained by static data and simplified assumptions, it provides a strong foundation for more advanced transit planning tools. Its significance lies not only in what it currently does, but in the way it exposes the architectural and algorithmic challenges that underlie modern intelligent transport systems.

---

References

- Dijkstra, E.W., A note on two problems in connexion with graphs. Numerische Mathematik (1959).
- Leaflet — https://leafletjs.com/
- React-Leaflet — https://react-leaflet.js.org/
- OSRM — http://project-osrm.org/
