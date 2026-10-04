// ---------------------------------------------------------------------------
// Hotel Pandia's: brand + branch details.
// Source: public listings (magicpin, Zomato, Restaurant Guru, Crispy Fried Opinions).
// Anything marked `verify: true` was NOT confirmed publicly. Confirm with the owner before launch.
// ---------------------------------------------------------------------------

export const site = {
  name: "Hotel Pandia's",
  shortName: "Pandia's",
  tagline: "Biryani, the Pandia's way.",
  description:
    "Hotel Pandia's is a Chennai biryani house serving golden mutton biryani, kuska, parotta and Chettinad soups. Dine in, scan to order at your table, or call for catering.",
  city: "Chennai",
  cuisines: ["Biryani", "South Indian", "North Indian", "Chinese", "Seafood", "Shawarma", "Desserts"],
  whatsapp: "919217002598", // from magicpin (Vadapalani listing)
  phoneDisplay: "+91 98848 04919",
  phone: "+919884804919",
  costForTwo: 1000,
  social: {
    instagram: "", // add when available
    facebook: "",
    zomato: "https://www.zomato.com/chennai/restaurants/hotel-pandias?category=2",
  },
} as const;

export type Branch = {
  id: string;
  name: string;
  tamil: string; // branch name on the board, in Tamil
  area: string;
  address: string;
  landmark?: string;
  phone?: string;
  phoneDisplay?: string;
  hours?: string;
  lat?: number;
  lng?: number;
  rating?: { value: number; count: number; source: string };
  tables: number; // used to print QR codes on /tables
  verify?: boolean;
};

export const branches: Branch[] = [
  {
    id: "vadapalani",
    name: "Vadapalani",
    tamil: "வடபழனி",
    area: "Vadapalani",
    address: "189, Arcot Road, Vadapalani, Chennai 600026",
    landmark: "Opposite Kamala Theatre, near Vijaya Forum Mall",
    phone: "+919884804919",
    phoneDisplay: "+91 98848 04919",
    hours: "11:00 AM to 11:00 PM",
    lat: 13.04975821,
    lng: 80.21018989,
    rating: { value: 4.0, count: 33, source: "magicpin" },
    tables: 20,
  },
  {
    id: "washermenpet",
    name: "Washermenpet",
    tamil: "வண்ணாரப்பேட்டை",
    area: "Washermenpet",
    address: "Washermenpet, Chennai",
    phone: "+914425952411",
    phoneDisplay: "+91 44 2595 2411",
    hours: "6:30 AM to 11:00 PM",
    lat: 13.11476904,
    lng: 80.28883427,
    rating: { value: 4.3, count: 5, source: "magicpin" },
    tables: 16,
    verify: true, // full street address needed
  },
  {
    id: "royapuram",
    name: "Royapuram",
    tamil: "ராயபுரம்",
    area: "Royapuram",
    address: "Cemetery Road, Royapuram, Chennai",
    tables: 16,
    verify: true, // phone, hours, second Royapuram outlet
  },
  {
    id: "kottivakkam",
    name: "Kottivakkam",
    tamil: "கொட்டிவாக்கம்",
    area: "Kottivakkam",
    address: "Kottivakkam, Chennai",
    tables: 12,
    verify: true, // seen on Zomato; confirm it is still open
  },
];

export const mapsUrl = (b: Branch) =>
  b.lat && b.lng
    ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Hotel Pandia's " + b.address)}`;

export const waLink = (text: string, number: string = site.whatsapp) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

// Real, attributed reviews only. Add more from Google once the owner shares them.
export const reviews = [
  {
    quote: "One of the best non-veg restaurants in Chennai. I love their biriyani and other items too. Service is very good. Sumptuous food!",
    name: "Krishna Sundar",
    source: "Google review via Restaurant Guru",
  },
  {
    quote: "Excellent cooking and service.",
    name: "Ganesh M",
    source: "Google review via Restaurant Guru",
  },
  {
    quote: "Wonderful, a bit spicy and flavorsome.",
    name: "Crispy Fried Opinions",
    source: "Food blog, on the Chettinad Chicken Soup",
  },
  {
    quote: "Can get some tasty biriyani.",
    name: "Tripadvisor diner",
    source: "Tripadvisor review title",
  },
];
