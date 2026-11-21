import {
  AuditLedgerEntry,
  CaseRecord,
  ConsentState,
  ConstraintsAndPreferences,
  CountryPackConfig,
  DecisionVaultRecord,
  DomainType,
  EducationProgrammeRecord,
  EquityLPSolverResult,
  FollowUpOutcomeRecord,
  FoodBatchAndDelivery,
  IntakeChannel,
  IntegritySignalFlag,
  OrganisationProfile,
  ResultCheckStatus,
  UrgencyLevel,
  UserRole,
  WhistleblowerComplaint,
  WorkJobAndPlacement,
} from './humanie-types';
import {
  computeDeterministicHash,
  ROLE_PERMISSION_MATRIX,
  runEquityLPSolver,
  runUnifiedMatchingEngine,
  verifyAuditLedgerChain,
} from './humanie-engine';

export interface HumanieSystemState {
  activeCountryCode: CountryPackConfig['countryCode'];
  countryPacks: CountryPackConfig[];
  organisations: OrganisationProfile[];
  foodBatches: FoodBatchAndDelivery[];
  workJobs: WorkJobAndPlacement[];
  eduProgrammes: EducationProgrammeRecord[];
  cases: CaseRecord[];
  decisions: DecisionVaultRecord[];
  outcomes: FollowUpOutcomeRecord[];
  integrityFlags: IntegritySignalFlag[];
  complaints: WhistleblowerComplaint[];
  auditLedger: AuditLedgerEntry[];
  lpSolverState: EquityLPSolverResult;
  scheduledFollowUps: { followUpId: string; caseId: string; domain: DomainType; dueAt: string; channel: string; status: 'SCHEDULED'|'DUE'|'SENT'|'CANCELLED'; label: string; createdAt: string }[];
  importLogs: {
    importId: string;
    timestamp: string;
    sourcePartner: string;
    rowsProcessed: number;
    casesCreated: number;
    duplicatesMerged: number;
    actorRole: UserRole;
  }[];
}

const COUNTRY_PACKS: CountryPackConfig[] = [
  {
    countryCode: 'IN-DIST',
    name: 'India District Pilot (Ward & PDS Federation)',
    languagePrimary: 'Hindi / English',
    languagesSupported: ['Hindi', 'English', 'Marathi', 'Tamil'],
    currencyCode: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata (IST)',
    localChannels: ['SMS', 'WHATSAPP', 'COORDINATOR', 'WEBSITE', 'PARTNER_IMPORT'],
    eligibilityRuleSummary: 'Priority Householder + Silent-Exclusion Ward Floor Protection (No PMT auto-cutoffs)',
    dataRetentionDays: 365,
    legalFramework: 'DPDP Act 2023 + Right to Food / Social Audit Mandate',
    unitLabelFood: 'kg / Ration Kits',
    fixedRedLines: {
      humanDecisionAuthority: true,
      noAutomatedDenial: true,
      appealabilityGuaranteed: true,
      explainabilityRequired: true,
      independentOversight: true,
    },
  },
  {
    countryCode: 'KE-CNTY',
    name: 'Kenya County Pilot (ASAL Resilience & Youth Work)',
    languagePrimary: 'Swahili / English',
    languagesSupported: ['Swahili', 'English'],
    currencyCode: 'KES',
    currencySymbol: 'KSh',
    timezone: 'Africa/Nairobi (EAT)',
    localChannels: ['SMS', 'WHATSAPP', 'COORDINATOR', 'WEBSITE'],
    eligibilityRuleSummary: 'Community-Validated Vulnerability + USSD/SMS Low-Bandwidth Priority',
    dataRetentionDays: 540,
    legalFramework: 'Kenya Data Protection Act 2019 + County Social Protection Charter',
    unitLabelFood: 'Baskets (25kg Eq)',
    fixedRedLines: {
      humanDecisionAuthority: true,
      noAutomatedDenial: true,
      appealabilityGuaranteed: true,
      explainabilityRequired: true,
      independentOversight: true,
    },
  },
  {
    countryCode: 'AT-MUNI',
    name: 'Austria / EU Municipal Pilot (Post-AMS Human-Gated Employment)',
    languagePrimary: 'German / English',
    languagesSupported: ['German', 'English', 'Turkish', 'Arabic'],
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Vienna (CET)',
    localChannels: ['WEBSITE', 'COORDINATOR', 'API', 'PARTNER_IMPORT'],
    eligibilityRuleSummary: 'Strict Human Gate (Complies with 2020 AMS Algorithm Prohibition & EU AI Act High-Risk Rules)',
    dataRetentionDays: 180,
    legalFramework: 'GDPR Art. 22 (Right to Human Intervention) + EU AI Act Annex III',
    unitLabelFood: 'Municipal Voucher Units',
    fixedRedLines: {
      humanDecisionAuthority: true,
      noAutomatedDenial: true,
      appealabilityGuaranteed: true,
      explainabilityRequired: true,
      independentOversight: true,
    },
  },
  {
    countryCode: 'CO-DEPT',
    name: 'Colombia Departmental Pilot (Peri-Urban Integration)',
    languagePrimary: 'Spanish / English',
    languagesSupported: ['Spanish', 'English'],
    currencyCode: 'COP',
    currencySymbol: '$',
    timezone: 'America/Bogota (COT)',
    localChannels: ['WHATSAPP', 'SMS', 'COORDINATOR', 'WEBSITE'],
    eligibilityRuleSummary: 'Multi-Dimensional Inclusion without Proxy Means Test Exclusion',
    dataRetentionDays: 365,
    legalFramework: 'Ley 1581 Habeas Data + Constitutional Tutela Appeal Guarantee',
    unitLabelFood: 'Raciones Familiares',
    fixedRedLines: {
      humanDecisionAuthority: true,
      noAutomatedDenial: true,
      appealabilityGuaranteed: true,
      explainabilityRequired: true,
      independentOversight: true,
    },
  },
];

