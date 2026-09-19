import { mysqlTable, varchar, boolean, int, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Berita (News)
export const newsTable = mysqlTable("news", {
  id: idCol(),
  authorId: varchar("author_id", { length: 36 }),
  data: dataCol(),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});
export type News = typeof newsTable.$inferSelect;
export type InsertNews = typeof newsTable.$inferInsert;

// Informasi Kebudayaan (InfoBudaya)
export const infoBudayaTable = mysqlTable(
  "info_budaya",
  {
    id: idCol(),
    authorId: varchar("author_id", { length: 36 }),
    kategori: varchar("kategori", { length: 64 }),
    active: boolean("active").notNull().default(true),
    order: int("order").notNull().default(0),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byActive: index("idx_info_budaya_active").on(t.active),
  }),
);
export type InfoBudaya = typeof infoBudayaTable.$inferSelect;
export type InsertInfoBudaya = typeof infoBudayaTable.$inferInsert;

// Banner berjalan
export const bannersTable = mysqlTable("banners", {
  id: idCol(),
  active: boolean("active").notNull().default(true),
  data: dataCol(),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});
export type Banner = typeof bannersTable.$inferSelect;
export type InsertBanner = typeof bannersTable.$inferInsert;

// Slider gambar
export const sliderImagesTable = mysqlTable("slider_images", {
  id: idCol(),
  data: dataCol(),
  createdAt: createdAtCol(),
  updatedAt: updatedAtCol(),
});
export type SliderImage = typeof sliderImagesTable.$inferSelect;
export type InsertSliderImage = typeof sliderImagesTable.$inferInsert;
