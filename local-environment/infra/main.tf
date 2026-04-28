terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    apigateway     = "http://localhost:4566"
    events         = "http://localhost:4566"
    iam            = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    s3             = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    sqs            = "http://localhost:4566"
  }
}

# Secrets from JSON files
locals {
  secrets_dir       = "${path.module}/resources/secrets"
  secret_json_files = fileset(local.secrets_dir, "*.json")
  secret_txt_files  = fileset(local.secrets_dir, "*.txt")
  secret_key_files  = fileset(local.secrets_dir, "*.pem")

  # Required secrets that must exist
  required_secrets = [
    "nhs-login-private-key.pem"
  ]

  # Validate required secrets exist
  missing_secrets = [
    for secret in local.required_secrets :
    secret if !fileexists("${local.secrets_dir}/${secret}")
  ]

  secret_json_map = {
    for f in local.secret_json_files :
    trimsuffix(f, ".json") => f
  }
  secret_txt_map = {
    for f in local.secret_txt_files :
    trimsuffix(f, ".txt") => f
  }
  secret_key_map = {
    for f in local.secret_key_files :
    trimsuffix(f, ".pem") => f
  }

  secret_file_map = merge(local.secret_json_map, local.secret_txt_map, local.secret_key_map)
}

locals {
  wiremock_container_base_url    = "http://wiremock:8080"
  wiremock_browser_base_url      = "http://localhost:8080"
  nhs_login_sandpit_base_url     = "https://auth.sandpit.signin.nhs.uk"
  postcode_lookup_os_places_base = "https://api.os.uk/search/places/v1"

  use_wiremock_mode = var.local_service_mode == "wiremock"

  resolved_nhs_login_override_container_base_url = var.local_use_ui_auth_url_override != null ? replace(var.local_use_ui_auth_url_override, "localhost", "wiremock") : null
  resolved_nhs_login_override_browser_base_url   = var.local_use_ui_auth_url_override != null ? replace(var.local_use_ui_auth_url_override, "wiremock", "localhost") : null

  resolved_nhs_login_base_url = local.resolved_nhs_login_override_container_base_url != null ? local.resolved_nhs_login_override_container_base_url : (
    local.use_wiremock_mode ? local.wiremock_container_base_url : local.nhs_login_sandpit_base_url
  )

  resolved_nhs_login_authorize_url = local.resolved_nhs_login_override_browser_base_url != null ? "${local.resolved_nhs_login_override_browser_base_url}/authorize" : (
    local.use_wiremock_mode ? "${local.wiremock_browser_base_url}/authorize" : "${local.nhs_login_sandpit_base_url}/authorize"
  )

  resolved_postcode_lookup_base_url = var.local_postcode_lookup_base_url_override != null ? var.local_postcode_lookup_base_url_override : (
    local.use_wiremock_mode ? local.wiremock_container_base_url : local.postcode_lookup_os_places_base
  )

  resolved_supplier_service_url = var.local_supplier_service_url_override != null ? var.local_supplier_service_url_override : local.wiremock_container_base_url

  resolved_use_wiremock_auth = local.resolved_nhs_login_override_container_base_url != null ? length(regexall("wiremock", lower(local.resolved_nhs_login_override_container_base_url))) > 0 : local.use_wiremock_mode
}

# Fail early if required secrets are missing
resource "null_resource" "validate_secrets" {
  lifecycle {
    precondition {
      condition     = length(local.missing_secrets) == 0
      error_message = <<-EOT
        Missing required secret files in ${local.secrets_dir}:
        ${join("\n  - ", local.missing_secrets)}
      EOT
    }
  }
}



resource "aws_secretsmanager_secret" "secrets" {
  for_each = local.secret_file_map
  name     = each.key
}

