import type { Step } from "./api";
import { time } from "./format";

const FOLD_AFTER = 160;

const kindLabels: Record<Step["kind"], string> = {
  tool_call: "Tool call",
  tool_result: "Result",
  message: "Agent",
};

function StepText({ step }: Readonly<{ step: Step }>) {
  if (step.kind === "message") return <p className="prose">{step.text}</p>;
  if (step.text.length <= FOLD_AFTER)
    return <p className="mono">{step.text}</p>;
  return (
    <details>
      <summary className="mono">{step.text.slice(0, FOLD_AFTER)}…</summary>
      <pre>{step.text}</pre>
    </details>
  );
}

export function StepsPanel({ steps }: Readonly<{ steps: Step[] }>) {
  return (
    <section className="panel" aria-labelledby="steps">
      <h2 id="steps">The agent's steps</h2>
      {steps.length === 0 ? (
        <p className="muted">No steps yet.</p>
      ) : (
        <ol className="steps">
          {steps.map((step) => (
            <li key={step.step_id}>
              <div className="step-meta">
                <span className="step-kind">{kindLabels[step.kind]}</span>
                <time className="mono muted" dateTime={step.created_at}>
                  {time(step.created_at)}
                </time>
              </div>
              <StepText step={step} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
