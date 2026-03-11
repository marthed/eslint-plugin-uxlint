import { ZustandBadCase } from "./bad/ZustandBadCase";
import { ZustandGoodCase } from "./good/ZustandGoodCase";
import {
  FrameworkCaseRow,
  FrameworkPlaygroundPage,
} from "../shared/FrameworkPlayground";

export function ZustandPlaygroundPage() {
  return (
    <FrameworkPlaygroundPage
      title="Zustand Playground"
      description="Real zustand store hooks across async actions, store selectors, and imported control components."
    >
      <FrameworkCaseRow
        title="Multi-file store feedback with missing pending state (INTERACTION-ASYNC-START-001 / INTERACTION-ASYNC-SETTLED-001)"
        bad={<ZustandBadCase />}
        good={<ZustandGoodCase />}
      />
    </FrameworkPlaygroundPage>
  );
}
