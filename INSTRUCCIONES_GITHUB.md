# INSTRUCCIONES PARA SUBIR EL PROYECTO A GITHUB

## Paso a Paso Completo

### Paso 1: Preparar el Proyecto

Asegúrate de estar en la carpeta raíz del proyecto:
```bash
cd D:\P01-ING-SW\botica
```

### Paso 2: Verificar que Git esté instalado

```bash
git --version
```

Si no está instalado, descárgalo de: https://git-scm.com/

### Paso 3: Inicializar Git (si no está inicializado)

```bash
git init
```

### Paso 4: Configurar tu identidad en Git (primera vez)

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@ejemplo.com"
```

### Paso 5: Verificar archivos a subir

```bash
git status
```

Deberías ver todos los archivos del proyecto. El `.gitignore` ya está configurado para excluir:
- node_modules/
- .env
- logs/
- archivos temporales

### Paso 6: Agregar todos los archivos

```bash
git add .
```

### Paso 7: Hacer el primer commit

```bash
git commit -m "Initial commit: Sistema Nova Salud - Gestión de Inventario y Ventas para Boticas"
```

### Paso 8: Crear repositorio en GitHub

1. Ve a: https://github.com/new
2. Completa los datos:
   - **Repository name:** `nova-salud-sistema-farmacia`
   - **Description:** `Sistema web full stack para gestión de inventario y ventas en boticas. Proyecto final del curso Fullstack Developer Software.`
   - **Visibilidad:** 
     - **Public** (si quieres que sea visible para todos)
     - **Private** (si solo tú y colaboradores pueden verlo)
   - **NO marques:** "Initialize this repository with a README"
   - **NO agregues:** .gitignore ni license (ya los tienes)

3. Click en **"Create repository"**

### Paso 9: Conectar tu proyecto local con GitHub

Copia el comando que GitHub te muestra (algo como):

```bash
git remote add origin https://github.com/TU-USUARIO/nova-salud-sistema-farmacia.git
```

Reemplaza `TU-USUARIO` con tu nombre de usuario de GitHub.

### Paso 10: Cambiar a la rama main

```bash
git branch -M main
```

### Paso 11: Subir el proyecto a GitHub

```bash
git push -u origin main
```

Te pedirá tus credenciales de GitHub:
- **Username:** tu usuario de GitHub
- **Password:** tu token de acceso personal (no tu contraseña)

#### ¿Cómo obtener un token de acceso?

1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token" → "Generate new token (classic)"
3. Dale un nombre: "Nova Salud Project"
4. Selecciona los permisos: `repo` (todos los sub-permisos)
5. Click en "Generate token"
6. **COPIA EL TOKEN** (no podrás verlo de nuevo)
7. Usa este token como contraseña cuando Git te lo pida

### Paso 12: Verificar que todo se subió correctamente

1. Ve a tu repositorio en GitHub: `https://github.com/TU-USUARIO/nova-salud-sistema-farmacia`
2. Deberías ver:
   - Todos los archivos del proyecto
   - El README.md renderizado en la página principal
   - Las carpetas frontend/ y backend/
   - Los archivos de documentación

---

## Estructura que se subirá a GitHub

```
nova-salud-sistema-farmacia/
├── .gitignore                      (Excluye archivos innecesarios)
├── README.md                       (Documentación principal)
├── DOCUMENTACION_PROYECTO.md       (Documentación técnica completa)
├── DIAGRAMAS.md                    (Diagramas del sistema)
├── RESUMEN_EJECUTIVO.md            (Resumen del proyecto)
├── INSTRUCCIONES_GITHUB.md         (Esta guía)
├── INSTRUCCIONES-RAPIDAS.md        (Guía rápida de uso)
├── README-MOCK.md                  (Documentación modo mock)
├── .env.example                    (Ejemplo de variables de entorno)
│
├── frontend/                       (Aplicación React)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/                        (API Node.js)
│   ├── src/
│   ├── package.json
│   └── ...
│
└── database/                       (Scripts SQL)
    └── migrations/
```

