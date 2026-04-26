import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  timestamp,
  date,
  numeric,
  uuid,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const timesheetStatusEnum = pgEnum('timesheet_status', [
  'draft',
  'approved',
  'amendment_requested',
  'amendment_rejected',
])

export const expenseStatusEnum = pgEnum('expense_status', [
  'draft',
  'approved',
  'amendment_requested',
  'amendment_rejected',
])

// ─── Autorizzazione: Sezioni, Profili, Ruoli ─────────────────────────────────

export const sections = pgTable('sections', {
  code:        text('code').primaryKey(),
  label:       text('label').notNull(),
  description: text('description').notNull(),
  sortOrder:   integer('sort_order').notNull().default(0),
})

export const profiles = pgTable('profiles', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull().unique(),
  description: text('description'),
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const profileSections = pgTable(
  'profile_sections',
  {
    profileId:   uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    sectionCode: text('section_code').notNull().references(() => sections.code, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.profileId, t.sectionCode] }),
  }),
)

export const roles = pgTable('roles', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull().unique(),
  description: text('description'),
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const roleProfiles = pgTable(
  'role_profiles',
  {
    roleId:    uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.profileId] }),
  }),
)

// ─── Utenti ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  firstName:          text('first_name').notNull(),
  lastName:           text('last_name').notNull(),
  email:              text('email').notNull().unique(),
  passwordHash:       text('password_hash').notNull(),
  roleId:             uuid('role_id').notNull().references(() => roles.id),
  active:             boolean('active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  tempPassword:       text('temp_password'),
  tariffaKm:              numeric('tariffa_km', { precision: 6, scale: 4 }), // tariffa rimborso km (facoltativa)
  excludeFromTimesheet:   boolean('exclude_from_timesheet').notNull().default(false),
  partTime:               boolean('part_time').notNull().default(false),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Anagrafica clienti / progetti / commesse ─────────────────────────────────

export const clients = pgTable('clients', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  code:      text('code').notNull().unique(),  // codice sequenziale 4 cifre
  notes:     text('notes'),
  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const projects = pgTable('projects', {
  id:                uuid('id').primaryKey().defaultRandom(),
  clientId:          uuid('client_id').notNull().references(() => clients.id),
  name:              text('name').notNull(),
  code:              text('code').notNull(), // codice sequenziale 4 cifre, univoco per cliente
  responsibleUserId: uuid('responsible_user_id').notNull().references(() => users.id),
  notes:             text('notes'),
  active:            boolean('active').notNull().default(true),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqClientCode: unique().on(t.clientId, t.code),
}))

export const engagementTypes = pgTable('engagement_types', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull().unique(), // es. "Chiavi in mano"
  description: text('description'),
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const engagements = pgTable('engagements', {
  id:               uuid('id').primaryKey().defaultRandom(),
  projectId:        uuid('project_id').notNull().references(() => projects.id),
  engagementTypeId: uuid('engagement_type_id').notNull().references(() => engagementTypes.id),
  name:             text('name').notNull(),
  code:             text('code').notNull(), // codice sequenziale 4 cifre, univoco per progetto
  notes:            text('notes'),
  totalHours:       integer('total_hours').notNull().default(999999),
  validUntil:       date('valid_until').notNull().default('2999-12-31'),
  active:           boolean('active').notNull().default(true),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqProjectCode: unique().on(t.projectId, t.code),
}))

export const engagementUsers = pgTable(
  'engagement_users',
  {
    engagementId: uuid('engagement_id').notNull().references(() => engagements.id, { onDelete: 'cascade' }),
    userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.engagementId, t.userId] }),
  }),
)

// ─── Calendario ───────────────────────────────────────────────────────────────

export const italianHolidays = pgTable('italian_holidays', {
  id:          uuid('id').primaryKey().defaultRandom(),
  date:        date('date').notNull().unique(),
  name:        text('name').notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
})

// ─── Consuntivazione ─────────────────────────────────────────────────────────

export const absenceTypes = pgTable('absence_types', {
  id:           uuid('id').primaryKey().defaultRandom(),
  shortCode:    text('short_code').unique(),  // codifica 2 caratteri alfanumerici, es. "FE"
  label:        text('label').notNull(),
  active:       boolean('active').notNull().default(true),
  partTimeOnly: boolean('part_time_only').notNull().default(false),
})

