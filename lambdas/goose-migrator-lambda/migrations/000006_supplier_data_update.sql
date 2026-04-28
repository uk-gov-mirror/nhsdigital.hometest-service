-- +goose Up
UPDATE supplier
SET service_url = 'https://func-nhshometest-staging.azurewebsites.net/'
WHERE supplier_id = '11111111-1111-4111-8111-111111111111';

UPDATE supplier
SET service_url = 'https://admin.qa1.sh24.org.uk/'
WHERE supplier_id = '77777777-7777-4777-8777-777777777777';

-- +goose Down
UPDATE supplier
SET service_url = 'https://func-nhshometest-dev.azurewebsites.net/'
WHERE supplier_id = '11111111-1111-4111-8111-111111111111';

UPDATE supplier
SET service_url = 'https://admin.qa3.sh24.org.uk/'
WHERE supplier_id = '77777777-7777-4777-8777-777777777777';
