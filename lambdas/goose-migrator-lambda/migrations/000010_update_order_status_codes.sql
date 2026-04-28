-- +goose Up

-- +goose StatementBegin
DO $$
DECLARE _con text;
BEGIN
  SELECT conname INTO _con FROM pg_constraint
  WHERE conrelid = 'order_status'::regclass AND contype = 'f'
    AND confrelid = 'status_type'::regclass;
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE order_status DROP CONSTRAINT %I', _con);
  END IF;
END;
$$;
-- +goose StatementEnd
-- Temporarily add ON UPDATE CASCADE to enable status code renames, then restore original constraint
ALTER TABLE order_status
ADD CONSTRAINT order_status_status_code_fkey
FOREIGN KEY (status_code) REFERENCES status_type (status_code) ON UPDATE CASCADE;

UPDATE status_type
SET
  status_code = 'SUBMITTED',
  description = 'Order has been submitted to the supplier'
WHERE status_code = 'PLACED';

UPDATE status_type
SET
  status_code = 'CONFIRMED',
  description = 'Order has been confirmed by the supplier'
WHERE status_code = 'ORDER_RECEIVED';

-- Remove CASCADE after updates complete, restoring original non-cascading behavior
ALTER TABLE order_status
DROP CONSTRAINT order_status_status_code_fkey;

ALTER TABLE order_status
ADD CONSTRAINT order_status_status_code_fkey
FOREIGN KEY (status_code) REFERENCES status_type (status_code);

-- +goose Down
ALTER TABLE order_status
DROP CONSTRAINT order_status_status_code_fkey;

-- Temporarily add ON UPDATE CASCADE to allow renames to revert, then restore original constraint
ALTER TABLE order_status
ADD CONSTRAINT order_status_status_code_fkey
FOREIGN KEY (status_code) REFERENCES status_type (status_code) ON UPDATE CASCADE;

UPDATE status_type
SET
  status_code = 'PLACED',
  description = 'Order has been placed with the supplier'
WHERE status_code = 'SUBMITTED';

UPDATE status_type
SET
  status_code = 'ORDER_RECEIVED',
  description = 'Order has been confirmed by the supplier'
WHERE status_code = 'CONFIRMED';

-- Restore original constraint without ON UPDATE CASCADE
ALTER TABLE order_status
DROP CONSTRAINT order_status_status_code_fkey;

ALTER TABLE order_status
ADD CONSTRAINT order_status_status_code_fkey
FOREIGN KEY (status_code) REFERENCES status_type (status_code);
