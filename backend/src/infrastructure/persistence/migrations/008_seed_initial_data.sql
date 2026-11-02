-- Migration 008: Reproducible Industrial Baseline Seed Data
BEGIN;

-- 1. Seed Users (Password for all seeded accounts: "FlowGuard#2026!")
-- Argon2id hash generated with memoryCost=65536, timeCost=3, parallelism=1
INSERT INTO users (id, first_name, last_name, email, password_hash, status)
VALUES
    ('11111111-1111-4111-8111-111111111101', 'System', 'Administrator', 'admin@flowguard.industrial', '$argon2id$v=19$m=65536,t=3,p=1$uu1vKwzYqGBz0g5aeZO9hQ$A4SHt8mdOc9u4BNNyYl+w5XeG3b/XtumhELfTKdePFo', 'ACTIVE'),
    ('22222222-2222-4222-8222-222222222202', 'Alice', 'Smith', 'alice.smith@flowguard.industrial', '$argon2id$v=19$m=65536,t=3,p=1$uu1vKwzYqGBz0g5aeZO9hQ$A4SHt8mdOc9u4BNNyYl+w5XeG3b/XtumhELfTKdePFo', 'ACTIVE'),
    ('33333333-3333-4333-8333-333333333303', 'Bob', 'Johnson', 'bob.johnson@flowguard.industrial', '$argon2id$v=19$m=65536,t=3,p=1$uu1vKwzYqGBz0g5aeZO9hQ$A4SHt8mdOc9u4BNNyYl+w5XeG3b/XtumhELfTKdePFo', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES
    ('11111111-1111-4111-8111-111111111101', 'ADMINISTRATOR'),
    ('22222222-2222-4222-8222-222222222202', 'ENGINEER'),
    ('33333333-3333-4333-8333-333333333303', 'OPERATOR')
ON CONFLICT DO NOTHING;

-- 2. Seed Plant Sectors
INSERT INTO plant_sectors (id, sector_code, name, description, is_active)
VALUES
    ('a1b2c3d4-e5f6-4a5b-8c9d-001122334455', 'SEC-LOGISTICS-A', 'Automated Sorting Bay Alpha', 'Primary high-speed parcel sorting sector for North distribution hub.', TRUE),
    ('a1b2c3d4-e5f6-4a5b-8c9d-001122334456', 'SEC-PACKAGING-B', 'Heavy Packaging Line Sector Beta', 'Secondary palletizing and shrink-wrap conveyor sector.', TRUE)
ON CONFLICT DO NOTHING;

-- 3. Seed Conveyor Lines
INSERT INTO conveyor_lines (id, sector_id, line_code, name, operational_status, is_active, version)
VALUES
    ('b2c3d4e5-f6a7-4b6c-9d0e-112233445566', 'a1b2c3d4-e5f6-4a5b-8c9d-001122334455', 'LINE-SORT-NORTH-01', 'North Parcel Sorter Primary Belt', 'RUNNING', TRUE, 1),
    ('b2c3d4e5-f6a7-4b6c-9d0e-112233445567', 'a1b2c3d4-e5f6-4a5b-8c9d-001122334455', 'LINE-SORT-SOUTH-02', 'South Cross-Belt Sorter', 'RUNNING', TRUE, 1),
    ('b2c3d4e5-f6a7-4b6c-9d0e-112233445568', 'a1b2c3d4-e5f6-4a5b-8c9d-001122334456', 'LINE-PACK-MAIN-01', 'Main Palletizing Feed Conveyor', 'RUNNING', TRUE, 1)
ON CONFLICT DO NOTHING;

-- 4. Seed Sensor Nodes & Threshold Rules
INSERT INTO sensor_nodes (id, line_id, serial_number, sensor_type, is_active)
VALUES
    ('c3d4e5f6-a7b8-4c7d-8e1f-223344556677', 'b2c3d4e5-f6a7-4b6c-9d0e-112233445566', 'SN-VIB-9001', 'MOTOR_VIBRATION', TRUE),
    ('c3d4e5f6-a7b8-4c7d-8e1f-223344556678', 'b2c3d4e5-f6a7-4b6c-9d0e-112233445566', 'SN-TMP-9002', 'BEARING_TEMPERATURE', TRUE),
    ('c3d4e5f6-a7b8-4c7d-8e1f-223344556679', 'b2c3d4e5-f6a7-4b6c-9d0e-112233445567', 'SN-VEL-9003', 'BELT_VELOCITY', TRUE),
    ('c3d4e5f6-a7b8-4c7d-8e1f-223344556680', 'b2c3d4e5-f6a7-4b6c-9d0e-112233445568', 'SN-OPT-9004', 'OPTICAL_COUNTER', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO threshold_rules (id, sensor_id, warning_limit, critical_limit, unit, window_size_samples, version)
VALUES
    ('d4e5f6a7-b8c9-4d8e-9f2a-334455667701', 'c3d4e5f6-a7b8-4c7d-8e1f-223344556677', 4.5, 7.1, 'mm/s', 32, 1),
    ('d4e5f6a7-b8c9-4d8e-9f2a-334455667702', 'c3d4e5f6-a7b8-4c7d-8e1f-223344556678', 65.0, 82.0, 'C', 32, 1),
    ('d4e5f6a7-b8c9-4d8e-9f2a-334455667703', 'c3d4e5f6-a7b8-4c7d-8e1f-223344556679', 2.8, 3.5, 'm/s', 16, 1),
    ('d4e5f6a7-b8c9-4d8e-9f2a-334455667704', 'c3d4e5f6-a7b8-4c7d-8e1f-223344556680', 120.0, 160.0, 'units/min', 64, 1)
ON CONFLICT DO NOTHING;

-- 5. Seed Spare Parts Stock
INSERT INTO spare_part_stock (id, part_code, name, stock_units)
VALUES
    ('e5f6a7b8-c9d0-4e9f-8a3b-445566778891', 'PRT-BRG-6204', 'High-Speed Conveyor Roller Bearing SKF-6204', 25),
    ('e5f6a7b8-c9d0-4e9f-8a3b-445566778892', 'PRT-BELT-MOD-10', 'Modular Polyurethane Belt Segment 10m', 8),
    ('e5f6a7b8-c9d0-4e9f-8a3b-445566778893', 'PRT-OPT-LENS-02', 'Optical Photoelectric Reflector Sensor Kit', 14)
ON CONFLICT DO NOTHING;

COMMIT;