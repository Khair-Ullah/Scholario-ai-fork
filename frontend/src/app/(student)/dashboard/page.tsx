"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type Profile = {
  origin_country?: string | null;
  target_level?: string | null;
  host_countries?: string[] | null;
  fields_of_study?: string[] | null;
  ielts_status?: string | null;
  gpa_scale?: string | null;
  gpa_value?: number | null;
  gpa_4_equivalent?: number | null;
  bs_marks_obtained?: number | null;
  bs_marks_total?: number | null;
  funding_preference?: string | null;
};

type OnboardingResponse = {
  full_name: string;
  profile: Profile | null;
  onboarding_step: number;
  onboarding_completed: boolean;
};

type MatchItem = {
  scholarship_id: string;
  title: string;
  university_name: string;
  host_country: string;
  scholarship_type: string;
  deadline_date: string | null;
  deadline_kind: string;
  selection_ratio_percent: number | null;
  chance_label: string;
};

type MatchResponse = {
  items: MatchItem[];
  total: number;
  message?: string;
};

type Application = {
  id: number;
  scholarship_id: string;
  status: string;
  next_step: string | null;
  next_step_date: string | null;
  scholarship: {
    title: string;
    university_name: string;
    host_country: string;
    deadline_date: string | null;
  };
};

type ChecklistItem = {
  id: number;
  title: string;
  is_done: boolean;
  due_date: string | null;
  category: string | null;
};

type SavedRow = {
  scholarship_id: string;
  scholarship: {
    title: string;
    host_country: string;
    deadline_date: string | null;
  };
};

type Deadline = {
  date: Date;
  label: string;
  meta: string;
  href: string;
  days: number;
};