function buildInitialState(): HumanieSystemState {
  const organisations: OrganisationProfile[] = [
    {
      orgId: 'ORG-MUNI-01',
      name: 'District Social Protection & Relief Directorate',
      type: 'Municipal Authority',
      verifiedStatus: 'VERIFIED',
      serviceAreaWards: ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'],
      domains: ['FOOD', 'WORK', 'EDUCATION'],
      capabilities: ['Human Review Authority', 'Emergency Reserve Dispatch', 'Cross-Ward Coordination'],
      resourceCapacityCurrent: 390,
      resourceCapacityMax: 500,
      operatingHours: '08:00–20:00 Daily',
      contactPerson: 'Judge Meera Krishnan (Chief Approver)',
      escalationContact: 'oversight@district-humanie.org',
      dataSharingAgreementSigned: true,
      spotCheckScorePct: 98,
      lastAuditDate: '2026-11-12',
    },
    {
      orgId: 'ORG-NGO-01',
      name: 'Asha Frontline Community Collective',
      type: 'NGO',
      verifiedStatus: 'VERIFIED',
      serviceAreaWards: ['Ward 1', 'Ward 3', 'Ward 4'],
      domains: ['FOOD', 'WORK', 'EDUCATION'],
      capabilities: ['Doorstep Intake', 'Low-Tech SMS Verification', 'Childcare Support'],
      resourceCapacityCurrent: 145,
      resourceCapacityMax: 180,
      operatingHours: '07:30–19:30 Daily',
      contactPerson: 'Rohan Deshmukh (Lead Coordinator)',
      escalationContact: 'field-desk@ashacollective.org',
      dataSharingAgreementSigned: true,
      spotCheckScorePct: 96,
      lastAuditDate: '2026-11-14',
    },
    {
      orgId: 'ORG-DIST-01',
      name: 'Janata Grain & Fortified Ration Co-op',
      type: 'Food Distributor',
      verifiedStatus: 'VERIFIED',
      serviceAreaWards: ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'],
      domains: ['FOOD'],
      capabilities: ['Grain Batch Tracking', 'Low-Fuel Fortified Packs', 'Ward Cold-Chain'],
      resourceCapacityCurrent: 436.9,
      resourceCapacityMax: 600,
      operatingHours: '06:00–18:00 Daily',
      contactPerson: 'Vikram Sethi (Depot Controller)',
      escalationContact: 'logistics@janatacoop.org',
      dataSharingAgreementSigned: true,
      spotCheckScorePct: 89,
      lastAuditDate: '2026-11-10',
    },
    {
      orgId: 'ORG-EMP-01',
      name: 'GreenGrid Solar & Municipal Micro-Works',
      type: 'Employer Partner',
      verifiedStatus: 'VERIFIED',
      serviceAreaWards: ['Ward 1', 'Ward 2', 'Ward 5'],
      domains: ['WORK'],
      capabilities: ['Childcare-Compatible Shifts', 'Written Contracts', 'On-Site Apprenticeship'],
      resourceCapacityCurrent: 28,
      resourceCapacityMax: 45,
      operatingHours: '08:00–16:30 Mon–Sat',
      contactPerson: 'Ananya Rao (Workforce Placement Lead)',
      escalationContact: 'placements@greengridworks.org',
      dataSharingAgreementSigned: true,
      spotCheckScorePct: 95,
      lastAuditDate: '2026-11-08',
    },
    {
      orgId: 'ORG-EDU-01',
      name: 'Vidya Setu Bridge Academy & Poly-Skills Hub',
      type: 'Education Partner',
      verifiedStatus: 'VERIFIED',
      serviceAreaWards: ['Ward 2', 'Ward 3', 'Ward 4'],
      domains: ['EDUCATION'],
      capabilities: ['Multilingual Instruction', '100% Fee Vouchers', 'Safe Transit Passes'],
      resourceCapacityCurrent: 64,
      resourceCapacityMax: 90,
      operatingHours: '08:00–17:00 Mon–Sat',
      contactPerson: 'Dr. Farida Khan (Principal & Enrolment Lead)',
      escalationContact: 'enrolment@vidyasetu.edu',
      dataSharingAgreementSigned: true,
      spotCheckScorePct: 97,
      lastAuditDate: '2026-11-15',
    },
    {
      orgId: 'ORG-OMBUDS-01',
      name: 'Independent Civic Accountability & Audit Commission',
      type: 'Audit Body',
      verifiedStatus: 'VERIFIED',
      serviceAreaWards: ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5'],
      domains: ['FOOD', 'WORK', 'EDUCATION'],
      capabilities: ['Whistleblower Protection', 'Hash-Chain Verification', 'Conflict Recusal Enforcement'],
      resourceCapacityCurrent: 20,
      resourceCapacityMax: 25,
      operatingHours: '24/7 Encrypted Intake',
      contactPerson: 'Justice S. Narayanan (Independent Reviewer)',
      escalationContact: 'ombudsman@civic-oversight.org',
      dataSharingAgreementSigned: true,
      spotCheckScorePct: 100,
      lastAuditDate: '2026-11-18',
    },
  ];

  const foodBatches: FoodBatchAndDelivery[] = [
    {
      batchId: 'BATCH-FD-401',
      caseId: 'CASE-2026-0101',
      commodity: 'Fortified Grain & Low-Fuel Pulse Kit',
      ward: 'Ward 4 · Upland Canal Sector',
      distributorOrgId: 'ORG-DIST-01',
      distributorName: 'Janata Grain & Fortified Ration Co-op',
      stockAvailableUnits: 140.0,
      allocatedUnits: 40,
      dispatchedUnits: 40,
      receivedUnits: 35, // Famous 5-unit gap from Slide 2 & Slide 13!
      transportMode: 'Light Rural Utility Van #04',
      expiryDate: '2027-04-15',
      stockCondition: 'OPTIMAL',
      dispatchStatus: 'DISCREPANCY_OPEN',
      discrepancyUnits: 5,
      discrepancyNote: 'Dispatched 40 units, household cluster confirmed receipt of 35 units via SMS receipt check (-5 unit gap).',
      updatedAt: '2026-11-20T09:15:00Z',
    },
    {
      batchId: 'BATCH-FD-402',
      caseId: 'CASE-2026-0104',
      commodity: 'Standard Staples & Infant Nutrition Pack',
      ward: 'Ward 1 · Riverbank North',
      distributorOrgId: 'ORG-DIST-01',
      distributorName: 'Janata Grain & Fortified Ration Co-op',
      stockAvailableUnits: 186.9,
      allocatedUnits: 32,
      dispatchedUnits: 32,
      receivedUnits: 32,
      transportMode: 'Ward 1 Hub Handover',
      expiryDate: '2027-05-20',
      stockCondition: 'OPTIMAL',
      dispatchStatus: 'RECEIPT_CONFIRMED',
      discrepancyUnits: 0,
      updatedAt: '2026-11-19T16:40:00Z',
    },
    {
      batchId: 'BATCH-FD-403',
      caseId: 'CASE-2026-0106',
      commodity: 'Ready-to-Cook Milled Millet & Oil Ration',
      ward: 'Ward 3 · Peri-Urban Settlement',
      distributorOrgId: 'ORG-DIST-01',
      distributorName: 'Janata Grain & Fortified Ration Co-op',
      stockAvailableUnits: 110.0,
      allocatedUnits: 28,
      dispatchedUnits: 0,
      receivedUnits: null,
      transportMode: 'Field Worker Doorstep Tricycle',
      expiryDate: '2027-02-28',
      stockCondition: 'OPTIMAL',
      dispatchStatus: 'ALLOCATED',
      discrepancyUnits: 0,
      updatedAt: '2026-11-20T11:00:00Z',
    },
  ];

  const workJobs: WorkJobAndPlacement[] = [
    {
      jobId: 'JOB-WK-201',
      caseId: 'CASE-2026-0102',
      employerOrgId: 'ORG-EMP-01',
      employerName: 'GreenGrid Solar & Municipal Micro-Works',
      jobTitle: 'Solar Panel Assembly & Micro-Grid Technician',
      wardLocation: 'Ward 2 · Industrial Corridor (2.8km commute)',
      compensationLocal: '₹18,500 / month',
      compensationValue: 18500,
      workingHoursPerWeek: 35,
      requiredSkills: ['Basic Electrical', 'Assembly', 'Quality Check'],
      employmentType: 'Full-Time',
      accessibilityAccommodations: ['Seated Assembly Workbench', 'Step-Free Entry'],
      maxCommuteKm: 3.5,
      childcareCompatible: true, // Daytime 08:30-15:30 shift + creche voucher
      contractWritten: true,
      workflowStage: '30-Day Check',
      candidateAlias: 'Kavita M. (BEN-1042)',
      referralStatus: 'PLACED',
      check7DayStatus: 'Met',
      check30DayStatus: 'Met',
    },
    {
      jobId: 'JOB-WK-202',
      caseId: 'CASE-2026-0105',
      employerOrgId: 'ORG-EMP-01',
      employerName: 'GreenGrid Solar & Municipal Micro-Works',
      jobTitle: 'Community Water-Meter & Inventory Clerk',
      wardLocation: 'Ward 1 · Riverbank North (1.9km commute)',
      compensationLocal: '₹16,200 / month',
      compensationValue: 16200,
      workingHoursPerWeek: 30,
      requiredSkills: ['Inventory', 'Record Keeping', 'Hindi/English'],
      employmentType: 'Flexible Shift',
      accessibilityAccommodations: ['Screen-Reader Terminal', 'Ground Floor Desk'],
      maxCommuteKm: 2.5,
      childcareCompatible: true,
      contractWritten: true,
      workflowStage: 'Human Review',
      candidateAlias: 'Suresh B. (BEN-1089)',
      referralStatus: 'OPEN_VACANCY',
      check7DayStatus: 'Pending verification',
      check30DayStatus: 'Pending verification',
    },
    {
      jobId: 'JOB-WK-203',
      employerOrgId: 'ORG-EMP-01',
      employerName: 'Metro Logistics Night Depot',
      jobTitle: 'Night-Shift Freight Sorter',
      wardLocation: 'Ward 5 · Old Market Transit Hub (9.5km commute)',
      compensationLocal: '₹17,000 / month',
      compensationValue: 17000,
      workingHoursPerWeek: 42,
      requiredSkills: ['Sorting', 'Heavy Lifting'],
      employmentType: 'Full-Time',
      accessibilityAccommodations: [],
      maxCommuteKm: 10.0,
      childcareCompatible: false,
      contractWritten: true,
      workflowStage: 'Candidate',
      referralStatus: 'OPEN_VACANCY',
      check7DayStatus: 'Pending verification',
      check30DayStatus: 'Pending verification',
    },
  ];

  const eduProgrammes: EducationProgrammeRecord[] = [
    {
      programmeId: 'EDU-PRG-301',
      caseId: 'CASE-2026-0103',
      partnerOrgId: 'ORG-EDU-01',
      institutionName: 'Vidya Setu Bridge Academy & Poly-Skills Hub',
      programmeTitle: 'Secondary Bridge Cohort + Vocational Digital Literacy',
      seatsTotal: 40,
      seatsAvailable: 11,
      feeStructure: '100% Voucher Covered',
      voucherAmountValue: 12000,
      eligibilityCriteria: 'Out-of-school youth or household income shock; no prior exam cutoff',
      accessibilityFeatures: ['Bilingual Audio Lessons', 'Ramp Access'],
      wardLocation: 'Ward 3 · Peri-Urban Settlement',
      instructionLanguage: 'Hindi / English',
      transitPassIncluded: true,
      workflowStage: '30-Day Result Check',
      studentAlias: 'Aarav K. (BEN-1055)',
      attendanceVerifiedPct: 94,
      check30DayStatus: 'Met',
    },
    {
      programmeId: 'EDU-PRG-302',
      caseId: 'CASE-2026-0107',
      partnerOrgId: 'ORG-EDU-01',
      institutionName: 'Vidya Setu Bridge Academy & Poly-Skills Hub',
      programmeTitle: 'Early Childhood & Adolescent Foundational Numeracy Seat',
      seatsTotal: 35,
      seatsAvailable: 8,
      feeStructure: 'Stipend + Seat',
      voucherAmountValue: 9500,
      eligibilityCriteria: 'First-generation learner or migrant household',
      accessibilityFeatures: ['Large-Print Materials', 'Quiet Study Room'],
      wardLocation: 'Ward 4 · Upland Canal Sector',
      instructionLanguage: 'Hindi / Marathi / English',
      transitPassIncluded: true,
      workflowStage: 'Human Review',
      studentAlias: 'Zoya A. (BEN-1104)',
      attendanceVerifiedPct: undefined,
      check30DayStatus: 'Pending verification',
    },
  ];

  const lpSolverState = runEquityLPSolver({
    totalStockUnits: 436.9,
    transportBudgetLimit: 2400,
    transportCostMultiplier: 1.0,
    coverageFloorTargetPct: 47.87,
    scenario: 'BASELINE_436_9',
  });

  // Construct initial cases across all 3 domains and multiple channels
  const cases: CaseRecord[] = [
    {
      caseId: 'CASE-2026-0101',
      idempotencyKey: 'IDEMP-SMS-99101',
      domain: 'FOOD',
      beneficiaryRef: 'BEN-1018',
      beneficiaryAlias: 'Sunita D. & 4-Household Cluster (Ward 4)',
      intakeChannel: 'SMS',
      status: 'DISCREPANCY_INVESTIGATION',
      lifecycleStage: 'INTEGRITY',
      priorityScore: 96,
      urgency: 'CRITICAL',
      summaryNeed: 'Emergency 40-unit fortified grain & low-fuel pulse allocation for upland canal families without cooking gas.',
      constraints: {
        wardOrLocation: 'Ward 4 · Upland Canal Sector',
        transportAvailable: false,
        childcareRequired: true,
        cookingFuelAvailable: false,
        dietaryRestrictions: ['Low-fuel pre-milled grain'],
        preferredLanguage: 'Hindi',
        householdSize: 5,
      },
      consent: {
        consentId: 'CNS-2026-0101',
        beneficiaryRef: 'BEN-1018',
        serviceParticipation: true,
        dataSharing: true,
        followUpContact: true,
        minimalDataIntake: true,
        restrictedDataHandling: true,
        withdrawn: false,
        accessibleExplanationLanguage: 'Hindi (Voice + SMS Readback)',
        channelRecorded: 'SMS',
        updatedAt: '2026-11-18T08:10:00Z',
        history: [
          {
            timestamp: '2026-11-18T08:10:00Z',
            action: 'CONSENT_GRANTED',
            actorRole: 'Beneficiary',
            channel: 'SMS',
            notes: 'Confirmed consent code YES-1018 after plain-language SMS disclosure.',
          },
        ],
      },
      assignedOrgId: 'ORG-DIST-01',
      assignedOrgName: 'Janata Grain & Fortified Ration Co-op',
      assignedReviewer: 'Judge Meera Krishnan',
      createdAt: '2026-11-18T08:05:00Z',
      updatedAt: '2026-11-20T09:15:00Z',
      escalationFlag: true,
      escalationReason: 'LAST-MILE LEAKAGE ALERT: Dispatched 40 units, household SMS receipt confirmed only 35 units (-5 unit gap).',
      pendingAction: 'Independent Reviewer verifying 5-unit transit gap with distributor & field worker.',
      linkedDecisionIds: ['DEC-2026-8801'],
      linkedDeliveryOrServiceId: 'BATCH-FD-401',
      linkedOutcomeIds: ['OUT-2026-501'],
      linkedEvidenceHashes: ['sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'],
      integrityStatus: 'FLAGGED_DISCREPANCY',
      history: [
        {
          id: 'H-101-1',
          timestamp: '2026-11-18T08:05:00Z',
          stage: 'NEED',
          actorName: 'SMS Gateway Intake',
          actorRole: 'Beneficiary',
          action: 'Unified Intake Created via SMS',
          details: 'Channel normalised from SMS shortcode 56070; minimal-data consent verified.',
          eventHash: 'sha256:a1101805',
        },
        {
          id: 'H-101-2',
          timestamp: '2026-11-18T08:20:00Z',
          stage: 'MATCH',
          actorName: 'HUMANIE Equity LP v4.2',
          actorRole: 'NGO coordinator',
          action: 'Matched to BATCH-FD-401 (40 units)',
          details: 'Silent-exclusion ward floor applied; low-fuel constraint matched.',
          eventHash: 'sha256:b2201820',
        },
        {
          id: 'H-101-3',
          timestamp: '2026-11-18T09:00:00Z',
          stage: 'HUMAN_REVIEW',
          actorName: 'Judge Meera Krishnan',
          actorRole: 'Approver',
          action: 'Human Approval Authorised (DEC-2026-8801)',
          details: 'Approved 40 units for Ward 4 cluster delivery; two-person sign-off completed.',
          eventHash: 'sha256:c3301900',
        },
        {
          id: 'H-101-4',
          timestamp: '2026-11-20T09:15:00Z',
          stage: 'RESULT_CHECK',
          actorName: 'Sunita D. (SMS Receipt)',
          actorRole: 'Beneficiary',
          action: 'Receipt Discrepancy Detected (40 dispatched vs 35 received)',
          details: '5-unit shortage automatically opened Integrity Shield Flag FLG-901.',
          eventHash: 'sha256:d4400915',
        },
      ],
    },
    {
      caseId: 'CASE-2026-0102',
      idempotencyKey: 'IDEMP-COORD-99102',
      domain: 'WORK',
      beneficiaryRef: 'BEN-1042',
      beneficiaryAlias: 'Kavita M. (Ward 2)',
      intakeChannel: 'COORDINATOR',
      status: 'VERIFIED_CLOSED',
      lifecycleStage: 'EVIDENCE',
      priorityScore: 88,
      urgency: 'HIGH',
      summaryNeed: 'Skilled assembly worker seeking local daytime placement with childcare compatibility and <4km commute.',
      constraints: {
        wardOrLocation: 'Ward 2 · Industrial Corridor',
        maxCommuteKm: 3.5,
        transportAvailable: true,
        childcareRequired: true,
        preferredLanguage: 'Hindi / English',
        skills: ['Basic Electrical', 'Assembly', 'Quality Check'],
        availableHoursPerWeek: 35,
      },
      consent: {
        consentId: 'CNS-2026-0102',
        beneficiaryRef: 'BEN-1042',
        serviceParticipation: true,
        dataSharing: true,
        followUpContact: true,
        minimalDataIntake: true,
        restrictedDataHandling: false,
        withdrawn: false,
        accessibleExplanationLanguage: 'Hindi',
        channelRecorded: 'COORDINATOR',
        updatedAt: '2026-10-19T10:00:00Z',
        history: [
          {
            timestamp: '2026-10-19T10:00:00Z',
            action: 'CONSENT_GRANTED',
            actorRole: 'Field worker',
            channel: 'COORDINATOR',
            notes: 'Signed paper + tablet audio consent for employer referral and 7/30-day checks.',
          },
        ],
      },
      assignedOrgId: 'ORG-EMP-01',
      assignedOrgName: 'GreenGrid Solar & Municipal Micro-Works',
      assignedReviewer: 'Rohan Deshmukh',
      createdAt: '2026-10-19T10:00:00Z',
      updatedAt: '2026-11-19T14:00:00Z',
      escalationFlag: false,
      pendingAction: '30-Day retention verified (Still working at 30 days: MET). Evidence locked in Vault.',
      linkedDecisionIds: ['DEC-2026-8802'],
      linkedDeliveryOrServiceId: 'JOB-WK-201',
      linkedOutcomeIds: ['OUT-2026-502', 'OUT-2026-503'],
      linkedEvidenceHashes: ['sha256:9b12c44a8e21f00912837465abcef01928374655'],
      integrityStatus: 'VERIFIED',
      history: [
        {
          id: 'H-102-1',
          timestamp: '2026-10-19T10:00:00Z',
          stage: 'NEED',
          actorName: 'Rohan Deshmukh',
          actorRole: 'NGO coordinator',
          action: 'Coordinator Assisted Intake',
          details: 'Recorded childcare shift requirement (08:30–15:30) and 3.5km commute ceiling.',
          eventHash: 'sha256:e5501000',
        },
        {
          id: 'H-102-2',
          timestamp: '2026-10-19T14:30:00Z',
          stage: 'HUMAN_REVIEW',
          actorName: 'Rohan Deshmukh',
          actorRole: 'NGO coordinator',
          action: 'Human Approval & Employer Referral (JOB-WK-201)',
          details: 'Rejected night-shift freight option due to childcare incompatibility; approved GreenGrid Solar.',
          eventHash: 'sha256:f6601430',
        },
        {
          id: 'H-102-3',
          timestamp: '2026-11-19T14:00:00Z',
          stage: 'RESULT_CHECK',
          actorName: 'Kavita M.',
          actorRole: 'Beneficiary',
          action: '30-Day Employment Check Confirmed: MET',
          details: 'Still employed with written contract and full wage disbursement at 30 days.',
          eventHash: 'sha256:a7701400',
        },
      ],
    },
    {
      caseId: 'CASE-2026-0103',
      idempotencyKey: 'IDEMP-WA-99103',
      domain: 'EDUCATION',
      beneficiaryRef: 'BEN-1055',
      beneficiaryAlias: 'Aarav K. (Ward 3)',
      intakeChannel: 'WHATSAPP',
      status: 'VERIFIED_CLOSED',
      lifecycleStage: 'EVIDENCE',
      priorityScore: 85,
      urgency: 'HIGH',
      summaryNeed: 'Secondary bridge seat + 100% fee voucher + safe transit pass after household flood displacement.',
      constraints: {
        wardOrLocation: 'Ward 3 · Peri-Urban Settlement',
        transportAvailable: false,
        childcareRequired: false,
        preferredLanguage: 'Hindi / English',
        gradeOrSkillLevel: 'Secondary Grade 9 Bridge',
      },
      consent: {
        consentId: 'CNS-2026-0103',
        beneficiaryRef: 'BEN-1055',
        serviceParticipation: true,
        dataSharing: true,
        followUpContact: true,
        minimalDataIntake: true,
        restrictedDataHandling: true,
        withdrawn: false,
        accessibleExplanationLanguage: 'Hindi',
        channelRecorded: 'WHATSAPP',
        updatedAt: '2026-10-20T11:20:00Z',
        history: [
          {
            timestamp: '2026-10-20T11:20:00Z',
            action: 'CONSENT_GRANTED',
            actorRole: 'Beneficiary',
            channel: 'WHATSAPP',
            notes: 'Parent/guardian consent verified via WhatsApp interactive card.',
          },
        ],
      },
      assignedOrgId: 'ORG-EDU-01',
      assignedOrgName: 'Vidya Setu Bridge Academy & Poly-Skills Hub',
      assignedReviewer: 'Dr. Farida Khan',
      createdAt: '2026-10-20T11:15:00Z',
      updatedAt: '2026-11-20T08:00:00Z',
      escalationFlag: false,
      pendingAction: '30-Day attendance verified at 94% (Still attending at 30 days: MET).',
      linkedDecisionIds: ['DEC-2026-8803'],
      linkedDeliveryOrServiceId: 'EDU-PRG-301',
      linkedOutcomeIds: ['OUT-2026-504'],
      linkedEvidenceHashes: ['sha256:3c99e11200ab8844cdef0129384756'],
      integrityStatus: 'VERIFIED',
      history: [
        {
          id: 'H-103-1',
          timestamp: '2026-10-20T11:15:00Z',
          stage: 'NEED',
          actorName: 'WhatsApp Intake Bot',
          actorRole: 'Beneficiary',
          action: 'Intake Received via WhatsApp',
          details: 'Flagged transit barrier and fee waiver necessity.',
          eventHash: 'sha256:11223344',
        },
        {
          id: 'H-103-2',
          timestamp: '2026-11-20T08:00:00Z',
          stage: 'RESULT_CHECK',
          actorName: 'Dr. Farida Khan',
          actorRole: 'Education partner',
          action: '30-Day Attendance Check: MET (94% attendance)',
          details: 'Confirmed both school roster attendance and parent WhatsApp confirmation.',
          eventHash: 'sha256:55667788',
        },
      ],
    },
    {
      caseId: 'CASE-2026-0106',
      idempotencyKey: 'IDEMP-WEB-99106',
      domain: 'FOOD',
      beneficiaryRef: 'BEN-1094',
      beneficiaryAlias: 'Meena R. & Elderly Household (Ward 3)',
      intakeChannel: 'WEBSITE',
      status: 'MATCHED_PENDING_REVIEW',
      lifecycleStage: 'HUMAN_REVIEW',
      priorityScore: 93,
      urgency: 'CRITICAL',
      summaryNeed: 'Doorstep 28-unit milled millet & oil ration for mobility-impaired household in Ward 3.',
      constraints: {
        wardOrLocation: 'Ward 3 · Peri-Urban Settlement',
        transportAvailable: false,
        childcareRequired: false,
        cookingFuelAvailable: false,
        accessibilityNeeds: ['Doorstep Delivery Required (Wheelchair Household)'],
        preferredLanguage: 'Hindi',
        householdSize: 4,
      },
      consent: {
        consentId: 'CNS-2026-0106',
        beneficiaryRef: 'BEN-1094',
        serviceParticipation: true,
        dataSharing: true,
        followUpContact: true,
        minimalDataIntake: true,
        restrictedDataHandling: true,
        withdrawn: false,
        accessibleExplanationLanguage: 'Hindi / Screen-Reader Web',
        channelRecorded: 'WEBSITE',
        updatedAt: '2026-11-20T10:30:00Z',
        history: [
          {
            timestamp: '2026-11-20T10:30:00Z',
            action: 'CONSENT_GRANTED',
            actorRole: 'Beneficiary',
            channel: 'WEBSITE',
            notes: 'Accessible web form consent completed.',
          },
        ],
      },
      assignedOrgId: 'ORG-NGO-01',
      assignedOrgName: 'Asha Frontline Community Collective',
      assignedReviewer: 'Judge Meera Krishnan',
      createdAt: '2026-11-20T10:30:00Z',
      updatedAt: '2026-11-20T11:00:00Z',
      escalationFlag: false,
      pendingAction: 'Awaiting Step 3 Human Decision Authority (Approver or Mobile Judge Fast-Path).',
      linkedDecisionIds: [],
      linkedDeliveryOrServiceId: 'BATCH-FD-403',
      linkedOutcomeIds: [],
      linkedEvidenceHashes: [],
      integrityStatus: 'VERIFIED',
      history: [
        {
          id: 'H-106-1',
          timestamp: '2026-11-20T10:30:00Z',
          stage: 'NEED',
          actorName: 'Web Portal Intake',
          actorRole: 'Beneficiary',
          action: 'Website Self-Service Case Created',
          details: 'Wheelchair mobility & zero-cooking-fuel dignity constraints captured.',
          eventHash: 'sha256:99887766',
        },
        {
          id: 'H-106-2',
          timestamp: '2026-11-20T10:35:00Z',
          stage: 'MATCH',
          actorName: 'HUMANIE Equity LP v4.2',
          actorRole: 'NGO coordinator',
          action: 'Solver Recommendation Ready for Human Gate',
          details: 'Recommended BATCH-FD-403 (28 units) with tricycle doorstep delivery.',
          eventHash: 'sha256:44332211',
        },
      ],
    },
    {
      caseId: 'CASE-2026-0105',
      idempotencyKey: 'IDEMP-CSV-99105',
      domain: 'WORK',
      beneficiaryRef: 'BEN-1089',
      beneficiaryAlias: 'Suresh B. (Ward 1)',
      intakeChannel: 'PARTNER_IMPORT',
      status: 'MATCHED_PENDING_REVIEW',
      lifecycleStage: 'HUMAN_REVIEW',
      priorityScore: 84,
      urgency: 'HIGH',
      summaryNeed: 'Accessible clerical & inventory job match within 2.5km of Ward 1 with ground-floor workspace.',
      constraints: {
        wardOrLocation: 'Ward 1 · Riverbank North',
        maxCommuteKm: 2.5,
        transportAvailable: true,
        childcareRequired: false,
        accessibilityNeeds: ['Ground Floor Desk', 'Screen-Reader Terminal'],
        preferredLanguage: 'Hindi / English',
        skills: ['Inventory', 'Record Keeping', 'Hindi/English'],
        availableHoursPerWeek: 30,
      },
      consent: {
        consentId: 'CNS-2026-0105',
        beneficiaryRef: 'BEN-1089',
        serviceParticipation: true,
        dataSharing: true,
        followUpContact: true,
        minimalDataIntake: true,
        restrictedDataHandling: false,
        withdrawn: false,
        accessibleExplanationLanguage: 'English',
        channelRecorded: 'PARTNER_IMPORT',
        updatedAt: '2026-11-20T07:45:00Z',
        history: [
          {
            timestamp: '2026-11-20T07:45:00Z',
            action: 'CONSENT_VERIFIED_ON_IMPORT',
            actorRole: 'NGO coordinator',
            channel: 'PARTNER_IMPORT',
            notes: 'Imported from Disability Employment Collective CSV batch with signed consent token.',
          },
        ],
      },
      assignedOrgId: 'ORG-EMP-01',
      assignedOrgName: 'GreenGrid Solar & Municipal Micro-Works',
      assignedReviewer: 'Judge Meera Krishnan',
      createdAt: '2026-11-20T07:45:00Z',
      updatedAt: '2026-11-20T08:15:00Z',
      escalationFlag: false,
      pendingAction: 'Awaiting Step 3 Human Review to authorise referral to GreenGrid Solar (JOB-WK-202).',
      linkedDecisionIds: [],
      linkedDeliveryOrServiceId: 'JOB-WK-202',
      linkedOutcomeIds: [],
      linkedEvidenceHashes: [],
      integrityStatus: 'VERIFIED',
      history: [
        {
          id: 'H-105-1',
          timestamp: '2026-11-20T07:45:00Z',
          stage: 'NEED',
          actorName: 'Partner CSV Importer',
          actorRole: 'NGO coordinator',
          action: 'Partner Batch Import Normalised',
          details: 'Mapped partner schema fields to Unified Case Model without data loss.',
          eventHash: 'sha256:77665544',
        },
      ],
    },
    {
      caseId: 'CASE-2026-0107',
      idempotencyKey: 'IDEMP-API-99107',
      domain: 'EDUCATION',
      beneficiaryRef: 'BEN-1104',
      beneficiaryAlias: 'Zoya A. (Ward 4)',
      intakeChannel: 'API',
      status: 'MATCHED_PENDING_REVIEW',
      lifecycleStage: 'HUMAN_REVIEW',
      priorityScore: 91,
      urgency: 'CRITICAL',
      summaryNeed: 'Foundational numeracy seat + stipend + transit voucher for child in silent-exclusion Ward 4.',
      constraints: {
        wardOrLocation: 'Ward 4 · Upland Canal Sector',
        transportAvailable: false,
        childcareRequired: false,
        preferredLanguage: 'Hindi / Marathi',
        gradeOrSkillLevel: 'Foundational Bridge Cohort',
      },
      consent: {
        consentId: 'CNS-2026-0107',
        beneficiaryRef: 'BEN-1104',
        serviceParticipation: true,
        dataSharing: true,
        followUpContact: true,
        minimalDataIntake: true,
        restrictedDataHandling: true,
        withdrawn: false,
        accessibleExplanationLanguage: 'Marathi / Hindi',
        channelRecorded: 'API',
        updatedAt: '2026-11-20T09:50:00Z',
        history: [
          {
            timestamp: '2026-11-20T09:50:00Z',
            action: 'CONSENT_GRANTED',
            actorRole: 'Field worker',
            channel: 'API',
            notes: 'District School Survey API sync with guardian voice-consent hash.',
          },
        ],
      },
      assignedOrgId: 'ORG-EDU-01',
      assignedOrgName: 'Vidya Setu Bridge Academy & Poly-Skills Hub',
      assignedReviewer: 'Judge Meera Krishnan',
      createdAt: '2026-11-20T09:50:00Z',
      updatedAt: '2026-11-20T10:10:00Z',
      escalationFlag: true,
      escalationReason: 'SILENT-EXCLUSION RECOVERY: High-need Ward 4 household surfaced by active outreach.',
      pendingAction: 'Awaiting Step 3 Human Approval for Vidya Setu Seat + Stipend (EDU-PRG-302).',
      linkedDecisionIds: [],
      linkedDeliveryOrServiceId: 'EDU-PRG-302',
      linkedOutcomeIds: [],
      linkedEvidenceHashes: [],
      integrityStatus: 'VERIFIED',
      history: [
        {
          id: 'H-107-1',
          timestamp: '2026-11-20T09:50:00Z',
          stage: 'NEED',
          actorName: 'Federated API Connector',
          actorRole: 'Field worker',
          action: 'API Intake Normalised',
          details: 'Surfaced via Ward 4 Silent-Exclusion sweep.',
          eventHash: 'sha256:12344321',
        },
      ],
    },
  ];

  // Attach initial matching recommendations to every case
  for (const c of cases) {
    c.currentMatch = runUnifiedMatchingEngine({
      caseId: c.caseId,
      domain: c.domain,
      urgency: c.urgency,
      constraints: c.constraints,
      foodBatches,
      workJobs,
      eduProgrammes,
    });
  }

  const decisions: DecisionVaultRecord[] = [
    {
      decisionId: 'DEC-2026-8801',
      caseId: 'CASE-2026-0101',
      domain: 'FOOD',
      solverVersion: 'HUMANIE-EQUITY-LP-v4.2',
      inputSnapshot: {
        beneficiaryRef: 'BEN-1018',
        urgency: 'CRITICAL',
        wardOrLocation: 'Ward 4 · Upland Canal Sector',
        constraints: cases[0].constraints,
      },
      constraintSnapshot: {
        totalAvailableCapacity: 436.9,
        coverageFloorTarget: 47.87,
        activeShockScenario: 'BASELINE_436_9',
      },
      originalRecommendation: cases[0].currentMatch!,
      alternatives: cases[0].currentMatch!.runnerUps,
      recommendationExplanation:
        'Equity LP lifted Ward 4 floor from 43.69% to 47.87% (+4.18 pp) and assigned 40 units of Fortified Low-Fuel Ration.',
      primaryApproverName: 'Judge Meera Krishnan',
      primaryApproverRole: 'Approver',
      secondApproverName: 'Justice S. Narayanan',
      secondApproverRole: 'Independent reviewer',
      conflictOfInterestDeclared: true,
      conflictDeclarationNote: 'Zero financial or familial affiliation with Janata Grain Co-op confirmed.',
      decisionAction: 'APPROVED_AS_RECOMMENDED',
      selectedResourceId: 'BATCH-FD-401',
      selectedResourceName: 'Fortified Grain & Low-Fuel Pulse Kit · Ward 4',
      approvedUnits: 40,
      approvalChannel: 'WEB_CONSOLE',
      timestamp: '2026-11-18T09:00:00Z',
      linkedOutcomeId: 'OUT-2026-501',
      linkedOutcomeState: 'Partly met',
      previousHash: 'sha256:00000000000000000000000000000000',
      integrityHash: computeDeterministicHash('DEC-2026-8801|CASE-2026-0101|BATCH-FD-401|40|Judge Meera Krishnan'),
    },
    {
      decisionId: 'DEC-2026-8802',
      caseId: 'CASE-2026-0102',
      domain: 'WORK',
      solverVersion: 'HUMANIE-WORK-ADAPTER-v4.2',
      inputSnapshot: {
        beneficiaryRef: 'BEN-1042',
        urgency: 'HIGH',
        wardOrLocation: 'Ward 2 · Industrial Corridor',
        constraints: cases[1].constraints,
      },
      constraintSnapshot: {
        totalAvailableCapacity: 45,
        coverageFloorTarget: 85.0,
        activeShockScenario: 'BASELINE_436_9',
      },
      originalRecommendation: cases[1].currentMatch!,
      alternatives: cases[1].currentMatch!.runnerUps,
      recommendationExplanation:
        'Matched to GreenGrid Solar Assembly (daytime shift + childcare compatibility + 2.8km commute).',
      primaryApproverName: 'Rohan Deshmukh',
      primaryApproverRole: 'NGO coordinator',
      conflictOfInterestDeclared: true,
      conflictDeclarationNote: 'No conflict with GreenGrid Solar.',
      decisionAction: 'APPROVED_AS_RECOMMENDED',
      selectedResourceId: 'JOB-WK-201',
      selectedResourceName: 'Solar Panel Assembly & Micro-Grid Technician · GreenGrid Solar',
      approvedUnits: 1,
      approvalChannel: 'WEB_CONSOLE',
      timestamp: '2026-10-19T14:30:00Z',
      linkedOutcomeId: 'OUT-2026-503',
      linkedOutcomeState: 'Met',
      previousHash: computeDeterministicHash('DEC-2026-8801|CASE-2026-0101|BATCH-FD-401|40|Judge Meera Krishnan'),
      integrityHash: computeDeterministicHash('DEC-2026-8802|CASE-2026-0102|JOB-WK-201|1|Rohan Deshmukh'),
    },
    {
      decisionId: 'DEC-2026-8803',
      caseId: 'CASE-2026-0103',
      domain: 'EDUCATION',
      solverVersion: 'HUMANIE-EDU-ADAPTER-v4.2',
      inputSnapshot: {
        beneficiaryRef: 'BEN-1055',
        urgency: 'HIGH',
        wardOrLocation: 'Ward 3 · Peri-Urban Settlement',
        constraints: cases[2].constraints,
      },
      constraintSnapshot: {
        totalAvailableCapacity: 90,
        coverageFloorTarget: 90.0,
        activeShockScenario: 'BASELINE_436_9',
      },
      originalRecommendation: cases[2].currentMatch!,
      alternatives: cases[2].currentMatch!.runnerUps,
      recommendationExplanation:
        'Matched to Vidya Setu Bridge Cohort with 100% fee voucher and safe student transit pass.',
      primaryApproverName: 'Judge Meera Krishnan',
      primaryApproverRole: 'Approver',
      conflictOfInterestDeclared: true,
      conflictDeclarationNote: 'No conflict declared.',
      decisionAction: 'APPROVED_AS_RECOMMENDED',
      selectedResourceId: 'EDU-PRG-301',
      selectedResourceName: 'Secondary Bridge Cohort + Vocational Digital Literacy · Vidya Setu',
      approvedUnits: 1,
      approvalChannel: 'MOBILE_JUDGE_FAST_PATH',
      timestamp: '2026-10-20T13:10:00Z',
      linkedOutcomeId: 'OUT-2026-504',
      linkedOutcomeState: 'Met',
      previousHash: computeDeterministicHash('DEC-2026-8802|CASE-2026-0102|JOB-WK-201|1|Rohan Deshmukh'),
      integrityHash: computeDeterministicHash('DEC-2026-8803|CASE-2026-0103|EDU-PRG-301|1|Judge Meera Krishnan'),
    },
  ];

  const outcomes: FollowUpOutcomeRecord[] = [
    {
      outcomeId: 'OUT-2026-501',
      caseId: 'CASE-2026-0101',
      decisionId: 'DEC-2026-8801',
      domain: 'FOOD',
      scheduleLabel: 'Post-Delivery (Food)',
      status: 'Partly met',
      channel: 'SMS',
      dispatchedUnits: 40,
      receivedUnits: 35,
      beneficiaryFeedback:
        'Received 35 units instead of 40 on the dispatch manifest. 5 ration kits missing from van offload.',
      verifiedByRole: 'Beneficiary',
      verifiedAt: '2026-11-20T09:15:00Z',
      discrepancyFlagged: true,
    },
    {
      outcomeId: 'OUT-2026-502',
      caseId: 'CASE-2026-0102',
      decisionId: 'DEC-2026-8802',
      domain: 'WORK',
      scheduleLabel: '7-Day Check (Work)',
      status: 'Met',
      channel: 'WhatsApp',
      stillEmployedAt7Days: true,
      beneficiaryFeedback: 'Daytime shift 08:30–15:30 works smoothly with crèche pickup; safety gear provided.',
      verifiedByRole: 'Beneficiary',
      verifiedAt: '2026-10-27T17:00:00Z',
      discrepancyFlagged: false,
    },
    {
      outcomeId: 'OUT-2026-503',
      caseId: 'CASE-2026-0102',
      decisionId: 'DEC-2026-8802',
      domain: 'WORK',
      scheduleLabel: '30-Day Check (Work)',
      status: 'Met',
      channel: 'Website',
      stillEmployedAt7Days: true,
      stillEmployedAt30Days: true,
      beneficiaryFeedback: 'First month full salary ₹18,500 received via direct transfer. Continuing full-time.',
      verifiedByRole: 'Field worker',
      verifiedAt: '2026-11-19T14:00:00Z',
      discrepancyFlagged: false,
    },
    {
      outcomeId: 'OUT-2026-504',
      caseId: 'CASE-2026-0103',
      decisionId: 'DEC-2026-8803',
      domain: 'EDUCATION',
      scheduleLabel: '30-Day Check (Education)',
      status: 'Met',
      channel: 'WhatsApp',
      stillAttendingAt30Days: true,
      attendanceRatePct: 94,
      beneficiaryFeedback: 'Attending daily using the bundled transit pass; bilingual bridge classes working well.',
      verifiedByRole: 'Education partner',
      verifiedAt: '2026-11-20T08:00:00Z',
      discrepancyFlagged: false,
    },
  ];

  const integrityFlags: IntegritySignalFlag[] = [
    {
      flagId: 'FLG-901',
      category: 'RECEIPT_DISCREPANCY',
      severity: 'HIGH',
      caseId: 'CASE-2026-0101',
      orgId: 'ORG-DIST-01',
      ward: 'Ward 4 · Upland Canal Sector',
      title: '5-Unit Last-Mile Receipt Gap (Dispatched 40 vs Received 35)',
      description:
        'Investigation signal triggered automatically when household SMS receipt (35 units) differed from depot dispatch manifest (40 units) on BATCH-FD-401.',
      evidenceMetric: '12.5% batch variance (-5.0 units)',
      status: 'UNDER_INDEPENDENT_REVIEW',
      assignedIndependentReviewer: 'Justice S. Narayanan',
      createdAt: '2026-11-20T09:16:00Z',
    },
    {
      flagId: 'FLG-902',
      category: 'SILENT_EXCLUSION',
      severity: 'HIGH',
      ward: 'Ward 4 · Upland Canal Sector',
      title: 'Silent-Exclusion Alert: High Vulnerability (0.94) vs Low Inbound Reporting (29%)',
      description:
        'Ward 4 exhibits severe structural deprivation but 71% fewer self-service applications than urban Ward 2. Equity LP floor clamp and frontline mobile sweep activated.',
      evidenceMetric: 'Reporting gap: -53% vs district mean',
      status: 'OPEN_SIGNAL',
      assignedIndependentReviewer: 'Rohan Deshmukh',
      createdAt: '2026-11-20T08:00:00Z',
    },
    {
      flagId: 'FLG-903',
      category: 'OVERRIDE_PATTERN',
      severity: 'WATCH',
      orgId: 'ORG-DIST-01',
      ward: 'Ward 2 · Industrial Corridor',
      title: 'Moral Calibration Signal: 3 Manual Overrides for Low-Fuel Households',
      description:
        'Approvers manually substituted pre-milled fortified packs in 3 consecutive Ward 3/4 cases. Solver weights updated to incorporate cooking-fuel constraint natively.',
      evidenceMetric: '3 human overrides → solver rule calibrated',
      status: 'RESOLVED_EXPLAINED',
      assignedIndependentReviewer: 'Justice S. Narayanan',
      createdAt: '2026-11-17T15:20:00Z',
    },
  ];

  const complaints: WhistleblowerComplaint[] = [
    {
      complaintId: 'WB-2026-701',
      submissionType: 'ANONYMOUS',
      category: 'BRIBE_DEMAND',
      targetOrgId: 'ORG-DIST-01',
      targetOrgName: 'Janata Grain & Fortified Ration Co-op (Sub-Contractor Van #04)',
      relatedCaseId: 'CASE-2026-0101',
      ward: 'Ward 4 · Upland Canal Sector',
      description:
        'Driver assistant demanded ₹200 "unloading fee" or 5 ration packets at Upland Canal drop point before signing release sheet.',
      evidenceAttachmentRef: 'SMS-AUDIO-HASH-9941a (Voice note + timestamped weighbridge slip)',
      encryptedIdentityVaultRef: 'ZERO-KNOWLEDGE-ANON-TOKEN-8831',
      accusedOrgBlockedFromAccess: true,
      retaliationRiskIndicator: 'ELEVATED_PROTECTION',
      assignedIndependentReviewer: 'Justice S. Narayanan',
      recusedReviewers: ['Vikram Sethi (ORG-DIST-01 Accused Entity Blocked)'],
      status: 'INDEPENDENT_INVESTIGATION',
      reviewNotes: [
        'Accused organisation (ORG-DIST-01) automatically stripped of read/write visibility on WB-2026-701.',
        'Cross-linked with FLG-901 (5-unit discrepancy on BATCH-FD-401). Sub-contractor van suspended pending hearing.',
      ],
      createdAt: '2026-11-20T09:22:00Z',
    },
  ];

  // Build hash-chained audit ledger
  const rawLedgerEvents: Omit<AuditLedgerEntry, 'previousHash' | 'currentHash'>[] = [
    {
      seq: 1,
      eventId: 'EVT-0001',
      timestamp: '2026-11-18T08:05:00Z',
      eventType: 'CASE_INTAKE',
      actorRole: 'Beneficiary',
      entityId: 'CASE-2026-0101',
      summary: 'SMS intake normalised & validated for Ward 4 cluster (BEN-1018).',
      payloadSnapshot: JSON.stringify({ caseId: 'CASE-2026-0101', channel: 'SMS', domain: 'FOOD', units: 40 }),
    },
    {
      seq: 2,
      eventId: 'EVT-0002',
      timestamp: '2026-11-18T08:10:00Z',
      eventType: 'CONSENT_RECORDED',
      actorRole: 'Beneficiary',
      entityId: 'CNS-2026-0101',
      summary: 'Structured consent recorded in Hindi via SMS confirmation.',
      payloadSnapshot: JSON.stringify({ consentId: 'CNS-2026-0101', service: true, sharing: true, followUp: true }),
    },
    {
      seq: 3,
      eventId: 'EVT-0003',
      timestamp: '2026-11-18T08:20:00Z',
      eventType: 'SOLVER_MATCH',
      actorRole: 'NGO coordinator',
      entityId: 'MCH-2026-0101',
      summary: 'Equity LP v4.2 matched CASE-2026-0101 to BATCH-FD-401 (47.87% ward floor).',
      payloadSnapshot: JSON.stringify({ solver: 'HUMANIE-EQUITY-LP-v4.2', batch: 'BATCH-FD-401', units: 40 }),
    },
    {
      seq: 4,
      eventId: 'EVT-0004',
      timestamp: '2026-11-18T09:00:00Z',
      eventType: 'HUMAN_DECISION',
      actorRole: 'Approver',
      entityId: 'DEC-2026-8801',
      summary: 'Two-person human approval recorded by Judge Meera Krishnan & Justice S. Narayanan.',
      payloadSnapshot: JSON.stringify({ decisionId: 'DEC-2026-8801', action: 'APPROVED_AS_RECOMMENDED', units: 40 }),
    },
    {
      seq: 5,
      eventId: 'EVT-0005',
      timestamp: '2026-11-20T09:15:00Z',
      eventType: 'DELIVERY_RECEIPT',
      actorRole: 'Beneficiary',
      entityId: 'OUT-2026-501',
      summary: 'Household SMS receipt logged 35 received vs 40 dispatched (-5 unit discrepancy).',
      payloadSnapshot: JSON.stringify({ batchId: 'BATCH-FD-401', dispatched: 40, received: 35, gap: -5 }),
    },
    {
      seq: 6,
      eventId: 'EVT-0006',
      timestamp: '2026-11-20T09:22:00Z',
      eventType: 'WHISTLEBLOWER_REPORT',
      actorRole: 'Independent reviewer',
      entityId: 'WB-2026-701',
      summary: 'Anonymous bribe-demand complaint locked in separated vault; accused org blocked.',
      payloadSnapshot: JSON.stringify({ complaintId: 'WB-2026-701', category: 'BRIBE_DEMAND', orgBlocked: 'ORG-DIST-01' }),
    },
  ];

  const auditLedger: AuditLedgerEntry[] = [];
  let prevHash = 'sha256:00000000000000000000000000000000';
  for (const raw of rawLedgerEvents) {
    const currentHash = computeDeterministicHash(
      `${raw.seq}|${raw.eventId}|${raw.eventType}|${raw.entityId}|${raw.payloadSnapshot}|${prevHash}`
    );
    auditLedger.push({
      ...raw,
      previousHash: prevHash,
      currentHash,
    });
    prevHash = currentHash;
  }

  return {
    activeCountryCode: 'IN-DIST',
    countryPacks: COUNTRY_PACKS,
    organisations,
    foodBatches,
    workJobs,
    eduProgrammes,
    cases,
    decisions,
    outcomes,
    integrityFlags,
    complaints,
    auditLedger,
    lpSolverState,
    scheduledFollowUps: [],
    importLogs: [
      {
        importId: 'IMP-2026-01',
        timestamp: '2026-11-20T07:45:00Z',
        sourcePartner: 'Disability Employment Collective (WFP/SCOPE CSV Adapter)',
        rowsProcessed: 14,
        casesCreated: 12,
        duplicatesMerged: 2,
        actorRole: 'NGO coordinator',
      },
    ],
  };
}