resource "aws_secretsmanager_secret_version" "secrets" {
  for_each      = local.secret_file_map
  secret_id     = aws_secretsmanager_secret.secrets[each.key].id
  secret_string = file("${local.secrets_dir}/${each.value}")
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

resource "aws_iam_role_policy" "lambda_secrets_read" {
  name = "${var.project_name}-lambda-secrets-read"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambdas_sqs_publish" {
  name = "${var.project_name}-lambdas-sqs-publish"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.order_placement.arn,
          aws_sqs_queue.notify_messages.arn,
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambdas_lambda_invoke" {
  name = "${var.project_name}-lambdas-lambda-invoke"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          module.result_status_lambda.lambda_function.arn,
        ]
      }
    ]
  })
}

resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.project_name}-api"
  description = "API Gateway for ${var.project_name}"
}

# Eligibility Lookup Lambda
module "eligibility_lookup_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "eligibility-lookup-lambda"
  zip_path                      = "${path.module}/../../lambdas/dist/eligibility-lookup-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "eligibility-lookup"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic
  http_method                   = "GET"

  enable_cors            = true
  cors_allow_origin      = "http://localhost:3000"
  cors_allow_methods     = ["GET", "OPTIONS"]
  cors_allow_headers     = ["Content-Type", "Authorization"]
  cors_allow_credentials = true

  environment_variables = {
    NODE_OPTIONS   = "--enable-source-maps"
    ALLOW_ORIGIN   = "http://localhost:3000"
    DB_USERNAME    = "app_user"
    DB_ADDRESS     = "postgres-db"
    DB_PORT        = "5432"
    DB_NAME        = "local_hometest_db"
    DB_SCHEMA      = "hometest"
    DB_SECRET_NAME = "postgres-db-password"
    DB_SSL         = "false"
  }
}

# Login Lambda
module "login_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "login"
  zip_path                      = "${path.module}/../../lambdas/dist/login-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "login"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic
  http_method                   = "POST"
  timeout                       = 30

  enable_cors            = true
  cors_allow_origin      = "http://localhost:3000"
  cors_allow_methods     = ["POST", "OPTIONS"]
  cors_allow_headers     = ["Content-Type", "Authorization"]
  cors_allow_credentials = true

  environment_variables = {
    NODE_OPTIONS                               = "--enable-source-maps",
    ALLOW_ORIGIN                               = "http://localhost:3000",
    NHS_LOGIN_BASE_ENDPOINT_URL                = local.resolved_nhs_login_base_url,
    NHS_LOGIN_CLIENT_ID                        = var.local_nhs_login_client_id,
    NHS_LOGIN_REDIRECT_URL                     = var.local_nhs_login_redirect_url,
    NHS_LOGIN_PRIVATE_KEY_SECRET_NAME          = var.local_nhs_login_private_key_secret_name,
    AUTH_COOKIE_PRIVATE_KEYS_SECRET_NAME       = var.local_auth_cookie_private_keys_secret_name
    AUTH_SESSION_MAX_DURATION_MINUTES          = var.local_auth_session_max_duration_minutes,
    AUTH_ACCESS_TOKEN_EXPIRY_DURATION_MINUTES  = var.local_auth_access_token_expiry_duration_minutes,
    AUTH_REFRESH_TOKEN_EXPIRY_DURATION_MINUTES = var.local_auth_refresh_token_expiry_duration_minutes,
    AUTH_COOKIE_SAME_SITE                      = var.local_auth_cookie_same_site
    AUTH_COOKIE_SECURE                         = var.local_auth_cookie_secure
  }
}

module "session_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "session"
  zip_path                      = "${path.module}/../../lambdas/dist/session-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "session"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic
  http_method                   = "GET"

  enable_cors            = true
  cors_allow_origin      = "http://localhost:3000"
  cors_allow_methods     = ["GET", "OPTIONS"]
  cors_allow_headers     = ["Content-Type", "Authorization"]
  cors_allow_credentials = true

  environment_variables = {
    NODE_OPTIONS                       = "--enable-source-maps"
    ALLOW_ORIGIN                       = "http://localhost:3000"
    AUTH_COOKIE_KEY_ID                 = var.local_auth_cookie_key_id
    AUTH_COOKIE_PUBLIC_KEY_SECRET_NAME = var.local_auth_cookie_public_key_secret_name
    NHS_LOGIN_BASE_ENDPOINT_URL        = local.resolved_nhs_login_base_url,
  }
}

