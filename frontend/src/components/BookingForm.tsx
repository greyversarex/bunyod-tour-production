import React, { useState } from 'react';
import axios from 'axios';
import { ApiResponse, Tour } from '../types';

interface BookingFormProps {
  tour?: Tour;
  tourId?: number;
  tourTitle?: string;
  selectedDate?: string;
  travelers?: {
    adults: number;
    children: number;
  };
  onSuccess?: () => void;
  onClose?: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ 
  tour, 
  tourId, 
  tourTitle, 
  selectedDate = '', 
  travelers = { adults: 2, children: 0 },
  onSuccess,
  onClose 
}) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    preferredDate: selectedDate,
    numberOfPeople: travelers.adults + travelers.children
  });
  
  const currentTourId = tourId || tour?.id;
  const currentTourTitle = tourTitle || (tour?.title.en) || 'Tour';
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfPeople' ? parseInt(value) || 1 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.post<ApiResponse>('http://localhost:5000/api/tours/booking-requests', {
        ...formData,
        tourId: currentTourId
      });

      if (response.data.success) {
        setMessage({ 
          type: 'success', 
          text: 'Booking request submitted successfully! We will contact you soon.' 
        });
        setFormData({
          customerName: '',
          customerEmail: '',
          preferredDate: selectedDate,
          numberOfPeople: travelers.adults + travelers.children
        });
        if (onClose) {
          setTimeout(() => onClose(), 2000);
        }
        
        // Call success callback after a short delay
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error('Booking error:', err);
      setMessage({ 
        type: 'error', 
        text: 'Failed to submit booking request. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        Book: {currentTourTitle}
      </h3>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <input
            type="email"
            id="customerEmail"
            name="customerEmail"
            value={formData.customerEmail}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor="preferredDate" className="block text-sm font-medium text-gray-700 mb-1">
            Preferred Date *
          </label>
          <input
            type="date"
            id="preferredDate"
            name="preferredDate"
            value={formData.preferredDate}
            onChange={handleChange}
            min={today}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="numberOfPeople" className="block text-sm font-medium text-gray-700 mb-1">
            Number of People *
          </label>
          <input
            type="number"
            id="numberOfPeople"
            name="numberOfPeople"
            value={formData.numberOfPeople}
            onChange={handleChange}
            min="1"
            max="20"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </div>
            ) : (
              'Submit Booking Request'
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This is a booking request. We will review your request and contact you within 24 hours to confirm availability and arrange payment.
        </p>
      </div>
    </div>
  );
};

export default BookingForm;