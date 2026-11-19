"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Send,
  UserCircle,
  Users,
} from "lucide-react";
import { Skeleton } from "@/admin/components/Skeleton";
import {
  consultantApi,
  type ConsultantApplicant,
  type ConsultantProfile,
  type ConsultantStats,
} from "@/consultant/api";

function ConsultantStat({
  href,
  icon: Icon,
  tone,
  value,
  label,
  detail,
  loading,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number | string }>;
  tone: "teal" | "gold" | "green" | "clay";
  value: number | null | undefined;
  label: string;
  detail: string;
  loading: boolean;
}) {
  return (
    <Link className="consultant-stat" href={href}>
      <span className="consultant-stat-top">
        <span className={`consultant-stat-icon ${tone}`}>
          <Icon size={17} />
        </span>
        <ArrowRight size={14} />
      </span>
      <strong>{loading || value === null || value === undefined ? "–" : value.toLocaleString()}</strong>
      <span className="consultant-stat-label">{label}</span>
      <small>{detail}</small>
    </Link>
  );
}

function initials(applicant: ConsultantApplicant): string {
  const source = applicant.full_name?.trim() || applicant.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function ConsultantDashboardPage() {
  const [stats, setStats] = useState<ConsultantStats | null>(null);
  const [applicants, setApplicants] = useState<ConsultantApplicant[] | null>(null);
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applicantsFailed, setApplicantsFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      consultantApi.stats(),
      consultantApi.listApplicants({ page: 1, page_size: 5 }),
      consultantApi.getProfile(),
    ]).then(([statsResult, applicantsResult, profileResult]) => {
      if (!active) return;

      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }
      if (applicantsResult.status === "fulfilled") {
        setApplicants(applicantsResult.value.items);
      } else {
        setApplicants([]);
        setApplicantsFailed(true);
      }
      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      }

      if (statsResult.status === "rejected") {
        setError("Dashboard metrics could not load. Please try again.");
      } else if (applicantsResult.status === "rejected") {
        setError("Some applicant details could not load. The rest of your workspace is still available.");
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function retry() {
    setLoading(true);
    setError("");
    setApplicantsFailed(false);
    setApplicants(null);
    setReloadKey((key) => key + 1);
  }

  const totalScholarships = stats?.scholarships ?? 0;
  const activeScholarships = stats?.active_scholarships ?? 0;
  const pausedScholarships = Math.max(0, totalScholarships - activeScholarships);
  const activeShare =
    totalScholarships > 0 ? Math.round((activeScholarships / totalScholarships) * 100) : 0;
  const displayName = profile?.full_name?.trim() || "there";
  const warnings = stats?.open_warnings ?? 0;
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="admin-page consultant-dash">
      <section className="consultant-hero">
        <div>
          <p className="admin-eyebrow">CONSULTANT DESK</p>
          <h1>Welcome back, {displayName}.</h1>
          <p className="consultant-hero-sub">
            A clear view of your catalogue, student interest and the tasks that need attention.
          </p>
          <p className="consultant-hero-date" suppressHydrationWarning>
            {todayLabel}
          </p>
        </div>
        <div className="consultant-health">
          <div
            className="consultant-ring"
            style={{ "--value": loading ? "0%" : `${activeShare}%` } as CSSProperties}
          >
            <span>
              <strong>{loading || !stats ? "–" : `${activeShare}%`}</strong>
              <small>active</small>
            </span>
          </div>
          <div className="consultant-health-copy">
            <strong>Catalogue status</strong>
            <span>
              {loading
                ? "Checking your listings"
                : !stats
                  ? "Catalogue unavailable"
                  : totalScholarships > 0
                    ? `${activeScholarships} of ${totalScholarships} listings live`
                    : "No listings yet"}
            </span>
            <Link className="consultant-text-link" href="/consultant/scholarships">
              {!stats ? "Open scholarships" : totalScholarships > 0 ? "Manage listings" : "Add your first listing"}
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="consultant-error">
          <p className="form-error" role="alert">
            {error}
          </p>
          <button type="button" className="admin-outline" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {warnings > 0 && (
        <div className="consultant-alert" role="status">
          <span className="consultant-alert-icon">
            <AlertTriangle size={18} />
          </span>
          <div>
            <strong>
              {warnings} open warning{warnings === 1 ? "" : "s"}
            </strong>
            <span>
              Review the note{warnings === 1 ? "" : "s"} from Scholario before publishing more listings.
            </span>
          </div>
          <Link className="consultant-alert-link" href="/consultant/warnings">
            Review <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <section className="consultant-stats" aria-label="Consultant summary">
        <ConsultantStat
          href="/consultant/scholarships"
          icon={FileSpreadsheet}
          tone="teal"
          value={stats?.scholarships}
          label="My scholarships"
          detail={
            loading
              ? "Loading catalogue"
              : stats
                ? `${activeScholarships} active · ${pausedScholarships} paused`
                : "Catalogue unavailable"
          }
          loading={loading}
        />
        <ConsultantStat
          href="/consultant/scholarships"
          icon={CheckCircle2}
          tone="green"
          value={stats?.active_scholarships}
          label="Active listings"
          detail="Visible to students"
          loading={loading}
        />
        <ConsultantStat
          href="/consultant/applicants"
          icon={Users}
          tone="gold"
          value={stats?.applicants}
          label="Applicants"
          detail="Students who saved or applied"
          loading={loading}
        />
        <ConsultantStat
          href="/consultant/applicants"
          icon={Send}
          tone="clay"
          value={stats?.applications}
          label="Applications"
          detail="Tracked across your listings"
          loading={loading}
        />
      </section>

      <div className="consultant-grid">
        <section className="consultant-panel consultant-applicants">
          <div className="consultant-panel-head">
            <div>
              <p className="admin-eyebrow">RECENT ACTIVITY</p>
              <h2>Latest applicants</h2>
            </div>
            <Link className="consultant-text-link" href="/consultant/applicants">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {applicants === null ? (
            <div className="consultant-loading-list" aria-label="Loading applicants">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} />
              ))}
            </div>
          ) : applicantsFailed ? (
            <div className="consultant-empty">
              <Users size={22} />
              <strong>Applicant activity is unavailable right now.</strong>
              <span>Try again in a moment. Your other workspace details are unaffected.</span>
            </div>
          ) : applicants.length > 0 ? (
            <div className="consultant-applicant-list">
              {applicants.map((applicant) => {
                const meta = [applicant.origin_country, applicant.target_level]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div className="consultant-applicant" key={applicant.id}>
                    <span className="consultant-avatar">{initials(applicant)}</span>
                    <span className="consultant-applicant-copy">
                      <strong>{applicant.full_name || applicant.email}</strong>
                      <small>{applicant.full_name ? applicant.email : "Student account"}</small>
                      {meta && <small className="consultant-applicant-meta">{meta}</small>}
                    </span>
                    <span className="consultant-applicant-stats">
                      <span title={`${applicant.saves} saves`}>
                        <Bookmark size={13} /> {applicant.saves}
                      </span>
                      <span title={`${applicant.applications} applications`}>
                        <Send size={13} /> {applicant.applications}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="consultant-empty">
              <Users size={22} />
              <strong>No applicants yet.</strong>
              <span>When students save or apply to your listings, they will appear here.</span>
              <Link className="consultant-text-link" href="/consultant/scholarships">
                Review your listings <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </section>

        <aside className="consultant-side">
          <section className="consultant-panel consultant-interest">
            <div className="consultant-panel-head">
              <div>
                <p className="admin-eyebrow">STUDENT INTEREST</p>
                <h2>Saves</h2>
              </div>
              <Bookmark size={18} />
            </div>
            <div className="consultant-interest-value">
              <strong>{loading || stats === null ? "–" : (stats.saves ?? 0).toLocaleString()}</strong>
              <span>across your published listings</span>
            </div>
            <p>Students who bookmarked one of your opportunities. Applications are tracked separately.</p>
            <Link className="consultant-text-link" href="/consultant/applicants">
              See interested students <ArrowRight size={13} />
            </Link>
          </section>

          <section className="consultant-panel">
            <div className="consultant-panel-head">
              <div>
                <p className="admin-eyebrow">QUICK ACTIONS</p>
                <h2>Common tasks</h2>
              </div>
            </div>
            <div className="consultant-actions">
              <Link href="/consultant/scholarships">
                <span className="consultant-action-icon teal">
                  <Plus size={16} />
                </span>
                <span>
                  <strong>Add a scholarship</strong>
                  <small>Publish or edit an opportunity</small>
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/consultant/applicants">
                <span className="consultant-action-icon gold">
                  <Users size={16} />
                </span>
                <span>
                  <strong>Review applicants</strong>
                  <small>See who saved or applied</small>
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/consultant/warnings">
                <span className="consultant-action-icon clay">
                  <AlertTriangle size={16} />
                </span>
                <span>
                  <strong>Check warnings</strong>
                  <small>Read notes from the team</small>
                </span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/consultant/profile">
                <span className="consultant-action-icon green">
                  <UserCircle size={16} />
                </span>
                <span>
                  <strong>Update your profile</strong>
                  <small>Keep your account details current</small>
                </span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
