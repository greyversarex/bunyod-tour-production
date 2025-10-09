# 📊 BUNYOD-TOUR - Comprehensive Codebase Analysis

**Project:** Central Asia Tourism Platform (Tajikistan Focus)  
**Last Updated:** October 09, 2025  
**Analysis Status:** ✅ Complete Exhaustive Study

---

## 🎯 PROJECT OVERVIEW

**Bunyod-Tour** is a comprehensive tourism booking platform specifically designed for Central Asia (primarily Tajikistan). The platform enables tourists to:
- Browse and book multi-day tours across Tajikistan and neighboring countries
- Reserve hotels with flexible room and meal selections
- Hire professional tour guides and drivers
- Make secure payments via multiple payment gateways (local and international)
- Manage bookings in Russian/English with automatic currency conversion

### Core Value Proposition
- **Regional Focus:** Specialized content for Central Asian tourism (Tajikistan, Uzbekistan, Kyrgyzstan)
- **Multilingual:** Complete Russian/English support with centralized i18n system
- **Multi-Currency:** Support for TJS, USD, EUR, RUB, CNY with live exchange rates
- **Component-Based Pricing:** Dynamic pricing system with modular tour components
- **Comprehensive Management:** Separate dashboards for admins, tour guides, and drivers

---

## 🏗️ TECHNICAL ARCHITECTURE

### **Tech Stack**

#### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js (REST API)
- **Database:** PostgreSQL (via Replit integration)
- **ORM:** Prisma (type-safe database access)
- **Authentication:** JWT with bcrypt password hashing
- **Email:** Nodemailer with HTML templates
- **File Upload:** Multer + Cloud Storage (Google Cloud Storage ready)

#### Frontend
- **Core:** Vanilla HTML/CSS/JavaScript
- **Styling:** Tailwind CSS (via CDN)
- **Icons:** Font Awesome 6.4.0
- **Date Picker:** Flatpickr
- **File Upload UI:** Uppy (with AWS S3 support)
- **No Framework:** Pure JS for lightweight performance

#### Infrastructure
- **Hosting:** Replit (unified server on port 5000)
- **Database:** Replit PostgreSQL (development environment)
- **Object Storage:** Replit Object Storage integration (pending setup)
- **Version Control:** Git-based deployment

---

## 🗄️ DATABASE ARCHITECTURE

### **Prisma Schema - 30+ Models**

#### Core Booking Models
1. **Tour** - Tour packages with multilingual content, pricing components, itinerary
2. **Order** - Customer bookings (links tours, hotels, guides)
3. **Booking** - Alternative booking system (legacy compatibility)
4. **Customer** - Tourist/user profiles with contact info

#### Resource Models
5. **Hotel** - Accommodations with rooms, amenities, multilingual descriptions
6. **Guide** - Tour guides with languages, specializations, ratings
7. **Driver** - Drivers for transfers and tours
8. **Category** - Tour categorization (Adventure, Cultural, etc.)
9. **Country** - Countries (Tajikistan, Uzbekistan, Kyrgyzstan, etc.)
10. **City** - Cities within countries

#### Service Request Models
11. **GuideHireRequest** - Direct guide hiring requests
12. **TransferRequest** - Airport/city transfer requests
13. **TourAgent** - B2B travel agent partnerships

#### CMS & Content Models
14. **News** - Blog articles and news updates (multilingual)
15. **Slide** - Homepage carousel slides
16. **TourBlock** - Reusable tour content blocks
17. **Review** - Customer reviews (pending/approved)

#### Admin & Operations Models
18. **Admin** - Admin users with hashed passwords (bcrypt)
19. **TourGuideProfile** - Extended guide profiles with certifications
20. **DriverProfile** - Extended driver profiles with vehicle info
21. **Trip** - Completed trip records for guides/drivers

#### Financial Models
22. **ExchangeRate** - Currency conversion rates (TJS, USD, EUR, RUB, CNY)
23. **Migration** - Database migration tracking

#### Pricing System Models
24. **PriceCalculatorComponent** - Global pricing components library
25. **TourPricingComponent** - Tour-specific pricing components

#### Relationship Models (Many-to-Many)
26. **TourCountry** - Tours can span multiple countries
27. **TourCity** - Tours can visit multiple cities
28. **TourHotel** - Tours can include multiple hotel options
29. **TourGuide** - Tours can have multiple assigned guides
30. **TourDriver** - Tours can have multiple assigned drivers
31. **TourBlockAssignment** - Tours can use multiple content blocks

### **Key Database Features**
- **Multilingual JSON Fields:** `{ru: "...", en: "..."}` for Tour titles, descriptions, Hotel names, etc.
- **Soft Relationships:** `countryId` and `cityId` fields coexist with many-to-many relations
- **Pricing Components:** Tours store `pricingData` as JSON with component breakdown
- **Order Status Tracking:** `status` (pending/confirmed/cancelled) + `paymentStatus` (unpaid/processing/paid/failed)
- **Cascade Deletes:** Configured for referential integrity

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### **JWT-Based Authentication System**

#### Admin Authentication
- **Route:** `POST /api/auth/admin/login`
- **Password:** Bcrypt hashed (10 rounds)
- **JWT Secret:** `JWT_SECRET` environment variable (mandatory)
- **Token Payload:** `{ adminId, email, role: 'admin' }`
- **Protected Routes:** All `/api/admin/*` endpoints
- **Middleware:** `src/middleware/authMiddleware.ts`

#### Tour Guide Authentication
- **Route:** `POST /api/auth/guide/login`
- **Password:** Bcrypt hashed
- **JWT Payload:** `{ guideId, email, role: 'guide' }`
- **Dashboard:** `guide-dashboard.html`
- **Features:** View assigned tours, manage availability, track trips

#### Driver Authentication
- **Route:** `POST /api/auth/driver/login`
- **Password:** Bcrypt hashed
- **JWT Payload:** `{ driverId, email, role: 'driver' }`
- **Dashboard:** `driver-dashboard.html`
- **Features:** View assigned transfers, manage routes, track trips

