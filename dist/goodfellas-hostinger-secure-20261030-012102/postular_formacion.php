<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/community_proposals.php';
community_schema();
header('Content-Type: application/json; charset=utf-8');
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);echo json_encode(['ok'=>false]);exit;}
try{
    $body=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
    director_proposal_check_csrf((string)($body['csrf']??''));
    community_submit((int)($body['match_id']??0),(int)($body['player_id']??0),(string)($body['invite']??''),$body['teams']??null,$body['separated_pairs']??[]);
    echo json_encode(['ok'=>true,'message'=>'Propuesta recibida. Si ya habias postulado, se reemplazo tu propuesta anterior.']);
}catch(Throwable $e){http_response_code(422);echo json_encode(['ok'=>false,'message'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);}
