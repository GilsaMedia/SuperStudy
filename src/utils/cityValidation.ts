/**
 * Validates if a city exists using OpenStreetMap Nominatim geocoding API
 * @param cityName - The city name to validate
 * @returns Object with isValid flag and normalized city name if valid
 */
export async function validateCity(cityName: string): Promise<{
  isValid: boolean;
  normalizedName?: string;
  error?: string;
}> {
  if (!cityName || !cityName.trim()) {
    return { isValid: false, error: 'City name cannot be empty' };
  }

  try {
    const searchQuery = cityName.trim();
    
    // Use OpenStreetMap Nominatim API (free, no API key required)
    // Limit results to city-level places and include country info
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      searchQuery
    )}&addressdetails=1&limit=5&accept-language=en`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SuperStudy/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      return {
        isValid: false,
        error: 'Failed to validate city. Please try again.',
      };
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return {
        isValid: false,
        error: `"${cityName}" was not found. Please check the spelling and try again.`,
      };
    }

    // Look for a city/town in the results
    const cityResult = data.find((place: any) => {
      const type = place.type?.toLowerCase() || '';
      const classType = place.class?.toLowerCase() || '';
      const address = place.address || {};
      
      // Check if it's a city, town, or village
      const isCityType = 
        type === 'city' || 
        type === 'town' || 
        type === 'village' ||
        classType === 'place' && (
          address.city || 
          address.town || 
          address.village ||
          address.municipality
        );
      
      return isCityType;
    });

    if (!cityResult) {
      // If no exact city match, check if first result is a place (might be a city)
      const firstPlace = data[0];
      if (firstPlace && firstPlace.type === 'administrative' && firstPlace.class === 'boundary') {
        // Could be a region, try to find city name in address
        const cityName = firstPlace.address?.city || 
                        firstPlace.address?.town || 
                        firstPlace.address?.municipality ||
                        firstPlace.address?.county ||
                        firstPlace.name;
        
        if (cityName) {
          return {
            isValid: true,
            normalizedName: cityName,
          };
        }
      }
      
      return {
        isValid: false,
        error: `"${cityName}" was found but doesn't appear to be a valid city. Please enter a specific city name.`,
      };
    }

    // Extract normalized city name
    const address = cityResult.address || {};
    const normalizedName = 
      address.city || 
      address.town || 
      address.village ||
      address.municipality ||
      cityResult.name ||
      cityName.trim();

    return {
      isValid: true,
      normalizedName: normalizedName.trim(),
    };
  } catch (error) {
    console.error('City validation error:', error);
    return {
      isValid: false,
      error: 'An error occurred while validating the city. Please try again.',
    };
  }
}