**NO se subirán (gracias al .gitignore):**
- node_modules/
- .env (datos sensibles)
- logs/
- dist/ y build/

---

## Comandos útiles para el futuro

### Hacer cambios y subirlos

```bash
# 1. Ver qué archivos cambiaron
git status

# 2. Agregar los cambios
git add .

# 3. Hacer commit con mensaje descriptivo
git commit -m "Descripción de los cambios"

# 4. Subir a GitHub
git push
```

### Ver el historial de commits

```bash
git log --oneline
```

### Crear una nueva rama (para features)

```bash
git checkout -b feature/nueva-funcionalidad
```

### Volver a la rama main

```bash
git checkout main
```

---

## Personalizar tu repositorio en GitHub

### Agregar Topics (etiquetas)

1. Ve a tu repositorio en GitHub
2. Click en el icono de configuración junto a "About"
3. Agrega topics:
   - `react`
   - `typescript`
   - `nodejs`
   - `express`
   - `mysql`
   - `fullstack`
   - `pharmacy-management`
   - `inventory-system`
   - `pos-system`

### Agregar descripción

En la misma sección "About", agrega:
```
Sistema web full stack para gestión de inventario y ventas en boticas. 
Incluye POS, alertas automáticas, reportes y control de usuarios.
```

### Agregar website (si lo despliegas)

Si despliegas el proyecto, agrega la URL en "Website"

---

## Verificar que el README se vea bien

1. Ve a tu repositorio
2. Scroll hacia abajo
3. Deberías ver el README.md renderizado con:
   - Título y descripción
   - Badges (si los agregaste)
   - Características
   - Tecnologías
   - Instrucciones de instalación
   - Capturas de pantalla (si las agregaste)

---

## Solución de Problemas

### Error: "remote origin already exists"

```bash
git remote remove origin
git remote add origin https://github.com/TU-USUARIO/nova-salud-sistema-farmacia.git
```

### Error: "failed to push some refs"

```bash
git pull origin main --rebase
git push origin main
```

### Error: "Authentication failed"

- Asegúrate de usar un **token de acceso personal**, no tu contraseña
- Genera uno nuevo en: https://github.com/settings/tokens

### Olvidé agregar el .gitignore antes del primer commit

```bash
# Crear .gitignore
# Luego:
git rm -r --cached .
git add .
git commit -m "Add .gitignore"
git push
```

---

## Checklist Final

Antes de entregar, verifica:

- [ ] El proyecto está en GitHub
- [ ] El README.md se ve correctamente
- [ ] Todos los archivos importantes están subidos
- [ ] NO se subieron archivos sensibles (.env, node_modules)
- [ ] La documentación está completa
- [ ] Los diagramas están incluidos
- [ ] Las instrucciones de instalación son claras
- [ ] El repositorio tiene una descripción
- [ ] El repositorio tiene topics/etiquetas

---

## Para Entregar el Trabajo

Proporciona a tu profesor:

1. **URL del repositorio GitHub:**
   ```
   https://github.com/TU-USUARIO/nova-salud-sistema-farmacia
   ```

2. **Archivos de documentación:**
   - DOCUMENTACION_PROYECTO.md
   - DIAGRAMAS.md
   - RESUMEN_EJECUTIVO.md

3. **Instrucciones para ejecutar:**
   - Ver README.md en el repositorio
   - O INSTRUCCIONES-RAPIDAS.md para modo mock

---

## ¡Listo!

Tu proyecto está ahora en GitHub y listo para ser evaluado.

**Recuerda:** Puedes seguir haciendo cambios y subirlos con:
```bash
git add .
git commit -m "Descripción del cambio"
git push
```

---

**¿Necesitas ayuda?**
- Documentación de Git: https://git-scm.com/doc
- Guías de GitHub: https://guides.github.com/
