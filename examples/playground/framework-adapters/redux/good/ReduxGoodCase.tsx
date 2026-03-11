import React from "react";
import { Provider } from "react-redux";
import { ReduxGoodPanel } from "../components/ReduxGoodPanel";
import { createPlaygroundStore } from "../state/store";

export function ReduxGoodCase() {
  const [store] = React.useState(createPlaygroundStore);

  return (
    <Provider store={store}>
      <ReduxGoodPanel />
    </Provider>
  );
}
