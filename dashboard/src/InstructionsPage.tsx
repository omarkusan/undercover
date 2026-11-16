import { api } from "./api";
import { useData } from "./useData";

export function InstructionsPage() {
  const { data, failed } = useData(api.instructions, false);

  return (
    <>
      <h1>The agent's instructions</h1>
      <p className="muted">
        This is the text the agent works from: its instructions, followed by the
        policy wording. It's read only.
      </p>
      {failed && (
        <p role="alert" className="alert">
          The instructions can't be loaded right now.
        </p>
      )}
      {data && (
        <section className="panel" aria-label="Instructions">
          <pre className="instructions">{data.instructions}</pre>
        </section>
      )}
    </>
  );
}
