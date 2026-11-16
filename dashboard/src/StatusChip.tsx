import type { ClaimStatus } from "./api";
import { statusLabels } from "./format";

export function StatusChip({ status }: Readonly<{ status: ClaimStatus }>) {
  return (
    <span className={`status status-${status}`}>{statusLabels[status]}</span>
  );
}
