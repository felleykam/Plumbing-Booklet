/* ---------- My jobs (Mine → Jobs). Each job is a timeline of stages (Underground → Final) with the blanks laid out:
   status, dates, lead, checklist, inspections, hours, notes, photos. People (lead, super, inspector…) are their own pages,
   linked from jobs and from notes with [[Name]]. Jobs and people live in jpb-jobs (in Settings → Download backup); photos
   and files live in IndexedDB "jpb-files" with their own zip backup. Own script block, all inside try. */
try {
const jbD = (x => { if (x && typeof x === "object" && Array.isArray(x.jobs)) return x;
  try { const raw = localStorage.getItem("jpb-jobs"); if (raw && raw !== "null") localStorage.setItem("jpb-jobs-unreadable", raw); } catch(e){}   /* never overwrite what we couldn't read */
  return {jobs: [], goal: 8000, before: 0}; })(store.get("jpb-jobs", null));
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e){}   /* ask iOS not to clear this app's storage when the phone is low on space */
if (!Array.isArray(jbD.people)) jbD.people = []; if (!Array.isArray(jbD.builders)) jbD.builders = []; if (!Array.isArray(jbD.subs)) jbD.subs = [];
const JB = {open: null, person: null, view: "jobs", show: "open", tag: null, edit: null, stage: null, back: null, ckEdit: false, ent: null, hist: []}, JF = {n: 0, cur: null, url: null};
const JB_STG = [["under", "Underground"], ["rough", "Top-out (rough-in)"], ["gas", "Gas"], ["trim", "Finish (trim)"], ["final", "Final"], ["warr", "Warranty"]];
const JB_SNAME = Object.fromEntries(JB_STG);
/* every job has Underground, Top-out and Finish; Gas, Final and Warranty are extras you add to a job when it needs them */
const JB_XTRA = ["gas", "final", "warr"];
const jbStages = j => JB_STG.filter(([k]) => !JB_XTRA.includes(k) || (j.xs || []).includes(k));
const JB_SST = {todo: "To do", doing: "Doing", done: "Done", skip: "Skip"};
const JB_ICON = {todo: "○", doing: "●", done: "✓", skip: "–"};
/* starting checklists: the book's "Before you call it in" lists, and the Phases card's lines for gas and trim */
const JB_TPL = {under: () => CK.under, rough: () => CK.rough, final: () => CK.final,
  gas: () => ["Gas piping under test (often the same visit as top-out)", "Test pressure and hold time logged in the Test log"],
  trim: () => ["Toilets set", "Faucets and sinks set", "Disposer hooked up", "Water heater hooked up", "Hose bibbs on"], warr: () => []};
