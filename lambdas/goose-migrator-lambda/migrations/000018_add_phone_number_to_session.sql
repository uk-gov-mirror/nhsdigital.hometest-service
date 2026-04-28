-- +goose Up
ALTER TABLE session
ADD COLUMN IF NOT EXISTS phone_number varchar(20) NOT NULL;


-- +goose Down
ALTER TABLE session
DROP COLUMN IF EXISTS phone_number;
