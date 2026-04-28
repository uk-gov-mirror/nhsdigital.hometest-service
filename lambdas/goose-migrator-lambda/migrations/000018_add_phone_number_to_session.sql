-- +goose Up
ALTER TABLE session
ADD COLUMN IF NOT EXISTS phone_number varchar(20);

UPDATE session
SET phone_number = ''
WHERE phone_number IS NULL;

ALTER TABLE session
ALTER COLUMN phone_number SET NOT NULL;
-- +goose Down
ALTER TABLE session
DROP COLUMN IF EXISTS phone_number;
