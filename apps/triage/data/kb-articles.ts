import type { Category } from "@/lib/domain";

/**
 * Help centre for "Fernway Office Supply", a fictional B2B office-supplies store.
 * The AI may only use facts from these articles (plus the order context the
 * store sends). All URLs use the reserved `.example` TLD.
 */
export type SeedArticle = {
  slug: string;
  title: string;
  category: Category;
  /** Extra search terms a real help centre would tag the article with. */
  keywords: string;
  body: string;
};

export const KB_ARTICLES: SeedArticle[] = [
  {
    slug: "delivery-times-tracking",
    title: "Delivery times and tracking your order",
    category: "delivery",
    keywords:
      "delivery when arrive arrival tracking track order where is my order eta estimated delivery shipped carrier next business day dispatch status",
    body: `Most in-stock items ordered before 4 pm (local time) on a business day are dispatched the same day and delivered the next business day.

- Small parcels travel with SwiftLine Parcel. Furniture and large orders travel with Fernway Freight, which delivers on a pallet to your loading dock or reception.
- Furniture and some tech items have longer lead times, shown on the product page as "Ships in N days".
- You can follow every order under **Account → Orders**. Each order shows its status, the estimated delivery date, and the carrier and tracking number once it has shipped.
- Deliveries are made between 8 am and 6 pm on business days, and someone needs to sign for them.

If tracking hasn't updated for 2 business days, contact support with your order number and we'll investigate with the carrier.`,
  },
  {
    slug: "delayed-deliveries",
    title: "When a delivery is delayed",
    category: "delivery",
    keywords:
      "delayed late delay rescheduled missed deadline not arrived urgent office move opening new eta cancel undelivered priority dispatch",
    body: `If an order shows **Delayed** under Account → Orders, the carrier has rescheduled it and the new estimated delivery date is shown on the order.

What we do:
1. We contact the carrier as soon as a delay is reported and keep the order's history up to date.
2. If you have a fixed deadline, such as an office opening or a move, tell us the date in your ticket. For Enterprise accounts, your account manager can check whether the items can be dispatched from another fulfilment centre instead. This depends on stock and isn't guaranteed.

Your options:
- If a delivery is more than 2 business days past its original estimated date, you can cancel the undelivered items free of charge.
- You can ask for in-stock items from the same order to be split off and sent separately.
- Delivery charges are refunded automatically on any order that arrives more than 5 business days late.`,
  },
  {
    slug: "partial-shipments",
    title: "Partial deliveries and split shipments",
    category: "delivery",
    keywords:
      "partial partially delivered split shipment boxes packages some items arrived remaining rest of order missing package multiple tracking",
    body: `Large orders can ship in several packages, sometimes from different fulfilment centres, so they may arrive on different days.

- The order shows **Partially delivered** until every package has arrived, and each item shows how many units have been delivered.
- Each package has its own tracking number, listed in the order's history.
- If the remaining packages haven't arrived 2 business days after the first ones, contact support with your order number. We'll trace the package with the carrier and, if it's lost, send a replacement at no cost.`,
  },
  {
    slug: "damaged-wrong-missing",
    title: "Damaged, wrong or missing items",
    category: "damaged_wrong_item",
    keywords:
      "damaged broken cracked dented crushed defective faulty wrong item incorrect missing item short shipped replacement photos",
    body: `If something arrives damaged, faulty or different from what you ordered, report it within 7 days of delivery.

1. Contact support with your order number, the item's SKU and a short description. Photos of the damage and the packaging help us resolve it faster.
2. For furniture, note any visible damage on the carrier's delivery receipt if you can.
3. Once confirmed, we send a free replacement or, if you prefer, refund the item. You don't need to return a damaged item unless we ask; if we do, we email a prepaid return label.

Replacements for in-stock items are dispatched within 1 business day of confirmation.`,
  },
  {
    slug: "returns-policy",
    title: "Returns and refunds",
    category: "returns_refunds",
    keywords:
      "return returns refund credit note money back send back exchange swap ordered by mistake unwanted unopened sealed",
    body: `You can return most items within 30 days of delivery if they are unopened and in their original packaging.

- Not returnable unless faulty: opened ink and toner, assembled furniture, and breakroom consumables.
- To start a return, contact support with the order number and the items you want to return. We email a prepaid return label for orders over $150; for smaller orders the return shipping cost is deducted from the refund.
- Exchanges (for example the wrong toner model) are handled as a return plus a new order, so the right item can ship straight away.
- Refunds are reviewed by our billing team after the return is inspected. Card payments are refunded to the original card within 5–10 business days; invoice accounts receive a credit note.

Items delivered more than 30 days ago can't be returned unless they are faulty.`,
  },
  {
    slug: "invoices-po-payment-terms",
    title: "Invoices, PO numbers and Net-30 terms",
    category: "billing_invoices",
    keywords:
      "invoice po number purchase order net 30 terms due date reissue credit note vat tax id accounts payable bank transfer billing",
    body: `Business and Enterprise accounts can pay by invoice on Net-30 terms.

- An invoice is emailed to your account's billing contact when each order ships. Copies are available under Account → Orders.
- Add your PO number at checkout and it's printed on the invoice and packing slip.
- Missing or wrong PO number, company name or tax ID? Our billing team can reissue any invoice from the last 12 months with corrected details. Contact support with the order number and the correct details.
- Payment is due 30 days after the invoice date, by bank transfer to the account shown on the invoice.
- If an invoice is more than 15 days overdue, new invoice orders are paused until it's paid. Card orders are still possible.

Only the billing team can issue credit notes or change what's owed.`,
  },
  {
    slug: "card-payments",
    title: "Card payments and failed payments",
    category: "billing_invoices",
    keywords: "card payment declined failed charge charged twice duplicate pending authorisation credit card statement",
    body: `Starter accounts pay by card at checkout; Business and Enterprise accounts can also choose card payment.

- If a card is declined, the order isn't placed and nothing is charged. Check the card with your bank, then try again.
- Charges appear on statements as FERNWAY OFFICE.
- A declined or cancelled order can show as a pending authorisation for 3–5 business days before it disappears. It isn't a charge.
- If you see two completed charges for one order, contact support with the order number and the last 4 digits of the card so our billing team can check.`,
  },
  {
    slug: "order-changes-cancellations",
    title: "Changing or cancelling an order",
    category: "order_changes",
    keywords: "cancel cancellation change order modify add item remove item change address quantity before dispatch processing",
    body: `You can change or cancel an order while its status is **Processing**, before it's dispatched.

- Contact support with the order number and the change you need: items, quantities or delivery address.
- Once an order has shipped it can't be changed or cancelled. You can refuse the delivery or return the items under our returns policy.
- Furniture orders can be cancelled until they're dispatched, even with a longer lead time.
- Cancelled card orders are refunded to the original card; cancelled invoice orders are never invoiced.`,
  },
  {
    slug: "account-users-access",
    title: "Signing in and managing your company's users",
    category: "account_access",
    keywords:
      "sign in login log in password reset forgot locked out add user colleague new buyer give access permissions account admin remove user",
    body: `Every buyer has their own sign-in, and all buyers in a company can see the company's orders.

- Forgot your password? Use **Forgot password** on the sign-in page. The reset link is valid for 60 minutes.
- Company admins can add or remove colleagues under **Account → Users**. Enterprise customers can also ask their account manager.
- If a colleague has left, ask a company admin to remove them so they can no longer order on the company account.
- For security, support staff can't see or set passwords, and won't add users without a request from a company admin.`,
  },
  {
    slug: "ink-toner-compatibility",
    title: "Choosing the right ink and toner",
    category: "product_question",
    keywords: "toner ink cartridge compatible compatibility printer model lt-410 lt-300 lt-400 ij-22 drum yield which cartridge",
    body: `Check your printer's model number (usually on a label on the front or inside the cover) before ordering.

- LT-410 toner and DR-410 drums fit LT-400 series printers (LT-400, LT-410, LT-420). They don't fit LT-300 series printers.
- IJ-22 cartridges fit IJ-20 series inkjet printers.
- Page yields are estimates at 5% coverage.
- Ordered the wrong model? Unopened cartridges can be returned within 30 days of delivery under our returns policy.`,
  },
  {
    slug: "bulk-orders-quotes",
    title: "Bulk orders, quotes and contract pricing",
    category: "product_question",
    keywords: "bulk large order quote quotation volume discount contract pricing account manager furniture fit-out tender",
    body: `Your company's contract discount is applied automatically to every order and shown at checkout.

- For orders over $10,000, or more than 50 pieces of furniture, request a quote first. Enterprise customers can ask their account manager; Business customers can contact support.
- Quotes are valid for 30 days and include delivery scheduling for large furniture orders.
- Contract discounts are reviewed once a year. Fernway doesn't price-match other suppliers.`,
  },
];
