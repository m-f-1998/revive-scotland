<?php
  /**
   * Fetch data from Eventbrite API.
   */
  function fetchFromEventbrite ( $url ) {

    $ch = curl_init ( );
    curl_setopt ( $ch, CURLOPT_URL, $url );
    curl_setopt ( $ch, CURLOPT_RETURNTRANSFER, true );
    curl_setopt ( $ch, CURLOPT_HTTPHEADER, [
      "Content-Type: application/json",
      "Authorization: Bearer " . EVENTBRITE_OAUTH_TOKEN,
    ] );
    curl_setopt ( $ch, CURLOPT_FOLLOWLOCATION, true ); // Follow 301 redirects

    $response = curl_exec ( $ch );
    $httpCode = curl_getinfo ( $ch, CURLINFO_HTTP_CODE );
    curl_close ( $ch );

    $json = json_decode ( $response, true );

    if ( $httpCode !== 200 ) {

      http_response_code ( $httpCode );
      die ( json_encode ( [
        "error" => $json [ "error" ] ?? "Unknown error",
        "error_description" => $json [ "error_description" ] ?? "",
        "status" => $httpCode
      ] ) );

    }

    return $json;

  }
