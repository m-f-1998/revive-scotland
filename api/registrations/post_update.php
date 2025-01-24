<?php

/*
  * @author: Matthew Frankland
  * @date: 2021-06-14 16:00:00
  * @last modified by:   Matthew Frankland
  * @last modified time: 2021-06-14 16:00:00
*/

/*
  * This script is used to create a registration.
  * Parameters:
  *   - id: The ID of the registration.
  *   - paid: The payment status of the registration.
  * Response:
  *   - 200: The registration was successfully updated.
  *   - 400: Invalid input.
  *   - 404: Registration not found.
  *   - 500: Database error.
*/

  header ( "Content-Type: application/json; charset=utf-8" );
  header ( "Access-Control-Allow-Methods: POST, OPTIONS" );
  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  require "../vendor/autoload.php";
  use PHPMailer\PHPMailer\PHPMailer;
  use PHPMailer\PHPMailer\Exception;

  $contentType = isset ( $_SERVER [ "CONTENT_TYPE" ] ) ? trim ( $_SERVER [ "CONTENT_TYPE" ] ) : "";

  include_once "../controller/db.php";
  $conn = db_connection ( );
  $_POST = json_decode ( file_get_contents ( "php://input" ), true );

  try {
    if (
      !isset ( $_POST [ "id" ] ) ||
      !isset ( $_POST [ "paid" ] )
    ) {
      http_response_code ( 400 );
      echo json_encode ( "Invalid Input" );
      exit ( );
    }

    $_POST [ "id" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "id" ] ) ) );
    $_POST [ "paid" ] = filter_var ( $_POST [ "paid" ], FILTER_SANITIZE_NUMBER_INT );

    $query = $conn->prepare ( "SELECT * FROM `EventRegister` WHERE `id`=:id AND `cancelled` = 0" );
    $query->execute ( [ "id" => $_POST [ "id" ] ] );
    if ( $query->rowCount ( ) === 0 ) {
      http_response_code ( 404 );
      echo json_encode ( "Registration Not Found" );
      exit ( );
    }
    $register = $query->fetch ( PDO::FETCH_ASSOC );

    $stmt = $conn->prepare ( "UPDATE `EventRegister` SET `paid`=:paid WHERE `id`=:id" );
    $stmt->execute ( [
      "paid" => $_POST [ "paid" ],
      "id" => $_POST [ "id" ]
    ] );

    http_response_code ( 200 );
    echo json_encode ( "Registration Updated" );

    // Ensure output is sent immediately
    ob_flush ( );
    flush ( );

    if ( $_POST [ "paid" ] ) {
      $query = $conn->prepare ( "SELECT `title` FROM `Events` WHERE `id`=:id" );
      $query->execute ( [ "id" => $register [ "event_id" ] ] );
      $event = $query->fetch ( PDO::FETCH_ASSOC );

      send_confirmation_email (
        $register [ "email" ],
        $register [ "name" ],
        $event [ "title" ]
      );
    }
  } catch ( PDOException $e ) {
    http_response_code ( 500 );
    echo json_encode ( $e->getMessage ( ) );
  }

  function send_confirmation_email ( $email, $name, $event_title ) {
    $mail = new PHPMailer ( true );

    try {
      // Server settings
      $mail->isSMTP ( );                                    // Send using SMTP
      $mail->Host       = "smtp.mail.me.com";               // Set the SMTP server to send through
      $mail->SMTPAuth   = true;                             // Enable SMTP authentication
      $mail->Username   = "admin@matthewfrankland.co.uk";   // SMTP username
      $mail->Password   = "pjig-ffvw-pyts-qnvz";            // SMTP password
      $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;   // Enable TLS encryption; PHPMailer::ENCRYPTION_SMTPS also available
      $mail->Port       = 587;                              // TCP port to connect to

      //Recipients
      $mail->setFrom ( "admin@matthewfrankland.co.uk", "Revive Scotland" );
      $mail->addAddress ( $email, $name ); // Add a recipient
      $mail->addReplyTo ( "support@revivescotland.com", "Support" );

      // Content
      $mail->isHTML ( true );                              // Set email format to HTML
      $subject = "Payment Complete for $event_title";
      $mail->Subject = $subject;

      $message = "Dear $name,<br><br>";

      $message .= "Thank you for your payment for $event_title. We look forward to seeing you at the event.<br><br>";
      $message .= "God bless,<br>";
      $message .= "Revive Scotland";

      $mail->Body = $message;

      // Send the email
      $mail->send ( );
    } catch ( Exception $e ) {
      echo json_encode ( "Email failed: {$mail->ErrorInfo}" );
      http_response_code ( 500 );
      exit ( );
    }
  }