// Makes the phone/browser back button behave like an in-app back action
// (close the open sheet, or return to the previous tab) instead of
// leaving the PWA. Views push a history entry per tab switch; opening a
// sheet (entry form/detail) pushes one more. `popstate` — fired for the
// hardware back button as much as for our own history.back() calls — is
// the single place that decides what "going back" means right now.
let sheetPushed = false;

export function markSheetOpened() {
  if (!sheetPushed) {
    history.pushState({ type: 'sheet' }, '');
    sheetPushed = true;
  }
}

// Call when a sheet is dismissed through the UI (not the back button)
// so the pushed history entry gets consumed and stays in sync.
export function markSheetClosed() {
  if (sheetPushed) {
    sheetPushed = false;
    history.back();
  }
}

export function isSheetTracked() {
  return sheetPushed;
}

// The popstate handler calls this once it has resolved what the pop
// meant, so our flag matches reality even when the back button (not
// markSheetClosed) triggered it.
export function syncSheetFlag(open) {
  sheetPushed = open;
}
