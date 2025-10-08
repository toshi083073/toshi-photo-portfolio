// データ型（将来Strapiへ移行しても不変）
export type Photo = {
  slug: string;       // URL用キー（拡張子除くファイル名）
  title: string;
  date?: string;      // ISO (ExifのDateTimeOriginalなど)
  image: string;      // 例: /photos/tokyo.jpg
  caption?: string;
  tags?: string[];
  exif?: {
    make?: string;
    model?: string;
    focalLength?: string;
    fNumber?: number;
    iso?: number;
    exposureTime?: string;
  };
};

export type Article = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  cover?: string;
  body?: string;      // md本文（詳細ページで使う）
};

// 📸 JSON形式の写真リストを読み込み
import photosJson from "./photos.json" assert { type: "json" };

export async function listPhotos(): Promise<Photo[]> {
  return photosJson.filter(p => p.type === "photo");
}

export async function listVideos(): Promise<any[]> {
  return photosJson.filter(p => p.type === "youtube" || p.type === "mp4");
}

