import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface NewsFormProps {
  news?: any;
  onSuccess: () => void;
}

interface NewsFormData {
  title: {
    ru: string;
    en: string;
  };
  content: {
    ru: string;
    en: string;
  };
  excerpt: {
    ru: string;
    en: string;
  };
  category: string;
  image: string;
  author: string;
  isPublished: boolean;
  isFeatured: boolean;
  slug: string;
  metaTitle: {
    ru: string;
    en: string;
  };
  metaDescription: {
    ru: string;
    en: string;
  };
  readTime: number;
}

const NewsForm: React.FC<NewsFormProps> = ({ news, onSuccess }) => {
  const [formData, setFormData] = useState<NewsFormData>({
    title: { ru: '', en: '' },
    content: { ru: '', en: '' },
    excerpt: { ru: '', en: '' },
    category: 'Новости компании',
    image: '',
    author: 'Bunyod-Tour',
    isPublished: true,
    isFeatured: false,
    slug: '',
    metaTitle: { ru: '', en: '' },
    metaDescription: { ru: '', en: '' },
    readTime: 5
  });

  const [activeLanguage, setActiveLanguage] = useState<'ru' | 'en'>('ru');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (news) {
      const parseField = (field: any) => {
        if (!field) return { ru: '', en: '' };
        try {
          return typeof field === 'string' ? JSON.parse(field) : field;
        } catch {
          return { ru: field || '', en: '' };
        }
      };

      setFormData({
        title: parseField(news.title),
        content: parseField(news.content),
        excerpt: parseField(news.excerpt),
        category: news.category || 'Новости компании',
        image: news.image || '',
        author: news.author || 'Bunyod-Tour',
        isPublished: news.isPublished ?? true,
        isFeatured: news.isFeatured ?? false,
        slug: news.slug || '',
        metaTitle: parseField(news.metaTitle),
        metaDescription: parseField(news.metaDescription),
        readTime: news.readTime || 5
      });
    }
  }, [news]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        title: JSON.stringify(formData.title),
        content: JSON.stringify(formData.content),
        excerpt: JSON.stringify(formData.excerpt),
        category: formData.category,
        image: formData.image,
        author: formData.author,
        isPublished: formData.isPublished,
        isFeatured: formData.isFeatured,
        slug: formData.slug || generateSlug(formData.title.ru),
        metaTitle: JSON.stringify(formData.metaTitle),
        metaDescription: JSON.stringify(formData.metaDescription),
        readTime: formData.readTime
      };

      const url = news 
        ? `http://localhost:3001/api/news/admin/${news.id}`
        : 'http://localhost:3001/api/news/admin/create';
      
      const method = news ? 'put' : 'post';
      
      const response = await axios[method](url, submitData);

      if (response.data.success) {
        onSuccess();
      } else {
        alert('Ошибка при сохранении новости');
      }
    } catch (error) {
      console.error('Error saving news:', error);
      alert('Ошибка при сохранении новости');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof NewsFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateMultilingualField = (field: 'title' | 'content' | 'excerpt' | 'metaTitle' | 'metaDescription', lang: 'ru' | 'en', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [lang]: value
      }
    }));
  };

  const categories = [
    'Новости компании',
    'Туризм',
    'События',
    'Пресс-релиз'
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Language selector */}
      <div className="flex space-x-4 mb-6">
        <label className="text-sm font-medium text-gray-700 mb-2 block">Язык:</label>
        <div className="flex space-x-2">
          {[
            { key: 'ru', label: 'Русский' },
            { key: 'en', label: 'English' },
          ].map((lang) => (
            <button
              key={lang.key}
              type="button"
              onClick={() => setActiveLanguage(lang.key as 'ru' | 'en')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                activeLanguage === lang.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Заголовок ({activeLanguage})
            </label>
            <input
              type="text"
              value={formData.title[activeLanguage]}
              onChange={(e) => updateMultilingualField('title', activeLanguage, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={activeLanguage === 'ru'}
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Краткое описание ({activeLanguage})
            </label>
            <textarea
              value={formData.excerpt[activeLanguage]}
              onChange={(e) => updateMultilingualField('excerpt', activeLanguage, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Категория
            </label>
            <select
              value={formData.category}
              onChange={(e) => updateField('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL изображения
            </label>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => updateField('image', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Автор
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => updateField('author', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL слаг
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => updateField('slug', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Автоматически из заголовка"
            />
          </div>

          {/* Read time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Время чтения (минуты)
            </label>
            <input
              type="number"
              value={formData.readTime}
              onChange={(e) => updateField('readTime', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>

          {/* Status toggles */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPublished"
                checked={formData.isPublished}
                onChange={(e) => updateField('isPublished', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPublished" className="ml-2 text-sm text-gray-700">
                Опубликовать
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isFeatured"
                checked={formData.isFeatured}
                onChange={(e) => updateField('isFeatured', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isFeatured" className="ml-2 text-sm text-gray-700">
                Рекомендуемая новость
              </label>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Содержание ({activeLanguage})
            </label>
            <textarea
              value={formData.content[activeLanguage]}
              onChange={(e) => updateMultilingualField('content', activeLanguage, e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={activeLanguage === 'ru'}
            />
          </div>

          {/* Meta title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SEO заголовок ({activeLanguage})
            </label>
            <input
              type="text"
              value={formData.metaTitle[activeLanguage]}
              onChange={(e) => updateMultilingualField('metaTitle', activeLanguage, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Meta description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SEO описание ({activeLanguage})
            </label>
            <textarea
              value={formData.metaDescription[activeLanguage]}
              onChange={(e) => updateMultilingualField('metaDescription', activeLanguage, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Submit buttons */}
      <div className="flex justify-end space-x-4 pt-6 border-t">
        <button
          type="button"
          onClick={() => onSuccess()}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Сохранение...' : (news ? 'Обновить' : 'Создать')}
        </button>
      </div>
    </form>
  );
};

export default NewsForm;