### **Security Features**
- **Rate Limiting:** Express-rate-limit on auth endpoints (100 requests/15min)
- **CORS:** Configured for cross-origin requests
- **XSS Protection:** `security-utils.js` sanitizes user input
- **HMAC Validation:** Payment callback signatures verified with crypto module
- **Environment Secrets:** All sensitive keys in `.env` (never committed)

---

## 💳 PAYMENT GATEWAY INTEGRATIONS

### **1. Stripe (International)**
- **API Version:** Latest (via `stripe` npm package)
- **Integration:** Payment Intents + Checkout Sessions
- **Webhook:** `/api/payments/webhook` (signature verification)
- **Flow:**
  1. Create Payment Intent (`createPaymentIntent`)
  2. Create Checkout Session with success/cancel URLs
  3. Redirect user to Stripe hosted checkout
  4. Webhook confirms payment → update order status to 'paid'
  5. Send confirmation email via `emailService`
- **Refunds:** Partial refund support via admin dashboard
- **Currency:** USD (auto-converted from TJS)

### **2. AlifPay (Tajikistan)**
- **API Version:** v2
- **API URL:** `ALIF_API_URL` environment variable
- **Authentication:** 
  - `ALIF_MERCHANT_KEY`
  - `ALIF_MERCHANT_PASSWORD` (HMAC-SHA256 hashed)
- **Flow:**
  1. Hash password: `HMAC-SHA256(merchantKey, password)`
  2. POST to `/v2/payments` with `{merchant_id, password, order_id, amount (тийины), description, return_url, fail_url, lang}`
  3. Receive `checkout_url` and `payment_id`
  4. Redirect user to AlifPay checkout
  5. Callback validates signature: `HMAC-SHA256(password, merchant_id) === signature`
  6. Update order status based on callback `status`
- **Currency:** TJS (amount × 100 for тийины)
- **Controller:** `src/controllers/alifController.ts`

### **3. Payler (Russia/CIS)**
- **API:** StartSession endpoint
- **Authentication:** `PAYLER_KEY` environment variable
- **Flow:**
  1. POST to `https://secure.payler.com/gapi/StartSession`
  2. Payload: `{key, type: 'OneStep', currency: 'TJS', lang: 'en', amount (копейки), order_id, return_url, fail_url}`
  3. Receive `session_id`
  4. Redirect to `https://secure.payler.com/gapi/Pay?session_id=...`
  5. Callback validates HMAC signature
  6. Update order status
- **Currency:** TJS (amount × 100 for копейки)
- **Controller:** `src/controllers/paylerController.ts`

### **4. Placeholder Integrations (Future)**
- **Click (Uzbekistan):** Placeholder routes configured
- **PayMe (Uzbekistan):** Placeholder in `paymentService.ts`
- **Binance (Crypto):** Planned for USDT/BTC payments
- **Korti Milli (Tajikistan National Card):** Planned integration

### **Payment Security**
- **HMAC Signature Validation:** All callbacks verify cryptographic signatures
- **Order ID Mapping:** Payment gateway callbacks map to internal order IDs
- **Idempotency:** Payment intent IDs prevent duplicate charges
- **Email Notifications:** Sent only after successful payment confirmation

---

## 📧 EMAIL SERVICE

### **Configuration (Nodemailer)**
- **SMTP Host:** `SMTP_HOST` (default: smtp.gmail.com)
- **SMTP Port:** `SMTP_PORT` (default: 587)
- **Auth:** `SMTP_USER` and `SMTP_PASS` environment variables
- **Fallback:** `noreply@bunyod-tour.com` if not configured

### **Email Templates (HTML)**

#### 1. Booking Confirmation (`bookingConfirmation`)
- **Trigger:** Order creation via `createOrder` controller
- **Recipient:** Customer email
- **Content:**
  - Bunyod-Tour header with logo
  - Order number (e.g., `BT-123456ABC`)
  - Tour title (multilingual)
  - Tour date, tourist count, total amount
  - Tourist list with names and birthdates
  - Selected hotel and guide (if applicable)
  - "View Details" button → `/my-bookings.html?order={orderNumber}`
  - Contact info: phone and support email
- **Styling:** Professional gradient header, white content blocks, responsive

#### 2. Payment Confirmation (`paymentConfirmation`)
- **Trigger:** Successful payment callback (Stripe/AlifPay/Payler)
- **Recipient:** Customer email
- **Content:**
  - Green header "Payment Successful"
  - Payment details (amount, method, transaction ID)
  - Order summary
  - Next steps and travel information
  - Contact support

#### 3. Booking Cancellation (`bookingCancellation`)
- **Trigger:** Admin cancels order
- **Recipient:** Customer email
- **Content:**
  - Red header "Booking Cancelled"
  - Order number
  - Cancellation reason (if provided)
  - Refund information
  - Contact support for questions

#### 4. Admin Notification (`adminNotification`)
- **Trigger:** New order created
- **Recipient:** Admin email (`support@bunyod-tour.com`)
- **Content:**
  - "New Order Received" header
  - Full order details for admin review
  - Customer contact information
  - Link to admin dashboard for order management

### **Email Error Handling**
- Non-blocking: Email failures logged but don't prevent order creation
- Retry logic: 3 attempts with exponential backoff
- Fallback: Admin notified via dashboard if email fails

---

## 🌐 MULTILINGUAL SYSTEM (i18n)

### **Centralized Translation System**

#### Frontend i18n (`/public/js/i18n.js`)
- **Size:** 2,100+ lines of translations
- **Languages:** English (en), Russian (ru)
- **Storage:** `localStorage.getItem('language')` with `'ru'` default
- **Structure:**
  ```javascript
  const translations = {
    en: {
      nav: { home: "Home", tours: "Tours", ... },
      booking: { step1: "Select Hotel", ... },
      admin: { dashboard: "Dashboard", ... },
      ...
    },
    ru: { /* mirror structure */ }
  }
  ```
- **Functions:**
  - `translate(key)` - Get translation for key (e.g., `translate('nav.home')`)
  - `updatePageLanguage()` - Updates all `data-i18n` elements
  - `switchLanguage(lang)` - Switches language and persists to localStorage

