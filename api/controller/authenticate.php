<?php

  function base64UrlDecode ( $input ) {
    return base64_decode ( strtr ( $input, "-_", "+/" ) );
  }

  function base64UrlEncode ( $data ) {
    return rtrim ( strtr ( base64_encode ( $data ), "+/", "-_" ), "=" );
  }

  function authenticate ( $secretKey ) {
    $headers = getallheaders ( );
    if ( !isset ( $headers [ "X-Auth" ] ) ) {
      return null;
    }

    $jwt = $headers [ "X-Auth" ];
    list ( $header, $payload, $signature ) = explode ( ".", $jwt );

    $payloadDecoded = json_decode ( base64UrlDecode ( $payload ), true );
    $headerDecoded = json_decode ( base64UrlDecode ( $header ), true );

    $signatureCheck = hash_hmac ( "sha256", "$header.$payload", $secretKey, true );
    $signatureCheck = base64UrlEncode ( $signatureCheck );

    if ( $signatureCheck !== $signature ) {
      return null;
    }

    if ( isset ( $payloadDecoded [ "exp" ] ) && $payloadDecoded [ "exp" ] < time ( ) ) {
      return null;
    }

    return $payloadDecoded;
  }

  function generateJWT ( $header, $payload, $secretKey ) {
    $headerEncoded = base64UrlEncode ( json_encode ( $header ) );
    $payloadEncoded = base64UrlEncode ( json_encode ( $payload ) );
    $signature = hash_hmac ( "sha256", "$headerEncoded.$payloadEncoded", $secretKey, true );
    $signatureEncoded = base64UrlEncode ( $signature );
    return "$headerEncoded.$payloadEncoded.$signatureEncoded";
  }

  function getUser ( ) {
    global $secretKey;
    $user = authenticate ( $secretKey );

    if ( !$user ) {
      http_response_code ( 401 );
      echo json_encode ( "Unauthorized" );
      exit ( );
    }

    return $user;
  }

  $secretKey = getenv ( "JWT_SECRET" );

  if ( $secretKey === false ) {
    http_response_code ( 500 );
    echo json_encode ( "An Unexpected Error Occurred" );
    exit ( );
  }