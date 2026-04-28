output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "api_base_url" {
  description = "LocalStack API base URL for tests"
  value       = "http://localhost:4566/restapis/${aws_api_gateway_rest_api.api.id}/${var.environment}/_user_request_"
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_api_gateway_rest_api.api.id
}

output "eligibility_lookup_endpoint" {
  description = "Eligibility Lookup Lambda endpoint"
  value       = module.eligibility_lookup_lambda.localstack_endpoint_url
}

output "hello_world_endpoint" {
  description = "Hello World Lambda endpoint"
  value       = module.hello_world_lambda.localstack_endpoint_url
}

output "order_result_endpoint" {
  description = "Order Result Lambda endpoint"
  value       = module.order_result_lambda.localstack_endpoint_url
}

output "order_router_endpoint" {
  description = "Order Router Lambda endpoint"
  value       = module.order_router_lambda.localstack_endpoint_url
}

output "get_order_endpoint" {
  description = "Get Order Lambda endpoint"
  value       = module.get_order_lambda.localstack_endpoint_url
}

output "get_results_endpoint" {
  description = "Get Results Lambda endpoint"
  value       = module.get_results_lambda.localstack_endpoint_url
}

output "login_endpoint" {
  description = "Login Lambda endpoint"
  value       = module.login_lambda.localstack_endpoint_url
}

output "session_endpoint" {
  description = "Session Lambda endpoint"
  value       = module.session_lambda.localstack_endpoint_url
}

output "backend_base_url" {
  description = "Base URL for calling backend routes in LocalStack (append /login, /session, etc.)"
  value       = "http://localhost:4566/_aws/execute-api/${aws_api_gateway_rest_api.api.id}/${var.environment}"
}

output "nhs_login_authorize_url" {
  description = "NHS Login authorize URL (WireMock stub for local development)"
  value       = local.resolved_nhs_login_authorize_url
}

output "nhs_login_client_id" {
  description = "NHS Login client id for local UI authorize requests"
  value       = var.local_nhs_login_client_id
}

output "nhs_login_scope" {
  description = "NHS Login scope for local UI authorize requests"
  value       = var.local_nhs_login_scope
}

output "local_service_mode" {
  description = "Resolved local integration mode"
  value       = var.local_service_mode
}

output "hiv_results_processor_lambda_name" {
  description = "HIV Results Processor Lambda function name"
  value       = aws_lambda_function.hiv_results_lambda.function_name
}

output "use_wiremock_auth" {
  description = "Whether local UI/tests should use WireMock-specific auth behavior"
  value       = tostring(local.resolved_use_wiremock_auth)
}

output "supplier_service_url" {
  description = "Resolved supplier service URL used for local seeded suppliers"
  value       = local.resolved_supplier_service_url
}

output "postcode_lookup_endpoint" {
  description = "Postcode Lookup Lambda endpoint"
  value       = module.postcode_lookup_lambda.localstack_endpoint_url
}

output "seed_supplier_id" {
  value       = data.external.supplier_id.result["supplier_id"]
  description = "The supplier_id of the seeded supplier updated by the local bootstrap flow"
}

output "order_placement_queue_url" {
  description = "SQS Queue URL for order placement"
  value       = aws_sqs_queue.order_placement.url
}

output "notify_messages_queue_url" {
  description = "SQS Queue URL for notify messages"
  value       = aws_sqs_queue.notify_messages.url
}

output "ui_url" {
  description = "URL of the UI application"
  value       = "http://localhost:3000"
}

output "order_service_endpoint" {
  description = "Order Service Lambda endpoint"
  value       = module.order_service_lambda.localstack_endpoint_url
}

output "order_status_endpoint" {
  description = "Order Status Lambda endpoint"
  value       = module.order_status_lambda.localstack_endpoint_url
}
