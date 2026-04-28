-- +goose Up
CREATE TABLE patient_mapping
(
  patient_uid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nhs_number varchar(50) UNIQUE,
  birth_date date NOT NULL
);

CREATE TABLE test_type
(
  test_code varchar(50) PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE supplier
(
  supplier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name varchar(255) NOT NULL,
  service_url varchar(255) NOT NULL,
  website_url varchar(255),
  client_secret_name varchar(255) NOT NULL,
  client_id varchar(255) NOT NULL,
  oauth_token_path varchar(255),
  order_path varchar(255),
  oauth_scope varchar(255)
);

CREATE TABLE la_supplier_offering
(
  offering_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES supplier (supplier_id),
  test_code varchar(50) REFERENCES test_type (test_code),
  la_code varchar(10) NOT NULL,
  effective_from timestamp with time zone DEFAULT current_timestamp,

  CONSTRAINT unique_la_offering UNIQUE (la_code, supplier_id, test_code)
);

CREATE TABLE test_order
(
  order_uid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference bigint GENERATED ALWAYS AS IDENTITY (START WITH 100000) UNIQUE,
  supplier_id uuid NOT NULL REFERENCES supplier (supplier_id),
  patient_uid uuid NOT NULL REFERENCES patient_mapping (patient_uid),
  test_code varchar(50) NOT NULL REFERENCES test_type (test_code),
  originator varchar(255),
  created_at timestamp with time zone DEFAULT current_timestamp
);

CREATE TABLE status_type
(
  status_code varchar(50) PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE order_status
(
  status_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_uid uuid NOT NULL REFERENCES test_order (order_uid) ON DELETE CASCADE,
  order_reference bigint,
  status_code varchar(50) NOT NULL REFERENCES status_type (status_code),
  created_at timestamp with time zone DEFAULT current_timestamp
);

CREATE TABLE result_type (
  result_code varchar(50) PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE result_status
(
  result_id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  order_uid uuid NOT NULL REFERENCES test_order (order_uid) ON DELETE CASCADE,
  status varchar(50) NOT NULL REFERENCES result_type (result_code),
  created_at timestamp with time zone DEFAULT current_timestamp,
  correlation_id uuid NOT NULL UNIQUE
);

CREATE INDEX idx_order_patient_uid ON test_order (patient_uid);
CREATE INDEX idx_order_supplier_id ON test_order (supplier_id);
CREATE INDEX idx_order_status_order_uid ON order_status (order_uid);
CREATE INDEX idx_result_status_order_uid ON result_status (order_uid);
CREATE INDEX idx_patient_nhs_number ON patient_mapping (nhs_number);
CREATE INDEX idx_result_status_correlation_id ON result_status (correlation_id);


-- +goose Down
DROP TABLE patient_mapping;
DROP TABLE test_type;
DROP TABLE supplier;
DROP TABLE la_supplier_offering;
DROP TABLE test_order;
DROP TABLE status_type;
DROP TABLE order_status;
DROP TABLE result_type;
DROP TABLE result_status;
