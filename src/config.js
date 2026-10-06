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
  }
};
