# YZ-RD-T102 student web improvement scope

This list preserves the Sep 8 page hierarchy and interaction model. It targets
state clarity and data stability; it does not replace pages with a new template.

1. **Today course catalog state** — distinguish a failed catalog request from a
   successful empty catalog, keep Today visible when only the catalog request
   fails, provide a retry and course-center route, and clear the loading
   announcement when the page reaches either ready or error state.
2. **Course detail optional data** — let the course, activity route, player,
   and practice entry remain available when recommendations or dashboard
   statistics fail. Show unavailable states and leave absent metrics unknown.
3. **Growth data truthfulness** — retain the existing React page structure;
   replace its fixture loader with current-school/current-enrollment API reads,
   display only complete linked reports and released feedback, and use the
   existing practice route for the next action.
4. **Growth media evidence** — show audio only when the current student's
   recording archive returns a completed recording linked to that student's
   completed session and the server returns its authorized download URL.
5. **Course video progress** — persist the normalized 0–1 playback position
   required by the server contract while keeping course, submission, and
   activity IDs attached to the progress write.

No palette, card system, or page layout restyling is in this checkpoint. The
remaining visual review requires an authorized browser session and is recorded
as `NOT_RUN` when unavailable.
