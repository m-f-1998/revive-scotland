<?php

/*
  * @author: Matthew Frankland
  * @date: 2021-06-14 16:00:00
  * @last modified by:   Matthew Frankland
  * @last modified time: 2021-06-14 16:00:00
*/

/*
  * This script is used to get assets.
  * Parameters:
  *   - url: The URL of the asset.
  * Response:
  *   - 200: The asset was successfully retrieved.
  *   - 400: URL is required.
  *   - 404: The asset was not found.
  *   - 415: The asset type is not supported.
  * Response Data:
  *   - The asset.
*/

  header ( "Access-Control-Allow-Origin: *" ); // TODO: Remove On Production
  header ( "Access-Control-Allow-Methods: GET, OPTIONS" );
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

  if ( !isset ( $_GET [ "url" ] ) ) {
    http_response_code ( 400 );
    echo json_encode ( "URL is Required" );
    exit ( );
  }

  $url = htmlspecialchars ( strip_tags ( trim ( $_GET [ "url" ] ) ) );

  setHeaderForFileType ( getFileTypeFromUrl ( $url ) );

  $file = readfile ( $url );

  if ( !$file ) {
    http_response_code ( 404 );
    echo json_encode ( "File Not Found" );
    exit ( );
  }

  echo ( $file );

?>