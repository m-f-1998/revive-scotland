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
    echo json_encode(['error' => 'Type is required (event, policy, user)']);
    exit();
  }

  $type = htmlspecialchars(strip_tags(trim($_POST['type'])));

  try {
    switch ($type) {
      case 'event':
        if (!isset($_POST['id'])) {
          http_response_code(400);
          echo json_encode(['error' => 'Required fields: id']);
          exit();
        }
        $stmt = $pdo->prepare("UPDATE Events SET title = :title, date_from = :date_from, date_to = :date_to, location = :location, poster_link = :poster_link, timetable_link = :timetable_link, price = :price, policy_id = :policy_id, gdpr_id = :gdpr_id WHERE id = :id");
        $stmt->execute([
          'id' => htmlspecialchars(strip_tags(trim($_POST['id']))),
          'title' => isset($_POST['title']) ? htmlspecialchars(strip_tags(trim($_POST['title']))) : null,
          'date_from' => isset($_POST['date_from']) ? htmlspecialchars(strip_tags(trim($_POST['date_from']))) : null,
          'date_to' => isset($_POST['date_to']) ? htmlspecialchars(strip_tags(trim($_POST['date_to']))) : null,
          'location' => isset($_POST['location']) ? htmlspecialchars(strip_tags(trim($_POST['location']))) : null,
          'poster_link' => isset($_POST['poster_link']) ? htmlspecialchars(strip_tags(trim($_POST['poster_link']))) : null,
          'timetable_link' => isset($_POST['timetable_link']) ? htmlspecialchars(strip_tags(trim($_POST['timetable_link']))) : null,
          'price' => isset($_POST['price']) ? htmlspecialchars(strip_tags(trim($_POST['price']))) : null,
          'policy_id' => isset($_POST['policy_id']) ? htmlspecialchars(strip_tags(trim($_POST['policy_id']))) : null,
          'gdpr_id' => isset($_POST['gdpr_id']) ? htmlspecialchars(strip_tags(trim($_POST['gdpr_id']))) : null
        ]);
        break;
      case 'policy':
        if (!isset($_POST['id'])) {
          http_response_code(400);
          echo json_encode(['error' => 'Required fields: id']);
          exit();
        }
        $stmt = $pdo->prepare("UPDATE Policies SET title = :title, description = :description WHERE id = :id");
        $stmt->execute([
          'id' => htmlspecialchars(strip_tags(trim($_POST['id']))),
          'title' => isset($_POST['title']) ? htmlspecialchars(strip_tags(trim($_POST['title']))) : null,
          'description' => isset($_POST['description']) ? htmlspecialchars(strip_tags(trim($_POST['description']))) : null,
        ]);
        break;
      case 'user':
        if (!isset($user['data']['permissions']) || $user['data']['permissions'] !== 'admin') {
          http_response_code(403);
          echo json_encode(['error' => 'Unauthorized']);
          exit();
        }
        if (!isset($_POST['username'])) {
          http_response_code(400);
          echo json_encode(['error' => 'Required field: username']);
          exit();
        }
        $fields = ['email', 'password', 'permissions'];
        $updateFields = [];
        $params = ['username' => htmlspecialchars(strip_tags(trim($_POST['username'])))];
        foreach ($fields as $field) {
          if (isset($_POST[$field])) {
            $updateFields[] = "$field = :$field";
            if ($field === 'password') {
              $params[$field] = password_hash($_POST[$field], PASSWORD_DEFAULT);
            } else {
              $params[$field] = htmlspecialchars(strip_tags(trim($_POST[$field])));
            }
          }
        }
        if (empty($updateFields)) {
          http_response_code(400);
          echo json_encode(['error' => 'No fields to update']);
          exit();
        }
        $stmt = $pdo->prepare("UPDATE Login SET " . implode(', ', $updateFields) . " WHERE username = :username");
        $stmt->execute($params);
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
