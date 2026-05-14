-- ============================================================
-- Migration: 002_indexes.sql (MySQL)
-- Performance indexes for Nova Salud
-- ============================================================

USE nova_salud;

-- Products
CREATE INDEX idx_products_name            ON products(name);
CREATE INDEX idx_products_supplier_id     ON products(supplier_id);
CREATE INDEX idx_products_expiration_date ON products(expiration_date);
CREATE INDEX idx_products_quantity        ON products(quantity_in_stock);
CREATE INDEX idx_products_category        ON products(category);

-- Transactions
CREATE INDEX idx_transactions_cashier_id  ON transactions(cashier_id);
CREATE INDEX idx_transactions_timestamp   ON transactions(`timestamp`);
CREATE INDEX idx_transactions_status      ON transactions(status);

-- Transaction items
CREATE INDEX idx_tx_items_transaction_id  ON transaction_items(transaction_id);
CREATE INDEX idx_tx_items_product_id      ON transaction_items(product_id);

-- Alerts
CREATE INDEX idx_alerts_product_id        ON alerts(product_id);
CREATE INDEX idx_alerts_alert_type        ON alerts(alert_type);
CREATE INDEX idx_alerts_resolved          ON alerts(resolved_timestamp);

-- Audit logs
CREATE INDEX idx_audit_user_id            ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp          ON audit_logs(`timestamp`);
CREATE INDEX idx_audit_action             ON audit_logs(action);

-- Users
CREATE INDEX idx_users_username           ON users(username);
CREATE INDEX idx_users_role               ON users(role);
CREATE INDEX idx_users_locked_until       ON users(locked_until);

-- Sessions
CREATE INDEX idx_sessions_token           ON sessions(token);
CREATE INDEX idx_sessions_user_id         ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at      ON sessions(expires_at);
