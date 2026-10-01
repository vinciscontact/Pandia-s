// ---------------------------------------------------------------------------
// Menu data. One source of truth for /menu, /order and the home page.
//
// Sections marked SOURCE: MENU CARD were transcribed from the restaurant's printed
// menu (photos shared by the owner, Oct 2026) and are `verified: true`.
// Sections marked DRAFT were not on the photos we received (biryani, parotta, tiffin,
// soups, shawarma, rice & noodles). Their prices are placeholders until the owner
// sends those pages.
//
// price: number      -> fixed price
// price: null        -> "Seasonal" (market price, ask the server; not orderable online)
// variants           -> protein / portion options, each with its own price (or null = seasonal)
// ---------------------------------------------------------------------------

export type Diet = "veg" | "egg" | "nonveg";
export type Tag = "signature" | "special" | "bestseller" | "spicy" | "new";
export type Variant = { label: string; price: number | null };

export type Dish = {
  id: string;
  name: string;
  tamil?: string;
  desc?: string;
  price: number | null;
  variants?: Variant[];
  diet: Diet;
  category: string;
  tags?: Tag[];
  verified?: boolean;
  image?: string; // drop real photos into /public/img/dishes and set the path here
};

export type Category = { id: string; name: string; blurb: string };

export const categories: Category[] = [
  { id: "biryani", name: "Biryani", blurb: "Golden, gently spiced, slow on the dum." },
  { id: "kuska", name: "Kuska & Rice", blurb: "Biryani rice, minus the pieces. North Madras loves it." },
  { id: "chicken", name: "Fried Chicken & Starters", blurb: "Seven ways to fry a chicken. All of them good." },
  { id: "seafood", name: "Indian Seafood", blurb: "Crab, prawn, karimeen and vanjaram from the coast." },
  { id: "kebabs", name: "Kebabs & Tikka", blurb: "Off the tandoor, smoky at the edges." },
  { id: "mutton", name: "Mutton Specials", blurb: "Kozhambu, pirattal and paya, South Indian style." },
  { id: "south-seafood", name: "South Indian Seafood", blurb: "Masala, thokku or pepper gravy." },
  { id: "indian-main", name: "Indian Main Course", blurb: "Pick the gravy, then pick the meat." },
  { id: "chinese", name: "Chinese Main Course", blurb: "Chennai-style Chinese. Pick the gravy, then pick the meat." },
  { id: "parotta", name: "Parotta & Breads", blurb: "Soft, flaky, made fresh in the evenings." },
  { id: "tiffin", name: "Tiffin", blurb: "Dosai, kalakki and the morning-to-night classics." },
  { id: "soups", name: "Soups", blurb: "Hot, peppery, Chettinad style." },
  { id: "rice-noodles", name: "Rice & Noodles", blurb: "Fried rice and noodles, wok-tossed." },
  { id: "shawarma", name: "Shawarma", blurb: "Rolled to order." },
  { id: "desserts", name: "Desserts", blurb: "Something cold after all that spice." },
];

const v = (label: string, price: number | null): Variant => ({ label, price });
const FH = (full: number, half: number) => [v("Full", full), v("Half", half)];

// Protein columns used on the printed Chinese and Indian main-course grids
const COLS = ["Tiger prawn", "Crab (shelless)", "Prawn", "Fish", "Squid", "Mutton", "Chicken", "Egg"];
const S = null; // seasonal
const _ = undefined; // not served in this style
type Cell = number | null | undefined;
function grid(category: string, prefix: string, rows: [string, Cell[], Tag[]?][]): Dish[] {
  return rows.map(([name, cells, tags]) => {
    const variants = cells
      .map((c, i) => (c === undefined ? null : v(COLS[i], c)))
      .filter((x): x is Variant => x !== null);
    const onlyEgg = variants.every((x) => x.label === "Egg");
    return {
      id: `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`,
      name,
      category,
      diet: onlyEgg ? "egg" : "nonveg",
      price: null,
      variants,
      tags,
      verified: true,
    } satisfies Dish;
  });
}

