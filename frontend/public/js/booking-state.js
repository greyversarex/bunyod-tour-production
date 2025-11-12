/**
 * Unified Booking State Management Module
 * Single source of truth for booking data across all steps
 * Persists to sessionStorage for state continuity
 */

const STORAGE_KEY = 'bunyod_booking_state';
const STORAGE_TIMESTAMP_KEY = 'bunyod_booking_timestamp';
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const bookingStateManager = {
    state: {
        bookingId: null,
        tour: {
            id: null,
            title: {},
            currency: 'TJS',
            basePrice: 0,
            duration: 1,
            tourDate: null
        },
        hotel: {
            id: null,
            name: {},
            selected: false
        },
        selections: {
            rooms: {},
            meals: {},
            numberOfTourists: 1
        },
        contact: {
            name: '',
            phone: '',
            email: ''
        },
        tourists: [],
        specialRequests: '',
        pricing: {
            tourBasePrice: 0,
            roomSurcharge: 0,
            mealSurcharge: 0,
            grandTotal: 0,
            currency: 'TJS'
        },
        payment: {
            method: null
        },
        hotelCityMap: {},
        language: 'ru',
        selectedCurrency: 'TJS',
        lastUpdated: Date.now()
    },

    /**
     * Initialize state from sessionStorage or create new
     */
    init() {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        const timestamp = sessionStorage.getItem(STORAGE_TIMESTAMP_KEY);
        
        if (stored && timestamp) {
            const age = Date.now() - parseInt(timestamp);
            if (age < STATE_EXPIRY_MS) {
                try {
                    this.state = JSON.parse(stored);
                    
                    // ✅ FIX: Remove corrupted triple-nested room structure
                    if (this.state.selections && this.state.selections.rooms) {
                        const rooms = this.state.selections.rooms;
                        const fixedRooms = {};
                        
                        Object.keys(rooms).forEach(hotelId => {
                            const hotelRooms = rooms[hotelId];
                            
                            // Check if it's triple-nested (corrupted)
                            if (hotelRooms && typeof hotelRooms === 'object') {
                                const firstKey = Object.keys(hotelRooms)[0];
                                const firstValue = hotelRooms[firstKey];
                                
                                // If first value is an object with room types, it's triple-nested
                                if (firstValue && typeof firstValue === 'object' && 
                                    (firstValue.SGL !== undefined || firstValue.TWN !== undefined || firstValue.DBL !== undefined)) {
                                    console.warn('⚠️ Found corrupted triple-nested structure, fixing...');
                                    // Extract the inner object (correct structure)
                                    fixedRooms[hotelId] = firstValue;
                                } else {
                                    // Already correct structure
                                    fixedRooms[hotelId] = hotelRooms;
                                }
                            }
                        });
                        
                        this.state.selections.rooms = fixedRooms;
                        console.log('✅ Fixed room structure:', fixedRooms);
                    }
                    
                    // ✅ Ensure pricing object exists (fix for old sessionStorage data)
                    if (!this.state.pricing) {
                        console.warn('⚠️ pricing object missing in loaded state, initializing...');
                        this.state.pricing = {
                            tourBasePrice: 0,
                            roomSurcharge: 0,
                            mealSurcharge: 0,
                            grandTotal: 0,
                            currency: 'TJS'
                        };
                    }
                    
                    // 🆕 CRITICAL: Validate hotelCityMap for per-city room validation
                    if (!this.state.hotelCityMap) {
                        console.warn('⚠️ hotelCityMap missing in loaded state, initializing...');
                        this.state.hotelCityMap = {};
                    }
                    
                    // 🆕 Clear room selections if hotelCityMap is empty but selections exist
                    // This prevents bypassing per-city validation with stale data
                    if (this.state.selections && this.state.selections.rooms) {
                        const hasRoomSelections = Object.keys(this.state.selections.rooms).length > 0;
                        const hasMapping = Object.keys(this.state.hotelCityMap).length > 0;
                        
                        if (hasRoomSelections && !hasMapping) {
                            console.warn('⚠️ Room selections exist without hotel-city mapping!');
                            console.warn('⚠️ Clearing room selections to prevent validation bypass');
                            this.state.selections.rooms = {};
                            this.state.selections.meals = {};
                            console.log('✅ Cleared stale room/meal selections for safety');
                        }
                    }
                    
                    console.log('📦 Booking state loaded from sessionStorage:', this.state);
                    return true;
                } catch (e) {
                    console.error('Failed to parse stored state:', e);
                }
            } else {
                console.log('⏰ Stored state expired, creating fresh state');
            }
        }
        
        this.persist();
        return false;
    },

    /**
     * Persist current state to sessionStorage
     */
    persist() {
        this.state.lastUpdated = Date.now();
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        sessionStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString());
        console.log('💾 Booking state persisted to sessionStorage');
    },

    /**
     * Clear stored state
     */
    clear() {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_TIMESTAMP_KEY);
        this.state = this.getDefaultState();
        console.log('🗑️ Booking state cleared');
    },

    /**
     * Get default empty state
     */
    getDefaultState() {
        return {
            bookingId: null,
            tour: {
                id: null,
                title: {},
                currency: 'TJS',
                basePrice: 0,
                duration: 1,
                tourDate: null
            },
            hotel: {
                id: null,
                name: {},
                selected: false
            },
            selections: {
                rooms: {},
                meals: {},
                numberOfTourists: 1
            },
            contact: {
                name: '',
                phone: '',
                email: ''
            },
            tourists: [],
            specialRequests: '',
            pricing: {
                tourBasePrice: 0,
                roomSurcharge: 0,
                mealSurcharge: 0,
                grandTotal: 0,
                currency: 'TJS'
            },
            payment: {
                method: null
            },
            language: 'ru',
            selectedCurrency: 'TJS',
            lastUpdated: Date.now()
        };
    },

    /**
     * Set base tour information
     */
    setTourInfo(tourData) {
        this.state.tour = {
            id: tourData.id,
            title: tourData.title || {},
            currency: tourData.currency || 'TJS',
            basePrice: parseFloat(tourData.price) || 0,
            duration: tourData.durationDays || parseInt(tourData.duration) || 1,
            durationType: tourData.durationType || 'days',
            tourDate: tourData.tourDate || this.state.tour.tourDate
        };
        this.computeTotals();
        this.persist();
        console.log('🎫 Tour info set:', this.state.tour);
    },

    /**
     * Set hotel information (optional)
     */
    setHotelInfo(hotelData) {
        if (hotelData && hotelData.id) {
            this.state.hotel = {
                id: hotelData.id,
                name: hotelData.name || {},
                selected: true
            };
        } else {
            this.state.hotel = {
                id: null,
                name: {},
                selected: false
            };
        }
        this.persist();
        console.log('🏨 Hotel info set:', this.state.hotel);
    },

    /**
     * Update room selections (optional)
     */
    setRoomSelection(rooms) {
        this.state.selections.rooms = rooms || {};
        this.computeTotals();
        this.persist();
        console.log('🛏️ Room selection updated:', this.state.selections.rooms);
    },

    /**
     * Update meal selections (optional)
     */
    setMealSelection(meals) {
        this.state.selections.meals = meals || {};
        this.computeTotals();
        this.persist();
        console.log('🍽️ Meal selection updated:', this.state.selections.meals);
    },
    
    setHotelCityMap(mapping) {
        this.state.hotelCityMap = mapping || {};
        this.persist();
        console.log('🗺️ Hotel-City mapping updated:', this.state.hotelCityMap);
    },

    /**
     * Set number of tourists
     */
    setNumberOfTourists(count) {
        this.state.selections.numberOfTourists = parseInt(count) || 1;
        this.computeTotals();
        this.persist();
        console.log('👥 Number of tourists set:', this.state.selections.numberOfTourists);
    },

    /**
     * Set booking ID
     */
    setBookingId(id) {
        this.state.bookingId = id;
        this.persist();
        console.log('🆔 Booking ID set:', id);
    },

    /**
     * Set contact information
     */
    setContactInfo(contact) {
        this.state.contact = {
            name: contact.name || '',
            phone: contact.phone || '',
            email: contact.email || ''
        };
        this.persist();
        console.log('📞 Contact info set:', this.state.contact);
    },

    /**
     * Set tourist information
     */
    setTourists(tourists) {
        this.state.tourists = tourists || [];
        this.persist();
        console.log('👤 Tourists set:', this.state.tourists);
    },

    /**
     * Set special requests
     */
    setSpecialRequests(requests) {
        this.state.specialRequests = requests || '';
        this.persist();
    },

    /**
     * Set payment method
     */
    setPaymentMethod(method) {
        this.state.payment.method = method;
        this.persist();
        console.log('💳 Payment method set:', method);
    },

    /**
     * Set language
     */
    setLanguage(lang) {
        this.state.language = lang;
        this.persist();
    },

    /**
     * Set selected currency
     */
    setSelectedCurrency(currency) {
        this.state.selectedCurrency = currency;
        this.persist();
    },

    /**
     * Set tour date
     */
    setTourDate(date) {
        this.state.tour.tourDate = date;
        this.persist();
    },

    /**
     * Compute total pricing based on selections
     */
    computeTotals() {
        const duration = this.state.tour.duration || 1;
        const tourists = this.state.selections.numberOfTourists || 1;
        const basePrice = this.state.tour.basePrice || 0;

        let tourBasePrice = basePrice * tourists;

        let roomSurcharge = 0;
        if (this.state.selections.rooms && typeof this.state.selections.rooms === 'object') {
            Object.entries(this.state.selections.rooms).forEach(([roomType, count]) => {
                const roomCount = parseInt(count) || 0;
                if (roomCount > 0) {
                    const pricePerNight = this.getRoomPrice(roomType);
                    roomSurcharge += pricePerNight * roomCount * duration;
                }
            });
        }

        let mealSurcharge = 0;
        if (this.state.selections.meals && typeof this.state.selections.meals === 'object') {
            Object.entries(this.state.selections.meals).forEach(([mealType, count]) => {
                const mealCount = parseInt(count) || 0;
                if (mealCount > 0) {
                    const pricePerMeal = this.getMealPrice(mealType);
                    mealSurcharge += pricePerMeal * mealCount * duration;
                }
            });
        }

        const grandTotal = tourBasePrice + roomSurcharge + mealSurcharge;

        this.state.pricing = {
            tourBasePrice: tourBasePrice,
            roomSurcharge: roomSurcharge,
            mealSurcharge: mealSurcharge,
            grandTotal: grandTotal,
            currency: this.state.tour.currency
        };

        console.log('💰 Totals computed:', this.state.pricing);
        return this.state.pricing;
    },

    /**
     * Get room price by type
     */
    getRoomPrice(roomType) {
        const prices = {
            'SGL': 800,
            'TWN': 1200,
            'DBL': 1000,
            'TRPL': 1500
        };
        return prices[roomType] || 0;
    },

    /**
     * Get meal price by type
     */
    getMealPrice(mealType) {
        const prices = {
            'breakfast': 150,
            'lunch': 250,
            'dinner': 300,
            'all_inclusive': 600
        };
        return prices[mealType] || 0;
    },

    /**
     * Sync with server - fetch canonical pricing
     */
    async syncWithServer() {
        if (!this.state.bookingId) {
            console.warn('⚠️ Cannot sync - no booking ID set');
            return false;
        }

        try {
            const lang = window.currentLanguage || this.state.language || 'ru';
            const response = await fetch(`/api/booking/${this.state.bookingId}?lang=${lang}`);
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.data) {
                const serverBooking = result.data;
                
                if (serverBooking.totalPrice !== null && serverBooking.totalPrice !== undefined) {
                    const serverTotal = parseFloat(serverBooking.totalPrice);
                    const clientTotal = this.state.pricing.grandTotal;
                    
                    if (Math.abs(serverTotal - clientTotal) > 0.01) {
                        console.warn(`⚠️ Price mismatch! Server: ${serverTotal}, Client: ${clientTotal}`);
                        this.state.pricing.grandTotal = serverTotal;
                    }
                }
                
                if (serverBooking.tour) {
                    this.state.tour.title = serverBooking.tour.title || this.state.tour.title;
                }
                
                if (serverBooking.hotel) {
                    this.state.hotel.name = serverBooking.hotel.name || this.state.hotel.name;
                }
                
                this.persist();
                console.log('✅ Successfully synced with server');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Failed to sync with server:', error);
            return false;
        }
    },

    /**
     * Get current state (read-only)
     */
    getState() {
        return { ...this.state };
    },

    /**
     * Get pricing info
     */
    getPricing() {
        return { ...this.state.pricing };
    },

    /**
     * Validate state before proceeding to next step
     */
    validate(step) {
        switch (step) {
            case 1:
                return this.state.tour.id !== null && 
                       this.state.tour.basePrice > 0 &&
                       this.state.selections.numberOfTourists > 0;
            
            case 2:
                return this.state.contact.name !== '' &&
                       this.state.contact.phone !== '' &&
                       this.state.contact.email !== '';
            
            case 3:
                return this.state.bookingId !== null;
            
            default:
                return false;
        }
    }
};

// Auto-initialize on load
bookingStateManager.init();

// Export for use in other scripts
window.bookingStateManager = bookingStateManager;

console.log('✅ Booking State Manager initialized');
