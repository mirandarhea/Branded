import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL } from "./schema";

/**
 * Database connection singleton for the Branded platform.
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 */

/**
 * Resolve the database file path at call time (not module load time).
 * This ensures process.env.DATA_DIR is set by serve.js before we need it,
 * even if the db module is loaded early during SSR bundle initialization.
 */
function resolveDbPath(): string {
  const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
  return path.join(dataDir, "branded.db");
}

let _db: Database.Database | null = null;

/**
 * Get the database connection (singleton). Creates it on first call.
 * The DB path is resolved lazily so serve.js has time to set DATA_DIR.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  const dataDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

/**
 * Initialize the database schema. Runs all CREATE TABLE statements.
 * Safe to call multiple times — uses IF NOT EXISTS.
 * Also runs column migrations for existing tables.
 */
export function initSchema(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);

  // Run column migrations (ignore errors if columns already exist)
  const migrations = [
    "ALTER TABLE businesses ADD COLUMN custom_domain TEXT",
    "ALTER TABLE businesses ADD COLUMN custom_domain_verified INTEGER DEFAULT 0",
    "ALTER TABLE businesses ADD COLUMN custom_domain_verification_token TEXT",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ---------------------------------------------------------------------------
// Business CRUD
// ---------------------------------------------------------------------------

export interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  subscription_tier: string;
  ai_assistant_enabled: number;
  custom_domain: string | null;
  custom_domain_verified: number;
  custom_domain_verification_token: string | null;
  created_at: string;
}

export interface BusinessInput {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  subscription_tier?: string;
  ai_assistant_enabled?: number;
}

export function createBusiness(input: BusinessInput): Business {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO businesses (id, name, slug, logo_url, primary_color, secondary_color, subscription_tier, ai_assistant_enabled)
    VALUES (@id, @name, @slug, @logo_url, @primary_color, @secondary_color, @subscription_tier, @ai_assistant_enabled)
  `);
  stmt.run({
    id: input.id,
    name: input.name,
    slug: input.slug,
    logo_url: input.logo_url ?? null,
    primary_color: input.primary_color ?? "#4f46e5",
    secondary_color: input.secondary_color ?? "#7c3aed",
    subscription_tier: input.subscription_tier ?? "starter",
    ai_assistant_enabled: input.ai_assistant_enabled ?? 0,
  });
  return getBusiness(input.id)!;
}

export function getBusiness(id: string): Business | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM businesses WHERE id = ?");
  return stmt.get(id) as Business | undefined;
}

export function getBusinessBySlug(slug: string): Business | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM businesses WHERE slug = ?");
  return stmt.get(slug) as Business | undefined;
}

export function updateBusiness(id: string, updates: Partial<BusinessInput>): Business | undefined {
  const db = getDb();
  const existing = getBusiness(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...updates };
  const stmt = db.prepare(`
    UPDATE businesses SET name = @name, slug = @slug, logo_url = @logo_url,
      primary_color = @primary_color, secondary_color = @secondary_color,
      subscription_tier = @subscription_tier, ai_assistant_enabled = @ai_assistant_enabled
    WHERE id = @id
  `);
  stmt.run(merged);
  return getBusiness(id);
}

export function deleteBusiness(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM businesses WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

export function listBusinesses(): Business[] {
  const db = getDb();
  return db.prepare("SELECT * FROM businesses ORDER BY created_at DESC").all() as Business[];
}

export function getBusinessByDomain(domain: string): Business | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM businesses WHERE custom_domain = ? AND custom_domain_verified = 1")
    .get(domain) as Business | undefined;
}

// ---------------------------------------------------------------------------
// Page CRUD
// ---------------------------------------------------------------------------

export interface Page {
  id: string;
  business_id: string;
  page_type: string;
  title: string;
  content_json: string;
  is_published: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PageInput {
  id: string;
  business_id: string;
  page_type: string;
  title: string;
  content_json?: string;
  is_published?: number;
  sort_order?: number;
}

export function createPage(input: PageInput): Page {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO pages (id, business_id, page_type, title, content_json, is_published, sort_order)
    VALUES (@id, @business_id, @page_type, @title, @content_json, @is_published, @sort_order)
  `);
  stmt.run({
    id: input.id,
    business_id: input.business_id,
    page_type: input.page_type,
    title: input.title,
    content_json: input.content_json ?? "{}",
    is_published: input.is_published ?? 0,
    sort_order: input.sort_order ?? 0,
  });
  return getPage(input.id)!;
}

export function getPage(id: string): Page | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM pages WHERE id = ?");
  return stmt.get(id) as Page | undefined;
}

export function getPagesByBusiness(businessId: string, publishedOnly = false): Page[] {
  const db = getDb();
  let sql = "SELECT * FROM pages WHERE business_id = ?";
  if (publishedOnly) sql += " AND is_published = 1";
  sql += " ORDER BY sort_order ASC, created_at ASC";
  return db.prepare(sql).all(businessId) as Page[];
}

export function updatePage(id: string, updates: Partial<PageInput>): Page | undefined {
  const db = getDb();
  const existing = getPage(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
  const stmt = db.prepare(`
    UPDATE pages SET page_type = @page_type, title = @title, content_json = @content_json,
      is_published = @is_published, sort_order = @sort_order, updated_at = @updated_at
    WHERE id = @id
  `);
  stmt.run(merged);
  return getPage(id);
}

export function deletePage(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM pages WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Customer CRUD
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  balance_cents: number;
  created_at: string;
}

export interface CustomerInput {
  id: string;
  business_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  password_hash?: string | null;
  balance_cents?: number;
}

export function createCustomer(input: CustomerInput): Customer {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO customers (id, business_id, name, email, phone, password_hash, balance_cents)
    VALUES (@id, @business_id, @name, @email, @phone, @password_hash, @balance_cents)
  `);
  stmt.run({
    id: input.id,
    business_id: input.business_id,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    password_hash: input.password_hash ?? null,
    balance_cents: input.balance_cents ?? 0,
  });
  return getCustomer(input.id)!;
}

export function getCustomer(id: string): Customer | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM customers WHERE id = ?");
  return stmt.get(id) as Customer | undefined;
}

export function getCustomerByEmail(businessId: string, email: string): Customer | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM customers WHERE business_id = ? AND email = ?");
  return stmt.get(businessId, email) as Customer | undefined;
}

export function getCustomersByBusiness(businessId: string): Customer[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM customers WHERE business_id = ? ORDER BY created_at DESC")
    .all(businessId) as Customer[];
}

export function updateCustomer(id: string, updates: Partial<CustomerInput>): Customer | undefined {
  const db = getDb();
  const existing = getCustomer(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...updates };
  const stmt = db.prepare(`
    UPDATE customers SET name = @name, email = @email, phone = @phone,
      password_hash = @password_hash, balance_cents = @balance_cents
    WHERE id = @id
  `);
  stmt.run(merged);
  return getCustomer(id);
}

export function deleteCustomer(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM customers WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Appointment CRUD
// ---------------------------------------------------------------------------

export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string;
  service: string;
  start_time: string;
  end_time: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface AppointmentInput {
  id: string;
  business_id: string;
  customer_id: string;
  service: string;
  start_time: string;
  end_time?: string | null;
  status?: string;
  notes?: string | null;
}

export function createAppointment(input: AppointmentInput): Appointment {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO appointments (id, business_id, customer_id, service, start_time, end_time, status, notes)
    VALUES (@id, @business_id, @customer_id, @service, @start_time, @end_time, @status, @notes)
  `);
  stmt.run({
    id: input.id,
    business_id: input.business_id,
    customer_id: input.customer_id,
    service: input.service,
    start_time: input.start_time,
    end_time: input.end_time ?? null,
    status: input.status ?? "pending",
    notes: input.notes ?? null,
  });
  return getAppointment(input.id)!;
}

export function getAppointment(id: string): Appointment | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM appointments WHERE id = ?");
  return stmt.get(id) as Appointment | undefined;
}

export function getAppointmentsByBusiness(businessId: string, status?: string): Appointment[] {
  const db = getDb();
  let sql = "SELECT * FROM appointments WHERE business_id = ?";
  const params: unknown[] = [businessId];
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY start_time ASC";
  return db.prepare(sql).all(...params) as Appointment[];
}

export function getAppointmentsByCustomer(customerId: string): Appointment[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM appointments WHERE customer_id = ? ORDER BY start_time ASC")
    .all(customerId) as Appointment[];
}

export function updateAppointmentStatus(id: string, status: string): Appointment | undefined {
  const db = getDb();
  const existing = getAppointment(id);
  if (!existing) return undefined;

  db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
  return getAppointment(id);
}

export function deleteAppointment(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM appointments WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Message CRUD
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  business_id: string;
  customer_id: string | null;
  content: string;
  sender_type: "business" | "customer" | "ai";
  created_at: string;
}

export interface MessageInput {
  id: string;
  business_id: string;
  customer_id?: string | null;
  content: string;
  sender_type: "business" | "customer" | "ai";
}

export function createMessage(input: MessageInput): Message {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO messages (id, business_id, customer_id, content, sender_type)
    VALUES (@id, @business_id, @customer_id, @content, @sender_type)
  `);
  stmt.run({
    id: input.id,
    business_id: input.business_id,
    customer_id: input.customer_id ?? null,
    content: input.content,
    sender_type: input.sender_type,
  });
  return getMessage(input.id)!;
}

export function getMessage(id: string): Message | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM messages WHERE id = ?");
  return stmt.get(id) as Message | undefined;
}

export function getMessagesByBusiness(businessId: string, customerId?: string): Message[] {
  const db = getDb();
  let sql = "SELECT * FROM messages WHERE business_id = ?";
  const params: unknown[] = [businessId];
  if (customerId) {
    sql += " AND customer_id = ?";
    params.push(customerId);
  }
  sql += " ORDER BY created_at ASC";
  return db.prepare(sql).all(...params) as Message[];
}

export function getMessagesByCustomer(customerId: string): Message[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at ASC")
    .all(customerId) as Message[];
}

// ---------------------------------------------------------------------------
// Transaction CRUD
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  business_id: string;
  customer_id: string;
  amount_cents: number;
  type: "payment" | "charge" | "refund" | "deposit";
  description: string | null;
  created_at: string;
}

export interface TransactionInput {
  id: string;
  business_id: string;
  customer_id: string;
  amount_cents: number;
  type: "payment" | "charge" | "refund" | "deposit";
  description?: string | null;
}

export function createTransaction(input: TransactionInput): Transaction {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO transactions (id, business_id, customer_id, amount_cents, type, description)
    VALUES (@id, @business_id, @customer_id, @amount_cents, @type, @description)
  `);
  stmt.run({
    id: input.id,
    business_id: input.business_id,
    customer_id: input.customer_id,
    amount_cents: input.amount_cents,
    type: input.type,
    description: input.description ?? null,
  });

  // Update customer balance
  const balanceChange = input.type === "payment" || input.type === "refund"
    ? -input.amount_cents
    : input.type === "charge" || input.type === "deposit"
      ? input.amount_cents
      : 0;

  if (balanceChange !== 0) {
    db.prepare("UPDATE customers SET balance_cents = balance_cents + ? WHERE id = ?").run(
      balanceChange,
      input.customer_id
    );
  }

  return getTransaction(input.id)!;
}

export function getTransaction(id: string): Transaction | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM transactions WHERE id = ?");
  return stmt.get(id) as Transaction | undefined;
}

export function getTransactionsByBusiness(businessId: string): Transaction[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM transactions WHERE business_id = ? ORDER BY created_at DESC")
    .all(businessId) as Transaction[];
}

export function getTransactionsByCustomer(customerId: string): Transaction[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC")
    .all(customerId) as Transaction[];
}

// ---------------------------------------------------------------------------
// Analytics events
// ---------------------------------------------------------------------------

export interface AnalyticsEvent {
  id: number;
  business_id: string;
  event_type: "page_view" | "app_open" | "signup" | "subscription_started" | "subscription_cancelled";
  page_type: string | null;
  customer_id: string | null;
  metadata: string | null;
  created_at: string;
}

export interface AnalyticsEventInput {
  business_id: string;
  event_type: AnalyticsEvent["event_type"];
  page_type?: string | null;
  customer_id?: string | null;
  metadata?: string | null;
}

