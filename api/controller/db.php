<?php
  if ( $_SERVER [ "REQUEST_METHOD" ] === "OPTIONS" ) {
    header ( "HTTP/1.1 200 OK" );
    exit ( );
  }

  function db_connection ( ) {
    // TODO: Make Enviroment Variables
    $host = "localhost";
    $dbname = "ReviveScotland";
    $username = "root";
    $password = "%(80?%^49IKe;f-p?O#a";

    try {
      $pdo = new PDO ( "mysql:host=$host;dbname=$dbname", $username, $password );
      $pdo->setAttribute ( PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION );
      return $pdo;
    } catch ( PDOException $e ) {
      http_response_code ( 500 );
      echo json_encode ( "Database connection failed" );
      exit ( );
    }
  }

  function setup_security ( ) {
    session_start ( );
    $limit = 5;
    $time_frame = 60;

    if ( !isset ( $_SESSION [ "registration_attempts" ] ) ) {
      $_SESSION [ "registration_attempts" ] = [ ];
    }

    $_SESSION [ "registration_attempts" ] = array_filter ( $_SESSION [ "registration_attempts" ], function ( $timestamp ) use ( $time_frame ) {
      return $timestamp > time ( ) - $time_frame;
    } );

    if ( count ( $_SESSION [ "registration_attempts" ] ) < $limit ) {
      $_SESSION [ "registration_attempts" ] [ ] = time ( );
    } else {
      http_response_code ( 429 );
      echo json_encode ( "Too many registration attempts. Please try again later." );
      exit ( );
    }

    if ( !empty ( $_POST [ "honeypot" ] ) ) {
      http_response_code ( 403 );
      echo json_encode ( "Bot detected. Registration not allowed." );
      exit ( );
    }
  }