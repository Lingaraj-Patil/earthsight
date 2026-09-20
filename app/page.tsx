import Link from "next/link";
import { ArrowRight, Camera, Brain, CloudLightning, Map as MapIcon } from "lucide-react";
import HeroDashboard from "@/components/HeroDashboard";
import LiveStats from "@/components/LiveStats";

export default function HomePage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(700px circle at 15% 10%, rgba(52,211,153,0.10), transparent 60%), radial-gradient(600px circle at 90% 30%, rgba(52,211,153,0.06), transparent 55%)",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="es-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs text-emerald-300">
              Environmental Early-Warning Intelligence
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.08]">
              See environmental risks
              <br />
              before they become disasters.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-400">
              EarthSight combines citizen reports, environmental intelligence, and weather
              forecasts to identify hazards that could become critical before the next
              environmental event.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/report"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring"
              >
                Report a Hazard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white hover:bg-white/[0.07] transition-colors es-focus-ring"
              >
                Explore Live Map
              </Link>
            </div>
          </div>

          <HeroDashboard />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 mt-4">
          <p className="text-center text-[11px] text-zinc-600">
            Preview above is illustrative UI, not live data.
          </p>
        </div>
      </section>

      {/* REAL APPLICATION STATE */}
      <section className="py-16 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-emerald-400 text-center">
            EarthSight Intelligence — Live On This Device
          </h2>
          <div className="mt-8">
            <LiveStats />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-sm font-medium uppercase tracking-wider text-emerald-400">
              How It Works
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              From a photo to a forecasted risk score.
            </p>
            <Link
              href="/how-it-works"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300"
            >
              See the full technical breakdown (9 stages) →
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: Camera,
                title: "Report",
                desc: "Citizens report environmental hazards with photographic evidence and location data.",
              },
              {
                step: "02",
                icon: Brain,
                title: "Analyze",
                desc: "EarthSight evaluates the hazard and combines it with real environmental conditions.",
              },
              {
                step: "03",
                icon: CloudLightning,
                title: "Anticipate",
                desc: "Upcoming rainfall and environmental forecasts reveal which hazards could escalate.",
              },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div
                key={step}
                className="es-card rounded-3xl p-7 hover:border-emerald-400/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold text-white/10">{step}</span>
                  <Icon className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="mt-6 text-lg font-medium text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY EARTHSIGHT */}
      <section className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-sm font-medium uppercase tracking-wider text-emerald-400">
              Why EarthSight
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-semibold text-white tracking-tight">
              Prioritize before conditions change, not after.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Traditional Reporting
              </span>
              <p className="mt-4 text-xl text-zinc-300 leading-snug">
                &ldquo;Report problems after they become dangerous.&rdquo;
              </p>
              <p className="mt-4 text-sm text-zinc-500">
                Hazards sit in a queue. Nobody knows which ones are about to escalate until
                it&apos;s too late — after the flood, after the contamination, after the damage.
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/[0.05] p-8">
              <span className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                EarthSight
              </span>
              <p className="mt-4 text-xl text-white leading-snug">
                &ldquo;Identify and prioritize problems before environmental conditions make them
                dangerous.&rdquo;
              </p>
              <p className="mt-4 text-sm text-zinc-400">
                Every report is checked against real rainfall forecasts, so communities and
                authorities know exactly which hazards need attention before the next storm.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <MapIcon className="mx-auto h-8 w-8 text-emerald-400" />
          <h2 className="mt-5 text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Help build the priority map for your community.
          </h2>
          <p className="mt-4 text-zinc-400">
            It takes less than a minute to report a hazard and see its environmental
            intelligence.
          </p>
          <Link
            href="/report"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring"
          >
            Report a Hazard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <span>© {new Date().getFullYear()} EarthSight. Built for Earth Forward.</span>
          <span>See environmental risks before they become disasters.</span>
        </div>
      </footer>
    </div>
  );
}
