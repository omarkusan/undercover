import { type SyntheticEvent, useState } from "react";
import { api, type Claim, type Handler } from "./api";
import { dateTime, decisionLabels, money } from "./format";
import { useData } from "./useData";

type OnSignedOff = (claim: Claim) => void;

function SignOffForm({
  claim,
  handlers,
  onSignedOff,
}: Readonly<{ claim: Claim; handlers: Handler[]; onSignedOff: OnSignedOff }>) {
  const [handlerId, setHandlerId] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setSending(true);
    void api
      .signOff(claim.claim_id, handlerId)
      .then(onSignedOff, (reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "The sign-off failed.",
        );
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <form className="sign-off" onSubmit={submit}>
      <label htmlFor="handler">Handler</label>
      <select
        id="handler"
        value={handlerId}
        onChange={(event) => {
          setHandlerId(event.target.value);
        }}
      >
        <option value="">Choose your name</option>
        {handlers
          .filter((handler) => handler.can_approve_over_limit)
          .map((handler) => (
            <option key={handler.handler_id} value={handler.handler_id}>
              {handler.name}
            </option>
          ))}
      </select>
      <button type="submit" disabled={sending || !handlerId}>
        Sign off and pay {money(claim.payout ?? 0)}
      </button>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Payment({
  claim,
  onSignedOff,
}: Readonly<{ claim: Claim; onSignedOff: OnSignedOff }>) {
  const { data: handlers } = useData(api.handlers, false);
  const signedOffBy = handlers?.find(
    (handler) => handler.handler_id === claim.signed_off_by,
  );

  if (claim.paid_amount !== null && claim.paid_at !== null) {
    return (
      <div className="payment">
        <p>
          Paid <span className="mono">{money(claim.paid_amount)}</span> on{" "}
          <span className="mono">{dateTime(claim.paid_at)}</span>.
        </p>
        {claim.signed_off_by && (
          <p>Signed off by {signedOffBy?.name ?? claim.signed_off_by}.</p>
        )}
      </div>
    );
  }
  if (claim.status === "waiting_for_sign_off") {
    return (
      <div className="payment">
        <p>
          The payment of{" "}
          <span className="mono">{money(claim.payout ?? 0)}</span> waits for a
          handler's sign-off.
        </p>
        <SignOffForm
          claim={claim}
          handlers={handlers ?? []}
          onSignedOff={onSignedOff}
        />
      </div>
    );
  }
  return (
    <p className="payment muted">
      {claim.decision === "approve" ? "Not paid yet." : "No payment."}
    </p>
  );
}

export function DecisionPanel({
  claim,
  onSignedOff,
}: Readonly<{ claim: Claim; onSignedOff: OnSignedOff }>) {
  return (
    <section className="panel" aria-labelledby="decision">
      <h2 id="decision">The agent's decision</h2>
      {claim.decision === null ? (
        <p className="muted">
          {claim.status === "in_progress"
            ? "The agent is working on this claim."
            : "The agent hasn't worked on this claim yet."}
        </p>
      ) : (
        <>
          <dl className="facts">
            <div>
              <dt>Decision</dt>
              <dd className="decision">{decisionLabels[claim.decision]}</dd>
            </div>
            <div>
              <dt>Payout</dt>
              <dd className="mono">{money(claim.payout ?? 0)}</dd>
            </div>
            <div>
              <dt>Policy section</dt>
              <dd>{claim.policy_section}</dd>
            </div>
          </dl>
          <p className="prose">{claim.reasons}</p>
          <Payment claim={claim} onSignedOff={onSignedOff} />
        </>
      )}
    </section>
  );
}
