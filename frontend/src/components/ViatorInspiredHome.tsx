import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Tour, Category } from '../types';

const ViatorInspiredHome: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [featuredTours, setFeaturedTours] = useState<Tour[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toursResponse, categoriesResponse] = await Promise.all([
          axios.get('/api/tours'),
          axios.get('/api/categories')
        ]);
        
        if (toursResponse.data.success) {
          setFeaturedTours(toursResponse.data.data.slice(0, 8));
        }
        
        if (categoriesResponse.data.success) {
          setCategories(categoriesResponse.data.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to tours page with search query
    window.location.href = `/tours?search=${encodeURIComponent(searchQuery)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Viator Style */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold mb-6">
              {t('home.hero.title', 'Discover Tajikistan')}
            </h1>
            <p className="text-xl sm:text-2xl mb-8 text-blue-100">
              {t('home.hero.subtitle', 'Experience breathtaking mountains, ancient culture, and unforgettable adventures')}
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('home.search.placeholder', 'Where do you want to explore in Tajikistan?')}
                  className="w-full py-4 px-6 text-lg text-gray-900 rounded-full shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 px-8 bg-orange-500 text-white rounded-full hover:bg-orange-600 font-semibold transition-colors"
                >
                  {t('home.search.button', 'Search')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Trust Indicators - Viator Style */}
      <section className="py-12 bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{featuredTours.length}+</div>
              <div className="text-gray-600">{t('home.stats.tours', 'Unique Tours')}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-gray-600">{t('home.stats.support', 'Customer Support')}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">100%</div>
              <div className="text-gray-600">{t('home.stats.cancellation', 'Free Cancellation')}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">4.8★</div>
              <div className="text-gray-600">{t('home.stats.rating', 'Average Rating')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Tours Grid - Viator Style */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('home.featured.title', 'Featured Tours')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredTours.map((tour) => (
              <Link
                key={tour.id}
                to={`/tours/${tour.id}`}
                className="group block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                <div className="relative">
                  <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-green-400"></div>
                  <div className="absolute top-4 left-4">
                    <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {t('home.featured.badge', 'Best Seller')}
                    </span>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-lg text-sm">
                      {tour.duration}
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2 group-hover:text-blue-600 transition-colors">
                    {tour.title[i18n.language as keyof typeof tour.title] || tour.title.en}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {tour.description[i18n.language as keyof typeof tour.description] || tour.description.en}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-yellow-400">
                      {'★★★★★'.split('').map((star, idx) => (
                        <span key={idx} className="text-sm">{star}</span>
                      ))}
                      <span className="text-gray-500 text-sm ml-1">(4.8)</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-600">{tour.price}</div>
                      <div className="text-xs text-gray-500">{t('home.featured.per_person', 'per person')}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('home.categories.title', 'Explore by Category')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/tours?category=${category.id}`}
                className="group block"
              >
                <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-purple-500 to-pink-400 h-64">
                  <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-all"></div>
                  <div className="absolute bottom-6 left-6 text-white">
                    <h3 className="text-2xl font-bold mb-2">
                      {category.name[i18n.language as keyof typeof category.name] || category.name.en}
                    </h3>
                    <p className="text-sm opacity-90">
                      {category._count?.tours || 0} {t('home.categories.tours', 'tours available')}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            {t('home.cta.title', 'Ready for Your Tajikistan Adventure?')}
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            {t('home.cta.subtitle', 'Book your dream tour today and discover the hidden gems of Central Asia')}
          </p>
          <Link
            to="/tours"
            className="inline-block bg-orange-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            {t('home.cta.button', 'View All Tours')}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default ViatorInspiredHome;