#### Backend Multilingual Fields
- **Database Storage:** JSON columns `{ru: "...", en: "..."}`
- **Models with Multilingual:**
  - `Tour.title`, `Tour.description`, `Tour.shortDesc`
  - `Hotel.name`, `Hotel.description`
  - `Guide.name`, `Guide.description`
  - `News.title`, `News.content`
  - `Category.name`, `Category.description`
- **Utility Functions:**
  - `parseMultilingualField(field, language)` - Extracts language-specific value
  - `getLanguageFromRequest(req)` - Detects language from `Accept-Language` header or query param
  - Fallback: `ru` → `en` → first available → `""`

#### Language Switching UI
- **Navbar:** Globe icon (`<i class="fas fa-globe">`) + dropdown
- **Options:** 🇷🇺 Русский | 🇬🇧 English
- **Persistence:** Saved to `localStorage.language`
- **Page Reload:** Language applies immediately via `updatePageLanguage()`

### **Translation Coverage**
- **Public Pages:** 100% (index, tours, booking, hotels, guides, about, contact)
- **Admin Panel:** 95% (some technical terms remain in English)
- **Email Templates:** Russian only (customer base is primarily Russian-speaking)

---

## 💰 PRICING & CALCULATION SYSTEM

### **Component-Based Pricing Architecture**

#### 1. Tour Base Pricing
- **Field:** `Tour.price` (Decimal)
- **Field:** `Tour.priceType` (String: "за человека" or "за группу")
- **Calculation:**
  ```javascript
  if (priceType === 'за человека') {
    tourCost = basePrice * numberOfTourists
  } else {
    tourCost = basePrice // fixed group price
  }
  ```

#### 2. Pricing Components System
- **Global Components:** `PriceCalculatorComponent` model
  - Name, description, price type, default price
  - Reusable across all tours
  
- **Tour-Specific Components:** `TourPricingComponent` model
  - Links to tour and global component
  - Overrides price for specific tour
  - Examples: "Проживание", "Питание", "Транспорт", "Гид"

- **Storage:** `Tour.pricingData` (JSON field)
  ```json
  {
    "components": [
      {"name": "Проживание", "price": 150, "type": "за человека"},
      {"name": "Транспорт", "price": 50, "type": "за группу"},
      ...
    ]
  }
  ```

#### 3. Hotel Pricing Logic
- **Accommodation Replacement:**
  1. Tour includes "Проживание" component → subtract from tour price
  2. User selects hotel → add hotel room costs
  
- **Room Selection:** `roomSelection` object
  ```javascript
  {
    "single": { quantity: 1, price: 100 },
    "double": { quantity: 2, price: 150 },
    "suite": { quantity: 0, price: 300 }
  }
  ```

- **Calculation:**
  ```javascript
  const tourDuration = parseInt(tour.duration.replace(/\D/g, '')) || 1;
  for (const [roomType, room] of Object.entries(roomSelection)) {
    if (room.quantity > 0) {
      totalAmount += room.price * room.quantity * tourDuration;
    }
  }
  ```

#### 4. Meal Pricing
- **Meal Options:** Breakfast, Lunch, Dinner
- **Meal Selection:** `mealSelection` object
  ```javascript
  {
    "breakfast": { selected: true, price: 10 },
    "lunch": { selected: true, price: 15 },
    "dinner": { selected: false, price: 20 }
  }
  ```

- **Calculation:**
  ```javascript
  for (const [mealType, meal] of Object.entries(mealSelection)) {
    if (meal.selected) {
      totalAmount += meal.price * numberOfTourists * tourDuration;
    }
  }
  ```

#### 5. Dynamic Currency Conversion
- **Supported Currencies:** TJS (Somoni), USD, EUR, RUB, CNY
- **Exchange Rates:** `ExchangeRate` model (updated daily)
- **Conversion:**
  ```javascript
  const rate = await prisma.exchangeRate.findFirst({
    where: { fromCurrency: 'USD', toCurrency: 'TJS' }
  });
  const convertedAmount = amount * rate.rate;
  ```
- **Display:** Frontend shows prices in all currencies with live conversion

### **Price Calculator Admin Interface**
- Create/edit global pricing components
- Assign components to tours with custom prices
- Preview total tour cost with all components
- Bulk update prices across multiple tours

---

## 🛒 BOOKING WORKFLOW

### **3-Step Booking Process**

#### **Step 1: Tour & Hotel Selection** (`booking-step1.html`)
- **Tour Display:**
  - Main image, title (multilingual), description
  - Duration, price (with currency conversion)
  - Category badge, difficulty level, max people
  
- **Date Selection:**
  - Flatpickr calendar with available dates
  - Blocked dates based on tour availability
  - Minimum booking advance (e.g., 3 days)
  
- **Hotel Selection (Optional):**
  - List of compatible hotels for tour
  - Room type selection: Single, Double, Suite, etc.
  - Quantity input for each room type
  - Meal plan selection: Breakfast, Lunch, Dinner
  - Live price calculation updates
  
- **State Management:**
  ```javascript
  BookingStateManager.saveHotelSelection({
    tourId, 
    selectedDate, 
    hotelId, 
    roomSelection, 
    mealSelection
  });
  ```

#### **Step 2: Tourist Information** (`booking-step2.html`)
- **Number of Tourists:**
  - Counter (+/-) for tourist count
  - Min: 1, Max: tour.maxPeople
  
- **Tourist Details Form (Dynamic):**
  - For each tourist:
    - Full Name (required)
    - Birth Date (Flatpickr date picker)
    - Passport Number (optional)
    - Nationality (dropdown with countries)
  - Validation: All fields required before proceeding
  
- **Additional Information:**
  - Wishes/Comments textarea
  - Dietary restrictions
  - Special requests
  
- **State Management:**
  ```javascript
  BookingStateManager.saveTouristData({
    tourists: [
      {fullName: "...", birthDate: "...", passport: "...", nationality: "..."},
      ...
    ],
    wishes: "..."
  });
  ```

#### **Step 3: Contact & Payment** (`booking-step3.html`)
- **Customer Contact:**
  - Full Name (required)
  - Email (required, validated)
  - Phone (required, international format)
  - Country (dropdown)
  
