/**
 * Auto-catégorisation : devine la catégorie d'un produit à partir de son nom.
 * Les mots-clés référencent les slugs du catalogue category-presets. Le matching
 * privilégie le mot-clé le plus long (le plus spécifique) trouvé dans le nom,
 * avec une frontière de mot pour éviter les faux positifs ("the" dans "theatre").
 */
import { CATEGORY_PRESETS, type CategoryPreset } from './category-presets'

export const PRESET_BY_SLUG: Map<string, CategoryPreset & { groupKey: string }> = (() => {
  const m = new Map<string, CategoryPreset & { groupKey: string }>()
  for (const g of CATEGORY_PRESETS) for (const c of g.categories) m.set(c.slug, { ...c, groupKey: g.key })
  return m
})()

// slug → mots-clés (déjà normalisés : minuscules, sans accents)
const KEYWORDS: Record<string, string[]> = {
  // ── Bar ──
  'thb-bieres': ['thb', 'three horses', 'queens', 'queen s', 'skol', 'biere locale', 'gold'],
  'bieres-bouteille': ['biere', 'beer', 'heineken', 'castel', 'flag', 'corona', '33 export', 'bavaria', 'tourtel', 'desperados', 'stella'],
  'bieres-pression': ['pression', 'draft', 'fut', 'demi pression'],
  'vins-rouges': ['vin rouge', 'cabernet', 'merlot', 'syrah', 'bordeaux', 'cotes du rhone', 'pinot noir'],
  'vins-blancs': ['vin blanc', 'chardonnay', 'sauvignon', 'chenin', 'riesling'],
  'vins-roses': ['vin rose', 'rose piscine'],
  'cocktails-classiques': ['mojito', 'margarita', 'daiquiri', 'pina colada', 'cuba libre', 'caipirinha', 'sex on the beach', 'bloody mary', 'tequila sunrise', 'cosmopolitan', 'cocktail', 'long island', 'blue lagoon'],
  'cocktails-signature': ['signature'],
  'mocktails': ['mocktail', 'virgin', 'sans alcool'],
  'whiskies': ['whisky', 'whiskey', 'jack daniel', 'jameson', 'chivas', 'johnnie walker', 'ballantine', 'label', 'glenfiddich', 'william lawson'],
  'rhums': ['rhum', 'rum', 'dzama', 'bacardi', 'captain morgan', 'havana', 'negrita', 'punch', 'rhum arrange', 'old nick'],
  'spiritueux': ['vodka', 'gin', 'tequila', 'cognac', 'brandy', 'absolut', 'smirnoff', 'gordon', 'eristoff'],
  'aperitifs': ['martini', 'ricard', 'pastis', 'porto', 'campari', 'aperol', 'aperitif', 'suze'],
  'digestifs': ['digestif', 'baileys', 'amarula', 'cointreau', 'grand marnier', 'liqueur'],
  'sodas-softs': ['coca', 'cola', 'fanta', 'sprite', 'schweppes', 'pepsi', 'soda', 'limonade', 'tonic', 'bonbon anglais', 'caprice', 'oasis', 'ice tea', 'ice-tea', 'icetea', 'red bull', 'redbull'],
  'jus-fruits': ['jus', 'juice', 'nectar', 'smoothie', 'orange pressee', 'citron presse'],
  'eaux': ['eau', 'water', 'cristalline', 'eau minerale', 'eau gazeuse', 'perrier', 'vittel', 'evian', 'la source', 'eau plate'],
  'cafes-thes': ['cafe', 'coffee', 'the ', 'tea', 'cappuccino', 'expresso', 'espresso', 'latte', 'chocolat chaud', 'infusion', 'the citron', 'the vert'],
  'shots': ['shot', 'shooter'],
  // ── Restaurant ──
  'entrees': ['entree', 'nem', 'samoussa', 'spring roll', 'rouleau de printemps', 'bruschetta', 'foie gras', 'carpaccio', 'terrine', 'beignet'],
  'salades': ['salade', 'salad', 'cesar', 'caesar', 'coleslaw'],
  'soupes': ['soupe', 'soup', 'veloute', 'bouillon', 'potage', 'pho'],
  'viandes': ['boeuf', 'beef', 'steak', 'entrecote', 'filet', 'porc', 'pork', 'magret', 'agneau', 'mouton', 'zebu', 'viande', 'cote de'],
  'volailles': ['poulet', 'chicken', 'volaille', 'canard', 'dinde', 'aile de poulet', 'cuisse de poulet', 'pilon'],
  'poissons': ['poisson', 'fish', 'crevette', 'gambas', 'calamar', 'calmar', 'crabe', 'langouste', 'fruits de mer', 'seiche', 'capitaine', 'thon', 'saumon', 'dorade'],
  'brochettes-grillades': ['brochette', 'grillade', 'grille', 'masikita', 'mixed grill', 'barbecue', 'kebab', 'chawarma', 'shawarma'],
  'pizzas': ['pizza', 'margherita', 'calzone', 'quatre fromages', '4 fromages', 'pizza reine'],
  'pates': ['pates', 'pasta', 'spaghetti', 'tagliatelle', 'lasagne', 'penne', 'bolognaise', 'carbonara', 'ravioli', 'gnocchi'],
  'burgers': ['burger', 'hamburger', 'cheeseburger'],
  'sandwichs': ['sandwich', 'panini', 'croque', 'wrap', 'hot dog', 'hotdog', 'club sandwich'],
  'vegetariens': ['vegetarien', 'vegan', 'tofu', 'legumes sautes'],
  'accompagnements': ['frite', 'frites', 'riz', 'rice', 'puree', 'gratin', 'pomme de terre', 'patate', 'riz cantonais', 'riz sauté', 'riz saute'],
  'sauces': ['sauce', 'ketchup', 'mayonnaise', 'mayo', 'moutarde'],
  'petit-dejeuner': ['petit dejeuner', 'breakfast', 'omelette', 'oeuf', 'croissant', 'tartine', 'viennoiserie', 'pain au chocolat'],
  'menu-enfant': ['menu enfant', 'kids', 'enfant'],
  'formules-midi': ['formule', 'menu du jour', 'menu midi'],
  'plats-du-jour': ['plat du jour', 'suggestion du jour'],
  'desserts': ['dessert', 'gateau', 'tarte', 'mousse au chocolat', 'tiramisu', 'creme brulee', 'profiterole', 'fondant', 'brownie', 'cheesecake', 'flan', 'panna cotta', 'banana split'],
  'glaces-sorbets': ['glace', 'sorbet', 'ice cream', 'coupe glacee', 'sundae'],
  'crepes-gaufres': ['crepe', 'gaufre', 'pancake'],
  // ── Malgache ──
  'romazava-ravitoto': ['romazava', 'ravitoto'],
  'akoho-gasy': ['akoho', 'akoho gasy', 'poulet gasy'],
  'henakisoa': ['henakisoa', 'kisoa', 'porc gasy'],
  'trondro': ['trondro', 'poisson gasy'],
  'mofo-gasy': ['mofo', 'mofo gasy', 'mofo baolina', 'ramanonaka', 'menakely'],
  'koba-sambos': ['koba', 'sambos', 'sambousa'],
  'achards': ['achard', 'lasary', 'pickles', 'rougail'],
  'plats-malgaches': ['vary', 'sosoa', 'kitoza', 'tsaramaso', 'voanjobory', 'laoka', 'hena ritra', 'malagasy', 'gasy', 'anana'],
  'desserts-malgaches': ['godrogodro', 'bonbon coco', 'koba ravina'],
  'ranovola': ['ranovola', 'ranonapango', 'rano'],
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Devine le slug de catégorie le plus pertinent (mot-clé le plus long gagne).
// Mots-clés courts (≤ 3 lettres) exigés en mot entier ; les plus longs en
// sous-chaîne (tolère "jus d'orange", "riz cantonais"…).
export function matchCategorySlug(name: string): string | null {
  const n = normalize(name)
  if (!n) return null
  const padded = ` ${n} `
  let best: { slug: string; score: number } | null = null
  for (const [slug, kws] of Object.entries(KEYWORDS)) {
    for (const kw of kws) {
      const hit = kw.length <= 3 ? padded.includes(` ${kw} `) : n.includes(kw)
      if (hit && (!best || kw.length > best.score)) best = { slug, score: kw.length }
    }
  }
  return best?.slug ?? null
}
