import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Geçerli bir hex renk kodu girin (#RRGGBB)");

export const createChannelSchema = z.object({
  input: z.string().trim().min(1, "YouTube URL veya kanal ID'si gerekli"),
  categoryId: z.number().int().nullable().optional(),
  conceptId: z.number().int().nullable().optional(),
  languages: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const updateChannelSchema = z.object({
  categoryId: z.number().int().nullable().optional(),
  conceptId: z.number().int().nullable().optional(),
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