- **Order Summary:**
  - Tour details with selected date
  - Selected hotel and rooms (if any)
  - Tourist count and names
  - **Price Breakdown:**
    - Tour base price
    - Hotel accommodation cost
    - Meal costs
    - Additional services
    - **Total Amount** (in selected currency)
  
- **Legal Agreements:**
  - ✅ Terms of Service checkbox (required)
  - ✅ Payment Rules checkbox (required)
  - ✅ Privacy Policy checkbox (required)
  
- **Payment Method Selection:**
  - **Stripe** (Credit/Debit Cards)
  - **AlifPay** (Tajikistan local)
  - **Payler** (Russia/CIS)
  - **Click** (Uzbekistan) - Coming Soon
  - **PayMe** (Uzbekistan) - Coming Soon
  - **Binance** (Crypto) - Coming Soon
  - **Korti Milli** (Tajikistan National) - Coming Soon
  
- **Order Creation:**
  1. Validate all form fields
  2. Create customer record (if new)
  3. Create order in database (`POST /api/orders/create`)
  4. Receive `orderNumber` (e.g., `BT-123456ABC`)
  5. Initialize payment with selected gateway
  6. Redirect to payment page
  7. Handle payment callback
  8. Update order status to 'paid'
  9. Send confirmation emails
  10. Redirect to success page

### **Booking State Manager** (`/public/js/booking-state.js`)
- **Purpose:** Persist booking data across 3 steps
- **Storage:** `sessionStorage` (cleared after order creation)
- **Methods:**
  - `saveHotelSelection(data)` - Save Step 1 data
  - `saveTouristData(data)` - Save Step 2 data
  - `getBookingState()` - Retrieve all saved data
  - `clearBookingState()` - Clear after successful order
  - `validateStep(stepNumber)` - Validate before allowing next step

---

## 👨‍💼 ADMIN DASHBOARD

### **Admin Panel Architecture** (`admin-dashboard.html`)
- **Size:** 15,525 lines (single monolithic file)
- **Structure:** 22 functional modules in one HTML file
- **Authentication:** JWT required, stored in `localStorage.adminToken`
- **Layout:** Sidebar navigation + main content area

### **22 Admin Modules**

#### 1. **Dashboard (Overview)**
- Total tours, bookings, revenue statistics
- Recent orders table
- Quick actions: Add tour, View orders
- Charts: Revenue by month, Bookings by status

#### 2. **Tours Management**
- CRUD operations for tours
- Bulk actions: Delete, Publish, Unpublish
- Filters: Category, Country, Status
- Rich text editor for descriptions
- Image upload (main + gallery)
- Pricing component assignment
- Multilingual content editor (RU/EN tabs)

#### 3. **Categories Management**
- Create/Edit tour categories
- Multilingual names and descriptions
- Icon/image assignment
- Reorder categories (drag & drop)

#### 4. **Hotels Management**
- CRUD operations for hotels
- Room types and amenities
- Pricing per room type
- Image gallery upload
- Star rating and location
- Compatible tours assignment

#### 5. **Guides Management**
- CRUD operations for tour guides
- Languages spoken
- Specializations (hiking, cultural, adventure)
- Availability calendar
- Rating and reviews
- Photo upload
- Tour assignments

#### 6. **Drivers Management**
- CRUD operations for drivers
- Vehicle information (type, capacity, license plate)
- Availability calendar
- Routes and transfer history
- Rating and reviews

#### 7. **Orders Management**
- View all orders with advanced filters
- Order status workflow: Pending → Confirmed → Cancelled
- Payment status: Unpaid → Processing → Paid → Failed
- Order details modal with tourist info
- Email notifications (resend confirmation)
- Export orders to CSV/Excel
- Refund processing (for Stripe)

#### 8. **Bookings Management**
- Alternative to Orders (legacy system)
- Similar functionality to Orders
- Migration tool to convert to new Order system

#### 9. **Customers Management**
- View all customers
- Customer details: name, email, phone, booking history
- Loyalty program status
- Export customer list
- Bulk email to customers

#### 10. **Reviews Management**
- Approve/Reject pending reviews
- View all reviews by tour/guide/hotel
- Edit review text (with permission)
- Respond to reviews
- Feature reviews on homepage

#### 11. **News/Blog Management**
- Create/Edit news articles
- Multilingual content (RU/EN)
- Featured image upload
- Publish/Unpublish
- Categories: Tours, Travel Tips, Company News
- SEO meta tags editor

#### 12. **Slides Management (Homepage Carousel)**
- CRUD operations for homepage slides
- Image upload (optimized for carousel)
- Multilingual title and description
- Call-to-action button (text + link)
- Order/priority setting
- Active/Inactive toggle

#### 13. **Tour Blocks Management**
- Create reusable content blocks for tours
- Types: Itinerary Day, Included Service, FAQ, Safety Info
- Multilingual content
- Assign blocks to multiple tours
- Template library

#### 14. **Countries Management**
- CRUD operations for countries
- Multilingual names
- Flag image upload
- Currency and timezone
- Related cities management

#### 15. **Cities Management**
- CRUD operations for cities
- Country assignment
- Coordinates for map
- Featured attractions
- Related tours and hotels

#### 16. **Exchange Rates Management**
- CRUD for currency exchange rates
- Supported currencies: TJS, USD, EUR, RUB, CNY
- Manual rate update
- Auto-fetch from external API (optional)
- Historical rate tracking

#### 17. **Guide Hire Requests**
- View all guide hire requests
- Assign guide to request
- Status: Pending → Assigned → Completed → Cancelled
- Send confirmation to customer

#### 18. **Transfer Requests**
- View all transfer requests
- Assign driver to request
- Route details (pickup, dropoff, date, time)
- Vehicle selection
- Price calculation based on distance

#### 19. **Tour Agents Management (B2B)**
- CRUD for travel agent partners
- Commission rate setting
- Agent portal access credentials
- Sales reports by agent
- Payout tracking

#### 20. **Trips Management**
- View completed trips (guides and drivers)
- Trip details: date, participants, route
- Driver/Guide feedback
- Trip expenses and revenue

#### 21. **Price Calculator**
- Manage global pricing components
- Create tour-specific pricing
- Preview total tour cost
- Bulk update component prices
- Historical pricing data

