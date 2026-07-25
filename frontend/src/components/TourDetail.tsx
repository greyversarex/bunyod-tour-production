import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Tour, ApiResponse } from '../types';
import BookingForm from './BookingForm';

const TourDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTour(parseInt(id));
    }
  }, [id]);

  const fetchTour = async (tourId: number) => {
    try {
      const response = await axios.get<ApiResponse>(`http://localhost:5000/api/tours/${tourId}`);
      if (response.data.success) {
        setTour(response.data.data);
      } else {
        setError('Tour not found');
      }
    } catch (err) {
      setError('Failed to fetch tour details');
      console.error('Error fetching tour:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-lg mb-4">{error || 'Tour not found'}</div>
          <Link
            to="/tours"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Back to Tours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-blue-600">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/tours" className="hover:text-blue-600">Tours</Link>
        <span className="mx-2">/</span>
        <span>{tour.title.en}</span>
      </nav>

      {/* Tour Header */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
        <div className="h-64 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
          <div className="text-white text-center">
            <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <p className="opacity-75">Tour Image</p>
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
              {tour.category?.name.en}
            </span>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{tour.price}</div>
              <div className="text-sm text-gray-500">per person</div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            {tour.title.en}
          </h1>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Duration</h3>
              <p className="text-gray-600">{tour.duration}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Category</h3>
              <p className="text-gray-600">{tour.category?.name.en}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Description</h3>
            <p className="text-gray-600 leading-relaxed">
              {tour.description.en}
            </p>
          </div>

          {/* Language Toggle */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Русский / Russian</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-xl font-bold text-gray-800 mb-2">
                {tour.title.ru}
              </h4>
              <p className="text-gray-600 leading-relaxed">
                {tour.description.ru}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setShowBookingForm(true)}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Book This Tour
            </button>
            <Link
              to="/tours"
              className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg text-lg font-semibold text-center hover:bg-gray-300 transition-colors"
            >
              Back to Tours
            </Link>
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Book Tour</h3>
                <button
                  onClick={() => setShowBookingForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <BookingForm 
                tourId={tour.id} 
                tourTitle={tour.title.en}
                onSuccess={() => setShowBookingForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TourDetail;