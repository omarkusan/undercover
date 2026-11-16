import { api } from "./api";
import { STATES, day, decisionLabels, money, words } from "./format";
import { StatusChip } from "./StatusChip";
import { useData } from "./useData";

export function QueuePage() {
  const { data: claims, failed } = useData(api.claims, true);

  return (
    <>
      <h1>Claims queue</h1>
      {failed && (
        <p role="alert" className="alert">
          The claims can't be loaded right now. The page keeps trying.
        </p>
      )}
      {claims && (
        <>
          <ul className="tiles" aria-label="Claims by state">
            {STATES.map((status) => (
              <li key={status} className="panel tile">
                <span className="tile-count">
                  {claims.filter((claim) => claim.status === status).length}
                </span>{" "}
                <span>
                  <StatusChip status={status} />
                </span>
              </li>
            ))}
          </ul>
          <section className="panel table-scroll" aria-label="Claims">
            <table>
              <thead>
                <tr>
                  <th scope="col">Claim</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Type</th>
                  <th scope="col">Submitted</th>
                  <th scope="col" className="number">
                    Claimed
                  </th>
                  <th scope="col">State</th>
                  <th scope="col">Decision</th>
                  <th scope="col" className="number">
                    Payout
                  </th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.claim_id}>
                    <td className="mono">
                      <a href={`#/claims/${claim.claim_id}`}>
                        {claim.claim_id}
                      </a>
                    </td>
                    <td>{claim.customer_name}</td>
                    <td>{words(claim.claim_type)}</td>
                    <td className="mono">{day(claim.submitted_on)}</td>
                    <td className="number">{money(claim.amount_claimed)}</td>
                    <td>
                      <StatusChip status={claim.status} />
                    </td>
                    <td>{claim.decision && decisionLabels[claim.decision]}</td>
                    <td className="number">
                      {claim.payout !== null && money(claim.payout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