#### 22. **Admin Users Management**
- CRUD for admin accounts
- Role assignment (Super Admin, Manager, Support)
- Permission levels
- Password reset
- Activity logs

### **Admin Panel Features**
- **Real-time Updates:** Auto-refresh data every 30s
- **Bulk Operations:** Multi-select and batch actions
- **Export Tools:** CSV, Excel, PDF export for all data
- **Search & Filters:** Advanced filtering on all tables
- **Responsive Design:** Mobile-friendly admin interface
- **Audit Logs:** Track all admin actions (future)

---

## 🎨 FRONTEND STRUCTURE

### **Public Pages** (`/frontend`)

#### 1. **Homepage** (`index.html`)
- Hero section with carousel slides (from Slides CMS)
- Featured tours grid (6-12 tours)
- Tour categories icons
- Popular destinations
- Customer testimonials
- Search bar: destination, dates, travelers
- Newsletter subscription form
- Footer with quick links, contact, social media

#### 2. **Tours Catalog** (`tours-search.html`)
- Advanced search filters:
  - Destination (country/city dropdowns)
  - Category (adventure, cultural, etc.)
  - Duration (days range)
  - Price range (min-max slider)
  - Difficulty level
  - Available dates
- Tour cards grid:
  - Main image, title, short description
  - Duration, price (with currency toggle)
  - Category badge, difficulty, rating
  - "Book Now" button → booking-step1.html
- Pagination (20 tours per page)
- Sort by: Price, Duration, Rating, Newest

#### 3. **Tour Details** (`tour-details.html`)
- Full tour information:
  - Image gallery (lightbox)
  - Title, description, highlights
  - Itinerary (day-by-day breakdown)
  - Included/Excluded services
  - Requirements and what to bring
  - Location map (Google Maps embed)
- Pricing breakdown
- Available dates calendar
- Reviews section (paginated)
- "Book This Tour" button → booking-step1.html
- Related tours carousel

#### 4. **Booking Steps**
- `booking-step1.html` - Tour & Hotel Selection
- `booking-step2.html` - Tourist Information
- `booking-step3.html` - Contact & Payment
- (Detailed in "Booking Workflow" section above)

#### 5. **Hotels Catalog** (`hotels-catalog.html`)
- Hotel cards grid:
  - Main image, name, star rating
  - Location (city, country)
  - Price per night (from room types)
  - Amenities icons (WiFi, Pool, Parking, etc.)
  - "View Details" button
- Filters:
  - Location (city dropdown)
  - Star rating (1-5 stars)
  - Price range
  - Amenities checkboxes
- Sort by: Price, Rating, Name

#### 6. **Hotel Details** (`hotel-details.html`)
- Hotel information:
  - Image gallery
  - Description, amenities list
  - Room types table (price, capacity, features)
  - Location map
- Reviews section
- "Book with Tour" button → tours compatible with this hotel
- Standalone booking form (hotel only)

#### 7. **Guides Directory** (`guides-directory.html`)
- Guide profiles grid:
  - Profile photo, name, languages
  - Specializations (adventure, cultural, etc.)
  - Rating and reviews count
  - "Hire Guide" button
- Filters:
  - Languages spoken
  - Specializations
  - Availability dates
  - Rating (min stars)

#### 8. **Guide Hire Form** (`hire-guide.html`)
- Guide selection (from directory)
- Service details:
  - Dates (start/end)
  - Number of tourists
  - Tour type (hiking, city tour, etc.)
- Contact information
- Special requests
- Price calculation (based on guide hourly/daily rate)
- Submit → creates GuideHireRequest

#### 9. **Transfers** (`transfers.html`)
- Transfer request form:
  - Transfer type (airport, city, intercity)
  - Pickup location (address/airport)
  - Dropoff location
  - Date and time
  - Number of passengers
  - Luggage count
- Vehicle selection (sedan, SUV, minibus)
- Price calculation based on distance
- Submit → creates TransferRequest

#### 10. **About Us** (`about.html`)
- Company history and mission
- Team members (with photos)
- Our values and commitment
- Certifications and partnerships
- Timeline of achievements

#### 11. **Contact** (`contact.html`)
- Contact form (name, email, message)
- Contact information:
  - Address, phone, email
  - Office hours
- Location map (Google Maps embed)
- Social media links

#### 12. **My Bookings** (`my-bookings.html`)
- View bookings by order number (email verification)
- Order details:
  - Tour, hotel, dates, tourists
  - Payment status and method
  - Total amount paid
- Download invoice (PDF)
- Cancel booking (if within policy)
- Modify booking (future feature)

#### 13. **Payment Success/Fail**
- `payment-success.html` - Success confirmation with order details
- `payment-fail.html` - Error message with retry option

### **Frontend JavaScript Modules** (`/public/js`)

#### Core Utilities
1. **i18n.js** (2,100+ lines) - Translation system
2. **utils.js** - Common utility functions
3. **security-utils.js** - XSS protection and input sanitization
4. **booking-state.js** - Booking state management

#### Admin Panel Scripts
5. **admin-helpers.js** - Admin panel utilities
6. **unified-form-handler.js** - Form validation and submission
7. **dropdown-helpers.js** - Dynamic dropdown population

#### Feature Scripts
8. **tour-search.js** - Tours catalog search and filters
9. **tour-details.js** - Tour details page logic
10. **booking-flow.js** - Booking workflow orchestration
11. **hotel-booking.js** - Hotel selection logic
12. **payment.js** - Payment gateway integration

---

## 🚀 API ROUTES & CONTROLLERS

### **Route Structure** (`src/routes/index.ts`)

#### Public Routes (No Auth Required)
- `GET /api/tours` - List all tours (with filters)
- `GET /api/tours/:id` - Get tour details
- `GET /api/hotels` - List all hotels
- `GET /api/hotels/:id` - Get hotel details
- `GET /api/guides` - List all guides
- `GET /api/categories` - List all categories
- `GET /api/countries` - List all countries
- `GET /api/cities` - List cities (filter by country)
- `GET /api/news` - List news articles
- `GET /api/reviews` - Get reviews (by tour/hotel/guide)
- `POST /api/orders/create` - Create new order
- `GET /api/orders/:orderNumber` - Get order details
- `POST /api/guide-hire` - Submit guide hire request
- `POST /api/transfer-request` - Submit transfer request
- `POST /api/reviews` - Submit new review
- `GET /api/exchange-rates` - Get current exchange rates

