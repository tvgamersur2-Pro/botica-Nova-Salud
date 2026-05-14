/**
 * Nova Salud – Express Server Entry Point (MOCK VERSION)
 * Versión simplificada que usa datos JSON en lugar de base de datos
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { loadData } from './config/mockDatabase';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ----------------------------------------------------------------
// Security headers
// ----------------------------------------------------------------
app.use(helmet());

// ----------------------------------------------------------------
// CORS
// ----------------------------------------------------------------
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  }),
);

// ----------------------------------------------------------------
// Rate limiting
// ----------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// ----------------------------------------------------------------
// Body parsing
// ----------------------------------------------------------------
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ----------------------------------------------------------------
// Health check
// ----------------------------------------------------------------
app.get('/health', async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'mock',
    services: {
      database: 'mock-json',
    },
  });
});

// ----------------------------------------------------------------
// Mock API Routes
// ----------------------------------------------------------------

// POST login (simple mock authentication)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: { message: 'Username and password are required' } 
      });
    }
    
    const data = await loadData();
    const user = data.users.find(u => u.username === username);
    
    if (!user) {
      return res.status(401).json({ 
        error: { message: 'Invalid credentials' } 
      });
    }
    
    // Mock password validation (in real app, use bcrypt)
    // For mock mode, accept these passwords:
    const mockPasswords: Record<string, string> = {
      'admin': 'Admin123!',
      'farmaceutico1': 'Pharma123!',
      'cajero1': 'Cashier123!'
    };
    
    if (mockPasswords[username] !== password) {
      return res.status(401).json({ 
        error: { message: 'Invalid credentials' } 
      });
    }
    
    // Generate mock token
    const mockToken = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    
    res.json({
      data: {
        accessToken: mockToken,
        refreshToken: mockToken,
        expiresIn: 1800,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          lastLogin: user.last_login,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error during login' } });
  }
});

// GET all users
app.get('/api/users', async (_req: Request, res: Response) => {
  try {
    const data = await loadData();
    res.json({
      data: data.users.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        email: u.email,
        role: u.role,
        isActive: u.is_active,
        lastLogin: u.last_login,
        createdAt: u.created_at
      })),
      meta: { page: 1, limit: 20, total: data.users.length, totalPages: 1 }
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error loading users' } });
  }
});

// GET all products
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const data = await loadData();
    const { search, category, stockLevel } = req.query;
    
    let products = data.products;
    
    // Filtrar por búsqueda
    if (search) {
      const searchLower = String(search).toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        (p.dosage && p.dosage.toLowerCase().includes(searchLower))
      );
    }
    
    // Filtrar por categoría
    if (category) {
      products = products.filter(p => p.category === category);
    }
    
    // Filtrar por nivel de stock
    if (stockLevel === 'low_stock') {
      products = products.filter(p => p.quantity_in_stock <= p.min_stock_threshold);
    } else if (stockLevel === 'in_stock') {
      products = products.filter(p => p.quantity_in_stock > p.min_stock_threshold);
    }
    
    // Agregar nombre del proveedor
    const productsWithSupplier = products.map(p => {
      const supplier = data.suppliers.find(s => s.id === p.supplier_id);
      return {
        id: p.id,
        name: p.name,
        dosage: p.dosage,
        form: p.form,
        quantityInStock: p.quantity_in_stock,
        unitPrice: p.unit_price,
        supplierId: p.supplier_id,
        expirationDate: p.expiration_date,
        category: p.category,
        minStockThreshold: p.min_stock_threshold,
        reorderQuantity: p.reorder_quantity,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        updatedBy: p.updated_by,
        supplierName: supplier ? supplier.name : null
      };
    });
    
    res.json({
      data: productsWithSupplier,
      meta: { page: 1, limit: 20, total: productsWithSupplier.length, totalPages: 1 }
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error loading products' } });
  }
});

// GET all suppliers
app.get('/api/suppliers', async (_req: Request, res: Response) => {
  try {
    const data = await loadData();
    res.json({
      data: data.suppliers.map(s => ({
        id: s.id,
        name: s.name,
        contactEmail: s.contact_email,
        phone: s.phone,
        address: s.address,
        leadTimeDays: s.lead_time_days,
        pricing: s.pricing,
        createdAt: s.created_at
      })),
      meta: { page: 1, limit: 20, total: data.suppliers.length, totalPages: 1 }
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error loading suppliers' } });
  }
});

// GET all transactions
app.get('/api/transactions', async (_req: Request, res: Response) => {
  try {
    const data = await loadData();
    
    const transactionsWithDetails = data.transactions.map(t => {
      const cashier = data.users.find(u => u.id === t.cashier_id);
      return {
        id: t.id,
        timestamp: t.timestamp,
        totalAmount: t.total_amount,
        taxAmount: t.tax_amount,
        paymentMethod: t.payment_method,
        cashierId: t.cashier_id,
        customerId: t.customer_id,
        refundStatus: t.refund_status,
        status: t.status,
        createdAt: t.created_at,
        cashierName: cashier ? cashier.full_name : null
      };
    });
    
    res.json({
      data: transactionsWithDetails,
      meta: { page: 1, limit: 20, total: transactionsWithDetails.length, totalPages: 1 }
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error loading transactions' } });
  }
});

// GET transaction by ID with items
app.get('/api/transactions/:id', async (req: Request, res: Response) => {
  try {
    const data = await loadData();
    const transaction = data.transactions.find(t => t.id === req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: { message: 'Transaction not found' } });
    }
    
    const cashier = data.users.find(u => u.id === transaction.cashier_id);
    const items = data.transaction_items.filter(i => i.transaction_id === transaction.id);
    
    res.json({
      id: transaction.id,
      timestamp: transaction.timestamp,
      totalAmount: transaction.total_amount,
      taxAmount: transaction.tax_amount,
      paymentMethod: transaction.payment_method,
      cashierId: transaction.cashier_id,
      customerId: transaction.customer_id,
      refundStatus: transaction.refund_status,
      status: transaction.status,
      createdAt: transaction.created_at,
      cashierName: cashier ? cashier.full_name : null,
      items: items.map(i => ({
        id: i.id,
        transactionId: i.transaction_id,
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        totalPrice: i.total_price
      }))
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error loading transaction' } });
  }
});

// GET all alerts
app.get('/api/alerts', async (_req: Request, res: Response) => {
  try {
    const data = await loadData();
    
    const alertsWithProduct = data.alerts.map(a => {
      const product = data.products.find(p => p.id === a.product_id);
      return {
        id: a.id,
        type: a.type,
        severity: a.severity,
        productId: a.product_id,
        productName: product ? product.name : null,
        message: a.message,
        isResolved: a.is_resolved,
        createdAt: a.created_at,
        resolvedAt: a.resolved_at,
        resolvedBy: a.resolved_by
      };
    });
    
    res.json({
      data: alertsWithProduct,
      meta: { page: 1, limit: 20, total: alertsWithProduct.length, totalPages: 1 }
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error loading alerts' } });
  }
});

// GET audit logs
app.get('/api/audit-logs', async (_req: Request, res: Response) => {
  try {
    const data = await loadData();
    
    const logsWithUser = data.audit_logs.map(log => {
      const user = data.users.find(u => u.id === log.user_id);
      return {
        id: log.id,
        userId: log.user_id,
        userName: user ? user.full_name : null,
        action: log.action,
        affectedResourceId: log.affected_resource_id,
        beforeState: log.before_state,
        afterState: log.after_state,
        ipAddress: log.ip_address,
        timestamp: log.timestamp
      };
    });
    
    res.json({
      data: logsWithUser,
      meta: { page: 1, limit: 20, total: logsWithUser.length, totalPages: 1 }
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error loading audit logs' } });
  }
});

// GET reports - Sales summary
app.get('/api/reports/sales-summary', async (req: Request, res: Response) => {
  try {
    const data = await loadData();
    const { startDate, endDate } = req.query;
    
    let transactions = data.transactions.filter(t => t.status === 'completed');
    
    if (startDate) {
      transactions = transactions.filter(t => new Date(t.timestamp) >= new Date(String(startDate)));
    }
    if (endDate) {
      transactions = transactions.filter(t => new Date(t.timestamp) <= new Date(String(endDate)));
    }
    
    const totalRevenue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
    const totalTax = transactions.reduce((sum, t) => sum + t.tax_amount, 0);
    const transactionCount = transactions.length;
    
    // Agrupar por método de pago
    const byPaymentMethod = transactions.reduce((acc: any, t) => {
      if (!acc[t.payment_method]) {
        acc[t.payment_method] = { count: 0, total: 0 };
      }
      acc[t.payment_method].count++;
      acc[t.payment_method].total += t.total_amount;
      return acc;
    }, {});
    
    res.json({
      totalRevenue,
      totalTax,
      transactionCount,
      averageTransaction: transactionCount > 0 ? totalRevenue / transactionCount : 0,
      byPaymentMethod
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Error generating report' } });
  }
});

// ----------------------------------------------------------------
// 404 handler
// ----------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
});

// ----------------------------------------------------------------
// Start server
// ----------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`Nova Salud backend (MOCK MODE) running on port ${PORT}`);
  console.log(`Using JSON data from: backend/src/data/mockData.json`);
  console.log(`CORS enabled for: ${corsOrigin}`);
});

// ----------------------------------------------------------------
// Graceful shutdown
// ----------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down gracefully…`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;
