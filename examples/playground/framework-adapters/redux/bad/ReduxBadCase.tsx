import React from "react";
import { Provider } from "react-redux";
import { ReduxBadPanel } from "../components/ReduxBadPanel";
import { createPlaygroundStore } from "../state/store";

export function ReduxBadCase() {
  const [store] = React.useState(createPlaygroundStore);

  return (
    <Provider store={store}>
      <ReduxBadPanel />
    </Provider>
  );
}
