import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tour, ApiResponse } from '../types';

const TourList: React.FC = () => {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTours = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ApiResponse<Tour[]>>('http://localhost:3001/api/tours');
        
        if (response.data.success && response.data.data) {
          setTours(response.data.data);
        } else {
          setError(response.data.error || 'Failed to fetch tours');
        }
      } catch (err) {
        setError('Error connecting to the API. Make sure the backend is running.');
        console.error('Error fetching tours:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTours();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
        Tajik Trails - Discover Tajikistan
      </h2>
      
      {tours.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 text-lg">No tours available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours.map((tour) => (
            <div 
              key={tour.id} 
              className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-semibold text-gray-800 leading-tight">
                    {tour.title.en}
                  </h3>
                  <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                    {tour.category.name.en}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {tour.description.en}
                </p>
                
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Duration:</span> {tour.duration}
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {tour.price}
                  </div>
                </div>
                
                <div className="mt-4">
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200">
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TourList;