<?php 
require_once("../bs_panel/config/connect.php");
require_once("../rclasses/tours.php");
require_once("../rclasses/minifunctions.php");
$MyObject = new MyTours;


  if(isset($_POST['submit'])){
        $tour_date = $_POST['tour_date'];
        $col_turist = $_POST['user_col_tur'];
        $select_hotel = $_POST['select_hotel'];
        $tour_id = $_POST['tour_id'];
        $tour_type = $MyObject->getTourType($tour_id);
        $check_type = $MyObject->checkTypeTour($tour_id);
		if(isset($_POST['zapisBron'])){$zapisBronValue = $_POST['zapisBron'];}



/*Если тур индивидуальный*/
if($check_type == true){

/*Get CalRow from database*/
$calcRow = $MyObject->getDataCalcInd($tour_id);

//extract variables
$during_tour = $calcRow['col_day'];
$night_hotel = $calcRow['col_night'];
$aviabilet_price = $calcRow['bilet_price'];
$t_vnedorojnik_km = $calcRow['vnedorojnik_price'];
$t_vnedorojnik_km_ekipag = $calcRow['vnedorojnik_ekipaj'];
$t_krossover_km = $calcRow['krossover_price'];
$t_krossover_km_ekipag = $calcRow['krossover_ekipaj'];
$t_miniavtobus_km = $calcRow['mavtobus_price'];
$t_miniavtobus_km_ekipag = $calcRow['mavtobus_ekipaj'];

$db_col_turist = $calcRow['col_turist'];
$col_hotel5 = $db_col_turist / 2;
$col_hotel4 = $db_col_turist / 2;
$col_hotel3 = $db_col_turist / 2;
$col_hotel2 = $db_col_turist / 2;
$col_hostel = $db_col_turist;

$col_obed = $calcRow['p_obed'];
$col_ujin = $calcRow['p_ujen'];
$col_v_bilet_tj = $calcRow['vx_bilet_tj'];
$col_v_bilet_int = $calcRow['vx_bilet_int'];
$col_pro_rus = $calcRow['prov_ru'];
$col_pro_eng = $calcRow['prov_en'];
$col_tr_a_hotel_tj = $calcRow['tr_tj_ekipaj'];
$col_tr_a_hotel_int = $calcRow['tr_int_ekipaj'];
$col_gbao_visa = $calcRow['gbao_visa'];
$col_off_visa = $calcRow['off_visa'];
$col_int_visa = $calcRow['int_visa'];



$calcArray = $MyObject->getCalcInd($db_col_turist,$during_tour, $aviabilet_price, $t_vnedorojnik_km, 
$t_vnedorojnik_km_ekipag, $t_krossover_km,$t_krossover_km_ekipag, 
$t_miniavtobus_km, $t_miniavtobus_km_ekipag, $col_hotel5,$col_hotel4,
$col_hotel3,$col_hotel2,$col_hostel,$col_obed,$col_ujin,$col_v_bilet_tj,
$col_v_bilet_int,$col_pro_rus,$col_pro_eng,$col_tr_a_hotel_tj,$col_tr_a_hotel_int,
$col_gbao_visa, $col_off_visa,$col_int_visa,$night_hotel);

extract($calcArray);


/*Результат цены для Хостеля*/
$finishHostelRow = $MyObject->BookIndCalc($resultSummaHostel);
extract($finishHostelRow);

switch ($col_turist) {
        case 1: $finishSummaHostel = round($za1); break;
        case 2: $finishSummaHostel = round($za2); break;
        case 3: $finishSummaHostel = round($za3); break;
        case 4: $finishSummaHostel = round($za4); break;
}



/*Результат цены для Отеля 2*/
$finishHotel2Row = $MyObject->BookIndCalc($resultSummaHotel2);
extract($finishHotel2Row);

switch ($col_turist) {
        case 1: $finishSummaHotel2 = round($za1); break;
        case 2: $finishSummaHotel2 = round($za2); break;
        case 3: $finishSummaHotel2 = round($za3); break;
        case 4: $finishSummaHotel2 = round($za4); break;
}










/*Результат цены для Отеля 3*/
$finishHotel3Row = $MyObject->BookIndCalc($resultSummaHotel3);
extract($finishHotel3Row);

switch ($col_turist) {
        case 1: $finishSummaHotel3 = round($za1); break;
        case 2: $finishSummaHotel3 = round($za2); break;
        case 3: $finishSummaHotel3 = round($za3); break;
        case 4: $finishSummaHotel3 = round($za4); break;
}





/*Результат цены для Отеля 4*/
$finishHotel4Row = $MyObject->BookIndCalc($resultSummaHotel4);
extract($finishHotel4Row);

switch ($col_turist) {
        case 1: $finishSummaHotel4 = round($za1); break;
        case 2: $finishSummaHotel4 = round($za2); break;
        case 3: $finishSummaHotel4 = round($za3); break;
        case 4: $finishSummaHotel4 = round($za4); break;
}





/*Результат цены для Отеля 5*/
$finishHotel5Row = $MyObject->BookIndCalc($resultSummaHotel5);
extract($finishHotel5Row);

switch ($col_turist) {
        case 1: $finishSummaHotel5 = round($za1); break;
        case 2: $finishSummaHotel5 = round($za2); break;
        case 3: $finishSummaHotel5 = round($za3); break;
        case 4: $finishSummaHotel5 = round($za4); break;
}





$resultArray = array("resultSummaHostel" => $finishSummaHostel,
                   "resultSummaHotel2"   => $finishSummaHotel2,
                   "resultSummaHotel3"   => $finishSummaHotel3,
                   "resultSummaHotel4"   => $finishSummaHotel4,
                   "resultSummaHotel5"   => $finishSummaHotel5); 


}











/*Другое - групповой*/


if($check_type == false){

/*Get CalRow from database*/
$calcRow = $MyObject->getDataCalcGroup($tour_id);

//extract variables
$during_tour = $calcRow['col_day'];
$night_hotel = $calcRow['col_night'];

$myTour = $MyObject->getTour($tour_id);
$price = round($myTour['price']);
$star2 = round($myTour['star2']);
$star3 = round($myTour['star3']);
$star4 = round($myTour['star4']);
$star5 = round($myTour['star5']);
$finishSummaHostel = $price * $col_turist;
$finishSummaHotel2 = $star2 * $col_turist;
$finishSummaHotel3 = $star3 * $col_turist;
$finishSummaHotel4 = $star4 * $col_turist;
$finishSummaHotel5 = $star5 * $col_turist;


}


if($during_tour >1) {

        /*Уточнить выбранный гостиница с ценой*/

switch ($select_hotel) {
  case 1:
    $userHotelPrice = $finishSummaHostel;
    /*Get Hotel details*/
    $tourHostelRow = $MyObject->getTourHotel($tour_id,"hostel");
    $hotel_name = @$MyObject->getHotelName($tourHostelRow['hotel_id']);
    $hotel_address = @$MyObject->getHotelAddress($tourHostelRow['hotel_id']);
    $hotel_image = @$MyObject->getHotelImg($tourHostelRow['hotel_id']);
    $hotel_id = @$tourHostelRow['hotel_id'];
    break;

    case 2:
    $userHotelPrice = $finishSummaHotel2;
    $Star2Row = $MyObject->getTourHotel($tour_id,"star2");
    $hotel_name = $MyObject->getHotelName($Star2Row['hotel_id']);
    $hotel_address = $MyObject->getHotelAddress($Star2Row['hotel_id']);
    $hotel_image = $MyObject->getHotelImg($Star2Row['hotel_id']);
    $hotel_id = $Star2Row['hotel_id'];
    break;

    case 3:
    $userHotelPrice = $finishSummaHotel3;
    $Star3Row = $MyObject->getTourHotel($tour_id,"star3");
    $hotel_name = $MyObject->getHotelName($Star3Row['hotel_id']);
    $hotel_address = $MyObject->getHotelAddress($Star3Row['hotel_id']);
    $hotel_image = $MyObject->getHotelImg($Star3Row['hotel_id']);
    $hotel_id = $Star3Row['hotel_id'];
    break;

    case 4:
    $userHotelPrice = $finishSummaHotel4;
    $Star4Row = $MyObject->getTourHotel($tour_id,"star4");
    $hotel_name = $MyObject->getHotelName($Star4Row['hotel_id']);
    $hotel_address = $MyObject->getHotelAddress($Star4Row['hotel_id']);
    $hotel_image = $MyObject->getHotelImg($Star4Row['hotel_id']);
    $hotel_id = $Star4Row['hotel_id'];
    break;

    case 5:
    $userHotelPrice = $finishSummaHotel5;
    $Star5Row = $MyObject->getTourHotel($tour_id,"star5");
    $hotel_name = $MyObject->getHotelName($Star5Row['hotel_id']);
    $hotel_address = $MyObject->getHotelAddress($Star5Row['hotel_id']);
    $hotel_image = $MyObject->getHotelImg($Star5Row['hotel_id']);
    $hotel_id = $Star5Row['hotel_id'];
    break;
  
}

}


if($during_tour == 1){

$rowTour = $MyObject->getTour($tour_id);
$hotel_name = $rowTour['title']; 
$hotel_image = $rowTour['main_image']; 
$userHotelPrice = $finishSummaHostel;

}





      /*Подключение шаблона - (HTML)*/
	  
	  if($zapisBronValue == "zapisOplata"){require_once 'rviews/v_zayavka_zapis_ru.php';}
          if($zapisBronValue == "bronOplata"){require_once 'rviews/v_zayavka_ru.php';}
          if($zapisBronValue == ""){require_once 'rviews/v_zayavka_ru.php';}  
          //else {require_once 'rviews/v_zayavka_ru.php';}
    }
   


