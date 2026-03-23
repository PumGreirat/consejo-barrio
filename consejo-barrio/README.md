# Consejo de Barrio — App Web

Sistema de reportes para el Consejo de Barrio.  
**Stack:** Next.js 14 + Supabase + Vercel — todo gratis.

---

## ⚡ Configuración en 4 pasos (sin instalar nada)

### PASO 1 — Crear la base de datos en Supabase (5 min)

1. Ve a **https://supabase.com** → "Start for free"
2. Crea una cuenta (puedes usar Google)
3. Clic en **"New project"**
   - Nombre: `consejo-barrio`
   - Contraseña de DB: (guárdala, no la necesitarás)
   - Región: la más cercana a ti
4. Espera ~2 minutos a que se cree el proyecto
5. En el menú izquierdo ve a **SQL Editor**
6. Copia y pega **todo** el contenido del archivo `supabase/migrations/001_schema.sql`
7. Clic en **"Run"** (botón verde)
8. Deberías ver: "Success. No rows returned"

**Obtener tus credenciales:**
- Ve a ⚙️ **Project Settings** → **API**
- Copia:
  - `Project URL` → esto es tu `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → esto es tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

### PASO 2 — Subir el código a GitHub (3 min)

1. Ve a **https://github.com** → crea una cuenta si no tienes
2. Clic en **"New repository"**
   - Nombre: `consejo-barrio`
   - Privado o público (da igual)
3. **Sube todos los archivos de esta carpeta** al repositorio
   - Opción fácil: arrastra y suelta los archivos en la interfaz web de GitHub
   - O usa GitHub Desktop si lo tienes

---

### PASO 3 — Desplegar en Vercel (3 min)

1. Ve a **https://vercel.com** → "Start Deploying"
2. Conecta con tu cuenta de GitHub
3. Clic en **"Import"** junto a tu repositorio `consejo-barrio`
4. En **"Environment Variables"** añade:
   ```
   NEXT_PUBLIC_SUPABASE_URL = (pega tu Project URL de Supabase)
   NEXT_PUBLIC_SUPABASE_ANON_KEY = (pega tu anon key de Supabase)
   ```
5. Clic en **"Deploy"**
6. Espera ~2 minutos
7. ¡Tu app estará en una URL tipo `consejo-barrio.vercel.app`!

---

### PASO 4 — Configurar autenticación en Supabase (2 min)

1. En Supabase ve a **Authentication** → **URL Configuration**
2. En **"Site URL"** pon tu URL de Vercel: `https://consejo-barrio.vercel.app`
3. En **"Redirect URLs"** añade: `https://consejo-barrio.vercel.app/**`
4. Guarda

---

## ✅ ¡Listo! Así usas la app

1. Abre tu URL de Vercel en el navegador
2. Clic en **"Regístrate aquí"**
3. Cada líder crea su cuenta con su nombre, correo y llamamiento
4. ¡Listo para usar!

---

## 👥 Roles y accesos

| Rol | Puede hacer |
|-----|-------------|
| **Obispado** (obispo, consejeros, secretarios) | Ver todos los reportes publicados, Vista del Consejo, Panel de notificaciones |
| **Presidencias** (S. Socorro, M. Jóvenes, etc.) | Ver y editar solo sus propios reportes |

---

## 📱 Funciona en celular

La app es responsive — cualquier líder puede abrirla desde su teléfono.

---

## 🆓 Costos

- **Supabase Free tier:** hasta 500MB de DB, 50,000 usuarios activos/mes → suficiente para cualquier barrio
- **Vercel Free tier:** hosting gratis, sin límite de visitas para proyectos personales

No necesitas tarjeta de crédito para ninguno.
