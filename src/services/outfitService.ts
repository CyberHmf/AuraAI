import { GirlfriendPersona, LLMConfig, RealWorldContext } from '../types';
import { POPULAR_CITIES, refreshContextClock } from './contextService';
import { logger } from './logger';

export const AUTO_OUTFIT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 heures

export function isBlankOnboardingPersona(girlfriend: GirlfriendPersona): boolean {
  return (
    girlfriend.name === 'Nouvelle Compagne' &&
    Boolean(girlfriend.appearance.avatarUrl?.startsWith('data:image/svg+xml'))
  );
}

/**
 * Détermine si la tenue de la compagne doit être renouvelée automatiquement :
 * - Jamais sur le modèle vierge d'onboarding avant création
 * - Premier déclenchement / aucune date enregistrée
 * - Changement de ville
 * - Premier message / première ouverture d'un nouveau jour calendaire (heure locale de sa ville)
 * - Au moins 6 heures écoulées depuis la dernière adaptation
 */
export function shouldAutoUpdateOutfit(
  girlfriend: GirlfriendPersona,
  rawContext: RealWorldContext,
  nowMs: number = Date.now()
): boolean {
  if (isBlankOnboardingPersona(girlfriend)) return false;

  const ctx = refreshContextClock(rawContext, new Date(nowMs));
  const { lastAutoOutfitAt, lastAutoOutfitDate, lastAutoOutfitCity } = girlfriend.appearance;

  if (!lastAutoOutfitAt || !lastAutoOutfitDate) return true;
  if (lastAutoOutfitCity && lastAutoOutfitCity !== ctx.city) return true;
  if (ctx.localDateKey && lastAutoOutfitDate !== ctx.localDateKey) return true;
  if (nowMs - lastAutoOutfitAt >= AUTO_OUTFIT_INTERVAL_MS) return true;

  return false;
}

function parseLocalHour(currentTime: string): number {
  const match = currentTime.match(/^(\d{1,2})/);
  if (!match) return 14;
  const h = Number(match[1]);
  return Number.isFinite(h) ? h % 24 : 14;
}

/**
 * Fallback déterministe intelligent si aucun LLM n'est joignable.
 * Combine style principal, heure locale, météo/température et ton de personnalité.
 */
