import { RealWorldContext } from '../types';

export const POPULAR_CITIES: Record<string, { lat: number; lon: number; country: string }> = {
  'Paris': { lat: 48.8566, lon: 2.3522, country: 'France' },
  'Lyon': { lat: 45.7640, lon: 4.8357, country: 'France' },
  'Marseille': { lat: 43.2965, lon: 5.3698, country: 'France' },
  'Bordeaux': { lat: 44.8378, lon: -0.5792, country: 'France' },
  'Bruxelles': { lat: 50.8503, lon: 4.3517, country: 'Belgique' },
  'Genève': { lat: 46.2044, lon: 6.1432, country: 'Suisse' },
  'Montréal': { lat: 45.5017, lon: -73.5673, country: 'Canada' },
  'New York': { lat: 40.7128, lon: -74.0060, country: 'USA' },
  'Tokyo': { lat: 35.6762, lon: 139.6503, country: 'Japon' }
};

export function interpretWeatherCode(code: number): { text: string; icon: string } {
  if (code === 0) return { text: 'Ciel dégagé & ensoleillé', icon: 'Sun' };
  if (code === 1 || code === 2) return { text: 'Éclaircies & passages nuageux', icon: 'CloudSun' };
  if (code === 3) return { text: 'Couvert & gris', icon: 'Cloud' };
  if (code >= 45 && code <= 48) return { text: 'Brouillard d\'automne', icon: 'CloudFog' };
  if (code >= 51 && code <= 55) return { text: 'Bruine légère', icon: 'CloudDrizzle' };
  if (code >= 61 && code <= 65) return { text: 'Pluie douce', icon: 'CloudRain' };
  if (code >= 71 && code <= 77) return { text: 'Chutes de neige', icon: 'Snowflake' };
  if (code >= 80 && code <= 82) return { text: 'Averses passagères', icon: 'CloudRain' };
  if (code >= 95) return { text: 'Orageux', icon: 'CloudLightning' };
  return { text: 'Temps doux', icon: 'CloudSun' };
}

export function getTimeOfDay(hours: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hours >= 5 && hours < 12) return 'morning';
  if (hours >= 12 && hours < 18) return 'afternoon';
  if (hours >= 18 && hours < 23) return 'evening';
  return 'night';
}

export async function fetchLiveContext(cityName: string = 'Paris'): Promise<RealWorldContext> {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
  const timeOfDay = getTimeOfDay(hours);

  const cityCoords = POPULAR_CITIES[cityName] || POPULAR_CITIES['Paris'];

  let temperature = 18;
  let weatherCondition = 'Ciel doux et agréable';
  let weatherCode = 1;
  let isDay = hours >= 7 && hours < 20;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${cityCoords.lat}&longitude=${cityCoords.lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.current) {
        temperature = Math.round(data.current.temperature_2m);
        weatherCode = data.current.weather_code ?? 1;
        isDay = Boolean(data.current.is_day);
        weatherCondition = interpretWeatherCode(weatherCode).text;
      }
    }
  } catch (err) {
    // Fallback to seasonal average if offline or network failure
    const month = now.getMonth();
    temperature = month >= 4 && month <= 9 ? 21 : 12;
    weatherCondition = 'Temps automnal doux';
  }

  // Realistic curated cultural & world headlines to inject naturally
  const defaultHeadlines = [
    'Une exposition de photographie vintage fait sensation au Marais',
    'Le festival du film d\'auteur démarre ce week-end avec des pépites',
    'La météo annonce un week-end parfait pour flâner et prendre l\'air',
    'La nouvelle vague de jazz électronique séduit les salles parisiennes'
  ];

  return {
    city: cityName,
    temperature,
    weatherCondition,
    weatherCode,
    isDay,
    currentTime,
    timeOfDay,
    recentNewsHeadlines: defaultHeadlines,
    injectWeather: true,
    injectNews: true,
    injectTime: true,
  };
}
