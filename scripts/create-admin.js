const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Проверяем, существует ли уже админ
    const existingAdmin = await prisma.admin.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('❌ Администратор с именем "admin" уже существует!');
      console.log('📋 ID:', existingAdmin.id);
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Имя:', existingAdmin.fullName);
      return;
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Создаём администратора
    const admin = await prisma.admin.create({
      data: {
        username: 'admin',
        email: 'admin@bunyodtour.com',
        password: hashedPassword,
        fullName: 'Administrator',
        role: 'admin',
        isActive: true
      }
    });

    console.log('✅ Администратор успешно создан!');
    console.log('📋 ID:', admin.id);
    console.log('👤 Логин: admin');
    console.log('🔑 Пароль: admin123');
    console.log('📧 Email:', admin.email);
    console.log('🎭 Роль:', admin.role);
    console.log('\n🔐 Вы можете войти на странице: /admin-dashboard.html');
  } catch (error) {
    console.error('❌ Ошибка при создании администратора:', error.message);
    if (error.code === 'P2002') {
      console.error('Администратор с таким username или email уже существует');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
