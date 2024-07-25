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

  $_POST = json_decode(file_get_contents('php://input'), true);

  if (!isset($_POST['type'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Type is required (event, policy)']);
    exit();
  }

  $type = htmlspecialchars(strip_tags(trim($_POST['type'])));

  try {
    switch ($type) {
      case 'event':
        $stmt = $pdo->query("SELECT
            e.title,
            e.description,
            e.date_from,
            e.date_to,
            e.location,
            e.featured_image,
            e.poster_link,
            e.timetable_link,
            e.price,
            p1.title AS policy_title,
            p1.description AS policy_description,
            p2.title AS gdpr_title,
            p2.description AS gdpr_description
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
          $stmt = $pdo->prepare("SELECT `title`, `description` FROM Policies WHERE title = :title");
          $stmt->execute(['title' => $title]);
        } else {
          $stmt = $pdo->query("SELECT `title`, `description` FROM Policies");
        }
        $policies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        http_response_code(200);
        echo json_encode($policies);
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
