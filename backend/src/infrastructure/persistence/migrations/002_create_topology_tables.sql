-- Migration 002: Hierarchical Plant Sectors & Conveyor Lines (FG-TOPO)
BEGIN;

CREATE TABLE IF NOT EXISTS plant_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_code VARCHAR(30) NOT NULL CHECK (length(btrim(sector_code)) >= 2),
    name VARCHAR(120) NOT NULL CHECK (length(btrim(name)) >= 2),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conveyor_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id UUID NOT NULL REFERENCES plant_sectors(id) ON DELETE RESTRICT,
    line_code VARCHAR(30) NOT NULL CHECK (length(btrim(line_code)) >= 2),
    name VARCHAR(150) NOT NULL CHECK (length(btrim(name)) >= 2),
    operational_status VARCHAR(30) NOT NULL DEFAULT 'RUNNING'
        CHECK (operational_status IN ('RUNNING', 'DEGRADED_WARNING', 'FAULT_HALTED', 'MAINTENANCE', 'DEACTIVATED')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_conveyor_lines_active_consistency CHECK (
        (is_active = FALSE AND operational_status = 'DEACTIVATED') OR
        (is_active = TRUE AND operational_status <> 'DEACTIVATED')
    )
);

COMMIT;