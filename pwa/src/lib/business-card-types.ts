export type BusinessCardStatus =
  | "processing"
  | "needs_review"
  | "confirmed"
  | "ocr_failed"
  | "archived";

export type BusinessCardProject = {
  projectId: string;
  projectName: string;
  projectKnowledgeId: string | null;
};

export type BusinessCard = {
  id: string;
  fullName: string;
  fullNameKana: string;
  companyName: string;
  department: string;
  jobTitle: string;
  email: string;
  phone: string;
  mobile: string;
  postalCode: string;
  address: string;
  website: string;
  relationshipNote: string;
  metOn: string;
  rawOcrText: string;
  fieldConfidence: Record<string, number>;
  ocrConfidence: number | null;
  ocrModel: string;
  ocrError: string;
  status: BusinessCardStatus;
  imageUrl: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  capturedAt: string;
  createdByEmail: string;
  confirmedAt: string | null;
  updatedAt: string;
  projects: BusinessCardProject[];
};

export type BusinessCardProjectOption = {
  projectId: string;
  projectName: string;
};

export type BusinessCardDraft = {
  fullName: string;
  fullNameKana: string;
  companyName: string;
  department: string;
  jobTitle: string;
  email: string;
  phone: string;
  mobile: string;
  postalCode: string;
  address: string;
  website: string;
  relationshipNote: string;
  metOn: string;
  projectIds: string[];
};
