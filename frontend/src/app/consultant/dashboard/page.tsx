"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bookmark, FileSpreadsheet, Send, Users } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { StatCard } from "@/admin/components/StatCard";
import { consultantApi, type ConsultantStats } from "@/consultant/api";

export default function ConsultantDashboardPage() {
  const [stats, setStats] = useState<ConsultantStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    consultantApi
      .stats()
      .then((loaded) => {
        if (active) setStats(loaded);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load statistics.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="CONSULTANT OVERVIEW"
        title="Your workspace"
        description="A snapshot of the scholarships you provide and the students engaging with them."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {(stats?.open_warnings ?? 0) > 0 && (
        <section className="admin-section">
          <div>
            <p className="admin-eyebrow">ATTENTION</p>
            <h2>
              <AlertTriangle size={18} /> You have {stats?.open_warnings} open warning(s)
            </h2>
            <p>Review platform warnings about your recent activity.</p>
          </div>
          <Link className="admin-outline" href="/consultant/warnings">
            Review warnings <ArrowRight size={14} />
          </Link>
        </section>
      )}
      <div className="admin-stat-grid">
        <StatCard label="My scholarships" value={stats?.scholarships} icon={FileSpreadsheet} href="/consultant/scholarships" />
        <StatCard label="Active listings" value={stats?.active_scholarships} icon={FileSpreadsheet} href="/consultant/scholarships" />
        <StatCard label="Applicants" value={stats?.applicants} icon={Users} href="/consultant/applicants" />
        <StatCard label="Saves" value={stats?.saves} icon={Bookmark} href="/consultant/applicants" />
        <StatCard label="Applications" value={stats?.applications} icon={Send} href="/consultant/applicants" />
        <StatCard label="Open warnings" value={stats?.open_warnings} icon={AlertTriangle} href="/consultant/warnings" />
      </div>

      <section className="admin-section">
        <div>
          <p className="admin-eyebrow">CATALOGUE</p>
          <h2>Provide a scholarship.</h2>
          <p>Add a new opportunity and manage the ones you already published.</p>
        </div>
        <Link className="admin-outline" href="/consultant/scholarships">
          Manage scholarships <ArrowRight size={14} />
        </Link>
      </section>
      <section className="admin-section">
        <div>
          <p className="admin-eyebrow">STUDENTS</p>
          <h2>See who is interested.</h2>
          <p>View students who saved or applied to your scholarships.</p>
        </div>
        <Link className="admin-outline" href="/consultant/applicants">
          View applicants <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}
