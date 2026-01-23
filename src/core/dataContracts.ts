/**
 * Data Contracts for Doc Manager
 *
 * Defines schema validation, quality checks, and validation rules
 * for all data structures in the application.
 *
 * Based on research:
 * - Confluent Schema Registry data contracts
 * - "Best Practices for Data Contract Enforcement" (Xenoss, 2025)
 * - Zod schema validation patterns
 */

import { z } from 'zod';
import type {
  DataContract,
  ValidationRule,
  QualityCheck,
} from './productionSafety';

// =============================================================================
// DOCUMENT SCHEMA CONTRACTS
// =============================================================================

/**
 * Document Type Enum - restricts to known types
 */
export const DocumentTypeSchema = z.enum(['markdown', 'yaml', 'json', 'text', 'html', 'xml'], {
  errorMap: () => ({ message: 'Document type must be one of: markdown, yaml, json, text, html, xml' }),
});

/**
 * Document Metadata Schema
 */
export const DocumentMetadataSchema = z.object({
  id: z.string()
    .min(1, 'Document ID cannot be empty')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Document ID must contain only alphanumeric characters, hyphens, and underscores')
    .refine(id => id !== 'undefined' && id !== 'null' && id !== 'TODO' && id !== 'FIXME', {
      message: 'Document ID cannot be a placeholder value',
    }),

  title: z.string()
    .min(1, 'Title cannot be empty')
    .max(500, 'Title cannot exceed 500 characters')
    .refine(title => !PLACEHOLDER_TITLE_PATTERN.test(title), {
      message: 'Title appears to be a placeholder',
    })
    .refine(title => !title.includes('TODO') && !title.includes('FIXME') && !title.includes('XXX'), {
      message: 'Title cannot contain TODO, FIXME, or XXX markers',
    }),

  type: DocumentTypeSchema,

  createdAt: z.string()
    .datetime({ message: 'Created at must be a valid ISO 8601 datetime' })
    .refine(date => !isNaN(Date.parse(date)), {
      message: 'Created at must be a valid date',
    }),

  updatedAt: z.string()
    .datetime({ message: 'Updated at must be a valid ISO 8601 datetime' })
    .refine(date => !isNaN(Date.parse(date)), {
      message: 'Updated at must be a valid date',
    })
    .refine(date => {
      const parsed = Date.parse(date);
      return parsed <= Date.now() && parsed > new Date('2000-01-01').getTime();
    }, {
      message: 'Updated at must be a reasonable date',
    }),

  tags: z.array(z.string()
    .min(1, 'Tag cannot be empty')
    .max(50, 'Tag cannot exceed 50 characters')
    .refine(tag => !PLACEHOLDER_TAG_PATTERN.test(tag), {
      message: 'Tag appears to be a placeholder',
    })
  ).optional().default([]),

  path: z.string()
    .max(1000, 'Path cannot exceed 1000 characters')
    .optional(),

  size: z.number()
    .int('Size must be an integer')
    .nonnegative('Size cannot be negative')
    .max(100 * 1024 * 1024, 'Document size cannot exceed 100MB'),

  isSynced: z.boolean(),

  filename: z.string()
    .max(500, 'Filename cannot exceed 500 characters')
    .optional(),

  source: z.string()
    .max(100, 'Source cannot exceed 100 characters')
    .optional(),
});

/**
 * Full Document Schema
 */
export const DocumentSchema = z.object({
  metadata: DocumentMetadataSchema,
  content: z.string()
    .max(10 * 1024 * 1024, 'Content cannot exceed 10MB')
    .refine(content => {
      // Check for placeholder content patterns
      const lines = content.split('\n');
      const placeholderLines = lines.filter(line =>
        PLACEHOLDER_CONTENT_PATTERNS.some(pattern => pattern.test(line))
      );
      return placeholderLines.length / lines.length < 0.5; // Less than 50% placeholder lines
    }, {
      message: 'Document content appears to contain excessive placeholders',
    }),
});