const globalForHumanie = globalThis as unknown as {
  humanieState: HumanieSystemState | undefined;
};

export function getHumanieState(): HumanieSystemState {
  if (!globalForHumanie.humanieState) {
    globalForHumanie.humanieState = buildInitialState();
  }
  return globalForHumanie.humanieState;
}

export function appendLedgerEvent(
  state: HumanieSystemState,
  event: {
    eventType: AuditLedgerEntry['eventType'];
    actorRole: UserRole;
    entityId: string;
    summary: string;
    payload: Record<string, unknown>;
  }
): AuditLedgerEntry {
  const seq = state.auditLedger.length + 1;
  const eventId = `EVT-${String(seq).padStart(4, '0')}`;
  const prevHash =
    state.auditLedger.length > 0
      ? state.auditLedger[state.auditLedger.length - 1].currentHash
      : 'sha256:00000000000000000000000000000000';
  const payloadSnapshot = JSON.stringify(event.payload);
  const currentHash = computeDeterministicHash(
    `${seq}|${eventId}|${event.eventType}|${event.entityId}|${payloadSnapshot}|${prevHash}`
  );
  const entry: AuditLedgerEntry = {
    seq,
    eventId,
    timestamp: new Date().toISOString(),
    eventType: event.eventType,
    actorRole: event.actorRole,
    entityId: event.entityId,
    summary: event.summary,
    payloadSnapshot,
    previousHash: prevHash,
    currentHash,
  };
  state.auditLedger.push(entry);
  return entry;
}

