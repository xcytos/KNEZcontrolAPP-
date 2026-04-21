import { useEffect, useState } from "react";
import { taqwinActivationService } from "../services/infrastructure/activation/TaqwinActivationService";

export function useTaqwinActivationStatus() {
  const [status, setStatus] = useState(() => taqwinActivationService.getStatus());

  useEffect(() => {
    return taqwinActivationService.subscribe(setStatus);
  }, []);

  return status;
}

