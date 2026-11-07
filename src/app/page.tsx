import Link from "next/link";

const STEPS = [
  { href: "/advisor", title: "Tell the advisor about your business", body: "Five questions by chat or voice, in English, Hindi or Hinglish. No salesperson." },
  { href: "/advisor", title: "See one clear monthly price", body: "A bundle that fits your size and city, with add-ons you can switch on and off. Anything not allowed is shown with the reason." },
  { href: "/kyc", title: "Verify documents in under a minute", body: "GSTIN and Udyam checked against the registries, photos checked for blur and tampering, with a clear consent screen first." },
  { href: "/kyc", title: "Track installation without calling anyone", body: "Dispatch, technician, installation and go-live, updated on one page." },
];

const FINDINGS = [
  { figure: "7.4%", text: "of 5,000 leads became customers last quarter, at ₹15,053 acquisition cost each." },
  { figure: "48", text: "of 368 activated customers were sold a bundle the catalogue doesn't allow. Our advisor can't do that." },
  { figure: "6% → 28%", text: "six-month churn as customers' status-chasing calls rise from 1 to 5. The tracker removes those calls." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-16">
      <p className="font-bold">Accel Business</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight lg:text-5xl">Get a small business online in one sitting.</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Internet, business phones and digital tools for shops, clinics, offices and factories: from first question to activation on a phone, without a sales visit.
      </p>
      <Link href="/advisor" className="mt-8 inline-block rounded-xl bg-khata px-7 py-3.5 text-lg font-medium text-white hover:bg-[#a90d26]">
        Start with the advisor
      </Link>

      <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-white p-6">
            <Link href={s.href} className="group block">
              <span className="text-sm text-ink-soft">Step {i + 1}</span>
              <h2 className="mt-1 text-xl font-bold group-hover:underline group-hover:underline-offset-4">{s.title}</h2>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </Link>
          </li>
        ))}
      </ol>

      <section className="mt-16 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="text-2xl font-bold">What last quarter&apos;s leads told us</h2>
          <dl className="mt-5 space-y-5">
            {FINDINGS.map((f) => (
              <div key={f.figure} className="grid grid-cols-[7.5rem_1fr] items-baseline gap-4">
                <dt className="text-2xl font-bold text-khata">{f.figure}</dt>
                <dd className="text-ink-soft">{f.text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <aside className="rounded-2xl border border-rule bg-white p-6">
          <h2 className="text-lg font-bold">For judges</h2>
          <ul className="mt-3 space-y-3 text-[15px]">
            <li>
              <Link className="underline underline-offset-4" href="/judge">
                Rule tester
              </Link>
              <span className="block text-sm text-ink-soft">Any business profile in, bundle and refusals out, plus 15 one-click checks.</span>
            </li>
            <li>
              <Link className="underline underline-offset-4" href="/kyc">
                Document check
              </Link>
              <span className="block text-sm text-ink-soft">Load any sample applicant K01–K12 in one click.</span>
            </li>
            <li>
              <Link className="underline underline-offset-4" href="/partner">
                Partner rescue portal
              </Link>
              <span className="block text-sm text-ink-soft">Leads the advisor couldn&apos;t close, ranked by likelihood to buy.</span>
            </li>
            <li>
              <a className="underline underline-offset-4" href="/api/health">
                System health
              </a>
              <span className="block text-sm text-ink-soft">Data loaded, AI providers connected.</span>
            </li>
          </ul>
        </aside>
      </section>
      <p className="mt-16 text-xs text-ink-soft">Accel Telecom is a fictional operator from the YTL Hackathon 2026 case. All businesses, people and identifiers are synthetic.</p>
    </main>
  );
}
