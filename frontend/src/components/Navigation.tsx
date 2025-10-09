import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

const Navigation: React.FC = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white shadow-lg border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TT</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Tajik Trails</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              {t('navigation.home', 'Home')}
            </Link>
            <Link 
              to="/tours" 
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              {t('navigation.tours', 'Tours')}
            </Link>
            <Link 
              to="/about" 
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              {t('navigation.about', 'About')}
            </Link>
            <Link 
              to="/contact" 
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              {t('navigation.contact', 'Contact')}
            </Link>
            <Link 
              to="/visa-support" 
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              {t('navigation.visa_support', 'Визовая поддержка')}
            </Link>
            <LanguageSwitcher />
            
            {/* CTA Button */}
            <Link
              to="/tours"
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              {t('navigation.book_now', 'Book Now')}
            </Link>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-4">
            <LanguageSwitcher />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-blue-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                to="/"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('navigation.home', 'Home')}
              </Link>
              <Link
                to="/tours"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('navigation.tours', 'Tours')}
              </Link>
              <Link
                to="/about"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('navigation.about', 'About')}
              </Link>
              <Link
                to="/contact"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('navigation.contact', 'Contact')}
              </Link>
              <Link
                to="/visa-support"
                className="block px-3 py-2 text-gray-700 hover:text-blue-600 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('navigation.visa_support', 'Визовая поддержка')}
              </Link>
              <Link
                to="/tours"
                className="block mx-3 mt-4 bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold text-center hover:bg-orange-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('navigation.book_now', 'Book Now')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;