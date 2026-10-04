"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react";
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

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(blank);
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{
        full_name: string;
        onboarding_step: number;
        profile: Partial<FormState> | null;
      }>("/api/onboarding"),
      apiFetch<string[]>("/api/meta/countries"),
    ])
      .then(([saved, allCountries]) => {
        setCountries(allCountries);
        setForm((current) => ({
          ...current,
          full_name: saved.full_name,
          ...(saved.profile || {}),
        }));
        setStep(saved.onboarding_step || 1);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load your saved preferences.",
        ),
      );
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
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
    if (key === "host_countries" && value === "Anywhere / Not sure")
      update(key, []);
    else
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
  async function advance() {
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
        });
        router.push("/scholarships?matched=1");
        return;
      }
      await apiFetch("/api/onboarding/step", {
        method: "PUT",
        body: JSON.stringify(profilePayload(form, step + 1)),
      });
      setStep((current) => Math.min(10, current + 1));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this step.",
      );
    } finally {
      setBusy(false);
    }
  }

  const filteredCountries = countries
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
      : form.gpa_4_equivalent
        ? `${form.gpa_4_equivalent} / 4.0 equivalent`
        : "Not added";

  function selectLevel(value: string) {
    update("target_level", value);
    update("gpa_value", "");
    update("gpa_4_equivalent", null);
    if (value === "Undergraduate") {
      update("bs_marks_obtained", "");
    } else {
      update("bs_marks_obtained", "");
      update("bs_marks_total", 1100);
    }
  }

  return (
    <div className="onboarding-wrap">
      <Link className="onboarding-exit" href="/dashboard">
        <ArrowLeft size={15} /> Save and leave
      </Link>
      <div className="wizard-head">
        <div>
          <p className="eyebrow">LET&apos;S MAKE THIS PERSONAL</p>
          <h1>
            A few details.
            <br />
            <em>A clearer search.</em>
          </h1>
        </div>
        <span className="wizard-step-count">
          {String(step).padStart(2, "0")} <span>/ 10</span>
        </span>
      </div>
      <div className="wizard-progress" aria-label={`Step ${step} of 10`}>
        <span style={{ width: `${step * 10}%` }} />
      </div>
      <div className="wizard-layout">
        <aside className="wizard-steps">
          {stepNames.map((name, index) => (
            <div
              key={name}
              className={`wizard-step-label ${step === index + 1 ? "current" : step > index + 1 ? "done" : ""}`}
            >
              <span>
                {step > index + 1 ? (
                  <Check size={13} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              {name}
            </div>
          ))}
        </aside>
        <section className="wizard-content">
          <p className="eyebrow">STEP {String(step).padStart(2, "0")}</p>
          {step === 1 && (
            <>
              <h2>What should we call you?</h2>
              <p className="wizard-description">
                We’ll use your name to make your workspace feel like yours.
              </p>
              <label className="wizard-label">
                Your name
                <input
                  autoFocus
                  value={form.full_name}
                  onChange={(event) => update("full_name", event.target.value)}
                  placeholder="Full name"
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h2>Where are you from?</h2>
              <p className="wizard-description">
                This helps your advisor understand your context. It won’t filter
                your results.
              </p>
              <label className="wizard-label">
                Country of origin
                <select
                  value={form.origin_country}
                  onChange={(event) =>
                    update("origin_country", event.target.value)
                  }
                >
                  {countries.map((country) => (
                    <option key={country}>{country}</option>
                  ))}
                </select>
              </label>
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
                Choose a few destinations, or leave this open.
              </p>
              <div className="country-search">
                <Search size={16} />
                <input
                  value={countrySearch}
                  onChange={(event) => setCountrySearch(event.target.value)}
                  placeholder="Find a country"
                />
              </div>
              <div className="chip-grid">
                <button
                  className={`choice-chip ${form.host_countries.length === 0 ? "selected" : ""}`}
                  onClick={() => update("host_countries", [])}
                >
                  Anywhere / Not sure
                </button>
                {filteredCountries.map((country) => (
                  <button
                    key={country}
                    className={`choice-chip ${form.host_countries.includes(country) ? "selected" : ""}`}
                    onClick={() => toggleList("host_countries", country)}
                  >
                    {country}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <h2>What field feels right?</h2>
              <p className="wizard-description">
                Specific interests also include opportunities open to any field.
              </p>
              <div className="chip-grid">
                {fieldOptions.map((field) => (
                  <button
                    key={field}
                    className={`choice-chip ${form.fields_of_study.includes(field) ? "selected" : ""}`}
                    onClick={() => toggleList("fields_of_study", field)}
                  >
                    {field}
                  </button>
                ))}
              </div>
              <button
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
                We’ll only show requirements within the level you choose.
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
              <h2>Let’s understand your score.</h2>
              <p className="wizard-description">
                We use an estimate; universities convert grades differently.
              </p>
              {form.target_level === "Undergraduate" ? (
                <div className="score-panel">
                  <label className="wizard-label">
                    Exam type
                    <select>
                      <option>FSc / Intermediate</option>
                      <option>ICS</option>
                      <option>A-Levels</option>
                      <option>IB</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <div className="score-input-row">
                    <label className="wizard-label">
                      Marks obtained
                      <input
                        type="number"
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
                  <p className="score-result">
                    {marksPercentage === null
                      ? "—"
                      : `${marksPercentage.toFixed(1)}%`}{" "}
                    <span>
                      {marksG4 === null
                        ? "Enter marks to see an estimate"
                        : `≈ ${marksG4.toFixed(2)} / 4.0 estimate`}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="score-panel">
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
                  <p className="score-result">
                    {form.gpa_4_equivalent ?? "—"}{" "}
                    <span>/ 4.0 estimated equivalent</span>
                  </p>
                </div>
              )}
              <p className="input-hint">
                Estimate only; each university may convert grades differently.
              </p>
            </>
          )}
          {step === 8 && (
            <>
              <h2>What kind of funding matters?</h2>
              <p className="wizard-description">
                This helps your advisor; it won’t exclude scholarships.
              </p>
              <OptionGrid
                options={[
                  { value: "full_tuition", label: "Full tuition waiver" },
                  { value: "partial", label: "Partial waiver" },
                  { value: "with_stipend", label: "Monthly stipend" },
                  { value: "any", label: "Show me everything" },
                ]}
                value={form.funding_preference}
                onSelect={(value) => update("funding_preference", value)}
              />
            </>
          )}
          {step === 9 && (
            <>
              <h2>Your nice-to-haves?</h2>
              <p className="wizard-description">
                These are highlights only; they never remove an opportunity.
              </p>
              <div className="preference-grid">
                {preferenceOptions.map((item) => (
                  <label key={item} className="toggle-row">
                    <input
                      type="checkbox"
                      checked={Boolean(form.extra_preferences[item])}
                      onChange={(event) =>
                        update("extra_preferences", {
                          ...form.extra_preferences,
                          [item]: event.target.checked,
                        })
                      }
                    />
                    <span>{item}</span>
                  </label>
                ))}
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
                You can edit any preference later from your profile.
              </p>
              <div className="review-list">
                {[
                  ["From", form.origin_country],
                  [
                    "Degree",
                    levels.find((item) => item.value === form.target_level)
                      ?.label,
                  ],
                  [
                    "Destinations",
                    form.host_countries.join(", ") || "Anywhere",
                  ],
                  ["Field", form.fields_of_study.join(", ") || "Any field"],
                  [
                    "IELTS",
                    ieltsOptions.find(
                      (item) => item.value === form.ielts_status,
                    )?.label,
                  ],
                  ["Academic score", academicSummary],
                  ["Funding", form.funding_preference.replaceAll("_", " ")],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value || "Choose this preference"}</strong>
                    <button
                      onClick={() =>
                        setStep(
                          label === "From"
                            ? 2
                            : label === "Degree"
                              ? 3
                              : label === "Destinations"
                                ? 4
                                : label === "Field"
                                  ? 5
                                  : label === "IELTS"
                                    ? 6
                                    : label === "Academic score"
                                      ? 7
                                      : 8,
                        )
                      }
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="wizard-actions">
            {step > 1 && (
              <button
                className="outline-button"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <button
              className="primary-button"
              disabled={
                busy ||
                (step === 3 && !form.target_level) ||
                (step === 6 && !form.ielts_status)
              }
              onClick={advance}
            >
              {busy
                ? "Saving..."
                : step === 10
                  ? "Show my scholarships"
                  : "Save & continue"}
              <ArrowRight size={15} />
            </button>
          </div>
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
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={`option-card ${value === option.value ? "selected" : ""}`}
        >
          <span className="option-check">
            {value === option.value && <Check size={14} />}
          </span>
          {option.label}
        </button>
      ))}
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

function profilePayload(form: FormState, onboardingStep: number) {
  return {
    ...form,
    onboarding_step: onboardingStep,
    ielts_status: form.ielts_status || null,
    gpa_value: form.gpa_value === "" ? null : form.gpa_value,
    bs_marks_obtained:
      form.bs_marks_obtained === "" ? null : form.bs_marks_obtained,
    bs_marks_total: form.bs_marks_total === "" ? null : form.bs_marks_total,
  };
}
