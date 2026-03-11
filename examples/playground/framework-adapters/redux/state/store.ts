import { configureStore } from "@reduxjs/toolkit";
import { profileReducer } from "./profileSlice";

export function createPlaygroundStore() {
  return configureStore({
    reducer: {
      profile: profileReducer,
    },
  });
}

export type PlaygroundStore = ReturnType<typeof createPlaygroundStore>;
export type RootState = ReturnType<PlaygroundStore["getState"]>;
export type AppDispatch = PlaygroundStore["dispatch"];
