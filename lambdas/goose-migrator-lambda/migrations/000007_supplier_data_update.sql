-- +goose Up
UPDATE supplier
SET client_id = '4g3lEP_BGzTd9MZTbtejrrlbgb7vJZzfxkKq6R3zTWY'
WHERE supplier_id = '77777777-7777-4777-8777-777777777777';

-- +goose Down
UPDATE supplier
SET client_id = 'zrgmf33Zdk-515BIMrds29v9Z3KzoH-tfYDgxLsYtZE'
WHERE supplier_id = '77777777-7777-4777-8777-777777777777';
