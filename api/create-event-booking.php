<?php

/*
TODO:
  - CAPTCHA: Implementing a CAPTCHA to prevent automated submissions.
  - Rate Limiting: Limiting the number of requests from the same IP address within a certain timeframe.
  - Email Verification: Sending a verification email before confirming the booking.
  - Two Factor Authentica
*/
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

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
  }

  // Required fields for booking
  $requiredFields = ['event_id', 'name', 'telephone', 'email', 'accepted_gdpr', 'accepted_event_policy'];
  foreach ($requiredFields as $field) {
    if (!isset($_POST[$field]) || empty(trim($_POST[$field]))) {
      http_response_code(400);
      echo json_encode(['error' => "Field $field is required"]);
      exit();
    }
  }

  $event_id = htmlspecialchars(strip_tags(trim($_POST['event_id'])));
  $name = htmlspecialchars(strip_tags(trim($_POST['name'])));
  $telephone = htmlspecialchars(strip_tags(trim($_POST['telephone'])));
  $email = htmlspecialchars(strip_tags(trim($_POST['email'])));
  $emergency_contact = isset($_POST['emergency_contact']) ? htmlspecialchars(strip_tags(trim($_POST['emergency_contact']))) : null;
  $dob = isset($_POST['dob']) ? htmlspecialchars(strip_tags(trim($_POST['dob']))) : null;
  $allergies_or_medical_requirements = isset($_POST['allergies_or_medical_requirements']) ? htmlspecialchars(strip_tags(trim($_POST['allergies_or_medical_requirements']))) : null;
  $accepted_gdpr = $_POST['accepted_gdpr'] === '1';
  $accepted_event_policy = $_POST['accepted_event_policy'] === '1';

  // Check that GDPR and policy are accepted
  if (!$accepted_gdpr || !$accepted_event_policy) {
    http_response_code(400);
    echo json_encode(['error' => 'GDPR and event policy must be accepted']);
    exit();
  }

  // Check if the event allows optional payment
  $payment_optional = false;
  try {
    $stmt = $pdo->prepare("SELECT price FROM Events WHERE id = :event_id");
    $stmt->execute(['event_id' => $event_id]);
    $event = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($event) {
      $payment_optional = is_null($event['price']) || $event['price'] == 0;
    } else {
      http_response_code(400);
      echo json_encode(['error' => 'Event not found']);
      exit();
    }
  } catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database query failed']);
    exit();
  }

  // Check for existing booking with the same email for the event
  try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM EventRegister WHERE event_id = :event_id AND email = :email");
    $stmt->execute(['event_id' => $event_id, 'email' => $email]);
    if ($stmt->fetchColumn() > 0) {
      http_response_code(400);
      echo json_encode(['error' => 'This email is already registered for the event']);
      exit();
    }
  } catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database query failed']);
    exit();
  }

  // Insert the booking into EventRegister
  try {
    $stmt = $pdo->prepare("
      INSERT INTO EventRegister (
        id, event_id, name, telephone, email, emergency_contact, dob,
        allergies_or_medical_requirements, accepted_gdpr, accepted_event_policy, paid
      ) VALUES (
        UUID(), :event_id, :name, :telephone, :email, :emergency_contact, :dob,
        :allergies_or_medical_requirements, :accepted_gdpr, :accepted_event_policy, :paid
      )
    ");
    $stmt->execute([
      'event_id' => $event_id,
      'name' => $name,
      'telephone' => $telephone,
      'email' => $email,
      'emergency_contact' => $emergency_contact,
      'dob' => $dob,
      'allergies_or_medical_requirements' => $allergies_or_medical_requirements,
      'accepted_gdpr' => $accepted_gdpr,
      'accepted_event_policy' => $accepted_event_policy,
      'paid' => $payment_optional ? true : false
    ]);
    http_response_code(200);
    echo json_encode(['message' => 'Booking successful']);
  } catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database query failed']);
  }
?>
