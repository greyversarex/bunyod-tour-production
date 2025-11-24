// Multilingual content type - compatible with Prisma InputJsonValue
export interface MultilingualContent {
  en: string;
  ru: string;
  [lang: string]: string; // Index signature for Prisma compatibility
}

// Category types
export interface CategoryData {
  id: number;
  name: MultilingualContent;
  type?: string; // "tour" or "hotel"
}

export interface CreateCategoryData {
  name?: MultilingualContent;
  title?: MultilingualContent;
  type?: string; // "tour" or "hotel"
}

// Tour types
export interface TourData {
  id: number;
  title: MultilingualContent;
  description: MultilingualContent;
  duration: string;
  price: string;
  priceType?: string;
  categoryId: number;
  category?: CategoryData;
  // Старые поля для обратной совместимости
  countryId?: number | null;
  cityId?: number | null;
  // Новые поля для множественного выбора
  countriesIds?: number[];
  citiesIds?: number[];
  countries?: Array<{id: number; name: string; nameRu: string; nameEn: string}>;
  cities?: Array<{id: number; name: string; nameRu: string; nameEn: string}>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTourData {
  title: MultilingualContent;
  description: MultilingualContent;
  shortDescription?: MultilingualContent;
  duration: string;
  price: string;
  priceType?: string;
  originalPrice?: string;
  categoryId: number;
  tourBlockId?: number;
  // Старые поля для обратной совместимости
  countryId?: number;
  cityId?: number;
  country?: string;
  city?: string;
  // Новые поля для множественного выбора
  countriesIds?: number[];
  citiesIds?: number[];
  cityNights?: Record<string, number>; // {cityId: nightsCount}
  categoriesIds?: number[];
  tourBlockIds?: number[]; // 📦 IDs блоков туров для назначения
  durationDays?: number;
  durationType?: string;
  format?: string;
  tourType?: string;
  difficulty?: string;
  maxPeople?: number;
  minPeople?: number;
  mainImage?: string;
  images?: string;
  highlights?: string;
  itinerary?: string;
  itineraryEn?: string;
  included?: string;
  excluded?: string;
  isFeatured?: boolean;
  isDraft?: boolean;
  isActive?: boolean;
  pickupInfo?: string;
  pickupInfoEn?: string;
  startTimeOptions?: string;
  languages?: string;
  availableMonths?: string;
  availableDays?: string;
  startDate?: string;
  endDate?: string;
  rating?: number;
  reviewsCount?: number;
  includes?: string;
  theme?: string;
  requirements?: string;
  tags?: string;
  location?: string;
  services?: string;
  assignedGuideId?: number | null; // ID of assigned tour guide
  pricingComponents?: string; // JSON string of selected pricing components with quantities (maps to pricingData in DB)
  pricingData?: string; // Prisma field name for pricing components data
  profitMargin?: number; // Profit margin percentage (e.g., 30 for 30%)
  mapPoints?: string; // JSON string of map points (parsed as TourMapPoint[] in model)
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// BookingRequest types
export interface BookingRequestData {
  id: number;
  customerName: string;
  customerEmail: string;
  preferredDate: string;
  numberOfPeople: number;
  tourId: number;
  tour?: TourData;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBookingRequestData {
  customerName: string;
  customerEmail: string;
  preferredDate: string;
  numberOfPeople: number;
  tourId: number;
}

// Review types
export interface ReviewData {
  id: number;
  customerId?: number; // Теперь необязательный
  reviewerName: string; // Имя туриста
  rating: number;
  text: string;
  photos?: string; // JSON строка с URL фотографий
  isModerated: boolean;
  isApproved: boolean;
  tourId: number;
  customer?: {
    id: number;
    fullName: string;
    email: string;
    phone?: string;
  };
  tour?: TourData;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewData {
  customerId?: number; // Теперь необязательный
  reviewerName: string; // Имя туриста
  rating: number;
  text: string;
  tourId: number;
  photos?: string[]; // Массив URL фотографий
}

export interface UpdateReviewData {
  isModerated?: boolean;
  isApproved?: boolean;
}

// TransferRequest types
export interface TransferRequestData {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string;  // "HH:MM" format
  pickupDate: string;  // "YYYY-MM-DD" format
  numberOfPeople: number;
  vehicleType?: string | null;
  specialRequests?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes?: string | null;
  estimatedPrice?: number | null;
  finalPrice?: number | null;
  assignedDriverId?: number | null;
  assignedDriver?: {
    id: number;
    name: string;
    phone?: string;
    vehicleTypes?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransferRequestData {
  fullName: string;
  email?: string;
  phone?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string;  // "HH:MM" format
  pickupDate: string;  // "YYYY-MM-DD" format
  numberOfPeople?: number;
  vehicleType?: 'sedan' | 'suv' | 'minibus' | 'bus';
  specialRequests?: string;
  estimatedPrice?: number;  // ✅ Базовая цена трансфера для прямой оплаты
}

export interface UpdateTransferRequestData {
  fullName?: string;
  email?: string;
  phone?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  pickupDate?: string;
  numberOfPeople?: number;
  vehicleType?: 'sedan' | 'suv' | 'minibus' | 'bus';
  specialRequests?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes?: string;
  estimatedPrice?: number;
  finalPrice?: number;
  assignedDriverId?: number;
}

// Error types
export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}
