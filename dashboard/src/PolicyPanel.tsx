import { useCallback } from "react";
import { api } from "./api";
import { day, money, words } from "./format";
import { useData } from "./useData";

export function PolicyPanel({
  policyId,
  customerId,
}: Readonly<{ policyId: string; customerId: string }>) {
  const loadPolicy = useCallback(() => api.policy(policyId), [policyId]);
  const loadHistory = useCallback(() => api.history(customerId), [customerId]);
  const { data: policy } = useData(loadPolicy, false);
  const { data: history } = useData(loadHistory, false);

  return (
    <>
      <section className="panel" aria-labelledby="policy">
        <h2 id="policy">
          Policy <span className="mono">{policyId}</span>
        </h2>
        {policy && (
          <dl className="facts">
            <div>
              <dt>Plan</dt>
              <dd>{words(policy.plan)}</dd>
            </div>
            <div>
              <dt>Add-ons</dt>
              <dd>{policy.add_ons.map(words).join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Bought</dt>
              <dd className="mono">{day(policy.purchased_on)}</dd>
            </div>
            <div>
              <dt>Trip</dt>
              <dd>
                {policy.trip.destination},{" "}
                <span className="mono">
                  {day(policy.trip.departs_on)} to {day(policy.trip.returns_on)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Trip cost</dt>
              <dd className="mono">{money(policy.trip.trip_cost)}</dd>
            </div>
            <div>
              <dt>Travelers</dt>
              <dd>{policy.travelers.join(", ")}</dd>
            </div>
          </dl>
        )}
      </section>
      <section className="panel table-scroll" aria-labelledby="history">
        <h2 id="history">Earlier claims</h2>
        {history?.length === 0 && <p className="muted">No earlier claims.</p>}
        {history && history.length > 0 && (
          <table>
            <thead>
              <tr>
                <th scope="col">Claim</th>
                <th scope="col">Filed</th>
                <th scope="col">What happened</th>
                <th scope="col">Outcome</th>
                <th scope="col" className="number">
                  Paid
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((previous) => (
                <tr key={previous.claim_id}>
                  <td className="mono">{previous.claim_id}</td>
                  <td className="mono">{day(previous.filed_on)}</td>
                  <td>{previous.summary}</td>
                  <td>{words(previous.outcome)}</td>
                  <td className="number">{money(previous.amount_paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
