import { Location } from '../types';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Format distance for display
 * @param distanceInKm Distance in kilometers
 * @returns Formatted string (e.g., "1.5 km" or "500 m")
 */
export const formatDistance = (distanceInKm: number): string => {
  if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)} m`;
  }
  return `${distanceInKm.toFixed(1)} km`;
};

/**
 * Format time ago (e.g., "2 minutes ago")
 */
export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

/**
 * Validate phone number (10 digits)
 */
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate blood group
 */
export const validateBloodGroup = (bloodGroup: string): boolean => {
  const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  return validGroups.includes(bloodGroup);
};

/**
 * Get route coordinates for drawing polyline on map
 * This is a simple implementation using OpenStreetMap OSRM
 * For production, consider using a proper routing service
 */
export const getRouteCoordinates = async (
  start: Location,
  end: Location
): Promise<Location[]> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      return coordinates.map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));
    }
    
    // Fallback to direct line if routing fails
    return [start, end];
  } catch (error) {
    console.error('Error fetching route:', error);
    // Return direct line as fallback
    return [start, end];
  }
};

/**
 * Get estimated time for route in minutes
 */
export const getEstimatedTime = async (
  start: Location,
  end: Location
): Promise<number> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const durationInSeconds = data.routes[0].duration;
      return Math.ceil(durationInSeconds / 60); // Convert to minutes
    }
    
    return 0;
  } catch (error) {
    console.error('Error fetching estimated time:', error);
    return 0;
  }
};