const JB_ROLES = ["Lead", "Superintendent", "Builder / GC", "Homeowner", "Inspector", "Supply house", "Other"];
const JB_PAL = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown", "gray"];
/* job icons: isometric, black and white, drawn in code (scratchpad isoicons.py). [label, svg paths]; faces use classes o1-o7 */
const JB_ISO = {"house":["House","<path class=\"o3\" d=\"M27.9 23.3L17.1 29.5L17.1 19.5L27.9 13.3Z\"/><path class=\"o5\" d=\"M4.1 22.0L17.1 29.5L17.1 19.5L4.1 12.1Z\"/><path class=\"o1\" d=\"M14.9 5.9L27.9 13.3L17.1 19.5L4.1 12.1Z\"/><path class=\"o4\" d=\"M4.1 12.1L17.1 19.5L22.5 10.0L9.5 2.5Z\"/><path class=\"o3\" d=\"M27.9 13.3L17.1 19.5L22.5 10.0Z\"/><path class=\"ln\" d=\"M6.3 23.3L9.3 25.0L9.3 18.6L6.3 16.8L6.3 23.3\"/><path class=\"ln\" d=\"M24.6 21.2L21.0 23.3L21.0 19.8L24.6 17.7L24.6 21.2\"/>"],"twostory":["Two-story","<path class=\"o3\" d=\"M24.8 24.4L16.0 29.5L16.0 15.2L24.8 10.1Z\"/><path class=\"o5\" d=\"M7.2 24.4L16.0 29.5L16.0 15.2L7.2 10.1Z\"/><path class=\"o1\" d=\"M16.0 5.0L24.8 10.1L16.0 15.2L7.2 10.1Z\"/><path class=\"o4\" d=\"M7.2 10.1L16.0 15.2L20.4 7.6L11.6 2.5Z\"/><path class=\"o3\" d=\"M24.8 10.1L16.0 15.2L20.4 7.6Z\"/><path class=\"ln\" d=\"M8.6 23.2L10.7 24.4L10.7 21.6L8.6 20.3L8.6 23.2\"/><path class=\"ln\" d=\"M8.6 16.7L10.7 17.9L10.7 15.0L8.6 13.8L8.6 16.7\"/><path class=\"ln\" d=\"M12.5 25.4L14.6 26.6L14.6 23.8L12.5 22.6L12.5 25.4\"/><path class=\"ln\" d=\"M12.5 18.9L14.6 20.1L14.6 17.3L12.5 16.1L12.5 18.9\"/>"],"ranch":["Rambler","<path class=\"o3\" d=\"M29.5 23.3L21.2 28.1L21.2 20.9L29.5 16.1Z\"/><path class=\"o5\" d=\"M2.5 17.3L21.2 28.1L21.2 20.9L2.5 10.1Z\"/><path class=\"o1\" d=\"M10.8 5.3L29.5 16.1L21.2 20.9L2.5 10.1Z\"/><path class=\"o4\" d=\"M2.5 10.1L21.2 20.9L25.3 14.7L6.7 3.9Z\"/><path class=\"o3\" d=\"M29.5 16.1L21.2 20.9L25.3 14.7Z\"/><path class=\"ln\" d=\"M4.6 18.5L7.1 20.0L7.1 14.7L4.6 13.2L4.6 18.5\"/><path class=\"ln\" d=\"M10.8 19.7L16.0 22.7L16.0 19.6L10.8 16.6L10.8 19.7\"/>"],"townhomes":["Townhomes","<path class=\"o3\" d=\"M17.8 17.9L8.7 23.1L8.7 12.6L17.8 7.3Z\"/><path class=\"o5\" d=\"M3.2 20.0L8.7 23.1L8.7 12.6L3.2 9.4Z\"/><path class=\"o1\" d=\"M12.3 4.1L17.8 7.3L8.7 12.6L3.2 9.4Z\"/><path class=\"o4\" d=\"M3.2 9.4L8.7 12.6L13.2 5.7L7.7 2.5Z\"/><path class=\"o3\" d=\"M17.8 7.3L8.7 12.6L13.2 5.7Z\"/><path class=\"ln\" d=\"M4.6 20.8L6.8 22.1L6.8 17.2L4.6 15.9L4.6 20.8\"/><path class=\"o3\" d=\"M23.3 21.0L14.2 26.3L14.2 13.6L23.3 8.3Z\"/><path class=\"o5\" d=\"M8.7 23.1L14.2 26.3L14.2 13.6L8.7 10.4Z\"/><path class=\"o1\" d=\"M17.8 5.1L23.3 8.3L14.2 13.6L8.7 10.4Z\"/><path class=\"o4\" d=\"M8.7 10.4L14.2 13.6L18.8 6.7L13.2 3.6Z\"/><path class=\"o3\" d=\"M23.3 8.3L14.2 13.6L18.8 6.7Z\"/><path class=\"ln\" d=\"M10.1 24.0L12.3 25.3L12.3 20.4L10.1 19.1L10.1 24.0\"/><path class=\"o3\" d=\"M28.8 24.2L19.7 29.5L19.7 18.9L28.8 13.6Z\"/><path class=\"o5\" d=\"M14.2 26.3L19.7 29.5L19.7 18.9L14.2 15.7Z\"/><path class=\"o1\" d=\"M23.3 10.4L28.8 13.6L19.7 18.9L14.2 15.7Z\"/><path class=\"o4\" d=\"M14.2 15.7L19.7 18.9L24.3 12.0L18.8 8.9Z\"/><path class=\"o3\" d=\"M28.8 13.6L19.7 18.9L24.3 12.0Z\"/><path class=\"ln\" d=\"M15.6 27.2L17.8 28.4L17.8 23.6L15.6 22.3L15.6 27.2\"/>"],"duplex":["Duplex","<path class=\"o3\" d=\"M20.7 19.7L11.3 25.2L11.3 14.3L20.7 8.9Z\"/><path class=\"o5\" d=\"M3.8 20.8L11.3 25.2L11.3 14.3L3.8 10.0Z\"/><path class=\"o1\" d=\"M13.2 4.6L20.7 8.9L11.3 14.3L3.8 10.0Z\"/><path class=\"o4\" d=\"M3.8 10.0L11.3 14.3L16.0 6.8L8.5 2.5Z\"/><path class=\"o3\" d=\"M20.7 8.9L11.3 14.3L16.0 6.8Z\"/><path class=\"ln\" d=\"M6.2 22.2L8.9 23.8L8.9 18.3L6.2 16.8L6.2 22.2\"/><path class=\"o3\" d=\"M28.2 24.1L18.8 29.5L18.8 18.7L28.2 13.2Z\"/><path class=\"o5\" d=\"M11.3 25.2L18.8 29.5L18.8 18.7L11.3 14.3Z\"/><path class=\"o1\" d=\"M20.7 8.9L28.2 13.2L18.8 18.7L11.3 14.3Z\"/><path class=\"o4\" d=\"M11.3 14.3L18.8 18.7L23.5 11.2L16.0 6.8Z\"/><path class=\"o3\" d=\"M28.2 13.2L18.8 18.7L23.5 11.2Z\"/><path class=\"ln\" d=\"M13.7 26.6L16.4 28.1L16.4 22.7L13.7 21.2L13.7 26.6\"/>"],"apartments":["Apartments","<path class=\"o3\" d=\"M24.8 24.4L16.0 29.5L16.0 12.6L24.8 7.6Z\"/><path class=\"o5\" d=\"M7.2 24.4L16.0 29.5L16.0 12.6L7.2 7.6Z\"/><path class=\"o1\" d=\"M16.0 2.5L24.8 7.6L16.0 12.6L7.2 7.6Z\"/><path class=\"ln\" d=\"M8.4 22.6L10.2 23.6L10.2 21.4L8.4 20.4L8.4 22.6\"/><path class=\"ln\" d=\"M10.7 23.9L12.5 24.9L12.5 22.8L10.7 21.7L10.7 23.9\"/><path class=\"ln\" d=\"M13.1 25.3L14.8 26.3L14.8 24.1L13.1 23.1L13.1 25.3\"/><path class=\"ln\" d=\"M23.6 22.6L21.8 23.6L21.8 21.4L23.6 20.4L23.6 22.6\"/><path class=\"ln\" d=\"M21.3 23.9L19.5 24.9L19.5 22.8L21.3 21.7L21.3 23.9\"/><path class=\"ln\" d=\"M18.9 25.3L17.2 26.3L17.2 24.1L18.9 23.1L18.9 25.3\"/><path class=\"ln\" d=\"M8.4 18.4L10.2 19.4L10.2 17.2L8.4 16.2L8.4 18.4\"/><path class=\"ln\" d=\"M10.7 19.7L12.5 20.7L12.5 18.5L10.7 17.5L10.7 19.7\"/><path class=\"ln\" d=\"M13.1 21.1L14.8 22.1L14.8 19.9L13.1 18.9L13.1 21.1\"/><path class=\"ln\" d=\"M23.6 18.4L21.8 19.4L21.8 17.2L23.6 16.2L23.6 18.4\"/><path class=\"ln\" d=\"M21.3 19.7L19.5 20.7L19.5 18.5L21.3 17.5L21.3 19.7\"/><path class=\"ln\" d=\"M18.9 21.1L17.2 22.1L17.2 19.9L18.9 18.9L18.9 21.1\"/><path class=\"ln\" d=\"M8.4 14.1L10.2 15.2L10.2 13.0L8.4 11.9L8.4 14.1\"/><path class=\"ln\" d=\"M10.7 15.5L12.5 16.5L12.5 14.3L10.7 13.3L10.7 15.5\"/><path class=\"ln\" d=\"M13.1 16.8L14.8 17.9L14.8 15.7L13.1 14.6L13.1 16.8\"/><path class=\"ln\" d=\"M23.6 14.1L21.8 15.2L21.8 13.0L23.6 11.9L23.6 14.1\"/><path class=\"ln\" d=\"M21.3 15.5L19.5 16.5L19.5 14.3L21.3 13.3L21.3 15.5\"/><path class=\"ln\" d=\"M18.9 16.8L17.2 17.9L17.2 15.7L18.9 14.6L18.9 16.8\"/>"],"tower":["Office tower","<path class=\"o3\" d=\"M21.2 26.5L16.0 29.5L16.0 10.0L21.2 7.0Z\"/><path class=\"o5\" d=\"M10.8 26.5L16.0 29.5L16.0 10.0L10.8 7.0Z\"/><path class=\"o1\" d=\"M16.0 4.0L21.2 7.0L16.0 10.0L10.8 7.0Z\"/><path class=\"o3\" d=\"M18.6 7.0L16.0 8.5L16.0 5.5L18.6 4.0Z\"/><path class=\"o5\" d=\"M13.4 7.0L16.0 8.5L16.0 5.5L13.4 4.0Z\"/><path class=\"o1\" d=\"M16.0 2.5L18.6 4.0L16.0 5.5L13.4 4.0Z\"/><path class=\"ln\" d=\"M10.8 22.8L16.0 25.8L21.2 22.8\"/><path class=\"ln\" d=\"M10.8 19.0L16.0 22.0L21.2 19.0\"/><path class=\"ln\" d=\"M10.8 15.2L16.0 18.2L21.2 15.2\"/><path class=\"ln\" d=\"M10.8 11.5L16.0 14.5L21.2 11.5\"/>"],"warehouse":["Warehouse","<path class=\"o3\" d=\"M29.5 21.8L19.4 27.7L19.4 19.9L29.5 14.1Z\"/><path class=\"o5\" d=\"M2.5 17.9L19.4 27.7L19.4 19.9L2.5 10.2Z\"/><path class=\"o1\" d=\"M12.6 4.3L29.5 14.1L19.4 19.9L2.5 10.2Z\"/><path class=\"ln\" d=\"M5.9 19.9L10.9 22.8L10.9 17.4L5.9 14.4L5.9 19.9\"/><path class=\"ln\" d=\"M5.9 18.5L10.9 21.5\"/><path class=\"ln\" d=\"M5.9 17.2L10.9 20.1\"/><path class=\"ln\" d=\"M5.9 15.8L10.9 18.7\"/>"],"strip":["Strip mall","<path class=\"o3\" d=\"M29.5 22.5L21.1 27.4L21.1 21.2L29.5 16.3Z\"/><path class=\"o5\" d=\"M2.5 16.7L21.1 27.4L21.1 21.2L2.5 10.4Z\"/><path class=\"o1\" d=\"M10.9 5.6L29.5 16.3L21.1 21.2L2.5 10.4Z\"/><path class=\"o3\" d=\"M29.5 16.3L21.1 21.2L21.1 20.2L29.5 15.3Z\"/><path class=\"o5\" d=\"M2.5 10.4L21.1 21.2L21.1 20.2L2.5 9.5Z\"/><path class=\"o1\" d=\"M10.9 4.6L29.5 15.3L21.1 20.2L2.5 9.5Z\"/><path class=\"ln\" d=\"M3.5 16.9L7.6 19.2L7.6 14.9L3.5 12.6L3.5 16.9\"/><path class=\"ln\" d=\"M9.8 20.5L13.8 22.8L13.8 18.5L9.8 16.2L9.8 20.5\"/><path class=\"ln\" d=\"M16.0 24.1L20.0 26.4L20.0 22.1L16.0 19.8L16.0 24.1\"/>"],"barn":["Barn","<path class=\"o3\" d=\"M28.7 21.6L15.0 29.5L15.0 20.5L28.7 12.6Z\"/><path class=\"o5\" d=\"M3.3 22.8L15.0 29.5L15.0 20.5L3.3 13.8Z\"/><path class=\"o1\" d=\"M17.0 5.9L28.7 12.6L15.0 20.5L3.3 13.8Z\"/><path class=\"o3\" d=\"M28.7 12.6L15.0 20.5L9.2 10.4L22.8 2.5Z\"/><path class=\"o5\" d=\"M3.3 13.8L15.0 20.5L9.2 10.4Z\"/><path class=\"ln\" d=\"M6.8 24.8L11.5 27.5L11.5 20.7L6.8 18.0L6.8 24.8\"/><path class=\"ln\" d=\"M6.8 24.8L11.5 20.7\"/><path class=\"ln\" d=\"M11.5 27.5L6.8 18.0\"/>"],"cabin":["Cabin","<path class=\"o4\" d=\"M2.5 20.8L17.0 29.2L23.3 11.2L8.7 2.8Z\"/><path class=\"o3\" d=\"M29.5 22.0L17.0 29.2L23.3 11.2Z\"/><path class=\"ln\" d=\"M24.9 24.6L21.6 26.6L21.6 20.8L24.9 18.9L24.9 24.6\"/>"],"garage":["Garage","<path class=\"o3\" d=\"M29.5 20.5L16.0 28.3L16.0 20.0L29.5 12.2Z\"/><path class=\"o5\" d=\"M2.5 20.5L16.0 28.3L16.0 20.0L2.5 12.2Z\"/><path class=\"o1\" d=\"M16.0 4.4L29.5 12.2L16.0 20.0L2.5 12.2Z\"/><path class=\"o4\" d=\"M2.5 12.2L16.0 20.0L22.8 11.5L9.2 3.7Z\"/><path class=\"o3\" d=\"M29.5 12.2L16.0 20.0L22.8 11.5Z\"/><path class=\"ln\" d=\"M4.7 21.8L13.8 27.0L13.8 20.3L4.7 15.1L4.7 21.8\"/><path class=\"ln\" d=\"M4.7 20.2L13.8 25.4\"/><path class=\"ln\" d=\"M4.7 18.5L13.8 23.7\"/><path class=\"ln\" d=\"M4.7 16.8L13.8 22.0\"/>"],"shed":["Shed","<path class=\"o3\" d=\"M27.6 22.8L16.0 29.5L16.0 18.0L27.6 11.2Z\"/><path class=\"o5\" d=\"M4.4 22.8L16.0 29.5L16.0 18.0L4.4 11.2Z\"/><path class=\"o1\" d=\"M16.0 4.5L27.6 11.2L16.0 18.0L4.4 11.2Z\"/><path class=\"o3\" d=\"M27.6 11.2L16.0 18.0L10.2 9.2L21.8 2.5Z\"/><path class=\"o5\" d=\"M4.4 11.2L16.0 18.0L10.2 9.2Z\"/><path class=\"ln\" d=\"M7.7 24.7L12.7 27.6L12.7 19.1L7.7 16.2L7.7 24.7\"/>"],"church":["Church","<path class=\"o3\" d=\"M26.3 18.7L13.2 26.3L13.2 17.6L26.3 10.1Z\"/><path class=\"o5\" d=\"M5.7 21.9L13.2 26.3L13.2 17.6L5.7 13.3Z\"/><path class=\"o1\" d=\"M18.8 5.7L26.3 10.1L13.2 17.6L5.7 13.3Z\"/><path class=\"o3\" d=\"M26.3 10.1L13.2 17.6L9.5 10.1L22.5 2.5Z\"/><path class=\"o5\" d=\"M5.7 13.3L13.2 17.6L9.5 10.1Z\"/><path class=\"o3\" d=\"M21.6 26.8L16.9 29.5L16.9 14.4L21.6 11.7Z\"/><path class=\"o5\" d=\"M12.3 26.8L16.9 29.5L16.9 14.4L12.3 11.7Z\"/><path class=\"o1\" d=\"M16.9 9.0L21.6 11.7L16.9 14.4L12.3 11.7Z\"/><path class=\"o3\" d=\"M21.6 11.7L16.9 14.4L16.9 4.1Z\"/><path class=\"o5\" d=\"M12.3 11.7L16.9 14.4L16.9 4.1Z\"/>"],"mountain":["Mountain / rural","<path class=\"o3\" d=\"M29.5 16.9L16.0 24.7L16.0 4.7Z\"/><path class=\"o5\" d=\"M2.5 16.9L16.0 24.7L16.0 4.7Z\"/><path class=\"o3\" d=\"M22.0 22.9L14.5 27.3L14.5 16.0Z\"/><path class=\"o5\" d=\"M7.0 22.9L14.5 27.3L14.5 16.0Z\"/>"],"tree":["Trees / lot","<path class=\"o4\" d=\"M14.4 16.2L14.5 16.0L14.7 15.8L14.9 15.7L15.1 15.6L15.4 15.5L15.7 15.4L16.0 15.4L16.3 15.5L16.6 15.6L16.8 15.7L17.0 15.8L17.2 16.0L17.2 16.2L17.2 20.7L17.2 20.9L17.2 21.1L17.0 21.3L16.8 21.4L16.6 21.5L16.3 21.6L16.0 21.6L15.7 21.6L15.4 21.6L15.1 21.5L14.9 21.4L14.7 21.3L14.5 21.1L14.4 20.9Z\"/><path class=\"o1\" d=\"M16.8 16.8L16.6 16.9L16.3 17.0L16.0 17.1L15.7 17.1L15.4 17.0L15.1 16.9L14.9 16.8L14.7 16.7L14.5 16.5L14.4 16.3L14.4 16.2L14.5 16.0L14.7 15.8L14.9 15.7L15.1 15.6L15.4 15.5L15.7 15.4L16.0 15.4L16.3 15.5L16.6 15.6L16.8 15.7L17.0 15.8L17.2 16.0L17.2 16.2L17.2 16.3L17.2 16.5L17.0 16.7Z\"/><path class=\"o4\" d=\"M8.6 15.8L9.0 14.9L15.8 2.5L22.7 14.9L23.1 15.8L23.1 16.7L22.7 17.6L22.0 18.5L21.0 19.2L19.7 19.8L18.3 20.2L16.7 20.4L15.0 20.4L13.4 20.2L12.0 19.8L10.7 19.2L9.7 18.5L9.0 17.6L8.6 16.7Z\"/><path class=\"o4\" d=\"M16.7 25.3L16.8 25.2L16.9 25.1L17.0 25.0L17.2 24.9L17.5 24.8L17.7 24.8L18.0 24.8L18.2 24.8L18.4 24.9L18.6 25.0L18.8 25.1L18.9 25.2L18.9 25.3L18.9 28.9L18.9 29.1L18.8 29.2L18.6 29.3L18.4 29.4L18.2 29.5L18.0 29.5L17.7 29.5L17.5 29.5L17.2 29.4L17.0 29.3L16.9 29.2L16.8 29.1L16.7 28.9Z\"/><path class=\"o1\" d=\"M18.6 25.9L18.4 26.0L18.2 26.0L18.0 26.1L17.7 26.1L17.5 26.0L17.2 26.0L17.0 25.9L16.9 25.8L16.8 25.6L16.7 25.5L16.7 25.3L16.8 25.2L16.9 25.1L17.0 25.0L17.2 24.9L17.5 24.8L17.7 24.8L18.0 24.8L18.2 24.8L18.4 24.9L18.6 25.0L18.8 25.1L18.9 25.2L18.9 25.3L18.9 25.5L18.9 25.6L18.8 25.8Z\"/><path class=\"o4\" d=\"M12.3 25.1L12.5 24.3L17.8 15.1L23.1 24.3L23.4 25.1L23.4 25.8L23.1 26.5L22.6 27.1L21.8 27.7L20.8 28.2L19.7 28.5L18.5 28.6L17.2 28.6L16.0 28.5L14.8 28.2L13.9 27.7L13.1 27.1L12.5 26.5L12.3 25.8Z\"/>"],"heater":["Water heater","<path class=\"o4\" d=\"M9.4 7.3L9.8 6.4L10.4 5.7L11.3 5.0L12.5 4.5L13.8 4.1L15.3 3.9L16.7 3.9L18.2 4.1L19.5 4.5L20.7 5.0L21.6 5.7L22.2 6.4L22.6 7.3L22.6 25.3L22.6 26.1L22.2 27.0L21.6 27.7L20.7 28.4L19.5 28.9L18.2 29.3L16.7 29.5L15.3 29.5L13.8 29.3L12.5 28.9L11.3 28.4L10.4 27.7L9.8 27.0L9.4 26.1Z\"/><path class=\"o1\" d=\"M20.7 10.4L19.5 10.9L18.2 11.3L16.7 11.5L15.3 11.5L13.8 11.3L12.5 10.9L11.3 10.4L10.4 9.7L9.8 9.0L9.4 8.1L9.4 7.3L9.8 6.4L10.4 5.7L11.3 5.0L12.5 4.5L13.8 4.1L15.3 3.9L16.7 3.9L18.2 4.1L19.5 4.5L20.7 5.0L21.6 5.7L22.2 6.4L22.6 7.3L22.6 8.1L22.2 9.0L21.6 9.7Z\"/><path class=\"o4\" d=\"M13.2 3.1L13.3 3.0L13.4 2.8L13.6 2.7L13.8 2.6L14.0 2.5L14.3 2.5L14.6 2.5L14.9 2.5L15.1 2.6L15.3 2.7L15.5 2.8L15.6 3.0L15.7 3.1L15.7 6.9L15.6 7.0L15.5 7.2L15.3 7.3L15.1 7.4L14.9 7.5L14.6 7.5L14.3 7.5L14.0 7.5L13.8 7.4L13.6 7.3L13.4 7.2L13.3 7.0L13.2 6.9Z\"/><path class=\"o1\" d=\"M15.3 3.7L15.1 3.8L14.9 3.9L14.6 3.9L14.3 3.9L14.0 3.9L13.8 3.8L13.6 3.7L13.4 3.6L13.3 3.4L13.2 3.3L13.2 3.1L13.3 3.0L13.4 2.8L13.6 2.7L13.8 2.6L14.0 2.5L14.3 2.5L14.6 2.5L14.9 2.5L15.1 2.6L15.3 2.7L15.5 2.8L15.6 3.0L15.7 3.1L15.7 3.3L15.6 3.4L15.5 3.6Z\"/><path class=\"o4\" d=\"M16.3 5.1L16.3 4.9L16.4 4.8L16.5 4.6L16.7 4.5L16.9 4.4L17.1 4.3L17.4 4.3L17.7 4.3L18.0 4.3L18.2 4.4L18.4 4.5L18.6 4.6L18.7 4.8L18.8 4.9L18.8 8.7L18.7 8.8L18.6 9.0L18.4 9.1L18.2 9.2L18.0 9.3L17.7 9.3L17.4 9.3L17.1 9.3L16.9 9.2L16.7 9.1L16.5 9.0L16.4 8.8L16.3 8.7Z\"/><path class=\"o1\" d=\"M18.4 5.5L18.2 5.6L18.0 5.7L17.7 5.7L17.4 5.7L17.1 5.7L16.9 5.6L16.7 5.5L16.5 5.4L16.4 5.2L16.3 5.1L16.3 4.9L16.4 4.8L16.5 4.6L16.7 4.5L16.9 4.4L17.1 4.3L17.4 4.3L17.7 4.3L18.0 4.3L18.2 4.4L18.4 4.5L18.6 4.6L18.7 4.8L18.8 4.9L18.8 5.1L18.7 5.2L18.6 5.4Z\"/><path class=\"ln\" d=\"M10.4 25.4L12.7 26.7L12.7 24.5L10.4 23.1L10.4 25.4\"/>"],"tankless":["Tankless","<path class=\"o3\" d=\"M23.1 24.4L18.4 27.2L18.4 10.7L23.1 8.0Z\"/><path class=\"o5\" d=\"M8.9 21.7L18.4 27.2L18.4 10.7L8.9 5.2Z\"/><path class=\"o1\" d=\"M13.6 2.5L23.1 8.0L18.4 10.7L8.9 5.2Z\"/><path class=\"o4\" d=\"M12.5 21.8L12.5 21.6L12.5 21.5L12.6 21.3L12.8 21.2L13.0 21.1L13.2 21.1L13.5 21.0L13.8 21.0L14.0 21.1L14.3 21.1L14.5 21.2L14.6 21.3L14.7 21.5L14.8 21.6L14.8 26.0L14.8 26.2L14.7 26.3L14.6 26.4L14.5 26.6L14.3 26.7L14.0 26.7L13.8 26.8L13.5 26.8L13.2 26.7L13.0 26.7L12.8 26.6L12.6 26.4L12.5 26.3L12.5 26.2Z\"/><path class=\"o1\" d=\"M14.5 22.2L14.3 22.3L14.0 22.3L13.8 22.4L13.5 22.4L13.2 22.3L13.0 22.3L12.8 22.2L12.6 22.1L12.5 21.9L12.5 21.8L12.5 21.6L12.5 21.5L12.6 21.3L12.8 21.2L13.0 21.1L13.2 21.1L13.5 21.0L13.8 21.0L14.0 21.1L14.3 21.1L14.5 21.2L14.6 21.3L14.7 21.5L14.8 21.6L14.8 21.8L14.7 21.9L14.6 22.1Z\"/><path class=\"o4\" d=\"M14.8 23.1L14.8 23.0L14.9 22.8L15.0 22.7L15.2 22.6L15.4 22.5L15.6 22.4L15.9 22.4L16.1 22.4L16.4 22.4L16.6 22.5L16.8 22.6L17.0 22.7L17.1 22.8L17.2 23.0L17.2 27.5L17.1 27.7L17.0 27.8L16.8 27.9L16.6 28.0L16.4 28.1L16.1 28.1L15.9 28.1L15.6 28.1L15.4 28.0L15.2 27.9L15.0 27.8L14.9 27.7L14.8 27.5Z\"/><path class=\"o1\" d=\"M16.8 23.5L16.6 23.6L16.4 23.7L16.1 23.7L15.9 23.7L15.6 23.7L15.4 23.6L15.2 23.5L15.0 23.4L14.9 23.3L14.8 23.1L14.8 23.0L14.9 22.8L15.0 22.7L15.2 22.6L15.4 22.5L15.6 22.4L15.9 22.4L16.1 22.4L16.4 22.4L16.6 22.5L16.8 22.6L17.0 22.7L17.1 22.8L17.2 23.0L17.2 23.1L17.1 23.3L17.0 23.4Z\"/><path class=\"o4\" d=\"M17.2 24.4L17.3 24.2L17.4 24.1L17.5 24.0L17.7 23.9L18.0 23.8L18.2 23.8L18.5 23.8L18.8 23.8L19.0 23.9L19.2 24.0L19.4 24.1L19.5 24.2L19.5 24.4L19.5 28.9L19.5 29.0L19.4 29.2L19.2 29.3L19.0 29.4L18.8 29.5L18.5 29.5L18.2 29.5L18.0 29.5L17.7 29.4L17.5 29.3L17.4 29.2L17.3 29.0L17.2 28.9Z\"/><path class=\"o1\" d=\"M19.2 24.9L19.0 25.0L18.8 25.1L18.5 25.1L18.2 25.1L18.0 25.1L17.7 25.0L17.5 24.9L17.4 24.8L17.3 24.7L17.2 24.5L17.2 24.4L17.3 24.2L17.4 24.1L17.5 24.0L17.7 23.9L18.0 23.8L18.2 23.8L18.5 23.8L18.8 23.8L19.0 23.9L19.2 24.0L19.4 24.1L19.5 24.2L19.5 24.4L19.5 24.5L19.5 24.7L19.4 24.8Z\"/><path class=\"ln\" d=\"M11.7 15.1L15.5 17.3L15.5 12.9L11.7 10.7L11.7 15.1\"/>"],"boiler":["Boiler","<path class=\"o3\" d=\"M26.2 24.3L17.1 29.5L17.1 16.4L26.2 11.2Z\"/><path class=\"o5\" d=\"M5.8 23.0L17.1 29.5L17.1 16.4L5.8 9.9Z\"/><path class=\"o1\" d=\"M14.9 4.6L26.2 11.2L17.1 16.4L5.8 9.9Z\"/><path class=\"o4\" d=\"M13.5 3.8L13.6 3.5L13.8 3.2L14.2 2.9L14.6 2.7L15.2 2.6L15.7 2.5L16.3 2.5L16.8 2.6L17.4 2.7L17.8 2.9L18.2 3.2L18.4 3.5L18.5 3.8L18.5 10.7L18.4 11.0L18.2 11.3L17.8 11.6L17.4 11.8L16.8 11.9L16.3 12.0L15.7 12.0L15.2 11.9L14.6 11.8L14.2 11.6L13.8 11.3L13.6 11.0L13.5 10.7Z\"/><path class=\"o1\" d=\"M17.8 5.0L17.4 5.2L16.8 5.4L16.3 5.4L15.7 5.4L15.2 5.4L14.6 5.2L14.2 5.0L13.8 4.8L13.6 4.5L13.5 4.1L13.5 3.8L13.6 3.5L13.8 3.2L14.2 2.9L14.6 2.7L15.2 2.6L15.7 2.5L16.3 2.5L16.8 2.6L17.4 2.7L17.8 2.9L18.2 3.2L18.4 3.5L18.5 3.8L18.5 4.1L18.4 4.5L18.2 4.8Z\"/><path class=\"ln\" d=\"M8.1 21.6L14.9 25.6L14.9 20.3L8.1 16.4L8.1 21.6\"/>"],"tank":["Tank / cistern","<path class=\"o4\" d=\"M5.3 8.0L5.8 6.6L6.9 5.4L8.4 4.3L10.3 3.4L12.4 2.8L14.8 2.5L17.2 2.5L19.6 2.8L21.7 3.4L23.6 4.3L25.1 5.4L26.2 6.6L26.7 8.0L26.7 9.4L26.7 24.0L26.2 25.4L25.1 26.6L23.6 27.7L21.7 28.6L19.6 29.2L17.2 29.5L14.8 29.5L12.4 29.2L10.3 28.6L8.4 27.7L6.9 26.6L5.8 25.4L5.3 24.0L5.3 22.6Z\"/><path class=\"o1\" d=\"M23.6 13.1L21.7 13.9L19.6 14.5L17.2 14.9L14.8 14.9L12.4 14.5L10.3 13.9L8.4 13.1L6.9 12.0L5.8 10.7L5.3 9.4L5.3 8.0L5.8 6.6L6.9 5.4L8.4 4.3L10.3 3.4L12.4 2.8L14.8 2.5L17.2 2.5L19.6 2.8L21.7 3.4L23.6 4.3L25.1 5.4L26.2 6.6L26.7 8.0L26.7 9.4L26.2 10.7L25.1 12.0Z\"/><path class=\"o4\" d=\"M5.3 8.0L5.8 6.6L6.9 5.4L8.4 4.3L10.3 3.4L12.4 2.8L14.8 2.5L17.2 2.5L19.6 2.8L21.7 3.4L23.6 4.3L25.1 5.4L26.2 6.6L26.7 8.0L26.7 9.4L26.2 10.7L25.1 12.0L23.6 13.1L21.7 13.9L19.6 14.5L17.2 14.9L14.8 14.9L12.4 14.5L10.3 13.9L8.4 13.1L6.9 12.0L5.8 10.7L5.3 9.4Z\"/>"],"softener":["Softener","<path class=\"o4\" d=\"M6.5 7.2L6.7 6.7L7.1 6.2L7.7 5.8L8.4 5.4L9.3 5.2L10.2 5.1L11.1 5.1L12.1 5.2L12.9 5.4L13.6 5.8L14.2 6.2L14.6 6.7L14.8 7.2L14.8 22.4L14.6 23.0L14.2 23.5L13.6 23.9L12.9 24.2L12.1 24.4L11.1 24.6L10.2 24.6L9.3 24.4L8.4 24.2L7.7 23.9L7.1 23.5L6.7 23.0L6.5 22.4L6.5 21.9Z\"/><path class=\"o1\" d=\"M13.6 9.2L12.9 9.5L12.1 9.8L11.1 9.9L10.2 9.9L9.3 9.8L8.4 9.5L7.7 9.2L7.1 8.8L6.7 8.3L6.5 7.8L6.5 7.2L6.7 6.7L7.1 6.2L7.7 5.8L8.4 5.4L9.3 5.2L10.2 5.1L11.1 5.1L12.1 5.2L12.9 5.4L13.6 5.8L14.2 6.2L14.6 6.7L14.8 7.2L14.8 7.8L14.6 8.3L14.2 8.8Z\"/><path class=\"o4\" d=\"M7.1 4.3L7.3 3.9L7.6 3.5L8.1 3.1L8.8 2.8L9.5 2.6L10.3 2.5L11.1 2.5L11.9 2.6L12.6 2.8L13.2 3.1L13.7 3.5L14.1 3.9L14.2 4.3L14.2 7.3L14.2 7.7L14.1 8.2L13.7 8.6L13.2 9.0L12.6 9.3L11.9 9.5L11.1 9.6L10.3 9.6L9.5 9.5L8.8 9.3L8.1 9.0L7.6 8.6L7.3 8.2L7.1 7.7Z\"/><path class=\"o1\" d=\"M13.2 6.0L12.6 6.3L11.9 6.5L11.1 6.6L10.3 6.6L9.5 6.5L8.8 6.3L8.1 6.0L7.6 5.7L7.3 5.2L7.1 4.8L7.1 4.3L7.3 3.9L7.6 3.5L8.1 3.1L8.8 2.8L9.5 2.6L10.3 2.5L11.1 2.5L11.9 2.6L12.6 2.8L13.2 3.1L13.7 3.5L14.1 3.9L14.2 4.3L14.2 4.8L14.1 5.2L13.7 5.7Z\"/><path class=\"o3\" d=\"M25.5 25.8L19.1 29.5L19.1 19.7L25.5 16.1Z\"/><path class=\"o5\" d=\"M12.8 25.8L19.1 29.5L19.1 19.7L12.8 16.1Z\"/><path class=\"o1\" d=\"M19.1 12.4L25.5 16.1L19.1 19.7L12.8 16.1Z\"/>"],"tub":["Tub","<path class=\"o3\" d=\"M29.5 21.7L20.5 26.9L20.5 20.7L29.5 15.5Z\"/><path class=\"o5\" d=\"M2.5 16.5L20.5 26.9L20.5 20.7L2.5 10.3Z\"/><path class=\"o1\" d=\"M11.5 5.1L29.5 15.5L20.5 20.7L2.5 10.3Z\"/><path class=\"o5\" d=\"M11.5 6.6L26.8 15.5L20.5 19.1L5.2 10.3Z\"/>"],"toilet":["Toilet","<path class=\"o3\" d=\"M21.1 23.9L15.7 27.0L15.7 19.1L21.1 16.0Z\"/><path class=\"o5\" d=\"M8.8 23.1L15.7 27.0L15.7 19.1L8.8 15.2Z\"/><path class=\"o1\" d=\"M14.3 12.0L21.1 16.0L15.7 19.1L8.8 15.2Z\"/><path class=\"o4\" d=\"M13.1 17.6L13.4 16.8L14.0 16.1L14.8 15.5L15.9 15.0L17.2 14.6L18.5 14.5L19.9 14.5L21.3 14.6L22.5 15.0L23.6 15.5L24.5 16.1L25.1 16.8L25.4 17.6L25.4 26.3L25.1 27.1L24.5 27.8L23.6 28.5L22.5 29.0L21.3 29.3L19.9 29.5L18.5 29.5L17.2 29.3L15.9 29.0L14.8 28.5L14.0 27.8L13.4 27.1L13.1 26.3Z\"/><path class=\"o1\" d=\"M23.6 20.6L22.5 21.1L21.3 21.4L19.9 21.6L18.5 21.6L17.2 21.4L15.9 21.1L14.8 20.6L14.0 19.9L13.4 19.2L13.1 18.4L13.1 17.6L13.4 16.8L14.0 16.1L14.8 15.5L15.9 15.0L17.2 14.6L18.5 14.5L19.9 14.5L21.3 14.6L22.5 15.0L23.6 15.5L24.5 16.1L25.1 16.8L25.4 17.6L25.4 18.4L25.1 19.2L24.5 19.9Z\"/><path class=\"o3\" d=\"M18.7 13.3L11.0 17.7L11.0 9.5L18.7 5.0Z\"/><path class=\"o5\" d=\"M6.6 15.2L11.0 17.7L11.0 9.5L6.6 6.9Z\"/><path class=\"o1\" d=\"M14.3 2.5L18.7 5.0L11.0 9.5L6.6 6.9Z\"/>"],"sink":["Sink / vanity","<path class=\"o3\" d=\"M29.5 23.8L19.7 29.5L19.7 18.1L29.5 12.5Z\"/><path class=\"o5\" d=\"M2.5 19.5L19.7 29.5L19.7 18.1L2.5 8.2Z\"/><path class=\"o1\" d=\"M12.3 2.5L29.5 12.5L19.7 18.1L2.5 8.2Z\"/><path class=\"o5\" d=\"M13.5 6.1L23.4 11.7L18.5 14.6L8.6 8.9Z\"/><path class=\"o4\" d=\"M18.4 3.7L18.5 3.6L18.6 3.5L18.7 3.4L18.9 3.3L19.1 3.2L19.3 3.2L19.6 3.2L19.8 3.2L20.0 3.3L20.2 3.4L20.3 3.5L20.4 3.6L20.5 3.7L20.5 3.9L20.5 8.4L20.4 8.5L20.3 8.7L20.2 8.8L20.0 8.9L19.8 8.9L19.6 8.9L19.3 8.9L19.1 8.9L18.9 8.9L18.7 8.8L18.6 8.7L18.5 8.5L18.4 8.4Z\"/><path class=\"o1\" d=\"M20.2 4.2L20.0 4.3L19.8 4.4L19.6 4.4L19.3 4.4L19.1 4.4L18.9 4.3L18.7 4.2L18.6 4.1L18.5 4.0L18.4 3.9L18.4 3.7L18.5 3.6L18.6 3.5L18.7 3.4L18.9 3.3L19.1 3.2L19.3 3.2L19.6 3.2L19.8 3.2L20.0 3.3L20.2 3.4L20.3 3.5L20.4 3.6L20.5 3.7L20.5 3.9L20.4 4.0L20.3 4.1Z\"/><path class=\"ln\" d=\"M4.0 19.0L10.6 22.8L10.6 14.6L4.0 10.8L4.0 19.0\"/><path class=\"ln\" d=\"M11.6 23.4L18.2 27.2L18.2 19.0L11.6 15.1L11.6 23.4\"/>"],"tee":["Pipe tee","<path class=\"o4\" d=\"M2.8 15.5L2.8 14.7L3.0 13.9L3.4 13.0L3.8 12.3L4.4 11.6L5.0 11.0L5.6 10.5L6.2 10.2L6.9 10.1L7.4 10.2L28.2 22.2L28.6 22.5L29.0 22.9L29.2 23.5L29.2 24.2L29.2 24.9L29.0 25.8L28.6 26.6L28.2 27.4L27.6 28.1L27.0 28.7L26.4 29.1L25.8 29.4L25.1 29.5L24.6 29.4L24.2 29.2L3.4 17.2L3.0 16.7L2.8 16.2Z\"/><path class=\"o2\" d=\"M23.5 27.5L23.6 26.7L23.8 25.9L24.2 25.0L24.6 24.3L25.1 23.6L25.8 23.0L26.4 22.5L27.0 22.2L27.6 22.1L28.2 22.2L28.6 22.5L29.0 22.9L29.2 23.5L29.2 24.2L29.2 24.9L29.0 25.8L28.6 26.6L28.2 27.4L27.6 28.1L27.0 28.7L26.4 29.1L25.8 29.4L25.1 29.5L24.6 29.4L24.2 29.2L23.8 28.7L23.6 28.2Z\"/><path class=\"o4\" d=\"M12.0 4.6L12.2 4.0L12.6 3.6L13.1 3.2L13.9 2.8L14.7 2.6L15.5 2.5L16.5 2.5L17.3 2.6L18.1 2.8L18.9 3.2L19.4 3.6L19.8 4.0L20.0 4.6L20.0 20.1L19.8 20.6L19.4 21.1L18.9 21.5L18.1 21.8L17.3 22.0L16.5 22.1L15.5 22.1L14.7 22.0L13.9 21.8L13.1 21.5L12.6 21.1L12.2 20.6L12.0 20.1Z\"/><path class=\"o1\" d=\"M18.9 6.5L18.1 6.8L17.3 7.0L16.5 7.1L15.5 7.1L14.7 7.0L13.9 6.8L13.1 6.5L12.6 6.1L12.2 5.6L12.0 5.1L12.0 4.6L12.2 4.0L12.6 3.6L13.1 3.2L13.9 2.8L14.7 2.6L15.5 2.5L16.5 2.5L17.3 2.6L18.1 2.8L18.9 3.2L19.4 3.6L19.8 4.0L20.0 4.6L20.0 5.1L19.8 5.6L19.4 6.1Z\"/>"],"valve":["Valve","<path class=\"o4\" d=\"M2.5 13.0L2.6 12.3L2.7 11.6L3.0 10.9L3.4 10.2L3.9 9.6L4.4 9.1L5.0 8.7L5.5 8.5L6.1 8.4L6.5 8.4L28.6 21.2L29.0 21.4L29.3 21.8L29.4 22.3L29.5 22.9L29.4 23.5L29.3 24.3L29.0 25.0L28.6 25.6L28.1 26.3L27.6 26.8L27.0 27.2L26.5 27.4L25.9 27.5L25.5 27.4L25.1 27.2L3.0 14.5L2.7 14.1L2.6 13.6Z\"/><path class=\"o2\" d=\"M24.5 25.7L24.6 25.1L24.8 24.3L25.1 23.6L25.5 23.0L25.9 22.3L26.5 21.8L27.0 21.4L27.6 21.2L28.1 21.1L28.6 21.2L29.0 21.4L29.3 21.8L29.4 22.3L29.5 22.9L29.4 23.5L29.3 24.3L29.0 25.0L28.6 25.6L28.1 26.3L27.6 26.8L27.0 27.2L26.5 27.4L25.9 27.5L25.5 27.4L25.1 27.2L24.8 26.8L24.6 26.3Z\"/><path class=\"o3\" d=\"M21.5 21.1L16.0 24.3L16.0 17.3L21.5 14.1Z\"/><path class=\"o5\" d=\"M10.5 21.1L16.0 24.3L16.0 17.3L10.5 14.1Z\"/><path class=\"o1\" d=\"M16.0 10.9L21.5 14.1L16.0 17.3L10.5 14.1Z\"/><path class=\"o4\" d=\"M14.8 9.0L14.9 8.8L15.0 8.7L15.2 8.6L15.4 8.5L15.6 8.4L15.9 8.4L16.1 8.4L16.4 8.4L16.6 8.5L16.8 8.6L17.0 8.7L17.1 8.8L17.2 9.0L17.2 14.2L17.1 14.3L17.0 14.5L16.8 14.6L16.6 14.7L16.4 14.8L16.1 14.8L15.9 14.8L15.6 14.8L15.4 14.7L15.2 14.6L15.0 14.5L14.9 14.3L14.8 14.2L14.8 14.0Z\"/><path class=\"o1\" d=\"M16.8 9.5L16.6 9.6L16.4 9.7L16.1 9.7L15.9 9.7L15.6 9.7L15.4 9.6L15.2 9.5L15.0 9.4L14.9 9.3L14.8 9.1L14.8 9.0L14.9 8.8L15.0 8.7L15.2 8.6L15.4 8.5L15.6 8.4L15.9 8.4L16.1 8.4L16.4 8.4L16.6 8.5L16.8 8.6L17.0 8.7L17.1 8.8L17.2 9.0L17.2 9.1L17.1 9.3L17.0 9.4Z\"/><path class=\"o4\" d=\"M9.8 7.7L10.1 6.9L10.7 6.2L11.6 5.5L12.7 5.0L13.9 4.7L15.3 4.5L16.7 4.5L18.1 4.7L19.3 5.0L20.4 5.5L21.3 6.2L21.9 6.9L22.2 7.7L22.2 9.4L21.9 10.2L21.3 10.9L20.4 11.6L19.3 12.1L18.1 12.4L16.7 12.6L15.3 12.6L13.9 12.4L12.7 12.1L11.6 11.6L10.7 10.9L10.1 10.2L9.8 9.4Z\"/><path class=\"o1\" d=\"M20.4 10.6L19.3 11.1L18.1 11.5L16.7 11.7L15.3 11.7L13.9 11.5L12.7 11.1L11.6 10.6L10.7 10.0L10.1 9.3L9.8 8.5L9.8 7.7L10.1 6.9L10.7 6.2L11.6 5.5L12.7 5.0L13.9 4.7L15.3 4.5L16.7 4.5L18.1 4.7L19.3 5.0L20.4 5.5L21.3 6.2L21.9 6.9L22.2 7.7L22.2 8.5L21.9 9.3L21.3 10.0Z\"/>"],"trench":["Trench / underground","<path class=\"o3\" d=\"M29.5 18.7L18.4 25.1L18.4 22.5L29.5 16.1Z\"/><path class=\"o5\" d=\"M2.5 15.9L18.4 25.1L18.4 22.5L2.5 13.3Z\"/><path class=\"o1\" d=\"M13.6 6.9L29.5 16.1L18.4 22.5L2.5 13.3Z\"/><path class=\"o7\" d=\"M11.2 10.1L23.9 17.5L20.8 19.3L8.1 12.0Z\"/><path class=\"o4\" d=\"M9.0 11.0L9.0 10.9L9.1 10.7L9.2 10.5L9.3 10.3L9.4 10.2L9.5 10.0L9.6 9.9L9.8 9.9L9.9 9.9L10.0 9.9L10.1 9.9L21.3 16.4L21.3 16.5L21.4 16.6L21.4 16.7L21.4 16.9L21.3 17.1L21.3 17.3L21.2 17.4L21.0 17.6L20.9 17.7L20.8 17.8L20.6 17.9L20.5 17.9L20.4 17.9L9.2 11.4L9.1 11.3L9.0 11.2Z\"/><path class=\"o2\" d=\"M20.1 17.5L20.1 17.3L20.2 17.1L20.3 16.9L20.4 16.8L20.5 16.6L20.6 16.5L20.8 16.4L20.9 16.3L21.0 16.3L21.2 16.3L21.3 16.4L21.3 16.5L21.4 16.6L21.4 16.7L21.4 16.9L21.3 17.1L21.3 17.3L21.2 17.4L21.0 17.6L20.9 17.7L20.8 17.8L20.6 17.9L20.5 17.9L20.4 17.9L20.3 17.8L20.2 17.7L20.1 17.6Z\"/>"],"stairs":["Basement / stairs","<path class=\"o3\" d=\"M19.4 17.7L8.1 24.3L8.1 11.7L19.4 5.1Z\"/><path class=\"o5\" d=\"M3.5 21.6L8.1 24.3L8.1 11.7L3.5 9.1Z\"/><path class=\"o1\" d=\"M14.9 2.5L19.4 5.1L8.1 11.7L3.5 9.1Z\"/><path class=\"o3\" d=\"M23.9 20.3L12.6 26.9L12.6 18.5L23.9 11.9Z\"/><path class=\"o5\" d=\"M8.1 24.3L12.6 26.9L12.6 18.5L8.1 15.9Z\"/><path class=\"o1\" d=\"M19.4 9.3L23.9 11.9L12.6 18.5L8.1 15.9Z\"/><path class=\"o3\" d=\"M28.5 22.9L17.1 29.5L17.1 25.3L28.5 18.8Z\"/><path class=\"o5\" d=\"M12.6 26.9L17.1 29.5L17.1 25.3L12.6 22.7Z\"/><path class=\"o1\" d=\"M23.9 16.1L28.5 18.8L17.1 25.3L12.6 22.7Z\"/>"],"toolbox":["Service call","<path class=\"o3\" d=\"M29.5 23.8L21.4 28.5L21.4 19.1L29.5 14.4Z\"/><path class=\"o5\" d=\"M2.5 17.6L21.4 28.5L21.4 19.1L2.5 8.2Z\"/><path class=\"o1\" d=\"M10.6 3.5L29.5 14.4L21.4 19.1L2.5 8.2Z\"/><path class=\"ln\" d=\"M2.5 10.7L21.4 21.6\"/><path class=\"ln\" d=\"M12.5 9.3L12.5 5.6L19.5 9.6L19.5 13.3\"/>"],"crates":["Materials","<path class=\"o3\" d=\"M20.3 19.7L11.7 24.6L11.7 17.2L20.3 12.3Z\"/><path class=\"o5\" d=\"M3.2 19.7L11.7 24.6L11.7 17.2L3.2 12.3Z\"/><path class=\"o1\" d=\"M11.7 7.4L20.3 12.3L11.7 17.2L3.2 12.3Z\"/><path class=\"o3\" d=\"M28.8 24.6L20.3 29.5L20.3 22.1L28.8 17.2Z\"/><path class=\"o5\" d=\"M11.7 24.6L20.3 29.5L20.3 22.1L11.7 17.2Z\"/><path class=\"o1\" d=\"M20.3 12.3L28.8 17.2L20.3 22.1L11.7 17.2Z\"/><path class=\"o3\" d=\"M24.5 14.8L16.0 19.7L16.0 12.3L24.5 7.4Z\"/><path class=\"o5\" d=\"M7.5 14.8L16.0 19.7L16.0 12.3L7.5 7.4Z\"/><path class=\"o1\" d=\"M16.0 2.5L24.5 7.4L16.0 12.3L7.5 7.4Z\"/>"],"truck":["Truck","<path class=\"o3\" d=\"M23.5 21.2L16.6 25.2L16.6 15.4L23.5 11.5Z\"/><path class=\"o5\" d=\"M2.5 17.0L16.6 25.2L16.6 15.4L2.5 7.3Z\"/><path class=\"o1\" d=\"M9.4 3.3L23.5 11.5L16.6 15.4L2.5 7.3Z\"/><path class=\"o3\" d=\"M29.5 24.7L22.6 28.7L22.6 21.7L29.5 17.7Z\"/><path class=\"o5\" d=\"M16.6 25.2L22.6 28.7L22.6 21.7L16.6 18.2Z\"/><path class=\"o1\" d=\"M23.5 14.3L29.5 17.7L22.6 21.7L16.6 18.2Z\"/><path class=\"ln\" d=\"M28.5 21.6L23.7 24.4L23.7 21.8L28.5 19.0L28.5 21.6\"/>"],"flag":["Model home","<path class=\"o3\" d=\"M27.2 22.1L17.0 28.0L17.0 18.6L27.2 12.7Z\"/><path class=\"o5\" d=\"M4.8 20.9L17.0 28.0L17.0 18.6L4.8 11.5Z\"/><path class=\"o1\" d=\"M15.0 5.7L27.2 12.7L17.0 18.6L4.8 11.5Z\"/><path class=\"o4\" d=\"M4.8 11.5L17.0 18.6L22.1 9.5L9.9 2.5Z\"/><path class=\"o3\" d=\"M27.2 12.7L17.0 18.6L22.1 9.5Z\"/><path class=\"ln\" d=\"M17.6 29.5L17.6 10.7\"/><path class=\"o5\" d=\"M17.6 10.7L17.6 14.9L11.5 16.4Z\"/>"]};
const JB_ICONS = Object.keys(JB_ISO);
const JB_EMOJI = {"🏠": "house", "🏗": "crates", "🏢": "apartments", "🔧": "toolbox", "🚿": "tub", "🛁": "tub", "🔥": "boiler", "💧": "tank", "⚡": "heater", "⭐": "flag", "🧱": "crates"};   /* the emoji picked before these */
const jbIco = (k, cls) => k && JB_ISO[k] ? `<svg class="iso${cls ? " " + cls : ""}" viewBox="0 0 32 32" aria-hidden="true">${JB_ISO[k][1]}</svg>` : "";
const jbIcon = j => j.icon || (eById("sub", j.sub) || {}).icon || "";   /* a job without its own icon shows its subdivision's */
const jbIcoPick = (cur, noneLabel) => `<div class="jb-ico" role="group" aria-label="Icon">${["", ...JB_ICONS].map(ic => `<button type="button" data-ico="${ic}" aria-pressed="${(cur || "") === ic}">${ic ? jbIco(ic) : '<span class="jb-none">—</span>'}<span>${ic ? JB_ISO[ic][0] : noneLabel}</span></button>`).join("")}</div>`;
const jbNat = (a, b) => jbName(a).localeCompare(jbName(b), undefined, {numeric: true, sensitivity: "base"});   /* Lot 2 before Lot 12 */
const JB_RES = {booked: "Booked", pass: "Pass", partial: "Partial", fail: "Fail"};
const JB_ST = {open: "Open", hold: "On hold", done: "Done"};
let jbT, jfNT;
let jbFull = false;
const jbSave = () => { clearTimeout(jbT); JB_IX = null; let ok = true;
  try { localStorage.setItem("jpb-jobs", JSON.stringify(jbD)); } catch(e){ ok = false; }
  if (!ok && !jbFull) toast("<b>Jobs didn't save:</b> this phone's space for them is full. Download a backup, then delete finished jobs.", 9000);
  jbFull = !ok; if (ok) try { localStorage.setItem("jpb-chg", String((+localStorage.getItem("jpb-chg") || 0) + 1)); } catch(e){}
  IDX = null; try { homeDraw(); } catch(e){} };
