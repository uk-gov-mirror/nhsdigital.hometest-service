-- +goose Up
INSERT INTO result_type (result_code, description)
VALUES ('RESULT_PROCESSED', 'Test has been processed at the lab but results are not yet available')
ON CONFLICT DO NOTHING;

-- +goose Down
DELETE FROM result_type
WHERE result_code = 'RESULT_PROCESSED';
