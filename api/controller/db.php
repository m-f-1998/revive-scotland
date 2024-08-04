<?php
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('HTTP/1.1 200 OK');
    exit;
  }

  function db_connection ( ) {
    // TODO: Make Enviroment Variables
    $host = 'localhost';
    $dbname = 'ReviveScotland';
    $username = 'root';
    $password = '%(80?%^49IKe;f-p?O#a';
    try {
      $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
      $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      return $pdo;
    } catch (PDOException $e) {
      http_response_code(500);
      echo json_encode ( "Database connection failed" );
      exit();
    }
  }