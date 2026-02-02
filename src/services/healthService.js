import { http } from "./http";
export const health = () => http.get("/health");
