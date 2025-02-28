<?php
  /*
  * This is a simple mailer script that will send an email to the specified email address
  * with the specified subject and message.
  */

  $allowed_origins = [
    "https://revivescotland.co.uk",
    "https://www.revivescotland.co.uk",
    "http://localhost:4200"
  ];

  if ( isset ( $_SERVER [ "HTTP_ORIGIN" ] ) && in_array ( $_SERVER [ "HTTP_ORIGIN" ], $allowed_origins ) ) {

    header ( "Access-Control-Allow-Origin: " . $_SERVER [ "HTTP_ORIGIN" ] );

  }

  header ( "Content-Type: application/json; charset=utf-8" );
  header ( "Access-Control-Allow-Methods: POST, OPTIONS" );
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  // Handle preflight OPTIONS request
  if ( $_SERVER [ "REQUEST_METHOD" ] == "OPTIONS" ) {

    // Send a 200 OK response and exit to handle preflight request
    http_response_code ( 200 );
    exit;

  }

  session_start ( );
  // Set rate limiting per IP
  $ip = $_SERVER [ "REMOTE_ADDR" ];
  if ( !isset ( $_SESSION [ "email_attempts" ] ) ) {

    $_SESSION [ "email_attempts" ] = [ ];

  }

  // Remove attempts older than 1 hour
  $_SESSION [ "email_attempts" ] = array_filter ( $_SESSION [ "email_attempts" ], function ( $timestamp ) {
    return $timestamp > ( time ( ) - 3600 );
  } );

  // Limit to 5 submissions per hour
  if ( count ( $_SESSION [ "email_attempts" ] ) >= 5 ) {

    http_response_code ( 429 );
    echo json_encode ( "You have reached the limit of emails you can send. Please try again later." );
    exit ( );

  }

  $_SESSION [ "email_attempts" ] [ ] = time ( );

  // Rate limiting based on time
  if ( isset ( $_SESSION [ "last_submit" ] ) && time ( ) - $_SESSION [ "last_submit" ] < 60 ) {

    http_response_code ( 429 );
    echo json_encode ( "You are submitting too frequently." );
    exit ( );

  }
  $_SESSION [ "last_submit" ] = time ( );

  require "./vendor/autoload.php";
  use PHPMailer\PHPMailer\PHPMailer;
  use PHPMailer\PHPMailer\Exception;

  $_POST [ "subject" ] = strip_tags ( trim ( $_POST [ "subject" ] ) );
  $_POST [ "message" ] = nl2br ( strip_tags ( trim ( $_POST [ "message" ] ) ) );
  $_POST [ "recaptcha-token" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "recaptcha-token" ] ) ) );

  $secret = "6LebYqIqAAAAAID2ai9aMCECQMhB1LXurWtwolX5";
  $verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
  $data = [
    "secret" => $secret,
    "response" => $_POST [ "recaptcha-token" ],
    "remoteip" => $_SERVER [ "REMOTE_ADDR" ]
  ];

  if ( empty ( $_POST [ "subject" ] ) || empty ( $_POST [ "message" ] ) || empty ( $_POST [ "recaptcha-token" ] ) ) {

    http_response_code ( 400 );
    echo json_encode ( "Please fill in all fields" );
    exit ( );

  }

  // Initialize cURL request to verify the token
  $ch = curl_init ( );
  curl_setopt ( $ch, CURLOPT_URL, $verifyUrl );
  curl_setopt ( $ch, CURLOPT_POST, true );
  curl_setopt ( $ch, CURLOPT_POSTFIELDS, http_build_query ( $data ) );
  curl_setopt ( $ch, CURLOPT_RETURNTRANSFER, true );

  // Set the Content-Type header to application/x-www-form-urlencoded
  curl_setopt ( $ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/x-www-form-urlencoded"
  ] );

  $response = curl_exec ( $ch );
  curl_close ( $ch );

  $responseData = json_decode ( $response, true );

  if ( $responseData [ "success" ] ) {

    if ( time ( ) - strtotime ( $responseData [ "challenge_ts" ] ) > 300 || ( $responseData [ "hostname" ] !== "revivescotland.co.uk" && $responseData [ "hostname" ] !== "www.revivescotland.co.uk" ) || !empty ( $responseData [ "error-codes" ] ) ) {

      http_response_code ( 400 );
      echo json_encode ( "CAPTCHA verification failed." );
      exit ( );

    }

    $mail = new PHPMailer ( true );

    try {

      if ( true ) {

        http_response_code ( 400 );
        echo json_encode ( "We are currently working on our email system. Please try again later." );
        exit ( );

      }

      // Server settings
      $mail->isSMTP ( );                                    // Send using SMTP
      $mail->Host       = "smtp.gmail.com";                 // Set the SMTP server to send through
      $mail->SMTPAuth   = true;                             // Enable SMTP authentication
      $mail->Username   = "revivescotlandx@gmail.com";      // SMTP username
      $mail->Password   = "";            // SMTP password
      $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;   // Enable TLS encryption; PHPMailer::ENCRYPTION_SMTPS also available
      $mail->Port       = 587;                              // TCP port to connect to
      $mail->SMTPDebug  = 0;                                // Disable debugging output

      //Recipients
      $mail->setFrom ( "revivescotlandx@gmail.com" );
      $mail->addAddress (  "luca@revivescotland.co.uk", "Luca McQuillan" ); // Add a recipient

      // Content
      $mail->isHTML ( true );                                  // Set email format to HTML
      $mail->CharSet = PHPMailer::CHARSET_UTF8;
      $mail->Subject = "ReviveScotland WebMail: " . $_POST [ "subject" ];
      $mail->Body    = $_POST [ "message" ];
      $mail->addCustomHeader ( "X-Mailer", "PHPMailer" );
      $mail->addCustomHeader ( "X-Priority", "3" );            // Normal priority

      $mail->send ( );
      http_response_code ( 200 );
      echo json_encode ( "Email sent" );

    } catch ( Exception $e ) {

      http_response_code ( 500 );
      echo json_encode ( "Email failed: {$mail->ErrorInfo}" );
      exit ( );

    }

  } else {

    // Verification failed
    http_response_code ( 400 );
    echo json_encode ( "CAPTCHA verification failed. Please try again." );
    exit ( );

  }

