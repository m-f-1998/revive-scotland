<?php
  use PHPMailer\PHPMailer\PHPMailer;
  use PHPMailer\PHPMailer\Exception;

  require "vendor/autoload.php";
  \Stripe\Stripe::setApiKey ( "sk_test_51PqghM00eYCjdRhRAa4N59BXb78bsZyEu8MisDnUQH0OdsqVXtZY1SupN7nkHJGLg2K3w39s2tm7FAmLZpN5TuiJ00x2n0ZVoq" ); // TODO: Replace With Your Stripe Secret Key And Add To Environment Variables

  $contentType = isset ( $_SERVER [ "CONTENT_TYPE" ] ) ? trim ( $_SERVER [ "CONTENT_TYPE" ] ) : "";

  if ( strpos ( $contentType, "multipart/form-data" ) !== false ) {
    header ( "Access-Control-Allow-Methods: POST" );
  } else {
    header ( "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS" );
    $_POST = json_decode ( file_get_contents ( "php://input" ), true );
  }

  header ( "Content-Type: application/json; charset=utf-8" );
  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  include_once "controller/db.php";
  $conn = db_connection ( );

  try {
    $headers = getallheaders ( );

    switch ( $_SERVER [ "REQUEST_METHOD" ] ) {
      case "GET":
        echo json_encode ( get_events ( $conn, $headers ) );
        break;
      case "POST":
        include_once "controller/authenticate.php";
        $user = getUser ( );
        setup_security ( );

        if (
          !isset ( $_POST [ "title" ] ) ||
          !isset ( $_POST [ "description" ] ) ||
          !isset ( $_POST [ "location" ] ) ||
          !isset ( $_POST [ "price" ] ) ||
          !isset ( $_POST [ "date_from" ] ) ||
          !isset ( $_POST [ "payment_required" ] ) ||
          !isset ( $_POST [ "policy_id" ] ) ||
          !isset ( $_POST [ "gdpr_id" ] )
        ) {
          http_response_code ( 400 );
          echo json_encode ( "Missing required fields" );
          exit ( );
        }

        $_POST [ "title" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "title" ] ) ) );
        $_POST [ "description" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "description" ] ) ) );
        $_POST [ "location" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "location" ] ) ) );
        $_POST [ "price" ] = filter_var ( $_POST [ "price" ], FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION );
        $_POST [ "date_from" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "date_from" ] ) ) );
        $_POST [ "date_to" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "date_to" ] ) ) );
        $_POST [ "payment_required" ] = filter_var ( $_POST [ "payment_required" ], FILTER_SANITIZE_NUMBER_INT );
        $_POST [ "policy_id" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "policy_id" ] ) ) );
        $_POST [ "gdpr_id" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "gdpr_id" ] ) ) );

        $saved_files = save_files ( $conn, $headers );

        if ( isset ( $_POST [ "id" ] ) ) {
          $_POST [ "id" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "id" ] ) ) );
          check_event_register ( $conn );
          update_event ( $conn, $saved_files );
          http_response_code ( 204 );
        } else {
          insert_event ( $conn, $saved_files );
          http_response_code ( 201 );
        }

        session_regenerate_id ( );
        break;
      case "DELETE":
        include_once "controller/authenticate.php";
        $user = getUser ( );
        setup_security ( );

        if ( !isset ( $_POST [ "id" ] ) ) {
          http_response_code ( 400 );
          echo json_encode ( "Missing required fields" );
          exit ( );
        }

        $_POST [ "id" ] = htmlspecialchars ( strip_tags ( trim ( $_POST [ "id" ] ) ) );

        $events = get_events ( $conn, $headers, $_POST [ "id" ] );
        if ( count ( $events ) === 0 ) {
          http_response_code ( 404 );
          echo json_encode ( "Event not found" );
          exit ( );
        }

        $event = $events [ 0 ];

        if ( $event [ "cancelled" ] ) {
          echo json_encode ( "Event Already Cancelled" );
          http_response_code ( 500 );
          exit ( );
        }

        if ( is_file ( $event [ "featured_image" ] ) ) {
          unlink ( $event [ "featured_image" ] );
        }
        if ( is_file ( $event [ "poster_link" ] ) ) {
          unlink ( $event [ "poster_link" ] );
        }
        if ( is_file ( $event [ "timetable_link" ] ) ) {
          unlink ( $event [ "timetable_link" ] );
        }

        $stmt = $conn->prepare ( "SELECT * FROM EventRegister WHERE event_id = :event_id" );
        $stmt->execute ( [
          "event_id" => $_POST [ "id" ]
        ] );
        $registrations = $stmt->fetchAll ( PDO::FETCH_ASSOC );

        foreach ( $registrations as $registration ) {
          if ( $registration [ "cancelled" ] ) {
            continue;
          }
          if ( $registration [ "paid" ] && $registration [ "payment_required" ] ) {
            if (
              $charge->rowCount ( ) === 0
            ) {
              http_response_code ( 404 );
              header ( "Location: http://localhost:4200/payment-complete?success=0&error=" . urlencode ( "Charge Not Found" ) );
              exit ( );
            }

            if ( $charge [ "refunded" ] ) {
              http_response_code ( 400 );
              header ( "Location: http://localhost:4200/payment-complete?success=0&error=" . urlencode ( "Charge Already Refunded" ) );
              exit ( );
            }

            refundCustomer ( $charge [ "charge_id" ] );
            $stmt = $conn->prepare ( "UPDATE `StripeCharges` SET `refunded`=TRUE WHERE `customer_id`=:customer && `event_id`=:event" );
            $stmt->execute ( [ "customer" => $registration [ "customer_id" ], "event" => $registration [ "event_id" ] ] );
          }

          send_cancellation_email (
            $registration [ "email" ],
            $registration [ "name" ],
            $event [ "title" ],
            $event [ "location" ],
            $_POST [ "id" ]
          );
        }

        $stmt = $conn->prepare ( "UPDATE EventRegister SET `cancelled` = 1 WHERE event_id = :event_id" );
        $stmt->execute ( [
          "event_id" => $_POST [ "id" ]
        ] );

        $stmt = $conn->prepare ( "UPDATE Events SET `cancelled` = 1 WHERE id = :id" );
        $stmt->execute ( [
          "id" => $_POST [ "id" ]
        ] );

        session_regenerate_id ( );

        echo json_encode ( "Event Cancelled" );
        break;
      default:
        http_response_code ( 405 );
        echo json_encode ( "Method not allowed" );
    }
  } catch ( PDOException $e ) {
    http_response_code ( 500 );
    echo json_encode ( $e->getMessage ( ) );
  }

  function check_event_register ( $conn ) {
    $stmt = $conn->prepare ( "SELECT * FROM `EventRegister` WHERE event_id = :event_id" );
    $stmt->execute ( [
      "event_id" => $_POST [ "id" ]
    ] );
    $registrations = $stmt->fetchAll ( PDO::FETCH_ASSOC );
    if ( !empty ( $registrations ) ) {
      http_response_code ( 409 );
      echo json_encode ( "This Event Already has Registrations" );
      exit ( );
    }
  }

  function get_events ( $conn, $headers, $id = null ) {
    $stmt = $conn->query ( "SELECT
        e.`id`,
        e.`title`,
        e.`description`,
        e.`date_from`,
        e.`date_to`,
        e.`location`,
        e.`featured_image`,
        e.`poster_link`,
        e.`timetable_link`,
        e.`price`,
        e.`payment_required`,
        e.`policy_id`,
        e.`gdpr_id`,
        e.`cancelled`,
        p1.`title` AS `policy_title`,
        p1.`description` AS `policy_description`,
        p2.`title` AS `gdpr_title`,
        p2.`description` AS `gdpr_description`
    FROM
        `Events` e
    LEFT JOIN
        `Policies` p1 ON e.`policy_id` = p1.`id`
    LEFT JOIN
        `Policies` p2 ON e.`gdpr_id` = p2.`id`
    WHERE
      e.`cancelled` = 0
      " . ( !is_null ( $id ) ? "AND e.`id` = '" . $id . "'" : "" ) . "
    ORDER BY
      e.date_from;" );


    return $stmt->fetchAll ( PDO::FETCH_ASSOC );
  }

  function update_event ( $conn, $saved_files ) {
    $stmt = $conn->prepare ( "UPDATE Events SET
      `title` = :title,
      `description` = :description,
      `date_from` = :date_from,
      `date_to` = :date_to,
      `location` = :location,
      " . ( !isset ( $_POST [ "featured_image" ] ) ? "" : "`featured_image` = :featured_image," ) . "
      " . ( !isset ( $_POST [ "poster_link" ] ) ? "" : "`poster_link` = :poster_link," ) . "
      " . ( !isset ( $_POST [ "timetable_link" ] ) ? "" : "`timetable_link` = :timetable_link," ) . "
      `price` = :price,
      `payment_required` = :payment_required,
      `policy_id` = :policy_id,
      `gdpr_id` = :gdpr_id
    WHERE id = :id" );

    $stmt->execute ( array_merge ( [
      "id" => $_POST [ "id" ],
      "title" => $_POST [ "title" ],
      "description" => $_POST [ "description" ],
      "date_from" => $_POST [ "date_from" ],
      "date_to" => $_POST [ "date_to" ] ? $_POST [ "date_to" ] : null,
      "location" => $_POST [ "location" ],
      "price" => $_POST [ "price" ],
      "payment_required" => $_POST [ "payment_required" ],
      "policy_id" => $_POST [ "policy_id" ],
      "gdpr_id" => $_POST [ "gdpr_id" ]
    ], $saved_files ) );
  }

  function get_asset_url ( ) {
    return "assets/";
  }

  function send_cancellation_email ( $email, $name, $event_title, $event_location, $registration_id ) {
    $mail = new PHPMailer ( true );

    try {
      //Server settings
      $mail->isSMTP ( );                                    // Send using SMTP
      $mail->Host       = "smtp.mail.me.com";               // Set the SMTP server to send through
      $mail->SMTPAuth   = true;                             // Enable SMTP authentication
      $mail->Username   = "admin@matthewfrankland.co.uk";   // SMTP username
      $mail->Password   = "pjig-ffvw-pyts-qnvz";            // SMTP password
      $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;   // Enable TLS encryption; PHPMailer::ENCRYPTION_SMTPS also available
      $mail->Port       = 587;                              // TCP port to connect to

      //Recipients
      $mail->setFrom ( "admin@matthewfrankland.co.uk", "Revive Scotland" );
      $mail->addAddress ( $email, $name );                     // Add a recipient
      $mail->addReplyTo ( "support@revivescotland.com", "Support" );

      // Content
      $mail->isHTML ( true );                                  // Set email format to HTML
      $mail->Subject = "$event_title Has Been Cancelled";

      $message = "Dear $name,<br><br>";
      $message .= "We regret to inform you that the event titled <strong>$event_title</strong>, scheduled to take place at <strong>$event_location</strong>, has been cancelled by the event organizers. We apologize for any inconvenience this may cause.<br><br>";
      $message .= "Refunds for your registration will be processed shortly. If you have any questions regarding your refund or if you would like to register for another event in the future, please do not hesitate to reach out.<br><br>";
      $message .= "If you have any concerns or require further assistance, please contact us at <a href=\"mailto:support@revivescotland.com\">support@revivescotland.com</a>.<br><br>";
      $message .= "Thank you for your understanding, and we hope to see you at future Revive Scotland events.<br><br>";
      $message .= "God Bless,<br>";
      $message .= "Revive Scotland";

      $mail->Body = $message;

      // Send the email
      $mail->send ( );
    } catch (Exception $e) {
      echo json_encode ( "Email failed: {$mail->ErrorInfo}" );
      http_response_code ( 500 );
      exit ( );
    }
  }

  function insert_event ( $conn, $saved_files ) {
    $stmt = $conn->prepare ( "INSERT INTO Events (
      `title`,
      `description`,
      `date_from`,
      `date_to`,
      `location`,
      " . ( array_key_exists ( "featured_image", $saved_files ) ? "`featured_image`," : "" ) . "
      " . ( array_key_exists ( "poster_link", $saved_files ) ? "`poster_link`," : "" ) . "
      " . ( array_key_exists ( "timetable_link", $saved_files ) ? "`timetable_link`," : "" ) . "
      `price`,
      `payment_required`,
      `policy_id`,
      `gdpr_id`
    ) VALUES (
      :title,
      :description,
      :date_from,
      :date_to,
      :location,
      " . ( array_key_exists ( "featured_image", $saved_files ) ? ":featured_image," : "" ) . "
      " . ( array_key_exists ( "poster_link", $saved_files ) ? ":poster_link," : "" ) . "
      " . ( array_key_exists ( "timetable_link", $saved_files ) ? ":timetable_link," : "" ) . "
      :price,
      :payment_required,
      :policy_id,
      :gdpr_id
    )" );

    $stmt->execute ( array_merge ( [
      "title" => $_POST [ "title" ],
      "description" => $_POST [ "description" ],
      "date_from" => $_POST [ "date_from" ],
      "date_to" => $_POST [ "date_to" ] ? $_POST [ "date_to" ] : null,
      "location" => $_POST [ "location" ],
      "price" => $_POST [ "price" ],
      "payment_required" => $_POST [ "payment_required" ],
      "policy_id" => $_POST [ "policy_id" ],
      "gdpr_id" => $_POST [ "gdpr_id" ]
    ], $saved_files ) );

    if ( $_POST [ "payment_required" ] ) {
      $eventID = $conn->lastInsertId ( );
      $payment_link = createStripePaymentLink ( $eventID, $_POST [ "title" ], $_POST [ "price" ] );
      $stmt = $conn->prepare ( "UPDATE Events SET `payment_link` = :payment_link WHERE id = :id" );
      $stmt->execute ( [
        "id" => $eventID,
        "payment_link" => $payment_link
      ] );
    }
  }

  function save_files ( $conn, $headers ) {
    if ( !isset ( $_POST [ "id" ] ) ) {
      $name = $_POST [ "title" ];
    } else {
      $event = get_events ( $conn, $headers, $_POST [ "id" ] );
      if ( count ( $event ) > 0 ) {
        $event = $event [ 0 ];
        $name = $event [ "title" ];
      } else {
        http_response_code ( 404 );
        echo json_encode ( "Event not found" );
        exit ( );
      }
    }

    $files = array ( );

    foreach ( $_FILES as $key => $file ) {
      $file_name = $file [ "name" ];
      $file_size = $file [ "size" ];
      $file_tmp = $file [ "tmp_name" ];
      $file_type = $file [ "type" ];
      $file_ext = strtolower ( pathinfo ( $file_name, PATHINFO_EXTENSION ) );

      $extensions = [ "jpeg", "jpg", "png", "pdf" ];

      if ( in_array ( $file_ext, $extensions ) === false ) {
        http_response_code ( 400 );
        echo json_encode ( "'" . $file_name . "' File extension not allowed, please choose a JPEG, JPG, PNG or PDF file." );
        exit ( );
      }

      $upload_path = get_asset_url ( ) . urlencode ( str_replace ( " ", "-", $name ) . "-" . $key ) . "." . $file_ext;
      $files [ $key ] = $upload_path;

      $file_exists = glob ( get_asset_url ( ) . urlencode ( str_replace ( " ", "-", $name ) . "-" . $key ) . ".*" );
      if ( count ( $file_exists ) > 0 ) {
        unlink ( $file_exists [ 0 ] );
      }

      if ( move_uploaded_file ( $file_tmp, $upload_path ) ) {
        return $files;
      } else {
        http_response_code ( 500 );
        echo json_encode ( "Failed to upload file" );
        exit ( );
      }
    }
  }

  function createStripePaymentLink ( $eventID, $eventName, $eventPrice ) {
    $product = \Stripe\Product::create ( [
      "name" => $eventName,
      "metadata" => [
        "event_id" => $eventID,
      ]
    ] );

    $price = \Stripe\Price::create ( [
      "product" => $product->id,
      "unit_amount" => $eventPrice * 100,
      "currency" => 'gbp',
    ] );

    $paymentLink = \Stripe\PaymentLink::create ( [
      "line_items" => [ [
        "price" => $price->id,
        "quantity" => 1,
      ] ],
      "metadata" => [
        "event_id" => $eventId,
      ]
    ] );

    return $paymentLink->url;
  }

  function refundCustomer ( $chargeId ) {
    $refund = \Stripe\Refund::create ( [
      "charge" => $chargeId,
    ] );
    return $refund;
  }