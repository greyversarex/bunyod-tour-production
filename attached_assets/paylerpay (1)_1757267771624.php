<?php  
include ("include/header.php");
include ("bs_panel/config/connect.php");
?>     
<section class="ftco-section testimony-section" style="margin-bottom: 100px; " id="con">
          <div align="center" style="margin-top: 20px;">
 <h2 align="center">TOUR PAYMENT</h2>
    <section class="ftco-section contact-section" style="margin-top: -80px;">
      <div class="container">
          <div class="col-md-12">
<?php


/*Процесс оплаты метода StartSession*/


?> 

<?php

if(isset($_POST['amount'])){$amount = $_POST['amount']; }
if(isset($_POST['last_id'])){$order_id = $_POST['last_id']; }




$iLength = strlen((string)$amount);
if($iLength == 1){$lengthValue = 3;}
if($iLength == 2){$lengthValue = 4;}
if($iLength == 3){$lengthValue = 5;}
if($iLength == 4){$lengthValue = 6;}
if($iLength == 5){$lengthValue = 7;}
if($iLength == 6){$lengthValue = 8;}
if($iLength == 7){$lengthValue = 9;}
if($iLength == 8){$lengthValue = 10;}
if($iLength == 9){$lengthValue = 11;}
$amount =  str_pad($amount, $lengthValue, '0', STR_PAD_RIGHT);
$amount = intval($amount);


// echo $amount."<br>".$order_id;
// exit();

//echo "<br>".$amount;
// $order_id = rand(1,100);
//echo "<br>".$order_id;

//exit();

//The url you wish to send the POST request to
//$url = "https://sandbox.payler.com/gapi/StartSession";
$url = "https://secure.payler.com/gapi/StartSession";

//The data you want to send via POST
$fields = [
              //'key' => '3938ddb3-7be1-47e6-955f-b0c7d620929f', 
              'key' => '1a92a7df-45d3-4fe7-8149-2fd0c7e8d366', 
              'type' => 'OneStep',
              'currency' => 'TJS',
              'lang' => 'en',
              'amount' => $amount,
              'order_id' => $order_id
];

//url-ify the data for the POST
$fields_string = http_build_query($fields);

//open connection
$ch = curl_init();

//set the url, number of POST vars, POST data
curl_setopt($ch,CURLOPT_URL, $url);
curl_setopt($ch,CURLOPT_POST, true);
curl_setopt($ch,CURLOPT_POSTFIELDS, $fields_string);

//So that curl_exec returns the contents of the cURL; rather than echoing it
curl_setopt($ch,CURLOPT_RETURNTRANSFER, true); 

//execute post
$result = curl_exec($ch);
$status = curl_getinfo($ch,CURLINFO_HTTP_CODE);
curl_close($ch);
$json2 = json_decode($result,true);



if ($status == 200) {
  $session_id = $json2['session_id'];
  echo "<meta http-equiv='refresh' content='0;URL=https://secure.payler.com/gapi/Pay/?session_id=$session_id'>";

}


else {
echo "JSON_DECODE";
echo "<hr>";
print_r($json2);
echo "<hr>";
echo $json2['error']['message'];
echo "<hr>";
}




?>



          </div>


        </div>
    </section>
</div>
</section>
<?php  
include ("include/footer.php");
?>
  
  <!-- loader -->
  <div id="ftco-loader" class="show fullscreen"><svg class="circular" width="48px" height="48px"><circle class="path-bg" cx="24" cy="24" r="22" fill="none" stroke-width="4" stroke="#eeeeee"/><circle class="path" cx="24" cy="24" r="22" fill="none" stroke-width="4" stroke-miterlimit="10" stroke="#F96D00"/></svg></div>

  <script src="js/jquery.min.js"></script>
  <script src="js/jquery-migrate-3.0.1.min.js"></script>
  <script src="js/popper.min.js"></script>
  <script src="js/bootstrap.min.js"></script>
  <script src="js/jquery.easing.1.3.js"></script>
  <script src="js/jquery.waypoints.min.js"></script>
  <script src="js/jquery.stellar.min.js"></script>
  <script src="js/owl.carousel.min.js"></script>
  <script src="js/jquery.magnific-popup.min.js"></script>
  <script src="js/aos.js"></script>
  <script src="js/jquery.animateNumber.min.js"></script>
  <script src="js/bootstrap-datepicker.js"></script>
  <script src="js/jquery.timepicker.min.js"></script>
  <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBVWaKrjvy3MaE7SQ74_uJiULgl1JY0H2s&sensor=false"></script>
  <script src="js/google-map.js"></script>
  <script src="js/main.js"></script>
  </body>
</html>