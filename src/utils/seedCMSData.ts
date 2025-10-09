import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function seedCMSData() {
  try {
    console.log('🌱 Seeding CMS data...');

    // 1. Создать администратора по умолчанию
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    try {
      await prisma.admin.create({
        data: {
          username: 'admin',
          email: 'admin@bunyod-tour.com',
          password: hashedPassword,
          fullName: 'Главный администратор',
          role: 'admin'
        }
      });
      console.log('✅ Admin user created');
    } catch (error) {
      console.log('⚠️ Admin user already exists');
    }

    // 2. Создать блоки контента для главной страницы
    const contentBlocks = [
      {
        key: 'hero_title',
        title: JSON.stringify({
          ru: 'Bunyod-Tour: Откройте для себя Таджикистан',
          en: 'Bunyod-Tour: Discover Tajikistan',
          tj: 'Bunyod-Tour: Тоҷикистонро кашф кунед',
          fa: 'Bunyod-Tour: تاجیکستان را کشف کنید',
          de: 'Bunyod-Tour: Entdecken Sie Tadschikistan',
          zh: 'Bunyod-Tour: 发现塔吉克斯坦'
        }),
        content: JSON.stringify({
          ru: 'Bunyod-Tour: Откройте для себя Таджикистан',
          en: 'Bunyod-Tour: Discover Tajikistan',
          tj: 'Bunyod-Tour: Тоҷикистонро кашф кунед',
          fa: 'Bunyod-Tour: تاجیکستان را کشف کنید',
          de: 'Bunyod-Tour: Entdecken Sie Tadschikistan',
          zh: 'Bunyod-Tour: 发现塔吉克斯坦'
        }),
        type: 'text',
        section: 'hero',
        sortOrder: 1
      },
      {
        key: 'hero_subtitle',
        title: JSON.stringify({
          ru: 'Подзаголовок героя',
          en: 'Hero Subtitle',
          tj: 'Зерсарлавҳаи қаҳрамон',
          fa: 'زیرعنوان قهرمان',
          de: 'Hero-Untertitel',
          zh: '英雄副标题'
        }),
        content: JSON.stringify({
          ru: 'Погрузитесь в мир удивительных приключений',
          en: 'Immerse yourself in the world of amazing adventures',
          tj: 'Худро ба олами саргузаштҳои ҳайратовар ғарқ кунед',
          fa: 'خود را در دنیای ماجراجویی های شگفت انگیز غرق کنید',
          de: 'Tauchen Sie ein in die Welt erstaunlicher Abenteuer',
          zh: '沉浸在令人惊叹的冒险世界中'
        }),
        type: 'text',
        section: 'hero',
        sortOrder: 2
      },
      {
        key: 'tours_section_title',
        title: JSON.stringify({
          ru: 'Заголовок секции туров',
          en: 'Tours Section Title',
          tj: 'Сарлавҳаи қисми турҳо',
          fa: 'عنوان بخش تورها',
          de: 'Touren-Bereich Titel',
          zh: '旅游版块标题'
        }),
        content: JSON.stringify({
          ru: 'Рекомендуемые туры по Таджикистану',
          en: 'Recommended Tours in Tajikistan',
          tj: 'Турҳои тавсияшуда дар Тоҷикистон',
          fa: 'تورهای توصیه شده در تاجیکستان',
          de: 'Empfohlene Touren in Tadschikistan',
          zh: '塔吉克斯坦推荐旅游'
        }),
        type: 'text',
        section: 'tours',
        sortOrder: 1
      },
      {
        key: 'planning_flexibility_title',
        title: JSON.stringify({
          ru: 'Заголовок блока гибкого планирования',
          en: 'Planning Flexibility Title',
          tj: 'Сарлавҳаи блоки нақшагирии чандир',
          fa: 'عنوان انعطاف پذیری برنامه ریزی',
          de: 'Planungsflexibilität Titel',
          zh: '规划灵活性标题'
        }),
        content: JSON.stringify({
          ru: 'Планируйте гибко',
          en: 'Plan Flexibly',
          tj: 'Чандир нақша кашед',
          fa: 'برنامه ریزی انعطاف پذیر',
          de: 'Flexibel planen',
          zh: '灵活规划'
        }),
        type: 'text',
        section: 'features',
        sortOrder: 1
      },
      {
        key: 'planning_flexibility_desc',
        title: JSON.stringify({
          ru: 'Описание блока гибкого планирования',
          en: 'Planning Flexibility Description',
          tj: 'Тавсифи блоки нақшагирии чандир',
          fa: 'توضیحات انعطاف پذیری برنامه ریزی',
          de: 'Beschreibung der Planungsflexibilität',
          zh: '规划灵活性描述'
        }),
        content: JSON.stringify({
          ru: 'Используйте функцию "Забронировать сейчас и оплатить позже", чтобы забронировать активности без предварительной оплаты.',
          en: 'Use the "Book now and pay later" feature to book activities without upfront payment.',
          tj: 'Барои банд кардани фаъолиятҳо бе пардохти пешакӣ функсияи "Ҳозир банд кунед ва баъдан пардоҳт кунед"-ро истифода баред.',
          fa: 'از ویژگی "همین الان رزرو کنید و بعداً پرداخت کنید" برای رزرو فعالیت ها بدون پرداخت پیشین استفاده کنید.',
          de: 'Nutzen Sie die Funktion "Jetzt buchen und später bezahlen", um Aktivitäten ohne Vorauszahlung zu buchen.',
          zh: '使用"现在预订，稍后付款"功能预订活动，无需预付款。'
        }),
        type: 'text',
        section: 'features',
        sortOrder: 2
      }
    ];

    for (const block of contentBlocks) {
      try {
        await prisma.contentBlock.create({ data: block });
      } catch (error) {
        console.log(`⚠️ Content block ${block.key} already exists`);
      }
    }
    console.log('✅ Content blocks created');

    // 3. Создать настройки сайта
    const siteSettings = [
      {
        key: 'site_name',
        value: JSON.stringify({
          ru: 'Bunyod-Tour',
          en: 'Bunyod-Tour',
          tj: 'Bunyod-Tour',
          fa: 'Bunyod-Tour',
          de: 'Bunyod-Tour',
          zh: 'Bunyod-Tour'
        }),
        type: 'json',
        group: 'general',
        label: JSON.stringify({
          ru: 'Название сайта',
          en: 'Site Name',
          tj: 'Номи сайт',
          fa: 'نام سایت',
          de: 'Name der Website',
          zh: '网站名称'
        })
      },
      {
        key: 'contact_email',
        value: 'info@bunyod-tour.com',
        type: 'email',
        group: 'contact',
        label: JSON.stringify({
          ru: 'Контактный email',
          en: 'Contact Email',
          tj: 'Почтаи тамос',
          fa: 'ایمیل تماس',
          de: 'Kontakt E-Mail',
          zh: '联系邮箱'
        })
      },
      {
        key: 'contact_phone',
        value: '+992 123 456 789',
        type: 'text',
        group: 'contact',
        label: JSON.stringify({
          ru: 'Телефон',
          en: 'Phone',
          tj: 'Телефон',
          fa: 'تلفن',
          de: 'Telefon',
          zh: '电话'
        })
      },
      {
        key: 'logo_url',
        value: '/Logo-Ru_1754635713718.png',
        type: 'url',
        group: 'general',
        label: JSON.stringify({
          ru: 'URL логотипа',
          en: 'Logo URL',
          tj: 'URL-и логотип',
          fa: 'URL لوگو',
          de: 'Logo-URL',
          zh: '徽标网址'
        })
      }
    ];

    for (const setting of siteSettings) {
      try {
        await prisma.siteSetting.upsert({
          where: { key: setting.key },
          update: setting,
          create: setting
        });
      } catch (error) {
        console.log(`⚠️ Site setting ${setting.key} update failed`);
      }
    }
    console.log('✅ Site settings created');

    // 4. Создать страницы
    const pages = [
      {
        slug: 'about-us',
        title: JSON.stringify({
          ru: 'О нас',
          en: 'About Us',
          tj: 'Дар бораи мо',
          fa: 'درباره ما',
          de: 'Über uns',
          zh: '关于我们'
        }),
        content: JSON.stringify({
          ru: '<h1>О нас</h1><p>Bunyod-Tour - ведущая туристическая компания в Таджикистане.</p>',
          en: '<h1>About Us</h1><p>Bunyod-Tour is a leading tourism company in Tajikistan.</p>',
          tj: '<h1>Дар бораи мо</h1><p>Bunyod-Tour ширкати пешбари туристӣ дар Тоҷикистон мебошад.</p>',
          fa: '<h1>درباره ما</h1><p>Bunyod-Tour یک شرکت پیشرو در زمینه گردشگری در تاجیکستان است.</p>',
          de: '<h1>Über uns</h1><p>Bunyod-Tour ist ein führendes Tourismusunternehmen in Tadschikistan.</p>',
          zh: '<h1>关于我们</h1><p>Bunyod-Tour是塔吉克斯坦领先的旅游公司。</p>'
        }),
        template: 'default',
        sortOrder: 1
      },
      {
        slug: 'services',
        title: JSON.stringify({
          ru: 'Услуги',
          en: 'Services',
          tj: 'Хидматҳо',
          fa: 'خدمات',
          de: 'Dienstleistungen',
          zh: '服务'
        }),
        content: JSON.stringify({
          ru: '<h1>Наши услуги</h1><p>Мы предлагаем широкий спектр туристических услуг.</p>',
          en: '<h1>Our Services</h1><p>We offer a wide range of tourism services.</p>',
          tj: '<h1>Хидматҳои мо</h1><p>Мо доираи васеи хидматҳои туристиро пешниҳод мекунем.</p>',
          fa: '<h1>خدمات ما</h1><p>ما طیف وسیعی از خدمات گردشگری ارائه می دهیم.</p>',
          de: '<h1>Unsere Dienstleistungen</h1><p>Wir bieten eine breite Palette von Tourismusdienstleistungen.</p>',
          zh: '<h1>我们的服务</h1><p>我们提供广泛的旅游服务。</p>'
        }),
        template: 'default',
        sortOrder: 2
      }
    ];

    for (const page of pages) {
      try {
        await prisma.page.create({ data: page });
      } catch (error) {
        console.log(`⚠️ Page ${page.slug} already exists`);
      }
    }
    console.log('✅ Pages created');

    console.log('🎉 CMS data seeded successfully!');
    console.log('Admin credentials: username: admin, password: admin123');

  } catch (error) {
    console.error('❌ Error seeding CMS data:', error);
  }
}

// Если файл запускается напрямую
if (require.main === module) {
  seedCMSData()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}