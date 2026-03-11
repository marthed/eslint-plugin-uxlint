import { ReduxBadCase } from "./bad/ReduxBadCase";
import { ReduxGoodCase } from "./good/ReduxGoodCase";
import {
  FrameworkCaseRow,
  FrameworkPlaygroundPage,
} from "../shared/FrameworkPlayground";

export function ReduxPlaygroundPage() {
  return (
    <FrameworkPlaygroundPage
      title="Redux Playground"
      description="Real @reduxjs/toolkit and react-redux imports across async thunks, store setup, selectors, and leaf controls."
    >
      <FrameworkCaseRow
        title="Multi-file store feedback with missing error state (INTERACTION-ASYNC-ERROR-001)"
        bad={<ReduxBadCase />}
        good={<ReduxGoodCase />}
      />
    </FrameworkPlaygroundPage>
  );
}