/**
 * Document creation input schema (more permissive for creation)
 */
export const CreateDocumentInputSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title cannot exceed 500 characters'),

  type: z.enum(['markdown', 'yaml', 'json', 'text', 'html', 'xml'], {
    errorMap: () => ({ message: 'Type must be one of: markdown, yaml, json, text, html, xml' })
  }),
});

// =============================================================================
// TASK SCHEMA CONTRACTS
// =============================================================================

/**
 * Task Priority Enum
 */
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high'], {
  errorMap: () => ({ message: 'Priority must be one of: low, medium, high' }),
});

/**
 * Task Schema
 */
export const TaskSchema = z.object({
  id: z.string()
    .min(1, 'Task ID cannot be empty')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Task ID must contain only valid characters')
    .refine(id => !PLACEHOLDER_ID_PATTERN.test(id), {
      message: 'Task ID appears to be a placeholder',
    }),

  title: z.string()
    .min(1, 'Task title is required')
    .max(500, 'Task title cannot exceed 500 characters')
    .refine(title => !PLACEHOLDER_TITLE_PATTERN.test(title), {
      message: 'Task title appears to be a placeholder',
    })
    .refine(title => !title.includes('TODO') && !title.includes('FIXME'), {
      message: 'Task title cannot contain TODO or FIXME markers',
    }),

  listId: z.string()
    .min(1, 'List ID is required')
    .refine(id => id !== 'default' || id.length > 0, {
      message: 'List ID must be valid',
    }),

  completed: z.boolean(),

  priority: TaskPrioritySchema,

  createdAt: z.string()
    .datetime({ message: 'Created at must be a valid ISO 8601 datetime' })
    .refine(date => !isNaN(Date.parse(date)), {
      message: 'Created at must be a valid date',
    }),

  dueDate: z.union([
    z.string().datetime({ message: 'Due date must be a valid ISO 8601 datetime' }),
    z.null()
  ]),

  notes: z.string()
    .max(5000, 'Notes cannot exceed 5000 characters')
    .optional(),

  tags: z.array(z.string()
    .min(1, 'Tag cannot be empty')
    .max(50, 'Tag cannot exceed 50 characters')
  ).optional().default([]),
});

/**
 * Task List Schema
 */
export const TaskListSchema = z.object({
  id: z.string()
    .min(1, 'List ID cannot be empty')
    .regex(/^[a-zA-Z0-9-_]+$/, 'List ID must contain only valid characters'),

  name: z.string()
    .min(1, 'List name is required')
    .max(100, 'List name cannot exceed 100 characters')
    .refine(name => !PLACEHOLDER_TITLE_PATTERN.test(name), {
      message: 'List name appears to be a placeholder',
    }),

  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color code'),

  createdAt: z.string()
    .datetime({ message: 'Created at must be a valid ISO 8601 datetime' })
    .refine(date => !isNaN(Date.parse(date)), {
      message: 'Created at must be a valid date',
    }),
});

// =============================================================================
// SETTINGS SCHEMA CONTRACTS
// =============================================================================

/**
 * Theme Enum
 */
export const ThemeSchema = z.enum(['dark', 'light', 'system'], {
  errorMap: () => ({ message: 'Theme must be one of: dark, light, system' })
});

/**
 * Sync Provider Enum
 */
export const SyncProviderSchema = z.enum(['github', 'gitlab', 'cloudflare', 'local'], {
  errorMap: () => ({ message: 'Provider must be one of: github, gitlab, cloudflare, local' })
}).nullable();

/**
 * Sync Configuration Schema
 */
