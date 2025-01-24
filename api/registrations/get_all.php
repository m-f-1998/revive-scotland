<?php

/*
  * @author: Matthew Frankland
  * @date: 2021-06-14 16:00:00
  * @last modified by:   Matthew Frankland
  * @last modified time: 2021-06-14 16:00:00
*/

/*
  * This script is used to get all registrations.
  * Parameters:
  *   - None
  * Response:
  *   - 200: The registrations were successfully retrieved.
  *   - 500: Database error.
  * Response Data:
  *   - An array of registrations.
*/

  header ( "Content-Type: application/json; charset=utf-8" );
  header ( "Access-Control-Allow-Methods: GET, OPTIONS" );
  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth" );

  include_once "../controller/db.php";
  $conn = db_connection ( );
  $_POST = json_decode ( file_get_contents ( "php://input" ), true );

  try {
    include_once "../controller/authenticate.php";
    $user = getUser ( );
    $headers = getallheaders ( );
    echo json_encode ( get_registrations ( $conn, $headers ) );
  } catch ( PDOException $e ) {
    http_response_code ( 500 );
    echo json_encode ( $e->getMessage ( ) );
  }

  function get_registrations ( $conn, $headers ) {
    $stmt = $conn->query ( "SELECT
        er.`id`,
        er.`name`,
        er.`telephone`,
        er.`email`,
        er.`emergency_contact_name`,
        er.`emergency_contact_number`,
        er.`dob`,
        er.`allergies_or_medical_requirements`,
        er.`accepted_gdpr`,
        er.`accepted_event_policy`,
        er.`paid`,
        e.`title` as `event_title`,
        e.`description`,
        e.`location`,
        e.`price`,
        e.`date_from`,
        e.`payment_required`,
        p1.`title` AS `policy`,
        p1.`description` AS `policy_description`,
        p2.`title` AS `gdpr`,
        p2.`description` AS `gdpr_description`
    FROM `EventRegister` er
      LEFT JOIN
        `Events` e ON er.`event_id` = e.`id`
      LEFT JOIN
        `Policies` p1 ON e.`policy_id` = p1.`id`
      LEFT JOIN
        `Policies` p2 ON e.`gdpr_id` = p2.`id`;" );
    return $stmt->fetchAll ( PDO::FETCH_ASSOC );
  }