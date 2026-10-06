# 🚀 Guía de Despliegue en la Nube Gratuito - CRM WhatsApp UdeA

Este proyecto está 100% preparado para estar disponible en tiempo real desde cualquier dispositivo (celular, tablet, portátil) sin costo alguno.

---

## Opción 1: Render.com (Recomendada - 100% Gratuita con 1 Clic)

Render ofrece hosting web gratuito con soporte completo para Node.js, SQLite, HTTPS automático y dominio público.

### Pasos:
1. Ve a **[render.com](https://render.com/)** e inicia sesión con tu cuenta de GitHub (`Inge-Alejo`).
2. Haz clic en **"New +"** y selecciona **"Web Service"** (o **"Blueprint"**).
3. Conecta tu repositorio: **`Inge-Alejo/CRM`**.
4. Render detectará automáticamente el archivo `render.yaml` o configúralo con:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Plan:** `Free`
5. *(Opcional)* En **Environment Variables**, añade:
   - `GEMINI_API_KEY`: Tu clave de Google Gemini (si la tienes, o déjala para configurarla desde el panel web).
6. Haz clic en **"Create Web Service"**.
7. En menos de 2 minutos tendrás tu URL pública (ejemplo: `https://crm-whatsapp-udea.onrender.com`), lista para usar desde cualquier lugar.

> **Actualización en Tiempo Real:** Cada vez que hagas `git push` a la rama `main`, Render compilará y actualizará la aplicación automáticamente sin que tengas que hacer nada.

---

## Opción 2: Railway.app (Alternativa Gratuita)

1. Ingresa a **[railway.app](https://railway.app/)** con tu cuenta de GitHub.
2. Selecciona **"New Project"** -> **"Deploy from GitHub repo"** -> Selecciona `CRM`.
3. Railway usará automáticamente el `Dockerfile` incluido.
4. Genera un dominio público en **Settings -> Networking -> Generate Domain**.

---

## Opción 3: Firebase (Google Cloud)

Si deseas utilizar el ecosistema de Firebase:
- **Firebase Hosting** sirve primordialmente para sitios web estáticos (HTML/CSS/JS frontend).
- Para alojar el backend completo con la IA y los Webhooks de WhatsApp, se utiliza **Cloud Functions for Firebase** o **Google Cloud Run**.
- **Base de Datos Cloud:** Si deseas que la base de datos sea compartida en la nube permanentemente entre múltiples instancias sin almacenar en disco local, puedes usar **Cloud Firestore** o **Supabase PostgreSQL** (gratuito). La arquitectura de este CRM tiene la capa de datos desacoplada en `src/db/database.js`, facilitando conectar Firestore con solo agregar las credenciales de Firebase.

---

## 👥 Credenciales de Acceso Inicial para Asesores

| Asesor | Rol | Correo Electrónico | Contraseña por Defecto |
| :--- | :--- | :--- | :--- |
| **Dra. Carolina Martínez** | Coordinadora Posgrados | `carolina.martinez@udea.edu.co` | `UdeA2026*` |
| **Dr. Alejandro Restrepo** | Asesor Educación Continua | `alejandro.restrepo@udea.edu.co` | `UdeA2026*` |
| **Enf. Marcela Gómez** | Asesora Cursos Clínicos | `marcela.gomez@udea.edu.co` | `UdeA2026*` |
| **Lic. David Builes** | Asesor Admisiones | `david.builes@udea.edu.co` | `UdeA2026*` |

*También cuentas con el botón de **acceso rápido de 1 clic** en el modal de inicio de sesión.*
