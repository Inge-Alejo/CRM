import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  conversationLimit: parseInt(process.env.MONTHLY_CONVERSATION_LIMIT || '950', 10),
  meta: {
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    verifyToken: process.env.META_VERIFY_TOKEN || 'udea_medicina_secure_token_2026',
    appSecret: process.env.META_APP_SECRET || ''
  },
  advisor: {
    email: process.env.ADVISOR_NOTIFICATION_EMAIL || 'extensionmedicina@udea.edu.co',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || ''
  },
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyCTwp8PaJvGlTYjJnBV7ktvnDeHd8aYemk',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'crm-fdem.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'crm-fdem',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'crm-fdem.firebasestorage.app',
    appId: process.env.FIREBASE_APP_ID || '1:191713944750:web:f68debb069680dcab8393f'
  },
  postgresUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL || '',
  officeHours: {
    startHour: parseInt(process.env.OFFICE_HOURS_START || '8', 10), // 8:00 a. m.
    endHour: parseInt(process.env.OFFICE_HOURS_END || '17', 10),     // 5:00 p. m.
    days: process.env.OFFICE_DAYS ? process.env.OFFICE_DAYS.split(',').map(Number) : [1, 2, 3, 4, 5], // 1=Lunes, 5=Viernes
    timezone: process.env.TIMEZONE || 'America/Bogota',
    outOfHoursMessage: process.env.OUT_OF_HOURS_MESSAGE || 'Nuestro horario de atención personalizada de asesores es de lunes a viernes de 8:00 a. m. a 5:00 p. m. (hora Colombia). Hemos recibido tu mensaje y será atendido con total prioridad durante nuestro siguiente periodo de servicio. 🩺✨'
  }
};
