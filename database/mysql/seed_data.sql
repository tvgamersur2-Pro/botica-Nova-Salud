-- ============================================================
-- Seed Data - Nova Salud (datos de prueba)
-- ============================================================
USE nova_salud;

-- ============================================================
-- Usuarios adicionales (password: Admin123! para todos)
-- ============================================================
INSERT IGNORE INTO users (id, username, password_hash, full_name, email, role, is_active) VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'farmaceutico1', '$2b$12$ffgzjirp.oWvxqmDp3ClNOqFPZvev/s2WcyN8V22N8i30FmsUaknS', 'María López García', 'maria.lopez@novasalud.com', 'pharmacist', 1),
  ('aaaaaaaa-0001-0001-0001-000000000002', 'cajero1',       '$2b$12$ffgzjirp.oWvxqmDp3ClNOqFPZvev/s2WcyN8V22N8i30FmsUaknS', 'Carlos Ramírez Torres', 'carlos.ramirez@novasalud.com', 'cashier', 1),
  ('aaaaaaaa-0001-0001-0001-000000000003', 'cajero2',       '$2b$12$ffgzjirp.oWvxqmDp3ClNOqFPZvev/s2WcyN8V22N8i30FmsUaknS', 'Ana Martínez Ruiz', 'ana.martinez@novasalud.com', 'cashier', 1);

-- ============================================================
-- Proveedores
-- ============================================================
INSERT IGNORE INTO suppliers (id, name, contact_email, phone, address, lead_time_days) VALUES
  ('bbbbbbbb-0001-0001-0001-000000000001', 'Laboratorios Pisa', 'ventas@pisa.com.mx', '33-3678-0000', 'Av. España 1840, Guadalajara, Jalisco', 5),
  ('bbbbbbbb-0001-0001-0001-000000000002', 'Distribuidora Nadro', 'pedidos@nadro.com.mx', '55-5328-5000', 'Calz. de los Misterios 407, CDMX', 3),
  ('bbbbbbbb-0001-0001-0001-000000000003', 'Farmacéuticos Rayere', 'contacto@rayere.com', '81-8158-0000', 'Av. Lázaro Cárdenas 2400, Monterrey, NL', 7),
  ('bbbbbbbb-0001-0001-0001-000000000004', 'Probiomed', 'ventas@probiomed.com.mx', '55-5972-9800', 'Carretera Tenango-Tenancingo Km 37, Edo. Méx.', 10);

-- ============================================================
-- Productos
-- ============================================================
INSERT IGNORE INTO products (id, name, dosage, form, quantity_in_stock, unit_price, supplier_id, expiration_date, category, min_stock_threshold, reorder_quantity) VALUES
  -- Prescripción
  ('cccccccc-0001-0001-0001-000000000001', 'Amoxicilina',        '500mg',  'capsule',   120, 18.50, 'bbbbbbbb-0001-0001-0001-000000000001', '2026-08-15', 'prescription', 20, 100),
  ('cccccccc-0001-0001-0001-000000000002', 'Metformina',         '850mg',  'tablet',    200, 12.00, 'bbbbbbbb-0001-0001-0001-000000000002', '2026-12-01', 'prescription', 30, 150),
  ('cccccccc-0001-0001-0001-000000000003', 'Losartán',           '50mg',   'tablet',     85, 22.00, 'bbbbbbbb-0001-0001-0001-000000000001', '2027-03-20', 'prescription', 20, 100),
  ('cccccccc-0001-0001-0001-000000000004', 'Atorvastatina',      '20mg',   'tablet',     60, 35.00, 'bbbbbbbb-0001-0001-0001-000000000002', '2026-11-10', 'prescription', 15, 80),
  ('cccccccc-0001-0001-0001-000000000005', 'Omeprazol',          '20mg',   'capsule',    45, 15.00, 'bbbbbbbb-0001-0001-0001-000000000003', '2026-09-30', 'prescription', 20, 100),
  ('cccccccc-0001-0001-0001-000000000006', 'Insulina Glargina',  '100U/mL','injection',  18,  9.50, 'bbbbbbbb-0001-0001-0001-000000000004', '2026-07-01', 'prescription', 10, 50),
  -- OTC
  ('cccccccc-0001-0001-0001-000000000007', 'Paracetamol',        '500mg',  'tablet',    350,  8.00, 'bbbbbbbb-0001-0001-0001-000000000001', '2027-06-15', 'otc',          50, 200),
  ('cccccccc-0001-0001-0001-000000000008', 'Ibuprofeno',         '400mg',  'tablet',    280, 10.50, 'bbbbbbbb-0001-0001-0001-000000000002', '2027-04-20', 'otc',          40, 150),
  ('cccccccc-0001-0001-0001-000000000009', 'Loratadina',         '10mg',   'tablet',    160, 14.00, 'bbbbbbbb-0001-0001-0001-000000000001', '2027-01-10', 'otc',          25, 100),
  ('cccccccc-0001-0001-0001-000000000010', 'Vitamina C',         '500mg',  'tablet',    400,  6.50, 'bbbbbbbb-0001-0001-0001-000000000003', '2027-08-01', 'otc',          50, 200),
  ('cccccccc-0001-0001-0001-000000000011', 'Jarabe para la tos', '120mL',  'liquid',     75, 45.00, 'bbbbbbbb-0001-0001-0001-000000000002', '2026-10-15', 'otc',          15, 60),
  -- General
  ('cccccccc-0001-0001-0001-000000000012', 'Alcohol 70%',        '500mL',  'liquid',    200, 28.00, 'bbbbbbbb-0001-0001-0001-000000000003', '2027-12-31', 'general',      30, 100),
  ('cccccccc-0001-0001-0001-000000000013', 'Crema Hidratante',   '100g',   'cream',      90, 55.00, 'bbbbbbbb-0001-0001-0001-000000000004', '2027-05-20', 'general',      15, 50),
  ('cccccccc-0001-0001-0001-000000000014', 'Gasas Estériles',    '10x10cm','other',     500,  4.50, 'bbbbbbbb-0001-0001-0001-000000000001', '2028-01-01', 'general',      100, 300),
  -- Stock bajo (para generar alertas)
  ('cccccccc-0001-0001-0001-000000000015', 'Azitromicina',       '250mg',  'capsule',     8, 32.00, 'bbbbbbbb-0001-0001-0001-000000000001', '2026-06-30', 'prescription', 20, 80),
  -- Por vencer (menos de 90 días desde hoy ~2026-05-11)
  ('cccccccc-0001-0001-0001-000000000016', 'Diclofenaco',        '50mg',   'tablet',     55, 11.00, 'bbbbbbbb-0001-0001-0001-000000000002', '2026-07-15', 'otc',          15, 60);

