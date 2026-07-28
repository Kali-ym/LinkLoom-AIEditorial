export interface GroundingCitation {
  favicon?: string;
  title?: string;
  url: string;
}

export interface GroundingImageResult {
  domain?: string;
  title?: string;
  imageUri?: string;
  sourceUri?: string;
}

export interface GroundingData {
  searchQueries?: string[];
  citations?: GroundingCitation[];
  imageSearchQueries?: string[];
  imageResults?: GroundingImageResult[];
}
