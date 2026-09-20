"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileWarning } from "lucide-react";

import ReportForm from "@/components/ReportForm";
import HazardIntelligence from "@/components/HazardIntelligence";
import { getHazardById } from "@/lib/storage";
import { HazardReport } from "@/types/hazard";

function ReportPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [report, setReport] = useState<HazardReport | null | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setReport(undefined);
      return;
    }
    setReport(getHazardById(id) ?? null);
  }, [id]);

  if (id) {
    if (report === undefined) {
      return <div className="pt-32 text-center text-zinc-500">Loading intelligence...</div>;
    }
    if (report === null) {
      return (
        <div className="mx-auto max-w-md px-4 py-40 text-center">
          <FileWarning className="mx-auto h-10 w-10 text-zinc-600" />
          <h1 className="mt-4 text-xl font-semibold text-white">Report not found</h1>
          <p className="mt-2 text-sm text-zinc-500">
            This hazard report doesn&apos;t exist or may have been cleared from local storage.
          </p>
          <Link
            href="/map"
            className="mt-6 inline-flex items-center rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors"
          >
            Back to Live Map
          </Link>
        </div>
      );
    }
    return <HazardIntelligence report={report} />;
  }

  return <ReportForm />;
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-zinc-500">Loading...</div>}>
      <ReportPageInner />
    </Suspense>
  );
}
