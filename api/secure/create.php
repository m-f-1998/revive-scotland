<?php
  header('Content-Type: application/json; charset=utf-8');

  // Database connection parameters
  $host = 'localhost';
  $dbname = 'ReviveScotland';
  $username = 'root';
  $password = '%(80?%^49IKe;f-p?O#a';

  // Fetch the secret key from the environment variable
  $secretKey = getenv('JWT_SECRET');

  if ($secretKey === false) {
    http_response_code(500);
    echo json_encode(['error' => 'JWT secret key not set']);
    exit();
  }

  // Establish database connection
  try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  } catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit();
  }

  function base64UrlDecode($input) {
    return base64_decode(strtr($input, '-_', '+/'));
  }

  function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
  }

  function authenticate($secretKey) {
    $headers = getallheaders();
    if (!isset($headers['X-Auth'])) {
      return null;
    }
    $jwt = $headers['X-Auth'];
    list($header, $payload, $signature) = explode('.', $jwt);

    $payloadDecoded = json_decode(base64UrlDecode($payload), true);
    $headerDecoded = json_decode(base64UrlDecode($header), true);

    $signatureCheck = hash_hmac('sha256', "$header.$payload", $secretKey, true);
    $signatureCheck = base64UrlEncode($signatureCheck);

    if ($signatureCheck !== $signature) {
        return null;
    }

    // Check if the token is expired
    if (isset($payloadDecoded['exp']) && $payloadDecoded['exp'] < time()) {
        return null;
    }

    return $payloadDecoded;
  }

  $user = authenticate($secretKey);

  if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
  }

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
  }

  if (!isset($_POST['type'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Type is required (event, policy)']);
    exit();
  }

  $type = htmlspecialchars(strip_tags(trim($_POST['type'])));

  try {
    switch ($type) {
      case 'event':
        if (!isset($_POST['title']) || !isset($_POST['date_from']) || !isset($_POST['location'])) {
          http_response_code(400);
          echo json_encode(['error' => 'Required fields: title, date_from, location']);
          exit();
        }
        $stmt = $pdo->prepare("INSERT INTO Events (id, title, date_from, date_to, location, poster_link, timetable_link, price, policy_id, gdpr_id) VALUES (UUID(), :title, :date_from, :date_to, :location, :poster_link, :timetable_link, :price, :policy_id, :gdpr_id)");
        $stmt->execute([
          'title' => htmlspecialchars(strip_tags(trim($_POST['title']))),
          'date_from' => htmlspecialchars(strip_tags(trim($_POST['date_from']))),
          'date_to' => isset($_POST['date_to']) ? htmlspecialchars(strip_tags(trim($_POST['date_to']))) : null,
          'location' => htmlspecialchars(strip_tags(trim($_POST['location']))),
          'poster_link' => isset($_POST['poster_link']) ? htmlspecialchars(strip_tags(trim($_POST['poster_link']))) : null,
          'timetable_link' => isset($_POST['timetable_link']) ? htmlspecialchars(strip_tags(trim($_POST['timetable_link']))) : null,
          'price' => isset($_POST['price']) ? htmlspecialchars(strip_tags(trim($_POST['price']))) : null,
          'policy_id' => isset($_POST['policy_id']) ? htmlspecialchars(strip_tags(trim($_POST['policy_id']))) : null,
          'gdpr_id' => isset($_POST['gdpr_id']) ? htmlspecialchars(strip_tags(trim($_POST['gdpr_id']))) : null
        ]);
        break;
      case 'policy':
        if (!isset($_POST['title']) || !isset($_POST['description'])) {
          http_response_code(400);
          echo json_encode(['error' => 'Required fields: title, description']);
          exit();
        }
        $stmt = $pdo->prepare("INSERT INTO Policies (id, title, description) VALUES (UUID(), :title, :description)");
        $stmt->execute([
          'title' => htmlspecialchars(strip_tags(trim($_POST['title']))),
          'description' => htmlspecialchars(strip_tags(trim($_POST['description'])))
        ]);
        break;
      default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        exit();
    }
    http_response_code(200);
    echo json_encode(['message' => 'Update successful']);
  } catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database query failed']);
  }
?>
