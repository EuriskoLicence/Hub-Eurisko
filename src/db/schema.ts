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

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'invoice',
  'credit_note',
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
  id:                  uuid('id').primaryKey().defaultRandom(),
  name:                text('name').notNull(),
  code:                text('code').notNull().unique(),  // codice sequenziale 4 cifre
  notes:               text('notes'),
  active:              boolean('active').notNull().default(true),
  // Anagrafica estesa
  paese:               text('paese'),
  indirizzo:           text('indirizzo'),
  localita:            text('localita'),
  provincia:           text('provincia'),
  cap:                 text('cap'),
  partitaIva:          text('partita_iva'),
  codiceDestinatario:  text('codice_destinatario'),
  pec:                 text('pec'),
  telefono:            text('telefono'),
  email:               text('email'),
  terminiPagamento:    text('termini_pagamento'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  noOda:       boolean('no_oda').notNull().default(false),  // se true, le commesse di questo tipo non vanno in OdA
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Stati commessa (parametrico, gestito da admin)
export const engagementStatuses = pgTable('engagement_statuses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  code:        text('code').notNull().unique(),         // 3 caratteri alfanumerici
  description: text('description').notNull(),
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
  conclusa:         boolean('conclusa').notNull().default(false),
  statusId:         uuid('status_id').references(() => engagementStatuses.id), // facoltativo
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
    extraOnly:    boolean('extra_only').notNull().default(false),
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

// ─── Ordini di Acquisto (OdA) ────────────────────────────────────────────────

// Stati posizione OdA (parametrico, gestito da admin)
export const purchaseOrderLineStatuses = pgTable('purchase_order_line_statuses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  code:        text('code').notNull().unique(),         // 3 caratteri alfanumerici
  description: text('description').notNull(),
  active:      boolean('active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Testata OdA
export const purchaseOrders = pgTable('purchase_orders', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  code:               text('code').notNull().unique(),     // 6 cifre globali progressivi
  date:               date('date').notNull(),
  number:             text('number').notNull(),            // numero esterno (cliente)
  clientId:           uuid('client_id').notNull().references(() => clients.id),
  totalAmount:        numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  responsibleUserId:  uuid('responsible_user_id').notNull().references(() => users.id),
  notes:              text('notes'),
  needsReview:        boolean('needs_review').notNull().default(false), // flag "da rivedere"
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Allegati OdA (1+ obbligatori)
export const purchaseOrderAttachments = pgTable('purchase_order_attachments', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId:    uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  attachmentKey:      text('attachment_key').notNull(),
  attachmentFilename: text('attachment_filename').notNull(),
  uploadedAt:         timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
})

// Posizioni OdA
export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id:                uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId:   uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  code:              text('code').notNull(),               // 3 cifre progressive per OdA
  externalReference: text('external_reference'),           // riferimento posizione OdA (esterno)
  description:       text('description').notNull(),
  amount:            numeric('amount', { precision: 12, scale: 2 }).notNull(),
  engagementId:      uuid('engagement_id').notNull().references(() => engagements.id),
  statusId:          uuid('status_id').references(() => purchaseOrderLineStatuses.id), // facoltativo
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqOdaCode: unique().on(t.purchaseOrderId, t.code),
}))

// ─── Fatturazione (invoices) ─────────────────────────────────────────────────

// Testata fattura / nota credito
export const invoices = pgTable('invoices', {
  id:             uuid('id').primaryKey().defaultRandom(),
  clientId:       uuid('client_id').notNull().references(() => clients.id),
  documentDate:   date('document_date').notNull(),
  documentNumber: text('document_number').notNull(),
  type:           invoiceTypeEnum('type').notNull().default('invoice'),
  currency:       text('currency').notNull().default('EUR'),
  totalAmount:    numeric('total_amount', { precision: 12, scale: 2 }).notNull(), // Totale Documento (IVA inclusa)
  vatAmount:      numeric('vat_amount',   { precision: 12, scale: 2 }).notNull(), // può essere 0 (esente)
  headerText:     text('header_text'),  // note libere di testata
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Allegati fattura (facoltativi, N per documento)
export const invoiceAttachments = pgTable('invoice_attachments', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  invoiceId:          uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  attachmentKey:      text('attachment_key').notNull(),
  attachmentFilename: text('attachment_filename').notNull(),
  uploadedAt:         timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
})

// Posizioni fattura (importi IVA esclusa)
// Quadratura: sum(amount) = invoices.totalAmount - invoices.vatAmount
export const invoiceLines = pgTable('invoice_lines', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  invoiceId:             uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  lineNumber:            integer('line_number').notNull(),  // progressivo da 1 per fattura, server-side
  isOdaRelated:          boolean('is_oda_related').notNull().default(true),
  isTravelReimbursement: boolean('is_travel_reimbursement').notNull().default(false),
  description:           text('description').notNull(),
  amount:                numeric('amount', { precision: 12, scale: 2 }).notNull(),
  purchaseOrderLineId:   uuid('purchase_order_line_id').references(() => purchaseOrderLines.id), // obbligatorio se isOdaRelated
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqInvoiceLine: unique().on(t.invoiceId, t.lineNumber),
}))

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
  status:          one(engagementStatuses, { fields: [engagements.statusId], references: [engagementStatuses.id] }),
  engagementUsers: many(engagementUsers),
  timesheetEntries: many(timesheetEntries),
  expenseLines:    many(expenseLines),
  purchaseOrderLines: many(purchaseOrderLines),
}))

export const engagementStatusesRelations = relations(engagementStatuses, ({ many }) => ({
  engagements: many(engagements),
}))

export const purchaseOrderLineStatusesRelations = relations(purchaseOrderLineStatuses, ({ many }) => ({
  purchaseOrderLines: many(purchaseOrderLines),
}))

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  client:       one(clients, { fields: [purchaseOrders.clientId],          references: [clients.id] }),
  responsible:  one(users,   { fields: [purchaseOrders.responsibleUserId], references: [users.id] }),
  attachments:  many(purchaseOrderAttachments),
  lines:        many(purchaseOrderLines),
}))

export const purchaseOrderAttachmentsRelations = relations(purchaseOrderAttachments, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, { fields: [purchaseOrderAttachments.purchaseOrderId], references: [purchaseOrders.id] }),
}))

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders,             { fields: [purchaseOrderLines.purchaseOrderId], references: [purchaseOrders.id] }),
  engagement:    one(engagements,                { fields: [purchaseOrderLines.engagementId],    references: [engagements.id] }),
  status:        one(purchaseOrderLineStatuses,  { fields: [purchaseOrderLines.statusId],        references: [purchaseOrderLineStatuses.id] }),
  invoiceLines:  many(invoiceLines),
}))

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client:      one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  attachments: many(invoiceAttachments),
  lines:       many(invoiceLines),
}))

export const invoiceAttachmentsRelations = relations(invoiceAttachments, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceAttachments.invoiceId], references: [invoices.id] }),
}))

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice:           one(invoices,           { fields: [invoiceLines.invoiceId],           references: [invoices.id] }),
  purchaseOrderLine: one(purchaseOrderLines, { fields: [invoiceLines.purchaseOrderLineId], references: [purchaseOrderLines.id] }),
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
