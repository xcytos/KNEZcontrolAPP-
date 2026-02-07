import { useContext } from "react";
import { StatusContext } from "./StatusProvider";

export function useStatus() {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error("useStatus must be used within StatusProvider");
  return ctx;
}

