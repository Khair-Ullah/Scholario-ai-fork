import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

export type Column<T> = {
  key: string;
  label: string;
  header?: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyText = "No records in this view.",
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.header}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      <Skeleton />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <EmptyState text={emptyText} />}
      {footer}
    </div>
  );
}