export const timesheetEntries = pgTable('timesheet_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id),
  year:          integer('year').notNull(),
  month:         integer('month').notNull(),
  day:           integer('day').notNull(),
  engagementId:  uuid('engagement_id').references(() => engagements.id),   // nullable
  absenceTypeId: uuid('absence_type_id').references(() => absenceTypes.id), // nullable
  hours:         integer('hours').notNull(), // intero, min 1 max 24
  notes:         text('notes'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // CONSTRAINT: esattamente uno tra engagement_id e absence_type_id non null — enforced in app layer
  // CONSTRAINT: somma ore per (user_id, year, month, day) <= 24 — enforced in app layer
})

export const timesheetMonths = pgTable(
  'timesheet_months',
  {
    id:                      uuid('id').primaryKey().defaultRandom(),
    userId:                  uuid('user_id').notNull().references(() => users.id),
    year:                    integer('year').notNull(),
    month:                   integer('month').notNull(),
    status:                  timesheetStatusEnum('status').notNull().default('draft'),
    approvedAt:              timestamp('approved_at', { withTimezone: true }),
    amendmentRequestedAt:    timestamp('amendment_requested_at', { withTimezone: true }),
    amendmentReason:         text('amendment_reason'),
    amendmentReviewedBy:     uuid('amendment_reviewed_by').references(() => users.id),
    amendmentReviewedAt:     timestamp('amendment_reviewed_at', { withTimezone: true }),
    amendmentRejectionReason: text('amendment_rejection_reason'),
    createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userYearMonthUniq: unique().on(t.userId, t.year, t.month),
  }),
)

// ─── Consuntivazione extra ───────────────────────────────────────────────────

export const timesheetExtraEntries = pgTable('timesheet_extra_entries', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id),
  year:         integer('year').notNull(),
  month:        integer('month').notNull(),
  day:          integer('day').notNull(),
  engagementId: uuid('engagement_id').references(() => engagements.id),
  hours:        integer('hours').notNull(),
  notes:        text('notes'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const timesheetExtraMonths = pgTable(
  'timesheet_extra_months',
  {
    id:                       uuid('id').primaryKey().defaultRandom(),
    userId:                   uuid('user_id').notNull().references(() => users.id),
    year:                     integer('year').notNull(),
    month:                    integer('month').notNull(),
    status:                   timesheetStatusEnum('status').notNull().default('draft'),
    approvedAt:               timestamp('approved_at', { withTimezone: true }),
    amendmentRequestedAt:     timestamp('amendment_requested_at', { withTimezone: true }),
    amendmentReason:          text('amendment_reason'),
    amendmentReviewedBy:      uuid('amendment_reviewed_by').references(() => users.id),
    amendmentReviewedAt:      timestamp('amendment_reviewed_at', { withTimezone: true }),
    amendmentRejectionReason: text('amendment_rejection_reason'),
    createdAt:                timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userYearMonthUniq: unique().on(t.userId, t.year, t.month),
  }),
)

// ─── Nota spese ───────────────────────────────────────────────────────────────

export const expenseCategories = pgTable('expense_categories', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  code:               text('code').notNull().unique(),
  label:              text('label').notNull(),
  requiresAttachment: boolean('requires_attachment').notNull().default(true),
  isKmBased:          boolean('is_km_based').notNull().default(false),
  active:             boolean('active').notNull().default(true),
})

