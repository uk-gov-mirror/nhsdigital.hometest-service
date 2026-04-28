-- +goose Up
ALTER TABLE order_status
ADD COLUMN correlation_id UUID DEFAULT gen_random_uuid() NOT NULL;

CREATE INDEX idx_order_status_correlation_id ON order_status (correlation_id);

-- +goose Down
DROP INDEX IF EXISTS idx_order_status_correlation_id;

ALTER TABLE order_status DROP COLUMN IF EXISTS correlation_id;
