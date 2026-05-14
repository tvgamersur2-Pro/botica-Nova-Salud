# Instrucciones Rápidas - Nova Salud (Modo Mock)

## Inicio Rápido (3 pasos)

### 1. Instalar Dependencias Backend

```bash
cd backend
npm install express cors dotenv helmet express-rate-limit
npm install -D typescript @types/node @types/express @types/cors ts-node-dev
```

### 2. Ejecutar Backend

```bash
# Desde la carpeta backend/
npx ts-node-dev --respawn --transpile-only src/index.mock.ts
```

Backend corriendo en: **http://localhost:3000**

### 3. Ejecutar Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend corriendo en: **http://localhost:5173**

---

## Probar la API

Abre tu navegador o usa curl:

```bash
# Ver estado del servidor
curl http://localhost:3000/health

# Ver todos los productos
curl http://localhost:3000/api/products

# Ver productos con stock bajo
curl http://localhost:3000/api/products?stockLevel=low_stock

# Ver todas las transacciones
curl http://localhost:3000/api/transactions

# Ver alertas
curl http://localhost:3000/api/alerts
```

---

## Datos Disponibles

### Productos (8 items)
- Paracetamol, Ibuprofeno, Amoxicilina
- Jarabe para la Tos, Insulina, Crema
- Vitamina C, Omeprazol

### Usuarios (3 usuarios)
- admin (Administrador)
- farmaceutico1 (Farmacéutico)
- cajero1 (Cajero)

### Proveedores (3 proveedores)
- Laboratorios Farmex S.A.
- Distribuidora MediPlus
- Pharma Global Import

### Transacciones (3 ventas de ejemplo)
### Alertas (3 alertas activas)

---

## Endpoints Principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del servidor |
| GET | `/api/products` | Lista de productos |
| GET | `/api/suppliers` | Lista de proveedores |
| GET | `/api/transactions` | Lista de transacciones |
| GET | `/api/transactions/:id` | Detalle de transacción |
| GET | `/api/alerts` | Alertas activas |
| GET | `/api/users` | Lista de usuarios |
| GET | `/api/audit-logs` | Registro de auditoría |
| GET | `/api/reports/sales-summary` | Resumen de ventas |

---

## Archivo de Datos

Todos los datos están en:
```
backend/src/data/mockData.json
```

Puedes editar este archivo para agregar o modificar datos.

---

## Configuración Opcional

Crea `.env` en la carpeta `backend/`:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## Detener los Servidores

Presiona `Ctrl + C` en cada terminal donde estén corriendo.

---

## ¡Eso es todo!

Tu sistema de farmacia está corriendo con datos de prueba completos, sin necesidad de configurar una base de datos.

Para más detalles, consulta: **README-MOCK.md**
