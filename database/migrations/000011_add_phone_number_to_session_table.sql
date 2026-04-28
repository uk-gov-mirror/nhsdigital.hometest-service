-- +goose Up
-- Preview sessions are short-lived; invalidate existing rows so the new mandatory field can be added safely.
DELETE FROM session;

ALTER TABLE session
ADD COLUMN IF NOT EXISTS phone_number varchar(20) NOT NULL;


-- +goose Down
ALTER TABLE session
DROP COLUMN IF EXISTS phone_number;