export function buildFallbackAdaptiveOutfit(
  girlfriend: GirlfriendPersona,
  rawContext: RealWorldContext
): string {
  const ctx = refreshContextClock(rawContext);
  const hour = parseLocalHour(ctx.currentTime);
  const temp = ctx.temperature;
  const weatherLower = (ctx.weatherCondition || '').toLowerCase();
  const isRainy = /pluie|averse|bruine|orage/.test(weatherLower);
  const isSnowy = /neige/.test(weatherLower) || temp <= 2;

  const mainStyle = (girlfriend.appearance.bodyProfile?.mainStyle || 'Soigné & élégant').toLowerCase();
  const tone = girlfriend.speechStyle.tone;
  const previous = (girlfriend.appearance.currentOutfitStyle || '').toLowerCase();

  const pickDifferent = (choices: string[]): string => {
    const filtered = choices.filter(c => c.toLowerCase() !== previous);
    const pool = filtered.length > 0 ? filtered : choices;
    const idx = (hour + Math.abs(Math.round(temp)) + (ctx.isWeekend ? 1 : 0)) % pool.length;
    return pool[idx];
  };

  // 1. Nuit / très tôt le matin (23h -> 07h29)
  if (hour >= 23 || hour < 7 || (hour === 7 && parseInt(ctx.currentTime.split(':')[1] || '0', 10) < 30)) {
    if (temp <= 14) {
      if (mainStyle.includes('rock') || mainStyle.includes('street') || tone === 'rebel' || tone === 'gothic') {
        return pickDifferent([
          'Grand t-shirt rock oversize & chaussettes hautes douces',
          'Sweat à capuche ample noir & bas de pyjama en coton',
        ]);
      }
      if (mainStyle.includes('riche') || mainStyle.includes('haute couture')) {
        return pickDifferent([
          'Pyjama en satin crème & peignoir léger en cachemire',
          'Nuisette en soie Champagne sous un kimono de chambre doux',
        ]);
      }
      return pickDifferent([
        'Pyjama cosy côtelé & gilet en maille tout doux',
        'Pull d\'intérieur ample sur un short de pyjama en coton',
      ]);
    }

    if (mainStyle.includes('riche') || mainStyle.includes('haute couture')) {
      return pickDifferent([
        'Nuisette en soie satinée & fin déshabillé fluide',
        'Ensemble pyjama court en satin noir raffiné',
      ]);
    }
    return pickDifferent([
      'Pyjama cosy avec débardeur côtelé & short fluide',
      'Grand t-shirt doux en coton & short d\'intérieur léger',
    ]);
  }

  // 2. Matinée / Journée / Soirée selon la température & le style
  if (isSnowy || temp < 10) {
    if (mainStyle.includes('rock') || mainStyle.includes('street') || tone === 'rebel' || tone === 'gothic') {
      return pickDifferent([
        'Perfecto en cuir doublé sur pull noir col roulé, jean slim & boots',
        'Manteau long en laine anthracite, hoodie sombre & bottines crantées',
      ]);
    }
    if (mainStyle.includes('riche') || mainStyle.includes('haute couture')) {
      return pickDifferent([
        'Manteau long en laine camel, pull en cachemire crème & bottes hautes',
        'Veste en fausse fourrure chic sur col roulé noir & pantalon tailleur',
      ]);
    }
    if (mainStyle.includes('bohème')) {
      return pickDifferent([
        'Manteau long texturé, gros pull en maille torsadée & bottines en daim',
        'Cardigan épais bohème sur robe pull chaude & collants opaques',
      ]);
    }
    if (mainStyle.includes('vintage')) {
      return pickDifferent([
        'Blouson aviateur vintage doublé mouton, pull côtelé & jean droit',
        'Manteau en velours côtelé chaud sur col roulé & bottines rétro',
      ]);
    }
    if (mainStyle.includes('négligé')) {
      return pickDifferent([
        'Doudoune courte matelassée sur sweat à capuche chaud & legging',
        'Gros pull en laine oversize, écharpe douillette & jean confortable',
      ]);
    }
    return pickDifferent([
      'Manteau long ceinturé, pull en maille douce, jean brut & bottines',
      'Blazer en laine épaisse sur sous-pull ajusté, écharpe & bottines',
    ]);
  }

  if (temp <= 16) {
    if (isRainy) {
      if (mainStyle.includes('rock') || mainStyle.includes('street')) {
        return pickDifferent([
          'Veste en cuir noire à capuche sur t-shirt ajusté, jean brut & boots',
          'Trench sombre ceinturé sur pull fin noir & bottines de pluie élégantes',
        ]);
      }
      return pickDifferent([
        'Trench beige imperméable sur pull en maille fine, jean droit & bottines',
        'Imperméable chic ceinturé sur marinière ajustée & bottines vernies',
      ]);
    }
    if (mainStyle.includes('rock') || mainStyle.includes('street') || tone === 'rebel') {
      return pickDifferent([
        'Perfecto en cuir noir sur haut côtelé échancré, jean usé & boots',
        'Veste bomber sombre sur crop top manches longues & cargo ajusté',
      ]);
    }
    if (mainStyle.includes('riche') || mainStyle.includes('haute couture')) {
      return pickDifferent([
        'Blazer structuré en tweed sur caraco en soie & pantalon fluide',
        'Trench fluide ivoire sur pull fin en cachemire & escarpins bas',
      ]);
    }
    if (mainStyle.includes('bohème')) {
      return pickDifferent([
        'Veste en daim camel à franges légères sur blouse brodée & jean évasé',
        'Gilet long en maille ajourée sur robe midi fleurie & bottines',
      ]);
    }
    if (mainStyle.includes('vintage')) {
      return pickDifferent([
        'Veste en jean vintage 90s sur petit pull côtelé & pantalon taille haute',
        'Blouson en velours bordeaux sur t-shirt rétro & jean mom',
      ]);
    }
    if (mainStyle.includes('trendy') || mainStyle.includes('teen')) {
      return pickDifferent([
        'Cardigan court boutonné sur débardeur blanc, jean large & baskets',
        'Blouson court en similicuir sur ensemble côtelé & sneakers blanches',
      ]);
    }
    if (mainStyle.includes('négligé')) {
      return pickDifferent([
        'Sweat à capuche doux gris chiné, jean confortable & baskets',
        'Gros gilet moelleux ouvert sur débardeur blanc & legging noir',
      ]);
    }
    return pickDifferent([
      'Blazer fluide sur top en satin, jean taille haute & bottines en cuir',
      'Chemise en coton gaufré sur cardigan fin, jean brut & mocassins',
    ]);
  }

  if (temp <= 22) {
    if (mainStyle.includes('rock') || mainStyle.includes('street')) {
      return pickDifferent([
        'T-shirt vintage noir noué à la taille, jean taille haute & sneakers',
        'Veste en denim délavé ouverte sur crop top noir & jupe courte',
      ]);
    }
    if (mainStyle.includes('riche') || mainStyle.includes('haute couture')) {
      return pickDifferent([
        'Chemise en soie champagne rentrée dans une jupe crayon midi',
        'Ensemble tailleur léger beige rosé sur débardeur fin en satin',
      ]);
    }
    if (mainStyle.includes('bohème')) {
      return pickDifferent([
        'Blouse blanche fluide à manches bouffantes, jean clair & sandales',
        'Robe midi portefeuille terracotta légère à imprimé floral délicat',
      ]);
    }
    if (mainStyle.includes('vintage')) {
      return pickDifferent([
        'Petit top côtelé 90s, jean mom taille haute & baskets rétro',
        'Robe courte à fleurs vintage avec fine veste en jean sur les épaules',
      ]);
    }
    if (mainStyle.includes('négligé')) {
      return pickDifferent([
        'Chemise en lin ample sur débardeur blanc échancré & jean souple',
        'T-shirt oversize confortable noué & cycliste ou jean décontracté',
      ]);
    }
    return pickDifferent([
      'Chemise fluide satinée entrouverte, jean taille haute & mules chic',
      'Petit pull léger col bateau en maille fine & jupe midi fluide',
    ]);
  }

  // Chaud >= 23°C
  if (mainStyle.includes('riche') || mainStyle.includes('haute couture')) {
    return pickDifferent([
      'Robe longue fluide en soie dos nu & sandales dorées fines',
      'Ensemble d\'été en lin ivoire avec caraco satiné & lunettes chic',
    ]);
  }
  if (mainStyle.includes('rock') || mainStyle.includes('street')) {
    return pickDifferent([
      'Débardeur noir échancré, mini-short en denim & bottines légères',
      'Crop top ajusté graphique, jupe cargo courte & sneakers',
    ]);
  }
  if (mainStyle.includes('bohème')) {
    return pickDifferent([
      'Robe d\'été longue en voile de coton blanc & sandales en cuir naturel',
      'Top en crochet crème, jupe longue fluide fendue & bijoux dorés',
    ]);
  }
  return pickDifferent([
    'Robe d\'été fluide à fines bretelles & sandales légères',
    'Caraco léger en lin, short taille haute chic & sandales',
  ]);
}

