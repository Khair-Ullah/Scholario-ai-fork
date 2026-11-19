"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  GraduationCap,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type Match = {
  scholarship_id: string;
  title: string;
  university_name: string;
  host_country: string;
  level: string;
  scholarship_type: string;
  ielts_tier: number;
  deadline_date: string | null;
  deadline_kind: string;
  selection_ratio_percent: number | null;
  stipend_monthly_usd: string | null;
  chance_label: string;
  fields_list?: string[];
};

type Facets = {
  host_country?: Record<string, number>;
  field?: Record<string, number>;
  ielts_tier?: Record<string, number>;
  scholarship_type?: Record<string, number>;
};

type Results = {
  items: Match[];
  total: number;
  page: number;
  page_size: number;
  gpa_missing?: boolean;
  final_tier_cap?: number;
  facets?: Facets;
  message?: string;
};

type Filters = {
  country: string;
  field: string;
  awardType: string;
  ieltsTier: string;
};

const emptyFilters: Filters = {
  country: "",
  field: "",
  awardType: "",
  ieltsTier: "",
};

const PAGE_SIZE = 20;

export default function ScholarshipsPage() {
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("best_chance");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () => {
        if (!active) return;
        setLoading(true);
        setError("");
        apiFetch<Results>("/api/scholarships/match", {
          method: "POST",
          body: JSON.stringify({
            page,
            page_size: PAGE_SIZE,
            q: query.trim() || undefined,
            country: filters.country ? [filters.country] : undefined,
            field: filters.field ? [filters.field] : undefined,
            award_type: filters.awardType || undefined,
            ielts_tier:
              filters.ieltsTier === "" ? undefined : Number(filters.ieltsTier),
            sort,
          }),
        })
          .then((data) => {
            if (active) setResults(data);
          })
          .catch((cause) => {
            if (active) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not load matches.",
              );
            }
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      query ? 280 : 0,
    );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    page,
    query,
    sort,
    filters.country,
    filters.field,
    filters.awardType,
    filters.ieltsTier,
    reloadKey,
  ]);

  const facets = results?.facets;
  const countryOptions = facetEntries(facets?.host_country).slice(0, 10);
  const fieldOptions = facetEntries(facets?.field)
    .filter(([value]) => value !== "General / Any Field of Study")
    .slice(0, 8);
  const typeOptions = facetEntries(facets?.scholarship_type).slice(0, 6);
  const tierOptions = facetEntries(facets?.ielts_tier);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const total = results?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  function updateFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(1);
  }

  function clearEverything() {
    setQuery("");
    clearFilters();
  }

  function goToPage(next: number) {
    setPage(Math.max(1, Math.min(totalPages, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="page-stack matches-page">
      <section className="matches-hero">
        <div className="matches-hero-copy">
          <p className="eyebrow">YOUR MATCHED SHORTLIST</p>
          <h1>
            Good opportunities.
            <br />
            <em>A better fit.</em>
          </h1>
          <p className="matches-lede">
            Ranked using your degree, IELTS plan, destinations and academic
            profile. Every chance figure is an estimate, so confirm eligibility
            with the official source.
          </p>
          <div className="matches-hero-actions">
            <Link className="outline-button" href="/onboarding">
              <SlidersHorizontal size={15} /> Edit preferences
            </Link>
            <span className="matches-refresh-note">
              <Sparkles size={14} /> Matches refresh with your profile
            </span>
          </div>
        </div>
        <div className="matches-hero-stats">
          <div>
            <strong>{results ? total.toLocaleString() : "-"}</strong>
            <span>matched</span>
          </div>
          <div>
            <strong>
              {facets?.host_country
                ? Object.keys(facets.host_country).length
                : "-"}
            </strong>
            <span>destinations</span>
          </div>
          <div>
            <strong>
              {facets?.scholarship_type
                ? Object.keys(facets.scholarship_type).length
                : "-"}
            </strong>
            <span>award types</span>
          </div>
        </div>
      </section>

      {results?.gpa_missing && (
        <div className="notice-strip matches-notice">
          <Sparkles size={16} />
          <span>Add your academic score for sharper, more accurate matches.</span>
          <Link href="/onboarding">
            Add score <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {error && (
        <div className="matches-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {results?.message ? (
        <div className="empty-state matches-profile-empty">
          <Compass size={26} />
          <strong>Your preferences will shape this list.</strong>
          <span>{results.message}</span>
          <Link className="primary-button" href="/onboarding">
            Set study preferences <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <>
          <section className="matches-toolbar" aria-label="Search and filter matches">
            <label className="matches-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search scholarship, university or country"
                aria-label="Search your matches"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <button
              type="button"
              className={`matches-filter-trigger${filtersOpen ? " active" : ""}`}
              aria-expanded={filtersOpen}
              aria-controls="match-filters"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal size={15} /> Filters
              {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            </button>
            <label className="matches-sort">
              Sort by
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="best_chance">Best chance</option>
                <option value="deadline">Deadline soonest</option>
                <option value="funding">Highest funding</option>
                <option value="newest">Newest added</option>
              </select>
            </label>
          </section>

          {activeFilterCount > 0 && (
            <div className="matches-active-filters">
              <span>Filtered by</span>
              {filters.country && (
                <FilterChip
                  label={filters.country}
                  onRemove={() => updateFilters({ country: "" })}
                />
              )}
              {filters.field && (
                <FilterChip
                  label={filters.field}
                  onRemove={() => updateFilters({ field: "" })}
                />
              )}
              {filters.awardType && (
                <FilterChip
                  label={filters.awardType}
                  onRemove={() => updateFilters({ awardType: "" })}
                />
              )}
              {filters.ieltsTier !== "" && (
                <FilterChip
                  label={ietlsTierLabel(Number(filters.ieltsTier))}
                  onRemove={() => updateFilters({ ieltsTier: "" })}
                />
              )}
              <button type="button" className="text-button" onClick={clearFilters}>
                Clear all
              </button>
            </div>
          )}

          <div className="matches-browser">
            <aside
              className={`matches-filters${filtersOpen ? " is-open" : ""}`}
              id="match-filters"
              aria-label="Filter matches"
            >
              <div className="matches-filters-head">
                <div>
                  <p className="eyebrow">REFINE</p>
                  <strong>Narrow the shortlist</strong>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={clearFilters}
                  >
                    Reset
                  </button>
                )}
              </div>

              {facets ? (
                <>
                  <FilterGroup
                    title="Destination"
                    options={countryOptions}
                    value={filters.country}
                    onChange={(value) => updateFilters({ country: value })}
                  />
                  <FilterGroup
                    title="Field"
                    options={fieldOptions}
                    value={filters.field}
                    onChange={(value) => updateFilters({ field: value })}
                  />
                  <FilterGroup
                    title="Award type"
                    options={typeOptions}
                    value={filters.awardType}
                    onChange={(value) => updateFilters({ awardType: value })}
                  />
                  <FilterGroup
                    title="IELTS requirement"
                    options={tierOptions}
                    value={filters.ieltsTier}
                    onChange={(value) => updateFilters({ ieltsTier: value })}
                    formatLabel={(value) => ietlsTierLabel(Number(value))}
                  />
                </>
              ) : (
                <p className="matches-filter-empty">Filters load with your matches.</p>
              )}

              <button
                type="button"
                className="matches-filter-done"
                onClick={() => setFiltersOpen(false)}
              >
                Show {total.toLocaleString()} matches
              </button>
            </aside>

            <div className="matches-results" aria-busy={loading}>
              <div className="matches-meta">
                <span>
                  {results
                    ? total === 0
                      ? "No matches in this view"
                      : `Showing ${rangeStart}-${rangeEnd} of ${total.toLocaleString()}`
                    : "Finding your matches"}
                </span>
                {loading && results && (
                  <span className="matches-updating">
                    <Loader2 size={13} /> Updating
                  </span>
                )}
              </div>

              {loading && !results ? (
                <div className="matches-grid" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div className="match-skeleton" key={index}>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : results && results.items.length === 0 ? (
                <div className="empty-state matches-empty">
                  <Search size={25} />
                  <strong>No scholarships match this view.</strong>
                  <span>
                    Try a broader search, remove a filter, or update your study
                    preferences.
                  </span>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={clearEverything}
                  >
                    Clear search & filters
                  </button>
                </div>
              ) : results ? (
                <>
                  <div className="matches-grid">
                    {results.items.map((item, index) => {
                      const deadline = deadlineMeta(item);
                      const stipend = formatStipend(item.stipend_monthly_usd);
                      return (
                        <article className="match-card" key={item.scholarship_id}>
                          <div className="match-card-head">
                            <span className="match-rank">
                              #{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                            </span>
                            <span
                              className={`match-chance ${chanceTone(item.chance_label)}`}
                            >
                              {item.chance_label}
                            </span>
                          </div>
                          <div className="match-card-body">
                            <p className="match-award">
                              {item.scholarship_type || "Scholarship"}
                            </p>
                            <h2>
                              <Link href={`/scholarships/${item.scholarship_id}`}>
                                {item.title}
                              </Link>
                            </h2>
                            <p className="match-school">
                              <GraduationCap size={15} /> {item.university_name}
                              <span>·</span>
                              <MapPin size={14} /> {item.host_country}
                            </p>
                            <div className="match-facts">
                              <span>{item.level}</span>
                              <span>{ieltsLabel(item.ielts_tier)}</span>
                              <span className={deadline.urgent ? "urgent" : ""}>
                                <CalendarDays size={13} /> {deadline.label}
                              </span>
                            </div>
                            {stipend && (
                              <p className="match-stipend">
                                <Wallet size={14} /> {stipend}
                              </p>
                            )}
                          </div>
                          <div className="match-chance-panel">
                            <div>
                              <strong>
                                {item.selection_ratio_percent == null
                                  ? "-"
                                  : `${item.selection_ratio_percent}%`}
                              </strong>
                              <span>estimated selection ratio</span>
                            </div>
                            <div className="chance-meter">
                              <span
                                style={{
                                  width: `${Math.min(
                                    item.selection_ratio_percent || 0,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                          <Link
                            className="match-card-link"
                            href={`/scholarships/${item.scholarship_id}`}
                          >
                            See details <ArrowRight size={15} />
                          </Link>
                        </article>
                      );
                    })}
                  </div>

                  <div className="pagination matches-pagination">
                    <button
                      type="button"
                      className="outline-button"
                      disabled={page === 1 || loading}
                      onClick={() => goToPage(page - 1)}
                    >
                      Previous
                    </button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="outline-button"
                      disabled={page >= totalPages || loading}
                      onClick={() => goToPage(page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button type="button" className="matches-filter-chip" onClick={onRemove}>
      {label} <X size={12} />
    </button>
  );
}

function FilterGroup({
  title,
  options,
  value,
  onChange,
  formatLabel,
}: {
  title: string;
  options: [string, number][];
  value: string;
  onChange: (value: string) => void;
  formatLabel?: (value: string) => string;
}) {
  if (options.length === 0) return null;

  return (
    <section className="filter-group">
      <h3>{title}</h3>
      <div className="filter-option-list">
        {options.map(([option, count]) => (
          <button
            type="button"
            key={option}
            className={`filter-option${value === option ? " selected" : ""}`}
            aria-pressed={value === option}
            onClick={() => onChange(value === option ? "" : option)}
          >
            <span>{formatLabel ? formatLabel(option) : option}</span>
            <small>{count}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function facetEntries(values?: Record<string, number>): [string, number][] {
  return Object.entries(values ?? {}).sort((a, b) => b[1] - a[1]);
}

function ietlsTierLabel(tier: number) {
  if (tier === 0) return "No IELTS";
  if (tier === 1) return "IELTS 6+";
  if (tier === 2) return "IELTS 7+";
  return "IELTS 8+";
}

function ieltsLabel(tier: number) {
  return tier === 0 ? "No IELTS" : `${tier * 2 + 4}+ IELTS`;
}

function chanceTone(label: string) {
  if (label === "Good chance") return "good";
  if (label === "Moderate") return "moderate";
  return "competitive";
}

function deadlineMeta(item: Match): { label: string; urgent: boolean } {
  if (item.deadline_date) {
    const date = new Date(`${item.deadline_date}T00:00:00`);
    if (Number.isFinite(date.getTime())) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
      const dateLabel = date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      if (days < 0) return { label: `Closed ${dateLabel}`, urgent: false };
      if (days === 0) return { label: "Closes today", urgent: true };
      if (days <= 30) {
        return {
          label: `${days}d left · ${dateLabel}`,
          urgent: days <= 14,
        };
      }
      return { label: dateLabel, urgent: false };
    }
    return { label: item.deadline_date, urgent: false };
  }
  const kind = item.deadline_kind?.replace(/_/g, " ").trim();
  return {
    label: kind ? `Deadline: ${kind}` : "Deadline not listed",
    urgent: false,
  };
}

function formatStipend(value: string | null) {
  if (!value) return null;
  const amount = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!amount) return `${value} stipend`;
  return `$${amount.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}/month stipend`;
}
