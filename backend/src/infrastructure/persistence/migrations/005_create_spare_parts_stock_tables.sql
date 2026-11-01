-- Migration 005: Normalized Abstract Spare-Part Stock & Audit Movements (FG-STOCK)
BEGIN;

CREATE TABLE IF NOT EXISTS spare_part_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_code VARCHAR(30) NOT NULL CHECK (length(btrim(part_code)) >= 2),
    name VARCHAR(150) NOT NULL CHECK (length(btrim(name)) >= 2),
    stock_units INT NOT NULL DEFAULT 0 CHECK (stock_units >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spare_part_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES spare_part_stock(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL
        CHECK (movement_type IN ('REPLENISHMENT', 'CONSUMPTION')),
    amount INT NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;