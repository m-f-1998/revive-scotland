<?php
  /**
   * Rate limiting function (example: 100 requests per hour per IP)
   */
  function rateLimit ( ) {

    $ip = $_SERVER [ "REMOTE_ADDR" ];
    $key = "rate_limit_$ip";
    $limit = 100;
    $timeFrame = 3600; // 1 hour

    if ( !isset ( $_SESSION ) ) {

      session_start ( );

    }

    if ( !isset ( $_SESSION [ $key ] ) ) {

      $_SESSION [ $key ] = [ "count" => 0, "timestamp" => time ( ) ];

    }

    $rateData = $_SESSION [ $key ];

    if ( time ( ) - $rateData [ "timestamp" ] > $timeFrame ) {

      $rateData [ "count" ] = 0;
      $rateData [ "timestamp" ] = time ( );

    }

    if ( $rateData [ "count" ] >= $limit ) {

      http_response_code ( 429 );
      echo json_encode ( [ "error" => "Rate limit exceeded" ] );
      exit;

    }

    $rateData [ "count" ]++;
    $_SESSION [ $key ] = $rateData;

  }

  include "config.php";
  include "api.php";

  $allowed_origins = [
    "https://revivescotland.co.uk",
    "http://localhost:4200"
  ];

  if ( isset ( $_SERVER [ "HTTP_ORIGIN" ] ) && in_array ( $_SERVER [ "HTTP_ORIGIN" ], $allowed_origins ) ) {

    header ( "Access-Control-Allow-Origin: " . $_SERVER [ "HTTP_ORIGIN" ] );

  }

  header ( "Content-Type: application/json; charset=utf-8" );
  header ( "Access-Control-Allow-Methods: GET, OPTIONS" );
  header ( "Access-Control-Allow-Headers: Origin, Content-Type" );

  header ( "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none';" );
  header ( "X-Content-Type-Options: nosniff" );
  header ( "X-Frame-Options: DENY" );
  header ( "X-XSS-Protection: 1; mode=block" );
  header ( "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" );

  // Rate limiting (example: 100 requests per hour per IP)
  rateLimit ( );

  if ( $_SERVER [ "REQUEST_METHOD" ] === "GET" ) {

    $url = EVENTBRITE_API_URL . "users/me/organizations";
    $organization_id = fetchFromEventbrite ( $url ) [ "organizations" ] [ 0 ] [ "id" ] ?? "";

    $url = EVENTBRITE_API_URL . "organizations/" . strval ( $organization_id ) . "/events?status=live&expand=venue,ticket_classes,refund_policy";
    $userEvents = fetchFromEventbrite ( $url );

    echo json_encode ( $userEvents [ "events" ] );

  }