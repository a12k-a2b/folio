/** Client-only: signed-in visitors use the server; everyone else uses localStorage. */
export let folioAuthed = false;
export function setFolioAuthed(v: boolean) {
  folioAuthed = v;
}
