import { useSyncExternalStore } from "react";
import { ClaimPage } from "./ClaimPage";
import { InstructionsPage } from "./InstructionsPage";
import { QueuePage } from "./QueuePage";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
  };
}

function useHash() {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}

function Page({ hash }: Readonly<{ hash: string }>) {
  const claim = /^#\/claims\/([\w-]+)$/.exec(hash);
  if (claim) return <ClaimPage key={claim[1]} claimId={claim[1]} />;
  if (hash === "#/instructions") return <InstructionsPage />;
  return <QueuePage />;
}

export function App() {
  const hash = useHash();
  const onInstructions = hash === "#/instructions";

  return (
    <>
      <header className="masthead">
        <a className="brand" href="#/">
          UnderCover <span className="tagline">Claims, straight through</span>
        </a>
        <nav aria-label="Main">
          <a href="#/" aria-current={onInstructions ? undefined : "page"}>
            Queue
          </a>
          <a
            href="#/instructions"
            aria-current={onInstructions ? "page" : undefined}
          >
            Instructions
          </a>
        </nav>
      </header>
      <main>
        <Page hash={hash} />
      </main>
    </>
  );
}
