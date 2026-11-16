-- ============================================================================
-- Kutaisi Bus App — Relational Database Schema (PostgreSQL)
-- ============================================================================
-- This schema defines the full data model for the Kutaisi Smart Bus transit
-- application. It is designed to replace the static JS data modules with a
-- normalised relational structure that supports:
--   • Real-time bus tracking and telemetry
--   • Trip planning across routes with transfer support
--   • User accounts, favourites, and feedback
--   • Scheduling and timetable management
--   • Analytics and historical telemetry logging
--
-- Target: PostgreSQL 14+
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. CLEANUP — Drop existing objects for idempotent re-runs
-- ──────────────────────────────────────────────────────────────────────────────

DROP VIEW  IF EXISTS v_active_buses          CASCADE;
DROP VIEW  IF EXISTS v_route_summary         CASCADE;
DROP VIEW  IF EXISTS v_stop_routes           CASCADE;

DROP TABLE IF EXISTS feedbacks               CASCADE;
DROP TABLE IF EXISTS user_favorites          CASCADE;
DROP TABLE IF EXISTS timetable_entries       CASCADE;
DROP TABLE IF EXISTS timetables              CASCADE;
DROP TABLE IF EXISTS bus_telemetry_logs      CASCADE;
DROP TABLE IF EXISTS buses                   CASCADE;
DROP TABLE IF EXISTS route_path_points       CASCADE;
DROP TABLE IF EXISTS route_stops             CASCADE;
DROP TABLE IF EXISTS routes                  CASCADE;
DROP TABLE IF EXISTS stops                   CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;

DROP TYPE IF EXISTS user_role             CASCADE;
DROP TYPE IF EXISTS vehicle_status        CASCADE;
DROP TYPE IF EXISTS vehicle_direction     CASCADE;
DROP TYPE IF EXISTS feedback_category     CASCADE;
DROP TYPE IF EXISTS feedback_status       CASCADE;
DROP TYPE IF EXISTS day_type              CASCADE;
DROP TYPE IF EXISTS favorite_type         CASCADE;


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ENUMERATIONS (Custom Types)
-- ══════════════════════════════════════════════════════════════════════════════

-- User roles — controls access level in the application
CREATE TYPE user_role AS ENUM (
    'admin',        -- Full system access, manages routes/stops/buses
    'dispatcher',   -- Monitors live buses, manages schedules
    'driver',       -- Assigned to a bus, updates status
    'passenger'     -- Default role, uses trip planner, submits feedback
);

-- Bus operational status
CREATE TYPE vehicle_status AS ENUM (
    'moving',           -- Actively travelling between stops
    'dwelling',         -- Stopped at a bus stop (boarding/alighting)
    'idle',             -- Parked at depot, not in service
    'maintenance',      -- Under repair, unavailable
    'out_of_service'    -- Retired or permanently unavailable
);

-- Bus travel direction along its route path
CREATE TYPE vehicle_direction AS ENUM (
    'forward',      -- Travelling from first stop towards last stop (direction = 1)
    'reverse'       -- Travelling from last stop towards first stop (direction = -1)
);

-- Feedback / issue report categories
CREATE TYPE feedback_category AS ENUM (
    'map_issue',            -- Wrong stop location, missing route on map
    'bus_delay',            -- Bus running late or not showing up
    'safety_concern',       -- Unsafe driving, overcrowding
    'schedule_inaccuracy',  -- Timetable does not match reality
    'app_bug',              -- UI/UX issue, crash, wrong data display
    'suggestion',           -- Feature request or improvement idea
    'other'                 -- Anything that doesn't fit above
);

-- Feedback resolution status
CREATE TYPE feedback_status AS ENUM (
    'pending',          -- Newly submitted, not yet reviewed
    'under_review',     -- Assigned to staff for investigation
    'resolved',         -- Issue has been fixed or addressed
    'dismissed'         -- Not actionable or duplicate
);

