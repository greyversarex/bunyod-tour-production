import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Tour, Hotel, Guide, BookingRequest } from '../types';

interface BookingDetailsModalProps {
  tourId?: number;
  onClose: () => void;
  onSubmit: (bookingData: any) => void;
}

interface BookingFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  participants: Array<{
    fullName: string;
    dateOfBirth: string;
  }>;
  selectedDate: string;
  selectedHotel?: Hotel;
  selectedRoomCategory?: string;
  selectedGuide?: Guide;
  specialRequests: string;
  agreeToTerms: boolean;
  agreeToPaymentTerms: boolean;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  tourId,
  onClose,
  onSubmit
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'hotel' | 'booking' | 'payment'>('hotel');
  
  // Отладочная информация
  console.log('Current step in render:', step);
  console.log('Step type:', typeof step);
  console.log('Is step hotel?', step === 'hotel');
  console.log('Is step booking?', step === 'booking');
  const [tour, setTour] = useState<Tour | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<BookingFormData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    participants: [{ fullName: '', dateOfBirth: '' }],
    selectedDate: new Date().toISOString().split('T')[0],
    specialRequests: '',
    agreeToTerms: false,
    agreeToPaymentTerms: false
  });

  useEffect(() => {
    if (tourId) {
      fetchTourDetails();
    }
  }, [tourId]);

  const fetchTourDetails = async () => {
    try {
      const [tourRes, hotelsRes, guidesRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/tours/${tourId}`),
        axios.get('http://localhost:5000/api/hotels'),
        axios.get('http://localhost:5000/api/guides')
      ]);

      if (tourRes.data.success) {
        setTour(tourRes.data.data);
      }

      if (hotelsRes.data.success) {
        setHotels(hotelsRes.data.data);
      }

      if (guidesRes.data.success) {
        setGuides(guidesRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching tour details:', error);
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = () => {
    setFormData(prev => ({
      ...prev,
      participants: [...prev.participants, { fullName: '', dateOfBirth: '' }]
    }));
  };

  const removeParticipant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index)
    }));
  };

  const updateParticipant = (index: number, field: 'fullName' | 'dateOfBirth', value: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.map((participant, i) => 
        i === index ? { ...participant, [field]: value } : participant
      )
    }));
  };

  const handleSubmit = async () => {
    if (!formData.agreeToTerms || !formData.agreeToPaymentTerms) {
      alert('Необходимо принять условия соглашения');
      return;
    }

    const bookingData = {
      tourId,
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      participants: formData.participants,
      selectedDate: formData.selectedDate,
      hotelId: formData.selectedHotel?.id,
      guideId: formData.selectedGuide?.id,
      specialRequests: formData.specialRequests
    };

    onSubmit(bookingData);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка данных о туре...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Бронирование тура
              </h3>
              {tour && (
                <p className="text-sm text-gray-600">
                  {typeof tour.title === 'object' ? tour.title.ru : tour.title}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center">
              {['hotel', 'booking', 'payment'].map((stepKey, index) => (
                <React.Fragment key={stepKey}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    step === stepKey ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  {index < 2 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      ['hotel', 'booking', 'payment'].indexOf(step) > index ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-sm text-gray-600">Выбор отеля</span>
              <span className="text-sm text-gray-600">Данные бронирования</span>
              <span className="text-sm text-gray-600">Оплата</span>
            </div>
          </div>

          {/* Step 1: Date and Hotel Selection */}
          {(step === 'hotel' || true) && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold mb-6">Выберите дату и отель</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Date, Time and Hotel Selection */}
                <div className="space-y-6">
                  <div className="form-group">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-calendar-alt text-gray-500 mr-2"></i>
                      Дата начала тура
                    </label>
                    <input 
                      type="date" 
                      value={formData.selectedDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, selectedDate: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-clock text-gray-500 mr-2"></i>
                      Время начала тура
                    </label>
                    <div className="space-y-3">
                      {['09:00', '14:00', '18:00'].map((time) => (
                        <div key={time} className="flex items-center space-x-3">
                          <input 
                            type="radio" 
                            id={`time-${time}`}
                            name="tourTime" 
                            value={time}
                            className="w-4 h-4 text-blue-600"
                          />
                          <label htmlFor={`time-${time}`} className="text-sm text-gray-700">{time}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-users text-gray-500 mr-2"></i>
                      Количество туристов
                    </label>
                    <div className="bg-gray-50 p-4 rounded-lg border text-sm text-gray-700">
                      Туристов: {formData.participants.length}
                    </div>
                  </div>
                  
                  {/* Hotels Selection */}
                  <div className="form-group">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-hotel text-gray-500 mr-2"></i>
                      Доступные отели
                    </label>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {hotels.map((hotel) => (
                        <div
                          key={hotel.id}
                          className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                            formData.selectedHotel?.id === hotel.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-400 hover:shadow-md'
                          }`}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, selectedHotel: hotel }));
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900 text-lg">
                                {typeof hotel.name === 'object' ? hotel.name.ru : hotel.name}
                              </h5>
                              <p className="text-sm text-gray-600 mt-1">
                                {typeof hotel.description === 'object' ? hotel.description?.ru : hotel.description || ''}
                              </p>
                              <div className="flex items-center mt-2 space-x-4">
                                <span className="text-sm font-medium text-blue-600">
                                  {hotel.rating}⭐
                                </span>
                                <span className="text-sm text-gray-500">{hotel.location}</span>
                              </div>
                            </div>
                            {formData.selectedHotel?.id === hotel.id && (
                              <div className="text-blue-500">
                                <i className="fas fa-check-circle text-xl"></i>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button 
                      className={`px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors ${
                        formData.selectedHotel 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      onClick={() => formData.selectedHotel && setStep('booking')}
                      disabled={!formData.selectedHotel}
                    >
                      <span>Продолжить</span>
                      <i className="fas fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
                
                {/* Tour Details Sidebar */}
                <div className="bg-white rounded-lg border shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Детали тура</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <i className="fas fa-map-marker-alt text-blue-500 mt-1"></i>
                      <div>
                        <div className="font-medium">
                          {tour ? (typeof tour.title === 'object' ? tour.title.ru : tour.title) : 'Название тура'}
                        </div>
                        <div className="text-sm text-gray-600">{tour?.city || 'Локация'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <i className="fas fa-clock text-blue-500"></i>
                      <span className="text-sm">{tour?.duration || 'Продолжительность'}</span>
                    </div>
                  </div>
                  
                  {formData.selectedHotel && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-medium mb-3">Выбранный отель</h4>
                      <div className="text-sm">
                        <div className="font-medium">
                          {typeof formData.selectedHotel.name === 'object' ? formData.selectedHotel.name.ru : formData.selectedHotel.name}
                        </div>
                        <div className="text-gray-600 mt-1">{formData.selectedHotel.location}</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Общая стоимость</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {tour?.pricePerPerson ? `${tour.pricePerPerson}₽` : '0₽'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking Details Step */}
          {(() => {
            console.log('Rendering booking step check. Step is:', step, 'Should show booking?', step === 'booking');
            return null;
          })()}
          {(step === 'booking' && false) && (
            <div className="space-y-6">
              {/* Customer Information */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Контактная информация
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ФИО заказчика *
                    </label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Телефон *
                    </label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата тура *
                </label>
                <input
                  type="date"
                  value={formData.selectedDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, selectedDate: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Participants */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-gray-900">
                    Список туристов
                  </h4>
                  <button
                    onClick={addParticipant}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    + Добавить туриста
                  </button>
                </div>
                
                {formData.participants.map((participant, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 border border-gray-200 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ФИО туриста *
                      </label>
                      <input
                        type="text"
                        value={participant.fullName}
                        onChange={(e) => updateParticipant(index, 'fullName', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Дата рождения *
                      </label>
                      <input
                        type="date"
                        value={participant.dateOfBirth}
                        onChange={(e) => updateParticipant(index, 'dateOfBirth', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    {formData.participants.length > 1 && (
                      <div className="md:col-span-2 flex justify-end">
                        <button
                          onClick={() => removeParticipant(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Удалить туриста
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Guide Selection */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Выберите гида (опционально)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guides.map((guide) => (
                    <div
                      key={guide.id}
                      onClick={() => setFormData(prev => ({ ...prev, selectedGuide: guide }))}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        formData.selectedGuide?.id === guide.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <h5 className="font-medium text-gray-900">
                        {typeof guide.name === 'object' ? guide.name.ru : guide.name}
                      </h5>
                      <p className="text-sm text-gray-600 mt-1">
                        Языки: {guide.languages?.join(', ')}
                      </p>
                      <p className="text-sm text-gray-600">
                        Опыт: {guide.experience} лет
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Особые пожелания
                </label>
                <textarea
                  value={formData.specialRequests}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialRequests: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Укажите любые особые пожелания или требования..."
                />
              </div>

              {/* Agreements */}
              <div className="space-y-3">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
                    className="mt-1 mr-3"
                  />
                  <span className="text-sm text-gray-700">
                    Я принимаю все условия Оферты (Договора) и даю согласие на использование моих персональных данных в рамках бронирования выбранного туристического продукта.
                  </span>
                </label>
                
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={formData.agreeToPaymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, agreeToPaymentTerms: e.target.checked }))}
                    className="mt-1 mr-3"
                  />
                  <span className="text-sm text-gray-700">
                    Я ознакомлен с Правилами оплаты и возврата средств и подтверждаю их применение.
                  </span>
                </label>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('hotel')}
                  className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-50"
                >
                  Назад
                </button>
                <button
                  onClick={() => setStep('payment')}
                  disabled={!formData.customerName || !formData.customerEmail || !formData.customerPhone || !formData.agreeToTerms || !formData.agreeToPaymentTerms}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Продолжить к оплате
                </button>
              </div>
            </div>
          )}

          {/* Payment Step */}
          {step === 'payment' && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900">
                Выберите способ оплаты
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { key: 'payme', name: 'Payme', icon: '💳' },
                  { key: 'click', name: 'Click', icon: '📱' },
                  { key: 'stripe', name: 'Stripe', icon: '💯' },
                  { key: 'paypal', name: 'PayPal', icon: '🏦' }
                ].map((method) => (
                  <div
                    key={method.key}
                    className="border border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => handleSubmit()}
                  >
                    <div className="text-2xl mb-2">{method.icon}</div>
                    <div className="font-medium text-gray-900">{method.name}</div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-2">Сводка заказа:</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Тур:</span>
                      <span>{tour && (typeof tour.title === 'object' ? tour.title.ru : tour.title)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Количество туристов:</span>
                      <span>{formData.participants.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Отель:</span>
                      <span>{formData.selectedHotel && (typeof formData.selectedHotel.name === 'object' ? formData.selectedHotel.name.ru : formData.selectedHotel.name)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Дата:</span>
                      <span>{new Date(formData.selectedDate).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex justify-between font-medium text-lg border-t pt-2 mt-2">
                      <span>Итого:</span>
                      <span>${tour ? (parseInt(tour.price) * formData.participants.length).toFixed(2) : '0.00'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('booking')}
                  className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-50"
                >
                  Назад
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;