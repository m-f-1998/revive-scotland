<?php
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *'); // Remove On Production
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth');

  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // The preflight request is handled here
    header('HTTP/1.1 200 OK');
    exit;
  }

  // Database connection parameters
  $host = 'localhost';
  $dbname = 'ReviveScotland';
  $username = 'root';
  $password = '%(80?%^49IKe;f-p?O#a';

  // Fetch the secret key from the environment variable
  $secretKey = getenv('JWT_SECRET');

  if ($secretKey === false) {
    http_response_code(500);
    echo json_encode(['error' => 'An Unexpected Error Occurred']);
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

  $_POST = json_decode(file_get_contents('php://input'), true);

  if (!isset($_POST['type'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Type is required (event, event_bookings)']);
    exit();
  }

  $type = htmlspecialchars(strip_tags(trim($_POST['type'])));

  try {
    switch ($type) {
      case 'event':
        $stmt = $pdo->query("SELECT
            e.id,
            e.title,
            e.date_from,
            e.date_to,
            e.location,
            e.poster_link,
            e.timetable_link,
            e.price,
            e.suggested_price,
            p1.title AS policy_title,
            p2.title AS gdpr_title
        FROM Events e
        LEFT JOIN Policies p1 ON e.policy_id = p1.id
        LEFT JOIN Policies p2 ON e.gdpr_id = p2.id
        ORDER BY e.date_from");
        $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
        http_response_code(200);
        echo json_encode($events);
        break;
      case 'policy':
        if (isset($_POST['title'])) {
          $title = htmlspecialchars(strip_tags(trim($_POST['title'])));
          $stmt = $pdo->prepare("SELECT * FROM Policies WHERE title = :title");
          $stmt->execute(['title' => $title]);
        } else {
          $stmt = $pdo->query("SELECT * FROM Policies");
        }
        $policies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        http_response_code(200);
        echo json_encode($policies);
        break;
      case 'event_bookings':
        if (!isset($_POST['id'])) {
          http_response_code(400);
          echo json_encode(['error' => 'Required field: id']);
          exit();
        }

        $id = htmlspecialchars(strip_tags(trim($_POST['id'])));

        $stmt = $pdo->prepare("SELECT * FROM EventRegister WHERE event_id = :event_id");
        $stmt->execute(['event_id' => $id]);
        $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode($bookings);
        break;
      default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        exit();
    }
  } catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database query failed']);
  }
?>