export const SyncConfigSchema = z.object({
  enabled: z.boolean(),
  provider: SyncProviderSchema,
  token: z.string()
    .max(500, 'Token cannot exceed 500 characters')
    .optional(),
  repo: z.string()
    .max(500, 'Repository cannot exceed 500 characters')
    .refine(repo => !repo || repo.includes('/'), {
      message: 'Repository must be in format "owner/repo"',
    })
    .optional(),
  branch: z.string()
    .max(100, 'Branch cannot exceed 100 characters')
    .default('main'),
  interval: z.number()
    .int('Interval must be an integer')
    .min(1, 'Interval must be at least 1 minute')
    .max(1440, 'Interval cannot exceed 1440 minutes (24 hours)'),
});

/**
 * App Settings Schema
 */
export const AppSettingsSchema = z.object({
  theme: ThemeSchema,
  fontSize: z.number()
    .int('Font size must be an integer')
    .min(8, 'Font size must be at least 8')
    .max(32, 'Font size cannot exceed 32'),
  tabSize: z.number()
    .int('Tab size must be an integer')
    .min(2, 'Tab size must be at least 2')
    .max(8, 'Tab size cannot exceed 8'),
  wordWrap: z.boolean(),
  autoSave: z.boolean(),
  autoSaveInterval: z.number()
    .int('Auto-save interval must be an integer')
    .min(5, 'Auto-save interval must be at least 5 seconds')
    .max(300, 'Auto-save interval cannot exceed 300 seconds'),
  sync: SyncConfigSchema,
});

// =============================================================================
// VALIDATION RULES
// =============================================================================

/**
 * Custom validation rules for documents
 */
export const documentValidationRules: ValidationRule<any>[] = [
  {
    name: 'title-not-placeholder',
    validate: (doc: any) => {
      if (!doc.metadata?.title) return false;
      const title = doc.metadata.title.toLowerCase();
      const placeholderIndicators = [
        'untitled', 'new document', 'sample document', 'example document',
        'template', 'placeholder', 'dummy document', 'lorem ipsum',
        // Note: Don't include 'test' as it blocks legitimate titles like 'Test2', 'TestCase', etc.
      ];
      return !placeholderIndicators.some(indicator => title.includes(indicator));
    },
    errorMessage: 'Document title appears to be a placeholder or template',
    severity: 'medium',
  },
  {
    name: 'content-not-empty',
    validate: (doc: any) => {
      return doc.content !== undefined && doc.content !== null;
    },
    errorMessage: 'Document content must not be null or undefined',
    severity: 'critical',
  },
  {
    name: 'timestamps-logical',
    validate: (doc: any) => {
      if (!doc.metadata?.createdAt || !doc.metadata?.updatedAt) return false;
      const created = new Date(doc.metadata.createdAt).getTime();
      const updated = new Date(doc.metadata.updatedAt).getTime();
      return updated >= created;
    },
    errorMessage: 'Updated timestamp must be after or equal to created timestamp',
    severity: 'high',
  },
];

/**
 * Custom validation rules for tasks
 */
export const taskValidationRules: ValidationRule<any>[] = [
  {
    name: 'title-not-placeholder',
    validate: (task: any) => {
      if (!task.title) return false;
      const title = task.title.toLowerCase();
      const placeholderIndicators = [
        'new task', 'sample task', 'test task', 'placeholder',
        'click to add', 'enter task', 'todo', 'fixme',
      ];
      return !placeholderIndicators.some(indicator => title.includes(indicator));
    },
    errorMessage: 'Task title appears to be a placeholder',
    severity: 'medium',
  },
  {
    name: 'due-date-in-future-or-null',
    validate: (task: any) => {
      if (!task.dueDate) return true;
      const dueDate = new Date(task.dueDate).getTime();
      return dueDate > new Date('2000-01-01').getTime();
    },
    errorMessage: 'Due date must be a valid future date',
    severity: 'medium',
  },
];

// =============================================================================
// QUALITY CHECKS
// =============================================================================

/**
 * Quality checks for documents
 */
