<?php
// GitHub Webhook handler for auto-deploy
// Simple version for testing

// Log all requests
file_put_contents('/var/log/integram-webhook.log', date('Y-m-d H:i:s') . " - Webhook called\n", FILE_APPEND);

// Get payload
$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

// Log payload
file_put_contents('/var/log/integram-webhook.log', "Payload: " . print_r($data, true) . "\n", FILE_APPEND);

// Check if it's a push to master
if (isset($data['ref']) && $data['ref'] === 'refs/heads/master') {
    file_put_contents('/var/log/integram-webhook.log', "Push to master detected, triggering deploy...\n", FILE_APPEND);
    
    // Trigger deploy
    exec('sudo systemctl start integram-autodeploy.service 2>&1', $output, $return);
    
    file_put_contents('/var/log/integram-webhook.log', "Deploy triggered, return code: $return\n", FILE_APPEND);
    file_put_contents('/var/log/integram-webhook.log', "Output: " . implode("\n", $output) . "\n", FILE_APPEND);
    
    http_response_code(200);
    echo json_encode(['status' => 'success', 'message' => 'Deploy triggered']);
} else {
    file_put_contents('/var/log/integram-webhook.log', "Not a push to master\n", FILE_APPEND);
    http_response_code(200);
    echo json_encode(['status' => 'ignored', 'message' => 'Not a push to master']);
}
