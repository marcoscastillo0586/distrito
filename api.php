<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataFile = __DIR__ . '/data.json';

// Default schema if file doesn't exist
$defaultData = [
    "active_contract_id" => "contract_default",
    "contracts" => [
        "contract_default" => [
            "id" => "contract_default",
            "project_name" => "Contrato de Desarrollo / Consultoría",
            "client_name" => "Cliente de Servicios Profesionales",
            "contract_total_usd" => 4000.00,
            "payments" => []
        ]
    ]
];

// Load data and migrate if needed
function loadData($file, $default) {
    if (!file_exists($file)) {
        file_put_contents($file, json_encode($default, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return $default;
    }
    
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    if ($data === null) {
        return $default;
    }
    
    // Auto-migration: Check if it's the old single-contract format
    if (isset($data['contract_total_usd']) && !isset($data['contracts'])) {
        $oldId = 'contract_default';
        $migratedData = [
            "active_contract_id" => $oldId,
            "contracts" => [
                $oldId => [
                    "id" => $oldId,
                    "project_name" => $data['project_name'] ?? 'Contrato de Desarrollo / Consultoría',
                    "client_name" => $data['client_name'] ?? 'Cliente de Servicios Profesionales',
                    "contract_total_usd" => floatval($data['contract_total_usd']),
                    "payments" => $data['payments'] ?? []
                ]
            ]
        ];
        
        file_put_contents($file, json_encode($migratedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return $migratedData;
    }
    
    return $data;
}

// Save data
function saveData($file, $data) {
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $data = loadData($dataFile, $defaultData);
    echo json_encode($data);
    exit;
}

if ($method === 'POST') {
    $input = file_get_contents("php://input");
    $jsonData = json_decode($input, true);

    if ($jsonData === null) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid JSON payload"]);
        exit;
    }

    // Validation for multi-contract structure
    if (!isset($jsonData['active_contract_id']) || !isset($jsonData['contracts']) || !is_array($jsonData['contracts'])) {
        http_response_code(400);
        echo json_encode(["error" => "active_contract_id and contracts object are required"]);
        exit;
    }

    // Sanitize and format contracts data
    $sanitizedContracts = [];
    foreach ($jsonData['contracts'] as $cId => $contract) {
        $cTotalUsd = floatval($contract['contract_total_usd'] ?? 0);
        $cName = htmlspecialchars($contract['client_name'] ?? 'Cliente', ENT_QUOTES, 'UTF-8');
        $pName = htmlspecialchars($contract['project_name'] ?? 'Proyecto', ENT_QUOTES, 'UTF-8');
        
        $sanitizedPayments = [];
        if (isset($contract['payments']) && is_array($contract['payments'])) {
            foreach ($contract['payments'] as $payment) {
                $amount_ars = floatval($payment['amount_ars'] ?? 0);
                $exchange_rate = floatval($payment['exchange_rate'] ?? 1);
                if ($exchange_rate <= 0) $exchange_rate = 1;
                
                $sanitizedPayments[] = [
                    "id" => $payment['id'] ?? 'pay_' . uniqid() . '_' . round(microtime(true) * 1000),
                    "date" => $payment['date'] ?? date('Y-m-d'),
                    "amount_ars" => $amount_ars,
                    "exchange_rate" => $exchange_rate,
                    "amount_usd" => round($amount_ars / $exchange_rate, 2),
                    "notes" => htmlspecialchars($payment['notes'] ?? '', ENT_QUOTES, 'UTF-8')
                ];
            }
        }
        
        $sanitizedContracts[$cId] = [
            "id" => $cId,
            "project_name" => $pName,
            "client_name" => $cName,
            "contract_total_usd" => $cTotalUsd,
            "payments" => $sanitizedPayments
        ];
    }

    $newData = [
        "active_contract_id" => htmlspecialchars($jsonData['active_contract_id'], ENT_QUOTES, 'UTF-8'),
        "contracts" => $sanitizedContracts
    ];

    if (saveData($dataFile, $newData)) {
        echo json_encode(["success" => true, "data" => $newData]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to write data to storage"]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed"]);