# Postcode Lookup Lambda
module "postcode_lookup_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "postcode-lookup"
  zip_path                      = "${path.module}/../../lambdas/dist/postcode-lookup-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "postcode-lookup"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic
  http_method                   = "GET"

  environment_variables = {
    NODE_OPTIONS                            = "--enable-source-maps",
    ALLOW_ORIGIN                            = "http://localhost:3000",
    POSTCODE_LOOKUP_CREDENTIALS_SECRET_NAME = "os-places-creds",
    POSTCODE_LOOKUP_BASE_URL                = local.resolved_postcode_lookup_base_url,
    POSTCODE_LOOKUP_TIMEOUT_MS              = "5000",
    POSTCODE_LOOKUP_MAX_RETRIES             = "3",
    POSTCODE_LOOKUP_RETRY_DELAY_MS          = "1000",
    POSTCODE_LOOKUP_RETRY_BACKOFF_FACTOR    = "2",
    USE_STUB_POSTCODE_CLIENT                = false,
  }
}

module "hello_world_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "hello-world"
  zip_path                      = "${path.module}/../../lambdas/dist/hello-world-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "hello-world"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  environment_variables = {
    NODE_OPTIONS = "--enable-source-maps"
  }
}

resource "aws_sqs_queue" "order_placement" {
  name = "${var.project_name}-order-placement"
}

resource "aws_sqs_queue" "notify_messages" {
  name = "${var.project_name}-notify-messages"
}

module "order_router_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "order-router"
  zip_path                      = "${path.module}/../../lambdas/dist/order-router-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "test-order/order"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  environment_variables = {
    NODE_OPTIONS   = "--enable-source-maps"
    DB_USERNAME    = "app_user"
    DB_ADDRESS     = "postgres-db"
    DB_PORT        = "5432"
    DB_NAME        = "local_hometest_db"
    DB_SCHEMA      = "hometest"
    DB_SECRET_NAME = "postgres-db-password"
    DB_SSL         = "false"
  }
}

resource "aws_lambda_event_source_mapping" "order_router_order_placement" {
  event_source_arn = aws_sqs_queue.order_placement.arn
  function_name    = module.order_router_lambda.lambda_function.arn
  enabled          = true
  batch_size       = 1
}

module "order_result_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "order-result"
  zip_path                      = "${path.module}/../../lambdas/dist/order-result-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "result"
  http_method                   = "POST"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  environment_variables = {
    NODE_OPTIONS              = "--enable-source-maps"
    ALLOW_ORIGIN              = "http://localhost:3000"
    DB_USERNAME               = "app_user"
    DB_ADDRESS                = "postgres-db"
    DB_PORT                   = "5432"
    DB_NAME                   = "local_hometest_db"
    DB_SCHEMA                 = "hometest"
    DB_SECRET_NAME            = "postgres-db-password"
    DB_SSL                    = "false"
    NOTIFY_MESSAGES_QUEUE_URL = aws_sqs_queue.notify_messages.url
    HOME_TEST_BASE_URL        = "http://localhost:3000"
  }
}

module "order_service_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "order-service"
  zip_path                      = "${path.module}/../../lambdas/dist/order-service-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "order"
  http_method                   = "POST"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  enable_cors            = true
  cors_allow_origin      = "http://localhost:3000"
  cors_allow_methods     = ["POST", "OPTIONS"]
  cors_allow_headers     = ["Content-Type", "Authorization", "X-Correlation-ID"]
  cors_allow_credentials = true

  environment_variables = {
    NODE_OPTIONS              = "--enable-source-maps"
    ORDER_PLACEMENT_QUEUE_URL = aws_sqs_queue.order_placement.url
    ALLOW_ORIGIN              = "http://localhost:3000"
    DB_USERNAME               = "app_user"
    DB_ADDRESS                = "postgres-db"
    DB_PORT                   = "5432"
    DB_NAME                   = "local_hometest_db"
    DB_SCHEMA                 = "hometest"
    DB_SECRET_NAME            = "postgres-db-password"
    DB_SSL                    = "false"
  }
}