export const dishes: Dish[] = [
  // ------------------------------------------------ DRAFT: biryani (not on the photos received)
  { id: "mutton-biryani", name: "Mutton Biryani", tamil: "மட்டன் பிரியாணி", category: "biryani", diet: "nonveg", price: 320, tags: ["signature", "bestseller"], desc: "Tender mutton and golden rice, with a gentle masala that lets the meat talk." },
  { id: "chicken-biryani", name: "Chicken Biryani", tamil: "சிக்கன் பிரியாணி", category: "biryani", diet: "nonveg", price: 260, tags: ["bestseller"], desc: "Juicy chicken pieces layered and sealed for dum." },
  { id: "fish-biryani", name: "Fish Biryani", category: "biryani", diet: "nonveg", price: 335, verified: true, desc: "Boneless fish folded through fragrant rice." },
  { id: "prawn-biryani", name: "Prawn Biryani", category: "biryani", diet: "nonveg", price: 340, desc: "Coastal prawns, slow-cooked with the rice." },
  { id: "egg-biryani", name: "Egg Biryani", category: "biryani", diet: "egg", price: 180, desc: "Masala eggs on a full plate of biryani rice." },
  { id: "veg-biryani", name: "Veg Biryani", category: "biryani", diet: "veg", price: 190, desc: "Garden vegetables, the same slow dum." },

  // ------------------------------------------------ DRAFT: kuska
  { id: "kuska", name: "Kuska", tamil: "குஸ்கா", category: "kuska", diet: "nonveg", price: 150, tags: ["signature"], desc: "Biryani rice cooked in the mutton stock, minus the pieces. Pair it with a mutton kozhambu." },
  { id: "kuska-egg", name: "Kuska with Egg", category: "kuska", diet: "nonveg", price: 175 },

  // ------------------------------------------------ SOURCE: MENU CARD · Indian Chicken
  { id: "pandias-fried-chicken", name: "Pandia's Fried Chicken", category: "chicken", diet: "nonveg", price: null, variants: FH(400, 270), tags: ["signature"], verified: true, desc: "The house fry, named after the hotel." },
  { id: "chettinad-fried-chicken", name: "Chettinad Fried Chicken", category: "chicken", diet: "nonveg", price: null, variants: FH(400, 270), tags: ["special", "spicy"], verified: true },
  { id: "peppery-fried-chicken", name: "Peppery Fried Chicken", category: "chicken", diet: "nonveg", price: null, variants: FH(400, 270), tags: ["special"], verified: true },
  { id: "andhra-fried-chicken", name: "Andhra Fried Chicken", category: "chicken", diet: "nonveg", price: null, variants: FH(400, 270), tags: ["special", "spicy"], verified: true },
  { id: "red-hot-fried-chicken", name: "Red Hot Fried Chicken", category: "chicken", diet: "nonveg", price: null, variants: FH(400, 270), tags: ["special", "spicy"], verified: true },
  { id: "mughalai-fried-chicken", name: "Mughalai Fried Chicken", category: "chicken", diet: "nonveg", price: null, variants: FH(400, 270), tags: ["special"], verified: true },
  { id: "dragon-fried-chicken", name: "Dragon Fried Chicken", category: "chicken", diet: "nonveg", price: null, variants: FH(400, 270), tags: ["special"], verified: true },
  { id: "sutta-kozhi", name: "Sutta Kozhi", tamil: "சுட்ட கோழி", category: "chicken", diet: "nonveg", price: 450, verified: true, desc: "Chicken roasted over open fire." },
  { id: "dynamite-chicken", name: "Dynamite Chicken", category: "chicken", diet: "nonveg", price: 310, tags: ["special", "spicy"], verified: true },
  { id: "masala-chicken-65", name: "Masala Chicken 65", category: "chicken", diet: "nonveg", price: 220, verified: true },
  { id: "chicken-pakoda", name: "Chicken Pakoda", category: "chicken", diet: "nonveg", price: 240, verified: true },
  { id: "chicken-bits", name: "Chicken Bits", category: "chicken", diet: "nonveg", price: 240, verified: true },

  // ------------------------------------------------ SOURCE: MENU CARD · Indian Seafood
  { id: "crab-fry", name: "Crab Fry (shell)", category: "seafood", diet: "nonveg", price: null, verified: true },
  { id: "crab-puttu", name: "Crab Puttu", category: "seafood", diet: "nonveg", price: 260, verified: true },
  { id: "crab-pepper-fry", name: "Crab Pepper Fry (shell)", category: "seafood", diet: "nonveg", price: null, verified: true },
  { id: "tiger-prawn-65", name: "Tiger Prawn 65", category: "seafood", diet: "nonveg", price: null, verified: true },
  { id: "curry-leaf-tiger-prawn", name: "Curry Leaf Dusted Tiger Prawn", category: "seafood", diet: "nonveg", price: null, verified: true },
  { id: "ghee-tiger-prawn-pepper", name: "Ghee Tiger Prawn Pepper", category: "seafood", diet: "nonveg", price: null, verified: true },
  { id: "fried-tiger-prawn-chinese", name: "Fried Tiger Prawn, Chinese Style", category: "seafood", diet: "nonveg", price: null, tags: ["special"], verified: true },
  { id: "prawn-65", name: "Prawn 65", category: "seafood", diet: "nonveg", price: 260, verified: true },
  { id: "spl-fried-prawns", name: "Spl Fried Prawns", category: "seafood", diet: "nonveg", price: 280, tags: ["special"], verified: true },
  { id: "cheemeen-pollichathu", name: "Cheemeen Pollichathu", category: "seafood", diet: "nonveg", price: 310, tags: ["special"], verified: true, desc: "Prawns in masala, wrapped in banana leaf and pan-roasted, Kerala style." },
  { id: "karimeen-fry", name: "Karimeen Fry", category: "seafood", diet: "nonveg", price: 350, verified: true },
  { id: "karimeen-pollichathu", name: "Karimeen Pollichathu", category: "seafood", diet: "nonveg", price: 350, tags: ["signature"], verified: true, desc: "Pearl spot fish roasted in banana leaf with a thick masala." },
  { id: "spl-vanjaram-fry", name: "Spl Vanjaram Fish Fry", category: "seafood", diet: "nonveg", price: 290, verified: true },
  { id: "vanjaram-tawa-fry", name: "Spl Vanjaram Fish Tawa Fry", category: "seafood", diet: "nonveg", price: 270, verified: true },
  { id: "fish-65", name: "Fish 65", category: "seafood", diet: "nonveg", price: 270, verified: true },
  { id: "spicy-fish-65", name: "Spicy Fish 65", category: "seafood", diet: "nonveg", price: 280, tags: ["spicy"], verified: true },
  { id: "nethili-65", name: "Nethili 65", category: "seafood", diet: "nonveg", price: 200, verified: true },
  { id: "sura-puttu", name: "Sura Puttu", tamil: "சுறா புட்டு", category: "seafood", diet: "nonveg", price: 180, tags: ["special"], verified: true, desc: "Shark, flaked and dry-tossed with onion and spice." },
  { id: "fish-puttu", name: "Fish Puttu", category: "seafood", diet: "nonveg", price: 210, verified: true },
  { id: "squid-65", name: "Squid 65", category: "seafood", diet: "nonveg", price: 240, verified: true },
  { id: "spl-fried-squid", name: "Spl Fried Squid", category: "seafood", diet: "nonveg", price: 270, tags: ["special"], verified: true },
  { id: "basa-steak", name: "Basa Extra Large Steak", category: "seafood", diet: "nonveg", price: 600, verified: true, desc: "Any sauce: Chinese, Indian or BBQ." },

  // ------------------------------------------------ SOURCE: MENU CARD · Kebabs
  { id: "tangdi-kebab", name: "Tangdi Kebab", category: "kebabs", diet: "nonveg", price: 270, verified: true },
  { id: "malabar-chicken-tikka", name: "Malabar Chicken Tikka", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "reshmi-kebab", name: "Reshmi Kebab", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "angari-kebab", name: "Angari Kebab", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "malai-kebab", name: "Malai Kebab", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "irani-kebab", name: "Irani Kebab", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "kalmi-kebab", name: "Kalmi Kebab", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "hariyali-kebab", name: "Hariyali Kebab", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "chicken-tikka", name: "Chicken Tikka", category: "kebabs", diet: "nonveg", price: 250, verified: true },
  { id: "hot-chicken-tikka", name: "Hot Chicken Tikka", category: "kebabs", diet: "nonveg", price: 250, tags: ["special", "spicy"], verified: true },
  { id: "mutton-seekh-kebab", name: "Mutton Seekh Kebab", category: "kebabs", diet: "nonveg", price: 300, verified: true },

  // ------------------------------------------------ SOURCE: MENU CARD · Mutton (South Indian)
  { id: "kola-urundai-kozhambu", name: "Kola Urundai Kozhambu", tamil: "கோலா உருண்டை குழம்பு", category: "mutton", diet: "nonveg", price: 250, verified: true, desc: "Minced mutton balls in a spiced kozhambu." },
  { id: "nalli-roast", name: "Nalli Roast", category: "mutton", diet: "nonveg", price: null, variants: [v("Fry", 250), v("Kozhambu", 230)], verified: true, desc: "Mutton shank, as a dry fry or in kozhambu." },
  { id: "nenjelumbu", name: "Nenjelumbu", category: "mutton", diet: "nonveg", price: null, variants: [v("Fry", 250), v("Kozhambu", 230)], verified: true, desc: "Mutton chest bone, as a dry fry or in kozhambu." },
  { id: "mutton-egg-pirattal", name: "Mutton Egg Pirattal", category: "mutton", diet: "nonveg", price: 230, tags: ["special"], verified: true },
  { id: "pepper-paya", name: "Pepper Paya", category: "mutton", diet: "nonveg", price: 240, verified: true, desc: "Trotters slow-cooked with black pepper." },
  { id: "spl-mutton-kuruma", name: "Spl Mutton Kuruma", category: "mutton", diet: "nonveg", price: 230, tags: ["special"], verified: true },
  { id: "spl-mutton-kozhambu", name: "Spl Mutton Kozhambu", tamil: "மட்டன் குழம்பு", category: "mutton", diet: "nonveg", price: 230, tags: ["signature"], verified: true, desc: "The regulars' bowl with kuska and parotta." },
  { id: "mutton-kheema", name: "Mutton Kheema", category: "mutton", diet: "nonveg", price: 230, verified: true },

  // ------------------------------------------------ SOURCE: MENU CARD · South Indian seafood
  { id: "crab-shell-masala", name: "Crab Shell Masala", category: "south-seafood", diet: "nonveg", price: 260, verified: true },
  { id: "crab-shelless-masala", name: "Crab Shelless Masala / Pepper Gravy", category: "south-seafood", diet: "nonveg", price: 260, verified: true },
  { id: "prawn-masala", name: "Prawn Masala / Thokku / Pepper Gravy", category: "south-seafood", diet: "nonveg", price: 260, verified: true },

  // ------------------------------------------------ SOURCE: MENU CARD · Indian main course (grid)
  ...grid("indian-main", "in", [
    ["Chettinad", [S, 260, 260, 250, 230, 260, 230, 190], ["spicy"]],
    ["Kadai", [_, _, 260, _, _, 260, 230, _]],
    ["Hyderabadi", [_, _, 260, _, _, 260, 230, _]],
    ["Andhra", [_, 260, 260, _, 230, 260, 230, 190], ["spicy"]],
    ["Pepper Masala", [S, 260, 260, 250, 230, 260, 230, 190]],
    ["Masala", [_, 260, _, _, 220, 260, 210, 170]],
    ["Pandia's Spl", [_, _, _, _, _, 270, 240, _], ["signature"]],
    ["Shahi Korma", [_, _, _, _, _, 270, 240, _]],
    ["Mughalai", [_, _, _, _, _, 270, 240, 190]],
  ]),
  { id: "butter-chicken-masala", name: "Butter Chicken Masala", category: "indian-main", diet: "nonveg", price: null, variants: [v("With bone", 220), v("Boneless", 240)], verified: true },
  { id: "chicken-tikka-masala", name: "Chicken Tikka Masala", category: "indian-main", diet: "nonveg", price: 240, verified: true },
  { id: "mutton-kheema-masala", name: "Mutton Kheema Masala", category: "indian-main", diet: "nonveg", price: 240, verified: true },
  { id: "chettinad-omelette-curry", name: "Chettinad Omelette Curry", category: "indian-main", diet: "egg", price: 180, verified: true },

  // ------------------------------------------------ SOURCE: MENU CARD · Chinese main course (grid)
  ...grid("chinese", "cn", [
    ["Chilly", [S, 260, 260, 250, 240, 260, 240, 180], ["spicy"]],
    ["Manchurian", [S, _, 260, 250, 240, _, 240, 180]],
    ["Dragon", [S, _, _, 250, _, _, 240, _]],
    ["Salt & Pepper", [S, 260, 260, 250, 240, _, 240, _]],
    ["Golden Fried", [S, _, 260, _, _, 260, 240, _]],
    ["Butter Fried", [S, _, 260, _, _, 260, 240, _]],
    ["Honey Chilly", [S, _, _, 250, _, _, 240, 180]],
    ["Hot Garlic", [_, _, 260, 250, _, _, 240, 180], ["special"]],
  ]),

  // ------------------------------------------------ DRAFT: parotta, tiffin, soups, rice & noodles, shawarma
  { id: "parotta", name: "Parotta (2 pcs)", category: "parotta", diet: "veg", price: 60, tags: ["bestseller"], desc: "Soft, flaky layers. Ask for extra salna." },
  { id: "ghee-parotta", name: "Ghee Parotta", category: "parotta", diet: "veg", price: 65, verified: true, desc: "Crisped in pure ghee." },
  { id: "chicken-kothu", name: "Chicken Kothu Parotta", category: "parotta", diet: "nonveg", price: 190, desc: "Parotta chopped on the tawa with chicken, egg and salna." },
  { id: "egg-kothu", name: "Egg Kothu Parotta", category: "parotta", diet: "egg", price: 160 },
  { id: "chapathi", name: "Chapathi (2 pcs)", category: "parotta", diet: "veg", price: 50 },
  { id: "dosai", name: "Dosai", category: "tiffin", diet: "veg", price: 72, verified: true, desc: "Thin, crisp, with chutney and sambar." },
  { id: "egg-dosai", name: "Egg Dosai", category: "tiffin", diet: "egg", price: 95 },
  { id: "kalakki", name: "Kalakki", tamil: "கலக்கி", category: "tiffin", diet: "egg", price: 70, desc: "Half-set egg swirled with salna. Eat it hot." },
  { id: "omelette", name: "Omelette", category: "tiffin", diet: "egg", price: 50 },
  { id: "chettinad-chicken-soup", name: "Chettinad Chicken Soup", category: "soups", diet: "nonveg", price: 120, tags: ["signature", "spicy"], desc: "Peppery and a little fiery. Order it first." },
  { id: "mutton-bone-soup", name: "Mutton Bone Soup", category: "soups", diet: "nonveg", price: 140 },
  { id: "chicken-fried-rice", name: "Chicken Fried Rice", category: "rice-noodles", diet: "nonveg", price: 220 },
  { id: "chicken-noodles", name: "Chicken Noodles", category: "rice-noodles", diet: "nonveg", price: 220 },
  { id: "veg-fried-rice", name: "Veg Fried Rice", category: "rice-noodles", diet: "veg", price: 170 },
  { id: "shawarma-roll", name: "Chicken Shawarma Roll", category: "shawarma", diet: "nonveg", price: 140 },
  { id: "shawarma-plate", name: "Shawarma Plate", category: "shawarma", diet: "nonveg", price: 200 },

  // ------------------------------------------------ Desserts (ice creams verified on magicpin)
  { id: "vanilla-ice-cream", name: "Vanilla Ice Cream", category: "desserts", diet: "veg", price: 90, verified: true },
  { id: "strawberry-ice-cream", name: "Strawberry Ice Cream", category: "desserts", diet: "veg", price: 90, verified: true },
  { id: "chocolate-ice-cream", name: "Chocolate Ice Cream", category: "desserts", diet: "veg", price: 110, verified: true },
  { id: "pista-ice-cream", name: "Pista Ice Cream", category: "desserts", diet: "veg", price: 110, verified: true },
  { id: "butterscotch-ice-cream", name: "Butterscotch Ice Cream", category: "desserts", diet: "veg", price: 110, verified: true },
];

