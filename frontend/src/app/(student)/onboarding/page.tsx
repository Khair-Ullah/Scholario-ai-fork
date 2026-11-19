"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type FormState = {
  full_name: string;
  origin_country: string;
  target_level: string;
  host_countries: string[];
  fields_of_study: string[];
  ielts_status: string;
  gpa_scale: string;
  gpa_value: number | "";
  gpa_4_equivalent: number | null;
  bs_marks_obtained: number | "";
  bs_marks_total: number | "";
  funding_preference: string;
  extra_preferences: Record<string, boolean>;
  intake_preference: string;
};

const blank: FormState = {
  full_name: "",
  origin_country: "Pakistan",
  target_level: "",
  host_countries: [],
  fields_of_study: [],
  ielts_status: "",
  gpa_scale: "4.0",
  gpa_value: "",
  gpa_4_equivalent: null,
  bs_marks_obtained: "",
  bs_marks_total: 1100,
  funding_preference: "any",
  extra_preferences: {},
  intake_preference: "",
};

const fieldOptions = [
  "General / Any Field of Study",
  "Social Sciences",
  "Natural Sciences",
  "Business & Economics",
  "Health & Medical Sciences",
  "Engineering & Technology",
  "Arts & Humanities",
];

const preferenceOptions = [
  "Work allowed during study",
  "Health insurance included",
  "Language course included",
  "Family support",
  "No application fee",
  "Rolling admissions",
  "Higher stipend",
  "Short programs",
  "Final-year students can apply",
  "No attestation needed",
];

const stepNames = [
  "Your name",
  "Where you're from",
  "Your next degree",
  "Where to study",
  "Your subject",
  "English test",
  "Academic score",
  "Funding preference",
  "Nice-to-haves",
  "Review",
];

const levels = [
  { value: "Undergraduate", label: "Bachelor's (Undergraduate)" },
  { value: "Master", label: "Master's" },
  { value: "PhD", label: "PhD" },
];

const ieltsOptions = [
  { value: "not_taking", label: "I don't want to take IELTS" },
  { value: "taking_6", label: "I can score 6+" },
  { value: "taking_7", label: "I can score 7+" },
  { value: "taking_8", label: "I can score 8+" },
];

