import { z } from "zod";
import { emptySupport, supportStateSchema } from "../support/model";

export const currencies = [
  "THB",
  "USD",
  "PHP",
  "SGD",
  "MYR",
  "IDR",
  "VND",
  "KHR",
  "LAK",
  "MMK",
  "BND",
] as const;
export const countries = [
  "TH",
  "PH",
  "SG",
  "MY",
  "ID",
  "VN",
  "KH",
  "LA",
  "MM",
  "BN",
  "TL",
] as const;
export const currencySchema = z.enum(currencies);
const text = z.string().trim().min(1).max(160);
const id = z.string().uuid();
const money = z.number().int().safe().min(0).max(10_000_000_000);
export const dateSchema = z.iso.date();
export const destinationSchema = z.union([
  z.literal(""),
  z
    .url()
    .max(1500)
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.hash &&
        !["localhost", "0.0.0.0", "127.0.0.1", "::1", "[::1]"].includes(
          url.hostname,
        ) &&
        !url.hostname.endsWith(".local") &&
        !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
      );
    }, "ใช้ URL แบบ https ของเว็บไซต์ปลายทาง"),
]);

export const partnerInput = z
  .object({
    name: text,
    currency: currencySchema,
    cpaMinor: money,
  })
  .strict();
export const campaignInput = z
  .object({
    name: text,
    country: z.enum(countries),
    currency: currencySchema,
    channel: z.enum(["meta", "google", "affiliate", "organic"]),
    budgetMinor: money,
    landingUrl: destinationSchema.default(""),
    minimumAge: z.number().int().min(18).max(99).nullable().default(null),
    marketReference: z.string().trim().max(500).default(""),
    platformReference: z.string().trim().max(500).default(""),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("partner.create"), input: partnerInput }).strict(),
  z
    .object({ type: z.literal("partner.status"), id, active: z.boolean() })
    .strict(),
  z
    .object({ type: z.literal("campaign.create"), input: campaignInput })
    .strict(),
  z
    .object({ type: z.literal("campaign.update"), id, input: campaignInput })
    .strict(),
  z
    .object({
      type: z.literal("campaign.status"),
      id,
      status: z.enum(["draft", "approved", "paused"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("link.create"),
      campaignId: id,
      partnerId: id.nullable().default(null),
    })
    .strict(),
  z
    .object({
      type: z.literal("spend.set"),
      campaignId: id,
      date: dateSchema,
      amountMinor: money,
    })
    .strict(),
]);
export const eventInput = z
  .object({
    eventId: z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),
    playerId: z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),
    type: z.enum(["registration", "first_deposit", "deposit", "net_revenue"]),
    occurredAt: z.iso.datetime({ offset: true }),
    clickId: id.optional(),
    currency: currencySchema,
    amountMinor: money
      .or(z.number().int().safe().min(-10_000_000_000).max(-1))
      .default(0),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.type === "registration" && event.amountMinor !== 0)
      ctx.addIssue({
        code: "custom",
        message: "Registration must have zero amount",
      });
    if (
      ["first_deposit", "deposit"].includes(event.type) &&
      event.amountMinor <= 0
    )
      ctx.addIssue({
        code: "custom",
        message: "Confirmed deposit must be positive",
      });
  });
const metadata = { id, createdAt: z.iso.datetime() };
export const partnerSchema = partnerInput.extend({
  ...metadata,
  active: z.boolean(),
});
export const campaignSchema = campaignInput.extend({
  ...metadata,
  status: z.enum(["draft", "approved", "paused"]),
  approvedAt: z.iso.datetime().nullable(),
});
const linkSchema = z.object({
  ...metadata,
  code: z.string().regex(/^[a-f0-9]{24}$/),
  campaignId: id,
  partnerId: id.nullable(),
  cpaMinor: money,
});
const clickSchema = z.object({ ...metadata, linkId: id });
const savedEvent = z.object({
  id: z.string(),
  playerHash: z.string(),
  fingerprint: z.string(),
  type: z.enum(["registration", "first_deposit", "deposit", "net_revenue"]),
  occurredAt: z.iso.datetime({ offset: true }),
  receivedAt: z.iso.datetime(),
  clickId: id.nullable(),
  currency: currencySchema,
  amountMinor: z.number().int().safe(),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    support: supportStateSchema.default(emptySupport),
    partners: z.array(partnerSchema),
    campaigns: z.array(campaignSchema),
    links: z.array(linkSchema),
    clicks: z.array(clickSchema),
    events: z.array(savedEvent),
    spend: z.array(
      z.object({ campaignId: id, date: dateSchema, amountMinor: money }),
    ),
    audit: z.array(
      z.object({
        ...metadata,
        action: z.string(),
        targetId: z.string(),
        actor: z.enum(["owner", "backend"]),
      }),
    ),
  })
  .strict();
export type State = z.infer<typeof stateSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type Command = z.infer<typeof commandSchema>;
export type EventInput = z.infer<typeof eventInput>;
export type Currency = z.infer<typeof currencySchema>;
export const emptyState = (): State => ({
  version: 1,
  support: emptySupport(),
  partners: [],
  campaigns: [],
  links: [],
  clicks: [],
  events: [],
  spend: [],
  audit: [],
});
export class MarketingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const decimals = (currency: Currency) => (currency === "VND" ? 0 : 2);
export function moneyText(minor: number | null, currency: Currency) {
  return minor === null
    ? "—"
    : new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency,
        maximumFractionDigits: decimals(currency),
      }).format(minor / 10 ** decimals(currency));
}
export function parseMoney(value: string, currency: Currency): number {
  const digits = decimals(currency);
  if (
    !new RegExp(`^\\d+(?:\\.\\d{1,${digits || 1}})?$`).test(value) ||
    (digits === 0 && value.includes("."))
  )
    throw new Error("จำนวนเงินไม่ถูกต้อง");
  const [whole, fraction = ""] = value.split(".");
  return money.parse(
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0")),
  );
}