/** Shows a small "prices being updated" note while draft prices exist. */
export const HAS_DRAFT_PRICES = dishes.some((d) => !d.verified);

export const signatures = ["mutton-biryani", "pandias-fried-chicken", "karimeen-pollichathu", "kuska", "spl-mutton-kozhambu", "chettinad-chicken-soup"]
  .map((id) => dishes.find((d) => d.id === id)!)
  .filter(Boolean);

export const byCategory = (id: string) => dishes.filter((d) => d.category === id);
export const rupee = (n: number) => "₹" + n.toLocaleString("en-IN");

/** What to print in the price column. */
export function priceLabel(d: Dish): string {
  if (d.variants?.length) {
    const nums = d.variants.map((x) => x.price).filter((p): p is number => p !== null);
    if (!nums.length) return "Seasonal";
    const min = Math.min(...nums);
    return d.variants.length === 2 && nums.length === 2 ? nums.map(rupee).join(" / ") : `from ${rupee(min)}`;
  }
  return d.price === null ? "Seasonal" : rupee(d.price);
}

/** Orderable options for the QR cart: one per variant (or the dish itself). Seasonal items are excluded. */
export function orderOptions(d: Dish): { key: string; label: string; name: string; price: number }[] {
  if (d.variants?.length)
    return d.variants
      .filter((x) => x.price !== null)
      .map((x) => ({
        key: `${d.id}--${x.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: x.label,
        name: `${d.name} (${x.label})`,
        price: x.price as number,
      }));
  return d.price === null ? [] : [{ key: d.id, label: "", name: d.name, price: d.price }];
}
