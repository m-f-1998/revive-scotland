<?php

/*
  * @author: Matthew Frankland
  * @date: 2021-06-14 16:00:00
  * @last modified by:   Matthew Frankland
  * @last modified time: 2021-06-14 16:00:00
*/

/*
  * This script is used to login a user.
  * Parameters:
  *   - username: The username of the user.
  *   - password: The password of the user.
  * Response:
  *   - 200: The user was successfully logged in.
  *   - 400: Missing required fields.
  *   - 401: Invalid Credentials.
  *   - 405: Method Not Allowed.
  *   - 500: Database error.
  * Response Data:
  *   - A JWT token.
*/

  header ( "Content-Type: application/json; charset=utf-8" );
  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Methods: POST, OPTIONS" );
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  include_once "controller/db.php";
  $conn = db_connection ( );

  $_POST = json_decode ( file_get_contents ( "php://input" ), true );
  setup_security ( );

  $headers = getallheaders ( );
  $secretKey = getenv ( "JWT_SECRET" );

  include_once "controller/authenticate.php";

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

  if (
    !isset ( $_POST [ "username" ] ) ||
    !isset ( $_POST [ "password" ] )
  ) {
    http_response_code ( 400 );
    echo json_encode ( "Missing required fields" );
    exit ( );
  }

  $_POST [ "username" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "username" ] ) ) );
  $_POST [ "password" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "password" ] ) ) );

  try {
    $stmt = $conn->prepare ( "SELECT * FROM Login WHERE username = :username" );
    $stmt->execute ( [ "username" => $_POST [ "username" ] ] );
    $user = $stmt->fetch ( PDO::FETCH_ASSOC );

    if ( !$user || !password_verify ( $_POST [ "password" ], $user [ "password" ] ) ) {
      http_response_code ( 401 );
      echo json_encode ( "Invalid Credentials" );
      exit ( );
    }

    $stmt = $conn->prepare ( "UPDATE Login SET last_login = NOW() WHERE id = :id" );
    $stmt->execute ( [ "id" => $user [ "id" ] ] );

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
    session_regenerate_id ( );
  } catch ( PDOException $e ) {
    http_response_code ( 500 );
    echo json_encode ( "Database query failed" );
  }
?>
