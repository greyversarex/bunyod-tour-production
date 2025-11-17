import { Request, Response } from 'express';
import prisma from '../config/database';
import { 
  getLanguageFromRequest, 
  createLocalizedResponse, 
  parseMultilingualField,
  safeJsonParse
} from '../utils/multilingual';

// Translation function for vehicle types
const getVehicleTypeTranslation = (type: string | null, language: string): string => {
  if (!type) return '';
  
  const translations: Record<string, { ru: string; en: string }> = {
    'sedan': { ru: 'Седан', en: 'Sedan' },
    'suv': { ru: 'Внедорожник', en: 'SUV' },
    'minibus': { ru: 'Микроавтобус', en: 'Minibus' },
    'bus': { ru: 'Автобус', en: 'Bus' },
    'minivan': { ru: 'Минивэн', en: 'Minivan' },
    'luxury': { ru: 'Люкс', en: 'Luxury' }
  };
  
  return translations[type.toLowerCase()]?.[language as 'ru' | 'en'] || type;
};

// Get all vehicles with multilingual support
// GET /api/vehicles?lang=en/ru&includeRaw=true
export const getVehicles = async (req: Request, res: Response): Promise<Response> => {
  try {
    const language = getLanguageFromRequest(req);
    const includeRaw = req.query.includeRaw === 'true';
    
    const vehicles = await prisma.vehicle.findMany({
      include: {
        vehicleCountry: true,
        vehicleCity: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Localize vehicles data with safe JSON parsing
    const localizedVehicles = vehicles.map((vehicle: any) => {
      try {
        if (includeRaw) {
          // FOR ADMIN: return ONLY SAFE fields + raw JSON + localized fields
          return {
            id: vehicle.id,
            type: vehicle.type,
            typeTranslated: getVehicleTypeTranslation(vehicle.type, language),
            licensePlate: vehicle.licensePlate,
            capacity: vehicle.capacity,
            images: vehicle.images,
            pricePerDay: vehicle.pricePerDay,
            currency: vehicle.currency,
            countryId: vehicle.countryId,
            cityId: vehicle.cityId,
            country: vehicle.vehicleCountry,
            city: vehicle.vehicleCity,
            brand: vehicle.brand,
            year: vehicle.year,
            isActive: vehicle.isActive,
            createdAt: vehicle.createdAt,
            updatedAt: vehicle.updatedAt,
            _localized: {
              name: parseMultilingualField(vehicle.name, language),
              description: parseMultilingualField(vehicle.description, language)
            },
            _raw: {
              name: safeJsonParse(vehicle.name),
              description: safeJsonParse(vehicle.description)
            }
          };
        } else {
          // FOR PUBLIC USE: include both languages for frontend
          const parsedName = safeJsonParse(vehicle.name);
          const parsedDescription = safeJsonParse(vehicle.description);
          
          return {
            ...vehicle,
            name: parseMultilingualField(vehicle.name, language),
            nameRu: typeof parsedName === 'object' ? parsedName.ru : parsedName,
            nameEn: typeof parsedName === 'object' ? parsedName.en : parsedName,
            description: parseMultilingualField(vehicle.description, language),
            descriptionRu: typeof parsedDescription === 'object' ? parsedDescription.ru : parsedDescription,
            descriptionEn: typeof parsedDescription === 'object' ? parsedDescription.en : parsedDescription,
            typeTranslated: getVehicleTypeTranslation(vehicle.type, language),
            country: vehicle.vehicleCountry,
            city: vehicle.vehicleCity
          };
        }
      } catch (jsonError) {
        console.error('Error parsing vehicle JSON fields:', jsonError, 'Vehicle ID:', vehicle.id);
        return {
          ...vehicle,
          name: vehicle.name || '',
          description: vehicle.description || ''
        };
      }
    });

    const response = createLocalizedResponse(
      localizedVehicles,
      [],
      language,
      'Vehicles retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching vehicles',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get single vehicle with multilingual support
// GET /api/vehicles/:id?lang=en/ru&includeRaw=true
export const getVehicle = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const language = getLanguageFromRequest(req);
    const includeRaw = req.query.includeRaw === 'true';
    
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) },
      include: {
        vehicleCountry: true,
        vehicleCity: true
      }
    });
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Localize vehicle data
    let localizedVehicle;
    try {
      if (includeRaw) {
        localizedVehicle = {
          id: vehicle.id,
          type: vehicle.type,
          typeTranslated: getVehicleTypeTranslation(vehicle.type, language),
          licensePlate: vehicle.licensePlate,
          capacity: vehicle.capacity,
          images: vehicle.images,
          pricePerDay: vehicle.pricePerDay,
          currency: vehicle.currency,
          countryId: vehicle.countryId,
          cityId: vehicle.cityId,
          country: vehicle.vehicleCountry,
          city: vehicle.vehicleCity,
          brand: vehicle.brand,
          year: vehicle.year,
          isActive: vehicle.isActive,
          createdAt: vehicle.createdAt,
          updatedAt: vehicle.updatedAt,
          _localized: {
            name: parseMultilingualField(vehicle.name, language),
            description: parseMultilingualField(vehicle.description, language)
          },
          _raw: {
            name: safeJsonParse(vehicle.name),
            description: safeJsonParse(vehicle.description)
          }
        };
      } else {
        const parsedName = safeJsonParse(vehicle.name);
        const parsedDescription = safeJsonParse(vehicle.description);
        
        localizedVehicle = {
          ...vehicle,
          name: parseMultilingualField(vehicle.name, language),
          nameRu: typeof parsedName === 'object' ? parsedName.ru : parsedName,
          nameEn: typeof parsedName === 'object' ? parsedName.en : parsedName,
          description: parseMultilingualField(vehicle.description, language),
          descriptionRu: typeof parsedDescription === 'object' ? parsedDescription.ru : parsedDescription,
          descriptionEn: typeof parsedDescription === 'object' ? parsedDescription.en : parsedDescription,
          typeTranslated: getVehicleTypeTranslation(vehicle.type, language),
          country: vehicle.vehicleCountry,
          city: vehicle.vehicleCity
        };
      }
    } catch (jsonError) {
      console.error('Error parsing vehicle JSON fields:', jsonError);
      localizedVehicle = {
        ...vehicle,
        name: vehicle.name || '',
        description: vehicle.description || ''
      };
    }

    const response = createLocalizedResponse(
      localizedVehicle,
      [],
      language,
      'Vehicle retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching vehicle',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create vehicle
// POST /api/vehicles
export const createVehicle = async (req: Request, res: Response): Promise<Response> => {
  try {
    let { 
      name, 
      description, 
      type, 
      licensePlate, 
      capacity, 
      images, 
      pricePerDay, 
      currency, 
      countryId, 
      cityId,
      brand,
      year,
      isActive 
    } = req.body;

    // Parse JSON strings if needed
    if (typeof name === 'string') {
      try {
        name = JSON.parse(name);
        req.body.name = name;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid name format - must be valid JSON'
        });
      }
    }
    
    if (description && typeof description === 'string') {
      try {
        description = JSON.parse(description);
        req.body.description = description;
      } catch (e) {
        // description can be a simple string, ignore parsing error
      }
    }

    // Validation
    if (!name || !name.ru || !name.en) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle name is required in both Russian and English'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle type is required'
      });
    }

    if (!licensePlate) {
      return res.status(400).json({
        success: false,
        error: 'License plate is required'
      });
    }

    if (!capacity || capacity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid capacity is required'
      });
    }

    // Check if license plate already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { licensePlate }
    });

    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle with this license plate already exists'
      });
    }

    // Parse images if string
    let parsedImages = images;
    if (typeof images === 'string') {
      try {
        parsedImages = JSON.parse(images);
      } catch (e) {
        parsedImages = [images];
      }
    }

    // Create vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        name,
        description: description || { ru: '', en: '' },
        type: type.toLowerCase(),
        licensePlate,
        capacity: parseInt(capacity),
        images: parsedImages ? JSON.stringify(parsedImages) : null,
        pricePerDay: pricePerDay ? parseFloat(pricePerDay) : null,
        currency: currency || 'TJS',
        countryId: countryId ? parseInt(countryId) : null,
        cityId: cityId ? parseInt(cityId) : null,
        brand: brand || null,
        year: year ? parseInt(year) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true
      },
      include: {
        vehicleCountry: true,
        vehicleCity: true
      }
    });

    return res.status(201).json({
      success: true,
      data: vehicle,
      message: 'Vehicle created successfully'
    });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating vehicle',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update vehicle
