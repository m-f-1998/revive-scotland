<?php
  header ( "Content-Type: application/json; charset=utf-8" );
  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Methods: POST, OPTIONS" );
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  include_once "controller/db.php";

  $conn = db_connection ( );
  $headers = getallheaders ( );
  $secretKey = getenv ( "JWT_SECRET" );

  include_once "controller/authenticate.php";

  $_POST = json_decode ( file_get_contents ( "php://input" ), true );

  if ( !isset ( $_POST [ "username" ] ) || !isset ( $_POST [ "password" ] ) ) {
    if ( isset ( $headers [ "X-Auth" ] ) && $headers [ "X-Auth" ] !== "" ) {
      $user = getUser ( );
      if ( $user ) {
        echo json_encode ( [
          "message" => "Login successful",
          "jwt" => $headers [ "X-Auth" ],
          "user" => $user [ "data" ]
        ] );
        exit ( );
      }
    }
  }

  if ( $_SERVER [ "REQUEST_METHOD" ] !== "POST" ) {
    http_response_code ( 405 );
    echo json_encode ( "Method not Allowed" );
    exit ( );
  }

  if ( !isset ( $_POST [ "username" ] ) || !isset ( $_POST [ "password" ] ) ) {
    http_response_code ( 400 );
    echo json_encode ( "Username and Password are Required" );
    exit ( );
  }

  $username = htmlspecialchars ( strip_tags ( trim ( $_POST [ "username" ] ) ) );
  $password = $_POST [ "password" ];

  try {
    $stmt = $conn->prepare ( "SELECT * FROM Login WHERE username = :username" );
    $stmt->execute ( [ "username" => $username ] );
    $user = $stmt->fetch ( PDO::FETCH_ASSOC );

    if ( !$user || !password_verify ( $password, $user [ "password" ] ) ) {
      http_response_code ( 401 );
      echo json_encode ( "Invalid Credentials" );
      exit ( );
    }

    // Update last login time
    $stmt = $conn->prepare ( "UPDATE Login SET last_login = NOW() WHERE id = :id" );
    $stmt->execute ( [ "id" => $user [ "id" ] ] );

    // Generate JWT
    $header = [
      "alg" => "HS256",
      "typ" => "JWT"
    ];

    $payload = [
      "iat" => time ( ),
      "exp" => time ( ) + ( 60 * 60 ), // Token valid for 1 hour
      "data" => [
        "username" => $user [ "username" ],
        "email" => $user [ "email" ],
        "permissions" => $user [ "permissions" ]
      ]
    ];

    $jwt = generateJWT ( $header, $payload, $secretKey );

    http_response_code ( 200 );
    echo json_encode ( [
      "message" => "Login successful",
      "jwt" => $jwt,
      "user" => [
        "username" => $user [ "username" ],
        "email" => $user [ "email" ],
        "permissions" => $user [ "permissions" ]
      ]
    ] );
} catch ( PDOException $e ) {
  http_response_code ( 500 );
  echo json_encode ( "Database query failed" );
}
?>