module "get_order_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "get-order"
  zip_path                      = "${path.module}/../../lambdas/dist/get-order-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "get-order"
  http_method                   = "GET"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  enable_cors        = true
  cors_allow_origin  = "http://localhost:3000"
  cors_allow_methods = ["GET", "OPTIONS"]

  environment_variables = {
    NODE_OPTIONS   = "--enable-source-maps"
    ALLOW_ORIGIN   = "http://localhost:3000"
    DB_USERNAME    = "app_user"
    DB_ADDRESS     = "postgres-db"
    DB_PORT        = "5432"
    DB_NAME        = "local_hometest_db"
    DB_SCHEMA      = "hometest"
    DB_SECRET_NAME = "postgres-db-password"
    DB_SSL         = "false"
  }
}

module "get_results_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "get-results"
  zip_path                      = "${path.module}/../../lambdas/dist/get-results-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "results"
  http_method                   = "GET"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  enable_cors        = true
  cors_allow_origin  = "http://localhost:3000"
  cors_allow_methods = ["GET", "OPTIONS"]
  cors_allow_headers = ["Content-Type", "Authorization", "X-Requested-With", "X-Correlation-ID"]

  environment_variables = {
    NODE_OPTIONS   = "--enable-source-maps"
    DB_USERNAME    = "app_user"
    DB_ADDRESS     = "postgres-db"
    DB_PORT        = "5432"
    DB_NAME        = "local_hometest_db"
    DB_SCHEMA      = "hometest"
    DB_SECRET_NAME = "postgres-db-password"
    DB_SSL         = "false"
    ALLOW_ORIGIN   = "http://localhost:3000"
  }
}

resource "aws_lambda_function" "hiv_results_lambda" {
  filename         = "${path.module}/../../lambdas/dist/hiv-result-processor-lambda.zip"
  function_name    = "${var.project_name}-hiv-results-processor"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  source_code_hash = filebase64sha256("${path.module}/../../lambdas/dist/hiv-result-processor-lambda.zip")

  environment {
    variables = {
      NODE_OPTIONS              = "--enable-source-maps"
      RESULT_STATUS_LAMBDA_NAME = module.result_status_lambda.lambda_function.function_name
      AWS_REGION                = "eu-west-2"
    }
  }

  depends_on = [aws_iam_role_policy_attachment.lambda_basic]
}

module "order_status_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "order-status"
  zip_path                      = "${path.module}/../../lambdas/dist/order-status-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "test-order/status"
  http_method                   = "POST"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  environment_variables = {
    NODE_OPTIONS              = "--enable-source-maps"
    ALLOW_ORIGIN              = "http://localhost:3000"
    DB_USERNAME               = "app_user"
    DB_ADDRESS                = "postgres-db"
    DB_PORT                   = "5432"
    DB_NAME                   = "local_hometest_db"
    DB_SCHEMA                 = "hometest"
    DB_SECRET_NAME            = "postgres-db-password"
    DB_SSL                    = "false"
    NOTIFY_MESSAGES_QUEUE_URL = aws_sqs_queue.notify_messages.url
    HOME_TEST_BASE_URL        = "http://localhost:3000"
  }
}

module "result_status_lambda" {
  source = "./modules/lambda"

  project_name                  = var.project_name
  function_name                 = "result-status"
  zip_path                      = "${path.module}/../../lambdas/dist/result-status-lambda.zip"
  lambda_role_arn               = aws_iam_role.lambda_role.arn
  environment                   = var.environment
  api_gateway_id                = aws_api_gateway_rest_api.api.id
  api_gateway_root_resource_id  = aws_api_gateway_rest_api.api.root_resource_id
  api_gateway_execution_arn     = aws_api_gateway_rest_api.api.execution_arn
  api_path                      = "result/status"
  http_method                   = "POST"
  lambda_role_policy_attachment = aws_iam_role_policy_attachment.lambda_basic

