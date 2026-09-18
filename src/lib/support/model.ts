import { z } from "zod";

const id = z.string().uuid();
export const articleInput = z
  .object({
    title: z.string().trim().min(4).max(120),
    answer: z.string().trim().min(10).max(1800),
    keywords: z.array(z.string().trim().min(3).max(60)).max(10),
  })
  .strict();
export const articleSchema = articleInput.extend({
  id,
  revision: z.number().int().positive(),
  status: z.enum(["draft", "published"]),
  updatedAt: z.iso.datetime(),
});
const messageSchema = z.object({
  id,
  role: z.enum(["player", "assistant", "owner"]),
  text: z.string().max(2000),
  createdAt: z.iso.datetime(),
  replyTo: id.optional(),
  sourceId: id.optional(),
  sourceTitle: z.string().optional(),
  sourceRevision: z.number().int().optional(),
});
export const threadSchema = z.object({
  id,
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  status: z.enum(["bot", "waiting", "human", "resolved"]),
  reason: z.string().max(60),
  messages: z.array(messageSchema).max(100),
  pending: z.object({ requestId: id, startedAt: z.iso.datetime() }).nullable(),
});
export const supportStateSchema = z.object({
  articles: z.array(articleSchema).max(50),
  threads: z.array(threadSchema).max(500),
  usage: z
    .array(
      z.object({
        date: z.iso.date(),
        starts: z.number().int().nonnegative(),
        messages: z.number().int().nonnegative(),
        aiCalls: z.number().int().nonnegative(),
      }),
    )
    .max(8),
  activity: z
    .array(
      z.object({
        id,
        action: z.string(),
        targetId: z.string(),
        at: z.iso.datetime(),
      }),
    )
    .max(200),
});
export const emptySupport = (): SupportState => ({
  articles: [],
  threads: [],
  usage: [],
  activity: [],
});
export const ownerCommand = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("article.save"),
      id: id.optional(),
      revision: z.number().int().positive().optional(),
      input: articleInput,
    })
    .strict(),
  z
    .object({
      type: z.literal("article.publish"),
      id,
      revision: z.number().int().positive(),
      published: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ticket.reply"),
      id,
      requestId: id,
      text: z.string().trim().min(1).max(1800),
    })
    .strict(),
  z
    .object({
      type: z.literal("ticket.status"),
      id,
      status: z.enum(["human", "resolved"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("assistant.ask"),
      question: z.string().trim().min(1).max(800),
    })
    .strict(),
  z.object({ type: z.literal("demo.seed") }).strict(),
]);
export const publicCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }).strict(),
  z
    .object({
      type: z.literal("message"),
      requestId: id,
      text: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z.object({ type: z.literal("handoff") }).strict(),
]);
export type Article = z.infer<typeof articleSchema>;
export type Thread = z.infer<typeof threadSchema>;
export type SupportState = z.infer<typeof supportStateSchema>;
export type OwnerCommand = z.infer<typeof ownerCommand>;
export type PublicThread = Pick<
  Thread,
  "id" | "status" | "createdAt" | "updatedAt" | "messages"
> & { pending: boolean };
export type Decision =
  | { articleId: string; revision: number; mode: "knowledge" | "ai" }
  | { handoff: string };
