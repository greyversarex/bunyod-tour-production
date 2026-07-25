import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Tour, Category } from '../types';
import ViatorTourCard from './ViatorTourCard';

const ViatorTourCatalog: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tours, setTours] = useState<Tour[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 2000 });
  const [sortBy, setSortBy] = useState('recommended');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toursResponse, categoriesResponse] = await Promise.all([
          axios.get('http://localhost:3001/api/tours'),
          axios.get('http://localhost:3001/api/categories')
        ]);
        
        if (toursResponse.data.success) {
          setTours(toursResponse.data.data);
          setFilteredTours(toursResponse.data.data);
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

  useEffect(() => {
    let filtered = tours;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(tour => 
        tour.title.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tour.title.ru.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tour.description.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tour.description.ru.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(tour => tour.categoryId === parseInt(selectedCategory));
    }
    
    // Apply price filter
    filtered = filtered.filter(tour => {
      const price = parseInt(tour.price.replace(/[^0-9]/g, ''));
      return price >= priceRange.min && price <= priceRange.max;
    });
    
    // Apply sorting
    switch (sortBy) {
      case 'price_low':
        filtered.sort((a, b) => {
          const priceA = parseInt(a.price.replace(/[^0-9]/g, ''));
          const priceB = parseInt(b.price.replace(/[^0-9]/g, ''));
          return priceA - priceB;
        });
        break;
      case 'price_high':
        filtered.sort((a, b) => {
          const priceA = parseInt(a.price.replace(/[^0-9]/g, ''));
          const priceB = parseInt(b.price.replace(/[^0-9]/g, ''));
          return priceB - priceA;
        });
        break;
      case 'duration':
        filtered.sort((a, b) => {
          const daysA = parseInt(a.duration.replace(/[^0-9]/g, ''));
          const daysB = parseInt(b.duration.replace(/[^0-9]/g, ''));
          return daysA - daysB;
        });
        break;
      default:
        // Keep original order (recommended)
        break;
    }
    
    setFilteredTours(filtered);
  }, [tours, searchQuery, selectedCategory, priceRange, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL params
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedCategory) params.set('category', selectedCategory);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setPriceRange({ min: 0, max: 2000 });
    setSortBy('recommended');
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('catalog.search.placeholder', 'Search tours in Tajikistan...')}
                className="w-full py-3 px-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 px-6 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold transition-colors"
              >
                {t('catalog.search.button', 'Search')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Viator Style */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg">{t('catalog.filters.title', 'Filters')}</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {t('catalog.filters.clear', 'Clear all')}
                </button>
              </div>
              
              {/* Category Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">{t('catalog.filters.category', 'Category')}</h4>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('catalog.filters.all_categories', 'All Categories')}</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id.toString()}>
                      {category.name.en} ({category._count?.tours || 0})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Price Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">{t('catalog.filters.price', 'Price Range')}</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">Min: ${priceRange.min}</label>
                    <input
                      type="range"
                      min="0"
                      max="2000"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({...priceRange, min: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Max: ${priceRange.max}</label>
                    <input
                      type="range"
                      min="0"
                      max="2000"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({...priceRange, max: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
              
              {/* Popular Filters */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">{t('catalog.filters.popular', 'Popular Filters')}</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded mr-2" />
                    <span className="text-sm">{t('catalog.filters.free_cancellation', 'Free Cancellation')}</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded mr-2" />
                    <span className="text-sm">{t('catalog.filters.skip_line', 'Skip the Line')}</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded mr-2" />
                    <span className="text-sm">{t('catalog.filters.private_tour', 'Private Tours')}</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded mr-2" />
                    <span className="text-sm">{t('catalog.filters.small_group', 'Small Group')}</span>
                  </label>
                </div>
              </div>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1">
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold mb-2">
                  {searchQuery 
                    ? t('catalog.results.search_title', 'Search Results for "{{query}}"', { query: searchQuery })
                    : t('catalog.results.all_title', 'All Tajikistan Tours')
                  }
                </h1>
                <p className="text-gray-600">
                  {filteredTours.length} {t('catalog.results.count', 'tours found')}
                </p>
              </div>
              
              <div className="flex items-center gap-4 mt-4 sm:mt-0">
                <label className="text-sm text-gray-600">{t('catalog.sort.label', 'Sort by:')}</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="recommended">{t('catalog.sort.recommended', 'Recommended')}</option>
                  <option value="price_low">{t('catalog.sort.price_low', 'Price: Low to High')}</option>
                  <option value="price_high">{t('catalog.sort.price_high', 'Price: High to Low')}</option>
                  <option value="duration">{t('catalog.sort.duration', 'Duration')}</option>
                </select>
              </div>
            </div>
            
            {/* Tours Grid */}
            {filteredTours.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredTours.map(tour => (
                  <ViatorTourCard key={tour.id} tour={tour} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-3v3m-5 4h10a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('catalog.no_results.title', 'No tours found')}
                </h3>
                <p className="text-gray-600 mb-4">
                  {t('catalog.no_results.subtitle', 'Try adjusting your search or filter criteria')}
                </p>
                <button
                  onClick={clearFilters}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('catalog.no_results.clear', 'Clear Filters')}
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ViatorTourCatalog;