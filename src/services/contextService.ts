import { RealWorldContext } from '../types';

export const POPULAR_CITIES: Record<string, { lat: number; lon: number; country: string; timezone: string }> = {
  'Paris': { lat: 48.8566, lon: 2.3522, country: 'France', timezone: 'Europe/Paris' },
  'Lyon': { lat: 45.7640, lon: 4.8357, country: 'France', timezone: 'Europe/Paris' },
  'Marseille': { lat: 43.2965, lon: 5.3698, country: 'France', timezone: 'Europe/Paris' },
  'Bordeaux': { lat: 44.8378, lon: -0.5792, country: 'France', timezone: 'Europe/Paris' },
  'Bruxelles': { lat: 50.8503, lon: 4.3517, country: 'Belgique', timezone: 'Europe/Brussels' },
  'Genève': { lat: 46.2044, lon: 6.1432, country: 'Suisse', timezone: 'Europe/Zurich' },
  'Montréal': { lat: 45.5017, lon: -73.5673, country: 'Canada', timezone: 'America/Toronto' },
  'New York': { lat: 40.7128, lon: -74.0060, country: 'USA', timezone: 'America/New_York' },
  'Tokyo': { lat: 35.6762, lon: 139.6503, country: 'Japon', timezone: 'Asia/Tokyo' }
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

export function getCityLocalClock(now: Date, timeZone: string): {
  hours: number;
  currentTime: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  localDateKey: string;
  dayOfWeek: string;
  isWeekend: boolean;
  month: number;
} {
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
      hourCycle: 'h23',
    }).formatToParts(now);

    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
    const year = getPart('year') || String(now.getFullYear());
    const monthStr = getPart('month') || String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = getPart('day') || String(now.getDate()).padStart(2, '0');
    const rawHour = Number(getPart('hour'));
    const hours = Number.isFinite(rawHour) ? rawHour % 24 : now.getHours();
    const minute = getPart('minute').padStart(2, '0') || now.getMinutes().toString().padStart(2, '0');
    const dayOfWeek = (getPart('weekday') || '').toLowerCase();

    return {
      hours,
      currentTime: `${hours.toString().padStart(2, '0')}:${minute}`,
      timeOfDay: getTimeOfDay(hours),
      localDateKey: `${year}-${monthStr}-${dayStr}`,
      dayOfWeek: dayOfWeek || ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][now.getDay()],
      isWeekend: dayOfWeek === 'samedi' || dayOfWeek === 'dimanche',
      month: Math.max(0, (Number(monthStr) || now.getMonth() + 1) - 1),
    };
  } catch {
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayOfWeek = dayNames[now.getDay()];
    return {
      hours,
      currentTime: `${hours.toString().padStart(2, '0')}:${minutes}`,
      timeOfDay: getTimeOfDay(hours),
      localDateKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      dayOfWeek,
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      month: now.getMonth(),
    };
  }
}

export function refreshContextClock(ctx: RealWorldContext, now: Date = new Date()): RealWorldContext {
  const cityMeta = POPULAR_CITIES[ctx.city] || POPULAR_CITIES['Paris'];
  const tz = ctx.timezone || cityMeta.timezone;
  const clock = getCityLocalClock(now, tz);
  return {
    ...ctx,
    timezone: tz,
    currentTime: clock.currentTime,
    timeOfDay: clock.timeOfDay,
    localDateKey: clock.localDateKey,
    dayOfWeek: clock.dayOfWeek,
    isWeekend: clock.isWeekend,
  };
}

export async function fetchLiveContext(cityName: string = 'Paris'): Promise<RealWorldContext> {
  const now = new Date();
  const cityCoords = POPULAR_CITIES[cityName] || POPULAR_CITIES['Paris'];
  let activeTimeZone = cityCoords.timezone;
  let clock = getCityLocalClock(now, activeTimeZone);

  let temperature = 18;
  let weatherCondition = 'Ciel doux et agréable';
  let weatherCode = 1;
  let isDay = clock.hours >= 7 && clock.hours < 20;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${cityCoords.lat}&longitude=${cityCoords.lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.timezone === 'string' && data.timezone.includes('/')) {
        activeTimeZone = data.timezone;
        clock = getCityLocalClock(now, activeTimeZone);
      }
      if (data.current) {
        temperature = Math.round(data.current.temperature_2m);
        weatherCode = data.current.weather_code ?? 1;
        isDay = Boolean(data.current.is_day);
        weatherCondition = interpretWeatherCode(weatherCode).text;
      }
    }
  } catch {
    // Fallback to seasonal average if offline or network failure
    temperature = clock.month >= 4 && clock.month <= 9 ? 21 : 12;
    weatherCondition = 'Temps doux de saison';
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
    currentTime: clock.currentTime,
    timeOfDay: clock.timeOfDay,
    timezone: activeTimeZone,
    localDateKey: clock.localDateKey,
    dayOfWeek: clock.dayOfWeek,
    isWeekend: clock.isWeekend,
    lastFetchedAt: Date.now(),
    recentNewsHeadlines: defaultHeadlines,
    injectWeather: true,
    injectNews: true,
    injectTime: true,
  };
}
