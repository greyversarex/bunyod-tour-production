import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Tour, Category, ApiResponse } from '../types';

const TourCatalog: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [tours, setTours] = useState<Tour[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTours();
    fetchCategories();
  }, []);

  const fetchTours = async () => {
    try {
      const response = await axios.get<ApiResponse>('http://localhost:5000/api/tours');
      if (response.data.success) {
        setTours(response.data.data);
      }
    } catch (err) {
      setError('Failed to fetch tours');
      console.error('Error fetching tours:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get<ApiResponse>('http://localhost:5000/api/categories');
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const filteredTours = selectedCategory 
    ? tours.filter(tour => tour.categoryId === selectedCategory)
    : tours;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-lg">{error}</div>
          <button 
            onClick={fetchTours}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">{t('tours.title')}</h1>
        <p className="text-gray-600 mb-6">
          {t('tours.description')}
        </p>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t('tours.allTours')}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {category.name[i18n.language as keyof typeof category.name] || category.name.en || category.name.ru}
            </button>
          ))}
        </div>
      </div>

      {filteredTours.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            {selectedCategory ? t('tours.noToursInCategory') : t('tours.noTours')}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTours.map((tour) => (
            <div key={tour.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <div className="text-white text-center">
                  <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <p className="text-sm opacity-75">Tour Image</p>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    {tour.category?.name.en}
                  </span>
                  <span className="text-green-600 font-semibold">{tour.price}</span>
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {tour.title[i18n.language as keyof typeof tour.title] || tour.title.en || tour.title.ru}
                </h3>

                <p className="text-gray-600 mb-4 line-clamp-3">
                  {(() => {
                    const description = tour.description[i18n.language as keyof typeof tour.description] || tour.description.en || tour.description.ru;
                    return description.length > 120 
                      ? `${description.substring(0, 120)}...`
                      : description;
                  })()}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {t('tours.duration')}: {tour.duration}
                  </span>
                  <Link
                    to={`/tours/${tour.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    {t('tours.viewDetails')}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TourCatalog;