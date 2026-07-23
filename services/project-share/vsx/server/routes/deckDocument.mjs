import { DECK_HTML } from "../deck-data.mjs";
import { sendHtml, sendText } from "../lib/respond.mjs";

export async function handleDeckDocumentRoute(req, res, { isAuthed }) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!isAuthed) {
    res.setHeader("Location", "/");
    res.status(302).send("");
    return;
  }

  sendHtml(res, 200, DECK_HTML);
}
