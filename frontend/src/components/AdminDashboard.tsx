import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import TourForm from './TourForm';
import HotelForm from './HotelForm';
import NewsForm from './NewsForm';
import BookingsTable from './BookingsTable';
import ReviewsTable from './ReviewsTable';
import { Tour, Category, BookingRequest, Review } from '../types';

interface AdminStats {
  totalTours: number;
  totalBookings: number;
  totalReviews: number;
  pendingReviews: number;
}

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'tours' | 'hotels' | 'bookings' | 'reviews' | 'categories' | 'news'>('overview');
  const [stats, setStats] = useState<AdminStats>({
    totalTours: 0,
    totalBookings: 0,
    totalReviews: 0,
    pendingReviews: 0
  });
  const [tours, setTours] = useState<Tour[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [selectedNews, setSelectedNews] = useState<any | null>(null);
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [showTourForm, setShowTourForm] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [showHotelForm, setShowHotelForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [toursRes, hotelsRes, categoriesRes, bookingsRes, reviewsRes, newsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/tours'),
        axios.get('http://localhost:5000/api/hotels'),
        axios.get('http://localhost:5000/api/categories'),
        axios.get('http://localhost:5000/api/tours/booking-requests'),
        axios.get('http://localhost:5000/api/tours/reviews'),
        axios.get('http://localhost:5000/api/news/admin/all')
      ]);

      if (toursRes.data.success) {
        setTours(toursRes.data.data);
      }

      if (hotelsRes.data.success) {
        setHotels(hotelsRes.data.data);
      }

      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.data);
      }

      if (newsRes.data.success) {
        setNews(newsRes.data.data.news);
      }

      // Calculate stats
      const totalTours = toursRes.data.success ? toursRes.data.data.length : 0;
      const totalBookings = bookingsRes.data.success ? bookingsRes.data.data.length : 0;
      const totalReviews = reviewsRes.data.success ? reviewsRes.data.data.length : 0;
      const pendingReviews = reviewsRes.data.success 
        ? reviewsRes.data.data.filter((review: Review) => !review.isModerated).length 
        : 0;

      setStats({
        totalTours,
        totalBookings,
        totalReviews,
        pendingReviews
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTour = (tour: Tour) => {
    setSelectedTour(tour);
    setShowTourForm(true);
  };

  const handleDeleteTour = async (tourId: number) => {
    if (window.confirm('Вы уверены, что хотите удалить этот тур?')) {
      try {
        const response = await axios.delete(`http://localhost:5000/api/tours/${tourId}`);
        if (response.data.success) {
          setTours(tours.filter(tour => tour.id !== tourId));
          setStats(prev => ({ ...prev, totalTours: prev.totalTours - 1 }));
        }
      } catch (error) {
        console.error('Error deleting tour:', error);
        alert('Ошибка при удалении тура');
      }
    }
  };

  const handleTourFormClose = () => {
    setShowTourForm(false);
    setSelectedTour(null);
    fetchDashboardData();
  };

  const handleEditHotel = (hotel: any) => {
    setSelectedHotel(hotel);
    setShowHotelForm(true);
  };

  const handleDeleteHotel = async (hotelId: number) => {
    if (window.confirm('Вы уверены, что хотите удалить этот отель?')) {
      try {
        const response = await axios.delete(`http://localhost:5000/api/hotels/${hotelId}`);
        if (response.data.success) {
          setHotels(hotels.filter(hotel => hotel.id !== hotelId));
        }
      } catch (error) {
        console.error('Error deleting hotel:', error);
        alert('Ошибка при удалении отеля');
      }
    }
  };

  // News management functions
  const handleDeleteNews = async (newsId: number) => {
    if (window.confirm('Вы уверены, что хотите удалить эту новость?')) {
      try {
        const response = await axios.delete(`http://localhost:5000/api/news/admin/${newsId}`);
        if (response.data.success) {
          setNews(news.filter(article => article.id !== newsId));
        }
      } catch (error) {
        console.error('Error deleting news:', error);
        alert('Ошибка при удалении новости');
      }
    }
  };

  const handleNewsFormClose = () => {
    setShowNewsForm(false);
    setSelectedNews(null);
    fetchDashboardData(); // Refresh data
  };

  const handleHotelFormClose = () => {
    setShowHotelForm(false);
    setSelectedHotel(null);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка панели администратора...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              Админ-панель Bunyod-Tour
            </h1>
            <div className="text-sm text-gray-500">
              Администратор
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { key: 'overview', label: 'Обзор', icon: '📊' },
              { key: 'tours', label: 'Туры', icon: '🏔️' },
              { key: 'hotels', label: 'Отели', icon: '🏨' },
              { key: 'bookings', label: 'Заказы', icon: '📋' },
              { key: 'reviews', label: 'Отзывы', icon: '⭐' },
              { key: 'categories', label: 'Категории', icon: '📁' },
              { key: 'news', label: 'Новости', icon: '📰' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {tab.key === 'reviews' && stats.pendingReviews > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {stats.pendingReviews}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-lg">🏔️</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Всего туров</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTours}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-lg">📋</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Заказов</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <span className="text-yellow-600 text-lg">⭐</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Отзывов</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalReviews}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 text-lg">⏳</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Ожидает модерации</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingReviews}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tours' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Управление турами</h2>
              <button
                onClick={() => setShowTourForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Добавить тур
              </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Тур
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Категория
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Цена
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Длительность
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tours.map((tour) => (
                      <tr key={tour.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {typeof tour.title === 'object' ? tour.title.ru : tour.title}
                            </div>
                            <div className="text-sm text-gray-500">{tour.city}, {tour.country}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tour.category ? (typeof tour.category.name === 'object' ? tour.category.name.ru : tour.category.name) : 'Не указана'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${tour.price}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tour.duration}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            tour.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {tour.isActive ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEditTour(tour)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => handleDeleteTour(tour.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hotels' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Управление отелями</h2>
              <button
                onClick={() => setShowHotelForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Добавить отель
              </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Отель
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Расположение
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Рейтинг
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {hotels.map((hotel) => (
                      <tr key={hotel.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {typeof hotel.name === 'object' ? hotel.name.ru || hotel.name.en : hotel.name}
                            </div>
                            <div className="text-sm text-gray-500">{hotel.brand || 'Независимый отель'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hotel.city}, {hotel.country}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {hotel.rating ? `${hotel.rating} звезд` : 'Не указан'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            hotel.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {hotel.isActive ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEditHotel(hotel)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => handleDeleteHotel(hotel.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bookings' && <BookingsTable />}
        {activeTab === 'reviews' && <ReviewsTable />}
        
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Категории туров</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <div key={category.id} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {typeof category.name === 'object' ? category.name.ru : category.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Туров в категории: {category._count?.tours || 0}
                  </p>
                  <div className="flex justify-end space-x-2">
                    <button className="text-sm text-indigo-600 hover:text-indigo-900">
                      Редактировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Раздел новостей */}
        {activeTab === 'news' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Управление новостями</h2>
              <button
                onClick={() => {
                  setSelectedNews(null);
                  setShowNewsForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Добавить новость
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Заголовок
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Категория
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Просмотры
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {news.map((article) => {
                      const title = typeof article.title === 'string' 
                        ? (function() {
                            try {
                              return JSON.parse(article.title).ru || article.title;
                            } catch {
                              return article.title;
                            }
                          })()
                        : article.title;
                      
                      return (
                        <tr key={article.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {article.image && (
                                <img 
                                  src={article.image} 
                                  alt={title} 
                                  className="w-10 h-10 rounded-lg mr-3 object-cover"
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                  {title}
                                </div>
                                {article.isFeatured && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                    Рекомендуемое
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {article.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              article.isPublished 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {article.isPublished ? 'Опубликовано' : 'Черновик'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(article.publishedAt).toLocaleDateString('ru-RU')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {article.views || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button 
                              onClick={() => {
                                setSelectedNews(article);
                                setShowNewsForm(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              Редактировать
                            </button>
                            <button 
                              onClick={() => handleDeleteNews(article.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {news.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Новостей пока нет</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tour Form Modal */}
      {showTourForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedTour ? 'Редактировать тур' : 'Добавить новый тур'}
                </h3>
                <button
                  onClick={handleTourFormClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <TourForm tour={selectedTour} onSuccess={handleTourFormClose} />
            </div>
          </div>
        </div>
      )}

      {/* Hotel Form Modal */}
      {showHotelForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedHotel ? 'Редактировать отель' : 'Добавить новый отель'}
                </h3>
                <button
                  onClick={handleHotelFormClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <HotelForm hotel={selectedHotel} onSuccess={handleHotelFormClose} />
            </div>
          </div>
        </div>
      )}

      {/* News Form Modal */}
      {showNewsForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedNews ? 'Редактировать новость' : 'Добавить новую новость'}
                </h3>
                <button
                  onClick={handleNewsFormClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <NewsForm news={selectedNews} onSuccess={handleNewsFormClose} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;