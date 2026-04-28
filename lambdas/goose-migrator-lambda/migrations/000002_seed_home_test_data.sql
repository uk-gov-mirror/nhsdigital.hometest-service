-- +goose Up
INSERT INTO supplier (
  supplier_id,
  supplier_name,
  service_url,
  website_url,
  client_secret_name,
  client_id,
  oauth_token_path,
  order_path,
  oauth_scope
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Preventx',
  'https://func-nhshometest-dev.azurewebsites.net/',
  'https://www.preventx.com/',
  'nhs-hometest/dev/preventex-dev-client-secret',
  '7e9b8f16-4686-46f4-903e-2d364774fc82',
  '/api/oauth',
  '/api/order',
  'orders results'
)
ON CONFLICT (supplier_id) DO NOTHING;

INSERT INTO supplier (
  supplier_id,
  supplier_name,
  service_url,
  website_url,
  client_secret_name,
  client_id,
  oauth_token_path,
  order_path,
  oauth_scope
)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  'SH:24',
  'https://admin.qa3.sh24.org.uk/',
  'https://sh24.org.uk/',
  'nhs-hometest/dev/sh24-dev-client-secret',
  'zrgmf33Zdk-515BIMrds29v9Z3KzoH-tfYDgxLsYtZE',
  '/oauth/token',
  '/order',
  'order results'
)
ON CONFLICT (supplier_id) DO NOTHING;

-- +goose Down
DELETE FROM supplier
WHERE supplier_id = '11111111-1111-4111-8111-111111111111';
DELETE FROM supplier
WHERE supplier_id = '77777777-7777-4777-8777-777777777777';
