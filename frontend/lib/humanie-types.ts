export type DomainType = 'FOOD' | 'WORK' | 'EDUCATION';

export type IntakeChannel =
  | 'WEBSITE'
  | 'COORDINATOR'
  | 'SMS'
  | 'WHATSAPP'
  | 'PARTNER_IMPORT'
  | 'API';

export type LifecycleStage =
  | 'NEED'
  | 'MATCH'
  | 'HUMAN_REVIEW'
  | 'DELIVERY'
  | 'RESULT_CHECK'
  | 'EVIDENCE'
  | 'INTEGRITY';

export type CaseStatus =
  | 'INTAKE_VALIDATED'
  | 'MATCHED_PENDING_REVIEW'
  | 'AWAITING_SECOND_APPROVAL'
  | 'APPROVED_FOR_DELIVERY'
  | 'DISPATCHED_OR_ENROLLED'
  | 'DISCREPANCY_INVESTIGATION'
  | 'RESULT_CHECK_PENDING'
  | 'VERIFIED_CLOSED'
  | 'APPEAL_OPEN';

export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'STANDARD';

export type UserRole =
  | 'Beneficiary'
  | 'Field worker'
  | 'NGO coordinator'
  | 'Employer'
  | 'Education partner'
  | 'Food distributor'
  | 'Approver'
  | 'Independent reviewer'
  | 'Auditor'
  | 'Governance administrator';

export type ResultCheckStatus =
  | 'Met'
  | 'Partly met'
  | 'Not met'
  | 'No response'
  | 'Pending verification';

export interface ConsentState {
  consentId: string;
  beneficiaryRef: string;
  serviceParticipation: boolean;
  dataSharing: boolean;
  followUpContact: boolean;
  minimalDataIntake: boolean;
  restrictedDataHandling: boolean;
  withdrawn: boolean;
  withdrawnAt?: string;
  accessibleExplanationLanguage: string;
  channelRecorded: IntakeChannel;
  updatedAt: string;
  history: {
    timestamp: string;
    action: string;
    actorRole: UserRole;
    channel: IntakeChannel;
    notes: string;
  }[];
}

export interface ConstraintsAndPreferences {
  wardOrLocation: string;
  maxCommuteKm?: number;
  transportAvailable: boolean;
  childcareRequired: boolean;
  dietaryRestrictions?: string[];
  cookingFuelAvailable?: boolean;
  accessibilityNeeds?: string[];
  preferredLanguage: string;
  householdSize?: number;
  skills?: string[];
  availableHoursPerWeek?: number;
  gradeOrSkillLevel?: string;
}

export interface MatchingRunnerUp {
  resourceId: string;
  resourceName: string;
  providerOrgId: string;
  score: number;
  whyLost: string;
  constraintGap: string;
}

export interface MatchingRecommendation {
  matchId: string;
  caseId: string;
  domain: DomainType;
  solverVersion: string;
  recommendedResourceId: string;
  recommendedResourceName: string;
  providerOrgId: string;
  providerOrgName: string;
  allocatedUnitsOrSeats: number;
  compatibilityScore: number;
  scoreExplanation: string;
  constraintAnalysis: {
    capacity: 'PASS' | 'CONSTRAINED';
    geography: 'PASS' | 'CONSTRAINED';
    eligibility: 'PASS' | 'REVIEW_NEEDED';
    transport: 'PASS' | 'SUPPORT_ADDED';
    accessibility: 'PASS' | 'ACCOMMODATED';
    dignity: 'PASS' | 'ADJUSTED';
    details: string[];
  };
  runnerUps: MatchingRunnerUp[];
  humanReviewRequired: boolean;
  highRiskTwoPersonApproval: boolean;
  timestamp: string;
}

export interface DecisionVaultRecord {
  decisionId: string;
  caseId: string;
  domain: DomainType;
  solverVersion: string;
  inputSnapshot: {
    beneficiaryRef: string;
    urgency: UrgencyLevel;
    wardOrLocation: string;
    constraints: ConstraintsAndPreferences;
  };
  constraintSnapshot: {
    totalAvailableCapacity: number;
    coverageFloorTarget: number;
    activeShockScenario: string;
  };
  originalRecommendation: MatchingRecommendation;
  alternatives: MatchingRunnerUp[];
  recommendationExplanation: string;
  primaryApproverName: string;
  primaryApproverRole: UserRole;
  secondApproverName?: string;
  secondApproverRole?: UserRole;
  conflictOfInterestDeclared: boolean;
  conflictDeclarationNote: string;
  decisionAction: 'APPROVED_AS_RECOMMENDED' | 'OVERRIDDEN_WITH_REASON' | 'ESCALATED_FOR_REVIEW' | 'PENDING_SECOND_APPROVER';
  selectedResourceId: string;
  selectedResourceName: string;
  approvedUnits: number;
  overrideReason?: string;
  approvalChannel: 'WEB_CONSOLE' | 'MOBILE_JUDGE_FAST_PATH';
  timestamp: string;
  linkedOutcomeId?: string;
  linkedOutcomeState?: ResultCheckStatus;
  previousHash: string;
  integrityHash: string;
}

