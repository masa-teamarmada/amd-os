/**
 * ホーム下段「会社の記録」(メンバー / 沿革 / メディア掲載 / 写真) の表示用の型。
 *
 * サーバ層 (`src/lib/company-content.ts`) と表示側 (`CompanyContentShelf`) の両方から
 * 参照するため、client component ではなくここへ置く。
 */

export interface CompanyImageCrop {
  x: number;
  y: number;
  zoom: number;
}

export interface CompanyMemberPreview {
  memberProfileId: string | null;
  memberId: string | null;
  codeName: string;
  displayName: string;
  fullName: string | null;
  role: string | null;
  status: string;
  projectCount: number;
  joinedOn: string | null;
  effort: number | null;
  bio: string | null;
  joinContext: string | null;
  originLabel: string | null;
  residenceLabel: string | null;
  offTimeNote: string | null;
  favoriteFood: string | null;
  bucketList: string | null;
  mbtiTags: string[];
  imageUrl: string | null;
  photoAssetId: string | null;
  photoCrop: CompanyImageCrop;
  lastLoginAt: string | null;
}

export interface CompanyPhotoAssetPreview {
  assetId: string;
  title: string;
  imageUrl: string | null;
  kind: string;
  capturedAt: string | null;
  isCover: boolean;
  coverPosition?: string;
  crop: CompanyImageCrop;
}

export interface CompanyHistoryPreview {
  id: string;
  projectId: string | null;
  occurredOn: string | null;
  title: string;
  kind: string | null;
}

export interface CompanyPhotoPreview {
  id: string;
  title: string;
  meta: string;
  status: "unknown" | "internal_ok" | "public_ok";
  imageUrl: string | null;
  kind: string;
  itemCount?: number;
  occurredOn?: string | null;
  coverAssetId?: string | null;
  coverPosition?: string;
  crop?: CompanyImageCrop;
  assets?: CompanyPhotoAssetPreview[];
}

export interface CompanyMediaMentionPreview {
  id: string;
  projectId: string;
  projectName: string;
  occurredOn: string;
  title: string;
  mediaName: string;
  kind: string;
  sourceUrl: string | null;
}

export interface CompanyContentPreview {
  members: CompanyMemberPreview[];
  history: CompanyHistoryPreview[];
  photos: CompanyPhotoPreview[];
  mediaMentions: CompanyMediaMentionPreview[];
}