/*Когда заявка отправлено на сервер (cтраница заявки)*/
if(isset($_POST['SendOrder'])){
        
        $tour_id = $_POST['tour_id'];
        $tour_date = $_POST['tour_date'];
        $col_turist = $_POST['col_turist'];
        $hotel_id = $_POST['hotel_id'];
        $userHotelPrice = $_POST['userHotelPrice'];
        $zapisBronValue = $_POST['zapisBronValue'];

        $tourist_name = rprotect($_POST['tourist_name']);
        $tourist_surname = rprotect($_POST['tourist_surname']);
        $tourist_mail = rprotect($_POST['tourist_mail']);
        $tourist_phone = rprotect($_POST['tourist_phone']);
        $tourist_friends = rprotect($_POST['tourist_friends']);
        $tourist_notes = rprotect($_POST['tourist_notes']);
        $provodnik = rprotect($_POST['provodnik']);

        $MyObject->addOrder($tour_id,$col_turist,$hotel_id,$tour_date,$userHotelPrice,
                                  $tourist_name,$tourist_surname,$tourist_mail,$tourist_phone,
                                  $tourist_friends,$tourist_notes,$provodnik);
        $last_id = $conn ->lastInsertId();
        $total_price = $userHotelPrice;
		$dahfois = $total_price * 10 / 100; 
		$dahfois = round($dahfois); 



/*АЛИФ ОПЛАТА*/
  
  $key = 152065;
  $password = 'aIttCuLj96G4QAFCKzbA';
  $callbackUrl = 'http://www.bunyodtour.tj/finish_pay.php';
  $returnUrl = 'http://www.bunyodtour.tj';
  $amount = $total_price;
  $orderId = $last_id;
  $gate = 'km';
  $info = $MyObject->getTourName($tour_id);
  $email = $tourist_mail;
  $phone = $tourist_phone;
  $token = hash_hmac('sha256', $key.$orderId.number_format($amount, 2, '.', '').$callbackUrl, hash_hmac('sha256', $password, $key));

/*ОХИРИ АЛИФ*/




if ($zapisBronValue == "zapisOplata"){require_once 'rviews/v_zayavka_success_zapis_ru.php';}
else {
         /*Подключение шаблона - (HTML)*/
        require_once 'rviews/v_zayavka_success_ru.php';
        //echo $tour_date;
		}

}



