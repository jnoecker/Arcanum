import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="font-display text-sm uppercase tracking-[0.2em] text-accent">
            Arcanum Hub
          </Link>
          <Link
            to="/signup"
            className="text-xs uppercase tracking-wider text-text-muted hover:text-text-primary"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl uppercase tracking-[0.18em]">Privacy policy</h1>
        <p className="mt-2 text-xs text-text-muted">Last updated: 2026-04-16 · Beta preview</p>

        <Section title="Who we are">
          Arcanum Hub is an independent hobby project run by John Noecker Jr. Contact:{" "}
          <a className="text-accent underline" href="mailto:jnoecker@gmail.com">
            jnoecker@gmail.com
          </a>
          . Acting as data controller for the hub.
        </Section>

        <Section title="What we store">
          <ul className="ml-5 list-disc space-y-1 text-text-secondary">
            <li>
              <strong className="text-text-primary">Display name</strong> — shown on your account
              page and on any worlds you publicly list.
            </li>
            <li>
              <strong className="text-text-primary">Email</strong> (verified accounts only) — used
              to send the 6-digit sign-up code and to prevent duplicate accounts. Never shared,
              never used for marketing.
            </li>
            <li>
              <strong className="text-text-primary">API key hash</strong> — a SHA-256 digest of
              your key so requests can be authenticated. The plaintext key is never stored
              server-side.
            </li>
            <li>
              <strong className="text-text-primary">Usage counters</strong> — lifetime totals of
              hub-AI image generations and LLM prompts, for quota enforcement.
            </li>
            <li>
              <strong className="text-text-primary">World content</strong> — everything you
              publish (articles, images, maps) is stored in Cloudflare R2 and served publicly if
              you mark a world as listed.
            </li>
            <li>
              <strong className="text-text-primary">Signup-attempt IP log</strong> — your IP
              address is recorded transiently to rate-limit signups. Entries older than 24 hours
              are pruned automatically.
            </li>
          </ul>
        </Section>

        <Section title="What we don't do">
          <ul className="ml-5 list-disc space-y-1 text-text-secondary">
            <li>No tracking cookies, no analytics SDKs, no third-party ad networks.</li>
            <li>No sale, rental, or disclosure of personal data to third parties.</li>
            <li>
              No training of machine-learning models on your prompts or published content. Your
              AI calls are relayed upstream to the image and LLM providers listed below; see their
              policies for their handling.
            </li>
          </ul>
        </Section>

        <Section title="Upstream providers">
          When you use the hub-proxied AI features, your prompt and (where applicable) image data
          are forwarded to:
          <ul className="ml-5 mt-2 list-disc space-y-1 text-text-secondary">
            <li>Runware (image generation)</li>
            <li>OpenRouter → DeepSeek / Anthropic (LLM completions)</li>
            <li>Anthropic (vision)</li>
            <li>Resend (transactional email delivery)</li>
            <li>Cloudflare (hosting, R2 storage, Turnstile bot verification)</li>
          </ul>
          <p className="mt-2 text-text-secondary">
            Each processes the specific request for the purpose of fulfilling it. We do not share
            your account metadata with them.
          </p>
        </Section>

        <Section title="Retention">
          Account records live until you delete them (see below) or until the hub is wiped during
          beta development. Signup-attempt IP entries are pruned after 24 hours. Verification
          codes expire after 15 minutes. Published world data lives until you delete the world or
          the account that owns it.
        </Section>

        <Section title="Your rights">
          Under GDPR and similar frameworks you have the right to access, correct, port, restrict,
          and erase your data, and to object to processing. For this beta, the easiest path is:
          <ul className="ml-5 mt-2 list-disc space-y-1 text-text-secondary">
            <li>
              <strong className="text-text-primary">Erase</strong> — use "Delete my account" on
              your <Link to="/account" className="text-accent underline">account page</Link>.
              This wipes your user row, all published worlds, and every image we hold for you.
            </li>
            <li>
              <strong className="text-text-primary">Access / port / correct</strong> — email the
              address at the top of this page with your API key's display name and we'll respond
              within 30 days.
            </li>
          </ul>
        </Section>

        <Section title="Beta notice">
          Arcanum Hub is in active development. Account records, worlds, and usage counters may
          be reset or wiped during upgrades while the system stabilizes. Accounts that exceed
          posted quotas or abuse the free tiers will be revoked.
        </Section>

        <Section title="Changes to this policy">
          Non-trivial changes will be announced on the hub landing page and by bumping the "Last
          updated" date above. Continuing to use the service after a change means you accept the
          revised policy.
        </Section>

        <p className="mt-12 text-xs text-text-muted">
          <Link to="/" className="text-accent underline">Back to Arcanum Hub</Link>
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg uppercase tracking-[0.14em] text-accent">{title}</h2>
      <div className="mt-2 text-sm leading-7 text-text-secondary">{children}</div>
    </section>
  );
}
