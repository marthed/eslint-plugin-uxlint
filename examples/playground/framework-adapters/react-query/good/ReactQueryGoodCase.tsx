import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryGoodPanel } from "../components/ReactQueryGoodPanel";
import { createQueryClient } from "../createQueryClient";

export function ReactQueryGoodCase() {
  const [queryClient] = React.useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryGoodPanel />
    </QueryClientProvider>
  );
}
