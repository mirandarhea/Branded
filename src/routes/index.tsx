/**
 * Branded — Marketing Landing Page
 *
 * A polished SaaS landing page that sells the platform to small business owners.
 * Mobile-first, responsive, uses the design system brand colors.
 */
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

interface Feature {
  title: string;
  description: string;
  icon: string; // SVG path d attribute
}

const features: Feature[] = [
  {
    title: "Bio / About Us",
    description: "Tell your story with rich text, images, and your mission statement.",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    title: "Our Team",
    description: "Showcase your staff with photos, roles, and bios.",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
  },
  {
    title: "Business Hours",
    description: "Display your weekly schedule with open/closed times and notes.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Contact",
    description: "Contact form, address, phone, email, and map integration.",
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    title: "Services & Pricing",
    description: "Display tiered pricing with feature lists and popular badges.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Appointments",
    description: "Let customers book time slots directly through your app.",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    title: "Direct Messaging",
    description: "Chat with customers in real-time with optional AI assistant.",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    title: "Bill Pay",
    description: "Accept payments for invoices and services directly in-app.",
    icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  },
];

// ---------------------------------------------------------------------------
// How it works steps
// ---------------------------------------------------------------------------

interface Step {
  number: string;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: "01",
    title: "Choose Your Pages",
    description: "Pick from 12 ready-made page templates — Bio, Team, Hours, Pricing, Appointments, and more.",
  },
  {
    number: "02",
    title: "Customize with Your Brand",
    description: "Add your logo, brand colors, and content. No coding required — just point and click.",
  },
  {
    number: "03",
    title: "Publish Your App",
    description: "Your branded app goes live instantly. Share the link with your customers and watch engagement grow.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Branded" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/api/auth/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              Log in
            </Link>
            <Link
              to="/api/auth/register"
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-700"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ================================================================
            Hero Section
            ================================================================ */}
        <section className="relative overflow-hidden pt-20 sm:pt-24">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 right-0 size-[500px] rounded-full bg-gradient-to-br from-primary-100/40 to-secondary-100/40 blur-3xl" />
            <div className="absolute -bottom-40 left-0 size-[400px] rounded-full bg-gradient-to-tr from-primary-50/50 to-secondary-50/30 blur-3xl" />
          </div>

          <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
            <div className="mx-auto max-w-3xl text-center">
              {/* Badge */}
              <div className="mx-auto mb-6 flex w-fit items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                No-code app builder for small businesses
              </div>

              {/* Headline */}
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                Your Business,{" "}
                <span className="bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                  In Their Pocket
                </span>
              </h1>

              {/* Subheading */}
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
                Create a professional branded mobile app for your business in minutes.
                No coding, no designers, no developers. Just your brand, your content,
                and a direct connection to your customers.
              </p>

              {/* CTA */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  to="/api/auth/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/30"
                >
                  Start Free
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  See Features
                </a>
                <Link
                  to="/app/joes-coffee-shop"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-primary-200 px-6 py-3 text-base font-medium text-primary-600 transition-all hover:border-primary-300 hover:bg-primary-50"
                >
                  View Demo
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </Link>
              </div>

              {/* Trust signal */}
              <p className="mt-6 text-xs text-gray-400">
                Free 7-day trial &middot; Credit card required &middot; Set up in under 5 minutes
              </p>
            </div>

            {/* ===== Trial Offer Banner ===== */}
            <div className="mx-auto mt-8 max-w-2xl">
              <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 p-5 text-center shadow-md sm:p-6">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:text-left">
                  <div>
                    <h2 className="text-lg font-bold text-amber-800 sm:text-xl">
                      🚀 Branded is live — First 10 businesses get 7 days free
                    </h2>
                    <p className="mt-1 text-sm text-amber-700">
                      Try all features risk-free for 7 days. Credit card required — you won't be charged until your trial ends.
                      Only a few trial spots left!
                    </p>
                  </div>
                  <Link
                    to="/api/auth/register"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:shadow-xl hover:shadow-amber-500/30"
                  >
                    Claim Your Free Trial
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>

            {/* App preview mockup */}
            <div className="mx-auto mt-12 max-w-2xl sm:mt-16">
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/50">
                <div className="flex h-8 items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3">
                  <div className="size-2.5 rounded-full bg-red-400" />
                  <div className="size-2.5 rounded-full bg-yellow-400" />
                  <div className="size-2.5 rounded-full bg-green-400" />
                  <span className="ml-2 text-[10px] font-medium text-gray-400">branded.app/your-business</span>
                </div>
                <div className="flex items-stretch">
                  {/* Sidebar */}
                  <div className="hidden w-48 border-r border-gray-100 bg-gray-50/50 p-3 sm:block">
                    <div className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2">
                      <div className="flex size-6 items-center justify-center rounded bg-white/20 text-xs font-bold text-white">J</div>
                      <span className="text-xs font-semibold text-white">Joe's Coffee</span>
                    </div>
                    <div className="mt-3 space-y-0.5">
                      {["About Us", "Our Team", "Hours", "Contact", "Menu"].map((item) => (
                        <div
                          key={item}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                            item === "About Us"
                              ? "bg-primary-100 text-primary-700"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="rounded-xl bg-gradient-to-br from-primary-600 to-secondary-600 p-4 text-white sm:p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-white/20 text-lg font-bold sm:size-14">
                          J
                        </div>
                        <div>
                          <h2 className="text-base font-bold sm:text-lg">Joe's Coffee Shop</h2>
                          <p className="text-xs opacity-80">Welcome to our app!</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "Book Appointment", color: "primary" },
                        { label: "Contact Us", color: "secondary" },
                      ].map((btn) => (
                        <div
                          key={btn.label}
                          className={`rounded-xl border border-gray-100 p-3 text-center text-xs font-medium shadow-sm ${
                            btn.color === "primary" ? "text-primary-600" : "text-secondary-600"
                          }`}
                        >
                          {btn.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            Features Section
            ================================================================ */}
        <section id="features" className="border-t border-gray-100 bg-gray-50/50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Everything your business needs
              </h2>
              <p className="mt-3 text-base text-gray-600">
                12 ready-made page templates — pick the ones you need, customize them with your brand, and publish instantly.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                    </svg>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                to="/api/auth/register"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                See all 12 page types
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ================================================================
            How It Works Section
            ================================================================ */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                How it works
              </h2>
              <p className="mt-3 text-base text-gray-600">
                Get your app live in three simple steps.
              </p>
            </div>

            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step.number} className="relative text-center">
                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-1/2 top-8 hidden h-0.5 w-full bg-gradient-to-r from-primary-200 to-transparent sm:block" />
                  )}
                  {/* Step number */}
                  <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-600 text-lg font-bold text-white shadow-lg shadow-primary-600/20">
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.description}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <Link
                to="/api/auth/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-xl"
              >
                Start Free — No credit card required
              </Link>
            </div>
          </div>
        </section>

        {/* ================================================================
            Testimonial Section
            ================================================================ */}
        <section className="border-t border-gray-100 bg-gray-50/50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
              <div className="text-center">
                <svg className="mx-auto size-8 text-primary-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <blockquote className="mt-4 text-lg font-medium leading-relaxed text-gray-700 sm:text-xl">
                  "Branded made it possible for us to have a professional app without spending thousands on development. Our customers love the convenience, and we've seen a 40% increase in online bookings."
                </blockquote>
                <div className="mt-6">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 text-sm font-bold text-white">
                    SK
                  </div>
                  <p className="mt-2 text-sm font-semibold text-gray-900">Sarah Kim</p>
                  <p className="text-xs text-gray-400">Owner, The Glow Studio</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            Final CTA Section
            ================================================================ */}
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-secondary-600" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          </div>
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Ready to put your business in their pocket?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/80">
              Join thousands of small businesses using Branded to connect with customers. Start free, no credit card required.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/api/auth/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-primary-700 shadow-lg transition-all hover:bg-gray-100 hover:shadow-xl"
              >
                Start Free
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================
          Footer
          ================================================================ */}
      <footer className="border-t border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Branded" className="h-6 w-auto" />
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-400">
              <a href="#" className="hover:text-gray-600">Features</a>
              <a href="#" className="hover:text-gray-600">Pricing</a>
              <a href="#" className="hover:text-gray-600">Privacy</a>
              <a href="#" className="hover:text-gray-600">Terms</a>
              <a href="#" className="hover:text-gray-600">Support</a>
            </div>
            <p className="text-xs text-gray-400">
              Powered by <Link to="/" className="font-medium text-primary-600 hover:underline">Branded</Link>
            </p>
          </div>
          <div className="mt-6 border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Branded. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}