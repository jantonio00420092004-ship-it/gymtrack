# GymTrack — Guía de despliegue

## Paso 1 — Subir el código a GitHub

1. Ve a https://github.com/new y crea un repo llamado `gymtrack` (privado o público)
2. Abre PowerShell y ejecuta:

```powershell
cd "C:\Users\konica\OneDrive\Documentos\codigo\workout-tracker"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/gymtrack.git
git push -u origin main
```

Reemplaza `TU_USUARIO` con tu usuario de GitHub.

---

## Paso 2 — Desplegar en Render (gratis)

1. Ve a https://render.com y crea una cuenta gratuita
2. Clic en **New → Web Service**
3. Conecta tu cuenta de GitHub y selecciona el repo `gymtrack`
4. Render detectará el `render.yaml` automáticamente
5. Haz clic en **Create Web Service**

La app tardará ~2 minutos en desplegarse.
Te dará una URL tipo: `https://gymtrack-xxxx.onrender.com`

### Importante: activar el disco persistente
En el panel de Render, ve a tu servicio → **Disks** y verifica que el disco `/data` esté creado.
Esto garantiza que tus datos NO se borren entre deploys.

---

## Paso 3 — Usar desde cualquier dispositivo

Abre la URL de Render desde tu teléfono o computadora.
Puedes guardarla como acceso directo en la pantalla de inicio del teléfono:
- **iPhone**: Safari → Compartir → "Añadir a pantalla de inicio"
- **Android**: Chrome → Menú → "Añadir a pantalla de inicio"

---

## Actualizar la app en el futuro

Si haces cambios al código:
```powershell
cd "C:\Users\konica\OneDrive\Documentos\codigo\workout-tracker"
git add .
git commit -m "Descripción del cambio"
git push
```

Render redesplegará automáticamente.