  environment_variables = {
    NODE_OPTIONS   = "--enable-source-maps"
    ALLOW_ORIGIN   = "http://localhost:3000"
    DB_USERNAME    = "app_user"
    DB_ADDRESS     = "postgres-db"
    DB_PORT        = "5432"
    DB_NAME        = "local_hometest_db"
    DB_SCHEMA      = "hometest"
    DB_SECRET_NAME = "postgres-db-password"
    DB_SSL         = "false"
  }
}

resource "aws_lambda_function" "reminder_dispatch_lambda" {
  filename         = "${path.module}/../../lambdas/dist/reminder-dispatch-lambda.zip"
  function_name    = "${var.project_name}-reminder-dispatch-lambda"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  source_code_hash = filebase64sha256("${path.module}/../../lambdas/dist/reminder-dispatch-lambda.zip")
  timeout          = 60

  environment {
    variables = {
      NODE_OPTIONS              = "--enable-source-maps"
      DB_USERNAME               = "app_user"
      DB_ADDRESS                = "postgres-db"
      DB_PORT                   = "5432"
      DB_NAME                   = "local_hometest_db"
      DB_SCHEMA                 = "hometest"
      DB_SECRET_NAME            = "postgres-db-password"
      DB_SSL                    = "false"
      NOTIFY_MESSAGES_QUEUE_URL = aws_sqs_queue.notify_messages.url
      HOME_TEST_BASE_URL        = "http://localhost:3000"
      REMINDER_ENABLED_STATUSES = jsonencode(["DISPATCHED"])
      REMINDER_INTERVAL_CONFIG = jsonencode(
        {
          DISPATCHED = [
            { interval = 7, eventCode = "DISPATCHED_INITIAL_REMINDER" },
            { interval = 15, eventCode = "DISPATCHED_SECOND_REMINDER" },
            { interval = 30, eventCode = "DISPATCHED_THIRD_REMINDER" }
          ]
        }
      )
    }
  }

  depends_on = [aws_iam_role_policy_attachment.lambda_basic]
}

resource "aws_cloudwatch_event_rule" "reminder_dispatch_schedule" {
  name                = "${var.project_name}-reminder-dispatch-schedule"
  description         = "Triggers reminder-dispatch-lambda on a scheduled interval"
  schedule_expression = "rate(2 minutes)"
}

resource "aws_cloudwatch_event_target" "reminder_dispatch_lambda_target" {
  rule      = aws_cloudwatch_event_rule.reminder_dispatch_schedule.name
  target_id = "reminder-dispatch-lambda"
  arn       = aws_lambda_function.reminder_dispatch_lambda.arn
}

resource "aws_lambda_permission" "allow_eventbridge_reminder_dispatch" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reminder_dispatch_lambda.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.reminder_dispatch_schedule.arn
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "api_deployment" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  depends_on = [
    module.eligibility_lookup_lambda,
    module.order_result_lambda,
    module.get_order_lambda,
    module.get_results_lambda,
    module.login_lambda,
    module.order_service_lambda,
    module.session_lambda,
    module.order_status_lambda,
    module.postcode_lookup_lambda,
    module.result_status_lambda
  ]

  triggers = {
    redeployment = sha1(jsonencode([
      module.eligibility_lookup_lambda,
      module.order_result_lambda,
      module.get_order_lambda,
      module.get_results_lambda,
      module.login_lambda,
      module.order_service_lambda,
      module.session_lambda,
      module.order_status_lambda,
      module.postcode_lookup_lambda,
      module.result_status_lambda
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway stage
resource "aws_api_gateway_stage" "api_stage" {
  deployment_id = aws_api_gateway_deployment.api_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment
}

data "external" "supplier_id" {
  program = ["bash", "${path.module}/../scripts/localstack/get_supplier_id.sh"]
}
