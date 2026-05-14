-- ============================================================
-- Migration: 001_initial_schema.sql (MySQL)
-- Nova Salud - Pharmacy Inventory and Sales Management System
-- Requirements: DR-1, DR-2, DR-3, DR-4, DR-5
-- ============================================================

CREATE DATABASE IF NOT EXISTS nova_salud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nova_salud;

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(100) UNIQUE NOT NULL,
    role            ENUM('admin','pharmacist','cashier') NOT NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    last_login      DATETIME,
    failed_login_attempts INT    NOT NULL DEFAULT 0,
    locked_until    DATETIME,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Table: suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id              CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    name            VARCHAR(100) NOT NULL,
    contact_email   VARCHAR(100),
    phone           VARCHAR(20),
    address         TEXT,
    lead_time_days  DECIMAL(5,2) NOT NULL DEFAULT 7.0,
    pricing         JSON,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Table: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id                  CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
    name                VARCHAR(200)  NOT NULL,
    dosage              VARCHAR(50),
    form                ENUM('tablet','capsule','liquid','injection','cream','other') NOT NULL,
    quantity_in_stock   INT           NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
    unit_price          DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    supplier_id         CHAR(36),
    expiration_date     DATE          NOT NULL,
    category            ENUM('prescription','otc','general') NOT NULL,
    min_stock_threshold INT           NOT NULL DEFAULT 10,
    reorder_quantity    INT           NOT NULL DEFAULT 50,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by          CHAR(36),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by)  REFERENCES users(id)     ON DELETE SET NULL
);

-- ============================================================
-- Table: transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id              CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
    `timestamp`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount    DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    tax_amount      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_method  ENUM('cash','credit','insurance') NOT NULL,
    cashier_id      CHAR(36)      NOT NULL,
    customer_id     CHAR(36),
    refund_status   ENUM('none','partial','full') NOT NULL DEFAULT 'none',
    status          ENUM('pending','completed','voided') NOT NULL DEFAULT 'completed',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cashier_id) REFERENCES users(id)
);

-- ============================================================
-- Table: transaction_items
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_items (
    id              CHAR(36)      PRIMARY KEY DEFAULT (UUID()),
    transaction_id  CHAR(36)      NOT NULL,
    product_id      CHAR(36)      NOT NULL,
    product_name    VARCHAR(200)  NOT NULL,
    quantity        INT           NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(10,2) NOT NULL,
    total_price     DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)     REFERENCES products(id)
);

-- ============================================================
-- Table: alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
    id                  CHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    product_id          CHAR(36)  NOT NULL,
    alert_type          ENUM('low_stock','expiring_soon','expired') NOT NULL,
    alert_threshold     INT       NOT NULL,
    current_stock_level INT       NOT NULL,
    alert_timestamp     DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_timestamp  DATETIME,
    resolved_by         CHAR(36),
    resolution_notes    TEXT,
    supplier_suggestion JSON,
    FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id)    ON DELETE SET NULL
);

-- ============================================================
-- Table: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id                      CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    user_id                 CHAR(36)     NOT NULL,
    action                  VARCHAR(100) NOT NULL,
    `timestamp`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    affected_resource_id    CHAR(36),
    before_state            JSON,
    after_state             JSON,
    ip_address              VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- Table: sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id          CHAR(36)     PRIMARY KEY DEFAULT (UUID()),
    user_id     CHAR(36)     NOT NULL,
    token       VARCHAR(500) NOT NULL UNIQUE,
    expires_at  DATETIME     NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
