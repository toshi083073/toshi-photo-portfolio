/**
 * データ層：
 * 1) Phase1: markdown + jpgスキャン（無料）
 * 2) Phase2: JSON管理 or Strapiへ切替（DATA_SOURCE指定）
 *
 * jpgを public/photos に置くだけでカード生成。
 * 同名の md が content/photos にあれば、md側frontmatterで上書き（title/caption/tags/date等）
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import exifr from "exifr";
import { marked } from "marked";
import type { Photo, Article } from "./types";

const DATA_SOURCE = process.env.DATA_SOURCE || "markdown"; // "json" | "markdown" | "strapi"
const STRAPI_URL = process.env.STRAPI_URL || "";

const root = process.cwd();
const PHOTOS_DIR = path.join(root, "public", "photos");
const PHOTOS_MD_DIR = path.join(root, "content", "photos");
const POSTS_MD_DIR = path.join(root, "content", "posts");

// GitHub Pages のサブパス対応
const BASE = import.meta.env.BASE_URL || "/";
function withBase(p?: string): string | undefined {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith(BASE)) return p;
  if (p.startsWith("/")) return `${BASE.replace(/\/$/, "")}${p}`;
  return `${BASE}${p}`;
}

// ========== 📸 型定義 ==========
export type YouTube = {
  type: "youtube";
  id: string;
  title: string;
  date?: string;
};

export type Mp4 = {
  type: "mp4";
  src: string;
  poster?: string;
  title: string;
  date?: string;
};

type PhotoJson = { type: "photo" } & Photo;
type MediaJson = PhotoJson | YouTube | Mp4;
export type Video = YouTube | Mp4;

// ========== 📁 ユーティリティ ==========
function ensureDir(p: string) {
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p);
}
function toSlug(filename: string) {
  return filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toLowerCase();
}
function titleFromSlug(slug: string) {
  const name = slug.replace(/[-_]+/g, " ").trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}
function toIsoDate(d?: Date) {
  if (!d) return undefined;
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return undefined;
  }
}

// ========== 📂 Markdown写真読み込み ==========
function readPhotoMdMap(): Record<string, any> {
  const map: Record<string, any> = {};
  if (!fs.existsSync(PHOTOS_MD_DIR)) return map;
  for (const file of fs.readdirSync(PHOTOS_MD_DIR)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(PHOTOS_MD_DIR, file), "utf-8");
    const { data } = matter(raw);
    const slug = file.replace(/\.md$/, "");
    map[slug] = data;
  }
  return map;
}

async function scanPhotosFromFS(): Promise<Photo[]> {
  const files = ensureDir(PHOTOS_DIR)
    .filter((f) => /\.(jpg|jpeg)$/i.test(f))
    .sort();
  const mdMap = readPhotoMdMap();

  const results: Photo[] = [];
  for (const file of files) {
    const slug = toSlug(file);
    const full = path.join(PHOTOS_DIR, file);
    const url = withBase(`/photos/${file}`)!;

    let exif: any = {};
    try {
      exif = (await exifr.parse(full, { userComment: true })) || {};
    } catch {}

    let item: Photo = {
      slug,
      title: titleFromSlug(slug),
      image: url,
      date: toIsoDate(exif?.DateTimeOriginal || exif?.CreateDate),
      caption: undefined,
      tags: [],
      exif: {
        make: exif?.Make,
        model: exif?.Model,
        focalLength: exif?.FocalLength ? `${exif.FocalLength}mm` : undefined,
        fNumber: exif?.FNumber,
        iso: exif?.ISO,
        exposureTime: exif?.ExposureTime
          ? `1/${Math.round(1 / exif.ExposureTime)}`
          : undefined,
      },
    };

    if (mdMap[slug]) {
      const d = mdMap[slug];
      item = {
        ...item,
        title: d.title ?? item.title,
        date: d.date ?? item.date,
        caption: d.caption ?? item.caption,
        tags: d.tags ?? item.tags,
        image: withBase(d.image) ?? item.image,
      };
    }
    results.push(item);
  }
  return results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// ========== 📰 Markdown記事読み込み ==========
function readPostsFromMarkdown(): Article[] {
  if (!fs.existsSync(POSTS_MD_DIR)) return [];
  const files = fs.readdirSync(POSTS_MD_DIR).filter((f) => f.endsWith(".md"));
  const list = files.map((f) => {
    const raw = fs.readFileSync(path.join(POSTS_MD_DIR, f), "utf-8");
    const { data, content } = matter(raw);
    const slug = f.replace(/\.md$/, "");
    return {
      slug,
      title: data.title,
      date: data.date,
      excerpt: data.excerpt,
      cover: withBase(data.cover),
      body: content,
    } as Article;
  });
  return list.so
