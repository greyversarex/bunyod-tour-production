import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function updateAdmin() {
  const username = 'admin';
  const password = 'admin123';
  const email = 'admin@bunyod-tour.tj';
  
  console.log('🔐 Обновление учетных данных администратора...');
  console.log(`⚠️  ВНИМАНИЕ: Пароль "${password}" слишком простой!`);
  console.log('⚠️  Рекомендуется сменить пароль после первого входа.');
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const admin = await prisma.admin.upsert({
    where: { username },
    update: {
      password: hashedPassword,
      email,
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true
    },
    create: {
      username,
      email,
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'admin',
      isActive: true
    }
  });
  
  console.log('✅ Администратор успешно создан/обновлен!');
  console.log(`👤 Логин: ${admin.username}`);
  console.log(`📧 Email: ${admin.email}`);
  console.log(`🔑 Пароль: ${password}`);
  console.log('\n🔗 Ссылка для входа: http://localhost:5000/admin-dashboard.html');
}

updateAdmin()
  .catch((e) => {
    console.error('❌ Ошибка при обновлении администратора:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