#### Payment Routes
- `POST /api/payments/create-payment-intent` - Stripe payment intent
- `POST /api/payments/create-checkout-session` - Stripe checkout
- `POST /api/payments/confirm-payment` - Confirm Stripe payment
- `POST /api/payments/webhook` - Stripe webhook
- `POST /api/payments/alif/create` - AlifPay payment creation
- `POST /api/payments/alif/callback` - AlifPay callback
- `POST /api/payments/payler/create` - Payler payment creation
- `POST /api/payments/payler/callback` - Payler callback

#### Admin Routes (JWT Required)
- **Tours:**
  - `POST /api/admin/tours` - Create tour
  - `PUT /api/admin/tours/:id` - Update tour
  - `DELETE /api/admin/tours/:id` - Delete tour
  
- **Hotels:**
  - `POST /api/admin/hotels` - Create hotel
  - `PUT /api/admin/hotels/:id` - Update hotel
  - `DELETE /api/admin/hotels/:id` - Delete hotel
  
- **Guides:**
  - `POST /api/admin/guides` - Create guide
  - `PUT /api/admin/guides/:id` - Update guide
  - `DELETE /api/admin/guides/:id` - Delete guide
  
- **Drivers:**
  - `POST /api/admin/drivers` - Create driver
  - `PUT /api/admin/drivers/:id` - Update driver
  - `DELETE /api/admin/drivers/:id` - Delete driver
  
- **Orders:**
  - `GET /api/admin/orders` - List all orders
  - `PUT /api/admin/orders/:id/status` - Update order status
  - `POST /api/admin/orders/:id/refund` - Process refund
  
- **Reviews:**
  - `PUT /api/admin/reviews/:id/approve` - Approve review
  - `DELETE /api/admin/reviews/:id` - Delete review
  
- **News:**
  - `POST /api/admin/news` - Create news article
  - `PUT /api/admin/news/:id` - Update news article
  - `DELETE /api/admin/news/:id` - Delete news article
  
- **Slides:**
  - `POST /api/admin/slides` - Create slide
  - `PUT /api/admin/slides/:id` - Update slide
  - `DELETE /api/admin/slides/:id` - Delete slide
  
- **Exchange Rates:**
  - `POST /api/admin/exchange-rates` - Create rate
  - `PUT /api/admin/exchange-rates/:id` - Update rate
  
- **Guide Hire Requests:**
  - `GET /api/admin/guide-hire-requests` - List requests
  - `PUT /api/admin/guide-hire-requests/:id` - Update request status
  
- **Transfer Requests:**
  - `GET /api/admin/transfer-requests` - List requests
  - `PUT /api/admin/transfer-requests/:id` - Update request status

#### Guide Dashboard Routes (Guide JWT Required)
- `GET /api/guide/profile` - Get guide profile
- `PUT /api/guide/profile` - Update profile
- `GET /api/guide/tours` - Get assigned tours
- `GET /api/guide/trips` - Get trip history
- `POST /api/guide/availability` - Update availability

#### Driver Dashboard Routes (Driver JWT Required)
- `GET /api/driver/profile` - Get driver profile
- `PUT /api/driver/profile` - Update profile
- `GET /api/driver/transfers` - Get assigned transfers
- `GET /api/driver/trips` - Get trip history
- `POST /api/driver/availability` - Update availability

### **Controller Summary** (25 Controllers)
1. **tourController.ts** - Tour CRUD, search, filters
2. **hotelController.ts** - Hotel CRUD, room management
3. **guideController.ts** - Guide CRUD, availability
4. **driverController.ts** - Driver CRUD, vehicle management
5. **bookingController.ts** - Booking creation and management
6. **orderController.ts** - Order processing, status updates
7. **customerController.ts** - Customer management
8. **reviewController.ts** - Review submission, approval
9. **categoryController.ts** - Category CRUD
10. **countryController.ts** - Country CRUD
11. **cityController.ts** - City CRUD
12. **newsController.ts** - News/blog management
13. **slideController.ts** - Homepage slides CRUD
14. **tourBlockController.ts** - Tour blocks CRUD
15. **exchangeRateController.ts** - Currency rates management
16. **guideHireController.ts** - Guide hire requests
17. **transferController.ts** - Transfer requests (alias for driverController)
18. **tourAgentController.ts** - B2B agent management
19. **tripController.ts** - Trip history and reporting
20. **priceCalculatorController.ts** - Pricing component management
21. **adminController.ts** - Admin authentication and management
22. **tourGuideController.ts** - Tour guide profile management
23. **tourHistoryController.ts** - Tour historical data
24. **alifController.ts** - AlifPay integration
25. **paylerController.ts** - Payler integration
26. **publicController.ts** - Public data aggregation
27. **translationController.ts** - Translation management (future)
28. **cmsController.ts** - General CMS operations

---

## 🔧 MIDDLEWARE & UTILITIES

### **Middleware** (`src/middleware/`)
1. **authMiddleware.ts** - JWT verification for admin/guide/driver routes
2. **rateLimitMiddleware.ts** - Rate limiting (100 req/15min on auth)
3. **errorHandler.ts** - Global error handling and logging
4. **corsMiddleware.ts** - CORS configuration
5. **uploadMiddleware.ts** - Multer file upload configuration

### **Utility Functions** (`src/utils/`)
1. **multilingual.ts** - `parseMultilingualField`, `getLanguageFromRequest`
2. **validation.ts** - Input validation schemas
3. **dateUtils.ts** - Date formatting and timezone conversion
4. **currencyConverter.ts** - Live currency conversion
5. **emailFormatter.ts** - Email template rendering
6. **fileUpload.ts** - Cloud storage upload helpers
7. **pdfGenerator.ts** - Invoice and voucher PDF generation (future)

---

## 📁 FILE STRUCTURE