export interface FollowUpOutcomeRecord {
  outcomeId: string;
  caseId: string;
  decisionId: string;
  domain: DomainType;
  scheduleLabel: 'Post-Delivery (Food)' | '7-Day Check (Work)' | '30-Day Check (Work)' | '30-Day Check (Education)';
  status: ResultCheckStatus;
  channel: 'SMS' | 'WhatsApp' | 'Website' | 'Field worker';
  dispatchedUnits?: number;
  receivedUnits?: number;
  stillEmployedAt7Days?: boolean;
  stillEmployedAt30Days?: boolean;
  stillAttendingAt30Days?: boolean;
  attendanceRatePct?: number;
  beneficiaryFeedback: string;
  verifiedByRole: UserRole;
  verifiedAt: string;
  discrepancyFlagged: boolean;
}

export interface CaseHistoryItem {
  id: string;
  timestamp: string;
  stage: LifecycleStage;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
  eventHash: string;
}

export interface CaseRecord {
  caseId: string;
  idempotencyKey: string;
  domain: DomainType;
  beneficiaryRef: string;
  beneficiaryAlias: string; // Minimised identifier
  intakeChannel: IntakeChannel;
  status: CaseStatus;
  lifecycleStage: LifecycleStage;
  priorityScore: number;
  urgency: UrgencyLevel;
  summaryNeed: string;
  constraints: ConstraintsAndPreferences;
  consent: ConsentState;
  assignedOrgId: string;
  assignedOrgName: string;
  assignedReviewer: string;
  createdAt: string;
  updatedAt: string;
  duplicateWarning?: string;
  escalationFlag: boolean;
  escalationReason?: string;
  pendingAction: string;
  currentMatch?: MatchingRecommendation;
  linkedDecisionIds: string[];
  linkedDeliveryOrServiceId?: string;
  linkedOutcomeIds: string[];
  linkedEvidenceHashes: string[];
  integrityStatus: 'VERIFIED' | 'FLAGGED_DISCREPANCY' | 'HASH_MISMATCH';
  history: CaseHistoryItem[];
}

export interface OrganisationProfile {
  orgId: string;
  name: string;
  type: 'NGO' | 'Municipal Authority' | 'Food Distributor' | 'Employer Partner' | 'Education Partner' | 'Audit Body';
  verifiedStatus: 'VERIFIED' | 'PROVISIONAL' | 'SUSPENDED_REVIEW';
  serviceAreaWards: string[];
  domains: DomainType[];
  capabilities: string[];
  resourceCapacityCurrent: number;
  resourceCapacityMax: number;
  operatingHours: string;
  contactPerson: string;
  escalationContact: string;
  dataSharingAgreementSigned: boolean;
  spotCheckScorePct: number;
  lastAuditDate: string;
}

export interface FoodBatchAndDelivery {
  batchId: string;
  caseId: string;
  commodity: string;
  ward: string;
  distributorOrgId: string;
  distributorName: string;
  stockAvailableUnits: number;
  allocatedUnits: number;
  dispatchedUnits: number;
  receivedUnits: number | null;
  transportMode: string;
  expiryDate: string;
  stockCondition: 'OPTIMAL' | 'NEAR_EXPIRY' | 'DAMAGED_PARTIAL';
  dispatchStatus: 'ALLOCATED' | 'DISPATCHED' | 'RECEIPT_CONFIRMED' | 'DISCREPANCY_OPEN';
  discrepancyUnits: number;
  discrepancyNote?: string;
  updatedAt: string;
}

export interface WorkJobAndPlacement {
  jobId: string;
  caseId?: string;
  employerOrgId: string;
  employerName: string;
  jobTitle: string;
  wardLocation: string;
  compensationLocal: string;
  compensationValue: number;
  workingHoursPerWeek: number;
  requiredSkills: string[];
  employmentType: 'Full-Time' | 'Part-Time' | 'Apprenticeship' | 'Flexible Shift';
  accessibilityAccommodations: string[];
  maxCommuteKm: number;
  childcareCompatible: boolean;
  contractWritten: boolean;
  workflowStage:
    | 'Candidate'
    | 'Matching'
    | 'Human Review'
    | 'Referral'
    | 'Employer Response'
    | 'Placement'
    | '7-Day Check'
    | '30-Day Check';
  candidateAlias?: string;
  referralStatus: 'OPEN_VACANCY' | 'REFERRED' | 'INTERVIEW_SCHEDULED' | 'PLACED' | 'HUMAN_REVIEWED_ALTERNATIVE';
  nonPlacementReason?: string;
  check7DayStatus: ResultCheckStatus;
  check30DayStatus: ResultCheckStatus;
}

