import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ApiResponse } from '../types';

interface Review {
  id: number;
  authorName: string;
  rating: number;
  text: string;
  isModerated: boolean;
  createdAt: string;
  tour: {
    id: number;
    title: { en: string; ru: string };
    category: {
      name: { en: string; ru: string };
    };
  };
}

const ReviewsTable: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ApiResponse>('http://localhost:3001/api/tours/reviews');
      if (response.data.success) {
        setReviews(response.data.data);
      }
    } catch (err) {
      setError('Failed to fetch reviews');
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (reviewId: number, isModerated: boolean) => {
    try {
      setUpdating(reviewId);
      const response = await axios.put<ApiResponse>(`http://localhost:3001/api/tours/reviews/${reviewId}`, {
        isModerated
      });

      if (response.data.success) {
        // Update the review in the local state
        setReviews(prev => prev.map(review => 
          review.id === reviewId 
            ? { ...review, isModerated }
            : review
        ));
      }
    } catch (err) {
      console.error('Error updating review:', err);
      alert('Failed to update review moderation status');
    } finally {
      setUpdating(null);
    }
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Reviews</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Reviews</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-red-600 mb-2">{error}</div>
          <button
            onClick={fetchReviews}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const pendingReviews = reviews.filter(r => !r.isModerated);
  const approvedReviews = reviews.filter(r => r.isModerated);

  return (
    <div className="space-y-6">
      {/* Pending Reviews */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full mr-3">
                {pendingReviews.length}
              </span>
              Pending Reviews
            </h2>
            <button
              onClick={fetchReviews}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {pendingReviews.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500">No pending reviews</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingReviews.map((review) => (
              <div key={review.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="font-medium text-gray-900 mr-3">
                        {review.authorName}
                      </div>
                      <div className="flex items-center mr-3">
                        {renderStars(review.rating)}
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDateTime(review.createdAt)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      Tour: <span className="font-medium">{review.tour.title.en}</span>
                      <span className="mx-2">•</span>
                      {review.tour.category.name.en}
                    </div>
                    
                    <p className="text-gray-800 mb-4">
                      {review.text}
                    </p>
                  </div>
                  
                  <div className="ml-4 flex space-x-2">
                    <button
                      onClick={() => handleModerate(review.id, true)}
                      disabled={updating === review.id}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                    >
                      {updating === review.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Approving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Reviews */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mr-3">
              {approvedReviews.length}
            </span>
            Approved Reviews
          </h2>
        </div>

        {approvedReviews.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500">No approved reviews yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {approvedReviews.slice(0, 10).map((review) => (
              <div key={review.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="font-medium text-gray-900 mr-3">
                        {review.authorName}
                      </div>
                      <div className="flex items-center mr-3">
                        {renderStars(review.rating)}
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDateTime(review.createdAt)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      Tour: <span className="font-medium">{review.tour.title.en}</span>
                      <span className="mx-2">•</span>
                      {review.tour.category.name.en}
                    </div>
                    
                    <p className="text-gray-800">
                      {review.text}
                    </p>
                  </div>
                  
                  <div className="ml-4">
                    <button
                      onClick={() => handleModerate(review.id, false)}
                      disabled={updating === review.id}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {updating === review.id ? 'Hiding...' : 'Hide'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {approvedReviews.length > 10 && (
              <div className="p-4 text-center text-gray-500">
                Showing first 10 of {approvedReviews.length} approved reviews
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewsTable;