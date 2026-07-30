import { createServerFn } from "@tanstack/react-start";
import { getDb, uuidv4 } from "./db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUser,
  clearSession,
} from "./auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthServerResult {
  success: boolean;
  error?: string;
  sessionToken?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: "business" | "customer";
    businessId: string;
    businessName?: string;
    businessSlug?: string;
  };
}

export interface GetCurrentUserResult {
  authenticated: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: "business" | "customer";
    businessId: string;
    businessName?: string;
    businessSlug?: string;
  };
}

// ---------------------------------------------------------------------------
// Register a new business owner
// ---------------------------------------------------------------------------

export const registerBusinessOwner = createServerFn({ method: "POST" })
  .validator(
    (input: {
      name: string;
      email: string;
      password: string;
      businessName: string;
      businessSlug: string;
    }) => {
      if (!input.name || !input.email || !input.password || !input.businessName) {
        throw new Error("Missing required fields");
      }
      if (input.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      return input;
    }
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const { name, email, password, businessName, businessSlug } = data;

    // Check if email already registered
    const existingOwner = db
      .prepare("SELECT id FROM business_owners WHERE email = ?")
      .get(email);
    if (existingOwner) {
      return {
        success: false,
        error: "Email already registered",
      } as AuthServerResult;
    }

    // Check if slug taken
    const existingBusiness = db
      .prepare("SELECT id FROM businesses WHERE slug = ?")
      .get(businessSlug);
    if (existingBusiness) {
      return {
        success: false,
        error: "Business slug already taken",
      } as AuthServerResult;
    }

    // Create business
    const businessId = uuidv4();
    db.prepare(
      "INSERT INTO businesses (id, name, slug) VALUES (?, ?, ?)"
    ).run(businessId, businessName, businessSlug);

    // Create owner
    const ownerId = uuidv4();
    const passwordHash = hashPassword(password);
    db.prepare(
      "INSERT INTO business_owners (id, business_id, name, email, password_hash) VALUES (?, ?, ?, ?, ?)"
    ).run(ownerId, businessId, name, email, passwordHash);

    // Create session
    const session = createSession(ownerId, "business");

    // Fire welcome email (don't block the response)
    import("./server/email").then(({ sendWelcomeEmail }) =>
      sendWelcomeEmail({ data: { email, businessName } }).catch(() => {})
    );

    // Schedule onboarding email drip (don't block the response)
    import("./server/email-drip").then(({ scheduleEmailDrip }) =>
      scheduleEmailDrip(email, businessName, businessId).catch(() => {})
    );

    // Track signup event (don't block the response)
    import("./db").then(({ dbTrackEvent }) =>
      dbTrackEvent({
        business_id: businessId,
        event_type: "signup",
        metadata: JSON.stringify({ businessName, email }),
      })
    ).catch(() => {});

    return {
      success: true,
      sessionToken: session.id,
      user: {
        id: ownerId,
        name,
        email,
        role: "business" as const,
        businessId,
        businessName,
        businessSlug,
      },
    } as AuthServerResult;
  });

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const login = createServerFn({ method: "POST" })
  .validator(
    (input: {
      email: string;
      password: string;
      role: "business" | "customer";
      businessSlug?: string;
    }) => {
      if (!input.email || !input.password) {
        throw new Error("Missing email or password");
      }
      if (input.role === "customer" && !input.businessSlug) {
        throw new Error("Business slug required for customer login");
      }
      return input;
    }
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const { email, password, role, businessSlug } = data;

    if (role === "business") {
      // Business owner login
      const owner = db
        .prepare("SELECT * FROM business_owners WHERE email = ?")
        .get(email) as
        | {
            id: string;
            name: string;
            email: string;
            password_hash: string;
            business_id: string;
          }
        | undefined;

      if (!owner || !verifyPassword(password, owner.password_hash)) {
        return { success: false, error: "Invalid email or password" } as AuthServerResult;
      }

      const business = db
        .prepare("SELECT name, slug FROM businesses WHERE id = ?")
        .get(owner.business_id) as { name: string; slug: string } | undefined;

      const session = createSession(owner.id, "business");

      return {
        success: true,
        sessionToken: session.id,
        user: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          role: "business" as const,
          businessId: owner.business_id,
          businessName: business?.name,
          businessSlug: business?.slug,
        },
      } as AuthServerResult;
    } else {
      // Customer login
      const business = db
        .prepare("SELECT id, name, slug FROM businesses WHERE slug = ?")
        .get(businessSlug!) as
        | { id: string; name: string; slug: string }
        | undefined;

      if (!business) {
        return { success: false, error: "Business not found" } as AuthServerResult;
      }

      const customer = db
        .prepare("SELECT * FROM customers WHERE email = ? AND business_id = ?")
        .get(email, business.id) as
        | {
            id: string;
            name: string;
            email: string;
            password_hash: string | null;
          }
        | undefined;

      if (!customer || !customer.password_hash) {
        return { success: false, error: "Invalid email or password" } as AuthServerResult;
      }

      if (!verifyPassword(password, customer.password_hash)) {
        return { success: false, error: "Invalid email or password" } as AuthServerResult;
      }

      const session = createSession(customer.id, "customer");

      return {
        success: true,
        sessionToken: session.id,
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          role: "customer" as const,
          businessId: business.id,
          businessName: business.name,
          businessSlug: business.slug,
        },
      } as AuthServerResult;
    }
  });

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export const logout = createServerFn({ method: "POST" })
  .validator(
    (input: { sessionToken?: string }) => {
      return input;
    }
  )
  .handler(async ({ data }) => {
    if (data.sessionToken) {
      clearSession(data.sessionToken);
    }
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Get current user from session token
// ---------------------------------------------------------------------------

export const getCurrentUser = createServerFn({ method: "GET" })
  .validator(
    (input: { sessionToken?: string }) => {
      return input;
    }
  )
  .handler(async ({ data }) => {
    if (!data.sessionToken) {
      return { authenticated: false } as GetCurrentUserResult;
    }

    const user = getSessionUser(data.sessionToken);
    if (!user) {
      return { authenticated: false } as GetCurrentUserResult;
    }

    return {
      authenticated: true,
      user,
    } as GetCurrentUserResult;
  });