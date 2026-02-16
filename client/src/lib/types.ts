export type ViewMode = "interlinear" | "side-by-side";

export interface VerseData {
  chapter: number;
  verse: number;
  hebrew: string;
  english: string;
}

export interface TextSelection {
  book: string;
  chapters?: number[];
  fromChapter?: number;
  fromVerse?: number;
  toChapter?: number;
  toVerse?: number;
}

export interface SefariaBook {
  title: string;
  heTitle: string;
  categories: string[];
}

export interface SefariaCategory {
  name: string;
  heTitle?: string;
  contents?: (SefariaCategory | SefariaBook)[];
}
