<?php

  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Methods: POST, OPTIONS" );
  header ( "Access-Control-Allow-Headers: Origin, Content-Type, X-Auth, Response-Type" );

  if ( $_SERVER [ "REQUEST_METHOD" ] === "OPTIONS" ) {
    header ( "HTTP/1.1 200 OK" );
    exit ( );
  }

  function getFileTypeFromUrl ( $url ) {
    $path = parse_url ( $url, PHP_URL_PATH );
    $fileExtension = pathinfo ( $path, PATHINFO_EXTENSION );
    return $fileExtension;
  }

  function setHeaderForFileType ( $fileType ) {
    switch ( $fileType ) {
      case "jpg":
      case "jpeg":
        header ( "Content-Type: image/jpeg" );
        break;
      case "png":
        header ( "Content-Type: image/png" );
        break;
      case "pdf":
        header ( "Content-Type: application/pdf" );
        break;
      default:
        echo ( "Content Not Supported" );
        http_response_code ( 415 );
        exit ( );
    }
  }

  $_POST = json_decode ( file_get_contents ( "php://input" ), true );

  if ( !isset ( $_POST [ "url" ] ) ) {
    http_response_code ( 400 );
    echo json_encode ( "URL is Required" );
    exit ( );
  }

  $url = $_POST [ "url" ];

  setHeaderForFileType ( getFileTypeFromUrl ( $url ) );

  $file = readfile ( $url );

  if ( !$file ) {
    http_response_code ( 404 );
    echo json_encode ( "File Not Found" );
    exit ( );
  }

  echo ( $file );

?>