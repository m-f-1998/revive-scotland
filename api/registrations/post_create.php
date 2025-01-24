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
  *   - name: The name of the registrant.
  *   - telephone: The telephone number of the registrant.
  *   - email: The email address of the registrant.
  *   - emergency_contact_name: The name of the registrant's emergency contact.
  *   - emergency_contact_number: The telephone number of the registrant's emergency contact.
  *   - dob: The date of birth of the registrant.
  *   - allergies_or_medical_requirements: Any allergies or medical requirements of the registrant.
  *   - accepted_gdpr: Whether the registrant has accepted the GDPR policy.
  *   - accepted_event_policy: Whether the registrant has accepted the event policy.
  *   - event_id: The ID of the event to register for.
  * Response:
  *   - 201: The registration was successfully created.
  *   - 400: Invalid input.
  *   - 404: Event not found.
  *   - 409: Email already registered for this event.
  *   - 500: Database error.
  * Response Data:
  *   - message: The success message.
  *   - payment_link: The payment link if payment is required.
  *   - error: The error message if success is 0.
*/

  use PHPMailer\PHPMailer\PHPMailer;
  use PHPMailer\PHPMailer\Exception;
  use Ramsey\Uuid\Uuid;

  require '../vendor/autoload.php';
  \Stripe\Stripe::setApiKey ( "sk_test_51PqghM00eYCjdRhRAa4N59BXb78bsZyEu8MisDnUQH0OdsqVXtZY1SupN7nkHJGLg2K3w39s2tm7FAmLZpN5TuiJ00x2n0ZVoq" ); // TODO: Replace With Your Stripe Secret Key And Add To Environment Variables

  $contentType = isset ( $_SERVER [ "CONTENT_TYPE" ] ) ? trim ( $_SERVER [ "CONTENT_TYPE" ] ) : "";

  if ( strpos ( $contentType, "multipart/form-data" ) !== false ) {
    header ( "Content-Type: multipart/form-data; charset=utf-8" );
  } else {
    header ( "Content-Type: application/json; charset=utf-8" );
  }

  header ( "Access-Control-Allow-Methods: POST, OPTIONS" );
  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  include_once "../controller/db.php";
  $conn = db_connection ( );
  $_POST = json_decode ( file_get_contents ( "php://input" ), true );

  try {
    if (
      !isset ( $_POST [ "name" ] ) ||
      !isset ( $_POST [ "telephone" ] ) ||
      !isset ( $_POST [ "email" ] ) ||
      !isset ( $_POST [ "emergency_contact_name" ] ) ||
      !isset ( $_POST [ "emergency_contact_number" ] ) ||
      !isset ( $_POST [ "dob" ] ) ||
      !isset ( $_POST [ "allergies_or_medical_requirements" ] ) ||
      !isset ( $_POST [ "accepted_gdpr" ] ) ||
      !isset ( $_POST [ "accepted_event_policy" ] ) ||
      !isset ( $_POST [ "event_id" ] )
    ) {
      http_response_code ( 400 );
      echo json_encode ( "Invalid Input" );
      exit ( );
    }

    $_POST [ "name" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "name" ] ) ) );
    $_POST [ "telephone" ] = filter_var ( $_POST [ "telephone" ], FILTER_SANITIZE_NUMBER_INT );
    $_POST [ "email" ] = filter_var ( $_POST [ "email" ], FILTER_SANITIZE_EMAIL );
    $_POST [ "emergency_contact_name" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "emergency_contact_name" ] ) ) );
    $_POST [ "emergency_contact_number" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "emergency_contact_number" ] ) ) );
    $_POST [ "dob" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "dob" ] ) ) );
    $_POST [ "allergies_or_medical_requirements" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "allergies_or_medical_requirements" ] ) ) );
    $_POST [ "accepted_gdpr" ] = filter_var ( $_POST [ "accepted_gdpr" ], FILTER_SANITIZE_NUMBER_INT );
    $_POST [ "accepted_event_policy" ] = filter_var ( $_POST [ "accepted_event_policy" ], FILTER_SANITIZE_NUMBER_INT );
    $_POST [ "event_id" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "event_id" ] ) ) );

    check_if_email_registered ( $conn );

    $query = $conn->prepare ( "SELECT * FROM `Events` WHERE `id`=:event_id AND `cancelled` = 0" );
    $query->execute ( [ "event_id" => $_POST [ "event_id" ] ] );
    if ( $query->rowCount ( ) === 0 ) {
      http_response_code ( 404 );
      echo json_encode ( "Event Not Found" );
      exit ( );
    }
    $event = $query->fetch ( PDO::FETCH_ASSOC );

    $registration_id = add_registration ( $conn );
    $registration_details = [
      "Name" => $_POST [ "name" ],
      "Telephone" => $_POST [ "telephone" ],
      "Email" => $_POST [ "email" ],
      "Emergency Contact Name" => $_POST [ "emergency_contact_name" ],
      "Emergency Contact Number" => $_POST [ "emergency_contact_number" ],
      "Date of Birth" => $_POST [ "dob" ],
      "Allergies or Medical Requirements" => $_POST [ "allergies_or_medical_requirements" ],
      "GDPR Consent" => $_POST [ "accepted_gdpr" ] ? "Yes" : "No",
      "Event Policy Agreement" => $_POST [ "accepted_event_policy" ] ? "Yes" : "No"
    ];

    $payment_required = $event [ "payment_required" ] == 0;

    send_registration_email (
      $_POST [ "email" ],
      $_POST [ "name" ],
      $event [ "title" ],
      $event [ "date_from" ],
      $event [ "date_to" ],
      $event [ "location" ],
      $event [ "payment_link" ],
      $registration_details,
      $registration_id,
      $payment_required,
      $event [ "featured_image" ],
      $event [ "poster_link" ],
      $event [ "timetable_link" ]
    );

    session_regenerate_id ( );

    if ( $payment_required ) {
      $checkoutSessionUrl = createCheckoutSessionWithCustomer ( $paymentLinkUrl, $customerId );

      http_response_code ( 201 );
      echo json_encode ( array (
        "message" => "Registration Added",
        "payment_link" => $checkoutSessionUrl
        ) );
    } else {
      echo json_encode ( "Registration Added" );
    }
  } catch ( PDOException $e ) {
    http_response_code ( 500 );
    echo json_encode ( $e->getMessage ( ) );
  }

  function send_registration_email ( $email, $name, $event_title, $start_event_date, $end_event_date, $event_location, $payment_link, $registration_details, $registration_id, $payment_required, $featured_image, $poster, $timetable ) {
    $mail = new PHPMailer ( true );

    $start_date_time = new DateTime ( $start_event_date );
    $formatted_start_date = $start_date_time->format ( "D jS M" );

    if ( $end_event_date ) {
      $end_date_time = new DateTime ( $end_event_date );
      $formatted_end_date = $end_date_time->format ( "D jS M" );
    } else {
      $formatted_end_date = $formatted_start_date;
    }

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
      $subject = $payment_required ? "Provisional Registration for $event_title, Payment Required" : "Your Registration for $event_title is Confirmed!";
      $mail->Subject = $subject;

      $timetable_link = "http://localhost:8000/asset.php?url=$timetable";
      $featured_image_link = "http://localhost:8000/asset.php?url=$featured_image";
      $poster_link = "http://localhost:8000/asset.php?url=$poster";
      $cancel_registration_link = "http://localhost:8000/cancel_registration.php?id=$registration_id";

      $message = "Dear $name,<br><br>";

      if ( $payment_required ) {
        $message .= "Thank you for registering for $event_title! Please note that your registration is currently <strong>provisional</strong> and will only be confirmed once payment has been received. Below are the details of your registration:<br><br>";
      } else {
        $message .= "Thank you for registering for $event_title! We're thrilled to have you join us. Below are the details of your confirmed registration:<br><br>";
      }

      if ( $payment_required ) {
        $message .= "To confirm your registration, please make your payment <a href=\"$payment_link\">here</a>.<br><br>";
      }

      $message .= "<table border='1' cellpadding='5' cellspacing='0'>";
      $message .= "<thead>";
      $message .= "<tr><th colspan='2'><b>Event Details</b></th></tr>";
      $message .= "</thead>";
      $message .= "<tbody>";
      $message .= "<tr>";
      $message .= "<td><i>Title</i></td>";
      $message .= "<td>$event_title</td>";
      $message .= "</tr>";
      $message .= "<tr>";
      $message .= "<td><i>Start Date</i></td>";
      $message .= "<td>$formatted_start_date</td>";
      $message .= "</tr>";
      $message .= "<tr>";
      $message .= "<td><i>Finish Date</i></td>";
      $message .= "<td>$formatted_end_date</td>";
      $message .= "</tr>";
      $message .= "<tr>";
      $message .= "<td><i>Location</i></td>";
      $message .= "<td>$event_location</td>";
      $message .= "</tr>";
      $message .= "</tbody>";
      $message .= "</table><br>";

      $message .= "<table border='1' cellpadding='5' cellspacing='0'>";
      $message .= "<thead>";
      $message .= "<tr><th colspan='2'><b>Your Registration Details</b></th></tr>";
      $message .= "</thead>";
      $message .= "<tbody>";
      foreach ( $registration_details as $key => $value ) {
        $message .= "<tr>";
        $message .= "<td><i>$key</i></td>";
        $message .= "<td>$value</td>";
        $message .= "</tr>";
      }
      $message .= "</tbody>";
      $message .= "</table><br>";

      $message .= "<br>Event Resources:<br>";
      if ( $timetable ) {
        $message .= "- <a href=\"$timetable_link\">Download Timetable</a><br>";
      }
      if ( $poster ) {
        $message .= "- <a href=\"$poster_link\">Download Event Poster</a><br>";
      }
      if ( $featured_image ) {
        $message .= "- <a href=\"$featured_image_link\">View Featured Image</a><br>";
      }

      $message .= "<br>If you need to cancel your registration, you can do so by clicking <a href=\"$cancel_registration_link\">here</a>.<br><br>";

      $message .= "We look forward to seeing you at the event!<br>";
      $message .= "If you have any questions, feel free to reply to this email or contact our support team at <a href=\"mailto:support@revivescotland.com\">support@revivescotland.com</a>.<br><br>";
      $message .= "Thank you for choosing us. Together, we make this event successful.<br><br>";
      $message .= "God Bless,<br>";
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

  function check_if_email_registered ( $conn ) {
    $query = $conn->prepare ( "SELECT * FROM `EventRegister` WHERE `email`=:email AND `event_id`=:event_id" );
    $query->execute ( [ "email" => $_POST [ "email" ], "event_id" => $_POST [ "event_id" ] ] );
    if ( $query->rowCount ( ) > 0 ) {
      http_response_code ( 409 );
      echo json_encode ( "This Email Is Already Registered For This Event." );
      exit ( );
    }
  }

  function add_registration ( $conn ) {
    $uuid = Uuid::uuid4();
    $stmt = $conn->prepare ( "INSERT INTO `EventRegister` (
      `id`,
      `name`,
      `telephone`,
      `email`,
      `emergency_contact_name`,
      `emergency_contact_number`,
      `dob`,
      `allergies_or_medical_requirements`,
      `accepted_gdpr`,
      `accepted_event_policy`,
      `event_id`
    ) VALUES (
      :id,
      :name,
      :telephone,
      :email,
      :emergency_contact,
      :emergency_contact_number,
      :dob,
      :allergies_or_medical_requirements,
      :accepted_gdpr,
      :accepted_event_policy,
      :event_id
    )" );

    $stmt->execute ( [
      "id" => $uuid,
      "name" => $_POST [ "name" ],
      "telephone" => $_POST [ "telephone" ],
      "email" => $_POST [ "email" ],
      "emergency_contact" => $_POST [ "emergency_contact_name" ],
      "emergency_contact_number" => $_POST [ "emergency_contact_number" ],
      "dob" => $_POST [ "dob" ],
      "allergies_or_medical_requirements" => $_POST [ "allergies_or_medical_requirements" ],
      "accepted_gdpr" => $_POST [ "accepted_gdpr" ],
      "accepted_event_policy" => $_POST [ "accepted_event_policy" ],
      "event_id" => $_POST [ "event_id" ]
    ] );

    return $uuid;
  }

  function createCheckoutSessionWithCustomer ( $paymentLinkUrl, $customerId ) {
    $paymentLink = \Stripe\PaymentLink::retrieve ( $paymentLinkUrl );
    $eventId = $paymentLink->metadata->event_id;

    $checkoutSession = \Stripe\Checkout\Session::create ( [
      "payment_method_types" => [ "card" ],
      "line_items" => [ [
          "price" => $paymentLink->line_items->data [ 0 ]->price->id,
          "quantity" => 1,
      ] ],
      "mode" => "payment",
      "customer" => $customerId,
      "client_reference_id" => $customerId,
      "metadata" => [
        "event_id" => $eventId,
      ],
      "success_url" => "http://localhost:8000/payments/complete.php?session_id={CHECKOUT_SESSION_ID}",
      "cancel_url" => "http://localhost:8000/payments/error.php?session_id={CHECKOUT_SESSION_ID}",
    ] );

    $paymentIntentId = $checkoutSession->payment_intent;

    saveStripeSession ( $conn, $checkoutSession->id, $customerId, $eventId, $paymentIntentId );

    return $checkoutSession->url;
  }

  function saveStripeSession ( $conn, $sessionId, $customerId, $eventId, $paymentIntentId ) {
    $stmt = $conn->prepare ( "INSERT INTO `StripeCharges` (
        `session_id`,
        `customer_id`,
        `event_id`,
        `payment_intent_id`
      ) VALUES (
        :session_id,
        :customer_id,
        :event_id,
        :payment_intent_id
    )" );

    $stmt->execute ( [
        "session_id" => $sessionId,
        "customer_id" => $customerId,
        "event_id" => $eventId,
        "payment_intent_id" => $paymentIntentId
    ] );
  }

