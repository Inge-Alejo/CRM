FROM node:20-alpine

# Directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Instalar dependencias del sistema requeridas para compilación de SQLite si aplica
RUN apk add --no-cache python3 make g++

# Copiar manifiestos de paquetes
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev

# Copiar el código fuente completo del proyecto
COPY . .

# Exponer el puerto del servidor CRM
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio del servidor
CMD ["node", "src/server.js"]
