-- saved_statuses is the options of the Status field as the user last saved the
-- board: JSON []board.Option, the shape of Reading.statuses; '' before a save.
-- The edit of a board compares a new reading with it to say what is gone and
-- what is new. A board saved before it existed gets the options of its last
-- good reading, which may miss a change but never invents one; a board never
-- read gets none until its next save. json_valid keeps an empty or broken
-- reading from failing the migration, which would fail the startup.
ALTER TABLE boards ADD COLUMN saved_statuses TEXT NOT NULL DEFAULT '';

UPDATE boards SET saved_statuses = coalesce((
    SELECT CASE WHEN json_valid(reading) THEN coalesce(json_extract(reading, '$.statuses'), '') ELSE '' END
    FROM board_readings WHERE board_readings.board_id = boards.id
), '');
