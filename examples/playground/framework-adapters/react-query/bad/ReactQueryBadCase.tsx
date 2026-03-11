import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryBadPanel } from "../components/ReactQueryBadPanel";
import { createQueryClient } from "../createQueryClient";

export function ReactQueryBadCase() {
  const [queryClient] = React.useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryBadPanel />
    </QueryClientProvider>
  );
}