export interface EducationProgrammeRecord {
  programmeId: string;
  caseId?: string;
  partnerOrgId: string;
  institutionName: string;
  programmeTitle: string;
  seatsTotal: number;
  seatsAvailable: number;
  feeStructure: 'Free Public Seat' | '100% Voucher Covered' | 'Stipend + Seat';
  voucherAmountValue: number;
  eligibilityCriteria: string;
  accessibilityFeatures: string[];
  wardLocation: string;
  instructionLanguage: string;
  transitPassIncluded: boolean;
  workflowStage:
    | 'Need'
    | 'Programme Matching'
    | 'Human Review'
    | 'Referral'
    | 'Enrolment'
    | 'Attendance'
    | '30-Day Result Check';
  studentAlias?: string;
  attendanceVerifiedPct?: number;
  check30DayStatus: ResultCheckStatus;
}

export interface WardLPData {
  wardId: string;
  wardName: string;
  populationInNeed: number;
  demandUnits: number;
  transportCostPerUnit: number;
  vulnerabilityIndex: number; // Used only for aggregated ward need, never protected personal exclusion
  recentReportingRate: number; // Low reporting + high vulnerability triggers Silent Exclusion alert
  proportionalAllocation: number;
  proportionalCoveragePct: number;
  equityLPAllocation: number;
  equityLPCoveragePct: number;
  bindingConstraint: string;
  silentExclusionAlert: boolean;
  slackUnitsToReach60Pct: number;
}

export interface EquityLPSolverResult {
  solverVersion: string;
  totalStockUnits: number;
  transportBudgetLimit: number;
  transportCostMultiplier: number;
  coverageFloorTargetPct: number;
  activeScenario: 'BASELINE_436_9' | 'FLOOD_SHOCK' | 'FLOOR_SWEEP_SLACK' | 'CUSTOM_LIVE';
  equityLPMinWardCoveragePct: number;
  proportionalMinWardCoveragePct: number;
  coverageGainPercentagePoints: number;
  totalDispatchedUnits: number;
  bottleneckXRay: {
    constraintName: string;
    shadowPriceDual: number;
    impactExplanation: string;
  }[];
  slackRecoveryNeededUnits: number;
  silentExclusionWards: string[];
  wards: WardLPData[];
}

export interface IntegritySignalFlag {
  flagId: string;
  category:
    | 'RECEIPT_DISCREPANCY'
    | 'OVERRIDE_PATTERN'
    | 'SILENT_EXCLUSION'
    | 'DUPLICATE_CLAIM_ATTEMPT'
    | 'PROVIDER_DELAY_ANOMALY'
    | 'HASH_CHAIN_TAMPER';
  severity: 'HIGH' | 'MEDIUM' | 'WATCH';
  caseId?: string;
  orgId?: string;
  ward?: string;
  title: string;
  description: string;
  evidenceMetric: string;
  status: 'OPEN_SIGNAL' | 'UNDER_INDEPENDENT_REVIEW' | 'RESOLVED_EXPLAINED' | 'ESCALATED_ENFORCEMENT';
  assignedIndependentReviewer: string;
  createdAt: string;
}

export interface WhistleblowerComplaint {
  complaintId: string;
  submissionType: 'ANONYMOUS' | 'IDENTIFIED_PROTECTED';
  category: 'BRIBE_DEMAND' | 'DIVERSION_LEAKAGE' | 'COERCION_OR_EXCLUSION' | 'RETALIATION_REPORT';
  targetOrgId: string;
  targetOrgName: string;
  relatedCaseId?: string;
  ward: string;
  description: string;
  evidenceAttachmentRef: string;
  encryptedIdentityVaultRef: string; // Stored separately from complaint payload
  accusedOrgBlockedFromAccess: boolean;
  retaliationRiskIndicator: 'ELEVATED_PROTECTION' | 'STANDARD_SHIELD';
  assignedIndependentReviewer: string;
  recusedReviewers: string[];
  status: 'RECEIVED_ENCRYPTED' | 'INDEPENDENT_INVESTIGATION' | 'FINDINGS_RECORDED' | 'ESCALATED_SANCTION';
  reviewNotes: string[];
  createdAt: string;
}

export interface AuditLedgerEntry {
  seq: number;
  eventId: string;
  timestamp: string;
  eventType:
    | 'CASE_INTAKE'
    | 'CONSENT_RECORDED'
    | 'SOLVER_MATCH'
    | 'HUMAN_DECISION'
    | 'DELIVERY_RECEIPT'
    | 'DISCREPANCY_ALERT'
    | 'RESULT_CHECK'
    | 'WHISTLEBLOWER_REPORT'
    | 'COUNTRY_PACK_CHANGE';
  actorRole: UserRole;
  entityId: string;
  summary: string;
  payloadSnapshot: string;
  previousHash: string;
  currentHash: string;
  tamperedSimulation?: boolean;
}

export interface CountryPackConfig {
  countryCode: 'IN-DIST' | 'KE-CNTY' | 'AT-MUNI' | 'CO-DEPT';
  name: string;
  languagePrimary: string;
  languagesSupported: string[];
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  localChannels: IntakeChannel[];
  eligibilityRuleSummary: string;
  dataRetentionDays: number;
  legalFramework: string;
  unitLabelFood: string;
  fixedRedLines: {
    humanDecisionAuthority: true;
    noAutomatedDenial: true;
    appealabilityGuaranteed: true;
    explainabilityRequired: true;
    independentOversight: true;
  };
}
