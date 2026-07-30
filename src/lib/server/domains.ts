/**
 * Custom domain management for Premium-tier businesses.
 *
 * Allows Premium businesses to serve their Branded app on their own domain
 * (e.g. app.joescoffee.com). Handles domain validation, DNS verification,
 * and domain-status retrieval.
 */
import { createServerFn } from "@tanstack/react-start";
import { getDb, getBusiness, uuidv4 } from "~/lib/db";
import { requireBusinessAuth } from "~/lib/auth";

// ---------------------------------------------------------------------------
// Domain validation
// ---------------------------------------------------------------------------

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z]$/i;

function isValidDomain(domain: string): boolean {
  // Must be a valid domain format, not an IP, not our own domains
  if (!DOMAIN_REGEX.test(domain)) return false;
  if (domain.length > 253) return false;
  const lower = domain.toLowerCase();
  if (lower === "brandedapp.us" || lower === "brandedapp.ctonew.app" || lower.endsWith(".brandedapp.us") || lower.endsWith(".brandedapp.ctonew.app")) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Generate verification token
// ---------------------------------------------------------------------------

function generateVerificationToken(): string {
  return `branded-verify-${uuidv4()}`;
}

// ---------------------------------------------------------------------------
// DNS lookup via Google DNS-over-HTTPS
// ---------------------------------------------------------------------------

async function dnsLookupTxt(name: string): Promise<string[]> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json() as {
      Answer?: { data: string }[];
    };
    if (!data.Answer) return [];

    // TXT records come back quoted; extract values
    return data.Answer.map((a) => {
      // Remove surrounding quotes if present
      const d = a.data;
      if (d.startsWith('"') && d.endsWith('"')) return d.slice(1, -1);
      return d;
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DomainStatus {
  domain: string | null;
  verified: boolean;
  verificationToken: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

/**
 * Set or update the custom domain for a business.
 * Generates a new verification token each time.
 */
export const setCustomDomain = createServerFn({ method: "POST" })
  .validator((input: { sessionToken: string; businessId: string; domain: string }) => {
    if (!input.domain || typeof input.domain !== "string") {
      throw new Error("Domain is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const auth = requireBusinessAuth(data.sessionToken);
    if (!auth.authorized) return { error: auth.error! };

    const business = getBusiness(data.businessId);
    if (!business) return { error: "Business not found" };

    // Premium tier required
    if (business.subscription_tier !== "premium") {
      return { error: "Custom domains require a Premium subscription" };
    }

    const domain = data.domain.trim().toLowerCase();

    if (!isValidDomain(domain)) {
      return { error: "Invalid domain format. Use a fully-qualified domain like app.example.com" };
    }

    // Check if domain is already taken by another verified business
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM businesses WHERE custom_domain = ? AND id != ? AND custom_domain_verified = 1")
      .get(domain, data.businessId) as { id: string } | undefined;
    if (existing) {
      return { error: "This domain is already in use by another business" };
    }

    const token = generateVerificationToken();

    db.prepare(
      "UPDATE businesses SET custom_domain = ?, custom_domain_verified = 0, custom_domain_verification_token = ? WHERE id = ?"
    ).run(domain, token, data.businessId);

    return {
      success: true,
      domain,
      verificationToken: token,
    };
  });

/**
 * Verify domain ownership by checking for the TXT verification record.
 */
export const verifyCustomDomain = createServerFn({ method: "POST" })
  .validator((input: { sessionToken: string; businessId: string }) => input)
  .handler(async ({ data }) => {
    const auth = requireBusinessAuth(data.sessionToken);
    if (!auth.authorized) return { error: auth.error! };

    const business = getBusiness(data.businessId);
    if (!business) return { error: "Business not found" };
    if (!business.custom_domain) return { error: "No custom domain configured" };

    const verificationName = `_branded.${business.custom_domain}`;
    const expectedToken = business.custom_domain_verification_token;

    if (!expectedToken) return { error: "No verification token found. Please save your domain again." };

    // DNS lookup for the TXT record
    const records = await dnsLookupTxt(verificationName);

    const found = records.some((r) => r === expectedToken);

    if (found) {
      const db = getDb();
      db.prepare(
        "UPDATE businesses SET custom_domain_verified = 1 WHERE id = ?"
      ).run(data.businessId);
      return { success: true, verified: true };
    }

    return {
      success: true,
      verified: false,
      message: `Verification record not found. Add a TXT record for "${verificationName}" with value "${expectedToken}"`,
    };
  });

/**
 * Get the current domain status for a business.
 */
export const getDomainStatus = createServerFn({ method: "GET" })
  .validator((input: { sessionToken: string; businessId: string }) => input)
  .handler(async ({ data }) => {
    const auth = requireBusinessAuth(data.sessionToken);
    if (!auth.authorized) return { error: auth.error! };

    const business = getBusiness(data.businessId);
    if (!business) return { error: "Business not found" };

    return {
      domain: business.custom_domain || null,
      verified: business.custom_domain_verified === 1,
      verificationToken: business.custom_domain_verification_token || null,
    } as DomainStatus;
  });
