<?php

/*
  * @Author: Matthew Frankland
  * @Date: 2021-06-15 09:00:00
  * @Last Modified by:   Matthew Frankland
  * @Last Modified time: 2021-06-15 09:00:00
*/

/*
  * This script is used to handle the completion of a payment.
  * It will confirm the payment and update the registration status.
  * Parameters:
  *   - session_id: The Stripe session ID.
  * Response:
  *   - 200: The payment was successfully completed.
  *   - 400: Invalid request or session not found.
  *   - 500: Database error.
  * Response Data:
  *   - success: 1 if successful, 0 otherwise.
  *   - error: The error message if success is 0.
*/

require 'vendor/autoload.php';
\Stripe\Stripe::setApiKey ( "sk_test_51PqghM00eYCjdRhRAa4N59BXb78bsZyEu8MisDnUQH0OdsqVXtZY1SupN7nkHJGLg2K3w39s2tm7FAmLZpN5TuiJ00x2n0ZVoq" ); // TODO: Replace With Your Stripe Secret Key And Add To Environment Variables

header ( "Content-Type: application/json; charset=utf-8" );
header ( "Access-Control-Allow-Methods: GET, OPTIONS" );
header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

try {
  include_once "../controller/db.php";
  $conn = db_connection ( );

  if ( $_SERVER [ "REQUEST_METHOD" ] === "OPTIONS" ) {
    exit ( );
  }

  if ( $_SERVER [ "REQUEST_METHOD" ] !== "GET" ) {
    http_response_code ( 405 );
    header ( "Location: http://localhost:4200/cancellation?success=0&error=" . urlencode ( "Method Not Allowed" ) );
    exit ( );
  }

  setup_security ( );

  if ( !isset ( $_GET[ "session_id" ] ) ) {
    http_response_code ( 400 );
    header ( "Location: http://localhost:4200/payment-complete?success=0&message=" . urlencode( "Invalid Request" ) );
    exit ( );
  }

  $_GET [ "session_id" ] = htmlspecialchars ( strip_tags ( trim ( $_GET [ "session_id" ] ) ) );

  $query = $conn->prepare ( "SELECT * FROM `StripeCharges` WHERE `session_id` = :session_id" );
  $query->execute ( [ "session_id" => $_GET [ "session_id" ] ] );
  $session = $query->fetch ( PDO::FETCH_ASSOC );

  if ( $query->rowCount ( ) === 0 ) {
      http_response_code ( 404 );
      header ( "Location: http://localhost:4200/payment-complete?success=0&message=" . urlencode ( "Session Not Found" ) );
      exit ( );
  }

  // Update the registration to mark it as paid
  $stmt = $conn->prepare ( "UPDATE `EventRegister` SET `paid`=TRUE WHERE `id`=:registration_id" );
  $stmt->execute ( [
    "registration_id" => $session [ "registration_id" ],
  ] );

  session_regenerate_id ( );
  header ( "Location: http://localhost:4200/payment-complete?success=1" );
} catch ( PDOException $e ) {
  http_response_code ( 500 );
  header ( "Location: http://localhost:4200/payment-cancelled?success=0&message=" . urlencode( "Database Error" ) );
}