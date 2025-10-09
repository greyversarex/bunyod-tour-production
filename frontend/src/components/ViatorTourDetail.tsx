import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Tour } from '../types';
import BookingForm from './BookingForm';

const ViatorTourDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [travelers, setTravelers] = useState({ adults: 2, children: 0 });

  useEffect(() => {
    const fetchTour = async () => {
      if (!id) return;
      
      try {
        const response = await axios.get(`http://localhost:3001/api/tours/${id}`);
        if (response.data.success) {
          setTour(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching tour:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [id]);

  const handleBookNow = () => {
    setShowBookingForm(true);
  };

  const formatPrice = (price: string) => {
    return price.replace(/[^0-9]/g, '');
  };

  const calculateTotalPrice = () => {
    if (!tour) return 0;
    const basePrice = parseInt(formatPrice(tour.price));
    return (basePrice * travelers.adults) + (basePrice * 0.75 * travelers.children);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tour not found</h1>
          <Link to="/tours" className="text-blue-600 hover:text-blue-800">
            Back to tours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm">
            <Link to="/" className="text-gray-500 hover:text-gray-700">Home</Link>
            <span className="text-gray-300">/</span>
            <Link to="/tours" className="text-gray-500 hover:text-gray-700">Tours</Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">
              {tour.title[i18n.language as keyof typeof tour.title] || tour.title.en}
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Image */}
            <div className="relative">
              <div className="w-full h-96 bg-gradient-to-br from-blue-500 via-green-400 to-yellow-300 rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                <div className="absolute top-4 left-4 flex space-x-2">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    Best Seller
                  </span>
                  <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    Likely to Sell Out
                  </span>
                </div>
                <div className="absolute bottom-4 right-4">
                  <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm">
                    {tour.duration}
                  </div>
                </div>
              </div>
            </div>

            {/* Tour Title & Rating */}
            <div className="bg-white rounded-lg p-6">
              <div className="mb-4">
                <span className="text-sm text-gray-500 uppercase tracking-wide">
                  {tour.category && (tour.category.name[i18n.language as keyof typeof tour.category.name] || tour.category.name.en)}
                </span>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {tour.title[i18n.language as keyof typeof tour.title] || tour.title.en}
              </h1>
              
              <div className="flex items-center mb-4">
                <div className="flex items-center text-yellow-400 mr-3">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                  ))}
                </div>
                <span className="text-gray-600 text-sm">
                  4.{Math.floor(Math.random() * 4) + 5} ({Math.floor(Math.random() * 1000) + 100} reviews)
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
                  Free Cancellation
                </span>
                <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                  Skip the Line
                </span>
                <span className="bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full">
                  Small Group
                </span>
              </div>
            </div>

            {/* Overview */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Overview</h2>
              <p className="text-gray-700 leading-relaxed">
                {tour.description[i18n.language as keyof typeof tour.description] || tour.description.en}
              </p>
            </div>

            {/* What's Included */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">What's Included</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Professional guide</span>
                </div>
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Transportation</span>
                </div>
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Entry tickets</span>
                </div>
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Hotel pickup</span>
                </div>
              </div>
            </div>

            {/* Itinerary */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Itinerary</h2>
              <div className="space-y-4">
                {[
                  { time: '08:00', title: 'Hotel Pickup', description: 'Pick up from your hotel in Dushanbe' },
                  { time: '10:00', title: 'First Stop', description: 'Visit historical landmarks and cultural sites' },
                  { time: '12:30', title: 'Lunch', description: 'Traditional Tajik cuisine at local restaurant' },
                  { time: '15:00', title: 'Adventure Activity', description: 'Main tour activity and exploration' },
                  { time: '17:30', title: 'Return', description: 'Return to hotel with memorable experiences' }
                ].map((item, index) => (
                  <div key={index} className="flex space-x-4">
                    <div className="flex-shrink-0 w-16 text-right">
                      <span className="text-sm font-medium text-blue-600">{item.time}</span>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="w-3 h-3 bg-blue-600 rounded-full mt-2"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24">
              <div className="mb-6">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  ${calculateTotalPrice().toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  per group (up to {travelers.adults + travelers.children} travelers)
                </div>
              </div>

              {/* Date Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Travelers Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Travelers
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Adults</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setTravelers(prev => ({ ...prev, adults: Math.max(1, prev.adults - 1) }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{travelers.adults}</span>
                      <button
                        onClick={() => setTravelers(prev => ({ ...prev, adults: prev.adults + 1 }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Children</span>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setTravelers(prev => ({ ...prev, children: Math.max(0, prev.children - 1) }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{travelers.children}</span>
                      <button
                        onClick={() => setTravelers(prev => ({ ...prev, children: prev.children + 1 }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Book Now Button */}
              <button
                onClick={handleBookNow}
                disabled={!selectedDate}
                className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mb-4"
              >
                Book Now
              </button>

              <div className="text-center text-sm text-gray-500 mb-4">
                Free cancellation up to 24 hours before
              </div>

              {/* Trust Indicators */}
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Secure Payment</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Instant Confirmation</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>24/7 Support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && tour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Complete Your Booking</h2>
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
                tour={tour}
                selectedDate={selectedDate}
                travelers={travelers}
                onClose={() => setShowBookingForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViatorTourDetail;