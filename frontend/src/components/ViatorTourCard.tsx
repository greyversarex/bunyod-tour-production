import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tour } from '../types';

interface TourCardProps {
  tour: Tour;
}

const ViatorTourCard: React.FC<TourCardProps> = ({ tour }) => {
  const { t, i18n } = useTranslation();

  const getBadge = () => {
    const badges = ['Best Seller', 'Likely to Sell Out', 'Special Offer'];
    return badges[Math.floor(Math.random() * badges.length)];
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'Best Seller': return 'bg-green-500';
      case 'Likely to Sell Out': return 'bg-red-500';
      case 'Special Offer': return 'bg-purple-500';
      default: return 'bg-blue-500';
    }
  };

  const badge = getBadge();

  return (
    <Link
      to={`/tours/${tour.id}`}
      className="group block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    >
      <div className="relative">
        {/* Tour Image Placeholder with Gradient */}
        <div className="w-full h-48 bg-gradient-to-br from-blue-500 via-green-400 to-yellow-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          
          {/* Badge */}
          <div className="absolute top-3 left-3">
            <span className={`${getBadgeColor(badge)} text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide`}>
              {badge}
            </span>
          </div>
          
          {/* Duration */}
          <div className="absolute bottom-3 right-3">
            <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm font-medium">
              {tour.duration}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {/* Category */}
        <div className="text-sm text-gray-500 mb-2">
          {tour.category && (tour.category.name[i18n.language as keyof typeof tour.category.name] || tour.category.name.en)}
        </div>
        
        {/* Title */}
        <h3 className="font-bold text-lg mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
          {tour.title[i18n.language as keyof typeof tour.title] || tour.title.en}
        </h3>
        
        {/* Description */}
        <p className="text-gray-600 text-sm mb-3 line-clamp-3">
          {tour.description[i18n.language as keyof typeof tour.description] || tour.description.en}
        </p>
        
        {/* Rating */}
        <div className="flex items-center mb-3">
          <div className="flex items-center text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
              </svg>
            ))}
          </div>
          <span className="text-gray-500 text-sm ml-2">(4.{Math.floor(Math.random() * 4) + 5})</span>
          <span className="text-gray-400 text-sm ml-1">• {Math.floor(Math.random() * 1000) + 100} reviews</span>
        </div>
        
        {/* Features */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
            {t('tour.features.free_cancellation', 'Free Cancellation')}
          </span>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
            {t('tour.features.skip_line', 'Skip the Line')}
          </span>
        </div>
        
        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600">{Math.round(parseFloat(tour.price) || 0)} TJS</div>
            <div className="text-xs text-gray-500">{t('tour.per_person', 'per person')}</div>
          </div>
          <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors">
            {t('tour.book_now', 'Book Now')}
          </button>
        </div>
      </div>
    </Link>
  );
};

export default ViatorTourCard;