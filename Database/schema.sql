-- =========================================
-- Fabric2Fashion Database Schema (PostgreSQL)
-- Version: v1.0
-- =========================================

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- USERS
-- =========================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  role VARCHAR(20) NOT NULL CHECK (
    role IN ('admin', 'supplier', 'retailer', 'tailor', 'customer')
  ),

  name TEXT NOT NULL,
  mobile VARCHAR(15) UNIQUE,
  email TEXT UNIQUE,

  password_hash TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'blocked')
  ),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- PRODUCTS
-- =========================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- ORDERS
-- =========================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),

  order_type VARCHAR(20) NOT NULL CHECK (
    order_type IN ('product', 'tailoring')
  ),

  status VARCHAR(30) NOT NULL CHECK (
    status IN (
      'created',
      'accepted',
      'in_progress',
      'dispatched',
      'delivered',
      'cancelled'
    )
  ),

  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- ORDER ITEMS
-- =========================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),

  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- PAYOUTS
-- =========================================
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id),

  order_id UUID REFERENCES orders(id),

  gross_amount NUMERIC(10,2) NOT NULL CHECK (gross_amount >= 0),
  commission NUMERIC(10,2) NOT NULL CHECK (commission >= 0),
  payable_amount NUMERIC(10,2) NOT NULL CHECK (payable_amount >= 0),

  payout_status VARCHAR(20) NOT NULL CHECK (
    payout_status IN ('pending', 'paid', 'failed')
  ),

  transaction_ref TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP
);

-- =========================================
-- INVENTORY (TAILOR / RETAILER / SUPPLIER)
-- =========================================
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_id UUID NOT NULL REFERENCES users(id),

  name TEXT NOT NULL,
  unit VARCHAR(20),
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity >= 0),
  cost_per_unit NUMERIC(10,2) CHECK (cost_per_unit >= 0),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- EMPLOYEES (FOR TAILORS)
-- =========================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tailor_id UUID NOT NULL REFERENCES users(id),

  name TEXT NOT NULL,
  role TEXT,
  mobile VARCHAR(15),

  salary_type VARCHAR(20) CHECK (
    salary_type IN ('daily', 'monthly')
  ),

  salary_amount NUMERIC(10,2) CHECK (salary_amount >= 0),
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================================
-- ATTENDANCE
-- =========================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  employee_id UUID NOT NULL REFERENCES employees(id),
  date DATE NOT NULL,

  status VARCHAR(20) CHECK (
    status IN ('present', 'absent', 'half_day')
  ),

  UNIQUE (employee_id, date)
);
