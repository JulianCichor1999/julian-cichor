import { handle } from "../../server/assistant.mjs";

export function onRequest({ request, env }) {
  return handle(request, env);
}
