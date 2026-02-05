import { http } from "./http";

export function health() {
  return http.get("/health");
}
