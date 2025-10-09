import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Tour, Category, ApiResponse } from '../types';

// Компонент для множественного выбора
interface MultiSelectProps {
  options: { id: number; name: any }[];
  selectedValues: number[];
  onChange: (selected: number[]) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ 
  options, 
  selectedValues, 
  onChange, 
  placeholder, 
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (optionId: number) => {
    if (selectedValues.includes(optionId)) {
      onChange(selectedValues.filter(id => id !== optionId));
    } else {
      onChange([...selectedValues, optionId]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const selected = options.find(opt => opt.id === selectedValues[0]);
      return selected ? (typeof selected.name === 'object' ? selected.name.ru : selected.name) : placeholder;
    }
    return `Выбрано: ${selectedValues.length}`;
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer bg-white ${disabled ? 'bg-gray-100' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedValues.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {getDisplayText()}
        </span>
        <span className="float-right">▼</span>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.id}
              className={`px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center ${
                selectedValues.includes(option.id) ? 'bg-blue-100' : ''
              }`}
              onClick={() => toggleOption(option.id)}
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(option.id)}
                onChange={() => {}} // Обрабатывается через onClick
                className="mr-2"
              />
              <span>
                {typeof option.name === 'object' ? option.name.ru : option.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface TourFormProps {
  tour?: Tour | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const TourForm: React.FC<TourFormProps> = ({ tour, onSuccess, onCancel }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Input states for builders to avoid document.getElementById
  const [newStartTime, setNewStartTime] = useState('');
  const [newItineraryTime, setNewItineraryTime] = useState('');
  const [newItineraryTitle, setNewItineraryTitle] = useState('');
  const [newItineraryDesc, setNewItineraryDesc] = useState('');
  const [newIncludedService, setNewIncludedService] = useState('');
  const [newExcludedService, setNewExcludedService] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newHotelAssociation, setNewHotelAssociation] = useState('');
  const [newGuideAssociation, setNewGuideAssociation] = useState('');
  
  // Extended form data structure to match HTML tourModal
  const [formData, setFormData] = useState({
    // Basic multilingual fields
    title_en: '',
    title_ru: '',
    title_tj: '',
    description_en: '',
    description_ru: '',
    description_tj: '',
    
    // Tour type and basic info
    tourType: '', // Персональный/Групповой персональный/Групповой общий
    
    // Location (старые поля для совместимости)
    countryId: 0,
    cityId: 0,
    
    // Новые поля для множественного выбора
    countriesIds: [] as number[],
    citiesIds: [] as number[],
    
    // Duration
    durationDays: '',
    durationHours: '', // For short tours
    
    // Pricing
    price: '',
    priceType: 'за человека', // за человека/за группу
    
    // Category and blocks
    categoryId: 0,
    
    // People limits
    minPeople: '',
    maxPeople: '',
    
    // Pickup information
    pickupInfo: '',
    
    // Times and availability
    startTimes: [] as string[], // Multiple start times
    availableMonths: [] as string[],
    availableDays: [] as string[],
    
    // Languages
    languages: [] as string[],
    
    // Tour program (itinerary)
    itinerary: [] as Array<{time: string, title: string, description: string}>,
    
    // Services
    includedServices: [] as string[],
    excludedServices: [] as string[],
    
    // Images
    images: [] as string[],
    
    // Associated hotels and guides (IDs as numbers)
    associatedHotels: [] as number[],
    associatedGuides: [] as number[]
  });

  useEffect(() => {
    fetchCategories();
    fetchCountries();
    fetchHotels();
    fetchGuides();
    
    // Pre-fill form if editing
    if (tour) {
      const tourData = tour as any;
      setFormData({
        title_en: (typeof tour.title === 'object' ? tour.title.en : tour.title) || '',
        title_ru: (typeof tour.title === 'object' ? tour.title.ru : tour.title) || '',
        title_tj: (typeof tour.title === 'object' && 'tj' in tour.title ? (tour.title as any).tj : '') || '',
        description_en: (typeof tour.description === 'object' ? tour.description.en : tour.description) || '',
        description_ru: (typeof tour.description === 'object' ? tour.description.ru : tour.description) || '',
        description_tj: (typeof tour.description === 'object' && 'tj' in tour.description ? (tour.description as any).tj : '') || '',
        
        tourType: tourData.tourType || '',
        countryId: tourData.countryId || 0,
        cityId: tourData.cityId || 0,
        
        // Новые множественные поля
        countriesIds: tourData.countriesIds || [],
        citiesIds: tourData.citiesIds || [],
        durationDays: tourData.durationDays || tour.duration || '',
        durationHours: tourData.durationHours || '',
        price: tour.price || '',
        priceType: tourData.priceType || 'за человека',
        categoryId: tour.categoryId || 0,
        minPeople: tourData.minPeople || '',
        maxPeople: tourData.maxPeople || '',
        pickupInfo: tourData.pickupInfo || '',
        
        startTimes: tourData.startTimes ? JSON.parse(tourData.startTimes) : [],
        languages: tourData.languages ? JSON.parse(tourData.languages) : [],
        availableMonths: tourData.availableMonths ? JSON.parse(tourData.availableMonths) : [],
        availableDays: tourData.availableDays ? JSON.parse(tourData.availableDays) : [],
        
        itinerary: tourData.itinerary ? JSON.parse(tourData.itinerary) : [],
        includedServices: tourData.includedServices ? JSON.parse(tourData.includedServices) : [],
        excludedServices: tourData.excludedServices ? JSON.parse(tourData.excludedServices) : [],
        images: tourData.images ? JSON.parse(tourData.images) : [],
        associatedHotels: tourData.associatedHotels ? JSON.parse(tourData.associatedHotels) : [],
        associatedGuides: tourData.associatedGuides ? JSON.parse(tourData.associatedGuides) : []
      });
      
      // Load cities for selected country (старая логика)
      if (tourData.countryId) {
        fetchCitiesForCountry(tourData.countryId);
      }
      
      // Загружаем города для новых множественных стран
      if (tourData.countriesIds && tourData.countriesIds.length > 0) {
        fetchCitiesForCountries(tourData.countriesIds);
      }
    }
  }, [tour]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get<ApiResponse>('/api/categories');
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchCountries = async () => {
    try {
      const response = await axios.get<ApiResponse>('/api/countries');
      if (response.data.success) {
        setCountries(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching countries:', err);
    }
  };

  const fetchCitiesForCountry = async (countryId: number) => {
    try {
      const response = await axios.get<ApiResponse>(`/api/cities?countryId=${countryId}`);
      if (response.data.success) {
        setCities(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching cities:', err);
    }
  };

  const fetchCitiesForCountries = async (countryIds: number[]) => {
    if (countryIds.length === 0) {
      setCities([]);
      return;
    }
    
    try {
      // Загружаем города для всех выбранных стран
      const citiesPromises = countryIds.map(countryId => 
        axios.get<ApiResponse>(`/api/cities?countryId=${countryId}`)
      );
      
      const responses = await Promise.all(citiesPromises);
      
      // Объединяем все города из разных стран
      const allCities = responses
        .filter(response => response.data.success)
        .flatMap(response => response.data.data)
        .filter((city, index, self) => 
          // Убираем дубликаты по id
          index === self.findIndex(c => c.id === city.id)
        );
      
      setCities(allCities);
    } catch (err) {
      console.error('Error fetching cities for multiple countries:', err);
    }
  };

  const fetchHotels = async () => {
    try {
      const response = await axios.get<ApiResponse>('/api/hotels');
      if (response.data.success) {
        setHotels(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching hotels:', err);
    }
  };

  const fetchGuides = async () => {
    try {
      const response = await axios.get<ApiResponse>('/api/guides');
      if (response.data.success) {
        setGuides(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching guides:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle special cases
    if (name === 'countryId') {
      const countryId = parseInt(value) || 0;
      setFormData(prev => ({ ...prev, countryId, cityId: 0 })); // Reset city when country changes
      setCities([]); // Clear cities
      if (countryId > 0) {
        fetchCitiesForCountry(countryId);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: ['categoryId', 'countryId', 'cityId'].includes(name) ? parseInt(value) || 0 : value
      }));
    }
  };

  // Обработчики для множественного выбора
  const handleCountriesChange = (selectedCountries: number[]) => {
    setFormData(prev => ({ 
      ...prev, 
      countriesIds: selectedCountries,
      citiesIds: [] // Сбрасываем города при изменении стран
    }));
    
    // Загружаем города для выбранных стран
    fetchCitiesForCountries(selectedCountries);
  };

  const handleCitiesChange = (selectedCities: number[]) => {
    setFormData(prev => ({ 
      ...prev, 
      citiesIds: selectedCities
    }));
  };
  
  // Handle multiple checkbox selections  
  const handleMultipleSelection = (name: 'availableMonths' | 'availableDays' | 'languages' | 'associatedHotels' | 'associatedGuides', value: string | number) => {
    setFormData(prev => {
      const currentValues = prev[name] as any[];
      
      // Ensure type consistency for numeric arrays
      let normalizedValue = value;
      if ((name === 'associatedHotels' || name === 'associatedGuides') && typeof value === 'string') {
        normalizedValue = parseInt(value, 10);
      }
      
      const newValues = currentValues.includes(normalizedValue)
        ? currentValues.filter(item => item !== normalizedValue)
        : [...currentValues, normalizedValue];
      
      return {
        ...prev,
        [name]: newValues
      };
    });
  };
  
  // Add itinerary item
  const addItineraryItem = (time: string, title: string, description: string) => {
    if (time && title) {
      setFormData(prev => ({
        ...prev,
        itinerary: [...prev.itinerary, { time, title, description }]
      }));
    }
  };
  
  // Remove itinerary item
  const removeItineraryItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      itinerary: prev.itinerary.filter((_, i) => i !== index)
    }));
  };
  
  // Add start time
  const addStartTime = (time: string) => {
    if (time && !formData.startTimes.includes(time)) {
      setFormData(prev => ({
        ...prev,
        startTimes: [...prev.startTimes, time]
      }));
    }
  };
  
  // Remove start time
  const removeStartTime = (time: string) => {
    setFormData(prev => ({
      ...prev,
      startTimes: prev.startTimes.filter(t => t !== time)
    }));
  };
  
  // Add excluded service
  const addExcludedService = (service: string) => {
    if (service && !formData.excludedServices.includes(service)) {
      setFormData(prev => ({
        ...prev,
        excludedServices: [...prev.excludedServices, service]
      }));
    }
  };
  
  // Remove excluded service
  const removeExcludedService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      excludedServices: prev.excludedServices.filter(s => s !== service)
    }));
  };

  // Add included service
  const addIncludedService = (service: string) => {
    if (service && !formData.includedServices.includes(service)) {
      setFormData(prev => ({
        ...prev,
        includedServices: [...prev.includedServices, service]
      }));
    }
  };

  // Remove included service
  const removeIncludedService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      includedServices: prev.includedServices.filter(s => s !== service)
    }));
  };

  // Add image
  const addImage = (imageUrl: string) => {
    if (imageUrl && !formData.images.includes(imageUrl)) {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, imageUrl]
      }));
    }
  };

  // Remove image
  const removeImage = (imageUrl: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img !== imageUrl)
    }));
  };

  // Add associated hotel
  const addAssociatedHotel = (hotel: string) => {
    const hotelId = parseInt(hotel, 10);
    if (hotelId && !isNaN(hotelId) && !formData.associatedHotels.includes(hotelId)) {
      setFormData(prev => ({
        ...prev,
        associatedHotels: [...prev.associatedHotels, hotelId]
      }));
    }
  };

  // Remove associated hotel
  const removeAssociatedHotel = (hotel: number | string) => {
    const hotelId = typeof hotel === 'number' ? hotel : parseInt(hotel, 10);
    setFormData(prev => ({
      ...prev,
      associatedHotels: prev.associatedHotels.filter(h => h !== hotelId)
    }));
  };

  // Add associated guide
  const addAssociatedGuide = (guide: string) => {
    const guideId = parseInt(guide, 10);
    if (guideId && !isNaN(guideId) && !formData.associatedGuides.includes(guideId)) {
      setFormData(prev => ({
        ...prev,
        associatedGuides: [...prev.associatedGuides, guideId]
      }));
    }
  };

  // Remove associated guide
  const removeAssociatedGuide = (guide: number | string) => {
    const guideId = typeof guide === 'number' ? guide : parseInt(guide, 10);
    setFormData(prev => ({
      ...prev,
      associatedGuides: prev.associatedGuides.filter(g => g !== guideId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Package all tour data including multilingual fields
    const tourData = {
      title: {
        en: formData.title_en,
        ru: formData.title_ru,
        tj: formData.title_tj,
      },
      description: {
        en: formData.description_en,
        ru: formData.description_ru,
        tj: formData.description_tj,
      },
      
      // Basic tour info
      tourType: formData.tourType,
      countryId: formData.countryId,
      cityId: formData.cityId,
      
      // Новые множественные поля
      countriesIds: formData.countriesIds,
      citiesIds: formData.citiesIds,
      durationDays: formData.durationDays,
      durationHours: formData.durationHours,
      
      // Pricing
      price: formData.price,
      priceType: formData.priceType,
      
      // Category
      categoryId: formData.categoryId,
      
      // People limits
      minPeople: formData.minPeople,
      maxPeople: formData.maxPeople,
      
      // Pickup info
      pickupInfo: formData.pickupInfo,
      
      // Serialized arrays
      startTimes: JSON.stringify(formData.startTimes),
      languages: JSON.stringify(formData.languages),
      availableMonths: JSON.stringify(formData.availableMonths),
      availableDays: JSON.stringify(formData.availableDays),
      itinerary: JSON.stringify(formData.itinerary),
      includedServices: JSON.stringify(formData.includedServices),
      excludedServices: JSON.stringify(formData.excludedServices),
      images: JSON.stringify(formData.images),
      associatedHotels: JSON.stringify(formData.associatedHotels),
      associatedGuides: JSON.stringify(formData.associatedGuides)
    };

    try {
      let response;
      
      if (tour) {
        // Update existing tour
        response = await axios.put<ApiResponse>(`/api/tours/${tour.id}`, tourData);
      } else {
        // Create new tour
        response = await axios.post<ApiResponse>('/api/tours', tourData);
      }

      if (response.data.success) {
        setMessage({ 
          type: 'success', 
          text: tour ? 'Tour updated successfully!' : 'Tour created successfully!' 
        });
        
        // Reset form if creating new
        if (!tour) {
          setFormData({
            title_en: '',
            title_ru: '',
            title_tj: '',
            description_en: '',
            description_ru: '',
            description_tj: '',
            tourType: '',
            countryId: 0,
            cityId: 0,
            
            // Новые поля множественного выбора
            countriesIds: [],
            citiesIds: [],
            durationDays: '',
            durationHours: '',
            price: '',
            priceType: 'за человека',
            categoryId: 0,
            minPeople: '',
            maxPeople: '',
            pickupInfo: '',
            startTimes: [],
            availableMonths: [],
            availableDays: [],
            languages: [],
            itinerary: [],
            includedServices: [],
            excludedServices: [],
            images: [],
            associatedHotels: [],
            associatedGuides: []
          });
          setCities([]);
        }
        
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Tour form error:', err);
      
      let errorMessage = 'Failed to save tour. Please try again.';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white">
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* English Fields */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🇺🇸</span>
            English Content
          </h4>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title_en" className="block text-sm font-medium text-gray-700 mb-1">
                Title (English) *
              </label>
              <input
                type="text"
                id="title_en"
                name="title_en"
                value={formData.title_en}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter tour title in English"
              />
            </div>

            <div>
              <label htmlFor="description_en" className="block text-sm font-medium text-gray-700 mb-1">
                Description (English) *
              </label>
              <textarea
                id="description_en"
                name="description_en"
                value={formData.description_en}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter detailed description in English"
              />
            </div>
          </div>
        </div>

        {/* Russian Fields */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🇷🇺</span>
            Russian Content
          </h4>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title_ru" className="block text-sm font-medium text-gray-700 mb-1">
                Title (Russian) *
              </label>
              <input
                type="text"
                id="title_ru"
                name="title_ru"
                value={formData.title_ru}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите название тура на русском"
              />
            </div>

            <div>
              <label htmlFor="description_ru" className="block text-sm font-medium text-gray-700 mb-1">
                Description (Russian) *
              </label>
              <textarea
                id="description_ru"
                name="description_ru"
                value={formData.description_ru}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите подробное описание на русском языке"
              />
            </div>
          </div>
        </div>

        {/* Tajik Fields */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🇹🇯</span>
            Tajik Content
          </h4>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title_tj" className="block text-sm font-medium text-gray-700 mb-1">
                Title (Tajik)
              </label>
              <input
                type="text"
                id="title_tj"
                name="title_tj"
                value={formData.title_tj}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Номи сайёҳатро бо забони тоҷикӣ ворид кунед"
              />
            </div>

            <div>
              <label htmlFor="description_tj" className="block text-sm font-medium text-gray-700 mb-1">
                Description (Tajik)
              </label>
              <textarea
                id="description_tj"
                name="description_tj"
                value={formData.description_tj}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Тавсифи муфассали сайёҳатро бо забони тоҷикӣ ворид кунед"
              />
            </div>
          </div>
        </div>

        {/* Tour Type */}
        <div>
          <label htmlFor="tourType" className="block text-sm font-medium text-gray-700 mb-1">
            Тип тура *
          </label>
          <select
            id="tourType"
            name="tourType"
            value={formData.tourType}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Выберите тип тура</option>
            <option value="Персональный">Персональный</option>
            <option value="Групповой персональный">Групповой персональный</option>
            <option value="Групповой общий">Групповой общий</option>
          </select>
        </div>

        {/* Location: Country and City */}
        <div className="space-y-4">
          {/* Новые множественные селекты */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Страны (множественный выбор) *
              </label>
              <MultiSelect
                options={countries}
                selectedValues={formData.countriesIds}
                onChange={handleCountriesChange}
                placeholder="Выберите страны"
                className=""
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Города (множественный выбор) *
              </label>
              <MultiSelect
                options={cities}
                selectedValues={formData.citiesIds}
                onChange={handleCitiesChange}
                placeholder={formData.countriesIds.length === 0 ? "Сначала выберите страны" : "Выберите города"}
                disabled={formData.countriesIds.length === 0}
                className=""
              />
            </div>
          </div>

          {/* Старые одиночные селекты для совместимости (скрыты) */}
          <div className="hidden grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="countryId" className="block text-sm font-medium text-gray-700 mb-1">
                Страна (одиночный выбор) - для совместимости
              </label>
              <select
                id="countryId"
                name="countryId"
                value={formData.countryId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={0}>Выберите страну</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {typeof country.name === 'object' ? country.name.ru : country.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cityId" className="block text-sm font-medium text-gray-700 mb-1">
                Город (одиночный выбор) - для совместимости
              </label>
              <select
                id="cityId"
                name="cityId"
                value={formData.cityId}
                onChange={handleChange}
                disabled={!formData.countryId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value={0}>
                  {formData.countryId ? 'Выберите город' : 'Сначала выберите страну'}
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {typeof city.name === 'object' ? city.name.ru : city.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Duration and Pricing */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="durationDays" className="block text-sm font-medium text-gray-700 mb-1">
              Длительность (дней) *
            </label>
            <input
              type="number"
              id="durationDays"
              name="durationDays"
              value={formData.durationDays}
              onChange={handleChange}
              required
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="5"
            />
          </div>

          <div>
            <label htmlFor="durationHours" className="block text-sm font-medium text-gray-700 mb-1">
              Часы (для коротких туров)
            </label>
            <input
              type="number"
              id="durationHours"
              name="durationHours"
              value={formData.durationHours}
              onChange={handleChange}
              min="1"
              max="24"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="8"
            />
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              Цена *
            </label>
            <input
              type="text"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="500"
            />
          </div>
        </div>

        {/* Price Type */}
        <div>
          <label htmlFor="priceType" className="block text-sm font-medium text-gray-700 mb-1">
            Тип цены *
          </label>
          <select
            id="priceType"
            name="priceType"
            value={formData.priceType}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="за человека">За человека</option>
            <option value="за группу">За группу</option>
          </select>
        </div>

        {/* People Limits */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="minPeople" className="block text-sm font-medium text-gray-700 mb-1">
              Минимальное количество людей
            </label>
            <input
              type="number"
              id="minPeople"
              name="minPeople"
              value={formData.minPeople}
              onChange={handleChange}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="2"
            />
          </div>

          <div>
            <label htmlFor="maxPeople" className="block text-sm font-medium text-gray-700 mb-1">
              Максимальное количество людей
            </label>
            <input
              type="number"
              id="maxPeople"
              name="maxPeople"
              value={formData.maxPeople}
              onChange={handleChange}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="12"
            />
          </div>
        </div>

        {/* Pickup Information */}
        <div>
          <label htmlFor="pickupInfo" className="block text-sm font-medium text-gray-700 mb-1">
            Информация о приёме/сборе *
          </label>
          <input
            type="text"
            id="pickupInfo"
            name="pickupInfo"
            value={formData.pickupInfo}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Например: Приём включён, Место сбора: отель, и т.д."
          />
        </div>

        {/* Start Times Management */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Доступное время начала тура
          </label>
          <div className="space-y-2 mb-3">
            {formData.startTimes.map((time, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="flex-1 font-mono">{time}</span>
                <button
                  type="button"
                  onClick={() => removeStartTime(time)}
                  className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
                >
                  <i className="fas fa-times"></i> Удалить
                </button>
              </div>
            ))}
            {formData.startTimes.length === 0 && (
              <p className="text-gray-500 text-sm italic">Нет добавленных вариантов времени</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="07:30"
            />
            <button
              type="button"
              onClick={() => {
                if (newStartTime) {
                  addStartTime(newStartTime);
                  setNewStartTime('');
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg"
            >
              Добавить время
            </button>
          </div>
          <small className="text-gray-500 mt-2 block">Добавьте возможные варианты времени начала тура</small>
        </div>

        {/* Itinerary Builder */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Программа тура
          </label>
          <div className="space-y-3 mb-3">
            {formData.itinerary.map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 border rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 font-mono text-sm mt-1">{item.time}</div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.title}</div>
                    {item.description && (
                      <div className="text-gray-600 text-sm mt-1">{item.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItineraryItem(index)}
                    className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            ))}
            {formData.itinerary.length === 0 && (
              <p className="text-gray-500 text-sm italic">Программа тура не добавлена</p>
            )}
          </div>
          
          <div className="bg-gray-50 p-4 rounded border">
            <div className="grid grid-cols-4 gap-3 mb-3">
              <input
                type="time"
                value={newItineraryTime}
                onChange={(e) => setNewItineraryTime(e.target.value)}
                className="form-input"
                placeholder="08:00"
              />
              <input
                type="text"
                value={newItineraryTitle}
                onChange={(e) => setNewItineraryTitle(e.target.value)}
                className="form-input col-span-2"
                placeholder="Встреча с гидом"
              />
              <button
                type="button"
                onClick={() => {
                  if (newItineraryTime && newItineraryTitle) {
                    addItineraryItem(newItineraryTime, newItineraryTitle, newItineraryDesc);
                    setNewItineraryTime('');
                    setNewItineraryTitle('');
                    setNewItineraryDesc('');
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Добавить
              </button>
            </div>
            <textarea
              value={newItineraryDesc}
              onChange={(e) => setNewItineraryDesc(e.target.value)}
              className="form-input w-full"
              rows={2}
              placeholder="Подробное описание этапа программы"
            ></textarea>
          </div>
          <small className="text-gray-500 mt-2 block">Создайте расписание тура по времени</small>
        </div>

        {/* Services Management */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Included Services */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Услуги включенные в тур
            </label>
            <div className="text-sm text-gray-600 mb-3">
              ✅ Услуги, включенные в стоимость тура
            </div>
            <div className="space-y-2 mb-3 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
              {formData.includedServices.length > 0 ? (
                formData.includedServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-1">
                    <span className="text-gray-700">
                      <i className="fas fa-check text-green-600 mr-2"></i>
                      {service}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeIncludedService(service)}
                      className="text-red-600 hover:text-red-800 px-1"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-4">
                  <i className="fas fa-plus-circle mr-2"></i>
                  Добавьте услуги, включенные в стоимость тура
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newIncludedService}
                onChange={(e) => setNewIncludedService(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Введите название услуги"
              />
              <button
                type="button"
                onClick={() => {
                  if (newIncludedService.trim()) {
                    addIncludedService(newIncludedService.trim());
                    setNewIncludedService('');
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>

          {/* Excluded Services */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Не включено в тур
            </label>
            <div className="text-sm text-gray-600 mb-3">
              ❌ Услуги и расходы, которые туристы оплачивают самостоятельно
            </div>
            <div className="space-y-2 mb-3 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
              {formData.excludedServices.length > 0 ? (
                formData.excludedServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-1">
                    <span className="text-gray-700">
                      <i className="fas fa-times text-red-600 mr-2"></i>
                      {service}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExcludedService(service)}
                      className="text-red-600 hover:text-red-800 px-1"
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-4">
                  <i className="fas fa-info-circle mr-2"></i>
                  Добавьте услуги, которые не включены в стоимость тура
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newExcludedService}
                onChange={(e) => setNewExcludedService(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Введите название услуги"
              />
              <button
                type="button"
                onClick={() => {
                  if (newExcludedService.trim()) {
                    addExcludedService(newExcludedService.trim());
                    setNewExcludedService('');
                  }
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Image Gallery Management */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Галерея изображений тура
          </label>
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
            {formData.images.length > 0 ? (
              formData.images.map((imageUrl, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-white rounded">
                  <div className="flex items-center space-x-2">
                    <img 
                      src={imageUrl} 
                      alt={`Tour image ${index + 1}`}
                      className="w-12 h-12 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyOEgxMlYxMkgyOFYyOFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
                      }}
                    />
                    <span className="text-gray-700 truncate max-w-xs">
                      {imageUrl}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(imageUrl)}
                    className="text-red-600 hover:text-red-800 px-2 py-1"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-6">
                <i className="fas fa-images mr-2"></i>
                Нет добавленных изображений
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="https://example.com/image.jpg"
            />
            <button
              type="button"
              onClick={() => {
                if (newImageUrl.trim()) {
                  addImage(newImageUrl.trim());
                  setNewImageUrl('');
                }
              }}
              className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-2 rounded-lg text-sm"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
          <small className="text-gray-500 mt-2 block">Добавьте URL изображений для галереи тура</small>
        </div>

        {/* Hotel and Guide Associations */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Associated Hotels */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Связанные отели
            </label>
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
              {formData.associatedHotels.length > 0 ? (
                formData.associatedHotels.map((hotel, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 bg-white rounded">
                    <span className="text-gray-700">
                      <i className="fas fa-building text-blue-600 mr-2"></i>
                      {hotel}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAssociatedHotel(hotel)}
                      className="text-red-600 hover:text-red-800 px-1"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-6">
                  <i className="fas fa-hotel mr-2"></i>
                  Нет связанных отелей
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newHotelAssociation}
                onChange={(e) => setNewHotelAssociation(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Название отеля"
              />
              <button
                type="button"
                onClick={() => {
                  if (newHotelAssociation.trim()) {
                    addAssociatedHotel(newHotelAssociation.trim());
                    setNewHotelAssociation('');
                  }
                }}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>

          {/* Associated Guides */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Рекомендуемые гиды
            </label>
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
              {formData.associatedGuides.length > 0 ? (
                formData.associatedGuides.map((guide, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 bg-white rounded">
                    <span className="text-gray-700">
                      <i className="fas fa-user-tie text-green-600 mr-2"></i>
                      {guide}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAssociatedGuide(guide)}
                      className="text-red-600 hover:text-red-800 px-1"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-6">
                  <i className="fas fa-user-friends mr-2"></i>
                  Нет связанных гидов
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGuideAssociation}
                onChange={(e) => setNewGuideAssociation(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Имя гида"
              />
              <button
                type="button"
                onClick={() => {
                  if (newGuideAssociation.trim()) {
                    addAssociatedGuide(newGuideAssociation.trim());
                    setNewGuideAssociation('');
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select
            id="categoryId"
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={0}>Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {typeof category.name === 'object' ? category.name.en : category.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Additional Tour Details */}
        <div className="grid md:grid-cols-3 gap-4">
        </div>
        
        {/* Languages */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Языки тура (select all that apply)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'russian', label: 'Русский' },
              { value: 'english', label: 'Английский' },
              { value: 'tajik', label: 'Таджикский' },
              { value: 'uzbek', label: 'Узбекский' },
              { value: 'kyrgyz', label: 'Киргизский' },
              { value: 'kazakh', label: 'Казахский' },
              { value: 'turkmen', label: 'Туркменский' },
              { value: 'persian', label: 'Персидский' },
              { value: 'arabic', label: 'Арабский' }
            ].map(language => (
              <label key={language.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.languages.includes(language.value)}
                  onChange={() => handleMultipleSelection('languages', language.value)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="text-sm text-gray-700">{language.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Available Months */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Available Months (select all that apply)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'january', label: 'Январь' },
              { value: 'february', label: 'Февраль' },
              { value: 'march', label: 'Март' },
              { value: 'april', label: 'Апрель' },
              { value: 'may', label: 'Май' },
              { value: 'june', label: 'Июнь' },
              { value: 'july', label: 'Июль' },
              { value: 'august', label: 'Август' },
              { value: 'september', label: 'Сентябрь' },
              { value: 'october', label: 'Октябрь' },
              { value: 'november', label: 'Ноябрь' },
              { value: 'december', label: 'Декабрь' }
            ].map(month => (
              <label key={month.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.availableMonths.includes(month.value)}
                  onChange={() => handleMultipleSelection('availableMonths', month.value)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="text-sm text-gray-700">{month.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Available Days of Week */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Available Days of Week (select all that apply)
          </label>
          <div className="grid grid-cols-4 gap-3">
            {[
              { value: 'monday', label: 'Понедельник' },
              { value: 'tuesday', label: 'Вторник' },
              { value: 'wednesday', label: 'Среда' },
              { value: 'thursday', label: 'Четверг' },
              { value: 'friday', label: 'Пятница' },
              { value: 'saturday', label: 'Суббота' },
              { value: 'sunday', label: 'Воскресенье' }
            ].map(day => (
              <label key={day.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.availableDays.includes(day.value)}
                  onChange={() => handleMultipleSelection('availableDays', day.value)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="text-sm text-gray-700">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2 rounded-lg text-white font-medium transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {tour ? 'Updating...' : 'Creating...'}
              </div>
            ) : (
              tour ? 'Update Tour' : 'Create Tour'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TourForm;