import type { ProductCategory } from "@/lib/domain";
import type { ProductIconName } from "@/components/product-icon";

/** Fictional catalogue. Prices are list prices in cents (USD); contract discounts apply per company. */
export type SeedProduct = {
  sku: string;
  name: string;
  category: ProductCategory;
  description: string;
  unitLabel: string;
  priceCents: number;
  stock: number;
  leadTimeDays: number;
  icon: ProductIconName;
  featured?: boolean;
  specs: Array<[string, string]>;
};

export const SEED_PRODUCTS: SeedProduct[] = [
  // Paper & notebooks
  { sku: "PAP-1001", name: "Everyday copy paper, letter, 20 lb", category: "paper", icon: "file", featured: true,
    description: "Bright white multipurpose paper for laser and inkjet printers and copiers. Jam-free guarantee.",
    unitLabel: "Case of 10 reams (5,000 sheets)", priceCents: 5499, stock: 840, leadTimeDays: 1,
    specs: [["Size", "8.5 × 11 in"], ["Weight", "20 lb / 75 gsm"], ["Brightness", "92"], ["Recycled content", "10%"]] },
  { sku: "PAP-1002", name: "Premium laser paper, letter, 28 lb", category: "paper", icon: "file",
    description: "Heavyweight, ultra-smooth paper for client-facing proposals and presentations.",
    unitLabel: "Case of 8 reams (4,000 sheets)", priceCents: 7250, stock: 210, leadTimeDays: 1,
    specs: [["Size", "8.5 × 11 in"], ["Weight", "28 lb / 105 gsm"], ["Brightness", "98"]] },
  { sku: "PAP-1003", name: "100% recycled copy paper, letter", category: "paper", icon: "file",
    description: "Post-consumer recycled paper, processed chlorine-free.",
    unitLabel: "Case of 10 reams", priceCents: 4999, stock: 390, leadTimeDays: 1,
    specs: [["Size", "8.5 × 11 in"], ["Weight", "20 lb"], ["Recycled content", "100%"]] },
  { sku: "PAP-1010", name: "Spiral notebooks, college ruled", category: "paper", icon: "notebook",
    description: "Durable poly covers, 100 sheets each, perforated pages.",
    unitLabel: "Pack of 5", priceCents: 1499, stock: 520, leadTimeDays: 1,
    specs: [["Sheets", "100 per notebook"], ["Size", "8.5 × 11 in"]] },
  { sku: "PAP-1020", name: "Sticky notes, 3 × 3 in, assorted", category: "paper", icon: "sticky",
    description: "Super-sticky notes in four bright colours. 90 sheets per pad.",
    unitLabel: "Pack of 24 pads", priceCents: 1849, stock: 600, leadTimeDays: 1,
    specs: [["Size", "3 × 3 in"], ["Sheets", "90 per pad"]] },

  // Pens & markers
  { sku: "WRT-2001", name: "Retractable gel pens, black, 0.7 mm", category: "writing", icon: "pen", featured: true,
    description: "Smooth, quick-drying gel ink with a comfortable rubber grip.",
    unitLabel: "Box of 12", priceCents: 999, stock: 1200, leadTimeDays: 1, specs: [["Ink", "Gel, black"], ["Point", "0.7 mm"]] },
  { sku: "WRT-2002", name: "Ballpoint pens, blue, medium", category: "writing", icon: "pen",
    description: "Reliable everyday ballpoints for the front desk and meeting rooms.",
    unitLabel: "Box of 50", priceCents: 1249, stock: 900, leadTimeDays: 1, specs: [["Ink", "Oil-based, blue"], ["Point", "1.0 mm"]] },
  { sku: "WRT-2010", name: "Dry-erase markers, chisel tip, assorted", category: "writing", icon: "highlighter",
    description: "Low-odour markers that wipe clean from whiteboards and glass.",
    unitLabel: "Set of 8", priceCents: 1199, stock: 430, leadTimeDays: 1, specs: [["Tip", "Chisel"], ["Colours", "8 assorted"]] },
  { sku: "WRT-2020", name: "Highlighters, chisel tip, assorted", category: "writing", icon: "highlighter",
    description: "Smear-resistant fluorescent ink for documents and reports.",
    unitLabel: "Pack of 24", priceCents: 1599, stock: 310, leadTimeDays: 1, specs: [["Tip", "Chisel"], ["Colours", "6 assorted"]] },

  // Ink & toner
  { sku: "INK-3001", name: "Toner cartridge LT-410, black, high yield", category: "ink-toner", icon: "printer", featured: true,
    description: "High-yield black toner for LT-400 series laser printers. Not compatible with LT-300 series.",
    unitLabel: "1 cartridge", priceCents: 8900, stock: 260, leadTimeDays: 1,
    specs: [["Yield", "approx. 9,000 pages"], ["Compatible", "LT-400, LT-410, LT-420"], ["Colour", "Black"]] },
  { sku: "INK-3002", name: "Toner multipack LT-410, CMYK", category: "ink-toner", icon: "printer",
    description: "One each of black, cyan, magenta and yellow LT-410 toner.",
    unitLabel: "Pack of 4 cartridges", priceCents: 28900, stock: 75, leadTimeDays: 2,
    specs: [["Yield", "approx. 9,000 / 6,500 pages"], ["Compatible", "LT-400 series"]] },
  { sku: "INK-3010", name: "Inkjet cartridge set IJ-22, colour", category: "ink-toner", icon: "droplets",
    description: "Cyan, magenta and yellow cartridges for IJ-20 series inkjet printers.",
    unitLabel: "Set of 3", priceCents: 6400, stock: 140, leadTimeDays: 1, specs: [["Compatible", "IJ-20, IJ-22, IJ-24"]] },
  { sku: "INK-3020", name: "Drum unit DR-410", category: "ink-toner", icon: "printer",
    description: "Replacement imaging drum for LT-400 series printers.",
    unitLabel: "1 unit", priceCents: 11900, stock: 48, leadTimeDays: 2, specs: [["Yield", "approx. 30,000 pages"], ["Compatible", "LT-400 series"]] },

  // Desk & filing
  { sku: "DSK-4001", name: "Heavy-duty stapler, 100-sheet", category: "desk", icon: "paperclip",
    description: "All-metal stapler with jam-release for high-volume stapling.",
    unitLabel: "1 stapler", priceCents: 2499, stock: 160, leadTimeDays: 1, specs: [["Capacity", "100 sheets"]] },
  { sku: "DSK-4002", name: "Standard staples, 1/4 in", category: "desk", icon: "paperclip",
    description: "Galvanised staples for most desktop staplers.",
    unitLabel: "Box of 5,000", priceCents: 649, stock: 980, leadTimeDays: 1, specs: [["Leg length", "1/4 in"]] },
  { sku: "DSK-4010", name: "Mesh desk organiser, 5 compartments", category: "desk", icon: "inbox",
    description: "Steel mesh organiser for pens, notes and phones.",
    unitLabel: "1 organiser", priceCents: 1999, stock: 220, leadTimeDays: 1, specs: [["Material", "Steel mesh"]] },
  { sku: "DSK-4011", name: "Stacking document trays, 3-tier", category: "desk", icon: "layers",
    description: "Letter-size trays that keep incoming and outgoing paperwork apart.",
    unitLabel: "Set of 3", priceCents: 2750, stock: 180, leadTimeDays: 1, specs: [["Size", "Letter"]] },
  { sku: "DSK-4020", name: "Desktop label maker with QWERTY keyboard", category: "desk", icon: "tag",
    description: "Prints durable labels for files, shelves and cables. Includes one tape cassette.",
    unitLabel: "1 label maker", priceCents: 4999, stock: 65, leadTimeDays: 2, specs: [["Tape widths", "6–18 mm"], ["Power", "USB-C or 6 × AA"]] },

  // Furniture
  { sku: "FUR-5001", name: "Ergonomic mesh task chair", category: "furniture", icon: "chair", featured: true,
    description: "Breathable mesh back, adjustable lumbar support, 4D armrests and a 10-year warranty.",
    unitLabel: "1 chair (assembly required)", priceCents: 28900, stock: 95, leadTimeDays: 5,
    specs: [["Weight capacity", "300 lb"], ["Warranty", "10 years"], ["Assembly", "approx. 15 minutes"]] },
  { sku: "FUR-5002", name: "Height-adjustable desk, 60 × 30 in", category: "furniture", icon: "lamp", featured: true,
    description: "Dual-motor sit-stand desk with memory presets and a cable tray.",
    unitLabel: "1 desk (assembly required)", priceCents: 54900, stock: 40, leadTimeDays: 7,
    specs: [["Height range", "25–50 in"], ["Load capacity", "275 lb"], ["Warranty", "7 years"]] },
  { sku: "FUR-5003", name: "Dual monitor arm, gas spring", category: "furniture", icon: "monitor",
    description: "Holds two 17–32 in monitors; clamp or grommet mount.",
    unitLabel: "1 arm", priceCents: 12900, stock: 120, leadTimeDays: 3, specs: [["VESA", "75 × 75, 100 × 100"], ["Per arm", "4.4–19.8 lb"]] },
  { sku: "FUR-5004", name: "Vertical filing cabinet, 3 drawers, lockable", category: "furniture", icon: "archive",
    description: "Steel cabinet with full-extension drawers and a central lock.",
    unitLabel: "1 cabinet", priceCents: 21900, stock: 30, leadTimeDays: 5, specs: [["Drawers", "3, letter size"], ["Lock", "Central, 2 keys"]] },
  { sku: "FUR-5005", name: "Stackable visitor chairs", category: "furniture", icon: "chair",
    description: "Padded seats, steel frames, stack up to 6 high.",
    unitLabel: "Pack of 2", priceCents: 19900, stock: 60, leadTimeDays: 4, specs: [["Stacks", "up to 6"]] },

  // Tech & accessories
  { sku: "TEC-6001", name: "Wireless keyboard and mouse set", category: "tech", icon: "keyboard",
    description: "Quiet keys, 2-year battery life, single USB receiver.",
    unitLabel: "1 set", priceCents: 5999, stock: 300, leadTimeDays: 1, specs: [["Connection", "2.4 GHz USB receiver"], ["Layout", "US"]] },
  { sku: "TEC-6002", name: "USB-C docking station, dual 4K", category: "tech", icon: "usb", featured: true,
    description: "One cable for power (100 W), two 4K displays, Ethernet and five USB ports.",
    unitLabel: "1 dock", priceCents: 17900, stock: 85, leadTimeDays: 2, specs: [["Displays", "2 × 4K @ 60 Hz"], ["Power delivery", "100 W"]] },
  { sku: "TEC-6003", name: "27 in QHD monitor", category: "tech", icon: "monitor",
    description: "IPS panel, height-adjustable stand, USB-C with 65 W charging.",
    unitLabel: "1 monitor", priceCents: 24900, stock: 70, leadTimeDays: 2, specs: [["Resolution", "2560 × 1440"], ["Ports", "USB-C, HDMI, DisplayPort"]] },
  { sku: "TEC-6004", name: "Noise-cancelling headset, USB", category: "tech", icon: "headphones", featured: true,
    description: "Certified for common meeting apps, with a boom microphone and mute light.",
    unitLabel: "1 headset", priceCents: 9900, stock: 150, leadTimeDays: 1, specs: [["Connection", "USB-A / USB-C"], ["Microphone", "Noise-cancelling boom"]] },
  { sku: "TEC-6005", name: "HDMI cables, 6 ft", category: "tech", icon: "cable",
    description: "High-speed cables supporting 4K at 60 Hz.",
    unitLabel: "Pack of 5", priceCents: 2499, stock: 410, leadTimeDays: 1, specs: [["Length", "6 ft"], ["Standard", "HDMI 2.0"]] },

  // Breakroom & cleaning
  { sku: "BRK-7001", name: "Coffee pods, medium roast", category: "breakroom", icon: "coffee", featured: true,
    description: "Single-serve pods compatible with most pod brewers.",
    unitLabel: "Box of 96", priceCents: 5499, stock: 380, leadTimeDays: 1, specs: [["Roast", "Medium"], ["Count", "96 pods"]] },
  { sku: "BRK-7002", name: "Insulated paper cups, 12 oz", category: "breakroom", icon: "cup",
    description: "Double-wall cups for hot drinks, lids sold separately.",
    unitLabel: "Case of 1,000", priceCents: 4200, stock: 160, leadTimeDays: 2, specs: [["Size", "12 oz"]] },
  { sku: "BRK-7003", name: "Disinfecting wipes, lemon", category: "breakroom", icon: "spray",
    description: "Kills 99.9% of common germs on hard, non-porous surfaces.",
    unitLabel: "Pack of 6 canisters (75 wipes each)", priceCents: 2999, stock: 520, leadTimeDays: 1, specs: [["Wipes", "450 total"]] },
  { sku: "BRK-7004", name: "Foaming hand soap refill", category: "breakroom", icon: "droplets",
    description: "Gentle unscented formula for washroom and kitchen dispensers.",
    unitLabel: "4 × 1 L bottles", priceCents: 2350, stock: 240, leadTimeDays: 1, specs: [["Volume", "4 L total"]] },
  { sku: "BRK-7005", name: "Paper towels, multifold", category: "breakroom", icon: "boxes",
    description: "Absorbent two-ply towels for standard multifold dispensers.",
    unitLabel: "Case of 16 packs", priceCents: 3899, stock: 200, leadTimeDays: 2, specs: [["Sheets", "4,000 total"]] },
];
