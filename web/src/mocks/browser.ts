import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** Service worker used when the API is not running (`VITE_MOCK_API=1`). */
export const worker = setupWorker(...handlers);