export const expenseReports = pgTable('expense_reports', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  userId:                  uuid('user_id').notNull().references(() => users.id),
  year:                    integer('year').notNull(),
  month:                   integer('month').notNull(),
  title:                   text('title').notNull(),
  totalAmount:             numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  currency:                text('currency').notNull().default('EUR'),
  status:                  expenseStatusEnum('status').notNull().default('draft'),
  tariffaKm:               numeric('tariffa_km', { precision: 6, scale: 4 }),  // tariffa €/km al momento dell'invio
  approvedAt:              timestamp('approved_at', { withTimezone: true }),
  amendmentRequestedAt:    timestamp('amendment_requested_at', { withTimezone: true }),
  amendmentReason:         text('amendment_reason'),
  amendmentReviewedBy:     uuid('amendment_reviewed_by').references(() => users.id),
  amendmentReviewedAt:     timestamp('amendment_reviewed_at', { withTimezone: true }),
  amendmentRejectionReason: text('amendment_rejection_reason'),
  createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const expenseLines = pgTable('expense_lines', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  reportId:           uuid('report_id').notNull().references(() => expenseReports.id, { onDelete: 'cascade' }),
  categoryId:         uuid('category_id').notNull().references(() => expenseCategories.id),
  engagementId:       uuid('engagement_id').references(() => engagements.id),
  date:               date('date').notNull(),
  description:        text('description').notNull(),
  amount:             numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency:           text('currency').notNull().default('EUR'),
  exchangeRate:       numeric('exchange_rate', { precision: 10, scale: 6 }).notNull().default('1'),
  amountEur:          numeric('amount_eur', { precision: 10, scale: 2 }).notNull(), // amount * exchange_rate
  kmDistance:         numeric('km_distance', { precision: 7, scale: 2 }),           // nullable, solo se is_km_based
  tariffaKm:          numeric('tariffa_km',  { precision: 6, scale: 4 }),           // tariffa €/km usata al momento del salvataggio
  attachmentKey:      text('attachment_key'),
  attachmentFilename: text('attachment_filename'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const sectionsRelations = relations(sections, ({ many }) => ({
  profileSections: many(profileSections),
}))

export const profilesRelations = relations(profiles, ({ many }) => ({
  profileSections: many(profileSections),
  roleProfiles:    many(roleProfiles),
}))

export const profileSectionsRelations = relations(profileSections, ({ one }) => ({
  profile: one(profiles, { fields: [profileSections.profileId], references: [profiles.id] }),
  section: one(sections, { fields: [profileSections.sectionCode], references: [sections.code] }),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  roleProfiles: many(roleProfiles),
  users:        many(users),
}))

export const roleProfilesRelations = relations(roleProfiles, ({ one }) => ({
  role:    one(roles,    { fields: [roleProfiles.roleId],    references: [roles.id] }),
  profile: one(profiles, { fields: [roleProfiles.profileId], references: [profiles.id] }),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  role:                    one(roles, { fields: [users.roleId], references: [roles.id] }),
  timesheetEntries:        many(timesheetEntries),
  timesheetMonths:         many(timesheetMonths),
  expenseReports:          many(expenseReports),
  engagementUsers:         many(engagementUsers),
  responsibleForProjects:  many(projects),
}))

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client:          one(clients, { fields: [projects.clientId], references: [clients.id] }),
  responsible:     one(users,   { fields: [projects.responsibleUserId], references: [users.id] }),
  engagements:     many(engagements),
}))

export const engagementTypesRelations = relations(engagementTypes, ({ many }) => ({
  engagements: many(engagements),
}))

export const engagementsRelations = relations(engagements, ({ one, many }) => ({
  project:        one(projects,       { fields: [engagements.projectId],        references: [projects.id] }),
  engagementType: one(engagementTypes, { fields: [engagements.engagementTypeId], references: [engagementTypes.id] }),
  engagementUsers: many(engagementUsers),
  timesheetEntries: many(timesheetEntries),
  expenseLines:    many(expenseLines),
}))

export const engagementUsersRelations = relations(engagementUsers, ({ one }) => ({
  engagement: one(engagements, { fields: [engagementUsers.engagementId], references: [engagements.id] }),
  user:       one(users,       { fields: [engagementUsers.userId],       references: [users.id] }),
}))

export const absenceTypesRelations = relations(absenceTypes, ({ many }) => ({
  timesheetEntries: many(timesheetEntries),
}))

export const timesheetEntriesRelations = relations(timesheetEntries, ({ one }) => ({
  user:        one(users,        { fields: [timesheetEntries.userId],        references: [users.id] }),
  engagement:  one(engagements,  { fields: [timesheetEntries.engagementId],  references: [engagements.id] }),
  absenceType: one(absenceTypes, { fields: [timesheetEntries.absenceTypeId], references: [absenceTypes.id] }),
}))

export const timesheetMonthsRelations = relations(timesheetMonths, ({ one }) => ({
  user:     one(users, { fields: [timesheetMonths.userId],              references: [users.id] }),
  reviewer: one(users, { fields: [timesheetMonths.amendmentReviewedBy], references: [users.id] }),
}))

export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenseLines: many(expenseLines),
}))

export const expenseReportsRelations = relations(expenseReports, ({ one, many }) => ({
  user:         one(users, { fields: [expenseReports.userId],              references: [users.id] }),
  reviewer:     one(users, { fields: [expenseReports.amendmentReviewedBy], references: [users.id] }),
  expenseLines: many(expenseLines),
}))

export const expenseLinesRelations = relations(expenseLines, ({ one }) => ({
  report:      one(expenseReports,    { fields: [expenseLines.reportId],      references: [expenseReports.id] }),
  category:    one(expenseCategories, { fields: [expenseLines.categoryId],    references: [expenseCategories.id] }),
  engagement:  one(engagements,       { fields: [expenseLines.engagementId],  references: [engagements.id] }),
}))
