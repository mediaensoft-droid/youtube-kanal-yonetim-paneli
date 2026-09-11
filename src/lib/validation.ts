import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Geçerli bir hex renk kodu girin (#RRGGBB)");

const idList = z.array(z.number().int().positive()).optional();

export const createChannelSchema = z.object({
  input: z.string().trim().min(1, "YouTube URL veya kanal ID'si gerekli"),
  // New channels start either as the user's own (active) or as a planned reference channel.
  status: z.enum(["active", "planned"]).optional(),
  categoryIds: idList,
  conceptIds: idList,
  languages: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const updateChannelSchema = z.object({
  categoryIds: idList,
  conceptIds: idList,
  languages: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  publishDays: z.array(z.number().int().min(1).max(7)).optional(),
  publishTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Geçerli bir saat girin (SS:DD)")
    .nullable()
    .optional(),
  url: z.string().trim().min(1).optional(),
  status: z.enum(["active", "passive", "planned"]).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Kategori adı gerekli"),
  color: hexColor,
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: hexColor.optional(),
});

export const createConceptSchema = z.object({
  name: z.string().trim().min(1, "Konsept adı gerekli"),
  color: hexColor,
});

export const updateConceptSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: hexColor.optional(),
});

export const upsertScheduleEntrySchema = z.object({
  channelId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin (YYYY-AA-GG)"),
  status: z.enum(["planned", "published", "skipped"]).optional(),
  title: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const upsertChannelMonthPatternSchema = z.object({
  channelId: z.number().int(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "Geçerli bir ay girin (YYYY-AA)"),
  publishDays: z.array(z.number().int().min(1).max(7)),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "İsim boş olamaz").max(100, "İsim çok uzun").optional(),
  // Only an explicit null is accepted (clears the photo) — setting an actual URL only happens
  // through the dedicated /api/profile/avatar upload endpoint.
  image: z.literal(null).optional(),
});

export const billingCheckoutSchema = z.object({
  plan: z.enum(["standart", "pro", "ultra"]),
  name: z.string().trim().min(1, "Ad gerekli"),
  surname: z.string().trim().min(1, "Soyad gerekli"),
  gsmNumber: z.string().trim().min(10, "Geçerli bir telefon numarası girin"),
  identityNumber: z.string().trim().regex(/^\d{11}$/, "TC Kimlik No 11 haneli olmalı"),
  address: z.string().trim().min(5, "Adres gerekli"),
  city: z.string().trim().min(1, "Şehir gerekli"),
  zipCode: z.string().trim().optional(),
});

export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, "Kullanıcı adı 3-30 karakter olmalı; küçük harf, rakam, nokta, alt çizgi ve tire kullanılabilir");
export const passwordSchema = z.string().min(8, "Şifre en az 8 karakter olmalı");
export const staffLoginSchema = z.object({ username: usernameSchema, password: z.string().min(1) });

export const createMemberSchema = z.object({
  displayName: z.string().trim().min(1, "Ad gerekli").max(60),
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["vekil", "duzenleyici", "goruntuleyici"]),
});

export const updateMemberSchema = z.object({
  displayName: z.string().trim().min(1, "Ad gerekli").max(60).optional(),
  role: z.enum(["vekil", "duzenleyici", "goruntuleyici"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const setMemberPasswordSchema = z.object({ password: passwordSchema });
