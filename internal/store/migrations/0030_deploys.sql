-- The deploys of a board: whether the user turned them on, and, for each
-- repository of the board whose deploys the app manages, its environments in
-- order. A repository that leaves the board loses its row (store.applyLinks and
-- store.applyReleases delete it); a board removed takes both with it.
CREATE TABLE board_deploys (
    board_id TEXT PRIMARY KEY REFERENCES boards (id) ON DELETE CASCADE,
    enabled  INTEGER NOT NULL DEFAULT 0   -- 1 when the board shows in Deploys
) STRICT;

CREATE TABLE deploy_repositories (
    repository_id TEXT PRIMARY KEY REFERENCES repositories (id) ON DELETE CASCADE,
    board_id      TEXT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    environments  TEXT NOT NULL   -- JSON []deploys.Environment, in order; two at least
) STRICT;

CREATE INDEX deploy_repositories_board ON deploy_repositories (board_id);
