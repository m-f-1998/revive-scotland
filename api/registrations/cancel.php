<?php

/*
  * @Author: Matthew Frankland
  * @Date: 2021-06-14 16:00:00
  * @Last Modified by:   Matthew Frankland
  * @Last Modified time: 2021-06-14 16:00:00
*/

/*
  * This script is used to cancel a registration and refund the user if they have paid.
  * It will also send an email to the user to confirm the cancellation.
  * Parameters:
  *   - registration_id: The ID of the registration to cancel.
  * Response:
  *   - 200: The registration was successfully cancelled.
  *   - 400: Invalid request or charge already refunded.
  *   - 404: Registration not found or already cancelled.
  *   - 500: Database error.
  * Response Data:
  *   - success: 1 if successful, 0 otherwise.
  *   - error: The error message if success is 0.
  *   - refunded: 1 if refunded, 0 otherwise.
*/

  require '../vendor/autoload.php';
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

    if (
      !isset ( $_GET [ "registration_id" ] )
    ) {
      http_response_code ( 400 );
      header ( "Location: http://localhost:4200/cancellation?success=0&error=" . urlencode ( "Invalid Request" ) );
      exit ( );
    }

    $_GET [ "registration_id" ] = htmlspecialchars ( strip_tags ( trim ( $_GET [ "registration_id" ] ) ) );

    $query = $conn->prepare ( "SELECT * FROM `EventRegister` WHERE `id`=:registration_id" );
    $query->execute ( [ "registration_id" => $_GET [ "registration_id" ] ] );
    $registration = $query->fetch ( PDO::FETCH_ASSOC );

    $query = $conn->prepare ( "SELECT * FROM `StripeCharges` WHERE `customer_id`=:customer && `event_id`=:event" );
    $query->execute ( [ "customer" => $registration [ "customer_id" ], "event" => $registration [ "event_id" ] ] );
    $charge = $query->fetch ( PDO::FETCH_ASSOC );

    if (
      $registration->rowCount ( ) === 0 || $registration [ "cancelled" ]
    ) {
      http_response_code ( 404 );
      header ( "Location: http://localhost:4200/cancellation?success=0&error=" . urlencode ( "Registration Not Found" ) );
      exit ( );
    }

    $refunded = false;

    if ( $registration [ "paid" ] && $registration [ "payment_required" ] ) {
      if (
        $charge->rowCount ( ) === 0
      ) {
        http_response_code ( 404 );
        header ( "Location: http://localhost:4200/cancellation?success=0&error=" . urlencode ( "Charge Not Found" ) );
        exit ( );
      }

      if ( $charge [ "refunded" ] ) {
        http_response_code ( 400 );
        header ( "Location: http://localhost:4200/cancellation?success=0&error=" . urlencode ( "Charge Already Refunded" ) );
        exit ( );
      }

      refundCustomer ( $charge [ "charge_id" ] );
      $stmt = $conn->prepare ( "UPDATE `StripeCharges` SET `refunded`=TRUE WHERE `customer_id`=:customer && `event_id`=:event" );
      $stmt->execute ( [ "customer" => $registration [ "customer_id" ], "event" => $registration [ "event_id" ] ] );

      $refunded = true;
    }

    $stmt = $conn->prepare ( "UPDATE `EventRegister` SET `cancelled`=TRUE WHERE `id`=:registration_id" );
    $stmt->execute ( [
      "registration_id" => $_GET [ "registration_id" ],
    ] );

    $query = $conn->prepare ( "SELECT * FROM `Events` WHERE `id`=:id" );
    $query->execute ( [ "id" => $row [ "event_id" ] ] );
    $event = $query->fetch ( PDO::FETCH_ASSOC );

    send_cancellation_email (
      $registration [ "email" ],
      $registration [ "name" ],
      $event [ "title" ],
      $event [ "location" ],
      $_GET [ "registration_id" ]
    );

    session_regenerate_id ( );
    if ( $refunded ) {
      header ( "Location: http://localhost:4200/cancellation?success=1&refunded=1" );
      exit ( );
    }
    header ( "Location: http://localhost:4200/cancellation?success=1" );
  } catch ( PDOException $e ) {
    http_response_code ( 500 );
    header ( "Location: http://localhost:4200/cancellation?success=0&error=" . urlencode ( "Database Error" ) );
  }

  function refundCustomer ( $chargeId ) {
    $refund = \Stripe\Refund::create ( [
      "charge" => $chargeId,
    ] );
    return $refund;
  }