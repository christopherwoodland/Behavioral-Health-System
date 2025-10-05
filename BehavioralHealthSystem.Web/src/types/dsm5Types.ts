// DSM-5 related types for mental health condition data

export interface DSM5ConditionData {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  diagnosticCriteria: DSM5DiagnosticCriterion[];
  differentialDiagnosis: string[];
  prevalence: string;
  development: string;
  riskFactors: string[];
  pageNumbers: number[];
  isAvailableForAssessment: boolean;
  lastUpdated: string;
  extractionMetadata?: DSM5ExtractionMetadata;
  criteriaCount?: number; // Computed property for UI
}

export interface DSM5DiagnosticCriterion {
  criterionId: string;
  title: string;
  description: string;
  subCriteria: DSM5SubCriterion[];
  isRequired: boolean;
  minimumRequired?: number;
  durationRequirement?: string;
}

export interface DSM5SubCriterion {
  id: string;
  name: string;
  description: string;
  examples: string[];
  isRequired: boolean;
}

export interface DSM5ExtractionMetadata {
  extractedAt: string;
  sourcePdfUrl: string;
  pageRanges: string;
  confidenceScore: number;
  processingTimeMs: number;
  extractionVersion: string;
  notes: string[];
}

export interface DSM5ExtractionResult {
  success: boolean;
  errorMessage?: string;
  extractedConditions?: DSM5ConditionData[];
  pagesProcessed: number;
  processingTimeMs: number;
  uploadedToStorage: boolean;
  blobPath?: string;
}

export interface DSM5UploadResult {
  success: boolean;
  errorMessage?: string;
  uploadedCount: number;
  skippedCount: number;
  updatedCount: number;
  blobPaths: string[];
  processingTimeMs: number;
}

export interface DSM5DataStatus {
  isInitialized: boolean;
  totalConditions: number;
  availableConditions: number;
  categories: string[];
  lastUpdated?: string;
  dataVersion: string;
  containerExists: boolean;
  totalBlobSizeBytes: number;
  blobCount: number;
}

// Request types for API calls
export interface DSM5ExtractionRequest {
  pdfUrl: string;
  pageRanges?: string;
  autoUpload: boolean;
}

export interface DSM5DataUploadRequest {
  data: DSM5ConditionData[];
  overwriteExisting: boolean;
}

// API Response wrappers
export interface DSM5ConditionsApiResponse {
  success: boolean;
  message?: string;
  totalConditions: number;
  conditions: DSM5ConditionData[];
}

export interface DSM5ConditionDetailsApiResponse {
  success: boolean;
  message?: string;
  condition?: DSM5ConditionData;
}

export interface DSM5ExtractionApiResponse {
  success: boolean;
  message?: string;
  extractionResult?: {
    conditionsFound: number;
    conditions: Array<{
      name: string;
      code: string;
      criteriaCount: number;
      pageNumbers: number[];
    }>;
    totalPagesProcessed: number;
    processingTimeSeconds: number;
    uploadedToStorage: boolean;
    blobPath?: string;
  };
  error?: string;
}

export interface DSM5DataStatusApiResponse {
  success: boolean;
  message?: string;
  dataStatus?: {
    isInitialized: boolean;
    totalConditions: number;
    availableConditions: number;
    categories: string[];
    lastUpdated?: string;
    dataVersion: string;
    storageInfo: {
      containerExists: boolean;
      totalBlobSize: number;
      blobCount: number;
    };
  };
  error?: string;
}

// Extended assessment types with dynamic conditions
export interface MultiConditionAssessmentRequest {
  sessionId: string;
  selectedConditions: string[];
  assessmentOptions?: {
    includeStandardRisk?: boolean;
    maxProcessingTimeSeconds?: number;
    confidenceThreshold?: number;
  };
}

export interface MultiConditionAssessmentResult {
  success: boolean;
  sessionId: string;
  selectedConditions: string[];
  assessments: ConditionAssessmentResult[];
  overallRiskLevel: string;
  overallRiskScore: number;
  processingTimeMs: number;
  modelUsed: string;
  generatedAt: string;
  error?: string;
}

export interface ConditionAssessmentResult {
  conditionId: string;
  conditionName: string;
  conditionCode: string;
  overallLikelihood: string;
  confidenceScore: number;
  assessmentSummary: string;
  criteriaEvaluations: CriterionEvaluationResult[];
  riskFactorsIdentified: string[];
  recommendedActions: string[];
  clinicalNotes: string[];
  differentialDiagnosis: string[];
}

export interface CriterionEvaluationResult {
  criterionId: string;
  criterionTitle: string;
  isMet: boolean;
  confidence: number;
  evidence: string[];
  subCriteriaEvaluations: SubCriterionEvaluationResult[];
  notes: string;
}

export interface SubCriterionEvaluationResult {
  subCriterionId: string;
  subCriterionName: string;
  severity: number; // 0-4 scale
  isPresent: boolean;
  evidence: string;
  notes: string;
}

// UI State types
export interface DSM5ConditionSelectorState {
  selectedConditions: string[];
  availableConditions: DSM5ConditionData[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  selectedCategory: string;
  expandedCategories: Set<string>;
}

export interface ExtendedAssessmentConfig {
  selectedConditions: string[];
  maxConditions: number;
  includeStandardRisk: boolean;
  autoStartAssessment: boolean;
  showPreview: boolean;
}

// Validation types
export interface DSM5ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface DSM5ValidationResult {
  isValid: boolean;
  errors: DSM5ValidationError[];
  warnings: string[];
}