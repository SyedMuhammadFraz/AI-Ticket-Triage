import type { CompanyTier, PaymentTerms } from "@/lib/domain";

/** Fictional business customers. Emails use the reserved .example TLD. */
export type SeedCompany = {
  slug: string;
  name: string;
  tier: CompanyTier;
  paymentTerms: PaymentTerms;
  contractDiscountPct: number;
  accountManager: string | null;
  industry: string;
  employees: number;
  shippingAddress: string;
  buyers: Array<{ name: string; email: string; jobTitle: string }>;
};

export const SEED_COMPANIES: SeedCompany[] = [
  {
    slug: "meridian-health",
    name: "Meridian Health Partners",
    tier: "enterprise",
    paymentTerms: "net30",
    contractDiscountPct: 12,
    accountManager: "Dana Whitfield",
    industry: "Healthcare",
    employees: 2400,
    shippingAddress: "Meridian Health Partners, 400 Lakeview Plaza, Floor 9, Chicago, IL 60601",
    buyers: [
      { name: "Daniel Okafor", email: "daniel.okafor@meridianhealth.example", jobTitle: "Procurement Lead" },
      { name: "Grace Liu", email: "grace.liu@meridianhealth.example", jobTitle: "Facilities Director" },
    ],
  },
  {
    slug: "atlas-engineering",
    name: "Atlas Engineering Group",
    tier: "enterprise",
    paymentTerms: "net30",
    contractDiscountPct: 10,
    accountManager: "Ravi Menon",
    industry: "Engineering",
    employees: 1100,
    shippingAddress: "Atlas Engineering Group, 1200 Bayou Center Dr, Houston, TX 77002",
    buyers: [
      { name: "Tomás Herrera", email: "tomas.herrera@atlaseng.example", jobTitle: "Office Services Manager" },
      { name: "Aisha Rahman", email: "aisha.rahman@atlaseng.example", jobTitle: "IT Asset Manager" },
    ],
  },
  {
    slug: "pinecrest-accounting",
    name: "Pinecrest Accounting LLP",
    tier: "business",
    paymentTerms: "net30",
    contractDiscountPct: 5,
    accountManager: null,
    industry: "Professional services",
    employees: 85,
    shippingAddress: "Pinecrest Accounting LLP, 18 Larimer Square, Suite 300, Denver, CO 80202",
    buyers: [{ name: "Maya Chen", email: "maya.chen@pinecrestcpa.example", jobTitle: "Office Manager" }],
  },
  {
    slug: "harbor-logistics",
    name: "Harbor Logistics Co.",
    tier: "business",
    paymentTerms: "net30",
    contractDiscountPct: 7,
    accountManager: null,
    industry: "Logistics",
    employees: 140,
    shippingAddress: "Harbor Logistics Co., 75 Dockside Way, Building C, Seattle, WA 98134",
    buyers: [{ name: "Sofia Rossi", email: "sofia.rossi@harborlogistics.example", jobTitle: "Operations Coordinator" }],
  },
  {
    slug: "brightside-dental",
    name: "Brightside Dental Clinic",
    tier: "starter",
    paymentTerms: "card",
    contractDiscountPct: 0,
    accountManager: null,
    industry: "Healthcare",
    employees: 22,
    shippingAddress: "Brightside Dental Clinic, 310 Riverbend Rd, Austin, TX 78704",
    buyers: [{ name: "Priya Nair", email: "priya.nair@brightsidedental.example", jobTitle: "Practice Manager" }],
  },
  {
    slug: "lin-moreau-architects",
    name: "Lin & Moreau Architects",
    tier: "starter",
    paymentTerms: "card",
    contractDiscountPct: 0,
    accountManager: null,
    industry: "Architecture",
    employees: 14,
    shippingAddress: "Lin & Moreau Architects, 52 Alder Court, Portland, OR 97214",
    buyers: [{ name: "Lukas Becker", email: "lukas.becker@linmoreau.example", jobTitle: "Studio Manager" }],
  },
];