```
bunyod-tour/
├── frontend/
│   ├── index.html
│   ├── tours-search.html
│   ├── tour-details.html
│   ├── booking-step1.html
│   ├── booking-step2.html
│   ├── booking-step3.html
│   ├── hotels-catalog.html
│   ├── hotel-details.html
│   ├── guides-directory.html
│   ├── hire-guide.html
│   ├── transfers.html
│   ├── about.html
│   ├── contact.html
│   ├── my-bookings.html
│   ├── payment-success.html
│   ├── payment-fail.html
│   ├── admin-dashboard.html (15,525 lines)
│   ├── guide-dashboard.html
│   ├── driver-dashboard.html
│   └── public/
│       ├── css/ (Tailwind CSS)
│       ├── js/
│       │   ├── i18n.js (2,100+ lines)
│       │   ├── utils.js
│       │   ├── security-utils.js
│       │   ├── booking-state.js
│       │   ├── admin-helpers.js
│       │   ├── unified-form-handler.js
│       │   ├── dropdown-helpers.js
│       │   └── [other scripts]
│       └── images/ (logos, icons, placeholders)
│
├── src/
│   ├── config/
│   │   └── database.ts (Prisma client)
│   ├── controllers/ (25+ controllers)
│   ├── routes/
│   │   └── index.ts (main router)
│   ├── middleware/
│   ├── models/
│   │   └── index.ts (Prisma model wrappers)
│   ├── services/
│   │   ├── emailService.ts
│   │   ├── paymentService.ts
│   │   └── uploadService.ts
│   ├── utils/
│   └── types/ (TypeScript interfaces)
│
├── prisma/
│   ├── schema.prisma (30+ models)
│   └── migrations/
│
├── index.js (Express server entry point)
├── package.json
├── tsconfig.json
├── .env (environment variables)
└── .gitignore
```

---

## 🌍 ENVIRONMENT VARIABLES

### **Required Variables**
```bash
# Database
DATABASE_URL="postgresql://..."
PGHOST="..."
PGPORT="5432"
PGUSER="..."
PGPASSWORD="..."
PGDATABASE="..."

# JWT Authentication
JWT_SECRET="..." (MANDATORY - server won't start without it)

# Email Service
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="noreply@bunyod-tour.com"
SMTP_PASS="..."

# Payment Gateways
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
ALIF_MERCHANT_KEY="..."
ALIF_MERCHANT_PASSWORD="..."
ALIF_API_URL="https://api.alifpay.tj"
PAYLER_KEY="..."

# Cloud Storage (Optional)
GCS_BUCKET_NAME="..."
GCS_PROJECT_ID="..."
GCS_CREDENTIALS="..." (JSON)

# Application
BASE_URL="http://localhost:5000"
PUBLIC_URL="http://localhost:5000"
PORT="5000"
NODE_ENV="development"
```

### **Optional Variables**
```bash
# Future Payment Gateways
CLICK_MERCHANT_ID="..."
PAYME_MERCHANT_ID="..."
BINANCE_API_KEY="..."
KORTI_MILLI_KEY="..."

# External Services
GOOGLE_MAPS_API_KEY="..." (for maps)
CURRENCY_API_KEY="..." (for auto exchange rates)

# Admin
ADMIN_EMAIL="admin@bunyod-tour.com"
SUPPORT_EMAIL="support@bunyod-tour.com"
```

---

## 🚦 WORKFLOW CONFIGURATION

### **Current Workflow**
- **Name:** Unified Server
- **Command:** `node index.js`
- **Port:** 5000 (serves both frontend and API)
- **Auto-restart:** Yes (on file changes in development)

### **How It Works**
1. Express server starts on port 5000
2. Serves static files from `/frontend` directory
3. API routes available at `/api/*`
4. Admin dashboard at `/admin-dashboard.html`
5. Public pages at root `/`

---

## 🔍 KEY FEATURES & FUNCTIONALITY

### **1. Advanced Tour Search**
- Multi-criteria filtering (destination, category, duration, price, difficulty)
- Full-text search on titles and descriptions (multilingual)
- Date-based availability filtering
- Sort by relevance, price, rating, newest

### **2. Dynamic Pricing**
- Component-based pricing system
- Real-time price calculation with hotel/meal selections
- Multi-currency support with live conversion
- Discount and promotional pricing (admin configurable)

### **3. Booking State Management**
- Persistent state across 3-step booking flow
- SessionStorage for temporary data
- Validation at each step before proceeding
- Auto-save on input change (debounced)

### **4. Payment Integration**
- Multiple payment gateways (local and international)
- Secure HMAC signature validation on callbacks
- PCI-compliant (using hosted payment pages)
- Automatic order status updates
- Email confirmations on successful payment

### **5. Multilingual Support**
- Centralized i18n system with 2,100+ translations
- Database multilingual fields (JSON format)
- Automatic language detection from browser
- Language switcher in UI (persists to localStorage)

### **6. Admin Operations**
- Comprehensive admin dashboard (22 modules)
- Real-time data updates
- Bulk operations and exports
- Role-based access control (future)
- Audit logs (future)

### **7. Email Notifications**
- Automated emails for booking confirmations
- Payment confirmations
- Booking cancellations
- Admin notifications for new orders
- HTML templates with company branding

### **8. Guide & Driver Management**
- Separate dashboards for guides and drivers
- Availability calendar
- Trip history and earnings tracking
- Rating and review system
- Tour/transfer assignments

### **9. Review System**
- Customer reviews for tours, hotels, guides
- Admin moderation (approve/reject)
- Star ratings (1-5)
- Featured reviews on homepage
- Response capability (future)

### **10. CMS Features**
- News/blog management
- Homepage carousel slides
- Reusable tour content blocks
- Categories and taxonomy
- SEO meta tags

---

## 🐛 KNOWN ISSUES & TODOS

### **Current Issues**
1. **Integration Setup:** 3 integrations pending setup (database, object storage)
2. **Email SMTP:** Not configured in production (uses fallback)
3. **Payment Placeholders:** Click, PayMe, Binance, Korti Milli not fully implemented
4. **PDF Generation:** Invoice/voucher download not implemented
5. **Mobile Optimization:** Some admin panels not fully responsive