// PUT /api/vehicles/:id
export const updateVehicle = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    let { 
      name, 
      description, 
      type, 
      licensePlate, 
      capacity, 
      images, 
      pricePerDay, 
      currency, 
      countryId, 
      cityId,
      brand,
      year,
      isActive 
    } = req.body;

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingVehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Parse JSON strings if needed
    if (name && typeof name === 'string') {
      try {
        name = JSON.parse(name);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid name format - must be valid JSON'
        });
      }
    }
    
    if (description && typeof description === 'string') {
      try {
        description = JSON.parse(description);
      } catch (e) {
        // description can be a simple string, ignore parsing error
      }
    }

    // Check license plate uniqueness if changed
    if (licensePlate && licensePlate !== existingVehicle.licensePlate) {
      const duplicatePlate = await prisma.vehicle.findUnique({
        where: { licensePlate }
      });

      if (duplicatePlate) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle with this license plate already exists'
        });
      }
    }

    // Parse images if string
    let parsedImages = images;
    if (images && typeof images === 'string') {
      try {
        parsedImages = JSON.parse(images);
      } catch (e) {
        parsedImages = [images];
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type) updateData.type = type.toLowerCase();
    if (licensePlate) updateData.licensePlate = licensePlate;
    if (capacity) updateData.capacity = parseInt(capacity);
    if (parsedImages !== undefined) updateData.images = parsedImages ? JSON.stringify(parsedImages) : null;
    if (pricePerDay !== undefined) updateData.pricePerDay = pricePerDay ? parseFloat(pricePerDay) : null;
    if (currency) updateData.currency = currency;
    if (countryId !== undefined) updateData.countryId = countryId ? parseInt(countryId) : null;
    if (cityId !== undefined) updateData.cityId = cityId ? parseInt(cityId) : null;
    if (brand !== undefined) updateData.brand = brand || null;
    if (year !== undefined) updateData.year = year ? parseInt(year) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    // Update vehicle
    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        vehicleCountry: true,
        vehicleCity: true
      }
    });

    return res.json({
      success: true,
      data: vehicle,
      message: 'Vehicle updated successfully'
    });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating vehicle',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete vehicle
// DELETE /api/vehicles/:id
export const deleteVehicle = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }

    // Delete vehicle
    await prisma.vehicle.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting vehicle',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
