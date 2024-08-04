<?php
  $contentType = isset ( $_SERVER [ "CONTENT_TYPE" ] ) ? trim ( $_SERVER [ "CONTENT_TYPE" ] ) : "";

  if ( strpos ( $contentType, "multipart/form-data" ) !== false ) {
    header ( "Content-Type: multipart/form-data; charset=utf-8" );
    header ( "Access-Control-Allow-Methods: POST" );
  } else {
    header ( "Content-Type: application/json; charset=utf-8" );
    header ( "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS" );
  }

  header('Access-Control-Allow-Origin: *'); // TODO: Remove On Production
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  include_once "controller/db.php";

  $conn = db_connection ( );

  try {
    $headers = getallheaders ( );

    switch ( $_SERVER [ "REQUEST_METHOD" ] ) {
      case "GET":
        if ( isset ( $headers [ "X-Auth" ] ) ) {
          include_once "controller/authenticate.php";
          $user = getUser ( );
        }
        echo json_encode ( get_events ( $conn, $headers ) );
        break;
      case "POST":
        include_once "controller/authenticate.php";
        $user = getUser ( );

        if (
          !isset ( $_POST [ "title" ] ) ||
          !isset ( $_POST [ "description" ] ) ||
          !isset ( $_POST [ "location" ] ) ||
          !isset ( $_POST [ "price" ] ) ||
          !isset ( $_POST [ "date_from" ] ) ||
          !isset ( $_POST [ "suggested_price" ] ) ||
          !isset ( $_POST [ "policy_id" ] ) ||
          !isset ( $_POST [ "gdpr_id" ] )
        ) {
          http_response_code ( 400 );
          echo json_encode ( "Missing required fields" );
          exit ( );
        }

        save_files ( $conn );

        if ( isset ( $_POST [ "id" ] ) ) {
          check_event_register ( $conn );
          update_event ( $conn );
          http_response_code ( 204 );
        } else {
          insert_event ( $conn );
          http_response_code ( 201 );
        }

        break;
      case "DELETE":
        $_POST = json_decode ( file_get_contents ( "php://input" ), true );

        if ( !isset ( $_POST [ "id" ] ) ) {
          http_response_code ( 400 );
          echo json_encode ( "Missing required fields" );
          exit ( );
        }
        check_event_register ( $conn );
        $stmt = $conn->prepare ( "DELETE FROM Events WHERE id = :id" );
        $stmt->execute ( [
          "id" => $_POST [ "id" ]
        ] );
        break;
      default:
        http_response_code ( 405 );
        echo json_encode ( "Method not allowed" );
    }
  } catch ( PDOException $e ) {
    http_response_code ( 500 );
    echo json_encode ( "Database query failed" );
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

  function get_events ( $conn, $headers ) {
    $stmt = $conn->query ( "SELECT
        " . ( isset ( $headers [ "X-Auth" ] ) ? "e.`id`," : "" ) . "
        e.`title`,
        e.`description`,
        e.`date_from`,
        e.`date_to`,
        e.`location`,
        e.`featured_image`,
        e.`poster_link`,
        e.`timetable_link`,
        e.`price`,
        e.`suggested_price`,
        e.`policy_id`,
        e.`gdpr_id`,
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
    ORDER BY
        e.date_from;" );
    return $stmt->fetchAll ( PDO::FETCH_ASSOC );
  }

  function update_event ( $conn ) {
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
      `suggested_price` = :suggested_price,
      `policy_id` = :policy_id,
      `gdpr_id` = :gdpr_id
    WHERE id = :id" );

    $queryVariables = [
      "id" => $_POST [ "id" ],
      "title" => $_POST [ "title" ],
      "description" => $_POST [ "description" ],
      "date_from" => $_POST [ "date_from" ],
      "date_to" => $_POST [ "date_to" ] ? $_POST [ "date_to" ] : null,
      "location" => $_POST [ "location" ],
      "price" => $_POST [ "price" ],
      "suggested_price" => $_POST [ "suggested_price" ],
      "policy_id" => $_POST [ "policy_id" ],
      "gdpr_id" => $_POST [ "gdpr_id" ]
    ];

    if ( isset ( $_POST [ "featured_image" ] ) ) {
      $queryVariables [ "featured_image" ] = "assets/" . $_POST [ "featured_image" ];
    }

    if ( isset ( $_POST [ "poster_link" ] ) ) {
      $queryVariables [ "poster_link" ] = "assets/" . $_POST [ "poster_link" ];
    }

    if ( isset ( $_POST [ "timetable_link" ] ) ) {
      $queryVariables [ "timetable_link" ] = "assets/" . $_POST [ "timetable_link" ];
    }

    $stmt->execute ( $queryVariables );
  }

  function insert_event ( $conn ) {
    $stmt = $conn->prepare ( "INSERT INTO Events (
      `title`,
      `description`,
      `date_from`,
      `date_to`,
      `location`,
      `featured_image`,
      `poster_link`,
      `timetable_link`,
      `price`,
      `suggested_price`,
      `policy_id`,
      `gdpr_id`
    ) VALUES (
      :title,
      :description,
      :date_from,
      :date_to,
      :location,
      :featured_image,
      :poster_link,
      :timetable_link,
      :price,
      :suggested_price,
      :policy_id,
      :gdpr_id
    )" );
    $stmt->execute ( [
      "title" => $_POST [ "title" ],
      "description" => $_POST [ "description" ],
      "date_from" => $_POST [ "date_from" ],
      "date_to" => $_POST [ "date_to" ] ? $_POST [ "date_to" ] : null,
      "location" => $_POST [ "location" ],
      "featured_image" => !isset ( $_POST [ "featured_image" ] ) ? "" : "assets/" . $_POST [ "featured_image" ],
      "poster_link" => !isset ( $_POST [ "poster_link" ] ) ? "" : "assets/" . $_POST [ "poster_link" ],
      "timetable_link" => !isset ( $_POST [ "timetable_link" ] ) ? "" : "assets/" . $_POST [ "timetable_link" ],
      "price" => $_POST [ "price" ],
      "suggested_price" => $_POST [ "suggested_price" ],
      "policy_id" => $_POST [ "policy_id" ],
      "gdpr_id" => $_POST [ "gdpr_id" ]
    ] );
  }

  function save_files ( $conn ) {
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

      if ( !is_dir ( "../assets" ) ) {
        $upload_path = "../public/" . basename ( $file_name );
      } else {
        $upload_path = "../assets/" . basename ( $file_name );
      }

      if ( move_uploaded_file ( $file_tmp, $upload_path ) ) {
        return;
      } else {
        http_response_code ( 500 );
        echo json_encode ( "Failed to upload file" );
        exit ( );
      }
    }
  }
?>
