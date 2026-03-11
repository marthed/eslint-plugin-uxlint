import { ReactQueryBadCase } from "./bad/ReactQueryBadCase";
import { ReactQueryGoodCase } from "./good/ReactQueryGoodCase";
import {
  FrameworkCaseRow,
  FrameworkPlaygroundPage,
} from "../shared/FrameworkPlayground";

export function ReactQueryPlaygroundPage() {
  return (
    <FrameworkPlaygroundPage
      title="React Query Playground"
      description="Real @tanstack/react-query imports across provider, hook, service, and leaf controls."
    >
      <FrameworkCaseRow
        title="Multi-file mutation feedback with missing success state (INTERACTION-ASYNC-SUCCESS-001)"
        bad={<ReactQueryBadCase />}
        good={<ReactQueryGoodCase />}
      />
    </FrameworkPlaygroundPage>
  );
}
