import { vi } from "vitest";
import type {
  Claim,
  ClaimSummary,
  Handler,
  Policy,
  PreviousClaim,
  Step,
} from "./api";

/** Answer fetch from a table of paths, as the backend would. POSTs are keyed "POST /path". */
export function stubApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const key = init?.method === "POST" ? `POST ${path}` : path;
    const found = key in routes;
    return Promise.resolve(
      new Response(
        JSON.stringify(found ? routes[key] : { detail: "Not found" }),
        {
          status: found ? 200 : 404,
        },
      ),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const waitingClaim: ClaimSummary = {
  claim_id: "CLM-1001",
  customer_name: "Maya Patel",
  claim_type: "trip_delay",
  summary: "Flight home canceled",
  submitted_on: "2026-06-24",
  amount_claimed: 420,
  status: "waiting",
  decision: null,
  payout: null,
  paid_amount: null,
};

export const signOffClaim: ClaimSummary = {
  claim_id: "CLM-1002",
  customer_name: "Tom Becker",
  claim_type: "baggage",
  summary: "Suitcase lost",
  submitted_on: "2026-07-20",
  amount_claimed: 1150,
  status: "waiting_for_sign_off",
  decision: "approve",
  payout: 1150,
  paid_amount: null,
};

export const fullClaim: Claim = {
  ...signOffClaim,
  policy_id: "POL-2002",
  customer_id: "CUS-3002",
  incident_date: "2026-06-21",
  incident_location: "Frankfurt, Germany",
  story: "My suitcase never arrived in Prague.",
  items: [
    { description: "Hard-shell suitcase", category: "luggage", amount: 280 },
    { description: "Wool suit", category: "clothing", amount: 870 },
  ],
  documents: [
    {
      name: "Northwind Airlines lost baggage report",
      type: "carrier_report",
      content: "One checked bag, tag NW 771204, not delivered.",
    },
  ],
  thread_id: "thread-1",
  reasons: "The bag was lost by the carrier. The items are within the limits.",
  policy_section: "Section 5, Baggage and Personal Effects",
  decided_at: "2026-11-15T18:00:00+00:00",
  signed_off_by: null,
  signed_off_at: null,
  paid_at: null,
};

export const policy: Policy = {
  policy_id: "POL-2002",
  plan: "premium",
  add_ons: ["electronics_plus"],
  purchased_on: "2026-05-02",
  trip: {
    destination: "Prague, Czech Republic",
    departs_on: "2026-06-20",
    returns_on: "2026-07-04",
    trip_cost: 2600,
  },
  travelers: ["Tom Becker"],
};

export const history: PreviousClaim[] = [
  {
    claim_id: "CLM-0238",
    filed_on: "2023-05-08",
    claim_type: "trip_delay",
    summary: "Seven hour delay leaving Chicago",
    outcome: "approved",
    amount_paid: 215,
  },
];

export const handlers: Handler[] = [
  {
    handler_id: "HND-01",
    name: "Dana Whitfield",
    role: "Senior Claims Handler",
    can_approve_over_limit: true,
  },
  {
    handler_id: "HND-02",
    name: "Marcus Oyelaran",
    role: "Claims Handler",
    can_approve_over_limit: false,
  },
];

export const steps: Step[] = [
  {
    step_id: 1,
    thread_id: "thread-1",
    kind: "tool_call",
    text: 'get_claim {"claim_id": "CLM-1002"}',
    created_at: "2026-11-15T18:00:01+00:00",
  },
  {
    step_id: 2,
    thread_id: "thread-1",
    kind: "tool_result",
    text: `get_claim returned {"claim_id":"CLM-1002","story":"${"x".repeat(200)}"}`,
    created_at: "2026-11-15T18:00:02+00:00",
  },
  {
    step_id: 3,
    thread_id: "thread-1",
    kind: "message",
    text: "Approved $1,150.00, waiting for sign-off.",
    created_at: "2026-11-15T18:00:09+00:00",
  },
];

/** The backend's answers for one claim's page. */
export function claimRoutes(claim: Claim, claimSteps: Step[]) {
  return {
    [`/api/claims/${claim.claim_id}`]: claim,
    [`/api/claims/${claim.claim_id}/steps`]: claimSteps,
    [`/api/policies/${claim.policy_id}`]: policy,
    [`/api/customers/${claim.customer_id}/claims`]: history,
    "/api/handlers": handlers,
  };
}