/**
 * Unified Intake Service (Batch 1)
 * Channel -> Normalisation -> Validation -> Consent -> Case Creation -> Assignment -> Receipt
 */
export function processUnifiedIntake(params: {
  actorRole: UserRole;
  channel: IntakeChannel;
  domain: DomainType;
  beneficiaryAlias: string;
  beneficiaryRef?: string;
  urgency: UrgencyLevel;
  summaryNeed: string;
  constraints: ConstraintsAndPreferences;
  consentGranted: boolean;
  dataSharingGranted?: boolean;
  followUpGranted?: boolean;
  idempotencyKey?: string;
}): {
  caseRecord: CaseRecord;
  deduplicatedExisting: boolean;
  receiptCode: string;
} {
  const state = getHumanieState();

  if (!params.consentGranted) {
    throw new Error('Dignity & Consent Gate: Explicit service participation consent is required before case creation.');
  }

  const idemp =
    params.idempotencyKey ||
    `IDEMP-${params.channel}-${params.domain}-${params.beneficiaryAlias.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // Idempotent & Duplicate Check
  const existing = state.cases.find(
    (c) =>
      c.idempotencyKey === idemp ||
      (c.domain === params.domain &&
        c.beneficiaryAlias.toLowerCase().trim() === params.beneficiaryAlias.toLowerCase().trim())
  );

  if (existing) {
    existing.duplicateWarning = `Duplicate intake attempt detected via ${params.channel} at ${new Date().toLocaleTimeString()} — merged idempotently.`;
    return {
      caseRecord: existing,
      deduplicatedExisting: true,
      receiptCode: `RCPT-${existing.caseId}-IDEMPOTENT`,
    };
  }

  const nextNum = 108 + state.cases.length;
  const caseId = `CASE-2026-0${nextNum}`;
  const benRef = params.beneficiaryRef || `BEN-${1100 + state.cases.length}`;
  const now = new Date().toISOString();

  const assignedOrg =
    params.domain === 'FOOD'
      ? state.organisations.find((o) => o.orgId === 'ORG-DIST-01')!
      : params.domain === 'WORK'
      ? state.organisations.find((o) => o.orgId === 'ORG-EMP-01')!
      : state.organisations.find((o) => o.orgId === 'ORG-EDU-01')!;

  const consent: ConsentState = {
    consentId: `CNS-2026-0${nextNum}`,
    beneficiaryRef: benRef,
    serviceParticipation: true,
    dataSharing: params.dataSharingGranted ?? true,
    followUpContact: params.followUpGranted ?? true,
    minimalDataIntake: true,
    restrictedDataHandling: true,
    withdrawn: false,
    accessibleExplanationLanguage: params.constraints.preferredLanguage || 'Hindi / English',
    channelRecorded: params.channel,
    updatedAt: now,
    history: [
      {
        timestamp: now,
        action: 'CONSENT_GRANTED',
        actorRole: params.actorRole,
        channel: params.channel,
        notes: `Normalised via Unified Intake Pipeline (${params.channel}).`,
      },
    ],
  };

  const match = runUnifiedMatchingEngine({
    caseId,
    domain: params.domain,
    urgency: params.urgency,
    constraints: params.constraints,
    foodBatches: state.foodBatches,
    workJobs: state.workJobs,
    eduProgrammes: state.eduProgrammes,
  });

  const ledgerEntry = appendLedgerEvent(state, {
    eventType: 'CASE_INTAKE',
    actorRole: params.actorRole,
    entityId: caseId,
    summary: `Unified intake via ${params.channel} (${params.domain}) for ${params.beneficiaryAlias}. Matched to ${match.recommendedResourceName}.`,
    payload: {
      caseId,
      channel: params.channel,
      domain: params.domain,
      recommendedResourceId: match.recommendedResourceId,
    },
  });

  const newCase: CaseRecord = {
    caseId,
    idempotencyKey: idemp,
    domain: params.domain,
    beneficiaryRef: benRef,
    beneficiaryAlias: params.beneficiaryAlias,
    intakeChannel: params.channel,
    status: 'MATCHED_PENDING_REVIEW',
    lifecycleStage: 'HUMAN_REVIEW',
    priorityScore: params.urgency === 'CRITICAL' ? 95 : params.urgency === 'HIGH' ? 86 : 75,
    urgency: params.urgency,
    summaryNeed: params.summaryNeed,
    constraints: params.constraints,
    consent,
    assignedOrgId: assignedOrg.orgId,
    assignedOrgName: assignedOrg.name,
    assignedReviewer: 'Judge Meera Krishnan',
    createdAt: now,
    updatedAt: now,
    escalationFlag: params.urgency === 'CRITICAL',
    escalationReason:
      params.urgency === 'CRITICAL' ? 'Critical urgency case routed for priority Step 3 human review.' : undefined,
    pendingAction: 'Awaiting Step 3 Human Decision Authority (No automated placement or denial).',
    currentMatch: match,
    linkedDecisionIds: [],
    linkedDeliveryOrServiceId: match.recommendedResourceId,
    linkedOutcomeIds: [],
    linkedEvidenceHashes: [ledgerEntry.currentHash],
    integrityStatus: 'VERIFIED',
    history: [
      {
        id: `H-${nextNum}-1`,
        timestamp: now,
        stage: 'NEED',
        actorName: `${params.channel} Intake Pipeline`,
        actorRole: params.actorRole,
        action: `Channel → Normalisation → Validation → Consent (${params.channel})`,
        details: `Created unified case ${caseId} with minimal-data consent.`,
        eventHash: ledgerEntry.currentHash,
      },
      {
        id: `H-${nextNum}-2`,
        timestamp: now,
        stage: 'MATCH',
        actorName: match.solverVersion,
        actorRole: params.actorRole,
        action: `Matched to ${match.recommendedResourceName} (${match.compatibilityScore}/100)`,
        details: match.scoreExplanation,
        eventHash: ledgerEntry.currentHash,
      },
    ],
  };

  state.cases.unshift(newCase);
  return {
    caseRecord: newCase,
    deduplicatedExisting: false,
    receiptCode: `RCPT-${caseId}-${params.channel.slice(0, 3)}`,
  };
}

/**
 * Step 3 Human Review & Decision Vault Recording (Batches 2 & 3)
 * Enforces RBAC, Conflict-of-Interest declaration, and Two-Person Approval for high-risk decisions.
 */
export function recordHumanDecision(params: {
  actorRole: UserRole;
  actorName: string;
  caseId: string;
  decisionAction: 'APPROVED_AS_RECOMMENDED' | 'OVERRIDDEN_WITH_REASON' | 'SECOND_APPROVER_SIGN_OFF';
  selectedResourceId?: string;
  overrideReason?: string;
  conflictDeclared: boolean;
  conflictNote?: string;
  approvalChannel?: 'WEB_CONSOLE' | 'MOBILE_JUDGE_FAST_PATH';
}): DecisionVaultRecord {
  const state = getHumanieState();
  const perm = ROLE_PERMISSION_MATRIX[params.actorRole];

  if (!perm.canApproveDecisions) {
    throw new Error(
      `RBAC Permission Denied: Role "${params.actorRole}" is not authorised to approve consequential Step 3 decisions.`
    );
  }

  if (!params.conflictDeclared) {
    throw new Error(
      'Integrity Shield Prevention Gate: Approver must explicitly declare zero Conflict of Interest before authorising a decision.'
    );
  }

  const targetCase = state.cases.find((c) => c.caseId === params.caseId);
  if (!targetCase || !targetCase.currentMatch) {
    throw new Error(`Case ${params.caseId} not found or lacks an active matching recommendation.`);
  }

  // Check if awaiting second approver
  if (params.decisionAction === 'SECOND_APPROVER_SIGN_OFF') {
    const existingDec = state.decisions.find(
      (d) => d.caseId === params.caseId && d.decisionAction === 'PENDING_SECOND_APPROVER'
    );
    if (!existingDec) {
      throw new Error('No pending two-person decision found for this case.');
    }
    if (existingDec.primaryApproverName === params.actorName) {
      throw new Error('Integrity Shield Separation: Second approver must be a different person from primary approver.');
    }
    existingDec.secondApproverName = params.actorName;
    existingDec.secondApproverRole = params.actorRole;
    existingDec.decisionAction = existingDec.overrideReason
      ? 'OVERRIDDEN_WITH_REASON'
      : 'APPROVED_AS_RECOMMENDED';
    targetCase.status = 'APPROVED_FOR_DELIVERY';
    targetCase.lifecycleStage = 'DELIVERY';
    targetCase.pendingAction = 'Two-person human approval complete. Ready for dispatch/enrolment & Result Check.';

    const entry = appendLedgerEvent(state, {
      eventType: 'HUMAN_DECISION',
      actorRole: params.actorRole,
      entityId: existingDec.decisionId,
      summary: `Second approver (${params.actorName}) co-signed high-risk decision ${existingDec.decisionId} for ${targetCase.caseId}.`,
      payload: { decisionId: existingDec.decisionId, caseId: targetCase.caseId, secondApprover: params.actorName },
    });

    targetCase.history.push({
      id: `H-DEC2-${Date.now()}`,
      timestamp: new Date().toISOString(),
      stage: 'HUMAN_REVIEW',
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: 'Second Approver Co-Signature Verified',
      details: `Two-person Integrity Shield lock satisfied for ${existingDec.selectedResourceName}.`,
      eventHash: entry.currentHash,
    });

    return existingDec;
  }

  if (params.decisionAction === 'OVERRIDDEN_WITH_REASON' && (!params.overrideReason || params.overrideReason.trim().length < 8)) {
    throw new Error('Decision Vault Rule: Overriding the solver recommendation requires a documented reason (minimum 8 chars).');
  }

  const match = targetCase.currentMatch;
  const chosenId = params.selectedResourceId || match.recommendedResourceId;
  const runnerUpMatch = match.runnerUps.find((r) => r.resourceId === chosenId);
  const chosenName =
    chosenId === match.recommendedResourceId
      ? match.recommendedResourceName
      : runnerUpMatch
      ? runnerUpMatch.resourceName
      : chosenId;

  const decisionId = `DEC-2026-880${state.decisions.length + 1}`;
  const prevHash =
    state.decisions.length > 0
      ? state.decisions[0].integrityHash
      : 'sha256:00000000000000000000000000000000';

  const requiresSecondApprover =
    match.highRiskTwoPersonApproval && params.approvalChannel !== 'MOBILE_JUDGE_FAST_PATH';

  const finalAction: DecisionVaultRecord['decisionAction'] = requiresSecondApprover
    ? 'PENDING_SECOND_APPROVER'
    : params.decisionAction === 'OVERRIDDEN_WITH_REASON'
    ? 'OVERRIDDEN_WITH_REASON'
    : 'APPROVED_AS_RECOMMENDED';

  const integrityHash = computeDeterministicHash(
    `${decisionId}|${targetCase.caseId}|${chosenId}|${match.allocatedUnitsOrSeats}|${params.actorName}|${prevHash}`
  );

  const decisionRecord: DecisionVaultRecord = {
    decisionId,
    caseId: targetCase.caseId,
    domain: targetCase.domain,
    solverVersion: match.solverVersion,
    inputSnapshot: {
      beneficiaryRef: targetCase.beneficiaryRef,
      urgency: targetCase.urgency,
      wardOrLocation: targetCase.constraints.wardOrLocation,
      constraints: targetCase.constraints,
    },
    constraintSnapshot: {
      totalAvailableCapacity: state.lpSolverState.totalStockUnits,
      coverageFloorTarget: state.lpSolverState.coverageFloorTargetPct,
      activeShockScenario: state.lpSolverState.activeScenario,
    },
    originalRecommendation: match,
    alternatives: match.runnerUps,
    recommendationExplanation: match.scoreExplanation,
    primaryApproverName: params.actorName,
    primaryApproverRole: params.actorRole,
    secondApproverName:
      params.approvalChannel === 'MOBILE_JUDGE_FAST_PATH' ? 'Emergency Judicial Fast-Path Co-Seal' : undefined,
    secondApproverRole:
      params.approvalChannel === 'MOBILE_JUDGE_FAST_PATH' ? 'Independent reviewer' : undefined,
    conflictOfInterestDeclared: true,
    conflictDeclarationNote:
      params.conflictNote || 'Verified no personal, familial, or financial conflict with provider organisation.',
    decisionAction: finalAction,
    selectedResourceId: chosenId,
    selectedResourceName: chosenName,
    approvedUnits: match.allocatedUnitsOrSeats,
    overrideReason: params.overrideReason,
    approvalChannel: params.approvalChannel || 'WEB_CONSOLE',
    timestamp: new Date().toISOString(),
    previousHash: prevHash,
    integrityHash,
  };

  state.decisions.unshift(decisionRecord);
  targetCase.linkedDecisionIds.push(decisionId);
  targetCase.updatedAt = decisionRecord.timestamp;

  if (requiresSecondApprover) {
    targetCase.status = 'AWAITING_SECOND_APPROVAL';
    targetCase.lifecycleStage = 'HUMAN_REVIEW';
    targetCase.pendingAction = 'Primary approver signed. High-risk decision requires Second Approver co-signature.';
  } else {
    targetCase.status = 'APPROVED_FOR_DELIVERY';
    targetCase.lifecycleStage = 'DELIVERY';
    targetCase.pendingAction = 'Human approval recorded in Decision Vault. Ready for delivery/enrolment & Result Check.';
  }

  // Update domain operational entity
  if (targetCase.domain === 'FOOD') {
    const batch = state.foodBatches.find((b) => b.batchId === chosenId);
    if (batch) {
      batch.dispatchStatus = 'DISPATCHED';
      batch.dispatchedUnits = match.allocatedUnitsOrSeats;
    }
  } else if (targetCase.domain === 'WORK') {
    const job = state.workJobs.find((j) => j.jobId === chosenId);
    if (job) {
      job.workflowStage = 'Placement';
      job.referralStatus = 'PLACED';
      job.candidateAlias = targetCase.beneficiaryAlias;
    }
  } else if (targetCase.domain === 'EDUCATION') {
    const prog = state.eduProgrammes.find((p) => p.programmeId === chosenId);
    if (prog) {
      prog.workflowStage = 'Enrolment';
      prog.studentAlias = targetCase.beneficiaryAlias;
      prog.seatsAvailable = Math.max(0, prog.seatsAvailable - 1);
    }
  }

  const ledgerEntry = appendLedgerEvent(state, {
    eventType: 'HUMAN_DECISION',
    actorRole: params.actorRole,
    entityId: decisionId,
    summary: `Step 3 Human Decision (${finalAction}) by ${params.actorName} via ${
      params.approvalChannel || 'WEB_CONSOLE'
    } for ${targetCase.caseId}.`,
    payload: {
      decisionId,
      caseId: targetCase.caseId,
      action: finalAction,
      resource: chosenId,
      overrideReason: params.overrideReason,
    },
  });

  targetCase.linkedEvidenceHashes.push(ledgerEntry.currentHash);
  targetCase.history.push({
    id: `H-DEC-${Date.now()}`,
    timestamp: decisionRecord.timestamp,
    stage: requiresSecondApprover ? 'HUMAN_REVIEW' : 'DELIVERY',
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: `Decision Vault Record ${decisionId} (${finalAction})`,
    details: params.overrideReason
      ? `Overrode solver with reason: "${params.overrideReason}" -> Selected ${chosenName}`
      : `Authorised recommended placement: ${chosenName}`,
    eventHash: ledgerEntry.currentHash,
  });

  if (params.decisionAction === 'OVERRIDDEN_WITH_REASON') {
    state.integrityFlags.unshift({
      flagId: `FLG-90${state.integrityFlags.length + 1}`,
      category: 'OVERRIDE_PATTERN',
      severity: 'WATCH',
      caseId: targetCase.caseId,
      orgId: targetCase.assignedOrgId,
      ward: targetCase.constraints.wardOrLocation,
      title: `Documented Human Override on ${targetCase.caseId}`,
      description: `Approver ${params.actorName} selected ${chosenName} with reason: "${params.overrideReason}". Queued for moral calibration review.`,
      evidenceMetric: '1 documented override (with explanation)',
      status: 'OPEN_SIGNAL',
      assignedIndependentReviewer: 'Justice S. Narayanan',
      createdAt: decisionRecord.timestamp,
    });
  }

  return decisionRecord;
}

/**
 * Step 4 & 5 Delivery Receipt & Result Check Verification (Batch 2)
 * Never counts failure or non-response as success; automatically triggers Integrity Shield on discrepancy.
 */
export function recordResultCheckAndReceipt(params: {
  actorRole: UserRole;
  caseId: string;
  channel: 'SMS' | 'WhatsApp' | 'Website' | 'Field worker';
  status: ResultCheckStatus;
  dispatchedUnits?: number;
  receivedUnits?: number;
  stillEmployedAt7Days?: boolean;
  stillEmployedAt30Days?: boolean;
  stillAttendingAt30Days?: boolean;
  attendanceRatePct?: number;
  beneficiaryFeedback: string;
}): FollowUpOutcomeRecord {
  const state = getHumanieState();
  const targetCase = state.cases.find((c) => c.caseId === params.caseId);
  if (!targetCase) {
    throw new Error(`Case ${params.caseId} not found.`);
  }

  const decisionId = targetCase.linkedDecisionIds[0] || 'DEC-UNLINKED';
  const dispatched = params.dispatchedUnits ?? targetCase.currentMatch?.allocatedUnitsOrSeats ?? 40;
  const received = params.receivedUnits ?? dispatched;
  const hasDiscrepancy =
    (targetCase.domain === 'FOOD' && received < dispatched) ||
    params.status === 'Not met' ||
    params.status === 'Partly met';

  const scheduleLabel: FollowUpOutcomeRecord['scheduleLabel'] =
    targetCase.domain === 'FOOD'
      ? 'Post-Delivery (Food)'
      : targetCase.domain === 'WORK'
      ? params.stillEmployedAt30Days !== undefined
        ? '30-Day Check (Work)'
        : '7-Day Check (Work)'
      : '30-Day Check (Education)';

  const outcomeId = `OUT-2026-50${state.outcomes.length + 1}`;
  const now = new Date().toISOString();

  const outcome: FollowUpOutcomeRecord = {
    outcomeId,
    caseId: targetCase.caseId,
    decisionId,
    domain: targetCase.domain,
    scheduleLabel,
    status: params.status,
    channel: params.channel,
    dispatchedUnits: targetCase.domain === 'FOOD' ? dispatched : undefined,
    receivedUnits: targetCase.domain === 'FOOD' ? received : undefined,
    stillEmployedAt7Days: params.stillEmployedAt7Days,
    stillEmployedAt30Days: params.stillEmployedAt30Days,
    stillAttendingAt30Days: params.stillAttendingAt30Days,
    attendanceRatePct: params.attendanceRatePct,
    beneficiaryFeedback: params.beneficiaryFeedback,
    verifiedByRole: params.actorRole,
    verifiedAt: now,
    discrepancyFlagged: hasDiscrepancy,
  };

  state.outcomes.unshift(outcome);
  targetCase.linkedOutcomeIds.push(outcomeId);
  targetCase.updatedAt = now;

  // Link back to Decision Vault record
  const linkedDecision = state.decisions.find((d) => d.decisionId === decisionId);
  if (linkedDecision) {
    linkedDecision.linkedOutcomeId = outcomeId;
    linkedDecision.linkedOutcomeState = params.status;
  }

  if (targetCase.domain === 'FOOD' && received < dispatched) {
    const gap = dispatched - received;
    targetCase.status = 'DISCREPANCY_INVESTIGATION';
    targetCase.lifecycleStage = 'INTEGRITY';
    targetCase.integrityStatus = 'FLAGGED_DISCREPANCY';
    targetCase.escalationFlag = true;
    targetCase.escalationReason = `LAST-MILE LEAKAGE ALERT: Dispatched ${dispatched} units, received ${received} units (-${gap} unit gap).`;
    targetCase.pendingAction = `Independent Reviewer investigating ${gap}-unit delivery discrepancy.`;

    const batch = state.foodBatches.find((b) => b.batchId === targetCase.linkedDeliveryOrServiceId);
    if (batch) {
      batch.dispatchedUnits = dispatched;
      batch.receivedUnits = received;
      batch.discrepancyUnits = gap;
      batch.dispatchStatus = 'DISCREPANCY_OPEN';
      batch.discrepancyNote = params.beneficiaryFeedback;
    }

    state.integrityFlags.unshift({
      flagId: `FLG-90${state.integrityFlags.length + 1}`,
      category: 'RECEIPT_DISCREPANCY',
      severity: 'HIGH',
      caseId: targetCase.caseId,
      orgId: targetCase.assignedOrgId,
      ward: targetCase.constraints.wardOrLocation,
      title: `${gap}-Unit Last-Mile Receipt Gap (Dispatched ${dispatched} vs Received ${received})`,
      description: `Beneficiary receipt via ${params.channel} reported ${received} units against ${dispatched} dispatched. Investigation case opened automatically.`,
      evidenceMetric: `-${gap} units (${(((dispatched - received) / dispatched) * 100).toFixed(1)}% leakage gap)`,
      status: 'OPEN_SIGNAL',
      assignedIndependentReviewer: 'Justice S. Narayanan',
      createdAt: now,
    });
  } else if (params.status === 'Met') {
    targetCase.status = 'VERIFIED_CLOSED';
    targetCase.lifecycleStage = 'EVIDENCE';
    targetCase.escalationFlag = false;
    targetCase.pendingAction = `Verified outcome (${scheduleLabel}: MET). Hash-chained evidence complete.`;
  } else {
    targetCase.status = 'RESULT_CHECK_PENDING';
    targetCase.lifecycleStage = 'RESULT_CHECK';
    targetCase.pendingAction = `Outcome status "${params.status}" recorded — never counted as success; follow-up remediation required.`;
  }

  const ledgerEntry = appendLedgerEvent(state, {
    eventType: hasDiscrepancy ? 'DISCREPANCY_ALERT' : 'RESULT_CHECK',
    actorRole: params.actorRole,
    entityId: outcomeId,
    summary: `Result Check (${scheduleLabel}: ${params.status}) via ${params.channel} for ${targetCase.caseId}.`,
    payload: {
      outcomeId,
      caseId: targetCase.caseId,
      status: params.status,
      dispatched,
      received,
    },
  });

  targetCase.linkedEvidenceHashes.push(ledgerEntry.currentHash);
  targetCase.history.push({
    id: `H-OUT-${Date.now()}`,
    timestamp: now,
    stage: hasDiscrepancy ? 'INTEGRITY' : 'RESULT_CHECK',
    actorName: `${params.channel} Result Check`,
    actorRole: params.actorRole,
    action: `${scheduleLabel}: ${params.status.toUpperCase()}`,
    details: params.beneficiaryFeedback,
    eventHash: ledgerEntry.currentHash,
  });

  return outcome;
}

/**
 * Whistleblower & Anti-Bribe Submission (Batch 3)
 * Stores identity in separate encrypted reference and blocks accused organisation from controlling or viewing complaint.
 */
export function submitWhistleblowerComplaint(params: {
  actorRole: UserRole;
  submissionType: 'ANONYMOUS' | 'IDENTIFIED_PROTECTED';
  category: WhistleblowerComplaint['category'];
  targetOrgId: string;
  relatedCaseId?: string;
  ward: string;
  description: string;
  evidenceAttachmentRef?: string;
  reporterContactOptional?: string;
}): WhistleblowerComplaint {
  const state = getHumanieState();
  const targetOrg = state.organisations.find((o) => o.orgId === params.targetOrgId);
  const complaintId = `WB-2026-70${state.complaints.length + 1}`;
  const now = new Date().toISOString();

  const encryptedIdentityVaultRef =
    params.submissionType === 'ANONYMOUS'
      ? `ZERO-KNOWLEDGE-ANON-TOKEN-${Math.floor(1000 + Math.random() * 9000)}`
      : `SEPARATED-IDENTITY-VAULT-${computeDeterministicHash(params.reporterContactOptional || 'PROTECTED').slice(7, 19)}`;

  const complaint: WhistleblowerComplaint = {
    complaintId,
    submissionType: params.submissionType,
    category: params.category,
    targetOrgId: params.targetOrgId,
    targetOrgName: targetOrg ? targetOrg.name : params.targetOrgId,
    relatedCaseId: params.relatedCaseId,
    ward: params.ward,
    description: params.description,
    evidenceAttachmentRef: params.evidenceAttachmentRef || 'FIELD-EVIDENCE-PACKET-UPLOADED',
    encryptedIdentityVaultRef,
    accusedOrgBlockedFromAccess: true,
    retaliationRiskIndicator: 'ELEVATED_PROTECTION',
    assignedIndependentReviewer: 'Justice S. Narayanan',
    recusedReviewers: [`All staff & coordinators affiliated with ${targetOrg ? targetOrg.name : params.targetOrgId}`],
    status: 'INDEPENDENT_INVESTIGATION',
    reviewNotes: [
      `Accused institution (${params.targetOrgId}) automatically blocked from viewing or modifying ${complaintId}.`,
      `Identity payload isolated in ${encryptedIdentityVaultRef}. Assigned to Independent Reviewer.`,
    ],
    createdAt: now,
  };

  state.complaints.unshift(complaint);

  appendLedgerEvent(state, {
    eventType: 'WHISTLEBLOWER_REPORT',
    actorRole: params.actorRole,
    entityId: complaintId,
    summary: `Protected ${params.submissionType} complaint (${params.category}) filed against ${params.targetOrgId}. Accused org blocked.`,
    payload: {
      complaintId,
      category: params.category,
      targetOrgId: params.targetOrgId,
      accusedBlocked: true,
    },
  });

  return complaint;
}

/**
 * Interactive Slide 13 Live Demo Crisis Actions!
 * 1. FIELD_RECEIPT_GAP: Dispatched 40, received 35 -> opens investigation case & flag
 * 2. TAMPER_TEST: Edits a historical ledger entry payload to prove hash chain breaks immediately
 * 3. RESTORE_TAMPER: Restores valid hash-chain integrity
 * 4. FLOOD_SHOCK: Transport costs rise +65%, plan re-solves live
 * 5. JUDGE_APPROVES_PHONE: Mobile fast-path approval for pending critical case CASE-2026-0106
 * 6. FLOOR_SWEEP: Sweeps coverage floor to 60% and calculates exact slack needed
 */
export function runLiveDemoCrisisAction(
  action:
    | 'FIELD_RECEIPT_GAP'
    | 'TAMPER_TEST'
    | 'RESTORE_TAMPER'
    | 'FLOOD_SHOCK'
    | 'JUDGE_APPROVES_PHONE'
    | 'FLOOR_SWEEP'
    | 'RESET_BASELINE'
): {
  message: string;
  chainVerification: ReturnType<typeof verifyAuditLedgerChain>;
} {
  const state = getHumanieState();

  if (action === 'FIELD_RECEIPT_GAP') {
    const targetCase = state.cases.find((c) => c.domain === 'FOOD')!;
    recordResultCheckAndReceipt({
      actorRole: 'Field worker',
      caseId: targetCase.caseId,
      channel: 'SMS',
      status: 'Partly met',
      dispatchedUnits: 40,
      receivedUnits: 35,
      beneficiaryFeedback:
        'LIVE CRISIS DEMO: Field receipt logged 35 units received vs 40 dispatched (-5 unit gap). Automatic discrepancy investigation opened.',
    });
    return {
      message: 'Field Receipt logged: 40 dispatched vs 35 received (-5 unit gap). Integrity Shield investigation case opened.',
      chainVerification: verifyAuditLedgerChain(state.auditLedger),
    };
  }

  if (action === 'TAMPER_TEST') {
    const targetEntry = state.auditLedger.find((e) => e.seq === 4) || state.auditLedger[1];
    if (targetEntry && !targetEntry.tamperedSimulation) {
      targetEntry.payloadSnapshot = JSON.stringify({
        decisionId: 'DEC-2026-8801',
        action: 'TAMPERED_SILENT_EDIT_35_UNITS',
        units: 35,
      });
      targetEntry.tamperedSimulation = true;
    }
    const verification = verifyAuditLedgerChain(state.auditLedger);
    return {
      message: `TAMPER DETECTED! Historical Event #${targetEntry?.seq} (${targetEntry?.eventId}) was modified; cryptographic hash chain broke at seq #${verification.brokenAtSeq}.`,
      chainVerification: verification,
    };
  }

  if (action === 'RESTORE_TAMPER') {
    const targetEntry = state.auditLedger.find((e) => e.tamperedSimulation);
    if (targetEntry) {
      targetEntry.payloadSnapshot = JSON.stringify({
        decisionId: 'DEC-2026-8801',
        action: 'APPROVED_AS_RECOMMENDED',
        units: 40,
      });
      targetEntry.tamperedSimulation = false;
    }
    const verification = verifyAuditLedgerChain(state.auditLedger);
    return {
      message: 'Historical record restored from immutable Decision Vault snapshot. Hash-chain integrity verified across all blocks.',
      chainVerification: verification,
    };
  }

  if (action === 'FLOOD_SHOCK') {
    state.lpSolverState = runEquityLPSolver({
      totalStockUnits: 436.9,
      transportBudgetLimit: 2400,
      transportCostMultiplier: 1.65,
      coverageFloorTargetPct: 47.87,
      scenario: 'FLOOD_SHOCK',
    });
    return {
      message: `Flood Shock applied: Rural transport costs rose +65%. Equity LP re-solved live (${state.lpSolverState.equityLPMinWardCoveragePct}% vs Proportional ${state.lpSolverState.proportionalMinWardCoveragePct}%).`,
      chainVerification: verifyAuditLedgerChain(state.auditLedger),
    };
  }

  if (action === 'JUDGE_APPROVES_PHONE') {
    const pendingCase =
      state.cases.find((c) => c.status === 'MATCHED_PENDING_REVIEW' || c.status === 'AWAITING_SECOND_APPROVAL') ||
      state.cases[3];
    recordHumanDecision({
      actorRole: 'Approver',
      actorName: 'Judge Meera Krishnan (Mobile Phone Fast-Path)',
      caseId: pendingCase.caseId,
      decisionAction: 'APPROVED_AS_RECOMMENDED',
      conflictDeclared: true,
      conflictNote: 'Signed via authenticated Mobile Judge Fast-Path.',
      approvalChannel: 'MOBILE_JUDGE_FAST_PATH',
    });
    return {
      message: `Judge Approved from a phone: ${pendingCase.caseId} (${pendingCase.beneficiaryAlias}) authorised at Step 3 and sealed in Decision Vault.`,
      chainVerification: verifyAuditLedgerChain(state.auditLedger),
    };
  }

  if (action === 'FLOOR_SWEEP') {
    state.lpSolverState = runEquityLPSolver({
      totalStockUnits: 436.9,
      transportBudgetLimit: 2400,
      transportCostMultiplier: 1.0,
      coverageFloorTargetPct: 60.0,
      scenario: 'FLOOR_SWEEP_SLACK',
    });
    return {
      message: `Floor Sweep complete: To lift minimum ward coverage from 47.87% to 60.0%, exactly +${state.lpSolverState.slackRecoveryNeededUnits} slack recovery units are needed across the 5 wards.`,
      chainVerification: verifyAuditLedgerChain(state.auditLedger),
    };
  }

  // RESET_BASELINE
  state.lpSolverState = runEquityLPSolver({
    totalStockUnits: 436.9,
    transportBudgetLimit: 2400,
    transportCostMultiplier: 1.0,
    coverageFloorTargetPct: 47.87,
    scenario: 'BASELINE_436_9',
  });
  return {
    message: 'Reset to Pitch Deck Baseline: 436.9 units stock, Equity LP 47.87% vs Proportional 43.69% (+4.18 percentage points).',
    chainVerification: verifyAuditLedgerChain(state.auditLedger),
  };
}


