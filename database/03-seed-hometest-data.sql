/*
 =================================================================
 Test data

 This is for data used for testing locally
 =================================================================
 */

SET search_path TO hometest;

-- Override dev/staging supplier credentials and service URL with local values.
-- Goose migrations (000002, 000006, 000009) insert these suppliers with
-- environment-specific credentials/URLs/paths that don't exist or don't match
-- locally. WireMock expects: oauth at /oauth/token, orders at /order.
UPDATE supplier
SET
  client_secret_name = 'test_supplier_client_secret',
  service_url = 'http://wiremock:8080',
  oauth_token_path = '/oauth/token',
  order_path = '/order'
WHERE supplier_id IN (
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777777'
);

-- PCR test type (goose migration 000005 only seeds 31676001)
INSERT INTO test_type (test_code, description)
VALUES ('PCR', 'Polymerase Chain Reaction')
ON CONFLICT (test_code) DO NOTHING;

-- PCR offerings (goose migration 000012 only seeds test code 31676001)
INSERT INTO la_supplier_offering (offering_id, supplier_id, test_code, la_code, effective_from)
VALUES
('20000002-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'PCR', '1440', DATE '2026-02-09'),
('20000002-0000-4000-8000-000000000002', '77777777-7777-4777-8777-777777777777', 'PCR', '4230', DATE '2026-02-09')
ON CONFLICT (la_code, supplier_id, test_code) DO NOTHING;

INSERT INTO patient_mapping (patient_uid, nhs_number, birth_date)
VALUES (
  'e3c4d5e6-3456-4bcd-8efa-3456789abcde',
  '9999999999',
  DATE '1988-03-15'
)
ON CONFLICT (nhs_number) DO NOTHING;

INSERT INTO patient_mapping (patient_uid, nhs_number, birth_date)
VALUES (
  'f4d5e6f7-4567-4cde-8fab-456789abcdef',
  '8888888888',
  DATE '1992-11-07'
)
ON CONFLICT (nhs_number) DO NOTHING;

INSERT INTO test_order (order_uid, supplier_id, patient_uid, test_code, originator)
VALUES (
  'e9c0d1e2-9012-4bcd-8efa-90abcdefabcd',
  '11111111-1111-4111-8111-111111111111',
  'e3c4d5e6-3456-4bcd-8efa-3456789abcde',
  '31676001',
  'seed-migration'
)
ON CONFLICT (order_uid) DO NOTHING;

INSERT INTO test_order (order_uid, supplier_id, patient_uid, test_code, originator)
VALUES (
  'fab1c2d3-0123-4cde-8fab-01abcdefabcd',
  '77777777-7777-4777-8777-777777777777',
  'f4d5e6f7-4567-4cde-8fab-456789abcdef',
  'PCR',
  'seed-migration'
)
ON CONFLICT (order_uid) DO NOTHING;

INSERT INTO order_status (status_id, order_uid, status_code)
VALUES (
  'abc2d3e4-1234-4def-8abc-12abcdefabcd',
  'e9c0d1e2-9012-4bcd-8efa-90abcdefabcd',
  'CONFIRMED'
)
ON CONFLICT (status_id) DO NOTHING;

INSERT INTO order_status (status_id, order_uid, status_code)
VALUES (
  'bcd3e4f5-2345-4abc-8def-23abcdefabcd',
  'fab1c2d3-0123-4cde-8fab-01abcdefabcd',
  'CONFIRMED'
)
ON CONFLICT (status_id) DO NOTHING;

INSERT INTO result_status (order_uid, status, correlation_id)
VALUES (
  'e9c0d1e2-9012-4bcd-8efa-90abcdefabcd',
  'RESULT_AVAILABLE',
  'cde4f5a6-3456-4bcd-8efa-34abcdefabcd'
)
ON CONFLICT (correlation_id) DO NOTHING;

INSERT INTO result_status (order_uid, status, correlation_id)
VALUES (
  'fab1c2d3-0123-4cde-8fab-01abcdefabcd',
  'RESULT_AVAILABLE',
  'def5a6b7-4567-4cde-8fab-45abcdefabcd'
)
ON CONFLICT (correlation_id) DO NOTHING;
