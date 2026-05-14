# Nova Salud - Sistema de Gestión Farmacéutica

Sistema web full stack para la gestión integral de inventario, ventas y atención al cliente en boticas y farmacias.

## Descripción

Nova Salud es una solución completa que permite a las boticas gestionar de manera eficiente su inventario, procesar ventas, controlar proveedores y generar reportes, todo desde una interfaz web moderna e intuitiva.

## Características Principales

### Autenticación y Seguridad
- Sistema de login con JWT (access + refresh tokens)
- Tres niveles de usuario: Administrador, Farmacéutico y Cajero
- Encriptación de contraseñas con bcrypt
- Control de acceso basado en roles (RBAC)
- Registro de auditoría completo

### Gestión de Inventario
- Control de stock en tiempo real
- Alertas automáticas de stock bajo y crítico
- Gestión de fechas de vencimiento
- Categorización de productos (OTC, Prescripción, General)
- Búsqueda y filtros avanzados

### Punto de Venta (POS)
- Interfaz intuitiva de carrito de compras
- Búsqueda rápida de productos
- Cálculo automático de totales e impuestos (18% IGV)
- Múltiples métodos de pago (Efectivo, Tarjeta)
- Actualización automática de stock

### Reportes y Análisis
- Resumen de ventas por período
- Análisis por método de pago
- Dashboard de alertas
- Historial completo de transacciones

### Gestión de Usuarios
- Creación y edición de usuarios
- Asignación de roles y permisos
- Activación/desactivación de cuentas
- Registro de última conexión

### Gestión de Proveedores
- Base de datos de proveedores
- Información de contacto y tiempos de entrega
- Asociación de productos con proveedores

## Tecnologías Utilizadas

### Frontend
- **React 18** con TypeScript
- **Vite** - Build tool
- **Tailwind CSS** - Estilos
- **React Router** - Navegación
- **Axios** - Cliente HTTP
- **Heroicons** - Iconografía

### Backend
- **Node.js** con Express
- **TypeScript**
- **MySQL/PostgreSQL** - Base de datos
- **JWT** - Autenticación
- **Bcrypt** - Encriptación
- **Helmet** - Seguridad HTTP
- **Winston** - Logging

## Estructura del Proyecto

```
nova-salud/
├── frontend/                 # Aplicación React
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── services/        # Servicios API
│   │   ├── types/           # Tipos TypeScript
│   │   └── App.tsx          # Componente principal
│   └── package.json
│
├── backend/                  # API REST
│   ├── src/
│   │   ├── config/          # Configuraciones
│   │   ├── middleware/      # Middlewares Express
│   │   ├── routes/          # Rutas API
│   │   ├── services/        # Lógica de negocio
│   │   ├── types/           # Tipos TypeScript
│   │   └── index.ts         # Punto de entrada
│   └── package.json
│
├── database/                 # Scripts SQL
│   └── migrations/          # Migraciones
│
└── README.md
```

## Instalación y Configuración

### Requisitos Previos
- Node.js 18 o superior
- MySQL 8.0 o PostgreSQL 14+
- npm o yarn

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/nova-salud.git
cd nova-salud
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

Crear archivo `.env`:

```env
PORT=3000
NODE_ENV=development

# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nova_salud
DB_USER=root
DB_PASSWORD=tu_password

# JWT
JWT_SECRET=tu_secreto_super_seguro_aqui
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Seguridad
BCRYPT_ROUNDS=12
```

Ejecutar migraciones:

```bash
# Conectar a MySQL y ejecutar los scripts en orden:
mysql -u root -p nova_salud < ../database/migrations/001_initial_schema.sql
mysql -u root -p nova_salud < ../database/migrations/002_indexes.sql
mysql -u root -p nova_salud < ../database/migrations/003_auth_lockout.sql
```

Iniciar servidor:

```bash
npm run dev
```

El backend estará disponible en: `http://localhost:3000`

### 3. Configurar Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

## Usuarios de Prueba

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | Admin123! | Administrador |
| farmaceutico1 | Pharma123! | Farmacéutico |
| cajero1 | Cashier123! | Cajero |

## Modo Mock (Sin Base de Datos)

Para desarrollo y pruebas rápidas sin configurar base de datos:

```bash
cd backend
npx ts-node-dev --respawn --transpile-only src/index.mock.ts
```

Este modo utiliza datos en JSON y es ideal para:
- Desarrollo del frontend
- Pruebas de interfaz
- Demostraciones
- Desarrollo sin dependencias

## Seguridad

- Autenticación JWT con tokens de acceso y refresco
- Contraseñas encriptadas con bcrypt (12 rounds)
- Rate limiting (100 req/15min)
- Headers de seguridad con Helmet
- Validación de entrada de datos
- Control de acceso basado en roles
- Registro de auditoría completo

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `POST /api/auth/refresh` - Refrescar token

### Productos
- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto

### Usuarios
- `GET /api/users` - Listar usuarios
- `GET /api/users/:id` - Obtener usuario
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Desactivar usuario

### Transacciones
- `GET /api/transactions` - Listar transacciones
- `GET /api/transactions/:id` - Obtener transacción
- `POST /api/transactions` - Crear transacción

### Alertas
- `GET /api/alerts` - Listar alertas
- `PUT /api/alerts/:id/resolve` - Resolver alerta

### Reportes
- `GET /api/reports/sales-summary` - Resumen de ventas

## Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## Build para Producción

### Frontend
```bash
cd frontend
npm run build
```

Los archivos optimizados estarán en `frontend/dist/`

### Backend
```bash
cd backend
npm run build
```

Los archivos compilados estarán en `backend/dist/`

## Despliegue

### Opción 1: Servidor VPS

1. Configurar Nginx como proxy reverso
2. Usar PM2 para gestionar el proceso Node.js
3. Configurar SSL con Let's Encrypt
4. Configurar base de datos MySQL/PostgreSQL

### Opción 2: Servicios Cloud

- **Frontend:** Vercel, Netlify, AWS S3 + CloudFront
- **Backend:** Heroku, Railway, AWS EC2, DigitalOcean
- **Base de datos:** AWS RDS, DigitalOcean Managed Database

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto es parte de un trabajo académico para el curso de Fullstack Developer Software.

## Autor

**[jesusluero]**
- GitHub: https://github.com/tvgamersur2-Pro/
- Email: tvgamersur2@gmail.com

## Agradecimientos

- Instituto [Senati]
- Curso: Fullstack Developer Software
- Profesor: [Mg. Fernando Miguel Pisfil Ortiz]

---

Si este proyecto te fue útil, considera darle una estrella en GitHub!