const jbBytes = () => { try { return (localStorage.getItem("jpb-jobs") || "").length; } catch(e){ return 0; } };
const jbId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const jbDay = (n = new Date()) => new Date(n - n.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const jbWk = s => { const x = new Date(s + "T12:00:00"); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return jbDay(x); };   /* weeks start Monday */
const jbNice = s => { const x = new Date(s + "T12:00:00"); return !s || isNaN(x) ? esc(s || "") : x.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"}); };
const jbHr = x => (Math.round(x * 100) / 100).toLocaleString();
const jbCur = () => jbD.jobs.find(j => j.id === JB.open);
const jbName = j => (j.name || "").trim() || (j.a || "").trim() || "Untitled job";   /* the job's name, else its address */
const jbNext = j => j.insp.filter(i => i.r === "booked").sort((a, b) => a.d < b.d ? -1 : 1)[0];
const jbShort = ts => new Date(ts).toLocaleDateString(undefined, {month: "short", day: "numeric"});
const jbDays = iso => Math.max(0, Math.round((new Date(jbDay() + "T12:00:00") - new Date(iso + "T12:00:00")) / 864e5));
const jbByDate = (a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0;
const jfMB = n => n >= 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB";
const jfSay = (t, c) => { const s = $(JF.sayId || "jf-say"); if (s){ s.textContent = t; s.className = (s.id === "bk-status" ? "status " : "note ") + (c || ""); } };
const jbOpts = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${k}"${k === v ? " selected" : ""}>${t}</option>`).join("");
const jbList = (a, v) => a.map(x => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("");
const jbIn = (k, j) => k === "all" || (k === "done") === (j.st === "done");
/* iPhone: a system pop-up (Delete?, a picker wheel, the photo sheet) or the keyboard vanishing can leave the page sitting off
   and the bottom bar floating. Re-seat it after each one. */
const jbReseat = () => { try { if (window.navReseat) navReseat(); } catch(e){} };
const jbAsk = q => { const ok = confirm(q); jbReseat(); return ok; };

/* people */
const pById = id => jbD.people.find(p => p.id === id);
const pByName = n => { const q = String(n).trim().toLowerCase(); return q ? jbD.people.find(p => p.n.trim().toLowerCase() === q) : null; };
const pName = id => (pById(id) || {}).n || "";
function pGet(name, role){ const n = String(name).trim(); if (!n) return null; let p = pByName(n);
  if (!p){ p = {id: jbId(), n, role: role || "Other", co: "", ph: "", em: "", log: [], draft: "", t: Date.now()}; jbD.people.push(p); } return p; }
const pTel = p => (p.ph || "").replace(/[^\d+]/g, "");
let JB_IX = null;   /* per screen: each job's people and its notes' text, so person and builder pages don't rescan every note */
const jbIx = () => JB_IX || (JB_IX = jbD.jobs.map(j => ({j, ids: new Set([j.lead, j.sup, ...j.ppl.map(x => x.p), ...JB_STG.map(([k]) => (j.stages[k] || {}).lead)].filter(Boolean)), txt: j.log.map(e => e.b).join("\n").toLowerCase()})));
const jbMentions = (x, n) => { const L = "[[" + n.trim().toLowerCase(); return !!n.trim() && (x.txt.includes(L + "]]") || x.txt.includes(L + "|")); };

/* builders and subdivisions: saved once, picked on any job, each with a page (fields, notes, every job) */
const ENT = {
  bld: {list: "builders", one: "builder", Title: "Builder", ph: "ABC Homes", fields: [["ph", "Office phone", "tel", "801-555-0100"], ["web", "Website", "url", "builder.com"], ["addr", "Office address", "text", ""]]},
  sub: {list: "subs", one: "subdivision", Title: "Subdivision", ph: "Sunny Acres", fields: [["city", "City", "city", ""], ["bld", "Builder", "bld", "ABC Homes"], ["gate", "Access / gate code", "text", "Gate 1234#"], ["tie", "Water & sewer tie-in", "text", "Sewer stub 9 ft deep, east lot line"]]}};
const eList = t => jbD[ENT[t].list];
const eById = (t, id) => id ? eList(t).find(x => x.id === id) : null;
const eByName = (t, n) => { const q = String(n).trim().toLowerCase(); return q ? eList(t).find(x => x.n.trim().toLowerCase() === q) : null; };
const eName = (t, id) => (eById(t, id) || {}).n || "";
function eGet(t, name){ const n = String(name).trim(); if (!n) return null; let x = eByName(t, n);
  if (!x){ x = {id: jbId(), n, log: [], draft: "", t: Date.now()}; ENT[t].fields.forEach(([k]) => { x[k] = ""; }); eList(t).push(x); } return x; }
const eJobs = (t, x) => jbIx().filter(r => r.j[t] === x.id || jbMentions(r, x.n)).map(r => r.j);
const pJobs = p => jbIx().filter(r => r.ids.has(p.id) || jbMentions(r, p.n)).map(r => r.j);
const eCur = () => JB.ent && eById(JB.ent.t, JB.ent.id);
/* jobs from earlier builds: notes into the log, phase into stages */
function jbFix(j){
  if (!Array.isArray(j.log)){ j.log = (j.note || "").trim() ? [{id: jbId(), d: jbDay(new Date(j.t || Date.now())), at: j.t || Date.now(), b: j.note}] : []; delete j.note; }
  if (typeof j.draft !== "string") j.draft = ""; if (typeof j.name !== "string") j.name = "";
  ["insp", "hrs", "punch", "ppl"].forEach(k => { if (!Array.isArray(j[k])) j[k] = []; });
  if (j.lead === undefined) j.lead = ""; if (j.sup === undefined) j.sup = "";
  if (typeof j.bld !== "string"){ const b = (j.who || "").trim() ? eGet("bld", j.who) : null; j.bld = b ? b.id : ""; if (b) j.who = ""; }   /* "Builder / customer" becomes a builder page */
  if (typeof j.sub !== "string") j.sub = "";
  if (!j.stages){
    const map = {"Underground": "under", "Rough-in": "rough", "Top-out": "rough", "Gas": "gas", "Trim": "trim", "Final": "final", "Service": "warr", "Warranty": "warr"};
    const cur = map[j.ph] || "under", ci = JB_STG.findIndex(([k]) => k === cur);
    j.stages = {}; JB_STG.forEach(([k], i) => { j.stages[k] = {st: i < ci ? "done" : i === ci ? "doing" : "todo", d0: "", d1: "", lead: "", done: [], extra: []}; });
    const im = {"Underground": "under", "Rough / 4-way": "rough", "Top-out": "rough", "Gas": "gas", "Shower pan": "rough", "Water heater": "trim", "Final": "final"};
    j.insp.forEach(i => { if (!i.s) i.s = im[i.k] || cur; }); j.hrs.forEach(h => { if (!h.s) h.s = cur; }); j.log.forEach(e => { if (e.s === undefined) e.s = cur; });
    delete j.ph;
  }
}
/* saved data is checked and repaired before use, so one damaged record can't take down the job tracker */
function jbClean(){
  const isO = x => !!x && typeof x === "object" && !Array.isArray(x), arrO = a => Array.isArray(a) ? a.filter(isO) : [];
  const str = x => typeof x === "string" ? x : x == null ? "" : String(x);
  jbD.jobs = arrO(jbD.jobs);
  jbD.bin = arrO(jbD.bin).filter(b => isO(b.item) && typeof b.at === "number");
  if (!isO(jbD.fold)) jbD.fold = {};
  jbD.subs.forEach(x => { if (!JB_ICONS.includes(x.icon)) x.icon = ""; });
  ['stageCol', 'tagCol'].forEach(k => { const o = isO(jbD[k]) ? jbD[k] : {}; jbD[k] = {}; Object.keys(o).forEach(x => { if (JB_PAL.includes(o[x])) jbD[k][x] = o[x]; }); });
  ["people", "builders", "subs"].forEach(k => { jbD[k] = arrO(jbD[k]); jbD[k].forEach(x => { x.id = str(x.id) || jbId(); x.n = str(x.n); }); });
  jbD.jobs.forEach(j => {
    j.id = str(j.id) || jbId(); ["name", "a", "who", "city", "draft"].forEach(k => { j[k] = str(j[k]); });
    if (!Array.isArray(j.log)){ j.log = str(j.note).trim() ? [{id: jbId(), d: jbDay(new Date(+j.t || Date.now())), at: +j.t || Date.now(), b: str(j.note)}] : []; delete j.note; }
    ["log", "insp", "hrs", "punch", "ppl"].forEach(k => { j[k] = arrO(j[k]); j[k].forEach(x => { x.id = str(x.id) || jbId(); }); });
    j.log.forEach(e => { e.b = str(e.b); e.d = str(e.d) || jbDay(); if (typeof e.at !== "number") e.at = 0; });
    j.hrs = j.hrs.filter(h => +h.h > 0 && +h.h <= 24); j.hrs.forEach(h => { h.h = +h.h; h.d = str(h.d) || jbDay(); h.n = str(h.n); });
    j.insp.forEach(i => { i.d = str(i.d); if (!JB_RES[i.r]) i.r = "booked"; ["who", "n", "k"].forEach(k => { i[k] = str(i[k]); }); });
    j.punch.forEach(x => { x.t = str(x.t); x.done = !!x.done; });
    if (!JB_ST[j.st]) j.st = "open";
    if (j.stages != null && !isO(j.stages)) j.stages = null;   /* jbFix builds it fresh */
    if (j.stages) JB_STG.forEach(([k]) => { const S = j.stages[k] = Object.assign({st: "todo", d0: "", d1: "", lead: "", done: [], extra: []}, isO(j.stages[k]) ? j.stages[k] : {});
      if (!JB_SST[S.st]) S.st = "todo"; S.done = Array.isArray(S.done) ? S.done.map(str) : []; S.extra = arrO(S.extra); if (S.hide && !Array.isArray(S.hide)) S.hide = []; });
    if (j.xs && !Array.isArray(j.xs)) delete j.xs;
    if (!JB_PAL.includes(j.color)) j.color = "";
    if (JB_EMOJI[j.icon]) j.icon = JB_EMOJI[j.icon]; if (!JB_ICONS.includes(j.icon)) j.icon = ""; j.pin = !!j.pin;
    if (typeof j.made !== "number") j.made = Math.min(+j.t || Date.now(), ...j.log.map(e => +e.at || Infinity));   /* when the job was started here */
  });
}
jbClean();
jbD.jobs.forEach(jbFix);
jbD.jobs.forEach(j => { if (!Array.isArray(j.xs)) j.xs = JB_XTRA.filter(k => { const s = j.stages[k];   /* older jobs keep an extra that has anything in it */
  return s.st === "done" || s.st === "doing" || s.d0 || s.d1 || s.lead || s.done.length || s.extra.length || j.insp.some(i => i.s === k) || j.hrs.some(h => h.s === k) || j.log.some(e => e.s === k); }); });
[...jbD.people, ...jbD.builders, ...jbD.subs].forEach(p => { if (!Array.isArray(p.log)) p.log = []; if (typeof p.draft !== "string") p.draft = ""; });
const jbStageNow = j => { const S = jbStages(j); return (S.find(([k]) => j.stages[k].st === "doing") || S.find(([k]) => j.stages[k].st === "todo") || S[S.length - 1])[0]; };
const jbTpl = k => Array.isArray((jbD.tpl || {})[k]) ? jbD.tpl[k] : JB_TPL[k]();   /* your saved list for a stage, else the book's */
function jbCk(j, k){ const s = j.stages[k], dn = new Set(s.done), hide = new Set(s.hide || []), T = jbTpl(k), TS = new Set(T);
  const at = s.doneAt || {};
  const items = [...T.map((t, i) => ({key: "t" + i, t, done: dn.has(t), tpl: true, at: at[t]})).filter(x => !hide.has(x.t)),
    ...s.extra.filter(x => !TS.has(x.t)).map(x => ({key: "x" + x.id, t: x.t, done: x.done, id: x.id, at: x.at}))];
  return {items, total: items.length, done: items.filter(x => x.done).length}; }

/* notes: a dated log with our own light markup (see "How to write notes") */
const JN_TAG = /(^|[\s(])#([A-Za-z][\w-]*)/g;
const jbTags = j => [...new Set(j.log.flatMap(e => [...e.b.matchAll(JN_TAG)].map(m => m[2].toLowerCase())))];
const jbQs = j => j.log.reduce((n, e) => n + (e.b.match(/^\s*\?\?/gm) || []).length, 0);
const jbTasks = j => j.log.reduce((n, e) => n + (e.b.match(/^\s*[-*] \[ \]/gm) || []).length, 0);
const jnSort = (a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : b.at - a.at;
/* one line of note text → HTML. Order matters: code spans first (nothing inside them is touched), then a backslash
   escapes the next mark (\* \# \[ shows the mark itself), then links, bold, italic, highlight, strike, web links, phones, tags. */
/* what a [[link]] opens decides its color and icon: person, builder, subdivision, job, book card, or nothing yet */
let JN_CARDS = null, jnForce = null;
const JN_ICON = {person: "👤", bld: "🏗", sub: "🏘", job: "🔧", card: "📖", none: "＋"};
function jnLinkType(x){
  const q = String(x).trim().toLowerCase(); if (jnForce && jnForce[q]) return jnForce[q];
  if (pByName(q)) return "person"; if (eByName("bld", q)) return "bld"; if (eByName("sub", q)) return "sub";
  if (jbD.jobs.some(j => [j.name, j.a].some(v => (v || "").trim().toLowerCase() === q))) return "job";
  if (!JN_CARDS) JN_CARDS = SECTIONS.map(sec => ((sec.querySelector("h2") || {}).textContent || "").trim().toLowerCase());
  return JN_CARDS.some(t => t === q || (q.length > 3 && t.includes(q))) ? "card" : "none";
}
const jnHue = t => { let h = 7; for (const c of t.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };   /* a tag keeps its color everywhere */
/* @dates: @today, @tomorrow, @fri, @Nov 20, @11/20, @2026-11-20, counted from the note's own date */
let JN_BASE = "";
const JN_MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], JN_WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const JN_DATE = /(^|[\s(])@(today|tomorrow|(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2})(?![\w\/])/gi;
function jnResolve(tok, base){
  const b = new Date((base || jbDay()) + "T12:00:00"), t = tok.toLowerCase(); let d = null, m;
  if (t === "today") d = b; else if (t === "tomorrow"){ d = new Date(b); d.setDate(d.getDate() + 1); }
  else if (JN_WD.includes(t.slice(0, 3))){ d = new Date(b); const w = JN_WD.indexOf(t.slice(0, 3)); d.setDate(d.getDate() + ((w - d.getDay() + 7) % 7 || 7)); }
  else if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) d = new Date(+m[1], +m[2] - 1, +m[3], 12);
  else { let mo, da; if ((m = t.match(/^(\d{1,2})\/(\d{1,2})$/))){ mo = +m[1] - 1; da = +m[2]; } else if ((m = t.match(/^([a-z]{3})[a-z]* (\d{1,2})$/))){ mo = JN_MON.indexOf(m[1]); da = +m[2]; }
    if (mo >= 0 && mo < 12 && da >= 1 && da <= 31){ d = new Date(b.getFullYear(), mo, da, 12); if (d - b < -182 * 864e5) d.setFullYear(d.getFullYear() + 1); } }
  return d && !isNaN(d) ? jbDay(d) : "";
}
const jnDates = (text, base) => { const out = []; String(text).split("\n").forEach(ln => { for (const m of ln.matchAll(JN_DATE)){ const iso = jnResolve(m[2], base); if (iso) out.push([iso, ln]); } }); return out; };
/* "Label: value" lines are facts; the job collects them */
const JN_PROP = /^([A-Za-z][A-Za-z0-9 #\/.&'-]{0,23}):\s+(\S.*)$/;
const jnProps = text => String(text).split("\n").map(l => l.match(JN_PROP)).filter(Boolean).map(m => [m[1].trim(), m[2].trim()]);
function jnInline(s){
  const keep = [], hold = h => "\u0001" + (keep.push(h) - 1) + "\u0002";
  s = s.replace(/`([^`]+)`/g, (m, x) => hold(`<code>${esc(x)}</code>`)).replace(/\\([\\`*_=~#\[\]!>-])/g, (m, x) => hold(esc(x)));
  s = esc(s)
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (m, x, label) => { if (!x.trim()) return m; const ty = jnLinkType(x.replace(/&amp;/g, "&"));
      return hold(`<button type="button" class="jn-link jn-l-${ty}" data-wl="${x.trim()}"><span class="jn-ico" aria-hidden="true">${JN_ICON[ty]}</span>${(label || x).trim()}</button>`); })
    .replace(/\*\*(?=\S)(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*(?=[^*\s])([^*]*?[^*\s])\*(?!\w)/g, "$1<i>$2</i>")
    .replace(/==(?=\S)(.+?)==/g, "<mark>$1</mark>").replace(/~~(?=\S)(.+?)~~/g, "<s>$1</s>")
    .replace(/\bhttps?:\/\/[^\s<]+?(?=[.,;:!?)]*(?:\s|$|<))/g, u => hold(`<a href="${u}" target="_blank" rel="noopener">${u}</a>`))
    .replace(/(^|[^\d-])((?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4})(?!\d)/g, (m, a, n) => a + hold(`<span class="pn">${n}</span>`))
    .replace(JN_DATE, (m, a, tok) => { const iso = jnResolve(tok, JN_BASE); if (!iso) return m; const now = jbDay();
      return a + hold(`<span class="jn-date${iso < now ? " past" : iso === now ? " now" : ""}" title="${iso}">📅 ${jbNice(iso)}</span>`); })
    .replace(JN_TAG, (m, a, t) => `${a}<button type="button" class="jn-tag" style="${jbTagStyle(t)}" data-tag="${t.toLowerCase()}">#${t}</button>`);
  return s.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[+i]).replace(/\u0001(\d+)\u0002/g, (m, i) => keep[+i]);
}
/* a whole note → HTML, line by line, so each checkbox knows its own line to tick */
function jnMd(src, eid, base){
  JN_BASE = base || jbDay();
  let h = "", list = null, quote = false, code = null, gap = false;
  const close = () => { if (list){ h += `</${list.tag}>`; list = null; } if (quote){ h += "</blockquote>"; quote = false; } };
  const item = (tag, depth, start, html) => {
    if (quote){ h += "</blockquote>"; quote = false; }
    if (!list || list.tag !== tag){ if (list) h += `</${list.tag}>`; h += `<${tag}${tag === "ol" && start !== 1 ? ` start="${start}"` : ""}>`; list = {tag}; }
    h += `<li${depth ? ` class="jn-d${Math.min(depth, 3)}"` : ""}>${html}</li>`;
  };
  String(src).replace(/\r/g, "").split("\n").forEach((ln, i) => { let m;
    if (code !== null){ if (/^\s*```/.test(ln)){ h += `<pre class="jn-pre">${esc(code.join("\n"))}</pre>`; code = null; } else code.push(ln); return; }
    if (/^\s*```/.test(ln)){ close(); code = []; gap = false; return; }
    const depth = Math.floor((ln.match(/^ */)[0].length) / 2);
    if ((m = ln.match(/^\s*[-*+] \[( |x|X)\]\s?(.*)$/))){ close(); gap = false;
      h += `<label class="jn-task${depth ? " jn-d" + Math.min(depth, 3) : ""}"><input type="checkbox" data-tk="${eid}|${i}"${m[1] !== " " ? " checked" : ""}><span>${jnInline(m[2])}</span></label>`; return; }
    if ((m = ln.match(/^\s*[-*+•]\s+(.*)$/))){ gap = false; item("ul", depth, 1, jnInline(m[1])); return; }
    if ((m = ln.match(/^\s*(\d+)[.)]\s+(.*)$/))){ gap = false; item("ol", depth, +m[1], jnInline(m[2])); return; }
    if ((m = ln.match(/^>\s?(.*)$/))){ if (list){ h += `</${list.tag}>`; list = null; } if (!quote){ h += "<blockquote>"; quote = true; } else h += "<br>"; h += jnInline(m[1]); gap = false; return; }
    close();
    if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) h += `<p class="jn-h jn-h${m[1].length}">${jnInline(m[2])}</p>`;
    else if ((m = ln.match(/^!!\s*(.*)$/))) h += `<p class="flag jn-flag">${jnInline(m[1])}</p>`;
    else if ((m = ln.match(/^\s*\?(\?|✓)\s*(.*)$/))) h += `<label class="jn-task jn-q"><input type="checkbox" data-tk="${eid}|${i}"${m[1] === "✓" ? " checked" : ""}><span><b class="jn-qm" aria-hidden="true">${m[1] === "✓" ? "✔" : "?"}</b> ${jnInline(m[2])}</span></label>`;
    else if ((m = ln.match(JN_PROP)) && !/^https?$/i.test(m[1])) h += `<p class="jn-prop"><b>${esc(m[1].trim())}</b><span>${jnInline(m[2])}</span></p>`;
    else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(ln)) h += "<hr>";
    else if (ln.trim()) h += `<p>${jnInline(ln)}</p>`;
    else { if (!gap) h += `<div class="jn-gap"></div>`; gap = true; return; }
    gap = false;
  });
  if (code !== null) h += `<pre class="jn-pre">${esc(code.join("\n"))}</pre>`;   /* a ``` never closed still shows */
  close(); return h;
}
const JN_TOOLS = `<div class="chips jn-tools">${[["- [ ] ", "☐ Task", "task"], ["!! ", "⚠ Heads-up", "flag"], ["?? ", "? Question", "q"], ["#", "# Tag", "tag"], ["[[", "[[ Link ]]", "link"], ["@date", "📅 Date", "date"], ["@fact", "Label: fact", "prop"], ["- ", "• List", ""], ["# ", "Heading", ""], ["**", "Bold", ""], ["day", "📝 Day log", ""]]
  .map(([k, t, c]) => `<button type="button" data-ins="${esc(k)}"${c ? ` class="t-${c}"` : ""}>${t}</button>`).join("")}</div>`;
const jnWhen = e => { const t = new Date(e.at); return jbNice(e.d) + (jbDay(t) === e.d ? " · " + t.toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"}) : ""); };
const jnEntry = e => JB.edit === e.id
  ? `<article class="jn-e"><div class="calc"><label for="jn-ed-d">Date<input id="jn-ed-d" type="date" value="${esc(e.d)}"></label><label for="jn-ed" class="wide">Note<textarea id="jn-ed" class="jn-ta" rows="6">${esc(e.b)}</textarea></label></div>${JN_TOOLS}
     <div class="set-btns jn-btns"><button type="button" class="btn" data-a="jn-save">Save</button><button type="button" class="btn ghost" data-a="jn-cancel">Cancel</button><button type="button" class="del" data-a="jn-del">Delete</button></div></article>`
  : `<article class="jn-e"><header><span>${jnWhen(e)}${e.ed ? ` · edited ${jbShort(e.ed)}` : ""}</span><button type="button" class="jb-x" data-edit="${e.id}" aria-label="Edit this note">✎</button></header><div class="jn-b">${jnMd(e.b, e.id, e.d)}</div></article>`;
const JN_CHEAT = [
  ["- [ ] call the super", "A checkbox. Tap it off when it's done; the job counts the open ones."],
  ["!! gas not tested yet", "A red heads-up line. For anything that can't be missed."],
  ["?? does the super want the vent through the roof or the side wall", "A blue open question. Tap it when you get the answer; the job counts the open ones (❓)."],
  ["call inspector @tomorrow, final @Nov 20", "A purple date. @today, @tomorrow, @fri, @Nov 20, @11/20 all work, counted from the note's date. The next 7 days show on Home under My jobs."],
  ["PSI: 80\nWater heater: Rheem XG50T06EC36U1\nSerial: Q041912345", "Facts. A line like Label: value shows as a fact, and the job collects them all at the top (From your notes): pressure, serials, gate codes, model numbers."],
  ["#warranty #callback", "Tags. Each tag keeps its own color everywhere. Tap one to see every job with it."],
  ["[[Sam]] [[ABC Homes]] [[Sunny Acres]] [[Lot 12]] [[Offset calculator]]", "Links. The color and icon say what it opens: 👤 a person, 🏗 a builder, 🏘 a subdivision, 🔧 another job, 📖 a card in the book. A gray ＋ means nothing has that name yet: tap it to make a person page."],
  ["[[Sam|the lead]]", "A link that shows your own words."],
  ["# Top-out walk", "A heading. Two ## for a smaller one."],
  ["**bold** *italic* ==highlight== ~~done~~", "Bold, italic, highlighted, struck out."],
  ["- 3/4 PEX\n  - 2 elbows\n1. first\n2. second", "Lists. Two spaces in front tuck a line under the one above; numbers keep their order."],
  ["> strap the 3/4 in the garage", "A quote: what the inspector said, word for word."],
  ["```\n3/4 x 8' 6\"\n1/2 x 4'\n```", "Three backticks above and below: shows exactly as typed (cut lists, model numbers)."],
  ["801-555-0100", "Phone numbers and web links are tappable."],
  ["## Did\n- set tubs\n## Didn't, and why\n- no water heater on site\n## Next\n- [ ] trim kit @fri", "📝 Day log: the button lays this out for you. What got done, what didn't and why, what's next: the three things a daily log needs."]];
function jnHelpHtml(){
  jnForce = {"sam": "person", "abc homes": "bld", "sunny acres": "sub", "lot 12": "job", "offset calculator": "card"};   /* the examples always show every color */
  const rows = JN_CHEAT.map(([src, what]) => `<div class="jn-cr"><code class="jn-src">${esc(src)}</code><div class="jn-b jn-out">${jnMd(src, "cheat")}</div><p class="jn-what">${what}</p></div>`).join("");
  jnForce = null;
  const tryIt = "- [ ] call [[Sam]] #warranty\n!! gas not tested\n?? vent through roof or wall\nfinal @Nov 20\nPSI: 80";
  return `<details class="explain"><summary>Every mark, with examples</summary><div>
    <p class="note jn-lead">Type the marks on the left; the note shows what's on the right. The buttons above the box put them in for you, in the same colors.</p>
    <div class="jn-cheat">${rows}</div>
    <p class="card-h">Try it</p>
    <div class="calc"><label for="jn-try" class="wide">Type here: nothing is saved<textarea id="jn-try" rows="3">${esc(tryIt)}</textarea></label></div>
    <div class="jn-b jn-prev" id="jn-tryout">${jnMd(tryIt, "try")}</div></div></details>`;
}
/* one notes block, for a job stage or a person */
const jnOwner = () => eCur() || (JB.person ? pById(JB.person) : jbCur());
const jnIntro = n => `<details class="explain jn-howto"${n < 3 ? " open" : ""}><summary>How notes work (30 seconds) · every mark</summary><div>
  <p class="jn-step"><span class="jn-num">1</span><span>Type what happened in plain words: <i>"Set tubs. Inspector moved to Thursday."</i> That's a note. No marks needed.</span></p>
  <p class="jn-step"><span class="jn-num">2</span><span>Want a checkbox, a warning or a date? Tap a <b>colored button</b> under the box; it types the mark for you. The color you see in the note matches the button.</span></p>
  <p class="jn-step"><span class="jn-num">3</span><span>Tap <b>Add note</b>. It's saved here with today's date, newest on top. Tap <b>✎</b> on a note to fix it later.</span></p>
  <div class="jn-key" aria-label="Color key"><span class="k k-task">☐ Task: to do</span><span class="k k-flag">⚠ Heads-up: don't miss</span><span class="k k-q">? Question: ask someone</span><span class="k k-tag"># Tag: group jobs</span><span class="k k-link">👤 Link: a person or page</span><span class="k k-date">📅 Date: coming up</span><span class="k k-prop">Label: fact: PSI, serial</span></div>
  ${jnHelpHtml()}
  <p class="note"><b>Good notes are short, same-day and specific:</b> what got done, what didn't and why (delays!), who said what (use a <code>&gt;</code> quote), and a photo of anything that'll be hidden behind drywall. Every model and serial you install: write it as <code>Serial: …</code> so it's there for a warranty call.</p>
</div></details>`;
const jnBlock = (o, list, ph) => `${jnIntro(list.length)}<div class="calc"><label for="jn-new" class="wide">New note<textarea id="jn-new" class="jn-ta" rows="3" placeholder="${ph}">${esc(o.draft)}</textarea></label>
    <label for="jn-d">Date<input id="jn-d" type="date" value="${jbDay()}"></label></div>
  ${JN_TOOLS}
  <div class="jn-b jn-prev" id="jn-prev"${o.draft.trim() ? "" : " hidden"}><p class="jn-prevh">Preview: how it'll look</p>${o.draft.trim() ? jnMd(o.draft, "prev") : ""}</div>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn" data-a="jn-add">Add note</button></div></div>
  ${list.length ? `<div class="jn-log">${list.slice().sort(jnSort).map(jnEntry).join("")}</div>` : ""}`;

/* a row of color dots; "None"/"Auto" first. data-col = what|which|color */
const jbSwatches = (what, which, cur, none) => `<div class="jb-sw" role="group" aria-label="Color">${none ? `<button type="button" class="jb-swa" data-col="${what}|${which}|" aria-pressed="${!cur}">${none}</button>` : ""}${JB_PAL.map(c => `<button type="button" data-col="${what}|${which}|${c}" aria-pressed="${cur === c}" style="--sw:var(--pal-${c})" aria-label="${c}"></button>`).join("")}</div>`;
/* stage colors you picked replace the defaults everywhere (Home too), so they're set on the page itself */
function jbApplyColors(){ const R = document.documentElement.style; JB_STG.forEach(([k]) => { const c = jbD.stageCol[k]; if (c) R.setProperty("--c-" + k, `var(--pal-${c})`); else R.removeProperty("--c-" + k); }); }
const jbTagStyle = t => { const c = jbD.tagCol[t.toLowerCase()]; return c ? `--tc:var(--pal-${c})` : `--h:${jnHue(t)}`; };
function jbHours(){
  const all = jbD.jobs.flatMap(j => j.hrs), now = jbDay(), wk = jbWk(now), lx = new Date(wk + "T12:00:00"); lx.setDate(lx.getDate() - 7);
  const lw = jbDay(lx), sum = f => all.filter(f).reduce((n, h) => n + (+h.h || 0), 0);
  return {today: sum(h => h.d === now), wk: sum(h => jbWk(h.d) === wk), lw: sum(h => jbWk(h.d) === lw), all: sum(() => true)};
}
function jbNew(){
  const j = {id: jbId(), made: Date.now(), name: "", a: "", who: "", bld: "", sub: "", city: "", st: "open", lead: "", sup: "", ppl: [], log: [], draft: "", t: Date.now(), insp: [], hrs: [], punch: [], stages: {}};
  JB_STG.forEach(([k], i) => { j.stages[k] = {st: i ? "todo" : "doing", d0: "", d1: "", lead: "", done: [], extra: []}; }); j.xs = [];
  jbD.jobs.push(j); JB.open = j.id; JB.person = null; JB.ent = null; JB.edit = null; JB.stage = null; jbSave(); return j;
}
/* a note line as plain words: marks taken off, @dates spelled out (row previews, open items, mentions, search) */
const jnPlain = (x, base) => x.replace(/^\s*([-*+] \[[ xX]\]|[-*+•](?=\s)|\d+[.)](?=\s)|#{1,3}(?=\s)|!!|>|\?\?|\?✓)\s*/, "")
  .replace(JN_DATE, (m, a, tok) => { const iso = jnResolve(tok, base); return iso ? a + "📅 " + jbShort(new Date(iso + "T12:00:00").getTime()) : m; })
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\*\*|==|~~|\[\[|\]\]|`/g, "").trim();
const jbRow = (j, attr = "data-open", extra = "") => { const n = jbNext(j), c = cityById(j.city), tk = jbTasks(j), qs = jbQs(j), cs = jbStageNow(j), last = j.log.slice().sort(jnSort)[0];
  const act = jbStages(j).filter(([k]) => j.stages[k].st !== "skip"), done = act.filter(([k]) => j.stages[k].st === "done").length;
  const gist = last ? last.b.split("\n").map(x => jnPlain(x, last.d)).find(Boolean) || "" : "";
  return `<button type="button" class="jb-row${j.color ? " jb-colored" : ""}"${j.color ? ` style="--jc:var(--pal-${j.color})"` : ""} ${attr}="${j.id}"><b>${j.pin ? '<span class="jb-pin" aria-label="Pinned">📌</span> ' : ""}${jbIco(jbIcon(j))}${esc(jbName(j))}</b><span>${[(j.name || "").trim() && j.a, eName("sub", j.sub), j.who, c && c.n, pName(j.lead) && "Lead " + pName(j.lead)].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</span>`
    + (extra || (gist ? `<span class="jb-gist">${esc(gist.slice(0, 90))}</span>` : ""))
    + `<span class="jb-tags"><span class="badge jb-sbadge jt-k-${cs}">${esc(JB_SNAME[cs])}</span><span class="badge">${done} of ${act.length} stages</span>${j.st !== "open" ? `<span class="badge">${JB_ST[j.st]}</span>` : ""}${tk ? `<span class="badge">☐ ${tk} to do</span>` : ""}${qs ? `<span class="badge jb-qb">? ${qs} question${qs === 1 ? "" : "s"}</span>` : ""}${(li => li && li.r === "fail" ? `<span class="badge jb-fail">✗ Failed inspection</span>` : li && li.r === "partial" ? `<span class="badge jb-fail">◐ Partial inspection</span>` : "")(j.insp.filter(i => i.r !== "booked").sort(jbByDate)[0])}${n ? n.d < jbDay() ? `<span class="badge jb-fail">📋 Inspection ${jbNice(n.d)}: result?</span>` : `<span class="jb-insp">📋 Inspection ${jbNice(n.d)}</span>` : ""}</span></button>`; };
const eRow = (t, x) => { const n = eJobs(t, x).length, c = t === "sub" && cityById(x.city);
  const sub = t === "bld" ? [x.ph, (n2 => `${n2 || "no"} subdivision${n2 === 1 ? "" : "s"}`)(jbD.subs.filter(s => s.bld === x.id).length)] : [c && c.n, eName("bld", x.bld)];
  return `<button type="button" class="jb-row" data-ent="${t}|${x.id}"><b>${t === "sub" ? jbIco(x.icon) : ""}${esc(x.n || "No name")}</b><span>${[...sub, `${n} job${n === 1 ? "" : "s"}`].filter(Boolean).map(esc).join(" · ")}</span></button>`; };
const pRow = p => { const n = pJobs(p).length;
  return `<div class="jp-row"><button type="button" class="jb-row" data-person="${p.id}"><b>${esc(p.n || "No name")}</b><span>${[p.role, p.co].filter(Boolean).map(esc).join(" · ")}${n ? ` · ${n} job${n === 1 ? "" : "s"}` : ""}</span></button>${pTel(p) ? `<a class="btn ghost jp-call" href="tel:${pTel(p)}" aria-label="Call ${esc(p.n)}">Call</a>` : ""}</div>`; };

/* Find: every word has to be somewhere on the job (name, address, people, builder, notes, punch list, inspections, hours) */
const jbHay = j => [jbName(j), j.a, j.who, eName("bld", j.bld), eName("sub", j.sub), (cityById(j.city) || {}).n, pName(j.lead), pName(j.sup), ...j.ppl.map(x => pName(x.p)),
  ...j.log.map(e => e.b), ...j.punch.map(p => p.t), ...j.insp.map(i => [i.who, i.n].join(" ")), ...j.hrs.map(h => h.n), ...JB_STG.map(([k]) => j.stages[k].extra.map(x => x.t).join(" "))].filter(Boolean).join("\n").toLowerCase();
const jbMark = (txt, W) => { let h = esc(txt); W.forEach(w => { const ew = esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); h = h.replace(new RegExp(`(${ew})`, "gi"), "<mark>$1</mark>"); }); return h; };
function jbFindHtml(q){
  const W = q.toLowerCase().split(/\s+/).filter(Boolean); if (!W.length) return "";
  const hits = jbD.jobs.filter(j => { const h = jbHay(j); return W.every(w => h.includes(w)); })
    .sort((a, b) => (a.st === "done") - (b.st === "done") || jbNat(a, b));
  const where = j => { if (W.every(w => jbName(j).toLowerCase().includes(w))) return "";
    for (const e of j.log.slice().sort(jnSort)) for (const ln of e.b.split("\n")) if (W.some(w => ln.toLowerCase().includes(w))) return `${jbShort(new Date(e.d + "T12:00:00").getTime())} · ${jnPlain(ln, e.d) || ln}`;
    return ""; };
  const ents = [...jbD.people.filter(p => W.every(w => [p.n, p.co, p.role, p.ph].join(" ").toLowerCase().includes(w))).map(pRow),
    ...["bld", "sub"].flatMap(t => eList(t).filter(x => W.every(w => (x.n || "").toLowerCase().includes(w))).map(x => eRow(t, x)))];
  const rows = hits.slice(0, 40).map(j => { const w = where(j); return jbRow(j, "data-open", w ? `<span class="jb-gist jb-snip">${jbMark(w.slice(0, 120), W)}</span>` : ""); }).join("");
  return `<p class="note jb-sortnote" aria-live="polite">${hits.length ? `${hits.length} job${hits.length === 1 ? "" : "s"}${hits.length > 40 ? " (first 40)" : ""}, open ones first` : "No job has all of those words."}</p>`
    + (rows ? `<div class="jb-list">${rows}</div>` : "")
    + (ents.length ? `<p class="card-h">People, builders, subdivisions</p><div class="jb-list">${ents.join("")}</div>` : "");
}
/* every open checkbox and question on active jobs, so nothing hides inside a note */
const JN_OPEN = /^\s*(?:[-*+] \[ \]|\?\?)/;
function jbOpenItems(){
  const out = []; jbD.jobs.filter(j => j.st !== "done").sort(jbNat).forEach(j => j.log.slice().sort(jnSort).forEach(e => e.b.split("\n").forEach(ln => {
    if (JN_OPEN.test(ln)) out.push({j, e, q: /^\s*\?\?/.test(ln), t: jnPlain(ln, e.d)}); })));
  return out;
}
const jbOpenHtml = () => { const L = jbOpenItems(); if (!L.length) return "";
  const tk = L.filter(x => !x.q).length, qs = L.length - tk;
  return `<details class="explain"${JB.openItems ? " open" : ""} data-oi="1"><summary>Open on active jobs: ${[tk && `☐ ${tk} to do`, qs && `? ${qs} question${qs === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</summary><div>
    <p class="note jn-lead">Every unchecked box and open question in your notes. Tap one to go to its note and check it off there.</p>
    <ul class="jb-soon jb-oi">${L.slice(0, 80).map(x => `<li><button type="button" class="linkish" data-open="${x.j.id}" data-ostage="${x.e.s || ""}"><span class="jb-oik${x.q ? " q" : ""}" aria-hidden="true">${x.q ? "?" : "☐"}</span> <b>${esc(jbName(x.j))}</b> · ${esc(x.t.slice(0, 90))}</button></li>`).join("")}</ul></div></details>`; };
/* backlinks: the note lines on jobs that [[link]] this name */
function jbMentionHtml(name){
  const n = String(name || "").trim().toLowerCase(); if (!n) return "";
  const L = []; jbD.jobs.forEach(j => j.log.forEach(e => e.b.split("\n").forEach(ln => { const l = ln.toLowerCase(); if (l.includes("[[" + n + "]]") || l.includes("[[" + n + "|")) L.push({j, e, t: jnPlain(ln, e.d)}); })));
  if (!L.length) return "";
  L.sort((a, b) => jnSort(a.e, b.e));
  return `<p class="card-h" data-fold="ment">Mentioned in job notes · ${L.length}</p><ul class="jb-soon jb-oi">${L.slice(0, 30).map(x => `<li><button type="button" class="linkish" data-open="${x.j.id}" data-ostage="${x.e.s || ""}"><b>${esc(jbName(x.j))}</b> · ${jbShort(new Date(x.e.d + "T12:00:00").getTime())} · ${esc(x.t.slice(0, 90))}</button></li>`).join("")}</ul>`;
}
/* the job list as a tree: Builder › Subdivision › job. Tap a name to fold it (remembered); "Page" opens its page */
function jbGroups(L){
  const tw = (key, label, n, page, lvl, ico) => { const f = !!jbD.fold[key];
    return `<div class="jb-th jb-th${lvl}"><button type="button" class="jb-tf" data-tfold="${key}" aria-expanded="${!f}"><span class="jb-car" aria-hidden="true">${f ? "▸" : "▾"}</span>${ico || ""}<b>${esc(label)}</b><span class="jb-tn">${n}</span></button>${page ? `<button type="button" class="jb-tp" data-ent="${page}">Page ›</button>` : ""}</div>`; };
  const byB = new Map(); L.forEach(j => { const k = eById("bld", j.bld) ? j.bld : ""; if (!byB.has(k)) byB.set(k, []); byB.get(k).push(j); });
  const byName = t => (x, y) => !x ? 1 : !y ? -1 : eName(t, x).localeCompare(eName(t, y));
  return [...byB.keys()].sort(byName("bld")).map(bk => { const jobs = byB.get(bk), fk = "b:" + (bk || "none");
    let h = tw(fk, bk ? eName("bld", bk) : "No builder", jobs.length, bk ? "bld|" + bk : "", 1);
    if (!jbD.fold[fk]){ const byS = new Map(); jobs.forEach(j => { const k = eById("sub", j.sub) ? j.sub : ""; if (!byS.has(k)) byS.set(k, []); byS.get(k).push(j); });
      const subs = [...byS.keys()].sort(byName("sub"));
      h += subs.map(sk => { const js = byS.get(sk), k2 = "s:" + (bk || "none") + ":" + (sk || "none"), rows = `<div class="jb-list jb-tl">${js.map(j => jbRow(j)).join("")}</div>`;
        if (subs.length === 1 && !sk) return rows;   /* no subdivisions under this builder: no extra level */
        return tw(k2, sk ? eName("sub", sk) : "No subdivision", js.length, sk ? "sub|" + sk : "", 2, sk ? jbIco((eById("sub", sk) || {}).icon) : "") + (jbD.fold[k2] ? "" : rows); }).join(""); }
    return `<div class="jb-grp">${h}</div>`; }).join("");
}
function jbListHtml(){
  const viewSeg = `<div class="seg jb-seg jb-views" role="group" aria-label="Show">${[["jobs", "Jobs", jbD.jobs], ["people", "People", jbD.people], ["bld", "Builders", jbD.builders], ["sub", "Subdivisions", jbD.subs]]
    .map(([k, t, L]) => `<button type="button" data-view="${k}" aria-pressed="${JB.view === k}">${t} · ${L.length}</button>`).join("")}</div>`;
  if (JB.view === "bld" || JB.view === "sub"){ const t = JB.view, C = ENT[t], E = eList(t).slice().sort((a, b) => a.n.localeCompare(b.n));
    return `${viewSeg}<div class="set-btns jb-top"><button type="button" class="btn" data-a="e-new">+ New ${C.one}</button></div>
    <div class="jb-list">${E.map(x => eRow(t, x)).join("") || `<p class="note">None yet. They show up here when you pick a ${C.one} on a job, or tap <b>+ New ${C.one}</b>. Each has a page: ${t === "bld" ? "office phone, website, their people and subdivisions" : "city, builder, gate code, where water and sewer tie in"}, notes, and every job.</p>`}</div>`; }
  if (JB.view === "people"){
    const P = jbD.people.slice().sort((a, b) => a.n.localeCompare(b.n));
    return `${viewSeg}<div class="set-btns jb-top"><button type="button" class="btn" data-a="p-new">+ New person</button></div>
    <div class="jb-list">${P.map(pRow).join("") || `<p class="note">No one yet. People show up here when you add a lead or super to a job, or tap <b>+ New person</b>. Each has a page: phone, company, notes, and every job they're on.</p>`}</div>`;
  }
  const L = jbD.jobs.filter(j => jbIn(JB.show, j) && (!JB.tag || jbTags(j).includes(JB.tag))).sort(jbNat), H = jbHours(), PIN = L.filter(j => j.pin);
  const tags = [...new Set(jbD.jobs.flatMap(jbTags))].sort();
  const goal = +jbD.goal === 6000 ? 6000 : 8000, have = H.all + (+jbD.before || 0), pct = Math.min(100, have / goal * 100);
  const fq = (JB.q || "").trim();
  return `${viewSeg}<div class="set-btns jb-top"><button type="button" class="btn" data-a="new">+ New job</button></div>
  ${jbD.jobs.length ? `<div class="calc jb-find"><label for="jb-q" class="wide">Find a job<input id="jb-q" type="search" autocomplete="off" autocorrect="off" enterkeyhint="search" value="${esc(JB.q || "")}" placeholder="Lot, address, person, serial, any word in a note"></label></div>` : ""}
  <div id="jb-res">${fq ? jbFindHtml(fq) : ""}</div>
  <div id="jb-main"${fq ? " hidden" : ""}>
  <div class="seg jb-seg" role="group" aria-label="Show">${[["open", "Active"], ["done", "Done"], ["all", "All"]].map(([k, t]) => `<button type="button" data-show="${k}" aria-pressed="${JB.show === k}">${t} · ${jbD.jobs.filter(j => jbIn(k, j)).length}</button>`).join("")}</div>
  ${tags.length ? `<div class="chips jn-tagbar">${JB.tag ? `<button type="button" data-tagclr="1" aria-pressed="true">#${esc(JB.tag)} ✕ show all</button>` : tags.map(t => `<button type="button" class="jn-tagchip" style="${jbTagStyle(t)}" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
  <p class="note jb-sortnote">${JB.show === "open" ? "Active = open and on hold. " : ""}A to Z by name (Lot 2 before Lot 12). Pin a job from its page to keep it on top.</p>
  ${PIN.length ? `<div class="jb-grp"><div class="jb-th jb-th1"><span class="jb-tf"><b>📌 Pinned</b><span class="jb-tn">${PIN.length}</span></span></div><div class="jb-list">${PIN.map(j => jbRow(j)).join("")}</div></div>` : ""}
  ${L.length ? (L.length > PIN.length ? jbGroups(L.filter(j => !j.pin)) : "") : `<div class="jb-list"><p class="note">${jbD.jobs.length ? `No ${JB.show === "open" ? "active" : JB.show === "done" ? "done" : ""} jobs${JB.tag ? ` tagged <b>#${esc(JB.tag)}</b>` : ""}. ${JB.tag ? "Tap the tag above to show all." : JB.show !== "all" ? "Tap <b>All</b> to see every job." : ""}` : "No jobs yet. Tap <b>+ New job</b>. Each job is a timeline, Underground to Final, with the blanks ready to fill in as you go."}</p></div>`}
  ${jbOpenHtml()}
  </div>
  <p class="card-h">Hours</p>
  <div class="x"><table class="t wrap"><tbody>
    <tr><th>Today</th><td>${jbHr(H.today)} hr</td></tr>
    <tr><th>This week</th><td>${jbHr(H.wk)} hr <span class="sub">(Mon–Sun)</span></td></tr>
    <tr><th>Last week</th><td>${jbHr(H.lw)} hr</td></tr>
    <tr><th>Toward license</th><td>${jbHr(have)} of ${goal.toLocaleString()} hr · ${Math.floor(pct)}%<div class="jb-bar" aria-hidden="true"><i style="width:${pct}%"></i></div></td></tr>
  </tbody></table></div>
  <details class="explain"><summary>Set the license goal</summary><div>
    <div class="calc"><label for="jb-goal">Goal<select id="jb-goal"><option value="6000">Residential journeyman · 6,000 hr</option><option value="8000">Journeyman · 8,000 hr</option></select></label>
    <label for="jb-before">Hours before this app<input id="jb-before" type="number" inputmode="decimal" min="0" step="any" value="${+jbD.before || ""}" placeholder="0"></label></div>
    <p class="note">Your own count, so you can see where you stand. DOPL goes by the hours your sponsor reports, so keep those records too. The goals are the on-the-job hours in Learn → License → Path to a license.</p></div></details>
  ${jbBytes() > 15e5 ? `<div class="jb-in"><p class="note${jbBytes() > 35e5 ? " flag" : ""}">Jobs use about ${(jbBytes() / 1e6).toFixed(1)} MB of the roughly 5 MB this phone gives them. Download a backup and delete finished jobs before it fills: past that, new entries won't save.</p></div>` : ""}
  <p class="card-h" id="jb-bk">Backup</p>
  <div class="jb-in"><p class="note">${jbLastBk()}</p>
  <div class="set-btns"><button type="button" class="btn" data-a="bk-all">Back up everything</button><label class="btn ghost">Restore a backup<input type="file" id="jb-restore" accept=".zip,.json,application/zip,application/json" hidden></label></div>
  <p class="note" id="jf-say" aria-live="polite"></p><p class="note" id="jf-use"></p></div>
  ${jbBinHtml()}
  <details class="explain"${JB.colOpen ? " open" : ""}><summary>Colors: stages &amp; tags</summary><div>
    <p class="note jn-lead">Pick a color for each stage and tag, or leave it on Auto. Each job's own color is on the job's page.</p>
    ${JB_STG.map(([k, nm]) => `<div class="jb-colrow jt-k-${k}"><span class="jb-dot"></span>${nm}</div>${jbSwatches("stage", k, jbD.stageCol[k], "Auto")}`).join("")}
    ${tags.length ? tags.map(t => `<div class="jb-colrow"><span class="jn-tag" style="${jbTagStyle(t)}">#${esc(t)}</span></div>${jbSwatches("tag", esc(t), jbD.tagCol[t], "Auto")}`).join("") : `<p class="note jn-lead">Tags show up here once a note has one, like <code>#warranty</code>.</p>`}
  </div></details>`;
}

/* tap ✎ on a row to change it right there; Save or Cancel */
const jbIsEd = (k, id) => JB.rowEdit === k + "|" + id;
const jbEdBtn = (k, id, what) => `<button type="button" class="jb-x" data-redit="${k}|${id}" aria-label="Edit ${what}">✎</button>`;
const jbRowBtns = `<div class="set-btns jb-rowbtns"><button type="button" class="btn" data-a="row-save">Save</button><button type="button" class="btn ghost" data-a="row-cancel">Cancel</button></div>`;
const jbTextEd = v => `<div class="calc jb-rowed"><label for="re-t" class="wide">Change it<input id="re-t" type="text" autocomplete="off" value="${esc(v)}"></label></div>${jbRowBtns}`;
const jbInspRow = i => jbIsEd("insp", i.id)
  ? `<tr><td colspan="3"><div class="calc jb-rowed"><label for="re-d">Date<input id="re-d" type="date" value="${esc(i.d)}"></label><label for="re-r">Result<select id="re-r">${jbOpts(JB_RES, i.r)}</select></label>
     <label for="re-who" class="wide">Inspector<input id="re-who" type="text" list="jb-ppl" autocomplete="off" value="${esc(i.who)}"></label><label for="re-n" class="wide">Notes / corrections<input id="re-n" type="text" autocomplete="off" value="${esc(i.n)}"></label></div>${jbRowBtns}</td></tr>`
  : `<tr><td><b>${jbNice(i.d)}</b>${i.who ? `<div class="sub">${esc(i.who)}</div>` : ""}${i.n ? `<div class="sub">${esc(i.n)}</div>` : ""}</td><td><select data-ir="${i.id}" aria-label="Result">${jbOpts(JB_RES, i.r)}</select></td><td class="jb-acts">${jbEdBtn("insp", i.id, "this inspection")}<button type="button" class="jb-x" data-del="insp|${i.id}" aria-label="Delete this inspection">×</button></td></tr>`;
const jbHrsRow = h => jbIsEd("hrs", h.id)
  ? `<tr><td colspan="3"><div class="calc jb-rowed"><label for="re-d">Date<input id="re-d" type="date" value="${esc(h.d)}"></label><label for="re-h">Hours<input id="re-h" type="number" inputmode="decimal" min="0" max="24" step="any" value="${h.h}"></label>
     <label for="re-n" class="wide">What you did<input id="re-n" type="text" autocomplete="off" value="${esc(h.n)}"></label></div>${jbRowBtns}</td></tr>`
  : `<tr><td>${jbNice(h.d)}${h.n ? `<div class="sub">${esc(h.n)}</div>` : ""}</td><td class="n">${jbHr(+h.h)} hr</td><td class="jb-acts">${jbEdBtn("hrs", h.id, "these hours")}<button type="button" class="jb-x" data-del="hrs|${h.id}" aria-label="Delete these hours">×</button></td></tr>`;
function jbStageSum(j, k){
  const s = j.stages[k], ins = j.insp.filter(i => i.s === k).sort(jbByDate)[0], nN = j.log.filter(e => e.s === k).length, hr = j.hrs.filter(h => h.s === k).reduce((n, h) => n + (+h.h || 0), 0), C = jbCk(j, k);
  const b = [JB_SST[s.st] + (s.st === "done" && s.d1 ? " " + jbNice(s.d1) : s.st === "doing" && s.d0 ? ` since ${jbNice(s.d0)} (${jbDays(s.d0)} day${jbDays(s.d0) === 1 ? "" : "s"})` : "")];
  if (pName(s.lead)) b.push("Lead " + pName(s.lead));
  if (ins) b.push(`Inspection ${JB_RES[ins.r].toLowerCase()} ${jbNice(ins.d)}`);
  if (C.total && s.st !== "skip") b.push(`☑ ${C.done}/${C.total}`);
  if (nN) b.push(nN + (nN === 1 ? " note" : " notes")); if (hr) b.push(jbHr(hr) + " hr");
  return esc(b.join(" · "));
}
function jbStageHtml(j, k){
  const s = j.stages[k], C = jbCk(j, k), ins = j.insp.filter(i => i.s === k).sort(jbByDate), hrs = j.hrs.filter(h => h.s === k).sort(jbByDate);
  const hr = hrs.reduce((n, h) => n + (+h.h || 0), 0);
  return `<div class="jt-head"><span class="jt-dot" aria-hidden="true">${JB_ICON[s.st]}</span><h3>${JB_SNAME[k]}</h3>${JB_XTRA.includes(k) ? `<button type="button" class="linkish jt-rm" data-xdel="${k}">Remove stage</button>` : ""}</div>
  <div class="seg jb-seg" role="group" aria-label="${JB_SNAME[k]} status">${Object.entries(JB_SST).map(([v, t]) => `<button type="button" data-sst="${v}" aria-pressed="${s.st === v}">${t}</button>`).join("")}</div>
  <div class="calc">
    <label for="js-d0">Started<input id="js-d0" data-sf="d0" type="date" value="${esc(s.d0)}"></label>
    <label for="js-d1">Done<input id="js-d1" data-sf="d1" type="date" value="${esc(s.d1)}"></label>
    <label for="js-lead" class="wide">Lead on this stage<input id="js-lead" data-sp="1" list="jb-ppl" type="text" autocomplete="off" value="${esc(pName(s.lead))}" placeholder="${esc(pName(j.lead) || "Who ran it")}"></label>
  </div>
  <p class="card-h" data-fold="s-check">Checklist · ${C.done} of ${C.total} <button type="button" class="linkish" data-a="ck-edit" aria-pressed="${JB.ckEdit}">${JB.ckEdit ? "Done editing" : "Edit list"}</button></p>
  ${C.items.length ? `<ul class="jb-punch">${C.items.map(x => !x.tpl && jbIsEd("ck", x.id) ? `<li class="jb-liedit">${jbTextEd(x.t)}</li>` : `<li><label><input type="checkbox" data-ck="${x.key}"${x.done ? " checked" : ""}><span>${esc(x.t)}${x.done && x.at ? `<small class="jb-when">✓ ${jbShort(x.at)}</small>` : ""}</span></label>${x.tpl ? "" : jbEdBtn("ck", x.id, esc(x.t))}${x.tpl && !JB.ckEdit ? "" : `<button type="button" class="jb-x" data-ckdel="${x.key}" aria-label="Remove ${esc(x.t)}">×</button>`}</li>`).join("")}</ul>` : `<div class="jb-in"><p class="note">Empty. Add what this stage needs below.</p></div>`}
  ${JB.ckEdit ? `<div class="jb-in"><p class="note">Remove what you don't use and add your own. Then save it as your list for ${JB_SNAME[k]} on every new job.${Array.isArray((jbD.tpl || {})[k]) ? " You're using your own list for this stage." : " Right now it starts from the book's list."}</p>
    <div class="set-btns"><button type="button" class="btn" data-a="ck-save">Use this list on new jobs</button>${Array.isArray((jbD.tpl || {})[k]) ? `<button type="button" class="btn ghost" data-a="ck-book">Back to the book's list</button>` : ""}</div></div>` : ""}
  <div class="calc"><label for="jc-t" class="wide">Add to the checklist<input id="jc-t" type="text" autocomplete="off" enterkeyhint="done" placeholder="Something your lead or city wants"></label></div>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn ghost" data-a="ck-add">Add item</button></div></div>

  <p class="card-h" data-fold="s-insp">Inspections</p>
  ${ins.length ? `<div class="x"><table class="t wrap jb-t"><tbody>${ins.map(jbInspRow).join("")}</tbody></table></div>` : ""}
  <details class="explain"${ins.length ? "" : " open"}><summary>+ Add an inspection</summary><div><div class="calc">
    <label for="ji-d">Date<input id="ji-d" type="date" value="${jbDay()}"></label>
    <label for="ji-r">Result<select id="ji-r">${jbOpts(JB_RES, "booked")}</select></label>
    <label for="ji-who" class="wide">Inspector <i>(optional)</i><input id="ji-who" type="text" list="jb-ppl" autocomplete="off"></label>
    <label for="ji-n" class="wide">Notes / corrections <i>(optional)</i><input id="ji-n" type="text" autocomplete="off" placeholder="Strap the 3/4 in the garage"></label>
  </div><div class="set-btns jb-top"><button type="button" class="btn" data-a="insp-add">Add inspection</button></div></div></details>

  <p class="card-h" data-fold="s-hrs">Hours · ${jbHr(hr)} hr</p>
  <div class="calc">
    <label for="jh-d">Date<input id="jh-d" type="date" value="${jbDay()}"></label>
    <label for="jh-h">Hours<input id="jh-h" type="number" inputmode="decimal" min="0" max="24" step="any" placeholder="8"></label>
    <label for="jh-n" class="wide">What you did <i>(optional)</i><input id="jh-n" type="text" autocomplete="off" placeholder="Set tubs, ran vents"></label>
  </div>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn" data-a="hrs-add">Log hours</button></div></div>
  ${hrs.length ? `<div class="x"><table class="t wrap jb-t"><tbody>${hrs.map(jbHrsRow).join("")}</tbody></table></div>` : ""}

  <p class="card-h" data-fold="s-notes">Notes</p>
  ${jnBlock(j, j.log.filter(e => e.s === k), "Gate code 1234. - [ ] call the super. !! gas not tested. [[Dave]] #warranty")}

  <p class="card-h" data-fold="s-photos">Photos</p>
  <div class="jb-in"><div class="set-btns"><label class="btn">Add photos<input type="file" id="jf-ph" accept="image/*" multiple hidden></label></div></div>
  <div class="jf-grid" id="jf-photos"></div>`;
}

function jbJobHtml(j){
  const c = cityById(j.city), addr = (j.a || "").trim(), sel = JB.stage && jbStages(j).some(([k]) => k === JB.stage) ? JB.stage : jbStageNow(j); JB.stage = sel;
  const q = encodeURIComponent([addr.replace(/^lot\s*\w+\s*[·,\-–]\s*/i, ""), c && c.n, "UT"].filter(Boolean).join(", "));
  const tk = jbTasks(j), slot = (id, label, f, ph) => `<label for="${id}">${label}<input id="${id}" data-jp="${f}" list="jb-ppl" type="text" autocomplete="off" value="${esc(pName(j[f]))}" placeholder="${ph}"></label>`;
  const team = [...[["lead", "Lead"], ["sup", "Superintendent"]].filter(([f]) => pById(j[f])).map(([f, r]) => ({p: pById(j[f]), r})), ...j.ppl.map(x => ({p: pById(x.p), r: x.r, id: x.id})).filter(x => x.p)];
  return `<div class="set-btns jb-top"><button type="button" class="btn ghost" data-a="back">‹ All jobs</button></div>
  ${j.color ? `<div class="jb-jobbar" style="--jc:var(--pal-${j.color})" aria-hidden="true"></div>` : ""}
  <p class="note jb-stamp">Added ${jbShort(j.made)} · last changed ${jbAgo(j.t)}</p>
  ${j.st !== "done" && (A => A.length && A.every(([k]) => j.stages[k].st === "done"))(jbStages(j).filter(([k]) => j.stages[k].st !== "skip")) ? `<div class="jb-in"><p class="note jb-donebar">✓ <b>Every stage is done.</b> Finished with this job?</p><div class="set-btns"><button type="button" class="btn" data-a="job-done">Mark the job Done</button></div></div>` : ""}
  <p class="card-h" data-fold="details">Job details</p>
  <div class="calc">
    <label for="jb-n" class="wide">Job name<input id="jb-n" data-f="name" type="text" autocomplete="off" value="${esc(j.name)}" placeholder="Lot 12 ABC · Smith basement"></label>
    <label for="jb-a" class="wide">Address<input id="jb-a" data-f="a" type="text" autocomplete="off" value="${esc(j.a)}" placeholder="123 N Main St"></label>
    <label for="jb-bld" class="wide">Builder<input id="jb-bld" data-je="bld" list="jb-blds" type="text" autocomplete="off" value="${esc(eName("bld", j.bld))}" placeholder="Pick or type a new one"></label>
    <label for="jb-sub" class="wide">Subdivision<input id="jb-sub" data-je="sub" list="jb-subs" type="text" autocomplete="off" value="${esc(eName("sub", j.sub))}" placeholder="Pick or type a new one"></label>
    <label for="jb-who" class="wide">Customer / homeowner <i>(optional)</i><input id="jb-who" data-f="who" type="text" autocomplete="off" value="${esc(j.who)}" placeholder="For remodels and service"></label>
    <label for="jb-city">City <i>(for Directions)</i><select id="jb-city" data-f="city">${CITY_OPTS}</select></label>
    <label for="jb-st">Job status<select id="jb-st" data-f="st">${jbOpts(JB_ST, j.st)}</select></label>
  </div>
  ${addr ? `<div class="jb-in"><div class="set-btns"><a class="btn ghost" href="https://maps.apple.com/?daddr=${q}" target="_blank" rel="noopener">Directions</a></div></div>` : ""}
  ${eById("bld", j.bld) || eById("sub", j.sub) ? `<div class="jb-list">${[["bld", j.bld], ["sub", j.sub]].filter(([t, id]) => eById(t, id)).map(([t, id]) => eRow(t, eById(t, id))).join("")}</div>` : ""}
  ${eById("sub", j.sub) && eById("sub", j.sub).gate ? `<div class="jb-in"><p class="note"><b>Gate:</b> ${esc(eById("sub", j.sub).gate)}</p></div>` : ""}

  ${(() => { const F = new Map(); j.log.slice().sort((a, b) => jnSort(b, a)).forEach(e => jnProps(e.b).forEach(([k, v]) => F.set(k.toLowerCase(), [k, v, e.d])));
    const up = j.log.flatMap(e => jnDates(e.b, e.d)).filter(([d]) => d >= jbDay()).sort((a, b) => a[0] < b[0] ? -1 : 1).slice(0, 5);
    return (F.size ? `<p class="card-h" data-fold="facts">From your notes</p><div class="x"><table class="t wrap jb-facts"><tbody>${[...F.values()].map(([k, v, d]) => `<tr><th>${esc(k)}</th><td>${jnInline(v)}<div class="sub">${jbNice(d)}</div></td></tr>`).join("")}</tbody></table></div>` : "")
      + (up.length ? `<p class="card-h" data-fold="soon">Coming up</p><ul class="jb-soon">${up.map(([d, l]) => `<li><span class="jn-date${d === jbDay() ? " now" : ""}">📅 ${jbNice(d)}</span> ${esc(l.replace(JN_DATE, "$1").replace(/^\s*([-*+] \[[ xX]\]|\?\?|!!)\s*/, "").trim().slice(0, 80))}</li>`).join("")}</ul>` : ""); })()}
  <p class="card-h" data-fold="people">People</p>
  <div class="calc">${slot("jp-lead", "Lead", "lead", "Who's leading for your company")}${slot("jp-sup", "Superintendent", "sup", "The builder's super")}</div>
  ${team.length ? `<div class="jb-list">${team.map(x => `<div class="jp-row"><button type="button" class="jb-row" data-person="${x.p.id}"><b>${esc(x.p.n)}</b><span>${esc([x.r, x.p.co].filter(Boolean).join(" · "))}</span></button>${pTel(x.p) ? `<a class="btn ghost jp-call" href="tel:${pTel(x.p)}" aria-label="Call ${esc(x.p.n)}">Call</a>` : ""}${x.id ? `<button type="button" class="jb-x" data-pdel="${x.id}" aria-label="Take ${esc(x.p.n)} off this job">×</button>` : ""}</div>`).join("")}</div>` : ""}
  <details class="explain"><summary>+ Add someone else</summary><div><div class="calc">
    <label for="jpo-r">Role<select id="jpo-r">${jbList(JB_ROLES.slice(2), "Homeowner")}</select></label>
    <label for="jpo-n" class="wide">Name<input id="jpo-n" type="text" list="jb-ppl" autocomplete="off"></label>
  </div><div class="set-btns jb-top"><button type="button" class="btn" data-a="ppl-add">Add to this job</button></div></div></details>

  <p class="card-h" data-fold="timeline">Timeline${tk ? ` · ☐ ${tk} open` : ""}${jbQs(j) ? ` · ? ${jbQs(j)} question${jbQs(j) === 1 ? "" : "s"}` : ""}</p>
  <ol class="jt">${jbStages(j).map(([k, name]) => { const s = j.stages[k];
    return k === sel ? `<li class="jt-i jt-${s.st} jt-k-${k} jt-open" id="jt-open">${jbStageHtml(j, k)}</li>`
      : `<li class="jt-i jt-${s.st} jt-k-${k}"><button type="button" class="jt-sum" data-stage="${k}"><span class="jt-dot" aria-hidden="true">${JB_ICON[s.st]}</span><span class="jt-txt"><b>${name}</b><span>${jbStageSum(j, k)}</span></span></button></li>`; }).join("")}</ol>
  ${JB_XTRA.some(k => !j.xs.includes(k)) ? `<div class="chips jn-tagbar jt-add" aria-label="Add a stage">${JB_XTRA.filter(k => !j.xs.includes(k)).map(k => `<button type="button" data-xadd="${k}">+ ${JB_SNAME[k]}</button>`).join("")}</div>` : ""}

  <p class="card-h" data-fold="punch">Punch list &amp; materials</p>
  <div class="calc"><label for="jp-t" class="wide">Add an item<input id="jp-t" type="text" autocomplete="off" enterkeyhint="done" placeholder="Nail plates, 2 × 1/2 PEX stub-outs"></label></div>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn" data-a="punch-add">Add item</button>${j.punch.some(p => p.done) ? `<button type="button" class="btn ghost" data-a="punch-clear">Clear checked</button>` : ""}</div></div>
  ${j.punch.length ? `<ul class="jb-punch">${j.punch.map(p => jbIsEd("punch", p.id) ? `<li class="jb-liedit">${jbTextEd(p.t)}</li>` : `<li><label><input type="checkbox" data-pk="${p.id}"${p.done ? " checked" : ""}><span>${esc(p.t)}${p.done && p.at ? `<small class="jb-when">✓ ${jbShort(p.at)}</small>` : p.add ? `<small class="jb-when">added ${jbShort(p.add)}</small>` : ""}</span></label>${jbEdBtn("punch", p.id, esc(p.t))}<button type="button" class="jb-x" data-del="punch|${p.id}" aria-label="Delete ${esc(p.t)}">×</button></li>`).join("")}</ul>` : ""}

  <p class="card-h" data-fold="files">Files</p>
  <div class="jb-in"><div class="set-btns"><label class="btn ghost">Add files (PDF, plans)<input type="file" id="jf-fi" multiple hidden></label></div></div>
  <div class="jb-list" id="jf-files"></div>
  <p class="card-h" data-fold="look">Look: pin, icon, color <span class="jb-hint">so you spot it fast in the list</span></p>
  <div class="jb-in"><div class="set-btns"><button type="button" class="btn ghost" data-a="pin" aria-pressed="${j.pin}">${j.pin ? "📌 Pinned to top · unpin" : "📌 Pin to top of the list"}</button></div></div>
  <details class="explain jb-pickd"><summary>Icon: ${jbIco(jbIcon(j))}${j.icon ? JB_ISO[j.icon][0] : (eById("sub", j.sub) || {}).icon ? `the subdivision's (${esc(eName("sub", j.sub))})` : "none"} · change</summary>
    ${jbIcoPick(j.icon, (eById("sub", j.sub) || {}).icon ? "Use the subdivision's" : "None")}</details>
  <div class="jb-in"><p class="note">Color: a stripe on this job's row everywhere and a bar on this page.</p></div>
  ${jbSwatches("job", j.id, j.color, "None")}
  <div class="set-btns jb-end"><button type="button" class="del" data-a="job-del">Delete this job</button></div>`;
}

function jbPersonHtml(p){
  const jobs = pJobs(p), tel = pTel(p), f = (id, k, label, type, ph, wide) => `<label for="${id}"${wide ? ' class="wide"' : ""}>${label}<input id="${id}" data-pf="${k}" type="${type}" autocomplete="off" value="${esc(p[k] || "")}" placeholder="${ph}"${type === "tel" ? ' inputmode="tel"' : ""}></label>`;
  return `<div class="set-btns jb-top"><button type="button" class="btn ghost" data-a="back">‹ Back</button></div>
  <div class="calc">
    ${f("pp-n", "n", "Name", "text", "Dave Smith", true)}
    <label for="pp-role">Role<select id="pp-role" data-pf="role">${jbList(JB_ROLES, p.role)}</select></label>
    <label for="pp-co">Company<input id="pp-co" data-pf="co" list="jb-blds" type="text" autocomplete="off" value="${esc(p.co || "")}" placeholder="Builder, city or shop"></label>
    ${f("pp-ph", "ph", "Phone", "tel", "801-555-0100", false)}
    ${f("pp-em", "em", "Email", "email", "", false)}
  </div>
  ${tel ? `<div class="jb-in"><div class="set-btns"><a class="btn" href="tel:${tel}">Call</a><a class="btn ghost" href="sms:${tel}">Text</a></div></div>` : ""}
  <p class="card-h">Jobs · ${jobs.length}</p>
  <div class="jb-list">${jbFew(jobs) || `<p class="note">Not on a job yet. Add them as a lead, super or someone else on a job, or write [[${esc(p.n || "their name")}]] in a job's notes.</p>`}</div>
  ${jbMentionHtml(p.n)}
  <p class="card-h">Notes</p>
  ${jnBlock(p, p.log, "How they like things done. - [ ] send them the test photos")}
  <div class="set-btns jb-end"><button type="button" class="del" data-a="p-del">Delete this person</button></div>`;
}

/* a page that lists jobs shows the 15 most recent; "Show all" for the rest (a lead can be on hundreds) */
const jbFew = jobs => { const L = jobs.slice().sort((a, b) => b.t - a.t), more = L.length - 15;
  return (JB.allJobs ? L : L.slice(0, 15)).map(j => jbRow(j)).join("") + (!JB.allJobs && more > 0 ? `<button type="button" class="btn ghost" data-a="all-jobs">Show all ${L.length} jobs</button>` : ""); };
function jbEntHtml(t, x){
  const C = ENT[t], jobs = eJobs(t, x), tel = (x.ph || "").replace(/[^\d+]/g, ""), web = (x.web || "").trim();
  const fld = ([k, label, type, ph]) => type === "city" ? `<label for="ef-city">${label}<select id="ef-city" data-ef="city">${CITY_OPTS}</select></label>`
    : `<label for="ef-${k}"${type === "text" ? ' class="wide"' : ""}>${label}<input id="ef-${k}" data-ef="${k}" type="${type === "bld" ? "text" : type}"${type === "bld" ? ' list="jb-blds"' : ""}${type === "tel" ? ' inputmode="tel"' : ""} autocomplete="off" value="${esc(type === "bld" ? eName("bld", x[k]) : x[k] || "")}" placeholder="${esc(ph)}"></label>`;
  const nm = x.n.trim().toLowerCase(), ppl = t === "bld" ? jbD.people.filter(p => (p.co || "").trim().toLowerCase() === nm || jbD.jobs.some(j => j.bld === x.id && (j.sup === p.id))) : [];
  const subs = t === "bld" ? jbD.subs.filter(s => s.bld === x.id) : [];
  return `<div class="set-btns jb-top"><button type="button" class="btn ghost" data-a="back">‹ Back</button></div>
  <div class="calc"><label for="ef-n" class="wide">${C.Title}<input id="ef-n" data-ef="n" type="text" autocomplete="off" value="${esc(x.n)}" placeholder="${C.ph}"></label>${C.fields.map(fld).join("")}</div>
  ${tel || web ? `<div class="jb-in"><div class="set-btns">${tel ? `<a class="btn" href="tel:${tel}">Call</a><a class="btn ghost" href="sms:${tel}">Text</a>` : ""}${web ? `<a class="btn ghost" href="${esc(/^https?:/i.test(web) ? web : "https://" + web)}" target="_blank" rel="noopener">Website</a>` : ""}</div></div>` : ""}
  ${t === "sub" ? `<p class="card-h">Subdivision icon <span class="jb-hint">every job here shows it, unless the job has its own</span></p><details class="explain jb-pickd"><summary>Icon: ${jbIco(x.icon)}${x.icon ? JB_ISO[x.icon][0] : "none"} · change</summary>${jbIcoPick(x.icon, "None")}</details>` : ""}
  ${t === "bld" ? `<p class="card-h">People · ${ppl.length}</p><div class="jb-list">${ppl.map(pRow).join("") || `<p class="note">Their supers and office people show up here: set a person's company to ${esc(x.n || "this builder")}, or make someone the super on one of their jobs.</p>`}</div>
  <p class="card-h">Subdivisions · ${subs.length}</p><div class="jb-list">${subs.map(s => eRow("sub", s)).join("") || `<p class="note">None yet. Pick this builder on a subdivision's page.</p>`}</div>` : ""}
  <p class="card-h">Jobs · ${jobs.length}</p>
  <div class="jb-list">${jbFew(jobs) || `<p class="note">No jobs yet. Pick ${esc(x.n || `this ${C.one}`)} on a job, or write [[${esc(x.n || "its name")}]] in a job's notes.</p>`}</div>
  ${jbMentionHtml(x.n)}
  <p class="card-h">Notes</p>
  ${jnBlock(x, x.log, t === "bld" ? "How they want things done. Who pays. - [ ] get the new super's number" : "Where the meters are, HOA rules, which lots are left")}
  <div class="set-btns jb-end"><button type="button" class="del" data-a="e-del">Delete this ${C.one}</button></div>`;
}
function jbDraw(){
  JB_IX = null; JN_CARDS = null;
  const body = $("jb-body"), ae = document.activeElement, had = !!ae && ae !== document.body && body.contains(ae);
  if (had) ae.blur();   /* a box removed while the keyboard is up never says so, and the bar floats: close it properly first */
  const en = eCur(), j = jbCur(), p = JB.person && pById(JB.person); if (JB.open && !j) JB.open = null; if (JB.person && !p) JB.person = null; if (JB.ent && !en) JB.ent = null;
  const dl = `<datalist id="jb-ppl">${jbD.people.map(x => `<option value="${esc(x.n)}">${esc(x.role)}</option>`).join("")}</datalist>`
    + ["bld", "sub"].map(t => `<datalist id="jb-${t}s">${eList(t).map(x => `<option value="${esc(x.n)}"></option>`).join("")}</datalist>`).join("");
  body.innerHTML = (en ? jbEntHtml(JB.ent.t, en) : p ? jbPersonHtml(p) : j ? jbJobHtml(j) : jbListHtml()) + dl;
  if (en){ if ($("ef-city")) $("ef-city").value = en.city || ""; }
  else if (p){}
  else if (j){ $("jb-city").value = j.city || ""; jfDraw(j.id); }
  else if (JB.view === "jobs"){ $("jb-goal").value = String(+jbD.goal === 6000 ? 6000 : 8000); jfUse(); }
  body.querySelectorAll(".card-h[data-fold]").forEach(h => { const f = !!jbD.fold[h.dataset.fold];
    h.classList.add("jb-fh"); h.classList.toggle("jb-folded", f); h.setAttribute("role", "button"); h.tabIndex = 0; h.setAttribute("aria-expanded", String(!f));
    for (let n = h.nextElementSibling; n && !n.matches(".card-h"); n = n.nextElementSibling) n.hidden = f; });
  bindPn(body);
  if (had) jbReseat();
}
const jbTouch = o => { o.t = Date.now(); jbSave(); jbDraw(); };
const jbTop = () => { const c = $("jobs-card"); if (c) c.scrollIntoView({block: "start"}); };
const jbOpenStage = () => { const o = $("jt-open"); if (o) o.scrollIntoView({block: "start"}); };
const jbState = () => ({open: JB.open, stage: JB.stage, person: JB.person, ent: JB.ent});
const jbPush = () => { if (JB.open || JB.person || JB.ent) JB.hist.push(jbState()); };
function jbOpenPerson(id){ JB.allJobs = false; jbPush(); JB.ent = null; JB.person = id; JB.edit = null; jbDraw(); jbTop(); }
function jbOpenEnt(t, id){ JB.allJobs = false; jbPush(); JB.person = null; JB.ent = {t, id}; JB.edit = null; jbDraw(); jbTop(); }
function jbGoBack(){ const b = JB.hist.pop() || {open: null, stage: null, person: null, ent: null}; Object.assign(JB, b); JB.edit = null; JB.ckEdit = false; jbSave(); jbDraw(); jbTop(); }
function jbBack(){
  const en = eCur(); if (en){ if (!en.n.trim() && !en.log.length && !eJobs(JB.ent.t, en).length) jbD[ENT[JB.ent.t].list] = eList(JB.ent.t).filter(x => x !== en); jbGoBack(); return; }   /* a new page left blank isn't kept */
  if (JB.person){ const p = pById(JB.person);
    if (p && !p.n.trim() && !p.log.length && !pJobs(p).length) jbD.people = jbD.people.filter(x => x !== p);
    jbGoBack(); return; }
  const j = jbCur();
  if (j && !(j.a || "").trim() && !(j.name || "").trim() && !j.who.trim() && !j.bld && !j.sub && !j.log.length && !j.draft.trim() && !j.insp.length && !j.hrs.length && !j.punch.length && !j.lead && !j.sup && !JF.n)
    jbD.jobs = jbD.jobs.filter(x => x !== j);   /* a new job left blank isn't kept */
  jbGoBack();
}
/* [[link]]: a person, another job by its address, else a card in the book by its title */
function jnGo(x){
  const per = pByName(x); if (per){ jbOpenPerson(per.id); return; }
  for (const t of ["bld", "sub"]){ const e = eByName(t, x); if (e){ jbOpenEnt(t, e.id); return; } }
  const q = x.trim().toLowerCase(), nm = j => [j.name, j.a].map(v => (v || "").trim().toLowerCase()).filter(Boolean);   /* by name or address */
  const job = jbD.jobs.find(j => nm(j).includes(q)) || jbD.jobs.find(j => nm(j).some(v => v.includes(q)));
  if (job){ jbPush(); JB.person = null; JB.ent = null; JB.open = job.id; JB.edit = null; JB.stage = null; JF.n = 0; jbDraw(); jbTop(); return; }
  const secs = SECTIONS.filter(s => s.dataset.sec !== "jobs" && s.querySelector("h2")), h = s => s.querySelector("h2").textContent.trim().toLowerCase();
  const sec = secs.find(s => h(s) === q) || secs.find(s => h(s).includes(q));
  if (sec) jumpToSec(sec);
  else if (jbAsk(`No person, builder, subdivision, job or card called "${x}". Make a page for a person named ${x}?`)){ const p = pGet(x, "Other"); jbSave(); jbOpenPerson(p.id); }
}
/* toolbar: put the markup in for you, at the cursor or at the start of the line */
let jnTa = null;
function jnInsert(k){
  const ta = jnTa && document.body.contains(jnTa) ? jnTa : $("jn-new"); if (!ta) return;
  const v = ta.value, s = ta.selectionStart ?? v.length, en = ta.selectionEnd ?? s, sel = v.slice(s, en); let nv, cs, ce;
  if (k === "**" || k === "[["){ const [p, q] = k === "**" ? ["**", "**"] : ["[[", "]]"]; nv = v.slice(0, s) + p + sel + q + v.slice(en); cs = s + p.length; ce = cs + sel.length; }
  else if (k === "@date" || k === "#"){ const x = k === "#" ? (s && !/\s/.test(v[s - 1]) ? " #" : "#") : (s && !/\s/.test(v[s - 1]) ? " @" : "@") + jbShort(Date.now()); nv = v.slice(0, s) + x + v.slice(en); cs = ce = s + x.length; }
  else if (k === "day"){ const x = "## Did\n- \n## Didn't, and why\n- \n## Next\n- [ ] ", pre = v && !v.endsWith("\n") ? "\n" : ""; nv = v + pre + x; cs = ce = v.length + pre.length + 9; }   /* cursor after the first "- " */
  else if (k === "@fact"){ const ls = v.lastIndexOf("\n", s - 1) + 1, x = "Label: "; nv = v.slice(0, ls) + x + v.slice(ls); cs = ls; ce = ls + 5; }   /* "Label" is selected: type over it */
  else { const ls = v.lastIndexOf("\n", s - 1) + 1; nv = v.slice(0, ls) + k + v.slice(ls); cs = s + k.length; ce = en + k.length; }
  ta.value = nv; ta.focus(); ta.setSelectionRange(cs, ce); ta.dispatchEvent(new Event("input", {bubbles: true}));
}

const B = $("jb-body");
B.addEventListener("focusin", e => { if (e.target.classList.contains("jn-ta")) jnTa = e.target; });
["pointerdown", "mousedown"].forEach(ev => B.addEventListener(ev, e => { if (e.target.closest("[data-ins]")) e.preventDefault(); }));   /* keep the keyboard up */
B.addEventListener("click", e => {
  const oi = e.target.closest("details[data-oi] > summary"); if (oi) JB.openItems = !oi.parentNode.open;   /* remember it open across redraws */
  const fh = e.target.closest(".card-h[data-fold]");
  if (fh && !e.target.closest("button, a, input, select, label")){ const k = fh.dataset.fold; if (jbD.fold[k]) delete jbD.fold[k]; else jbD.fold[k] = true; jbSave(); jbDraw(); return; }   /* fold or open a section; remembered */
  const tf = e.target.closest("[data-tfold]"); if (tf){ const k = tf.dataset.tfold; if (jbD.fold[k]) delete jbD.fold[k]; else jbD.fold[k] = true; jbSave(); jbDraw(); return; }
  const t = e.target.closest("[data-a],[data-open],[data-show],[data-view],[data-del],[data-v],[data-ins],[data-edit],[data-wl],[data-tag],[data-tagclr],[data-stage],[data-sst],[data-person],[data-pdel],[data-ckdel],[data-ent],[data-xadd],[data-xdel],[data-binr],[data-redit],[data-col],[data-tfold],[data-ico]"); if (!t) return;
  const j = jbCur(), o = jnOwner(), a = t.dataset.a, v = id => $(id).value.trim(), st = j && j.stages[JB.stage];
  if (t.dataset.ins){ jnInsert(t.dataset.ins); return; }
  if (t.dataset.wl){ jnGo(t.dataset.wl); return; }
  if (t.dataset.xadd && j){ const k = t.dataset.xadd; if (!j.xs.includes(k)) j.xs.push(k); JB.stage = k; JB.ckEdit = false; jbTouch(j); jbOpenStage(); return; }
  if (t.dataset.xdel && j){ const k = t.dataset.xdel; if (!jbAsk(`Take ${JB_SNAME[k]} off this job? Anything filled in stays saved and comes back if you add it again.`)) return;
    j.xs = j.xs.filter(x => x !== k); JB.stage = null; jbTouch(j); return; }
  if (t.dataset.ent){ const [et, id] = t.dataset.ent.split("|"); jbOpenEnt(et, id); return; }
  if (t.dataset.tag){ JB.tag = t.dataset.tag; JB.view = "jobs"; JB.show = "all"; JB.open = null; JB.person = null; JB.ent = null; JB.hist = []; JB.edit = null; jbDraw(); jbTop(); return; }
  if (t.dataset.tagclr){ JB.tag = null; jbDraw(); return; }
  if (t.dataset.view){ JB.view = t.dataset.view; jbDraw(); return; }
  if (t.dataset.person){ jbOpenPerson(t.dataset.person); return; }
  if (t.dataset.edit){ JB.edit = t.dataset.edit; jbDraw(); const ta = $("jn-ed"); if (ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } return; }
  if (t.dataset.open){ const os = t.dataset.ostage; JB.rowEdit = null; jbPush(); JB.person = null; JB.ent = null; JB.open = t.dataset.open; JB.edit = null; JB.stage = os || null; JF.n = 0; jbDraw(); if (os) jbOpenStage(); else jbTop(); return; }
  if (t.dataset.show){ JB.show = t.dataset.show; jbDraw(); return; }
  if (t.dataset.v){ jfView(t.dataset.v); return; }
  if (t.dataset.stage && j){ JB.stage = t.dataset.stage; JB.edit = null; JB.ckEdit = false; JB.rowEdit = null; jbDraw(); jbOpenStage(); return; }
  if (t.dataset.sst && st){ const val = t.dataset.sst; st.st = val;
    if (val === "doing" && !st.d0) st.d0 = jbDay();
    if (val === "done"){ if (!st.d1) st.d1 = jbDay(); if (!st.d0) st.d0 = st.d1;
      const S = jbStages(j), i = S.findIndex(([k]) => k === JB.stage), nx = S.slice(i + 1).find(([k]) => j.stages[k].st === "todo");
      if (nx){ const n = j.stages[nx[0]]; n.st = "doing"; if (!n.d0) n.d0 = jbDay(); toast(`${JB_SNAME[JB.stage]} done. ${JB_SNAME[nx[0]]} is next.`, 2400); JB.stage = nx[0]; jbTouch(j); jbOpenStage(); return; } }
    jbTouch(j); return; }
  if (t.dataset.pdel && j){ j.ppl = j.ppl.filter(x => x.id !== t.dataset.pdel); jbTouch(j); return; }
  if (t.dataset.ckdel && st){ const k = t.dataset.ckdel;
    if (k[0] === "t"){ const txt = jbTpl(JB.stage)[+k.slice(1)]; st.hide = [...new Set([...(st.hide || []), txt])]; }
    else st.extra = st.extra.filter(x => "x" + x.id !== k);
    jbTouch(j); return; }
  if (a === "ck-edit"){ JB.ckEdit = !JB.ckEdit; jbDraw(); jbOpenStage(); return; }
  if (a === "ck-save" && st){ const C = jbCk(j, JB.stage), list = C.items.map(x => x.t);
    jbD.tpl = Object.assign({}, jbD.tpl, {[JB.stage]: list});
    st.done = C.items.filter(x => x.done).map(x => x.t); st.hide = []; st.extra = [];   /* this job now runs on the saved list */
    JB.ckEdit = false; jbTouch(j); toast(`Saved. New jobs start ${JB_SNAME[JB.stage]} with these ${list.length} items.`, 2600); return; }
  if (a === "ck-book" && st){ if (!jbAsk(`Go back to the book's list for ${JB_SNAME[JB.stage]} on new jobs? Jobs you already have keep what they show now.`)) return;
    const book = JB_TPL[JB.stage](), bs = new Set(book);
    jbD.jobs.forEach(x => { const s2 = x.stages[JB.stage], have = jbCk(x, JB.stage).items;
      s2.extra = have.filter(y => !bs.has(y.t)).map(y => ({id: jbId(), t: y.t, done: y.done})); s2.hide = book.filter(b => !have.some(y => y.t === b)); s2.done = have.filter(y => y.done).map(y => y.t); });
    delete jbD.tpl[JB.stage]; JB.ckEdit = false; jbTouch(j); toast("Back to the book's list for new jobs.", 2200); return; }
  if (a === "back"){ JB.allJobs = false; JB.rowEdit = null; JB.colOpen = false; jbBack(); return; }
  if (t.dataset.ico != null){ const v = JB_ICONS.includes(t.dataset.ico) ? t.dataset.ico : "", en2 = eCur(), jj = jbCur();
    if (en2 && JB.ent.t === "sub"){ en2.icon = v; jbTouch(en2); } else if (jj){ jj.icon = v; jbTouch(jj); } return; }
  if (t.dataset.binr){ jbBinRestore(t.dataset.binr); return; }
  if (t.dataset.col != null){ const [what, which, c] = t.dataset.col.split("|");
    if (what === "job"){ const jj = jbD.jobs.find(x => x.id === which); if (jj) jj.color = c; }
    else { const o = what === "stage" ? jbD.stageCol : jbD.tagCol; if (c) o[which] = c; else delete o[which]; JB.colOpen = true; }
    jbSave(); jbApplyColors(); jbDraw(); return; }
  if (a === "row-cancel"){ JB.rowEdit = null; jbDraw(); return; }
  if (t.dataset.redit){ JB.rowEdit = t.dataset.redit; jbDraw(); const f = document.querySelector("#re-t, #re-h, #re-who"); if (f) f.focus(); return; }
  if (a === "bin-empty"){ if (!jbAsk(`Delete the ${jbD.bin.length} item${jbD.bin.length === 1 ? "" : "s"} in Recently deleted for good? This can't be undone.`)) return; jbBinPurge(true); jbDraw(); toast("Emptied.", 1600); return; }
  if (a === "bk-all"){ JF.sayId = "jf-say"; jbBackupAll(); return; }
  if (a === "bk-share"){ jbShareReady(false); return; }
  if (a === "all-jobs"){ JB.allJobs = true; jbDraw(); return; }
  if (a === "new"){ jbNew(); JF.n = 0; jbDraw(); jbTop(); $("jb-n").focus(); return; }
  if (a === "e-new"){ const x = eGet(JB.view, "\u200b"); x.n = ""; jbSave(); JB.open = null; jbOpenEnt(JB.view, x.id); $("ef-n").focus(); return; }
  if (a === "e-del" && JB.ent){ const {t: et} = JB.ent, x = eCur(); if (!x || !jbAsk(`Delete ${x.n || "this " + ENT[et].one}? It goes to Recently deleted for 30 days.`)) return;
    const links = jbD.jobs.filter(j => j[et] === x.id).map(j => [j.id, et]).concat(et === "bld" ? jbD.subs.filter(s => s.bld === x.id).map(s => ["sub:" + s.id, "bld"]) : []);
    jbBin(et, x, {links});
    jbD[ENT[et].list] = eList(et).filter(y => y !== x); jbD.jobs.forEach(j => { if (j[et] === x.id) j[et] = ""; }); if (et === "bld") jbD.subs.forEach(s => { if (s.bld === x.id) s.bld = ""; });
    jbGoBack(); return; }
  if (a === "p-new"){ const p = {id: jbId(), n: "", role: "Other", co: "", ph: "", em: "", log: [], draft: "", t: Date.now()}; jbD.people.push(p); jbSave(); JB.open = null; jbOpenPerson(p.id); $("pp-n").focus(); return; }
  if (a === "p-del" && JB.person){ const p = pById(JB.person); if (!p || !jbAsk(`Delete ${p.n || "this person"}? They go to Recently deleted for 30 days.`)) return;
    const links = []; jbD.jobs.forEach(x => { if (x.lead === p.id) links.push([x.id, "lead"]); if (x.sup === p.id) links.push([x.id, "sup"]);
      x.ppl.filter(y => y.p === p.id).forEach(y => links.push([x.id, "ppl", y])); JB_STG.forEach(([k]) => { if (x.stages[k].lead === p.id) links.push([x.id, "stage", k]); }); });
    jbBin("person", p, {links});
    jbD.people = jbD.people.filter(x => x !== p);
    jbD.jobs.forEach(x => { if (x.lead === p.id) x.lead = ""; if (x.sup === p.id) x.sup = ""; x.ppl = x.ppl.filter(y => y.p !== p.id); JB_STG.forEach(([k]) => { if (x.stages[k].lead === p.id) x.stages[k].lead = ""; }); });
    jbGoBack(); return; }
  if (a === "jn-add" && o){ const b = $("jn-new").value.trim(); if (!b){ toast("Write the note first."); return; }
    o.log.push(Object.assign({id: jbId(), d: $("jn-d").value || jbDay(), at: Date.now(), b}, (JB.person || JB.ent) ? {} : {s: JB.stage})); o.draft = ""; jnTa = null; jbTouch(o); toast("Note added.", 1600); return; }
  if (a === "jn-save" && o){ const n = o.log.find(x => x.id === JB.edit); if (n){ n.b = $("jn-ed").value.trim() || n.b; n.d = $("jn-ed-d").value || n.d; n.ed = Date.now(); } JB.edit = null; jnTa = null; jbTouch(o); return; }
  if (a === "jn-cancel"){ JB.edit = null; jnTa = null; jbDraw(); return; }
  if (a === "jn-del" && o){ if (!jbAsk("Delete this note? It goes to Recently deleted for 30 days.")) return;
    const n = o.log.find(x => x.id === JB.edit); if (n) jbBin("note", n, {owner: JB.ent ? JB.ent.t : JB.person ? "person" : "job", oid: o.id});
    o.log = o.log.filter(x => x.id !== JB.edit); JB.edit = null; jnTa = null; jbTouch(o); return; }
  if (t.dataset.del && j){ const [k, id] = t.dataset.del.split("|");
    if (k !== "punch" && !jbAsk(k === "hrs" ? "Delete these hours?" : "Delete this inspection?")) return;
    j[k] = j[k].filter(x => x.id !== id); jbTouch(j); return; }
  if (!j) return;
  if (a === "row-save" && JB.rowEdit){ const [k, id] = JB.rowEdit.split("|"), val = x => (($(x) || {}).value || "").trim();
    if (k === "insp"){ const i = j.insp.find(x => x.id === id); if (i){ i.d = val("re-d") || i.d; i.r = JB_RES[val("re-r")] ? val("re-r") : i.r; i.who = val("re-who"); i.n = val("re-n"); if (i.who) pGet(i.who, "Inspector"); } }
    else if (k === "hrs"){ const h = j.hrs.find(x => x.id === id), n = parseFloat(val("re-h")); if (h){ if (!(n > 0 && n <= 24)){ toast("Hours: more than 0, up to 24."); return; } h.h = Math.round(n * 100) / 100; h.d = val("re-d") || h.d; h.n = val("re-n"); } }
    else if (k === "punch"){ const p = j.punch.find(x => x.id === id); if (p && val("re-t")) p.t = val("re-t"); }
    else if (k === "ck"){ const x = st && st.extra.find(y => y.id === id); if (x && val("re-t")) x.t = val("re-t"); }
    JB.rowEdit = null; jbTouch(j); toast("Saved.", 1400); return; }

  if (a === "job-done"){ j.st = "done"; jbTouch(j); toast("Job marked Done. It's under <b>Done</b> in the list.", 2400); return; }
  if (a === "pin"){ j.pin = !j.pin; jbTouch(j); toast(j.pin ? "Pinned to the top of the list." : "Unpinned.", 1600); return; }
  if (a === "ck-add" && st){ const x = v("jc-t"); if (!x) return; st.extra.push({id: jbId(), t: x, done: false}); jbTouch(j); $("jc-t").focus(); }
  else if (a === "insp-add"){ const d = v("ji-d"); if (!d){ toast("Pick a date."); return; }
    const who = v("ji-who"); if (who) pGet(who, "Inspector");
    j.insp.push({id: jbId(), d, s: JB.stage, k: JB_SNAME[JB.stage], r: $("ji-r").value, who, n: v("ji-n")}); jbTouch(j); toast("Inspection added.", 1800); }
  else if (a === "hrs-add"){ const h = parseFloat($("jh-h").value), d = v("jh-d");
    if (!(h > 0 && h <= 24) || !d){ toast("Enter the date and the hours (more than 0, up to 24)."); return; }
    j.hrs.push({id: jbId(), d, s: JB.stage, h: Math.round(h * 100) / 100, n: v("jh-n")}); jbTouch(j); toast(`${jbHr(h)} hr logged.`, 1800); }
  else if (a === "ppl-add"){ const p = pGet(v("jpo-n"), $("jpo-r").value); if (!p){ toast("Type their name."); return; }
    if (!j.ppl.some(x => x.p === p.id)) j.ppl.push({id: jbId(), r: $("jpo-r").value, p: p.id}); jbTouch(j); }
  else if (a === "punch-add"){ const x = v("jp-t"); if (!x) return; j.punch.push({id: jbId(), t: x, done: false, add: Date.now()}); jbTouch(j); $("jp-t").focus(); }
  else if (a === "punch-clear"){ j.punch = j.punch.filter(p => !p.done); jbTouch(j); }
  else if (a === "job-del"){
    if (!jbAsk(`Delete "${jbName(j)}"? It goes to Recently deleted for 30 days, photos and all, then it's gone for good.`)) return;
    jbBin("job", j); jbD.jobs = jbD.jobs.filter(x => x !== j);   /* its photos stay until the bin is emptied */
    JB.open = null; jbSave(); jbDraw(); jbTop(); toast("Job moved to Recently deleted.", 2200); }
});
B.addEventListener("keydown", e => { if (e.key !== "Enter") return;
  if (e.target.matches(".card-h[data-fold]")){ e.preventDefault(); e.target.click(); return; } const btn = {"jp-t": "punch-add", "jc-t": "ck-add"}[e.target.id];
  if (btn){ e.preventDefault(); B.querySelector(`[data-a="${btn}"]`).click(); } });
B.addEventListener("input", e => { const t = e.target, j = jbCur(), p = JB.person && pById(JB.person), en = eCur();
  if (en && t.dataset.ef && t.tagName !== "SELECT" && t.dataset.ef !== "bld"){ en[t.dataset.ef] = t.value; en.t = Date.now(); clearTimeout(jbT); jbT = setTimeout(jbSave, 500); }
  if (j && t.dataset.f && t.tagName !== "SELECT"){ j[t.dataset.f] = t.value; j.t = Date.now(); clearTimeout(jbT); jbT = setTimeout(jbSave, 500); }
  if (p && t.dataset.pf && t.tagName !== "SELECT"){ p[t.dataset.pf] = t.value; p.t = Date.now(); clearTimeout(jbT); jbT = setTimeout(jbSave, 500); }
  if (t.id === "jb-q"){ JB.q = t.value; const r = $("jb-res"), m = $("jb-main"), fq = t.value.trim(); if (r) r.innerHTML = fq ? jbFindHtml(fq) : ""; if (m) m.hidden = !!fq; return; }
  if (t.id === "jn-try"){ const out = $("jn-tryout"); if (out) out.innerHTML = jnMd(t.value, "try"); return; }
  if (t.id === "jn-new"){ const pv = $("jn-prev"); if (pv){ pv.hidden = !t.value.trim(); pv.innerHTML = '<p class="jn-prevh">Preview: how it\'ll look</p>' + jnMd(t.value, "prev"); }
    const o = jnOwner(); if (o){ o.draft = t.value; clearTimeout(jbT); jbT = setTimeout(() => store.set("jpb-jobs", jbD), 500); } } });   /* a half-written note survives leaving the page */
B.addEventListener("change", e => { const t = e.target, j = jbCur(), p = JB.person && pById(JB.person), st = j && j.stages[JB.stage], en = eCur();
  if (en && t.dataset.ef){ const k = t.dataset.ef; if (k === "bld"){ const b = eGet("bld", t.value); en.bld = b ? b.id : ""; } else en[k] = t.value.trim(); if (k !== "n" || en.n) jbTouch(en); return; }
  if (j && t.dataset.je){ const k = t.dataset.je, x = eGet(k, t.value); j[k] = x ? x.id : "";
    if (k === "sub" && x){ if (!j.city && x.city) j.city = x.city; if (!j.bld && x.bld) j.bld = x.bld; }   /* a subdivision fills in its city and builder */
    jbTouch(j); return; }
  if (t.tagName === "SELECT" || /^(date|file)$/.test(t.type)) jbReseat();   /* a picker wheel or the photo sheet just closed */
  if (p && t.dataset.pf){ p[t.dataset.pf] = t.value.trim(); jbTouch(p); return; }
  if (t.dataset.tk){ const o = jnOwner(), [eid, i] = t.dataset.tk.split("|"), n = o && o.log.find(x => x.id === eid);
    if (n){ const L = n.b.split("\n"); L[+i] = /^\s*\?(\?|✓)/.test(L[+i]) ? L[+i].replace(/\?(\?|✓)/, m => m === "??" ? "?✓" : "??") : L[+i].replace(/\[( |x|X)\]/, m => m === "[ ]" ? "[x]" : "[ ]"); n.b = L.join("\n"); jbTouch(o); } return; }
  if (j && t.dataset.f){ if (t.tagName === "SELECT"){ j[t.dataset.f] = t.value; jbTouch(j); } else if (t.dataset.f === "a") jbTouch(j); else jbSave(); return; }   /* the address shows Directions */
  if (j && t.dataset.jp){ const per = pGet(t.value, t.dataset.jp === "lead" ? "Lead" : "Superintendent"); j[t.dataset.jp] = per ? per.id : ""; jbTouch(j); return; }
  if (st && t.dataset.sp){ const per = pGet(t.value, "Lead"); st.lead = per ? per.id : ""; jbTouch(j); return; }
  if (st && t.dataset.sf){ st[t.dataset.sf] = t.value; jbTouch(j); return; }
  if (st && t.dataset.ck){ const k = t.dataset.ck;
    if (k[0] === "t"){ const txt = jbTpl(JB.stage)[+k.slice(1)], s = new Set(st.done); t.checked ? s.add(txt) : s.delete(txt); st.done = [...s];
      st.doneAt = st.doneAt || {}; if (t.checked) st.doneAt[txt] = Date.now(); else delete st.doneAt[txt]; }
    else { const x = st.extra.find(y => "x" + y.id === k); if (x){ x.done = t.checked; x.at = t.checked ? Date.now() : undefined; } }
    jbTouch(j); return; }
  if (j && t.dataset.ir){ const i = j.insp.find(x => x.id === t.dataset.ir); if (i){ i.r = t.value; jbTouch(j); } return; }
  if (j && t.dataset.pk){ const x = j.punch.find(y => y.id === t.dataset.pk); if (x){ x.done = t.checked; x.at = t.checked ? Date.now() : undefined; jbTouch(j); } return; }
  if (t.id === "jb-goal"){ jbD.goal = +t.value; jbSave(); jbDraw(); return; }
  if (t.id === "jb-before"){ jbD.before = Math.max(0, parseFloat(t.value) || 0); jbSave(); jbDraw(); return; }
  if (t.id === "jf-ph" || t.id === "jf-fi"){ jfAdd([...t.files], t.id === "jf-ph"); return; }
  if (t.id === "jb-restore" && t.files[0]) jbRestoreAll(t.files[0]);
});

/* Home: MY JOBS box (homeDraw calls this) */
window.jobsHome = () => {
  const open = jbD.jobs.filter(j => j.st === "open").sort((a, b) => (b.pin - a.pin) || b.t - a.t).slice(0, 3), H = jbHours();
  return `<p class="card-h">My jobs <button type="button" class="linkish" data-hj="all">All</button></p>`
    + (open.length ? `<div class="jb-list">${open.map(j => jbRow(j, "data-hj")).join("")}</div>`
      : `<p class="note"><button type="button" class="linkish" data-hj="new">Add a job</button>: a timeline from Underground to Final, with the blanks ready to fill in.</p>`)
    + (H.wk ? `<p class="note">${jbHr(H.today)} hr today · ${jbHr(H.wk)} hr this week</p>` : "")
    + (() => { const now = jbDay(), wk = new Date(now + "T12:00:00"); wk.setDate(wk.getDate() + 7); const end = jbDay(wk);
        const up = jbD.jobs.filter(j => j.st !== "done").flatMap(j => j.log.flatMap(e => jnDates(e.b, e.d).map(([d, l]) => [d, l, j]))).filter(([d]) => d >= now && d <= end).sort((a, b) => a[0] < b[0] ? -1 : 1).slice(0, 4);
        return up.length ? `<p class="card-h">Coming up</p><ul class="jb-soon">${up.map(([d, l, j]) => `<li><button type="button" class="linkish" data-hj="${j.id}"><span class="jn-date${d === now ? " now" : ""}">📅 ${jbNice(d)}</span> <b>${esc(jbName(j))}</b> · ${esc(l.replace(JN_DATE, "$1").replace(/^\s*([-*+] \[[ xX]\]|\?\?|!!)\s*/, "").trim().slice(0, 60))}</button></li>`).join("")}</ul>` : ""; })()
    + (jbBkDue() ? `<button type="button" class="renew-line" data-hj="backup"><b>${+store.get("jpb-lastbk", 0) ? "Last backup " + jbAgo(+store.get("jpb-lastbk", 0)) : "No backup yet"}</b> · Back up now ›</button>` : "");
};
$("home-body").addEventListener("click", e => { const b = e.target.closest("[data-hj]"); if (!b) return; const k = b.dataset.hj;
  JF.n = 0; JB.edit = null; JB.person = null; JB.ent = null; JB.hist = []; JB.stage = null; JB.view = "jobs";
  if (k === "backup"){ JB.open = null; go("mine", "jobs"); jbDraw(); const h = $("jb-bk"); if (h) h.scrollIntoView({block: "start"}); JF.sayId = "jf-say"; jbBackupAll(); return; }
  if (k === "new") jbNew(); else JB.open = k === "all" ? null : k;
  go("mine", "jobs"); jbDraw(); jbTop(); });

/* ---- photos & files: IndexedDB */
let jfDbP = null;
const jfDb = () => jfDbP || (jfDbP = new Promise((ok, no) => {
  const r = indexedDB.open("jpb-files", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("files", {keyPath: "id"}).createIndex("job", "job");
  r.onsuccess = () => ok(r.result); r.onerror = () => { jfDbP = null; no(r.error); };
}));
const jfTx = (mode, fn) => jfDb().then(db => new Promise((ok, no) => {
  const t = db.transaction("files", mode), r = fn(t.objectStore("files")); let out;
  if (r) r.onsuccess = () => { out = r.result; };
  t.oncomplete = () => ok(out); t.onerror = () => no(t.error); t.onabort = () => no(t.error);
}));
const jfAll = job => jfTx("readonly", s => job ? s.index("job").getAll(job) : s.getAll());
const jfPut = rec => jfTx("readwrite", s => s.put(rec));
const jfDel = id => jfTx("readwrite", s => s.delete(id));

async function jfDraw(job){
  let L; try { L = await jfAll(job); } catch(e){ const p = $("jf-photos"); if (p) p.innerHTML = `<p class="note">This browser won't store photos here.</p>`; return; }
  const j = jbCur(); if (!j || JB.open !== job || JB.person || JB.ent) return;
  L.sort((a, b) => a.t - b.t); JF.n = L.length;
  for (const f of L) if (f.kind === "photo" && !f.s){ f.s = jbStageNow(j); jfPut(f).catch(() => {}); }   /* photos from before stages */
  const P = L.filter(f => f.kind === "photo" && f.s === JB.stage), F = L.filter(f => f.kind !== "photo");
  const ph = $("jf-photos"), fi = $("jf-files");
  if (ph) ph.innerHTML = P.map(f => `<button type="button" class="jf-th" data-v="${f.id}" aria-label="Photo${f.note ? ": " + esc(f.note) : ""}">${f.thumb ? `<img src="${f.thumb}" alt="">` : "<b>Photo</b>"}${f.note ? `<span>${esc(f.note)}</span>` : ""}</button>`).join("")
    || `<p class="note">None yet. Stub-outs before drywall, the test gauge, what the inspector flagged.</p>`;
  if (fi) fi.innerHTML = F.map(f => `<button type="button" class="jb-row" data-v="${f.id}"><b>${esc(f.name)}</b><span>${jfMB(f.blob.size)}${f.note ? " · " + esc(f.note) : ""}</span></button>`).join("")
    || `<p class="note">None yet. Plans, the permit, spec sheets.</p>`;
}
function jfUse(){
  jfAll().then(L => { const u = $("jf-use"); if (!u) return; const s = L.reduce((n, f) => n + (f.blob ? f.blob.size : 0), 0);
    u.textContent = L.length ? `On this phone: ${L.length} photo${L.length === 1 ? "" : "s"} and file${L.length === 1 ? "" : "s"}, about ${jfMB(s)}. They're in the backup too.` : ""; }).catch(() => {});
}
/* one decode, two JPEGs: about 1600 px for the record, 240 px for the grid. The browser applies the phone's rotation. */
async function jfImg(file){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("decode")); i.src = url; });
    const draw = (max, q) => new Promise((ok, no) => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? ok(b) : no(new Error("encode")), "image/jpeg", q); });
    const big = await draw(1600, .82), small = await draw(240, .7);
    const thumb = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(small); });
    return {big, thumb};
  } finally { URL.revokeObjectURL(url); }
}
async function jfAdd(files, photos){
  const j = jbCur(); if (!j || !files.length) return;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e){}   /* ask the phone not to clear them */
  toast(`Saving ${files.length}…`, 9000);
  let n = 0, bad = 0;
  for (const f of files){
    try {
      const img = photos && /^image\//.test(f.type); let blob = f, thumb = "", type = f.type || "application/octet-stream";
      if (img){ try { const x = await jfImg(f); blob = x.big; thumb = x.thumb; type = "image/jpeg"; } catch(e){} }
      await jfPut(Object.assign({id: jbId(), job: j.id, kind: img ? "photo" : "file", name: f.name || (img ? "photo.jpg" : "file"), type, blob, thumb, note: "", t: Date.now()}, img ? {s: JB.stage} : {})); n++;
    } catch(e){ bad++; }
  }
  toast(bad ? `Saved ${n}. ${bad} couldn't be saved: the phone may be out of space.` : `Saved ${n}.`, 2400);
  j.t = Date.now(); jbSave(); jfDraw(j.id); jbReseat();
  const inp = $(photos ? "jf-ph" : "jf-fi"); if (inp) inp.value = "";
}
async function jfView(id){
  const f = await jfTx("readonly", s => s.get(id)).catch(() => null); if (!f) return;
  JF.cur = f; if (JF.url) URL.revokeObjectURL(JF.url); JF.url = URL.createObjectURL(f.blob);
  $("jf-dlg-body").innerHTML = f.kind === "photo" ? `<img src="${JF.url}" alt="Job photo">` : `<p class="jf-fname"><b>${esc(f.name)}</b><br>${jfMB(f.blob.size)}</p>`;
  $("jf-note").value = f.note || ""; $("jf-dlg").showModal();
}
$("jf-note").addEventListener("input", () => { if (!JF.cur) return; JF.cur.note = $("jf-note").value; clearTimeout(jfNT); jfNT = setTimeout(() => jfPut(JF.cur).catch(() => {}), 400); });
$("jf-close").addEventListener("click", () => $("jf-dlg").close());
$("jf-dlg").addEventListener("close", () => { const c = JF.cur; JF.cur = null; clearTimeout(jfNT); jbReseat();
  if (c) jfPut(c).catch(() => {}).then(() => { if (JB.open === c.job) jfDraw(c.job); }); });
$("jf-open").addEventListener("click", () => { if (!JF.url) return; const a = document.createElement("a"); a.href = JF.url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); });
$("jf-share").addEventListener("click", async () => { const c = JF.cur; if (!c) return;
  const f = new File([c.blob], c.kind === "photo" ? c.name.replace(/\.[^.]*$/, "") + ".jpg" : c.name, {type: c.type});
  try { if (navigator.canShare && navigator.canShare({files: [f]})){ await navigator.share({files: [f]}); return; } } catch(e){ if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = JF.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); });
$("jf-del").addEventListener("click", async () => { const c = JF.cur; if (!c || !jbAsk(`Delete this ${c.kind === "photo" ? "photo" : "file"}?`)) return;
  JF.cur = null; await jfDel(c.id).catch(() => {}); $("jf-dlg").close(); jfDraw(c.job); });

/* ---- photos & files backup: a plain (stored, not compressed) zip with manifest.json; JPEGs and PDFs don't shrink anyway */
const JF_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const jfCrc = u => { let c = -1; for (let i = 0; i < u.length; i++) c = JF_CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
async function jfZip(list){
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  for (const e of list){
    const nm = enc.encode(e.name), data = new Uint8Array(await e.blob.arrayBuffer()), crc = jfCrc(data), sz = data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
    parts.push(h.buffer, nm, e.blob);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cd.push(c.buffer, nm); off += 30 + nm.length + sz;
  }
  const cs = cd.reduce((n, p) => n + p.byteLength, 0), z = new DataView(new ArrayBuffer(22));
  z.setUint32(0, 0x06054b50, true); z.setUint16(8, list.length, true); z.setUint16(10, list.length, true); z.setUint32(12, cs, true); z.setUint32(16, off, true);
  return new Blob([...parts, ...cd, z.buffer], {type: "application/zip"});
}
function jfUnzip(buf){
  const v = new DataView(buf), u = new Uint8Array(buf), dec = new TextDecoder(), out = {};
  let e = buf.byteLength - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error("not a zip");
  let p = v.getUint32(e + 16, true);
  for (let i = 0, n = v.getUint16(e + 10, true); i < n; i++){
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip");
    const meth = v.getUint16(p + 10, true), sz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = dec.decode(u.subarray(p + 46, p + 46 + nl)), s = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
    if (meth === 0) out[name] = u.subarray(s, s + sz);
    p += 46 + nl + xl + cl;
  }
  return out;
}
/* ---- Backup: one file with everything. handbook-backup.json is the same as Settings → Download backup (every jpb- item:
   jobs, people, notes, pins, settings); manifest.json + files/ are the photos and files. The Share sheet saves it to iCloud
   Drive or Files; where there's no Share sheet it downloads. */
const jbAgo = ts => { const d = Math.floor((Date.now() - ts) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };
const jbBkDue = () => { if (!jbD.jobs.length) return false; const lb = +store.get("jpb-lastbk", 0); return !lb || Date.now() - lb > 7 * 864e5 || +store.get("jpb-chg", 0) >= 40; };
const jbLastBk = () => { const lb = +store.get("jpb-lastbk", 0);
  return (lb ? `Last backup: <b>${jbAgo(lb)}</b>. ` : "<b>No backup yet.</b> ") + "One file with your jobs, people, notes, settings, photos and files. Save it to iCloud Drive or Files so it's off this phone: deleting the app from the Home Screen deletes everything in it."; };
async function jfPack(){
  let L = []; try { L = await jfAll(); } catch(e){}
  const man = L.map(f => ({id: f.id, job: f.job, s: f.s, jobName: (j0 => j0 ? jbName(j0) : "")(jbD.jobs.find(x => x.id === f.job)), kind: f.kind, name: f.name, type: f.type, note: f.note, t: f.t, thumb: f.thumb,
    path: `files/${f.id}-${String(f.name).replace(/[^\w.\- ]+/g, "_").slice(-60)}`}));
  const zip = await jfZip([{name: "handbook-backup.json", blob: new Blob([bkDump()], {type: "application/json"})},
    {name: "manifest.json", blob: new Blob([JSON.stringify({app: "utah-plumbers-handbook-files", v: 1, made: new Date().toISOString(), files: man})])},
    ...L.map((f, i) => ({name: man[i].path, blob: f.blob}))]);
  return {zip, n: L.length};
}
async function jbBackupAll(){
  jbSave(); jfSay("Packing your backup…");
  try { const {zip, n} = await jfPack(); JF.ready = new File([zip], `handbook-backup-${jbDay()}.zip`, {type: "application/zip"}); JF.readyN = n; await jbShareReady(true); }
  catch(e){ jfSay("Couldn't make the backup: " + (e && e.message || e), "err"); }
}
window.jbBackupAll = () => { JF.sayId = "bk-status"; jbBackupAll(); };   /* Settings → Backup uses it too */
async function jbShareReady(first){
  const f = JF.ready; if (!f) return;
  const done = how => { store.set("jpb-lastbk", Date.now()); store.set("jpb-chg", 0); JF.ready = null; const nj = jbD.jobs.length;
    jfSay(`Backed up ${nj} job${nj === 1 ? "" : "s"}${JF.readyN ? ` and ${JF.readyN} photos & files` : ""} (${jfMB(f.size)}). ${how}`, "good"); try { homeDraw(); } catch(e){} jbReseat(); };
  if (navigator.canShare && navigator.canShare({files: [f]})){
    try { await navigator.share({files: [f]}); done("Keep it in iCloud Drive or Files."); return; }
    catch(e){
      if (e && e.name === "AbortError"){ jfSay("Not saved yet: tap Back up everything when you're ready."); jbReseat(); return; }
      if (first && e && e.name === "NotAllowedError"){   /* packing took long enough that iOS wants a fresh tap */
        const s = $(JF.sayId || "jf-say"); if (s){ s.className = s.id === "bk-status" ? "status" : "note"; s.innerHTML = `Backup ready (${jfMB(f.size)}). <button type="button" class="btn" data-a="bk-share">Save it</button>`;
          const b = s.querySelector("[data-a=bk-share]"); if (b && s.id === "bk-status") b.addEventListener("click", () => jbShareReady(false)); }
        return; } } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  done("It's in Downloads: move it to iCloud Drive so it's off this phone.");
}
async function jfRestoreZ(z){
  const m = JSON.parse(new TextDecoder().decode(z["manifest.json"])); if (!m || m.app !== "utah-plumbers-handbook-files" || !Array.isArray(m.files)) return 0;
  let n = 0;
  for (const f of m.files){ const x = z[f.path]; if (!x) continue;
    await jfPut(Object.assign({id: f.id, job: f.job, kind: f.kind, name: f.name, type: f.type, blob: new Blob([x], {type: f.type}), thumb: f.thumb || "", note: f.note || "", t: f.t || Date.now()}, f.s ? {s: f.s} : {})); n++; }
  return n;
}
/* takes the new all-in-one .zip, an older photos-only .zip, or a Settings .json backup */
async function jbRestoreAll(file){
  JF.sayId = "jf-say";
  try {
    const buf = await file.arrayBuffer(), u8 = new Uint8Array(buf), dec = new TextDecoder(); let data = null, z = null;
    if (u8[0] === 0x50 && u8[1] === 0x4b){ z = jfUnzip(buf); if (z["handbook-backup.json"]) data = JSON.parse(dec.decode(z["handbook-backup.json"])); }
    else data = JSON.parse(dec.decode(u8));
    const d = data && data.data, keys = d && typeof d === "object" ? Object.keys(d).filter(k => k.startsWith("jpb-") && typeof d[k] === "string") : [];
    const photos = z && z["manifest.json"] ? ((JSON.parse(dec.decode(z["manifest.json"])) || {}).files || []).length : 0;
    if (!keys.length && !photos) throw 0;
    let n = 0; try { n = JSON.parse(d["jpb-jobs"] || "{}").jobs.length || 0; } catch(e){}
    const when = data && data.saved ? " from " + new Date(data.saved).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"}) : "";
    if (!jbAsk(keys.length ? `Replace everything on this phone with the backup${when}? It has ${n} job${n === 1 ? "" : "s"}${photos ? ` and ${photos} photos & files` : ""}. Anything added since then will be gone.`
      : `Add the ${photos} photos & files from this backup?`)){ const r = $("jb-restore"); if (r) r.value = ""; return; }
    if (z && photos) await jfRestoreZ(z);
    if (keys.length){ keys.forEach(k => localStorage.setItem(k, d[k])); jfSay("Restored. Reloading…", "good"); setTimeout(() => location.reload(), 900); }
    else { jfSay(`Restored ${photos} photos & files.`, "good"); jfUse(); }
  } catch(e){ jfSay("That isn't a backup from this app.", "err"); }
  const r = $("jb-restore"); if (r) r.value = "";
}

/* ---- Recently deleted: jobs, people, builders, subdivisions and notes wait 30 days before they're gone */
const JB_BIN_DAYS = 30, JB_BIN_NAME = {job: "Job", person: "Person", bld: "Builder", sub: "Subdivision", note: "Note"};
function jbBin(kind, item, extra){ jbD.bin.unshift(Object.assign({id: jbId(), kind, at: Date.now(), item: JSON.parse(JSON.stringify(item))}, extra || {})); }
const jbBinName = b => b.kind === "job" ? jbName(b.item) : b.kind === "note" ? String(b.item.b || "").split("\n").map(x => x.replace(/^[\s#>*!\-\[\]xX]+/, "").trim()).find(Boolean) || "Note" : (b.item.n || "No name");
function jbBinPurge(all){
  const cut = Date.now() - JB_BIN_DAYS * 864e5, gone = jbD.bin.filter(b => all || b.at < cut); if (!gone.length) return 0;
  jbD.bin = jbD.bin.filter(b => !gone.includes(b));
  gone.filter(b => b.kind === "job").forEach(b => jfAll(b.item.id).then(L => Promise.all(L.map(f => jfDel(f.id)))).catch(() => {}));   /* now its photos go */
  jbSave(); return gone.length;
}
function jbBinRestore(id){
  const b = jbD.bin.find(x => x.id === id); if (!b) return; const it = b.item;
  if (b.kind === "job"){ if (jbD.jobs.some(j => j.id === it.id)) it.id = jbId(); jbFix(it); jbD.jobs.push(it); }
  else if (b.kind === "person"){ jbD.people.push(it);
    (b.links || []).forEach(([jid, f, x]) => { const j = jbD.jobs.find(y => y.id === jid); if (!j) return;
      if (f === "lead" || f === "sup"){ if (!j[f]) j[f] = it.id; } else if (f === "ppl"){ if (!j.ppl.some(y => y.p === it.id)) j.ppl.push(x); } else if (f === "stage" && j.stages[x] && !j.stages[x].lead) j.stages[x].lead = it.id; }); }
  else if (b.kind === "bld" || b.kind === "sub"){ eList(b.kind).push(it);
    (b.links || []).forEach(([jid, f]) => { if (jid.startsWith("sub:")){ const sb = jbD.subs.find(y => y.id === jid.slice(4)); if (sb && !sb.bld) sb.bld = it.id; } else { const j = jbD.jobs.find(y => y.id === jid); if (j && !j[f]) j[f] = it.id; } }); }
  else if (b.kind === "note"){ const o = b.owner === "job" ? jbD.jobs.find(j => j.id === b.oid) : b.owner === "person" ? pById(b.oid) : eById(b.owner, b.oid);
    if (!o){ toast("The job or page it was on is gone. Restore that first, then this note."); return; } o.log.push(it); }
  jbD.bin = jbD.bin.filter(x => x !== b); jbSave(); jbDraw(); toast(`${JB_BIN_NAME[b.kind]} restored.`, 2000);
}
const jbBinHtml = () => !jbD.bin.length ? "" : `<details class="explain"><summary>Recently deleted · ${jbD.bin.length}</summary><div>
  <div class="jb-list">${jbD.bin.map(b => { const d = Math.max(0, JB_BIN_DAYS - Math.floor((Date.now() - b.at) / 864e5));
    return `<div class="jp-row"><div class="jb-row jb-binrow"><b>${esc(jbBinName(b))}</b><span>${JB_BIN_NAME[b.kind]} · gone for good in ${d} day${d === 1 ? "" : "s"}</span></div><button type="button" class="btn ghost jp-call" data-binr="${b.id}">Restore</button></div>`; }).join("")}</div>
  <div class="set-btns jb-top"><button type="button" class="del" data-a="bin-empty">Empty now</button></div></div></details>`;

jbApplyColors();
jbBinPurge(false);   /* past 30 days: gone for good */
jbDraw(); try { homeDraw(); } catch(e){}
} catch(e){ const b = document.getElementById("jb-body"); if (b){ b.innerHTML = '<p class="note flag">My jobs hit an error: ' + String(e && e.message || e).replace(/</g, "&lt;") + '. Your jobs are still saved on this phone. Download them so they\'re safe, then send the file and this message to Deklan.</p><div class="set-btns jb-top"><button type="button" class="btn" id="jb-rescue">Download my jobs data</button></div>';
  const r = document.getElementById("jb-rescue"); if (r) r.addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([localStorage.getItem("jpb-jobs") || ""], {type: "application/json"})); a.download = "handbook-jobs-rescue.json"; document.body.appendChild(a); a.click(); a.remove(); }); } if (window.console) console.error(e); }
