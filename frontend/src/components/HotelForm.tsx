import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Hotel {
  id?: number;
  name: {
    en: string;
    ru: string;
  };
  description: {
    en: string;
    ru: string;
  };
  brand?: string;
  country: string;
  city: string;
  address?: string;
  rating?: number;
  priceRange?: string;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
}

interface HotelFormProps {
  hotel: Hotel | null;
  onSuccess: () => void;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface Message {
  type: 'success' | 'error';
  text: string;
}

const HotelForm: React.FC<HotelFormProps> = ({ hotel, onSuccess }) => {
  const [formData, setFormData] = useState({
    name_en: '',
    name_ru: '',
    description_en: '',
    description_ru: '',
    brand: '',
    country: '',
    city: '',
    address: '',
    rating: 0,
    priceRange: '',
    amenities: [] as string[],
    images: [] as string[]
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [newAmenity, setNewAmenity] = useState('');
  const [newImage, setNewImage] = useState('');

  // Countries data for dropdown
  const countries = [
    'Таджикистан',
    'Узбекистан',
    'Кыргызстан',
    'Казахстан',
    'Туркменистан'
  ];

  // Hotel brands data
  const hotelBrands = [
    'Four Seasons',
    'Ritz-Carlton',
    'W Hotels',
    'St. Regis',
    'Waldorf Astoria',
    'Conrad',
    'Peninsula',
    'Aman',
    'Rosewood',
    'Hilton',
    'Marriott',
    'Sheraton',
    'Westin',
    'Hyatt',
    'InterContinental',
    'Crowne Plaza',
    'DoubleTree',
    'Renaissance Hotels',
    'Fairmont',
    'Sofitel',
    'Pullman',
    'Holiday Inn',
    'Courtyard',
    'Hampton Inn',
    'Residence Inn',
    'Hotel Indigo',
    'Cambria Hotels',
    'Radisson',
    'Marriott Bonvoy',
    'Hilton Honors',
    'IHG Rewards',
    'Wyndham Hotels',
    'Choice Hotels',
    'Best Western',
    'Accor',
    'Local Brand'
  ];

  // Price ranges
  const priceRanges = [
    '$ (Бюджетный)',
    '$$ (Эконом)',
    '$$$ (Средний)',
    '$$$$ (Люкс)',
    '$$$$$ (Ультра-люкс)'
  ];

  useEffect(() => {
    if (hotel) {
      setFormData({
        name_en: hotel.name?.en || '',
        name_ru: hotel.name?.ru || '',
        description_en: hotel.description?.en || '',
        description_ru: hotel.description?.ru || '',
        brand: hotel.brand || '',
        country: hotel.country || '',
        city: hotel.city || '',
        address: hotel.address || '',
        rating: hotel.rating || 0,
        priceRange: hotel.priceRange || '',
        amenities: hotel.amenities || [],
        images: hotel.images || []
      });
    }
  }, [hotel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const hotelData = {
        name: {
          en: formData.name_en,
          ru: formData.name_ru
        },
        description: {
          en: formData.description_en,
          ru: formData.description_ru
        },
        brand: formData.brand,
        country: formData.country,
        city: formData.city,
        address: formData.address,
        rating: formData.rating,
        priceRange: formData.priceRange,
        amenities: JSON.stringify(formData.amenities),
        images: JSON.stringify(formData.images),
        isActive: true
      };

      const method = hotel?.id ? 'PUT' : 'POST';
      const url = hotel?.id 
        ? `/api/hotels/${hotel.id}`
        : '/api/hotels';

      const response = await axios({
        method,
        url,
        data: hotelData
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: hotel?.id ? 'Отель успешно обновлен!' : 'Отель успешно создан!' });
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving hotel:', error);
      setMessage({ type: 'error', text: 'Ошибка при сохранении отеля' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rating' ? parseFloat(value) || 0 : value
    }));
  };

  const addAmenity = () => {
    if (newAmenity.trim()) {
      setFormData(prev => ({
        ...prev,
        amenities: [...prev.amenities, newAmenity.trim()]
      }));
      setNewAmenity('');
    }
  };

  const removeAmenity = (index: number) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.filter((_, i) => i !== index)
    }));
  };

  const addImage = () => {
    if (newImage.trim()) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, newImage.trim()]
      }));
      setNewImage('');
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">
        {hotel?.id ? 'Редактировать отель' : 'Добавить новый отель'}
      </h2>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Multilingual Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name_en" className="block text-sm font-medium text-gray-700 mb-1">
              Название (EN)
            </label>
            <input
              type="text"
              id="name_en"
              name="name_en"
              value={formData.name_en}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="name_ru" className="block text-sm font-medium text-gray-700 mb-1">
              Название (RU)
            </label>
            <input
              type="text"
              id="name_ru"
              name="name_ru"
              value={formData.name_ru}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Multilingual Description Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="description_en" className="block text-sm font-medium text-gray-700 mb-1">
              Описание (EN)
            </label>
            <textarea
              id="description_en"
              name="description_en"
              value={formData.description_en}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="description_ru" className="block text-sm font-medium text-gray-700 mb-1">
              Описание (RU)
            </label>
            <textarea
              id="description_ru"
              name="description_ru"
              value={formData.description_ru}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Hotel Brand */}
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
            Бренд отеля
          </label>
          <select
            id="brand"
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Выберите бренд</option>
            {hotelBrands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>

        {/* Location Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
              Страна
            </label>
            <select
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Выберите страну</option>
              {countries.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              Город
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Адрес
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Rating and Price Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">
              Рейтинг (1-5)
            </label>
            <input
              type="number"
              id="rating"
              name="rating"
              min="1"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="priceRange" className="block text-sm font-medium text-gray-700 mb-1">
              Ценовая категория
            </label>
            <select
              id="priceRange"
              name="priceRange"
              value={formData.priceRange}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Выберите ценовую категорию</option>
              {priceRanges.map((range) => (
                <option key={range} value={range}>{range}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Удобства
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
              placeholder="Добавить удобство"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addAmenity}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Добавить
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.amenities.map((amenity, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {amenity}
                <button
                  type="button"
                  onClick={() => removeAmenity(index)}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Изображения (URL)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="url"
              value={newImage}
              onChange={(e) => setNewImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Добавить
            </button>
          </div>
          <div className="space-y-2">
            {formData.images.map((image, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-md"
              >
                <span className="flex-1 text-sm text-gray-600 truncate">{image}</span>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-4 pt-6">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Сохранение...' : (hotel?.id ? 'Обновить' : 'Создать')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HotelForm;