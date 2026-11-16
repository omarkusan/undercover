export type ClaimStatus =
  "waiting" | "in_progress" | "waiting_for_sign_off" | "decided";
export type Decision = "approve" | "decline" | "refer";

export interface ClaimSummary {
  claim_id: string;
  customer_name: string;
  claim_type: string;
  summary: string;
  submitted_on: string;
  amount_claimed: number;
  status: ClaimStatus;
  decision: Decision | null;
  payout: number | null;
  paid_amount: number | null;
}

export interface ClaimItem {
  description: string;
  category: string;
  amount: number;
}

export interface ClaimDocument {
  name: string;
  type: string;
  content: string;
}

export interface Claim extends ClaimSummary {
  policy_id: string;
  customer_id: string;
  incident_date: string;
  incident_location: string;
  story: string;
  items: ClaimItem[];
  documents: ClaimDocument[];
  thread_id: string | null;
  reasons: string | null;
  policy_section: string | null;
  decided_at: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  paid_at: string | null;
}

export interface Policy {
  policy_id: string;
  plan: string;
  add_ons: string[];
  purchased_on: string;
  trip: {
    destination: string;
    departs_on: string;
    returns_on: string;
    trip_cost: number;
  };
  travelers: string[];
}

export interface PreviousClaim {
  claim_id: string;
  filed_on: string;
  claim_type: string;
  summary: string;
  outcome: string;
  amount_paid: number;
}

export interface Handler {
  handler_id: string;
  name: string;
  role: string;
  can_approve_over_limit: boolean;
}

export interface Step {
  step_id: number;
  thread_id: string;
  kind: "tool_call" | "tool_result" | "message";
  text: string;
  created_at: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const { detail } = (await response.json()) as { detail: unknown };
    throw new Error(
      typeof detail === "string"
        ? detail
        : `${path} answered ${String(response.status)}`,
    );
  }
  return (await response.json()) as T;
}

function post<T>(path: string, body: object): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  claims: () => request<ClaimSummary[]>("/api/claims"),
  claim: (claimId: string) => request<Claim>(`/api/claims/${claimId}`),
  steps: (claimId: string) => request<Step[]>(`/api/claims/${claimId}/steps`),
  policy: (policyId: string) => request<Policy>(`/api/policies/${policyId}`),
  history: (customerId: string) =>
    request<PreviousClaim[]>(`/api/customers/${customerId}/claims`),
  handlers: () => request<Handler[]>("/api/handlers"),
  instructions: () => request<{ instructions: string }>("/api/instructions"),
  signOff: (claimId: string, handlerId: string) =>
    post<Claim>(`/api/claims/${claimId}/sign-off`, { handler_id: handlerId }),
};
