"use client";

import { useEffect, useState } from "react";
import { Search, UserCircle } from "lucide-react";
import { PageHeader } from "@/admin/components/PageHeader";
import { Drawer } from "@/admin/components/Drawer";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { consultantApi, type ConsultantApplicant, type ConsultantApplicantDetail } from "@/consultant/api";

const PAGE_SIZE = 50;

export default function ConsultantApplicantsPage() {
  const [rows, setRows] = useState<ConsultantApplicant[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ConsultantApplicantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load(nextPage = page, term = query) {
    setLoading(true);
    setError("");
    try {
      const result = await consultantApi.listApplicants({ q: term, page: nextPage, page_size: PAGE_SIZE });
      setRows(result.items);
      setTotal(result.total ?? 0);
      setPage(result.page);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load applicants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    consultantApi
      .listApplicants({ page: 1, page_size: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setRows(result.items);
        setTotal(result.total ?? 0);
        setPage(result.page);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load applicants.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await consultantApi.getApplicant(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load applicant.");
    } finally {
      setDetailLoading(false);
    }
  }

  const columns: Column<ConsultantApplicant>[] = [
    {
      key: "name",
      label: "Applicant",
      render: (row) => (
        <>
          <button className="admin-link" onClick={() => void openDetail(row.id)}>
            {row.full_name || row.email}
          </button>
          <small>{row.email}</small>
        </>
      ),
    },
    { key: "plan", label: "Plan", render: (row) => <span className="admin-pill">{row.plan}</span> },
    { key: "origin", label: "Origin", render: (row) => row.origin_country || "—" },
    { key: "level", label: "Target level", render: (row) => row.target_level || "—" },
    { key: "saves", label: "Saves", render: (row) => row.saves },
    { key: "apps", label: "Applications", render: (row) => row.applications },
  ];

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="STUDENTS"
        title="Applicants"
        description={`${total.toLocaleString()} students who saved or applied to your scholarships.`}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-filter-bar">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draftQuery);
            void load(1, draftQuery);
          }}
        >
          <Search size={16} />
          <input value={draftQuery} onChange={(e) => setDraftQuery(e.target.value)} placeholder="Search by name or email" />
          <button className="admin-outline">Search</button>
        </form>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="No students have engaged with your scholarships yet."
        footer={
          <div className="admin-pagination">
            <span>
              {total.toLocaleString()} applicants · page {page} of {pages}
            </span>
            <span>
              <button disabled={page <= 1} onClick={() => void load(page - 1)}>
                Previous
              </button>
              <button disabled={page >= pages} onClick={() => void load(page + 1)}>
                Next
              </button>
            </span>
          </div>
        }
      />

      <Drawer
        open={detailLoading || detail !== null}
        title={detail?.full_name || detail?.email || "Applicant"}
        onClose={() => setDetail(null)}
        width={520}
      >
        {detailLoading || !detail ? (
          <p className="admin-thumb">Loading…</p>
        ) : (
          <div className="admin-detail">
            <p className="admin-thumb">
              <UserCircle size={14} /> {detail.email} · {detail.plan} plan
            </p>
            {detail.created_at && <p className="admin-thumb">Joined {new Date(detail.created_at).toLocaleDateString()}</p>}
            {detail.profile && (
              <section className="admin-box">
                <h3>Profile</h3>
                <dl className="admin-detail-list">
                  {Object.entries(detail.profile).map(([key, value]) =>
                    value === null || value === undefined || value === "" ? null : (
                      <div key={key}>
                        <dt>{key.replaceAll("_", " ")}</dt>
                        <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            )}
            <section className="admin-box">
              <h3>Saved your scholarships ({detail.saved.length})</h3>
              {detail.saved.length === 0 ? (
                <p className="admin-thumb">None.</p>
              ) : (
                <ul className="admin-mini-list">
                  {detail.saved.map((item) => (
                    <li key={item.scholarship_id}>{item.title}</li>
                  ))}
                </ul>
              )}
            </section>
            <section className="admin-box">
              <h3>Applications ({detail.applications.length})</h3>
              {detail.applications.length === 0 ? (
                <p className="admin-thumb">None.</p>
              ) : (
                <ul className="admin-mini-list">
                  {detail.applications.map((item) => (
                    <li key={item.scholarship_id}>
                      {item.title} <span className="admin-pill">{item.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
