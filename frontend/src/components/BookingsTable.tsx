import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ApiResponse } from '../types';

interface BookingRequest {
  id: number;
  customerName: string;
  customerEmail: string;
  preferredDate: string;
  numberOfPeople: number;
  createdAt: string;
  tour: {
    id: number;
    title: { en: string; ru: string };
    price: string;
    category: {
      name: { en: string; ru: string };
    };
  };
}

const BookingsTable: React.FC = () => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ApiResponse>('http://localhost:3001/api/tours/booking-requests');
      if (response.data.success) {
        setBookings(response.data.data);
      }
    } catch (err) {
      setError('Failed to fetch booking requests');
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Booking Requests</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Booking Requests</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-red-600 mb-2">{error}</div>
          <button
            onClick={fetchBookings}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            Booking Requests ({bookings.length})
          </h2>
          <button
            onClick={fetchBookings}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4M8 7l4 8 4-8M8 7H3v4l5 5 4-4m0-10v10m0-10H15" />
            </svg>
          </div>
          <p className="text-gray-500">No booking requests yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tour
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {booking.customerName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.customerEmail}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {booking.tour.title.en}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.tour.category.name.en} • {booking.tour.price}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      <div>Date: {formatDate(booking.preferredDate)}</div>
                      <div>People: {booking.numberOfPeople}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDateTime(booking.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-2">
                      <a
                        href={`mailto:${booking.customerEmail}?subject=Re: Tour Booking - ${booking.tour.title.en}&body=Dear ${booking.customerName},%0D%0A%0D%0AThank you for your interest in our ${booking.tour.title.en} tour.%0D%0A%0D%0ABest regards,%0D%0ATajik Trails Team`}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                      >
                        Email
                      </a>
                      <button
                        onClick={() => {
                          const details = `
Booking Request #${booking.id}
Customer: ${booking.customerName}
Email: ${booking.customerEmail}
Tour: ${booking.tour.title.en}
Preferred Date: ${formatDate(booking.preferredDate)}
Number of People: ${booking.numberOfPeople}
Price: ${booking.tour.price}
Category: ${booking.tour.category.name.en}
Submitted: ${formatDateTime(booking.createdAt)}
                          `.trim();
                          
                          navigator.clipboard.writeText(details);
                          alert('Booking details copied to clipboard!');
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                      >
                        Copy Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BookingsTable;