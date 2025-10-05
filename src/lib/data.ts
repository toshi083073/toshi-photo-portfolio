/**
 * データ層：
 * 1) Phase1: markdown + jpgスキャン（無料）
 * 2) Phase2: Strapiへ切替（DATA_SOURCE=strapi）
 *
 * jpgを public/photos に置くだけでカード生成。
 * 同名の md が content/photos にあれば、md側のfrontmatterで上書き（title/caption/tags/date等）
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import exifr from "exifr";
import type { Photo, Article } from "./types";

const DATA_SOURCE = process.env.DATA_SOURCE || "markdown"; // "markdown" | "strapi"
const STRAPI_URL = process.env.STRAPI_URL || "";

// ---------- 共通ユーティリティ ----------
const root = process.cwd();
const PHOTOS_DIR = path.join(root, "public", "photos");
const PHOTOS_MD_DIR = path.join(root, "content", "photos");
const POSTS_MD_DIR = path.join(root, "content", "posts");

// GitHub Pages のサブパス対策
const BASE = import.meta.env.BASE_URL || "/";

// 先頭が "/" で始まるローカルパスだけ BASE を付ける（外部URLや既にBASE付きはそのまま）
function withBase(p?: string): string | undefined {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith(BASE)) return p;
  if (p.startsWith("/")) return `${BASE.replace(/\/$/, "")}${p}`;
  return `${BASE}${p}`;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p);
}

function toSlug(filename: string) {
  return filename.replace(/\.(jpg|jpeg|png|webp)$/i, "").toLowerCase();
}

function titleFromSlug(slug: string) {
  // ファイル名から人間可読のタイトルへ（-と_をスペースに）
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

// ---------- Phase1: Markdown + ファイルスキャン ----------

// photos md を辞書化（slug => frontmatter）
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
    // ★ GitHub Pages で動く相対URLに修正
    const url = withBase(`/photos/${file}`)!;

    // Exif 取得（DateTimeOriginal など）※無ければundefined
    let exif: any = {};
    try {
      exif = (await exifr.parse(full, { userComment: true })) || {};
    } catch {
      /* 無視（Exif無い画像も多い） */
    }

    // デフォルト（Exifやファイル名から）
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
        exposureTime: exif?.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}` : undefined,
      },
    };

    // 同名の md があれば上書き
    if (mdMap[slug]) {
      const d = mdMap[slug];
      item = {
        ...item,
        title: d.title ?? item.title,
        date: d.date ?? item.date,
        caption: d.caption ?? item.caption,
        tags: d.tags ?? item.tags,
        // mdの image が "/photos/..." の場合も BASE を付与
        image: withBase(d.image) ?? item.image,
      };
    }
    results.push(item);
  }
  // 新しい順（date降順→無日付は後ろ）
  return results.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

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
      // cover が "/photos/..." のとき BASE を付与
      cover: withBase(data.cover),
      body: content,
    } as Article;
  });
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- Phase2: Strapi（ダミー実装：後で本接続） ----------
async function listPhotosFromStrapi(): Promise<Photo[]> {
  const r = await fetch(`${STRAPI_URL}/api/photos?populate=*`);
  const j = await r.json();
  return (j.data || []).map((p: any) => ({
    slug: p.attributes.slug,
    title: p.attributes.title,
    date: p.attributes.date,
    // Strapiが相対URLの場合のためにwithBaseは使わない（外部/絶対URL想定）
    image: p.attributes.image?.data?.attributes?.url || "",
    caption: p.attributes.caption,
    tags: p.attributes.tags || [],
  }));
}
async function listArticlesFromStrapi(): Promise<Article[]> {
  const r = await fetch(`${STRAPI_URL}/api/articles?populate=*`);
  const j = await r.json();
  return (j.data || []).map((a: any) => ({
    slug: a.attributes.slug,
    title: a.attributes.title,
    date: a.attributes.date,
    excerpt: a.attributes.excerpt,
    cover: a.attributes.cover?.data?.attributes?.url || "",
    body: a.attributes.body || "",
  }));
}

// ---------- Public API（UI層はここだけ呼ぶ） ----------
export async function listPhotos(): Promise<Photo[]> {
  return DATA_SOURCE === "strapi" ? listPhotosFromStrapi() : scanPhotosFromFS();
}
export async function getPhotoBySlug(slug: string): Promise<Photo | undefined> {
  const list = await listPhotos();
  return list.find((p) => p.slug === slug);
}
export async function listArticles(): Promise<Article[]> {
  return DATA_SOURCE === "strapi" ? listArticlesFromStrapi() : readPostsFromMarkdown();
}
export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  const list = await listArticles();
  return list.find((a) => a.slug === slug);
}
