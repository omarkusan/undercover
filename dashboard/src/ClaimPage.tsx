import { useCallback } from "react";
import { api, type Claim } from "./api";
import { DecisionPanel } from "./DecisionPanel";
import { day, money, words } from "./format";
import { PolicyPanel } from "./PolicyPanel";
import { StatusChip } from "./StatusChip";
import { StepsPanel } from "./StepsPanel";
import { useData } from "./useData";

function Overview({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <section className="panel claim-head" aria-label="Overview">
      <div className="claim-title">
        <h1 className="mono">{claim.claim_id}</h1>
        <StatusChip status={claim.status} />
      </div>
      <p className="claim-summary">{claim.summary}</p>
      <dl className="facts">
        <div>
          <dt>Customer</dt>
          <dd>{claim.customer_name}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{words(claim.claim_type)}</dd>
        </div>
        <div>
          <dt>Incident</dt>
          <dd>
            <span className="mono">{day(claim.incident_date)}</span>,{" "}
            {claim.incident_location}
          </dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd className="mono">{day(claim.submitted_on)}</dd>
        </div>
        <div>
          <dt>Claimed</dt>
          <dd className="mono">{money(claim.amount_claimed)}</dd>
        </div>
      </dl>
    </section>
  );
}

function ClaimDetails({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <>
      <section className="panel" aria-labelledby="story">
        <h2 id="story">The customer's story</h2>
        <p className="prose">{claim.story}</p>
      </section>
      <section className="panel table-scroll" aria-labelledby="items">
        <h2 id="items">Items claimed</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Category</th>
              <th scope="col" className="number">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {claim.items.map((item) => (
              <tr key={item.description}>
                <td>{item.description}</td>
                <td>{words(item.category)}</td>
                <td className="number">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Total claimed
              </th>
              <td className="number">{money(claim.amount_claimed)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <section className="panel" aria-labelledby="documents">
        <h2 id="documents">Documents</h2>
        <div className="documents">
          {claim.documents.map((document) => (
            <article key={document.name}>
              <h3>
                {document.name}{" "}
                <span className="muted">{words(document.type)}</span>
              </h3>
              <p className="prose">{document.content}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function ClaimPage({ claimId }: Readonly<{ claimId: string }>) {
  const loadClaim = useCallback(() => api.claim(claimId), [claimId]);
  const loadSteps = useCallback(() => api.steps(claimId), [claimId]);
  const { data: claim, failed, setData: setClaim } = useData(loadClaim, true);
  const { data: steps } = useData(loadSteps, true);

  return (
    <>
      <p className="back">
        <a href="#/">Back to the queue</a>
      </p>
      {failed && (
        <p role="alert" className="alert">
          This claim can't be loaded right now. The page keeps trying.
        </p>
      )}
      {claim && (
        <>
          <Overview claim={claim} />
          <div className="columns">
            <div className="column">
              <ClaimDetails claim={claim} />
              <PolicyPanel
                policyId={claim.policy_id}
                customerId={claim.customer_id}
              />
            </div>
            <div className="column">
              <DecisionPanel claim={claim} onSignedOff={setClaim} />
              <StepsPanel steps={steps ?? []} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
