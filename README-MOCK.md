# Nova Salud - Sistema de Farmacia (Versión Mock con JSON)

## Descripción

Esta es una versión simplificada del sistema Nova Salud que **NO requiere base de datos**. Todos los datos se almacenan en archivos JSON para facilitar las pruebas y el desarrollo inicial.

## Requisitos

- Node.js 18 o superior
- npm o yarn

## Instalación y Ejecución

### Backend (Servidor API)

```bash
# 1. Ir a la carpeta backend
cd backend

# 2. Instalar dependencias mínimas
npm install express cors dotenv helmet express-rate-limit
npm install -D typescript @types/node @types/express @types/cors ts-node-dev

# 3. Compilar TypeScript (opcional)
npx tsc src/index.mock.ts --outDir dist --esModuleInterop --resolveJsonModule --skipLibCheck

# 4. Ejecutar en modo desarrollo
npx ts-node-dev --respawn --transpile-only src/index.mock.ts

# O si prefieres compilar primero:
npx tsc && node dist/index.mock.js
```

El servidor estará disponible en: **http://localhost:3000**

### Frontend (Interfaz de Usuario)

```bash
# 1. Ir a la carpeta frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Ejecutar en modo desarrollo
npm run dev
```

El frontend estará disponible en: **http://localhost:5173**

## Datos de Prueba

El archivo `backend/src/data/mockData.json` contiene datos de prueba completos:

### Usuarios (Credenciales)

| Usuario | Contraseña | Rol | Email |
|---------|-----------|-----|-------|
| admin | Admin123! | Administrador | admin@novasalud.com |
| farmaceutico1 | Pharma123! | Farmacéutico | maria.gonzalez@novasalud.com |
| cajero1 | Cashier123! | Cajero | carlos.ramirez@novasalud.com |

**Nota:** Las contraseñas están hasheadas en el JSON. Para autenticación mock, necesitarás implementar un endpoint de login simple.

### Proveedores (3 proveedores)

1. **Laboratorios Farmex S.A.**
   - Email: ventas@farmex.com
   - Teléfono: +34-912-345-678
   - Tiempo de entrega: 5 días

2. **Distribuidora MediPlus**
   - Email: pedidos@mediplus.com
   - Teléfono: +34-913-456-789
   - Tiempo de entrega: 3 días

3. **Pharma Global Import**
   - Email: info@pharmaglobal.com
   - Teléfono: +34-914-567-890
   - Tiempo de entrega: 7 días

### Productos (8 productos)

1. **Paracetamol 500mg** - Stock: 250 unidades - Precio: €0.15
2. **Ibuprofeno 400mg** - Stock: 180 unidades - Precio: €0.25
3. **Amoxicilina 500mg** - Stock: 75 unidades (Stock bajo) - Precio: €0.45
4. **Jarabe para la Tos** - Stock: 45 unidades - Precio: €5.50
5. **Insulina Glargina** - Stock: 25 unidades - Precio: €35.00
6. **Crema Hidrocortisona 1%** - Stock: 60 unidades - Precio: €8.75
7. **Vitamina C 1000mg** - Stock: 320 unidades - Precio: €0.30
8. **Omeprazol 20mg** - Stock: 15 unidades (Stock crítico) - Precio: €0.35

### Transacciones (3 transacciones de ejemplo)

- **tx-001**: €12.50 - Efectivo - 10/05/2024
- **tx-002**: €45.75 - Tarjeta - 10/05/2024
- **tx-003**: €8.40 - Efectivo - 11/05/2024

### Alertas (3 alertas activas)

1. Stock crítico: Omeprazol 20mg (15 unidades)
2. Stock bajo: Amoxicilina 500mg (75 unidades)
3. Producto próximo a vencer: Jarabe para la Tos

## Endpoints API Disponibles

### Salud del Sistema
- `GET /health` - Estado del servidor

### Usuarios
- `GET /api/users` - Listar todos los usuarios

### Productos
- `GET /api/products` - Listar productos
  - Query params: `?search=paracetamol&category=otc&stockLevel=low_stock`

### Proveedores
- `GET /api/suppliers` - Listar proveedores

### Transacciones
- `GET /api/transactions` - Listar transacciones
- `GET /api/transactions/:id` - Detalle de transacción con items

### Alertas
- `GET /api/alerts` - Listar alertas activas

### Reportes
- `GET /api/reports/sales-summary` - Resumen de ventas
  - Query params: `?startDate=2024-05-01&endDate=2024-05-31`

### Auditoría
- `GET /api/audit-logs` - Registro de auditoría

## 🧪 Pruebas con cURL

```bash
# Verificar salud del servidor
curl http://localhost:3000/health

# Listar productos
curl http://localhost:3000/api/products

# Buscar productos con stock bajo
curl "http://localhost:3000/api/products?stockLevel=low_stock"

# Ver transacción específica
curl http://localhost:3000/api/transactions/tx-001

# Obtener resumen de ventas
curl "http://localhost:3000/api/reports/sales-summary?startDate=2024-05-01&endDate=2024-05-31"
```

## Estructura de Archivos

```
backend/
├── src/
│   ├── data/
│   │   └── mockData.json          # Datos de prueba
│   ├── config/
│   │   └── mockDatabase.ts        # Funciones para leer/escribir JSON
│   └── index.mock.ts              # Servidor Express simplificado
├── package.mock.json              # Dependencias mínimas
└── tsconfig.json                  # Configuración TypeScript

frontend/
├── src/
│   ├── components/                # Componentes React
│   ├── services/                  # Llamadas API
│   └── App.tsx                    # Aplicación principal
└── package.json
```

## Configuración

Crea un archivo `.env` en la carpeta `backend`:

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

## Características

- **Sin base de datos** - Todo en JSON  
- **Datos de prueba completos** - Listos para usar  
- **API REST funcional** - Todos los endpoints principales  
- **CORS configurado** - Frontend y backend integrados  
- **Filtros y búsquedas** - Por categoría, stock, fechas  
- **Reportes básicos** - Resumen de ventas  

## Limitaciones

- No hay autenticación real (JWT)
- No hay persistencia entre reinicios (usa JSON en memoria)
- No hay validaciones complejas
- No hay transacciones atómicas
- No hay paginación real (devuelve todos los datos)

## Próximos Pasos

Para migrar a una base de datos real:

1. Instalar MySQL/PostgreSQL
2. Ejecutar scripts de migración en `database/migrations/`
3. Cambiar de `index.mock.ts` a `index.ts`
4. Configurar variables de entorno de base de datos

## 🆘 Solución de Problemas

### Error: "Cannot find module"
```bash
npm install
```

### Puerto 3000 ocupado
Cambia el puerto en `.env`:
```env
PORT=3001
```

### CORS error en el frontend
Verifica que `CORS_ORIGIN` en `.env` coincida con la URL del frontend.

## Soporte

Para preguntas o problemas, revisa la documentación completa en el README principal del proyecto.

---

**¡Listo para empezar!**

Ejecuta el backend y frontend, y tendrás un sistema de farmacia completamente funcional sin necesidad de configurar una base de datos.