type NextStep = {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

const closedStatuses = new Set(["accepted", "rejected", "withdrawn"]);

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntil(date: Date): number {
  return Math.round(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function deadlineLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d left`;
}

export default function DashboardPage() {
  const [name, setName] = useState("there");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [matches, setMatches] = useState<MatchResponse | null>(null);
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [saved, setSaved] = useState<SavedRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        apiFetch<OnboardingResponse>("/api/onboarding"),
        apiFetch<MatchResponse>("/api/scholarships/match", {
          method: "POST",
          body: JSON.stringify({ page: 1, page_size: 5 }),
        }),
        apiFetch<Application[]>("/api/applications"),
        apiFetch<ChecklistItem[]>("/api/checklist"),
        apiFetch<SavedRow[]>("/api/saved"),
      ]);

      if (!active) return;

      const [onboarding, matchResult, applicationResult, checklistResult, savedResult] =
        results;

      if (onboarding.status === "fulfilled") {
        setName(onboarding.value.full_name.split(" ")[0] || "there");
        setProfile(onboarding.value.profile);
        setOnboardingComplete(onboarding.value.onboarding_completed);
      }
      if (matchResult.status === "fulfilled") setMatches(matchResult.value);
      if (applicationResult.status === "fulfilled") {
        setApplications(applicationResult.value);
      }
      if (checklistResult.status === "fulfilled") {
        setChecklist(checklistResult.value);
      }
      if (savedResult.status === "fulfilled") setSaved(savedResult.value);

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length === results.length) {
        setError("We could not load your dashboard. Please try again.");
      } else if (failures.length > 0) {
        setError(
          "Some dashboard details could not load. The rest of your workspace is still available.",
        );
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const applicationList = applications ?? [];
  const checklistList = checklist ?? [];
  const savedList = saved ?? [];
  const checklistDone = checklistList.filter((item) => item.is_done).length;
  const checklistTotal = checklistList.length;
  const activeApplications = applicationList.filter(
    (item) => !closedStatuses.has(item.status),
  );
  const activeApplication = activeApplications[0];

  const checks = [
    { label: "Study level", done: Boolean(profile?.target_level) },
    { label: "IELTS plan", done: Boolean(profile?.ielts_status) },
    { label: "Destinations", done: Boolean(profile?.host_countries?.length) },
    { label: "Field of study", done: Boolean(profile?.fields_of_study?.length) },
    {
      label: "Academic score",
      done:
        profile?.gpa_4_equivalent != null ||
        profile?.gpa_value != null ||
        (profile?.bs_marks_obtained != null &&
          profile?.bs_marks_total != null),
    },
    { label: "Home country", done: Boolean(profile?.origin_country) },
  ];
  const completedChecks = checks.filter((item) => item.done).length;
  const completion = Math.round((completedChecks / checks.length) * 100);

  let nextStep: NextStep;

  if (!onboardingComplete) {
    nextStep = {
      eyebrow: "NEXT BEST STEP",
      title: "Finish your study preferences",
      detail:
        "Add your degree, destinations and IELTS plan so matching can do the heavy lifting.",
      href: "/onboarding",
      cta: "Continue setup",
    };
  } else if (activeApplication?.next_step) {
    const nextDate = parseDate(activeApplication.next_step_date);
    nextStep = {
      eyebrow: "YOUR APPLICATION",
      title: activeApplication.next_step,
      detail: `${activeApplication.scholarship?.title ?? "Your application"}${
        nextDate ? ` · due ${shortDate(nextDate)}` : ""
      }`,
      href: "/tracker",
      cta: "Open tracker",
    };
  } else if (matches?.total && applicationList.length === 0) {
    nextStep = {
      eyebrow: "READY WHEN YOU ARE",
      title: `Start with one of your ${matches.total} matches`,
      detail:
        "Open a scholarship, check the requirements, then add it to your tracker.",
      href: "/scholarships",
      cta: "Browse matches",
    };
  } else if (checklistTotal > checklistDone) {
    nextStep = {
      eyebrow: "KEEP THINGS MOVING",
      title: "Finish the next checklist item",
      detail: `${checklistTotal - checklistDone} item${
        checklistTotal - checklistDone === 1 ? "" : "s"
      } still need your attention.`,
      href: "/checklist",
      cta: "Open checklist",
    };
  } else if (matches?.total) {
    nextStep = {
      eyebrow: "A GOOD PLACE TO LOOK",
      title: "Review your strongest matches",
      detail:
        "Compare deadlines and requirements, then save the ones worth pursuing.",
      href: "/scholarships",
      cta: "View matches",
    };
  } else {
    nextStep = {
      eyebrow: "MAKE YOUR MATCHES WIDER",
      title: "Adjust your study preferences",
      detail:
        "Try another destination or field of study to open up more scholarship options.",
      href: "/onboarding",
      cta: "Edit preferences",
    };
  }

  const deadlines: Deadline[] = [];

  applicationList.forEach((item) => {
    const date = parseDate(
      item.next_step_date ?? item.scholarship?.deadline_date ?? null,
    );
    if (!date) return;
    deadlines.push({
      date,
      label: item.next_step || item.scholarship?.title || "Application step",
      meta: item.scholarship?.title || "Application tracker",
      href: "/tracker",
      days: daysUntil(date),
    });
  });

  checklistList
    .filter((item) => !item.is_done)
    .forEach((item) => {
      const date = parseDate(item.due_date);
      if (!date) return;
      deadlines.push({
        date,
        label: item.title,
        meta: item.category || "Checklist",
        href: "/checklist",
        days: daysUntil(date),
      });
    });

  (matches?.items ?? []).forEach((item) => {
    const date = parseDate(item.deadline_date);
    if (!date) return;
    deadlines.push({
      date,
      label: item.title,
      meta: `${item.university_name} · ${item.host_country}`,
      href: `/scholarships/${item.scholarship_id}`,
      days: daysUntil(date),
    });
  });

  const seenDeadlines = new Set<string>();
  const upcoming = deadlines
    .sort((first, second) => first.date.getTime() - second.date.getTime())
    .filter((item) => {
      const key = `${item.label.trim().toLowerCase()}|${item.date.toDateString()}`;
      if (seenDeadlines.has(key)) return false;
      seenDeadlines.add(key);
      return true;
    })
    .slice(0, 5);

  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">YOUR SCHOLARSHIP DESK</p>
          <h1>Good to see you, {name}.</h1>
          <p className="page-subtitle">
            A steady place to plan what comes next. Here is what needs your
            attention today.
          </p>
          <p className="dashboard-date" suppressHydrationWarning>{todayLabel}</p>
        </div>

        <div className="dashboard-readiness">
          <div
            className="completion-ring"
            style={{ "--value": `${completion}%` } as CSSProperties}
          >
            <span>
              <strong>{loading ? "–" : `${completion}%`}</strong>
              <small>ready</small>
            </span>
          </div>
          <div className="dashboard-readiness-copy">
            <p>Profile readiness</p>
            <span>
              {loading
                ? "Checking your details"
                : `${completedChecks} of ${checks.length} details complete`}
            </span>
            <Link href="/onboarding" className="text-link">
              {completion === 100 ? "Review preferences" : "Finish profile"}
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="dashboard-error">
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="outline-button"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      )}

      <section className="dashboard-next">
        <span className="dashboard-next-icon">
          <Sparkles size={20} />
        </span>
        <div className="dashboard-next-copy">
          <p className="welcome-kicker">{nextStep.eyebrow}</p>
          <strong>{nextStep.title}</strong>
          <span>{nextStep.detail}</span>
        </div>
        <Link href={nextStep.href} className="dashboard-next-link">
          {nextStep.cta}
          <ArrowRight size={16} />
        </Link>
      </section>

      <section className="dashboard-stats" aria-label="Workspace summary">
        <Link className="dashboard-stat" href="/scholarships">
          <span className="dashboard-stat-top">
            <span className="dashboard-stat-icon teal">
              <Compass size={18} />
            </span>
            <ArrowRight size={14} />
          </span>
          <strong>{loading ? "–" : matches?.total ?? 0}</strong>
          <span>Matched scholarships</span>
          <small>{matches?.message ? "Finish setup to see matches" : "Based on your profile"}</small>
        </Link>
        <Link className="dashboard-stat" href="/saved">
          <span className="dashboard-stat-top">
            <span className="dashboard-stat-icon gold">
              <Bookmark size={18} />
            </span>
            <ArrowRight size={14} />
          </span>
          <strong>{loading ? "–" : savedList.length}</strong>
          <span>Saved scholarships</span>
          <small>Your shortlist in one place</small>
        </Link>
        <Link className="dashboard-stat" href="/tracker">
          <span className="dashboard-stat-top">
            <span className="dashboard-stat-icon green">
              <ClipboardCheck size={18} />
            </span>
            <ArrowRight size={14} />
          </span>
          <strong>{loading ? "–" : activeApplications.length}</strong>
          <span>Active applications</span>
          <small>
            {activeApplication
              ? `Next: ${activeApplication.next_step || "keep moving"}`
              : "Nothing in progress yet"}
          </small>
        </Link>
        <Link className="dashboard-stat" href="/checklist">
          <span className="dashboard-stat-top">
            <span className="dashboard-stat-icon clay">
              <CheckCircle2 size={18} />
            </span>
            <ArrowRight size={14} />
          </span>
          <strong>
            {loading ? "–" : `${checklistDone}/${checklistTotal}`}
          </strong>
          <span>Checklist complete</span>
          <small>
            {checklistTotal === 0
              ? "Add your first task"
              : `${checklistTotal - checklistDone} tasks left`}
          </small>
        </Link>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="eyebrow">DATES TO WATCH</p>
              <h2>Upcoming deadlines</h2>
            </div>
            <Link href="/tracker" className="text-link">
              Tracker <ArrowRight size={14} />
            </Link>
          </div>

          {upcoming.length > 0 ? (
            <div className="deadline-list">
              {upcoming.map((item) => (
                <Link
                  className="deadline-row"
                  href={item.href}
                  key={`${item.href}-${item.label}-${item.date.toISOString()}`}
                >
                  <span
                    className={`deadline-date${
                      item.days < 0
                        ? " is-overdue"
                        : item.days <= 14
                          ? " is-soon"
                          : ""
                    }`}
                  >
                    <strong>{item.date.getDate()}</strong>
                    <small>
                      {item.date.toLocaleDateString("en-GB", {
                        month: "short",
                      })}
                    </small>
                  </span>
                  <span className="deadline-copy">
                    <strong>{item.label}</strong>
                    <span>{item.meta}</span>
                  </span>
                  <span
                    className={`deadline-days${
                      item.days < 0
                        ? " is-overdue"
                        : item.days <= 14
                          ? " is-soon"
                          : ""
                    }`}
                  >
                    {deadlineLabel(item.days)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <CalendarClock size={22} />
              <strong>No deadlines on the calendar yet.</strong>
              <span>
                Add a scholarship to your tracker or create a checklist item
                with a due date.
              </span>
              <Link href="/tracker" className="text-link">
                Open tracker <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="eyebrow">A FIRST LOOK</p>
              <h2>Your top matches</h2>
            </div>
            <Link href="/scholarships" className="text-link">
              See all <ArrowRight size={14} />
            </Link>
          </div>

          {matches?.items?.length ? (
            <div className="match-list dashboard-match-list">
              {matches.items.slice(0, 4).map((item) => {
                const deadline = parseDate(item.deadline_date);
                return (
                  <Link
                    className="match-row"
                    href={`/scholarships/${item.scholarship_id}`}
                    key={item.scholarship_id}
                  >
                    <span className="match-symbol">
                      <GraduationCap size={17} />
                    </span>
                    <span className="match-main">
                      <strong>{item.title}</strong>
                      <small>
                        {item.university_name} · {item.host_country}
                      </small>
                      {deadline && (
                        <small className="match-deadline">
                          Deadline {shortDate(deadline)}
                        </small>
                      )}
                    </span>
                    <span className="chance-tag">{item.chance_label}</span>
                    <ArrowRight size={15} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty">
              <Compass size={22} />
              <strong>
                {matches?.message || "No matches just yet."}
              </strong>
              <span>
                Complete your study preferences and we will surface
                scholarships that fit.
              </span>
              <Link href="/onboarding" className="text-link">
                Set preferences <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-quick" aria-label="Quick actions">
        <Link href="/scholarships">
          <span className="quick-icon teal">
            <Compass size={18} />
          </span>
          <span>
            <strong>Explore scholarships</strong>
            <small>Browse the catalogue</small>
          </span>
          <ArrowRight size={15} />
        </Link>
        <Link href="/checklist">
          <span className="quick-icon gold">
            <ClipboardCheck size={18} />
          </span>
          <span>
            <strong>Build a checklist</strong>
            <small>Keep the next step small</small>
          </span>
          <ArrowRight size={15} />
        </Link>
        <Link href="/templates">
          <span className="quick-icon green">
            <FileText size={18} />
          </span>
          <span>
            <strong>Prepare a document</strong>
            <small>Start with a template</small>
          </span>
          <ArrowRight size={15} />
        </Link>
        <Link href="/sop-reviewer">
          <span className="quick-icon clay">
            <Sparkles size={18} />
          </span>
          <span>
            <strong>Review your SOP</strong>
            <small>Get focused feedback</small>
          </span>
          <ArrowRight size={15} />
        </Link>
      </section>
    </div>
  );
}