-- ============================================================
-- Alertas de prueba
-- ============================================================
INSERT IGNORE INTO alerts (id, product_id, alert_type, alert_threshold, current_stock_level, alert_timestamp) VALUES
  ('dddddddd-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000015', 'low_stock',     20,  8, NOW()),
  ('dddddddd-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000016', 'expiring_soon', 15, 55, NOW()),
  ('dddddddd-0001-0001-0001-000000000003', 'cccccccc-0001-0001-0001-000000000006', 'expiring_soon', 10, 18, NOW());

-- ============================================================
-- Transacciones de prueba (últimos días)
-- ============================================================
SET @admin_id = (SELECT id FROM users WHERE username = 'admin' LIMIT 1);

INSERT IGNORE INTO transactions (id, `timestamp`, total_amount, tax_amount, payment_method, cashier_id, status) VALUES
  ('eeeeeeee-0001-0001-0001-000000000001', DATE_SUB(NOW(), INTERVAL 2 DAY),  116.00, 16.00, 'cash',      @admin_id, 'completed'),
  ('eeeeeeee-0001-0001-0001-000000000002', DATE_SUB(NOW(), INTERVAL 2 DAY),  232.00, 32.00, 'credit',    @admin_id, 'completed'),
  ('eeeeeeee-0001-0001-0001-000000000003', DATE_SUB(NOW(), INTERVAL 1 DAY),   92.80, 12.80, 'cash',      @admin_id, 'completed'),
  ('eeeeeeee-0001-0001-0001-000000000004', DATE_SUB(NOW(), INTERVAL 1 DAY),  406.00, 56.00, 'insurance', @admin_id, 'completed'),
  ('eeeeeeee-0001-0001-0001-000000000005', NOW(),                             174.00, 24.00, 'cash',      @admin_id, 'completed');

INSERT IGNORE INTO transaction_items (id, transaction_id, product_id, product_name, quantity, unit_price, total_price) VALUES
  ('ffffffff-0001-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000007', 'Paracetamol 500mg',   5,  8.00,  40.00),
  ('ffffffff-0001-0001-0001-000000000002', 'eeeeeeee-0001-0001-0001-000000000001', 'cccccccc-0001-0001-0001-000000000008', 'Ibuprofeno 400mg',    4, 10.50,  42.00),
  ('ffffffff-0001-0001-0001-000000000003', 'eeeeeeee-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000001', 'Amoxicilina 500mg',   6, 18.50, 111.00),
  ('ffffffff-0001-0001-0001-000000000004', 'eeeeeeee-0001-0001-0001-000000000002', 'cccccccc-0001-0001-0001-000000000003', 'Losartán 50mg',       3, 22.00,  66.00),
  ('ffffffff-0001-0001-0001-000000000005', 'eeeeeeee-0001-0001-0001-000000000003', 'cccccccc-0001-0001-0001-000000000010', 'Vitamina C 500mg',    8,  6.50,  52.00),
  ('ffffffff-0001-0001-0001-000000000006', 'eeeeeeee-0001-0001-0001-000000000004', 'cccccccc-0001-0001-0001-000000000002', 'Metformina 850mg',   10, 12.00, 120.00),
  ('ffffffff-0001-0001-0001-000000000007', 'eeeeeeee-0001-0001-0001-000000000004', 'cccccccc-0001-0001-0001-000000000004', 'Atorvastatina 20mg',  5, 35.00, 175.00),
  ('ffffffff-0001-0001-0001-000000000008', 'eeeeeeee-0001-0001-0001-000000000005', 'cccccccc-0001-0001-0001-000000000009', 'Loratadina 10mg',     6, 14.00,  84.00),
  ('ffffffff-0001-0001-0001-000000000009', 'eeeeeeee-0001-0001-0001-000000000005', 'cccccccc-0001-0001-0001-000000000012', 'Alcohol 70% 500mL',   2, 28.00,  56.00);

SELECT 'Seed completado exitosamente' AS resultado;