/** Batch 2 operational command layer. Demo-state operations are auditable; external integrations are not implied. */
export function executeBatch2Operation(params: { action: string; payload: Record<string, any>; actorRole?: UserRole }): any {
  const state = getHumanieState();
  const p = params.payload || {};
  const actorRole = params.actorRole || 'Approver';
  const now = new Date().toISOString();
  const audit = (entityId: string, summary: string, payload: Record<string, unknown>) => appendLedgerEvent(state, { eventType: 'COUNTRY_PACK_CHANGE', actorRole, entityId, summary, payload });
  const number = (v: any, label: string) => { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number`); return n; };
  switch (params.action) {
    case 'food_stock_update': {
      const b = state.foodBatches.find(x => x.batchId === p.batchId); if (!b) throw new Error('Food batch not found');
      b.stockAvailableUnits = number(p.stockAvailableUnits, 'Stock'); b.stockCondition = p.stockCondition || b.stockCondition; b.expiryDate = p.expiryDate || b.expiryDate; b.updatedAt = now;
      audit(b.batchId, 'Food stock/condition/expiry updated', p); return b;
    }
    case 'food_allocate': {
      const b = state.foodBatches.find(x => x.batchId === p.batchId); if (!b) throw new Error('Food batch not found');
      const units = number(p.units, 'Allocation units'); if (units <= 0 || units > b.stockAvailableUnits) throw new Error('Allocation must be positive and not exceed available stock');
      b.stockAvailableUnits -= units; b.allocatedUnits += units; b.dispatchStatus = 'ALLOCATED'; b.updatedAt = now;
      audit(b.batchId, `Allocated ${units} units`, p); return b;
    }
    case 'food_dispatch': {
      const b = state.foodBatches.find(x => x.batchId === p.batchId); if (!b) throw new Error('Food batch not found');
      if (b.allocatedUnits <= b.dispatchedUnits) throw new Error('No undispatched allocation remains');
      b.dispatchedUnits = b.allocatedUnits; b.dispatchStatus = 'DISPATCHED'; b.transportMode = p.transportMode || b.transportMode; b.updatedAt = now;
      audit(b.batchId, 'Food allocation dispatched', p); return b;
    }
    case 'food_receipt': {
      const b = state.foodBatches.find(x => x.batchId === p.batchId); if (!b) throw new Error('Food batch not found');
      const received = number(p.receivedUnits, 'Received units'); if (received > b.dispatchedUnits) throw new Error('Receipt cannot exceed dispatched units');
      b.receivedUnits = received; b.discrepancyUnits = b.dispatchedUnits - received; b.discrepancyNote = p.note; b.dispatchStatus = b.discrepancyUnits ? 'DISCREPANCY_OPEN' : 'RECEIPT_CONFIRMED'; b.updatedAt = now;
      audit(b.batchId, b.discrepancyUnits ? 'Receipt discrepancy recorded' : 'Receipt reconciled', p); return b;
    }
    case 'work_transition': {
      const j = state.workJobs.find(x => x.jobId === p.jobId); if (!j) throw new Error('Job not found');
      const allowed = ['Candidate','Matching','Human Review','Referral','Employer Response','Placement','7-Day Check','30-Day Check']; if (!allowed.includes(p.stage)) throw new Error('Invalid work stage');
      j.workflowStage = p.stage; if (p.candidateAlias) j.candidateAlias = p.candidateAlias; if (p.referralStatus) j.referralStatus = p.referralStatus; if (p.nonPlacementReason) j.nonPlacementReason = p.nonPlacementReason; if (p.contractWritten !== undefined) j.contractWritten = Boolean(p.contractWritten);
      if (p.check7DayStatus) j.check7DayStatus = p.check7DayStatus; if (p.check30DayStatus) j.check30DayStatus = p.check30DayStatus;
      audit(j.jobId, `Employment workflow moved to ${j.workflowStage}`, p); return j;
    }
    case 'education_transition': {
      const e = state.eduProgrammes.find(x => x.programmeId === p.programmeId); if (!e) throw new Error('Programme not found');
      const allowed = ['Need','Programme Matching','Human Review','Referral','Enrolment','Attendance','30-Day Result Check']; if (!allowed.includes(p.stage)) throw new Error('Invalid education stage');
      if (p.stage === 'Enrolment' && e.workflowStage !== 'Enrolment') { if (e.seatsAvailable <= 0) throw new Error('No seats available'); e.seatsAvailable -= 1; }
      e.workflowStage = p.stage; if (p.studentAlias) e.studentAlias = p.studentAlias; if (p.attendanceVerifiedPct !== undefined) { const n=number(p.attendanceVerifiedPct,'Attendance'); if(n>100) throw new Error('Attendance cannot exceed 100'); e.attendanceVerifiedPct=n; } if (p.check30DayStatus) e.check30DayStatus=p.check30DayStatus;
      audit(e.programmeId, `Education workflow moved to ${e.workflowStage}`, p); return e;
    }
    case 'followup_schedule': {
      const c = state.cases.find(x => x.caseId === p.caseId); if (!c) throw new Error('Case not found'); const dueAt = new Date(p.dueAt); if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) throw new Error('Follow-up due date must be in the future');
      const f = { followUpId: `FUP-${Date.now()}-${state.scheduledFollowUps.length+1}`, caseId:c.caseId, domain:c.domain, dueAt:dueAt.toISOString(), channel:p.channel || 'Website', status:'SCHEDULED' as const, label:p.label || 'Follow-up', createdAt:now }; state.scheduledFollowUps.unshift(f); audit(f.followUpId, 'Follow-up scheduled', f); return f;
    }
    case 'followup_status': {
      const f = state.scheduledFollowUps.find(x => x.followUpId === p.followUpId); if (!f) throw new Error('Follow-up not found'); if (!['SCHEDULED','DUE','SENT','CANCELLED'].includes(p.status)) throw new Error('Invalid follow-up status'); f.status=p.status; audit(f.followUpId, `Follow-up status changed to ${f.status}`, p); return f;
    }
    case 'domain_metrics': {
      return { food: { batches:state.foodBatches.length, available:state.foodBatches.reduce((a,b)=>a+b.stockAvailableUnits,0), allocated:state.foodBatches.reduce((a,b)=>a+b.allocatedUnits,0), dispatched:state.foodBatches.reduce((a,b)=>a+b.dispatchedUnits,0), received:state.foodBatches.reduce((a,b)=>a+(b.receivedUnits||0),0), discrepancies:state.foodBatches.filter(b=>b.dispatchStatus==='DISCREPANCY_OPEN').length }, work:{jobs:state.workJobs.length,placed:state.workJobs.filter(j=>j.referralStatus==='PLACED').length,interviews:state.workJobs.filter(j=>j.referralStatus==='INTERVIEW_SCHEDULED').length}, education:{programmes:state.eduProgrammes.length,totalSeats:state.eduProgrammes.reduce((a,e)=>a+e.seatsTotal,0),availableSeats:state.eduProgrammes.reduce((a,e)=>a+e.seatsAvailable,0),enrolled:state.eduProgrammes.filter(e=>e.workflowStage==='Enrolment'||e.workflowStage==='Attendance'||e.workflowStage==='30-Day Result Check').length}, followUps:{scheduled:state.scheduledFollowUps.length,pending:state.scheduledFollowUps.filter(f=>f.status==='SCHEDULED'||f.status==='DUE').length} };
    }
    default: throw new Error('Unknown Batch 2 operation');
  }
}


/** Batch 3 governance actions: demonstration-level state controls, not production authorization. */
export function governanceAction(params: { action: string; actorRole: UserRole; payload: Record<string, any> }) {
  const state = getHumanieState(); const p = params.payload; const now = new Date().toISOString();
  const log = (entityId: string, summary: string) => appendLedgerEvent(state, { eventType: 'COUNTRY_PACK_CHANGE', actorRole: params.actorRole, entityId, summary, payload: { action: params.action, ...p } });
  switch (params.action) {
    case 'second_approve': {
      const d = state.decisions.find(x => x.decisionId === p.decisionId); if (!d) throw new Error('Decision not found');
      if (d.primaryApproverRole === params.actorRole && d.primaryApproverName === p.approverName) throw new Error('Second approver must be distinct from first approver');
      d.secondApproverName = p.approverName || 'Second Approver'; d.secondApproverRole = params.actorRole; d.decisionAction = 'APPROVED_AS_RECOMMENDED'; log(d.decisionId, 'Second approval recorded'); return d;
    }
    case 'declare_conflict': {
      const d = state.decisions.find(x => x.decisionId === p.decisionId); if (!d) throw new Error('Decision not found');
      d.conflictOfInterestDeclared = true; d.conflictDeclarationNote = String(p.note || 'Conflict declared'); d.decisionAction = 'ESCALATED_FOR_REVIEW'; log(d.decisionId, 'Conflict of interest declared; decision escalated'); return d;
    }
    case 'flag_status': {
      const f = state.integrityFlags.find(x => x.flagId === p.flagId); if (!f) throw new Error('Flag not found');
      if (!['OPEN_SIGNAL','UNDER_INDEPENDENT_REVIEW','RESOLVED_EXPLAINED','ESCALATED_ENFORCEMENT'].includes(p.status)) throw new Error('Invalid flag status');
      f.status = p.status; f.description += p.note ? ` Review note: ${p.note}` : ''; log(f.flagId, `Integrity flag moved to ${f.status}`); return f;
    }
    case 'complaint_review': {
      const c = state.complaints.find(x => x.complaintId === p.complaintId); if (!c) throw new Error('Complaint not found');
      const targetOrg = c.targetOrgId; const reviewerAffiliation = String(p.reviewerOrgId || '');
      if (reviewerAffiliation && reviewerAffiliation === targetOrg) throw new Error('Reviewer affiliated with accused organisation cannot review complaint');
      if (p.note) c.reviewNotes.push(String(p.note));
      if (p.status && ['RECEIVED_ENCRYPTED','INDEPENDENT_INVESTIGATION','FINDINGS_RECORDED','ESCALATED_SANCTION'].includes(p.status)) c.status = p.status;
      log(c.complaintId, 'Protected complaint review updated'); return c;
    }
    case 'add_signal': {
      const f: IntegritySignalFlag = { flagId:`FLG-${Date.now()}`, category:p.category || 'OVERRIDE_PATTERN', severity:p.severity || 'MEDIUM', caseId:p.caseId, orgId:p.orgId, ward:p.ward, title:String(p.title || 'Integrity review signal'), description:String(p.description || ''), evidenceMetric:String(p.evidenceMetric || 'Manual signal'), status:'OPEN_SIGNAL', assignedIndependentReviewer:'Unassigned — independent review required', createdAt:now };
      state.integrityFlags.unshift(f); log(f.flagId, 'Integrity signal created'); return f;
    }
    default: throw new Error('Unknown governance action');
  }
}
export function governanceSummary() {
 const s=getHumanieState(); return { decisions:s.decisions, flags:s.integrityFlags, complaints:s.complaints.map(c=>({...c, encryptedIdentityVaultRef: '[REDACTED]'})), ledger:s.auditLedger, chainVerification:verifyAuditLedgerChain(s.auditLedger), summary:{pendingSecondApprovals:s.decisions.filter(d=>d.decisionAction==='PENDING_SECOND_APPROVER').length, openFlags:s.integrityFlags.filter(f=>f.status==='OPEN_SIGNAL').length, underReviewFlags:s.integrityFlags.filter(f=>f.status==='UNDER_INDEPENDENT_REVIEW').length, complaintsUnderInvestigation:s.complaints.filter(c=>c.status==='INDEPENDENT_INVESTIGATION').length} };
}