-- Schedule day classification
CREATE TYPE day_type AS ENUM (
    'weekday',      -- Monday – Friday
    'saturday',     -- Saturday
    'sunday',       -- Sunday
    'holiday'       -- Public holidays
);

-- Type of entity a user can favourite
CREATE TYPE favorite_type AS ENUM (
    'stop',     -- A bus stop
    'route'     -- A bus route
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. CORE TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 2.1 Users
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              SERIAL          PRIMARY KEY,
    username        VARCHAR(50)     NOT NULL UNIQUE,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,           -- bcrypt / argon2 hash
    display_name    VARCHAR(100),
    role            user_role       NOT NULL DEFAULT 'passenger',
    phone           VARCHAR(20),
    preferred_lang  VARCHAR(5)      DEFAULT 'ka',       -- ISO 639-1: ka=Georgian, en=English
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users IS 'Application user accounts with role-based access control.';
COMMENT ON COLUMN users.preferred_lang IS 'ISO 639-1 language code for UI localisation (ka, en, ru, etc).';


-- ──────────────────────────────────────────────────────────────────────────────
-- 2.2 Stops  (Bus stops / stations)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE stops (
    id              INTEGER         PRIMARY KEY,
    name            VARCHAR(150)    NOT NULL,
    name_ka         VARCHAR(150),                       -- Georgian name
    name_en         VARCHAR(150),                       -- English name
    latitude        DECIMAL(9,7)    NOT NULL,           -- WGS 84 latitude  (e.g. 42.2667066)
    longitude       DECIMAL(9,7)    NOT NULL,           -- WGS 84 longitude (e.g. 42.6880710)
    address         VARCHAR(255),                       -- Street address (optional)
    is_accessible   BOOLEAN         DEFAULT FALSE,      -- Wheelchair accessible
    has_shelter      BOOLEAN         DEFAULT FALSE,      -- Covered waiting area
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  stops IS 'Physical bus stop locations across Kutaisi.';
COMMENT ON COLUMN stops.latitude  IS 'WGS 84 latitude with 7 decimal places (~1.1 cm precision).';
COMMENT ON COLUMN stops.longitude IS 'WGS 84 longitude with 7 decimal places (~1.1 cm precision).';

-- Spatial index approximation using btree on coordinates
CREATE INDEX idx_stops_lat_lng ON stops (latitude, longitude);
CREATE INDEX idx_stops_name    ON stops (name);


-- ──────────────────────────────────────────────────────────────────────────────
-- 2.3 Routes  (Bus lines / services)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE routes (
    id              INTEGER         PRIMARY KEY,
    bus_number      VARCHAR(10)     NOT NULL UNIQUE,    -- Display number/letter (e.g. '5', 'A', '30')
    color           VARCHAR(7)      NOT NULL DEFAULT '#3b82f6',  -- Hex colour for map display
    description     VARCHAR(255),                       -- Human-readable route description
    description_ka  VARCHAR(255),                       -- Georgian description
    is_circular     BOOLEAN         NOT NULL DEFAULT FALSE,  -- TRUE if route forms a loop
    fare_gel        DECIMAL(5,2)    DEFAULT 0.50,       -- Fare in Georgian Lari
    avg_duration_min INTEGER,                           -- Average end-to-end duration in minutes
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  routes IS 'Bus routes/lines operating in the Kutaisi transit network.';
COMMENT ON COLUMN routes.bus_number IS 'Public-facing route identifier displayed on buses and signs.';
COMMENT ON COLUMN routes.color IS 'Hex colour code for map polyline rendering.';
COMMENT ON COLUMN routes.fare_gel IS 'Standard fare in Georgian Lari (GEL).';


-- ──────────────────────────────────────────────────────────────────────────────
-- 2.4 Route Stops  (Junction table: which stops belong to which route, in order)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE route_stops (
    id              SERIAL          PRIMARY KEY,
    route_id        INTEGER         NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_id         INTEGER         NOT NULL REFERENCES stops(id)  ON DELETE CASCADE,
    stop_order      INTEGER         NOT NULL,           -- 0-based sequence position on this route
    waypoint_index  INTEGER,                            -- Index into route_path_points where this stop is located
    avg_dwell_secs  INTEGER         DEFAULT 30,         -- Average dwell time at this stop in seconds

    UNIQUE (route_id, stop_order),                      -- Each route has unique ordering
    UNIQUE (route_id, stop_id, stop_order)              -- Prevent accidental duplicates
);

COMMENT ON TABLE  route_stops IS 'Ordered association of stops to routes with waypoint mapping.';
COMMENT ON COLUMN route_stops.stop_order IS '0-based index defining the sequence of stops along the route.';
COMMENT ON COLUMN route_stops.waypoint_index IS 'Maps to route_path_points.point_order, indicating where on the polyline this stop sits.';

CREATE INDEX idx_route_stops_route  ON route_stops (route_id);
CREATE INDEX idx_route_stops_stop   ON route_stops (stop_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 2.5 Route Path Points  (Dense coordinate arrays for map polylines)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE route_path_points (
    id              SERIAL          PRIMARY KEY,
    route_id        INTEGER         NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    point_order     INTEGER         NOT NULL,           -- 0-based sequence index
    latitude        DECIMAL(9,7)    NOT NULL,
    longitude       DECIMAL(9,7)    NOT NULL,

    UNIQUE (route_id, point_order)
);

COMMENT ON TABLE  route_path_points IS 'Dense lat/lng coordinate sequences defining the visual polyline for each route on the map.';
COMMENT ON COLUMN route_path_points.point_order IS '0-based index defining the drawing order of polyline vertices.';

CREATE INDEX idx_path_points_route ON route_path_points (route_id, point_order);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. REAL-TIME TRANSIT TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 3.1 Buses  (Active vehicles with real-time telemetry)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE buses (
    id                  INTEGER         PRIMARY KEY,
    route_id            INTEGER         NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
    license_plate       VARCHAR(20)     UNIQUE,
    driver_id           INTEGER         REFERENCES users(id) ON DELETE SET NULL,
    
    -- Real-time state
    status              vehicle_status  NOT NULL DEFAULT 'idle',
    direction           vehicle_direction NOT NULL DEFAULT 'forward',
    current_latitude    DECIMAL(9,7),
    current_longitude   DECIMAL(9,7),
    current_path_index  INTEGER         DEFAULT 0,      -- Index into route_path_points
    progress            DECIMAL(5,4)    DEFAULT 0.0,    -- 0.0–1.0 interpolation between current and next path point
    current_stop_index  INTEGER         DEFAULT 0,      -- Index into route_stops for current/last visited stop
    dwell_remaining     INTEGER         DEFAULT 0,      -- Remaining dwell ticks when status = 'dwelling'
    speed_kmh           DECIMAL(5,1)    DEFAULT 0.0,    -- Current speed in km/h
    heading             DECIMAL(5,1),                    -- Compass heading in degrees (0-360)
    
    -- Metadata
    capacity            INTEGER         DEFAULT 40,      -- Max passenger capacity
    model               VARCHAR(100),                    -- Bus make/model
    year_manufactured   INTEGER,
    is_accessible       BOOLEAN         DEFAULT FALSE,   -- Wheelchair-accessible
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    last_telemetry_at   TIMESTAMPTZ,                     -- When telemetry was last updated
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  buses IS 'Individual bus vehicles with real-time location, status, and route assignment.';
COMMENT ON COLUMN buses.current_path_index IS 'Current segment index into route_path_points for position interpolation.';
COMMENT ON COLUMN buses.progress IS 'Linear interpolation factor (0.0 to 1.0) between current and next path point.';
COMMENT ON COLUMN buses.dwell_remaining IS 'Remaining simulation ticks when bus is dwelling at a stop.';

CREATE INDEX idx_buses_route     ON buses (route_id);
CREATE INDEX idx_buses_status    ON buses (status) WHERE is_active = TRUE;
CREATE INDEX idx_buses_location  ON buses (current_latitude, current_longitude) WHERE is_active = TRUE;
CREATE INDEX idx_buses_driver    ON buses (driver_id) WHERE driver_id IS NOT NULL;


-- ──────────────────────────────────────────────────────────────────────────────
-- 3.2 Bus Telemetry Logs  (Historical position/status snapshots for analytics)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE bus_telemetry_logs (
    id              BIGSERIAL       PRIMARY KEY,
    bus_id          INTEGER         NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    route_id        INTEGER         NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    latitude        DECIMAL(9,7)    NOT NULL,
    longitude       DECIMAL(9,7)    NOT NULL,
    speed_kmh       DECIMAL(5,1),
    heading         DECIMAL(5,1),
    status          vehicle_status  NOT NULL,
    direction       vehicle_direction NOT NULL,
    path_index      INTEGER,
    recorded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bus_telemetry_logs IS 'Historical bus position and status snapshots for analytics, replay, and reporting.';

-- Partition-friendly index: query by bus + time range
CREATE INDEX idx_telemetry_bus_time  ON bus_telemetry_logs (bus_id, recorded_at DESC);
CREATE INDEX idx_telemetry_route     ON bus_telemetry_logs (route_id, recorded_at DESC);
CREATE INDEX idx_telemetry_time      ON bus_telemetry_logs (recorded_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. SCHEDULING & TIMETABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.1 Timetables  (Schedule headers)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE timetables (
    id              SERIAL          PRIMARY KEY,
    route_id        INTEGER         NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    day             day_type        NOT NULL DEFAULT 'weekday',
    direction       vehicle_direction NOT NULL DEFAULT 'forward',
    valid_from      DATE            NOT NULL DEFAULT CURRENT_DATE,
    valid_until     DATE,                                -- NULL = no expiry
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (route_id, day, direction, valid_from)
);

COMMENT ON TABLE timetables IS 'Timetable headers grouping scheduled departure times by route, day type, and direction.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 4.2 Timetable Entries  (Individual stop departure times)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE timetable_entries (
    id              SERIAL          PRIMARY KEY,
    timetable_id    INTEGER         NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    stop_id         INTEGER         NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    departure_time  TIME            NOT NULL,            -- Scheduled departure from this stop
    trip_sequence   INTEGER         NOT NULL DEFAULT 1,  -- Which trip within the timetable (1st, 2nd, etc.)

    UNIQUE (timetable_id, stop_id, trip_sequence)
);

COMMENT ON TABLE timetable_entries IS 'Individual scheduled departure times for each stop within a timetable.';

CREATE INDEX idx_timetable_entries_timetable ON timetable_entries (timetable_id);
CREATE INDEX idx_timetable_entries_stop      ON timetable_entries (stop_id);
CREATE INDEX idx_timetable_entries_time      ON timetable_entries (departure_time);


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. USER INTERACTION TABLES
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 5.1 User Favourites  (Saved stops and routes)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_favorites (
    id              SERIAL          PRIMARY KEY,
    user_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    favorite_type   favorite_type   NOT NULL,
    stop_id         INTEGER         REFERENCES stops(id) ON DELETE CASCADE,
    route_id        INTEGER         REFERENCES routes(id) ON DELETE CASCADE,
    alias           VARCHAR(100),                        -- User's custom label (e.g. "Home", "Work")
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Ensure exactly one of stop_id or route_id is set based on favorite_type
    CONSTRAINT chk_favorite_target CHECK (
        (favorite_type = 'stop'  AND stop_id  IS NOT NULL AND route_id IS NULL) OR
        (favorite_type = 'route' AND route_id IS NOT NULL AND stop_id  IS NULL)
    ),
    -- Prevent duplicate favourites
    UNIQUE (user_id, favorite_type, stop_id),
    UNIQUE (user_id, favorite_type, route_id)
);

COMMENT ON TABLE user_favorites IS 'User-saved stops and routes for quick access.';

CREATE INDEX idx_favorites_user ON user_favorites (user_id);


-- ──────────────────────────────────────────────────────────────────────────────
-- 5.2 Feedbacks  (Issue reports and suggestions from users)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE feedbacks (
    id              SERIAL          PRIMARY KEY,
    user_id         INTEGER         REFERENCES users(id) ON DELETE SET NULL,  -- NULL for anonymous
    category        feedback_category NOT NULL DEFAULT 'other',
    status          feedback_status   NOT NULL DEFAULT 'pending',
    subject         VARCHAR(200),
    description     TEXT            NOT NULL,            -- The feedback content
    
    -- Optional context: which stop/route/bus is this about?
    related_stop_id  INTEGER        REFERENCES stops(id) ON DELETE SET NULL,
    related_route_id INTEGER        REFERENCES routes(id) ON DELETE SET NULL,
    related_bus_id   INTEGER        REFERENCES buses(id) ON DELETE SET NULL,
    
    -- Reporter location at time of report (optional)
    reporter_lat    DECIMAL(9,7),
    reporter_lng    DECIMAL(9,7),
    
    -- Resolution
    resolved_by     INTEGER         REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE feedbacks IS 'User-submitted issue reports, suggestions, and complaints about transit service.';

CREATE INDEX idx_feedbacks_user     ON feedbacks (user_id)   WHERE user_id IS NOT NULL;
CREATE INDEX idx_feedbacks_status   ON feedbacks (status);
CREATE INDEX idx_feedbacks_category ON feedbacks (category);
CREATE INDEX idx_feedbacks_created  ON feedbacks (created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. VIEWS (Common Queries)
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 6.1 Active Buses — Quick view of all currently operating buses
-- ──────────────────────────────────────────────────────────────────────────────
CREATE VIEW v_active_buses AS
SELECT
    b.id                AS bus_id,
    b.license_plate,
    r.bus_number,
    r.color             AS route_color,
    b.status,
    b.direction,
    b.current_latitude,
    b.current_longitude,
    b.current_path_index,
    b.progress,
    b.speed_kmh,
    b.heading,
    b.last_telemetry_at,
    -- Current stop name
    cs.name             AS current_stop_name,
    -- Next stop name
    ns.name             AS next_stop_name
FROM buses b
JOIN routes r ON r.id = b.route_id
LEFT JOIN route_stops crs ON crs.route_id = b.route_id AND crs.stop_order = b.current_stop_index
LEFT JOIN stops cs ON cs.id = crs.stop_id
LEFT JOIN route_stops nrs ON nrs.route_id = b.route_id
    AND nrs.stop_order = CASE
        WHEN b.direction = 'forward' THEN b.current_stop_index + 1
        ELSE GREATEST(b.current_stop_index - 1, 0)
    END
LEFT JOIN stops ns ON ns.id = nrs.stop_id
WHERE b.is_active = TRUE
  AND b.status IN ('moving', 'dwelling');

COMMENT ON VIEW v_active_buses IS 'Real-time snapshot of all operating buses with route info and current/next stop names.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 6.2 Route Summary — Overview of each route with stop count and bus count
-- ──────────────────────────────────────────────────────────────────────────────
CREATE VIEW v_route_summary AS
SELECT
    r.id              AS route_id,
    r.bus_number,
    r.color,
    r.description,
    r.fare_gel,
    r.is_circular,
    COUNT(DISTINCT rs.stop_id)  AS total_stops,
    COUNT(DISTINCT b.id)        AS total_buses,
    COUNT(DISTINCT b.id) FILTER (WHERE b.is_active = TRUE AND b.status IN ('moving', 'dwelling'))
                                AS active_buses,
    (SELECT COUNT(*) FROM route_path_points rpp WHERE rpp.route_id = r.id)
                                AS total_path_points
FROM routes r
LEFT JOIN route_stops rs ON rs.route_id = r.id
LEFT JOIN buses b ON b.route_id = r.id
WHERE r.is_active = TRUE
GROUP BY r.id, r.bus_number, r.color, r.description, r.fare_gel, r.is_circular;

COMMENT ON VIEW v_route_summary IS 'Aggregated route statistics including stop count, bus count, and path complexity.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 6.3 Stop Routes — Which routes serve each stop
-- ──────────────────────────────────────────────────────────────────────────────
CREATE VIEW v_stop_routes AS
SELECT
    s.id            AS stop_id,
    s.name          AS stop_name,
    s.latitude,
    s.longitude,
    r.id            AS route_id,
    r.bus_number,
    r.color,
    rs.stop_order
FROM stops s
JOIN route_stops rs ON rs.stop_id = s.id
JOIN routes r ON r.id = rs.route_id
WHERE s.is_active = TRUE
  AND r.is_active = TRUE
ORDER BY s.id, r.bus_number;

COMMENT ON VIEW v_stop_routes IS 'All routes serving each stop, useful for stop detail panels and transfer lookups.';


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. TRIGGERS  (Auto-update timestamps)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_stops_updated_at
    BEFORE UPDATE ON stops
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_routes_updated_at
    BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_buses_updated_at
    BEFORE UPDATE ON buses
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_feedbacks_updated_at
    BEFORE UPDATE ON feedbacks
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 8.1 Haversine distance in kilometres between two lat/lng points
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_haversine_km(
    lat1 DECIMAL, lng1 DECIMAL,
    lat2 DECIMAL, lng2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    R CONSTANT DECIMAL := 6371.0;  -- Earth radius in km
    d_lat DECIMAL;
    d_lng DECIMAL;
    a DECIMAL;
BEGIN
    d_lat := RADIANS(lat2 - lat1);
    d_lng := RADIANS(lng2 - lng1);
    a := SIN(d_lat / 2) ^ 2
       + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(d_lng / 2) ^ 2;
    RETURN R * 2 * ATAN2(SQRT(a), SQRT(1 - a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION fn_haversine_km IS 'Calculates the great-circle distance in km between two WGS84 points using the Haversine formula.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 8.2 Find nearest stops to a given coordinate
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_nearest_stops(
    p_lat DECIMAL,
    p_lng DECIMAL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    stop_id     INTEGER,
    stop_name   VARCHAR,
    latitude    DECIMAL,
    longitude   DECIMAL,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name,
        s.latitude,
        s.longitude,
        fn_haversine_km(p_lat, p_lng, s.latitude, s.longitude) AS distance_km
    FROM stops s
    WHERE s.is_active = TRUE
    ORDER BY fn_haversine_km(p_lat, p_lng, s.latitude, s.longitude)
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_nearest_stops IS 'Returns the N nearest active stops to a given coordinate, ordered by distance.';


-- ──────────────────────────────────────────────────────────────────────────────
-- 8.3 Get all routes passing through a specific stop
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_routes_for_stop(p_stop_id INTEGER)
RETURNS TABLE (
    route_id    INTEGER,
    bus_number  VARCHAR,
    color       VARCHAR,
    stop_order  INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.bus_number,
        r.color,
        rs.stop_order
    FROM route_stops rs
    JOIN routes r ON r.id = rs.route_id
    WHERE rs.stop_id = p_stop_id
      AND r.is_active = TRUE
    ORDER BY r.bus_number;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION fn_routes_for_stop IS 'Returns all active routes that pass through a given stop.';


-- ══════════════════════════════════════════════════════════════════════════════
-- SCHEMA COMPLETE
-- ══════════════════════════════════════════════════════════════════════════════
-- To load seed data, run: \i seed_data.sql
-- ══════════════════════════════════════════════════════════════════════════════
