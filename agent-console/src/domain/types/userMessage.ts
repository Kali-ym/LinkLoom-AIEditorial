/** User message rich content — consumed by features via domain types only. */

export interface PageSelection {
  id: string;
  content: string;
  pageId: string;
}

export interface MessageImageItem {
  id: string;
  url: string;
  alt?: string;
}

export interface MessageVideoItem {
  id: string;
  url: string;
}

export interface MessageFileItem {
  id: string;
  name: string;
  url?: string;
  size?: number;
  fileType?: string;
}
