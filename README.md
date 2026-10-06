# 🩺 CRM & WhatsApp Chatbot - Facultad de Medicina UdeA

Sistema completo de **Chatbot Inteligente con IA para WhatsApp y Panel CRM** desarrollado para el **Centro de Extensión de la Facultad de Medicina de la Universidad de Antioquia (UdeA)**.

---

## 🌟 Características Principales

1. **Garantía Anti-Cobros ($0.00 COP / USD):**
   * Meta otorga **1.000 conversaciones de servicio al mes gratis**.
   * El sistema implementa un **Kill-Switch (Interruptor de Corte)** automático calibrado en **950 conversaciones/mes** (un buffer de seguridad del 5%).
   * Al alcanzar el límite, el bot detiene las respuestas salientes automáticamente para que Meta nunca facture un centavo.
   * Monitoreo inteligente de ventanas de **24 horas**: múltiples mensajes de un mismo usuario dentro de su ventana activa no consumen cuota adicional.

2. **Cerebro de IA con Portafolio Real de Medicina UdeA:**
   * Alimentado con la oferta de educación continua: **Diplomado en Urgencias Médicas y Trauma**, **Curso ACLS (AHA)**, **Diplomado en Salud Mental Comunitaria**, **Curso en Auditoría Médica**, **Diplomado en Telemedicina**, etc.
   * **Grounding Estricto (Anti-Alucinaciones):** La IA solo responde con base en la información oficial cargada. Si algo no existe, remite a la oficina de extensión.
   * **Cascada Multimodelo Inteligente y Balanceo:** Alterna automáticamente entre **Gemini 3.5 Flash-Lite**, **Gemini 3.1 Flash-Lite**, **Gemini 3.5 Flash** y **Gemini 3.8 Flash** (`@google/genai`) para multiplicar la cuota gratuita diaria, con respaldo determinista local.

3. **Escalamiento a Asesor Humano (Human Handoff):**
   * Detecta automáticamente solicitudes como *"quiero un asesor"*, *"comunícame con una persona"* o problemas de pago.
   * Dispara una alerta prioritaria en el CRM y registra un enlace directo de WhatsApp (`https://wa.me/...`) para que el asesor responda con un solo clic.

4. **Web Crawler y Sincronizador en Vivo (`extension.medicinaudea.co`):**
   * Extrae en tiempo real los eventos, cursos y diplomados oficiales vigentes de la Facultad de Medicina.
   * Obtiene y almacena los enlaces directos a las páginas específicas de cada evento (`/eventos/{slug}/`).
   * Permite sincronización automática con un solo clic desde el panel con deduplicación transparente.

5. **Simulador / Sandbox Interactivo en Vivo:**
   * Permite probar **todo el flujo en tu navegador sin tener la API de WhatsApp de Meta aún configurada**.
   * Replica el comportamiento exacto de producción con detección de intenciones y cálculo de ventanas de 24 horas.

6. **Ciberseguridad y Calidad Senior:**
   * **HMAC-SHA256 Timing Attack Safe:** Validación criptográfica de la cabecera `X-Hub-Signature-256` con protección contra buffers de distinta longitud.
   * **Prevención de Stored XSS:** Sanitización estricta de entradas y escape de entidades HTML en el frontend.
   * **Mitigación de Prompt Injection:** Filtro de sanitización y aislamiento de instrucciones del sistema.
   * **Rate Limiting Automático:** Limitador de tasa por IP con recolección de basura periódica en memoria para evitar memory leaks.
   * **Seguridad SQL & Índices:** Consultas 100% parametrizadas e índices compuestos sobre SQLite (`node:sqlite`).
   * **Cabeceras de Seguridad:** CSP estricto, X-Frame-Options, X-Content-Type-Options y Referrer-Policy.
   * **Cierre Elegante:** Controladores para `SIGINT` y `SIGTERM` que garantizan el vaciado y cierre seguro de SQLite WAL.

---

## 🚀 Cómo Iniciar el Proyecto Localmente

El servidor ya está inicializado y corriendo localmente en:
👉 **`http://localhost:3000`**

Para iniciarlo manualmente en cualquier momento desde la terminal:

```bash
cd crm-whatsapp-udea
npm start
```

---

## 📦 Instrucciones para Subir a Git (GitHub / GitLab)

El proyecto incluye `.gitignore` configurado para proteger bases de datos locales, dependencias y credenciales de entorno.

1. **Inicializar el repositorio local:**
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit - CRM & WhatsApp Chatbot Facultad de Medicina UdeA"
   ```

2. **Vincular y subir a tu repositorio remoto:**
   ```bash
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/crm-whatsapp-udea.git
   git push -u origin main
   ```

---

## 📁 Estructura del Proyecto (Arquitectura Hexagonal)

```
crm-whatsapp-udea/
├── public/                     # Frontend del CRM Dashboard
│   ├── index.html              # Interfaz con paleta institucional UdeA
│   ├── style.css               # Estilos y mockup de WhatsApp
│   └── app.js                  # Lógica reactiva, sanitización XSS y telemetría
├── src/
│   ├── adapters/
│   │   ├── metaCloudAdapter.js # Webhook oficial de WhatsApp Cloud API (Meta)
│   │   └── simulatorAdapter.js # Adaptador para el simulador web en vivo
│   ├── ai/
│   │   └── geminiService.js    # Conexión con Gemini 2.5 Flash y motor local
│   ├── db/
│   │   └── database.js         # SQLite nativo (node:sqlite) e índices optimizados
│   ├── domain/
│   │   ├── conversationTracker.js # Kill-Switch y control de ventanas de 24h
│   │   ├── leadService.js      # Gestión de prospectos y mensajes
│   │   ├── knowledgeBase.js    # Portafolio oficial de Medicina UdeA
│   │   ├── scraperService.js   # Crawler web en vivo y deduplicación
│   │   └── notifier.js         # Alertas de asesores y deep-links
│   ├── security/
│   │   ├── guardrails.js       # Sanitización y anti-prompt injection
│   │   ├── signature.js        # Verificación HMAC-SHA256 timing-safe
│   │   └── rateLimiter.js      # Limitador DoS con auto-cleanup
│   ├── config.js               # Variables de entorno
│   └── server.js               # Servidor Express, CSP y graceful shutdown
├── .env.example                # Plantilla de variables de entorno segura
├── .gitignore                  # Exclusión de secretos, base de datos y node_modules
├── package.json
└── README.md
```