export function dbTrackEvent(input: AnalyticsEventInput): AnalyticsEvent {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO analytics_events (business_id, event_type, page_type, customer_id, metadata)
    VALUES (@business_id, @event_type, @page_type, @customer_id, @metadata)
  `);
  const result = stmt.run({
    business_id: input.business_id,
    event_type: input.event_type,
    page_type: input.page_type ?? null,
    customer_id: input.customer_id ?? null,
    metadata: input.metadata ?? null,
  });

  return db.prepare("SELECT * FROM analytics_events WHERE id = ?").get(result.lastInsertRowid) as AnalyticsEvent;
}

export interface BusinessAnalytics {
  totalPageViews: number;
  uniqueVisitors: number;
  signups: number;
  pageViewsByDay: { date: string; count: number }[];
  topPages: { pageType: string; count: number }[];
}

export function dbGetAnalytics(
  businessId: string,
  startDate: string,
  endDate: string,
): BusinessAnalytics {
  const db = getDb();

  // Total page views
  const pageViewRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE business_id = ? AND event_type = 'page_view' AND created_at >= ? AND created_at <= ?",
    )
    .get(businessId, startDate, endDate) as { count: number };

  // Unique visitors (distinct customer_id for page_view events)
  const visitorRow = db
    .prepare(
      "SELECT COUNT(DISTINCT customer_id) as count FROM analytics_events WHERE business_id = ? AND event_type = 'page_view' AND created_at >= ? AND created_at <= ? AND customer_id IS NOT NULL",
    )
    .get(businessId, startDate, endDate) as { count: number };

  // Signups
  const signupRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE business_id = ? AND event_type = 'signup' AND created_at >= ? AND created_at <= ?",
    )
    .get(businessId, startDate, endDate) as { count: number };

  // Page views by day
  const pageViewsByDay = db
    .prepare(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM analytics_events
       WHERE business_id = ? AND event_type = 'page_view' AND created_at >= ? AND created_at <= ?
       GROUP BY date(created_at)
       ORDER BY date ASC`,
    )
    .all(businessId, startDate, endDate) as { date: string; count: number }[];

  // Top pages
  const topPages = db
    .prepare(
      `SELECT page_type as pageType, COUNT(*) as count
       FROM analytics_events
       WHERE business_id = ? AND event_type = 'page_view' AND created_at >= ? AND created_at <= ? AND page_type IS NOT NULL
       GROUP BY page_type
       ORDER BY count DESC
       LIMIT 10`,
    )
    .all(businessId, startDate, endDate) as { pageType: string; count: number }[];

  return {
    totalPageViews: pageViewRow.count,
    uniqueVisitors: visitorRow.count,
    signups: signupRow.count,
    pageViewsByDay,
    topPages,
  };
}

export interface PlatformStats {
  totalBusinesses: number;
  totalMAU: number;
  conversionRate: number;
  totalSubscribers: number;
}

export function dbGetPlatformStats(): PlatformStats {
  const db = getDb();

  const bizRow = db.prepare("SELECT COUNT(*) as count FROM businesses").get() as { count: number };

  // MAU = distinct customer_ids with a page_view in the last 30 days
  const mauRow = db
    .prepare(
      "SELECT COUNT(DISTINCT customer_id) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= datetime('now','-30 days') AND customer_id IS NOT NULL",
    )
    .get() as { count: number };

  const subRow = db
    .prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'")
    .get() as { count: number };

  const totalBusinesses = bizRow.count;
  const totalSubscribers = subRow.count;
  const conversionRate = totalBusinesses > 0 ? totalSubscribers / totalBusinesses : 0;

  return {
    totalBusinesses,
    totalMAU: mauRow.count,
    conversionRate,
    totalSubscribers,
  };
}

// ---------------------------------------------------------------------------
// Email drip CRUD
// ---------------------------------------------------------------------------

export interface EmailDrip {
  id: string;
  business_id: string;
  email: string;
  business_name: string;
  last_sent_step: number;
  next_send_at: string | null;
  created_at: string;
}

export interface EmailDripInput {
  id: string;
  business_id: string;
  email: string;
  business_name: string;
  last_sent_step?: number;
  next_send_at?: string | null;
}

export function dbCreateDrip(input: EmailDripInput): EmailDrip {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO email_drips (id, business_id, email, business_name, last_sent_step, next_send_at)
    VALUES (@id, @business_id, @email, @business_name, @last_sent_step, @next_send_at)
  `);
  stmt.run({
    id: input.id,
    business_id: input.business_id,
    email: input.email,
    business_name: input.business_name,
    last_sent_step: input.last_sent_step ?? 1,
    next_send_at: input.next_send_at ?? null,
  });
  return dbGetDrip(input.id)!;
}

export function dbGetDrip(id: string): EmailDrip | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM email_drips WHERE id = ?").get(id) as EmailDrip | undefined;
}

export function dbGetDripByBusiness(businessId: string): EmailDrip | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM email_drips WHERE business_id = ?").get(businessId) as EmailDrip | undefined;
}

export function dbGetPendingDrips(): EmailDrip[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM email_drips WHERE next_send_at <= datetime('now') AND last_sent_step < 4 ORDER BY next_send_at ASC",
    )
    .all() as EmailDrip[];
}

export function dbUpdateDripStep(id: string, step: number, nextSendAt: string | null): EmailDrip | undefined {
  const db = getDb();
  db.prepare("UPDATE email_drips SET last_sent_step = ?, next_send_at = ? WHERE id = ?").run(
    step,
    nextSendAt,
    id,
  );
  return dbGetDrip(id);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Generate a simple UUID v4 string for use as primary keys.
 */
export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}