/**
 * Appelle le LLM serveur pour suggérer une tenue réaliste en français
 * en tenant compte de TOUS les paramètres (style, métier, traits, ville, heure locale, jour, météo).
 * Bascule silencieusement sur un fallback déterministe fiable si hors-ligne ou trop lent.
 */
export async function suggestAdaptiveOutfit(
  girlfriend: GirlfriendPersona,
  rawContext: RealWorldContext,
  llmConfig: LLMConfig
): Promise<{ outfit: string; generatedVia: string }> {
  const ctx = refreshContextClock(rawContext);
  const cityMeta = POPULAR_CITIES[ctx.city];

  try {
    const res = await fetch('/api/suggest-outfit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona: {
          name: girlfriend.name,
          age: girlfriend.age,
          occupation: girlfriend.occupation,
          relationshipStatus: girlfriend.relationshipStatus,
          mainStyle: girlfriend.appearance.bodyProfile?.mainStyle || 'Soigné & élégant',
          generalAttitude: girlfriend.appearance.bodyProfile?.generalAttitude || '',
          tone: girlfriend.speechStyle.tone,
          soulTraits: (girlfriend.soulTraits || []).slice(0, 5),
          previousOutfit: girlfriend.appearance.currentOutfitStyle,
        },
        context: {
          city: ctx.city,
          country: cityMeta?.country || '',
          temperature: ctx.temperature,
          weatherCondition: ctx.weatherCondition,
          isDay: ctx.isDay,
          currentTime: ctx.currentTime,
          timeOfDay: ctx.timeOfDay,
          dayOfWeek: ctx.dayOfWeek || '',
          isWeekend: Boolean(ctx.isWeekend),
        },
        llmConfig,
      }),
      signal: AbortSignal.timeout(4800),
    });

    if (res.ok) {
      const data = await res.json();
      if (typeof data?.outfit === 'string' && data.outfit.trim().length >= 6) {
        const outfit = data.outfit.trim();
        logger.info('RUNTIME', `Tenue adaptée automatiquement (${data.generatedVia || 'llm'}) : ${outfit}`, {
          city: ctx.city,
          time: ctx.currentTime,
          dayOfWeek: ctx.dayOfWeek,
          temp: `${ctx.temperature}°C`,
          weather: ctx.weatherCondition,
        });
        return { outfit, generatedVia: data.generatedVia || 'llm' };
      }
    }
  } catch {
    // Fallback transparent ci-dessous
  }

  const fallbackOutfit = buildFallbackAdaptiveOutfit(girlfriend, ctx);
  logger.info('RUNTIME', `Tenue adaptée automatiquement (fallback local) : ${fallbackOutfit}`, {
    city: ctx.city,
    time: ctx.currentTime,
    dayOfWeek: ctx.dayOfWeek,
    temp: `${ctx.temperature}°C`,
    weather: ctx.weatherCondition,
  });
  return { outfit: fallbackOutfit, generatedVia: 'fallback' };
}
