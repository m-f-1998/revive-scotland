<?php
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: *'); // TODO: Remove On Production
  header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
  header('Access-Control-Allow-Headers: Origin, Content-Type, X-Auth');

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
        echo json_encode ( get_policies ( $conn, $headers ) );
        break;
      case "POST":
        include_once "controller/authenticate.php";
        $user = getUser ( );

        $_POST = json_decode ( file_get_contents ( "php://input" ), true );

        if (
          !isset ( $_POST [ "title" ] ) ||
          !isset ( $_POST [ "description" ] ) ||
          !isset ( $_POST [ "category" ] )
        ) {
          http_response_code ( 400 );
          echo json_encode ( "Missing required fields" );
          exit ( );
        }

        if ( isset ( $_POST [ "id" ] ) ) {
          check_policy_not_used ( $conn );
          update_policy ( $conn );
        } else {
          $stmt = $conn->prepare ( "INSERT INTO `Policies` (
            `title`,
            `description`,
            `category_id`
          ) VALUES (
            :title,
            :description,
            (SELECT id FROM `PolicyCategories` WHERE `name` = :category)
          )" );
          $stmt->execute ( [
            "title" => $_POST [ "title" ],
            "description" => $_POST [ "description" ],
            "category" => $_POST [ "category" ]
          ] );
        }
        http_response_code ( 204 );
        break;
      case "DELETE":
        include_once "controller/authenticate.php";
        $user = getUser ( );

        $_POST = json_decode ( file_get_contents ( "php://input" ), true );

        if ( !isset ( $_POST [ "id" ] ) ) {
          http_response_code ( 400 );
          echo json_encode ( "Missing required fields" );
          exit ( );
        }

        check_policy_not_used ( $conn );
        $stmt = $conn->prepare ( "DELETE FROM `Policies` WHERE id = :id" );
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

  function check_policy_not_used ( $conn ) {
    $stmt = $conn->prepare ( "SELECT * FROM `Events` WHERE policy_id = :policy_id OR gdpr_id = :policy_id" );
    $stmt->execute ( [
      "policy_id" => $_POST [ "id" ]
    ] );
    $event_uses = $stmt->fetchAll ( PDO::FETCH_ASSOC );
    if ( !empty ( $event_uses ) ) {
      http_response_code ( 409 );
      echo json_encode ( "This Policy is Already in Use" );
      exit ( );
    }
  }

  function get_policies ( $conn, $headers ) {
    if ( isset ( $_POST [ "id" ] ) ) {
      $stmt = $conn->prepare ( "SELECT
          " . ( isset ( $headers [ "X-Auth" ] ) ? "p.`id`," : "" ) . "
          p.`title`,
          cat.`name` AS `category`,
          " . ( isset ( $headers [ "X-Auth" ] ) ? "(SELECT GROUP_CONCAT(pc.`name`) FROM `PolicyCategories` pc) as `categories`," : "" ) . "
          p.`description`
      FROM `Policies` p
      LEFT JOIN `PolicyCategories` cat ON p.`category_id` = cat.`id`
      WHERE id = :id;" );
      $stmt->execute ( [
        "id" => $_POST [ "id" ]
      ] );
    } else {
      $stmt = $conn->query ( "SELECT
          " . ( isset ( $headers [ "X-Auth" ] ) ? "p.`id`," : "" ) . "
          p.`title`,
          cat.`name` AS `category`,
          " . ( isset ( $headers [ "X-Auth" ] ) ? "(SELECT GROUP_CONCAT(pc.`name`) FROM `PolicyCategories` pc) as `categories`," : "" ) . "
          p.`description`
      FROM `Policies` p
      LEFT JOIN `PolicyCategories` cat ON p.`category_id` = cat.`id`;" );
    }
    return $stmt->fetchAll ( PDO::FETCH_ASSOC );
  }

  function update_policy ( $conn ) {
    $stmt = $conn->prepare ( "UPDATE Events SET
      `title` = :title,
      `description` = :description,
      `category_id` = (SELECT id FROM `PolicyCategories` WHERE `name` = :category)
    WHERE id = :id" );

    $stmt->execute ( [
      "id" => $_POST [ "id" ],
      "title" => $_POST [ "title" ],
      "description" => $_POST [ "description" ],
      "category" => $_POST [ "category" ]
    ] );
  }
?>