### **Priority TODOs**
1. Complete Replit integrations setup (database, object storage)
2. Configure production SMTP credentials
3. Implement PDF invoice generation
4. Add role-based admin permissions
5. Complete Click and PayMe payment integrations
6. Add audit logs for admin actions
7. Implement booking modification (date/hotel change)
8. Add loyalty program and customer rewards
9. Implement real-time chat support
10. Add advanced analytics dashboard

---

## 📊 PERFORMANCE & OPTIMIZATION

### **Current Optimizations**
- Static file caching (Express)
- Database query optimization (Prisma)
- Lazy loading images on frontend
- Debounced search inputs
- Pagination on all data tables (20 items/page)

### **Future Optimizations**
- Redis caching for frequent queries
- CDN for static assets
- Image optimization pipeline (WebP conversion)
- API response compression (gzip)
- Database connection pooling
- Server-side rendering (SSR) for SEO

---

## 🔐 SECURITY BEST PRACTICES

### **Implemented Security**
1. **Authentication:**
   - JWT with secure secret (mandatory)
   - Bcrypt password hashing (10 rounds)
   - Token expiration (24 hours)
   
2. **Input Validation:**
   - XSS protection via `security-utils.js`
   - SQL injection prevention (Prisma ORM)
   - CSRF protection (future)
   
3. **API Security:**
   - Rate limiting on sensitive endpoints
   - CORS configuration
   - HTTPS enforcement (production)
   - Payment callback signature validation
   
4. **Data Protection:**
   - Environment secrets (never in git)
   - Secure session storage
   - PCI-compliant payment handling

### **Security TODOs**
- Implement CSRF tokens
- Add 2FA for admin accounts
- Enable HTTPS on all routes
- Add IP whitelisting for admin access
- Implement security headers (helmet.js)
- Regular security audits

---

## 📈 SCALABILITY CONSIDERATIONS

### **Current Capacity**
- **Expected Load:** 100-500 concurrent users
- **Database:** PostgreSQL (scalable with Replit)
- **File Storage:** Local + Cloud (Google Cloud Storage ready)

### **Scaling Strategy (Future)**
1. **Horizontal Scaling:**
   - Load balancer for multiple server instances
   - Session management with Redis
   - Distributed file storage
   
2. **Database Optimization:**
   - Read replicas for heavy queries
   - Partitioning for large tables (Orders, Reviews)
   - Caching layer (Redis/Memcached)
   
3. **CDN Integration:**
   - Static assets on CDN (Cloudflare/AWS CloudFront)
   - Image optimization and delivery
   
4. **Microservices (Long-term):**
   - Separate payment service
   - Separate email service
   - Separate search service (Elasticsearch)

---

## 🎓 LEARNING RESOURCES & DOCUMENTATION

### **Technologies Used**
- **Express.js:** https://expressjs.com/
- **Prisma ORM:** https://www.prisma.io/docs/
- **Stripe API:** https://stripe.com/docs/api
- **AlifPay:** [Internal documentation]
- **Payler:** [Internal documentation]
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Flatpickr:** https://flatpickr.js.org/
- **Uppy:** https://uppy.io/docs/

### **Project-Specific Docs**
- API Documentation: (To be created with Swagger/OpenAPI)
- Database ERD: (To be generated from Prisma schema)
- Admin User Guide: (To be written)
- Developer Onboarding: (To be written)

---

## 🚀 DEPLOYMENT GUIDE

### **Development Environment**
1. Clone repository
2. Install dependencies: `npm install`
3. Setup `.env` file with required variables
4. Run Prisma migrations: `npx prisma migrate dev`
5. Seed database (optional): `npx prisma db seed`
6. Start server: `npm run dev` (or `node index.js`)
7. Access at: `http://localhost:5000`

### **Production Deployment (Replit)**
1. Configure environment variables in Replit Secrets
2. Ensure `JWT_SECRET` is set (mandatory)
3. Configure SMTP for email service
4. Setup payment gateway credentials
5. Run workflow: "Unified Server"
6. Monitor logs for errors
7. Test all critical flows (booking, payment)

### **Database Migration Checklist**
- [ ] Backup production database
- [ ] Test migrations in staging
- [ ] Run `npx prisma migrate deploy`
- [ ] Verify data integrity
- [ ] Monitor for errors

---

## 📞 SUPPORT & CONTACT

### **For Technical Issues**
- GitHub Issues: (Repository link)
- Developer Slack: (Channel link)
- Email: dev@bunyod-tour.com

### **For Business Inquiries**
- Website: https://bunyod-tour.com
- Email: support@bunyod-tour.com
- Phone: +992 123 456 789
- WhatsApp: +992 123 456 789

---

## 📝 CHANGELOG

### **Version 1.0.0** (Current)
- Initial release
- 30+ database models
- 25+ API controllers
- 22 admin modules
- 3-step booking workflow
- Multi-payment gateway integration
- Multilingual support (RU/EN)
- Email notification system

### **Planned for Version 1.1.0**
- PDF invoice generation
- Booking modification
- Click and PayMe integration
- Enhanced mobile responsiveness
- Role-based admin permissions
- Real-time chat support

---

## 🏆 PROJECT ACHIEVEMENTS

### **Completed Milestones**
✅ Full-stack architecture design  
✅ Database schema with 30+ models  
✅ Complete admin panel (15,525 lines)  
✅ 3-step booking workflow  
✅ Multi-payment gateway integration  
✅ Multilingual system (2,100+ translations)  
✅ Email notification system  
✅ Dynamic pricing with components  
✅ Guide and driver management  
✅ Review and rating system  

### **Metrics**
- **Total Lines of Code:** ~25,000+ lines
- **API Endpoints:** 80+ routes
- **Database Models:** 30+ models
- **Supported Languages:** 2 (Russian, English)
- **Payment Gateways:** 3 active + 4 planned
- **Supported Currencies:** 5 (TJS, USD, EUR, RUB, CNY)

---

**END OF COMPREHENSIVE ANALYSIS**

*This document provides a complete overview of the Bunyod-Tour codebase. For specific implementation details, refer to the source code files mentioned throughout this analysis.*