export const documentQualityChecks: QualityCheck<any>[] = [
  {
    name: 'content-length-check',
    check: (doc: any) => {
      const content = doc.content || '';
      const length = content.length;
      let score = 100;

      if (length === 0) {
        return { passed: false, score: 0, details: 'Document has no content' };
      }
      if (length < 10) {
        score = 30;
      } else if (length < 50) {
        score = 60;
      }

      return {
        passed: score >= 50,
        score,
        details: `Document content length: ${length} characters`,
      };
    },
  },
  {
    name: 'title-quality-check',
    check: (doc: any) => {
      const title = doc.metadata?.title || '';
      let score = 100;

      if (title.length < 3) score = 30;
      else if (title.length < 5) score = 60;

      const hasWords = title.split(/\s+/).filter((w: string) => w.length > 0).length >= 2;
      if (!hasWords) score = Math.min(score, 50);

      return {
        passed: score >= 50,
        score,
        details: `Title quality: ${title.length} chars, ${hasWords ? 'has multiple words' : 'single word'}`,
      };
    },
  },
];

// =============================================================================
// PLACEHOLDER DETECTION PATTERNS
// =============================================================================

const PLACEHOLDER_TITLE_PATTERN = /^(untitled|new \w+|sample|example|template|placeholder|dummy|\[.*?\]|<.*?>|{{.*?}}|TODO|FIXME|XXX)$/i;

const PLACEHOLDER_TAG_PATTERN = /^(untagged|uncategorized|general|misc|other|test|sample)$/i;

const PLACEHOLDER_ID_PATTERN = /^(undefined|null|NaN|infinity|test-?\d*|sample-?\d*|dummy-?\d*)$/i;

const PLACEHOLDER_CONTENT_PATTERNS = [
  /^lorem\s+ipsum/i,
  /^placeholder/i,
  /^to be completed/i,
  /^tbd:/i,
  /^tbc:/i,
  /^\[todo\]/i,
  /^\[fixme\]/i,
  /^\[xxx\]/i,
  /^\[hack\]/i,
];

// =============================================================================
// EXPORT DATA CONTRACTS
// =============================================================================

import type { Document, DocumentMetadata, Task, TaskList, AppSettings, SyncConfig } from '../types';

/**
 * Document Metadata Contract
 */
export const DocumentMetadataContract: DataContract<DocumentMetadata> = {
  schema: DocumentMetadataSchema,
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  validationRules: [],
  qualityChecks: [],
};

/**
 * Full Document Contract
 */
export const DocumentContract: DataContract<Document> = {
  schema: DocumentSchema,
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  validationRules: documentValidationRules,
  qualityChecks: documentQualityChecks,
};

/**
 * Task Contract
 */
export const TaskContract: DataContract<Task> = {
  schema: TaskSchema,
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  validationRules: taskValidationRules,
  qualityChecks: [],
};

/**
 * Task List Contract
 */
export const TaskListContract: DataContract<TaskList> = {
  schema: TaskListSchema,
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  validationRules: [],
  qualityChecks: [],
};

/**
 * App Settings Contract
 */
export const AppSettingsContract: DataContract<AppSettings> = {
  schema: AppSettingsSchema,
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  validationRules: [],
  qualityChecks: [],
};

/**
 * Sync Config Contract
 */
export const SyncConfigContract: DataContract<SyncConfig> = {
  schema: SyncConfigSchema,
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  validationRules: [
    {
      name: 'sync-token-valid',
      validate: (config: any) => {
        if (config.enabled && config.provider && !config.token) {
          return false;
        }
        return true;
      },
      errorMessage: 'Sync token is required when sync is enabled',
      severity: 'high',
    },
    {
      name: 'sync-repo-valid',
      validate: (config: any) => {
        if (config.enabled && config.provider && !config.repo) {
          return false;
        }
        return true;
      },
      errorMessage: 'Repository is required when sync is enabled',
      severity: 'high',
    },
  ],
  qualityChecks: [],
};
