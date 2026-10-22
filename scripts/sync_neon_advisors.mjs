import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function sync() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log('No POSTGRES_URL');
    return;
  }
  const sql = neon(url);

  const advisors = [
    { name: 'Administrador General TIC', role: 'Super Administrador TIC', role_type: 'admin', email: 'proyectostic.med@udea.edu.co', password: 'UdeA2026*', phone: '+57 300 000 0000', avatar: 'TIC' },
    { name: 'Dra. Carolina Martínez', role: 'Coordinadora de Educación Médica Continua', role_type: 'advisor', email: 'carolina.martinez@udea.edu.co', password: 'UdeA2026*', phone: '+57 300 456 7890', avatar: 'CM' },
    { name: 'Dr. Alejandro Gómez', role: 'Líder Simulación Clínica y Urgencias', role_type: 'advisor', email: 'alejandro.gomez@udea.edu.co', password: 'UdeA2026*', phone: '+57 311 234 5678', avatar: 'AG' },
    { name: 'Lic. Valeria Restrepo', role: 'Especialista en Admisiones y Matrículas', role_type: 'advisor', email: 'valeria.restrepo@udea.edu.co', password: 'UdeA2026*', phone: '+57 315 678 9012', avatar: 'VR' },
    { name: 'Dr. Felipe Morales', role: 'Asesor de Posgrados y Diplomados Clínicos', role_type: 'advisor', email: 'felipe.morales@udea.edu.co', password: 'UdeA2026*', phone: '+57 320 890 1234', avatar: 'FM' },
    { name: 'Dr. Santiago Duque', role: 'Asesor Farmacología y Urgencias', role_type: 'advisor', email: 'santiago.duque@udea.edu.co', password: 'UdeA2026*', phone: '+57 312 987 6543', avatar: 'DS' },
    { name: 'Centro de Extensión Medicina', role: 'Asesor Institucional de Extensión', role_type: 'advisor', email: 'extensionmedicina@udea.edu.co', password: 'UdeA2026*', phone: '+57 300 123 4567', avatar: 'EM' },
    { name: 'Dra. Andrea Gómez', role: 'Asesor de Extensión UdeA', role_type: 'advisor', email: 'asesor.medicina@udea.edu.co', password: 'UdeA2026*', phone: '+57 300 000 0000', avatar: 'AG' }
  ];

  for (const a of advisors) {
    const cleanEmail = a.email.toLowerCase();
    const existing = await sql`SELECT id FROM advisors WHERE LOWER(email) = ${cleanEmail} LIMIT 1;`;
    if (existing.length > 0) {
      await sql`
        UPDATE advisors 
        SET name = ${a.name}, role = ${a.role}, role_type = ${a.role_type}, 
            password = ${a.password}, phone = ${a.phone}, avatar = ${a.avatar}, is_active = 1
        WHERE id = ${existing[0].id};
      `;
    } else {
      await sql`
        INSERT INTO advisors (name, role, role_type, email, password, phone, avatar, is_active)
        VALUES (${a.name}, ${a.role}, ${a.role_type}, ${a.email}, ${a.password}, ${a.phone}, ${a.avatar}, 1);
      `;
    }
  }

  const all = await sql`SELECT id, name, email, password, role_type FROM advisors ORDER BY id ASC;`;
  console.log('✅ Asesores sincronizados en Neon Postgres:', all.length, 'asesores activos.');
}

sync().catch(console.error);
