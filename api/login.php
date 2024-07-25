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

  function authenticate($secretKey, $headers) {
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

  $headers = getallheaders();

  if (isset($headers['X-Auth']) && $headers['X-Auth'] !== '') {
    $user = authenticate($secretKey, $headers);
    if ($user) {
      echo json_encode([
        'message' => 'Login successful',
        'jwt' => $headers['X-Auth'],
        'user' => $user [ "data"]
      ]);
      exit ( );
    }
  }

  function generateJWT($header, $payload, $secretKey) {
    $headerEncoded = base64UrlEncode(json_encode($header));
    $payloadEncoded = base64UrlEncode(json_encode($payload));
    $signature = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", $secretKey, true);
    $signatureEncoded = base64UrlEncode($signature);
    return "$headerEncoded.$payloadEncoded.$signatureEncoded";
  }

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
  }

  $_POST = json_decode(file_get_contents('php://input'), true);

  if (!isset($_POST['username']) || !isset($_POST['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Username and password are required']);
    exit();
  }

  $username = htmlspecialchars(strip_tags(trim($_POST['username'])));
  $password = $_POST['password'];

  try {
    $stmt = $pdo->prepare("SELECT * FROM Login WHERE username = :username");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password'])) {
      http_response_code(401);
      echo json_encode(['error' => 'Invalid credentials']);
      exit();
    }

    // Update last login time
    $stmt = $pdo->prepare("UPDATE Login SET last_login = NOW() WHERE id = :id");
    $stmt->execute(['id' => $user['id']]);

    // Generate JWT
    $header = [
      'alg' => 'HS256',
      'typ' => 'JWT'
    ];

    $payload = [
      'iat' => time(),
      'exp' => time() + (60 * 60), // Token valid for 1 hour
      'data' => [
        'username' => $user['username'],
        'email' => $user['email'],
        'permissions' => $user['permissions']
      ]
    ];

    $jwt = generateJWT($header, $payload, $secretKey);

    http_response_code(200);
    echo json_encode([
      'message' => 'Login successful',
      'jwt' => $jwt,
      'user' => [
        'username' => $user['username'],
        'email' => $user['email'],
        'permissions' => $user['permissions']
      ]
    ]);
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Database query failed']);
}
?>