const fundingOptions = [
  { value: "full_tuition", label: "Full tuition waiver" },
  { value: "partial", label: "Partial waiver" },
  { value: "with_stipend", label: "Monthly stipend" },
  { value: "any", label: "Show me everything" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(blank);
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);

  const filteredDestinations = destinations
    .filter((country) =>
      country.toLowerCase().includes(countrySearch.toLowerCase()),
    )
    .slice(0, 30);
  const hasMarks =
    form.bs_marks_obtained !== "" &&
    form.bs_marks_total !== "" &&
    Number(form.bs_marks_total) > 0;
  const marksPercentage = hasMarks
    ? (Number(form.bs_marks_obtained) / Number(form.bs_marks_total)) * 100
    : null;
  const marksG4 =
    marksPercentage === null ? null : percentageToG4(marksPercentage);
  const academicSummary =
    form.target_level === "Undergraduate"
      ? marksG4 === null
        ? "Not added"
        : `${marksG4.toFixed(2)} / 4.0 equivalent`
      : form.gpa_4_equivalent !== null
        ? `${form.gpa_4_equivalent} / 4.0 equivalent`
        : "Not added";
  const selectedPreferences = Object.values(form.extra_preferences).filter(
    Boolean,
  ).length;

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const [saved, allCountries, hostCountryRows] = await Promise.all([
        apiFetch<{
          full_name: string;
          onboarding_step: number;
          profile: Partial<FormState> | null;
        }>("/api/onboarding"),
        apiFetch<string[]>("/api/meta/countries").catch(() => []),
        apiFetch<{ country: string; count: number }[]>(
          "/api/meta/host-countries",
        ).catch(() => []),
      ]);
      setCountries(allCountries.filter((country) => country !== "Antarctica"));
      setDestinations(
        hostCountryRows.length > 0
          ? hostCountryRows.map((item) => item.country)
          : allCountries.filter((country) => country !== "Antarctica"),
      );
      setForm((current) =>
        hydrateForm(current, {
          ...(saved.profile || {}),
          full_name: saved.full_name,
        }),
      );
      setStep(Math.min(10, Math.max(1, saved.onboarding_step || 1)));
    } catch (cause) {
      setLoadFailed(true);
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load your saved preferences.",
      );
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleList(
    key: "host_countries" | "fields_of_study",
    value: string,
  ) {
    const current = form[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    update(
      key,
      next.filter((item) => item !== "Anywhere / Not sure"),
    );
  }

  function setScore(value: number | "", scale = form.gpa_scale) {
    update("gpa_value", value);
    if (value === "") {
      update("gpa_4_equivalent", null);
      return;
    }
    if (scale === "4.0") {
      update("gpa_4_equivalent", Math.min(Number(value), 4));
      return;
    }
    if (scale === "5.0") {
      update(
        "gpa_4_equivalent",
        Math.round(Math.min((Number(value) / 5) * 4, 4) * 100) / 100,
      );
      return;
    }
    const percent =
      scale === "percentage" ? Number(value) : Number(value) * 9.5;
    update("gpa_4_equivalent", percentageToG4(percent));
  }

  function selectLevel(value: string) {
    setError("");
    setForm((current) => ({
      ...current,
      target_level: value,
      gpa_value: "",
      gpa_4_equivalent: null,
      bs_marks_obtained: "",
      bs_marks_total: value === "Undergraduate" ? 1100 : current.bs_marks_total,
    }));
  }

  function validateStep(): string | null {
    if (step === 1 && !form.full_name.trim()) {
      return "Add your name to continue.";
    }
    if (step === 7) {
      if (form.target_level === "Undergraduate") {
        if (form.bs_marks_obtained !== "" && form.bs_marks_total === "") {
          return "Add the total marks for your qualification.";
        }
        if (hasMarks && Number(form.bs_marks_obtained) > Number(form.bs_marks_total)) {
          return "Marks obtained cannot be higher than total marks.";
        }
      } else if (form.gpa_value !== "") {
        const maximum =
          form.gpa_scale === "4.0"
            ? 4
            : form.gpa_scale === "5.0"
              ? 5
              : form.gpa_scale === "10"
                ? 10
                : 100;
        if (Number(form.gpa_value) > maximum) {
          return `Enter a score no higher than ${maximum} for this grading system.`;
        }
      }
    }
    return null;
  }

  async function advance() {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (step === 10) {
        await apiFetch("/api/onboarding/step", {
          method: "PUT",
          body: JSON.stringify(profilePayload(form, 10)),
        });
        await apiFetch("/api/onboarding/complete", { method: "POST" });
        await apiFetch("/api/scholarships/match", {
          method: "POST",
          body: JSON.stringify({ page: 1, page_size: 20 }),
        }).catch(() => null);
        router.push("/scholarships?matched=1");
        return;
      }
      await apiFetch("/api/onboarding/step", {
        method: "PUT",
        body: JSON.stringify(
          profilePayload(form, editingFromReview ? 10 : step + 1),
        ),
      });
      setStep(editingFromReview ? 10 : Math.min(10, step + 1));
      setEditingFromReview(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this step.",
      );
    } finally {
      setBusy(false);
    }
  }

  function goToStep(target: number) {
    if (target >= step) return;
    setError("");
    setEditingFromReview(step === 10);
    setStep(target);
  }

  const reviewItems = [
    { label: "From", value: form.origin_country, step: 2 },
    {
      label: "Degree",
      value:
        levels.find((item) => item.value === form.target_level)?.label ||
        "Not selected",
      step: 3,
    },
    {
      label: "Destinations",
      value: form.host_countries.join(", ") || "Anywhere",
      step: 4,
    },
    {
      label: "Field",
      value: form.fields_of_study.join(", ") || "Any field",
      step: 5,
    },
    {
      label: "IELTS",
      value:
        ieltsOptions.find((item) => item.value === form.ielts_status)?.label ||
        "Not selected",
      step: 6,
    },
    { label: "Academic score", value: academicSummary, step: 7 },
    {
      label: "Funding",
      value:
        fundingOptions.find(
          (item) => item.value === form.funding_preference,
        )?.label || "Show me everything",
      step: 8,
    },
    {
      label: "Nice-to-haves",
      value: selectedPreferences
        ? `${selectedPreferences} selected`
        : "None selected",
      step: 9,
    },
    {
      label: "Intake",
      value: form.intake_preference || "No preference",
      step: 9,
    },
  ];

  return (
    <div className="onboarding-wrap">
      <div className="wizard-topline">
        <Link className="onboarding-exit" href="/dashboard">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
        <span className="wizard-save-hint">
          <CheckCircle2 size={14} /> Progress saves after every step
        </span>
      </div>

      <header className="wizard-head">
        <div>
          <p className="eyebrow">SET UP YOUR SEARCH</p>
          <h1>
            A few details.
            <br />
            <em>A clearer search.</em>
          </h1>
          <p className="wizard-lede">
            Tell us what you want to study, where you want to go, and what
            matters most. We will use it to rank scholarships around you.
          </p>
        </div>
        <div className="wizard-progress-card">
          <div className="wizard-progress-card-top">
            <span>STEP {String(step).padStart(2, "0")}</span>
            <small>{step} / 10</small>
          </div>
          <strong>{stepNames[step - 1]}</strong>
          <div
            className="wizard-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={step * 10}
            aria-label={`Step ${step} of 10`}
          >
            <span style={{ width: `${step * 10}%` }} />
          </div>
          <p>{step === 10 ? "Review and finish" : `${10 - step} steps left`}</p>
        </div>
      </header>

      <div className="wizard-mobile-status">
        <div>
          <span>STEP {String(step).padStart(2, "0")} OF 10</span>
          <strong>{stepNames[step - 1]}</strong>
        </div>
        <div
          className="wizard-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={step * 10}
          aria-label={`Step ${step} of 10`}
        >
          <span style={{ width: `${step * 10}%` }} />
        </div>
      </div>

      <div className="wizard-layout">
        <aside className="wizard-steps" aria-label="Onboarding steps">
          <div className="wizard-steps-card">
            <p className="wizard-steps-title">YOUR SETUP</p>
            {stepNames.map((name, index) => {
              const number = index + 1;
              const done = step > number;
              const current = step === number;
              return (
                <button
                  key={name}
                  type="button"
                  className={`wizard-step-label${current ? " current" : ""}${
                    done ? " done" : ""
                  }`}
                  aria-current={current ? "step" : undefined}
                  disabled={!done}
                  onClick={() => goToStep(number)}
                >
                  <span>
                    {done ? <Check size={13} /> : String(number).padStart(2, "0")}
                  </span>
                  {name}
                </button>
              );
            })}
            <div className="wizard-steps-foot">
              <span>{step * 10}% complete</span>
              <strong>
                {step - 1} of {stepNames.length}
              </strong>
            </div>
          </div>
        </aside>

        <section className="wizard-content" aria-live="polite">
          {loading ? (
            <div className="wizard-loading" role="status">
              <Loader2 size={22} />
              <strong>Loading your preferences</strong>
              <span>This will only take a moment.</span>
            </div>
          ) : loadFailed ? (
            <div className="wizard-load-failed">
              <strong>We could not load your setup.</strong>
              <span>{error}</span>
              <button
                type="button"
                className="outline-button"
                onClick={() => void loadProfile()}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <p className="eyebrow">
                STEP {String(step).padStart(2, "0")}
              </p>
              <div className="wizard-stage" key={step}>
                {step === 1 && (
                  <>
                    <h2>What should we call you?</h2>
                    <p className="wizard-description">
                      We will use your name to make your workspace feel like
                      yours.
                    </p>
                    <div className="wizard-field">
                      <label className="wizard-label">
                        Your name
                        <input
                          autoFocus
                          autoComplete="name"
                          value={form.full_name}
                          onChange={(event) =>
                            update("full_name", event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void advance();
                            }
                          }}
                          placeholder="Full name"
                        />
                      </label>
                      <p className="wizard-field-note">
                        This appears on your dashboard and document templates.
                      </p>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2>Where are you from?</h2>
                    <p className="wizard-description">
                      This helps us frame deadlines and visa guidance. It will
                      not filter your results.
                    </p>
                    <div className="wizard-field">
                      <label className="wizard-label">
                        Country of origin
                        <select
                          autoComplete="country-name"
                          value={form.origin_country}
                          onChange={(event) =>
                            update("origin_country", event.target.value)
                          }
                        >
                          {countries.length === 0 && (
                            <option>{form.origin_country}</option>
                          )}
                          {countries.map((country) => (
                            <option key={country}>{country}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <h2>What would you like to study?</h2>
                    <p className="wizard-description">
                      Choose the next degree you want to pursue.
                    </p>
                    <OptionGrid
                      options={levels}
                      value={form.target_level}
                      onSelect={selectLevel}
                    />
                  </>
                )}

                {step === 4 && (
                  <>
                    <h2>Where would you like to go?</h2>
                    <p className="wizard-description">
                      Choose a few destinations, or leave this open for now.
                    </p>
                    <div className="wizard-toolbar">
                      <div className="country-search">
                        <Search size={16} />
                        <input
                          value={countrySearch}
                          onChange={(event) =>
                            setCountrySearch(event.target.value)
                          }
                          placeholder="Find a country"
                          aria-label="Find a study destination"
                        />
                      </div>
                      {form.host_countries.length > 0 && (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => update("host_countries", [])}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="chip-grid">
                      <button
                        type="button"
                        aria-pressed={form.host_countries.length === 0}
                        className={`choice-chip choice-chip-any ${
                          form.host_countries.length === 0 ? "selected" : ""
                        }`}
                        onClick={() => update("host_countries", [])}
                      >
                        Anywhere / Not sure
                      </button>
                      {filteredDestinations.map((country) => (
                        <button
                          type="button"
                          key={country}
                          aria-pressed={form.host_countries.includes(country)}
                          className={`choice-chip ${
                            form.host_countries.includes(country)
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => toggleList("host_countries", country)}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                    {filteredDestinations.length === 0 && (
                      <p className="wizard-empty-line">
                        {destinations.length === 0
                          ? "No study destinations are available right now."
                          : "No countries match that search."}
                      </p>
                    )}
                    <p className="wizard-selection">
                      {form.host_countries.length > 0 ? (
                        <>
                          <strong>{form.host_countries.length}</strong>{" "}
                          destination
                          {form.host_countries.length === 1 ? "" : "s"} selected
                        </>
                      ) : (
                        "No restriction. We will search everywhere."
                      )}
                    </p>
                  </>
                )}

                {step === 5 && (
                  <>
                    <h2>What field feels right?</h2>
                    <p className="wizard-description">
                      Specific interests also include opportunities open to any
                      field.
                    </p>
                    <div className="chip-grid">
                      {fieldOptions.map((field) => (
                        <button
                          type="button"
                          key={field}
                          aria-pressed={form.fields_of_study.includes(field)}
                          className={`choice-chip ${
                            form.fields_of_study.includes(field)
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => toggleList("fields_of_study", field)}
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => update("fields_of_study", [])}
                    >
                      Not sure yet
                    </button>
                  </>
                )}

                {step === 6 && (
                  <>
                    <h2>How do you feel about IELTS?</h2>
                    <p className="wizard-description">
                      We will only show requirements within the level you
                      choose.
                    </p>
                    <OptionGrid
                      options={ieltsOptions}
                      value={form.ielts_status}
                      onSelect={(value) => update("ielts_status", value)}
                    />
                  </>
                )}

                {step === 7 && (
                  <>
                    <h2>Let us understand your score.</h2>
                    <p className="wizard-description">
                      We use an estimate; universities convert grades
                      differently.
                    </p>
                    {form.target_level === "Undergraduate" ? (
                      <div className="score-panel">
                        <div className="score-panel-head">
                          <div>
                            <span>Undergraduate marks</span>
                            <p>Use your latest FSc, ICS, A-Level or IB result.</p>
                          </div>
                          <small className="score-badge">Estimate</small>
                        </div>
                        <div className="score-input-row">
                          <label className="wizard-label">
                            Marks obtained
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max={Number(form.bs_marks_total) || 1100}
                              value={form.bs_marks_obtained}
                              onChange={(event) =>
                                update(
                                  "bs_marks_obtained",
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                                )
                              }
                            />
                          </label>
                          <label className="wizard-label">
                            Total marks
                            <input
                              type="number"
                              inputMode="decimal"
                              min="1"
                              value={form.bs_marks_total}
                              onChange={(event) =>
                                update(
                                  "bs_marks_total",
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                                )
                              }
                            />
                          </label>
                        </div>
                        <div className="score-result-card">
                          <div>
                            <span>Estimated GPA</span>
                            <small>
                              {marksPercentage === null
                                ? "Enter marks to see an estimate"
                                : `${marksPercentage.toFixed(1)}% achieved`}
                            </small>
                          </div>
                          <strong>
                            {marksG4 === null ? "—" : marksG4.toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="score-panel">
                        <div className="score-panel-head">
                          <div>
                            <span>Your academic score</span>
                            <p>Use the grading system printed on your transcript.</p>
                          </div>
                          <small className="score-badge">Estimate</small>
                        </div>
                        <label className="wizard-label">
                          Grading system
                          <select
                            value={form.gpa_scale}
                            onChange={(event) => {
                              const scale = event.target.value;
                              update("gpa_scale", scale);
                              setScore(form.gpa_value, scale);
                            }}
                          >
                            <option value="4.0">4.0 scale</option>
                            <option value="5.0">5.0 scale</option>
                            <option value="10">10-point scale</option>
                            <option value="percentage">Percentage</option>
                          </select>
                        </label>
                        <label className="wizard-label">
                          Your score
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={
                              form.gpa_scale === "4.0"
                                ? 4
                                : form.gpa_scale === "5.0"
                                  ? 5
                                  : form.gpa_scale === "10"
                                    ? 10
                                    : 100
                            }
                            step="any"
                            value={form.gpa_value}
                            onChange={(event) =>
                              setScore(
                                event.target.value === ""
                                  ? ""
                                  : Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <div className="score-result-card">
                          <div>
                            <span>Estimated equivalent</span>
                            <small>On a 4.0 scale</small>
                          </div>
                          <strong>
                            {form.gpa_4_equivalent !== null
                              ? form.gpa_4_equivalent
                              : "—"}
                          </strong>
                        </div>
                      </div>
                    )}
                    <p className="input-hint">
                      Estimate only; each university may convert grades
                      differently.
                    </p>
                  </>
                )}

                {step === 8 && (
                  <>
                    <h2>What kind of funding matters?</h2>
                    <p className="wizard-description">
                      This helps us rank opportunities; it will not exclude
                      scholarships.
                    </p>
                    <OptionGrid
                      options={fundingOptions}
                      value={form.funding_preference}
                      onSelect={(value) =>
                        update("funding_preference", value)
                      }
                    />
                  </>
                )}

                {step === 9 && (
                  <>
                    <h2>Your nice-to-haves?</h2>
                    <p className="wizard-description">
                      These are highlights only; they never remove an
                      opportunity.
                    </p>
                    <div className="preference-grid">
                      {preferenceOptions.map((item) => {
                        const checked = Boolean(form.extra_preferences[item]);
                        return (
                          <label
                            key={item}
                            className={`toggle-row${checked ? " checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="toggle-input"
                              checked={checked}
                              onChange={(event) =>
                                update("extra_preferences", {
                                  ...form.extra_preferences,
                                  [item]: event.target.checked,
                                })
                              }
                            />
                            <span className="toggle-check" aria-hidden="true">
                              {checked && <Check size={12} />}
                            </span>
                            <span>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                    <label className="wizard-label intake-select">
                      Preferred intake
                      <select
                        value={form.intake_preference}
                        onChange={(event) =>
                          update("intake_preference", event.target.value)
                        }
                      >
                        <option value="">No preference</option>
                        <option>Autumn/Fall</option>
                        <option>Spring</option>
                        <option>Flexible</option>
                      </select>
                    </label>
                  </>
                )}

                {step === 10 && (
                  <>
                    <h2>Does this look like you?</h2>
                    <p className="wizard-description">
                      Review the details below. You can edit any preference
                      later from your profile.
                    </p>
                    <div className="review-list">
                      {reviewItems.map((item) => (
                        <div key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <button
                            type="button"
                            onClick={() => goToStep(item.step)}
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="wizard-review-note">
                      <CheckCircle2 size={16} />
                      <span>
                        Finishing will mark your setup complete and refresh your
                        scholarship matches.
                      </span>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <div className="wizard-actions">
                {step > 1 ? (
                  <button
                    type="button"
                    className="outline-button"
                    onClick={() => {
                      setError("");
                      setStep(step - 1);
                    }}
                  >
                    <ArrowLeft size={15} /> Back
                  </button>
                ) : (
                  <span className="wizard-actions-note">
                    Takes about 2 minutes
                  </span>
                )}
                <button
                  type="button"
                  className="primary-button wizard-next"
                  disabled={
                    busy ||
                    (step === 3 && !form.target_level) ||
                    (step === 6 && !form.ielts_status)
                  }
                  onClick={() => void advance()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="wizard-spin" size={15} /> Saving...
                    </>
                  ) : step === 10 ? (
                    <>
                      <Sparkles size={15} /> Show my scholarships
                    </>
                  ) : (
                    <>
                      Save & continue <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function OptionGrid({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="option-grid">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            type="button"
            key={option.value}
            aria-pressed={selected}
            onClick={() => onSelect(option.value)}
            className={`option-card${selected ? " selected" : ""}`}
          >
            <span className="option-check">
              {selected && <Check size={14} />}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function percentageToG4(percentage: number) {
  const bands = [
    [0, 1],
    [50, 1.7],
    [55, 2],
    [60, 2.3],
    [65, 2.7],
    [70, 3],
    [75, 3.3],
    [80, 3.7],
    [85, 4],
    [100, 4],
  ];
  const value = Math.max(0, Math.min(percentage, 100));
  const index = bands.findIndex(([threshold]) => threshold > value) - 1;
  if (index < 0 || index >= bands.length - 1) return 4;
  const [lowPercentage, lowGpa] = bands[index];
  const [highPercentage, highGpa] = bands[index + 1];
  return (
    Math.round(
      (lowGpa +
        ((value - lowPercentage) / (highPercentage - lowPercentage)) *
          (highGpa - lowGpa)) *
        100,
    ) / 100
  );
}

function hydrateForm(
  current: FormState,
  profile: Partial<FormState> | null,
): FormState {
  const saved = profile ?? {};
  return {
    ...current,
    full_name: saved.full_name ?? current.full_name,
    origin_country: saved.origin_country ?? current.origin_country,
    target_level: saved.target_level ?? current.target_level,
    host_countries: Array.isArray(saved.host_countries)
      ? saved.host_countries
      : current.host_countries,
    fields_of_study: Array.isArray(saved.fields_of_study)
      ? saved.fields_of_study
      : current.fields_of_study,
    ielts_status: saved.ielts_status ?? current.ielts_status,
    gpa_scale: saved.gpa_scale ?? current.gpa_scale,
    gpa_value: saved.gpa_value ?? "",
    gpa_4_equivalent: saved.gpa_4_equivalent ?? null,
    bs_marks_obtained: saved.bs_marks_obtained ?? "",
    bs_marks_total: saved.bs_marks_total ?? current.bs_marks_total,
    funding_preference: saved.funding_preference ?? current.funding_preference,
    extra_preferences: saved.extra_preferences ?? current.extra_preferences,
    intake_preference: saved.intake_preference ?? "",
  };
}

function profilePayload(form: FormState, onboardingStep: number) {
  return {
    ...form,
    full_name: form.full_name.trim(),
    onboarding_step: onboardingStep,
    ielts_status: form.ielts_status || null,
    gpa_value: form.gpa_value === "" ? null : form.gpa_value,
    bs_marks_obtained:
      form.bs_marks_obtained === "" ? null : form.bs_marks_obtained,
    bs_marks_total: form.bs_marks_total === "" ? null : form.bs_marks_total,
  };
}
