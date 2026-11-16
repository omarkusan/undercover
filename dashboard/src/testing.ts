import { vi } from "vitest";
import type { Claim, ClaimSummary } from "./api";

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
