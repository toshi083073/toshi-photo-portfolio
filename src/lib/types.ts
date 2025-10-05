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
