export interface Tour {
  id: number;
  title: { ru: string; en: string } | string;
  description: { ru: string; en: string } | string;
  duration: string;
  price: string;
  country: string;
  city: string;
  format: string;
  durationDays: number;
  theme: string;
  startDate: string;
  endDate: string;
  images: string[] | null;
  services: string[] | null;
  highlights: string[] | null;
  isActive: boolean;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface Category {
  id: number;
  name: { ru: string; en: string } | string;
  _count?: {
    tours: number;
  };
}

export interface Hotel {
  id: number;
  name: { ru: string; en: string } | string;
  description?: { ru: string; en: string } | string | null;
  images: string[];
  address: string;
  rating: number;
  amenities: string[];
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Guide {
  id: number;
  name: { ru: string; en: string } | string;
  description?: { ru: string; en: string } | string | null;
  photo?: string | null;
  languages: string[];
  contact?: { phone: string; email: string } | null;
  experience: number;
  rating: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingRequest {
  id: number;
  tourId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  selectedDate: string;
  hotelId?: number | null;
  guideId?: number | null;
  participants: Array<{
    fullName: string;
    dateOfBirth: string;
  }>;
  specialRequests?: string | null;
  paymentMethod?: string | null;
  status: string;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  tour?: Tour;
  hotel?: Hotel;
  guide?: Guide;
}

export interface Review {
  id: number;
  tourId: number;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  isModerated: boolean;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  tour?: Tour;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}