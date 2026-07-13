# Route live-binding map

| Route family | Executable backend path | CP state | Notes |
|---|---|---|---|
| login/session | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/me` | CP1 live | access token held in memory; one refresh retry |
| school selection | `/me`, `/auth/select-school` | CP1 live | membership checked before write and re-read after token rotation |
| curriculum | `/schools/:schoolId/course-versions` | pending CP2 | list/create/update are implemented; publish controller uses `:versionId:publish` |
| classes | `/schools/:schoolId/classes` | pending CP2 | controller update is POST, not documented PATCH |
| assignments | `/schools/:schoolId/assignments` | pending CP2 | controller update is POST; open/close are POST |
| student learning | `/schools/:schoolId/learning/tasks` | pending CP3 | readiness docs currently say `/learning/today` |
| activity progress | `/schools/:schoolId/learning/activities/:activityId/progress` | pending CP3 | executable write is PUT, not documented POST |
| submissions/feedback | `/schools/:schoolId/submissions`, assignment submissions, feedback | pending CP3 | write success must be response-confirmed |
| plans | `/plans` | pending CP5 | real HTTP 200 empty collection is valid |
| admin/research | `/admin/*`, `/research/*` | pending CP5 | real HTTP 503 gap must remain visible |