-- +goose Up

INSERT INTO test_type (test_code, description)
VALUES
('31676001', 'HIV antigen test')
ON CONFLICT (test_code) DO NOTHING;


-- +goose Down
DELETE FROM test_type
WHERE test_code = '31676001';
